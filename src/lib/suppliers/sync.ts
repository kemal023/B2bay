import { and, eq, inArray, notInArray } from "drizzle-orm";
import { getDb } from "@/db";
import { products, suppliers } from "@/db/schema";
import { getSupplierAdapter } from "./registry";
import type { SupplierRow } from "./types";

export type SyncResult = {
  supplierId: string;
  supplierName: string;
  ok: boolean;
  productsUpserted: number;
  productsDeactivated: number;
  error?: string;
};

/** Fetches one supplier's catalog and upserts it into `products`. */
export async function syncSupplier(supplier: SupplierRow): Promise<SyncResult> {
  const db = getDb();
  const adapter = getSupplierAdapter(supplier.adapterType);

  try {
    const items = await adapter.fetchProducts(supplier);

    let upserted = 0;
    for (const item of items) {
      if (!item.supplierSku) continue;
      await db
        .insert(products)
        .values({
          supplierId: supplier.id,
          supplierSku: item.supplierSku,
          name: item.name,
          description: item.description,
          imageUrl: item.imageUrl,
          category: item.category,
          unit: item.unit ?? "stuk",
          priceCents: item.priceCents,
          currency: item.currency ?? "EUR",
          stockQty: item.stockQty,
          minOrderQty: item.minOrderQty ?? 1,
          active: true,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [products.supplierId, products.supplierSku],
          set: {
            name: item.name,
            description: item.description,
            imageUrl: item.imageUrl,
            category: item.category,
            unit: item.unit ?? "stuk",
            priceCents: item.priceCents,
            currency: item.currency ?? "EUR",
            stockQty: item.stockQty,
            minOrderQty: item.minOrderQty ?? 1,
            active: true,
            updatedAt: new Date(),
          },
        });
      upserted++;
    }

    // Deactivate products no longer present upstream, rather than deleting
    // them, so past order history (order_items) keeps a valid reference.
    const currentSkus = items.map((i) => i.supplierSku).filter(Boolean);
    let deactivated = 0;
    if (currentSkus.length > 0) {
      const result = await db
        .update(products)
        .set({ active: false, updatedAt: new Date() })
        .where(
          and(
            eq(products.supplierId, supplier.id),
            notInArray(products.supplierSku, currentSkus),
            eq(products.active, true),
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
    const message = err instanceof Error ? err.message : "Unknown sync error";
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
