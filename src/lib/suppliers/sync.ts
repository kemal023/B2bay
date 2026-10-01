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

// Columns shared by both write paths below (everything except the
// row-identifying columns, which differ: supplier_id+supplier_sku for a
// fresh/normal upsert, vs. id for an EAN-linked relink).
const COMMON_COLUMNS =
  "ean, name, source_name, description, image_url, category, unit, cost_price_cents, price_cents, currency, stock_qty, min_order_qty";

// On every sync, `name`/`source_name` are set to the supplier's current raw
// value. `source_name` always ends up holding that raw value; `name` only
// does when the row is new — once a translated name diverges from
// source_name, the CASE in each UPDATE below leaves `name` alone.
function commonValues(item: NormalizedProduct, markupPercent: number) {
  return sql`${item.ean ?? null}::text, ${item.name}::text, ${item.name}::text, ${item.description ?? null}::text, ${item.imageUrl ?? null}::text, ${item.category ?? null}::text, ${item.unit ?? "stuk"}::text, ${item.costPriceCents}::integer, ${sellPriceFromCost(item.costPriceCents, markupPercent)}::integer, ${item.currency ?? "EUR"}::text, ${item.stockQty}::integer, ${item.minOrderQty ?? 1}::integer`;
}

// Applies to both write paths: protects an admin-edited OR already-
// translated name (and the other commercial/display fields, gated on
// `customized` only) from being clobbered by the supplier feed.
const PROTECTED_SET = sql`
  ean = excluded.ean,
  cost_price_cents = excluded.cost_price_cents,
  stock_qty = excluded.stock_qty,
  active = true,
  updated_at = now(),
  source_name = excluded.source_name,
  name = CASE WHEN products.customized OR products.name <> products.source_name THEN products.name ELSE excluded.name END,
  description = CASE WHEN products.customized THEN products.description ELSE excluded.description END,
  image_url = CASE WHEN products.customized THEN products.image_url ELSE excluded.image_url END,
  category = CASE WHEN products.customized THEN products.category ELSE excluded.category END,
  unit = CASE WHEN products.customized THEN products.unit ELSE excluded.unit END,
  price_cents = CASE WHEN products.customized THEN products.price_cents ELSE excluded.price_cents END,
  min_order_qty = CASE WHEN products.customized THEN products.min_order_qty ELSE excluded.min_order_qty END
`;

/** Normal path: match/insert by (supplier_id, supplier_sku), as before. */
async function upsertBySkuBatch(
  db: ReturnType<typeof getDb>,
  supplierId: string,
  items: NormalizedProduct[],
  markupPercent: number,
) {
  if (items.length === 0) return;
  const columns = `supplier_id, supplier_sku, ${COMMON_COLUMNS}`;
  const rows = items.map(
    (item) =>
      sql`(${supplierId}::uuid, ${item.supplierSku}::text, ${commonValues(item, markupPercent)})`,
  );

  await db.execute(sql`
    INSERT INTO products (${sql.raw(columns)}, active, updated_at)
    SELECT v.supplier_id, v.supplier_sku, v.ean, v.name, v.source_name, v.description, v.image_url, v.category, v.unit, v.cost_price_cents, v.price_cents, v.currency, v.stock_qty, v.min_order_qty, true, now()
    FROM (VALUES ${sql.join(rows, sql`, `)}) AS v(${sql.raw(columns)})
    ON CONFLICT (supplier_id, supplier_sku) DO UPDATE SET ${PROTECTED_SET}
  `);
}

/**
 * EAN path: this batch's items share a barcode with a product that already
 * exists (possibly under a *different* supplier). Update that row in place
 * — including reassigning supplier_id/supplier_sku to this sync's source —
 * instead of creating a duplicate listing for the same physical product.
 */
async function relinkByEanBatch(
  db: ReturnType<typeof getDb>,
  supplierId: string,
  items: { id: string; item: NormalizedProduct }[],
  markupPercent: number,
) {
  if (items.length === 0) return;
  // Every `id` here already exists (that's how eanLinked was built), so
  // this INSERT always conflicts on the primary key and falls through to
  // the UPDATE — it's just a vehicle for reusing PROTECTED_SET's
  // `excluded.x` references, including reassigning supplier_id/sku to
  // this sync's source (an EAN match can come from a different supplier).
  const columns = `id, supplier_id, supplier_sku, ${COMMON_COLUMNS}`;
  const rows = items.map(
    ({ id, item }) =>
      sql`(${id}::uuid, ${supplierId}::uuid, ${item.supplierSku}::text, ${commonValues(item, markupPercent)})`,
  );

  // active/updated_at are left off the column list: this INSERT branch
  // never actually executes (id always already exists), so the schema's
  // own defaults are irrelevant — the real write happens via ON CONFLICT
  // DO UPDATE, which sets both explicitly inside PROTECTED_SET.
  await db.execute(sql`
    INSERT INTO products (${sql.raw(columns)})
    VALUES ${sql.join(rows, sql`, `)}
    ON CONFLICT (id) DO UPDATE SET
      supplier_id = excluded.supplier_id,
      supplier_sku = excluded.supplier_sku,
      ${PROTECTED_SET}
  `);
}

