import "server-only";
import { getDb } from "@/db";
import type { CatalogRules } from "@/lib/rules";

/**
 * Stock figures are only as current as the supplier's last good sync. When
 * that is longer ago than the rules allow (feed down, empty feed, wrong
 * token), we don't know what the supplier still has, so customers can order
 * only a few of each of its products until the sync works again. Products
 * the shop added itself (no supplier) are never capped.
 */

/** Suppliers whose stock can't be trusted right now. */
export async function staleSupplierIds(rules: CatalogRules): Promise<Set<string>> {
  if (rules.staleMaxQty <= 0) return new Set();
  const db = getDb();
  const rows = await db.query.suppliers.findMany({
    columns: { id: true, lastGoodSyncAt: true },
  });
  const cutoff = Date.now() - rules.staleAfterHours * 3600_000;
  return new Set(
    rows.filter((s) => !s.lastGoodSyncAt || s.lastGoodSyncAt.getTime() < cutoff).map((s) => s.id),
  );
}

/**
 * The most a customer may order of this product in one order, or null for no
 * limit. Never below the minimum order quantity, so the product stays orderable.
 */
export function maxOrderQty(
  product: { supplierId: string | null; minOrderQty: number },
  stale: Set<string>,
  rules: CatalogRules,
): number | null {
  if (!product.supplierId || !stale.has(product.supplierId)) return null;
  return Math.max(rules.staleMaxQty, product.minOrderQty);
}

/** Everything a page needs to show and enforce the cap for a set of products. */
export async function orderLimits(rules: CatalogRules) {
  const stale = await staleSupplierIds(rules);
  return (product: { supplierId: string | null; minOrderQty: number }) =>
    maxOrderQty(product, stale, rules);
}
