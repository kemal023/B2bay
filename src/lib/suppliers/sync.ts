import { and, eq, inArray, lt, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { products, suppliers } from "@/db/schema";
import { getSupplierAdapter } from "./registry";
import type { NormalizedProduct, SupplierRow } from "./types";

export type SyncResult = {
  supplierId: string;
  supplierName: string;
  ok: boolean;
  productsUpserted: number;
  productsDeactivated: number;
  error?: string;
};

// Upserting one row at a time doesn't scale to supplier feeds with tens of
// thousands of SKUs (e.g. Annapol's ~70k), so products are upserted in
// batches of this size via a single multi-row INSERT ... ON CONFLICT.
const BATCH_SIZE = 250;

function sellPriceFromCost(costPriceCents: number, markupPercent: number): number {
  return Math.round(costPriceCents * (1 + markupPercent / 100));
}

const UPSERT_COLUMNS =
  "supplier_id, supplier_sku, name, description, image_url, category, unit, cost_price_cents, price_cents, currency, stock_qty, min_order_qty";

function buildRow(supplierId: string, item: NormalizedProduct, markupPercent: number) {
  // Explicit casts are required: a bare (VALUES ...) list has no target
  // table to infer column types from, so Postgres treats every value as
  // `text` by default and rejects the INSERT into integer columns.
  return sql`(${supplierId}::uuid, ${item.supplierSku}::text, ${item.name}::text, ${item.description ?? null}::text, ${item.imageUrl ?? null}::text, ${item.category ?? null}::text, ${item.unit ?? "stuk"}::text, ${item.costPriceCents}::integer, ${sellPriceFromCost(item.costPriceCents, markupPercent)}::integer, ${item.currency ?? "EUR"}::text, ${item.stockQty}::integer, ${item.minOrderQty ?? 1}::integer)`;
}

/**
 * Bulk-upserts one batch of products for a supplier. Cost price, stock, and
 * availability always come from the feed. Commercial/display fields (name,
 * description, image, category, unit, sell price, min order qty) are only
 * taken from the feed for brand-new rows or rows an admin hasn't customized
 * — see the `customized` column and /admin/products.
 */
async function upsertBatch(
  db: ReturnType<typeof getDb>,
  supplierId: string,
  items: NormalizedProduct[],
  markupPercent: number,
) {
  const usable = items.filter((i) => i.supplierSku);
  if (usable.length === 0) return;
  const rows = usable.map((item) => buildRow(supplierId, item, markupPercent));

  await db.execute(sql`
    INSERT INTO products (${sql.raw(UPSERT_COLUMNS)}, active, updated_at)
    SELECT v.supplier_id, v.supplier_sku, v.name, v.description, v.image_url, v.category, v.unit, v.cost_price_cents, v.price_cents, v.currency, v.stock_qty, v.min_order_qty, true, now()
    FROM (VALUES ${sql.join(rows, sql`, `)}) AS v(${sql.raw(UPSERT_COLUMNS)})
    ON CONFLICT (supplier_id, supplier_sku) DO UPDATE SET
      cost_price_cents = excluded.cost_price_cents,
      stock_qty = excluded.stock_qty,
      active = true,
      updated_at = now(),
      name = CASE WHEN products.customized THEN products.name ELSE excluded.name END,
      description = CASE WHEN products.customized THEN products.description ELSE excluded.description END,
      image_url = CASE WHEN products.customized THEN products.image_url ELSE excluded.image_url END,
      category = CASE WHEN products.customized THEN products.category ELSE excluded.category END,
      unit = CASE WHEN products.customized THEN products.unit ELSE excluded.unit END,
      price_cents = CASE WHEN products.customized THEN products.price_cents ELSE excluded.price_cents END,
      min_order_qty = CASE WHEN products.customized THEN products.min_order_qty ELSE excluded.min_order_qty END
  `);
}

/** Fetches one supplier's catalog and bulk-upserts it into our own `products` table. */
export async function syncSupplier(supplier: SupplierRow): Promise<SyncResult> {
  const db = getDb();
  const adapter = getSupplierAdapter(supplier.adapterType);
  const syncStartedAt = new Date();

  try {
    const fetched = await adapter.fetchProducts(supplier);

    // A single statement's ON CONFLICT DO UPDATE can't touch the same row
    // twice, so if a supplier's feed lists the same SKU more than once
    // (seen in practice), keep only the last occurrence before batching.
    const bySku = new Map<string, NormalizedProduct>();
    for (const item of fetched) {
      if (item.supplierSku) bySku.set(item.supplierSku, item);
    }
    const items = [...bySku.values()];

    let upserted = 0;
    for (let i = 0; i < items.length; i += BATCH_SIZE) {
      const batch = items.slice(i, i + BATCH_SIZE);
      await upsertBatch(db, supplier.id, batch, supplier.defaultMarkupPercent);
      upserted += batch.length;
    }

    // Deactivate products no longer present upstream, rather than deleting
    // them (past order history keeps a valid reference). Rows touched by
    // the upserts above just got `updated_at = now()`, so anything still
    // stamped with a timestamp from before this sync started wasn't in the
    // feed this time — this scales to huge feeds without needing to pass
    // every current SKU into a giant NOT IN (...) list.
    let deactivated = 0;
    if (items.length > 0) {
      const result = await db
        .update(products)
        .set({ active: false, updatedAt: new Date() })
        .where(
          and(
            eq(products.supplierId, supplier.id),
            eq(products.active, true),
            lt(products.updatedAt, syncStartedAt),
          ),
        )
        .returning({ id: products.id });
      deactivated = result.length;
    }

    await db
      .update(suppliers)
      .set({ lastSyncedAt: new Date(), lastSyncError: null })
      .where(eq(suppliers.id, supplier.id));

    return {
      supplierId: supplier.id,
      supplierName: supplier.name,
      ok: true,
      productsUpserted: upserted,
      productsDeactivated: deactivated,
    };
  } catch (err) {
    const cause = err instanceof Error && err.cause instanceof Error ? err.cause.message : null;
    const message = err instanceof Error ? (cause ? `${err.message.split("\n")[0]} — ${cause}` : err.message) : "Unknown sync error";
    await db
      .update(suppliers)
      .set({ lastSyncedAt: new Date(), lastSyncError: message })
      .where(eq(suppliers.id, supplier.id));

    return {
      supplierId: supplier.id,
      supplierName: supplier.name,
      ok: false,
      productsUpserted: 0,
      productsDeactivated: 0,
      error: message,
    };
  }
}

export async function syncAllActiveSuppliers(): Promise<SyncResult[]> {
  const db = getDb();
  const active = await db.query.suppliers.findMany({
    where: eq(suppliers.active, true),
  });
  const results: SyncResult[] = [];
  for (const supplier of active) {
    results.push(await syncSupplier(supplier));
  }
  return results;
}

export async function syncSuppliersByIds(ids: string[]): Promise<SyncResult[]> {
  const db = getDb();
  if (ids.length === 0) return [];
  const rows = await db.query.suppliers.findMany({
    where: inArray(suppliers.id, ids),
  });
  const results: SyncResult[] = [];
  for (const supplier of rows) {
    results.push(await syncSupplier(supplier));
  }
  return results;
}