/**
 * Bulk-upserts one batch of products for a supplier. Cost price, stock, and
 * availability always come from the feed. Commercial/display fields (name,
 * description, image, category, unit, sell price, min order qty) are only
 * taken from the feed for brand-new rows, or rows an admin hasn't
 * customized and whose name hasn't been translated — see the `customized`
 * column and /admin/products, and `source_name` above.
 *
 * Items whose EAN barcode matches a product that already exists (under any
 * supplier) are linked to that existing row instead of creating a
 * duplicate — see relinkByEanBatch.
 */
async function upsertBatch(
  db: ReturnType<typeof getDb>,
  supplierId: string,
  items: NormalizedProduct[],
  markupPercent: number,
) {
  const bySkuFiltered = items.filter((i) => i.supplierSku);
  if (bySkuFiltered.length === 0) return;

  // Two different SKUs in this batch can share a brand-new EAN (not yet in
  // the DB either) — e.g. colour variants barcoded together. Without this,
  // both would go on to INSERT as separate fresh rows with the same ean in
  // one statement, violating products_ean_idx. Dedup first, last wins, same
  // policy as the global SKU dedup in syncSupplier.
  const usable: NormalizedProduct[] = [];
  const eanIndex = new Map<string, number>();
  for (const item of bySkuFiltered) {
    if (item.ean) {
      const idx = eanIndex.get(item.ean);
      if (idx !== undefined) {
        usable[idx] = item;
        continue;
      }
      eanIndex.set(item.ean, usable.length);
    }
    usable.push(item);
  }

  const eans = usable.map((i) => i.ean).filter((e): e is string => Boolean(e));
  const existingByEan = new Map<string, string>();
  if (eans.length > 0) {
    const rows = await db
      .select({ id: products.id, ean: products.ean })
      .from(products)
      .where(inArray(products.ean, eans));
    for (const row of rows) {
      if (row.ean) existingByEan.set(row.ean, row.id);
    }
  }

  // Two different feed SKUs can turn out to share one EAN (e.g. colour
  // variants barcoded together) — only the last one found wins the link;
  // the rest stay on their own row via the normal SKU path, same policy as
  // the SKU dedup above.
  const eanLinkedById = new Map<string, { id: string; item: NormalizedProduct }>();
  const bySku: NormalizedProduct[] = [];
  for (const item of usable) {
    const existingId = item.ean ? existingByEan.get(item.ean) : undefined;
    if (existingId) eanLinkedById.set(existingId, { id: existingId, item });
    else bySku.push(item);
  }
  const eanLinked = [...eanLinkedById.values()];

  // An EAN-linked row is about to take over `item.supplierSku` as its new
  // identity. If an *older* row (from before this product was EAN-linked)
  // already owns that exact (supplier_id, supplier_sku) pair, reassigning
  // it collides with products_supplier_sku_idx. That older row is the same
  // physical product (same EAN match) under its pre-link identity, so it's
  // being superseded, not lost — free its supplier_sku and deactivate it
  // rather than leaving a stale duplicate listing active in the catalog.
  if (eanLinked.length > 0) {
    const targetIds = sql.join(
      eanLinked.map((e) => sql`${e.id}::uuid`),
      sql`, `,
    );
    const targetSkus = sql.join(
      eanLinked.map((e) => sql`${e.item.supplierSku}::text`),
      sql`, `,
    );
    await db.execute(sql`
      UPDATE products
      SET supplier_sku = NULL, active = false, updated_at = now()
      WHERE supplier_id = ${supplierId}::uuid
        AND supplier_sku IN (${targetSkus})
        AND id NOT IN (${targetIds})
    `);
  }

  await Promise.all([
    relinkByEanBatch(db, supplierId, eanLinked, markupPercent),
    upsertBySkuBatch(db, supplierId, bySku, markupPercent),
  ]);
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
