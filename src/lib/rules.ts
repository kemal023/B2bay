import { eq, gte, sql, type SQL } from "drizzle-orm";
import { getDb } from "@/db";
import { products, settings } from "@/db/schema";

/**
 * Platform-wide selling rules an admin configures at /admin/rules.
 *
 * Two kinds of rule live in this app, and they're enforced differently on
 * purpose:
 *
 * - **Catalogue rules** (this type) decide whether a product may be sold at
 *   all. They're evaluated at query time via `sellableConditions`, so changing
 *   one takes effect instantly across 70k products with no bulk write, and a
 *   product becomes sellable again by itself once it meets the rule.
 * - **Margin rules** live on the supplier (`suppliers.defaultMarkupPercent`)
 *   because a sell price is stored data, not a filter — see
 *   `applySupplierMargin`.
 *
 * Adding a catalogue rule = add a field here, a default, a line in
 * `sellableConditions`, and an input on the rules page.
 */
export type CatalogRules = {
  /** A product needs at least this much stock before customers can buy it. */
  minStockQty: number;
};

export const DEFAULT_CATALOG_RULES: CatalogRules = {
  minStockQty: 0,
};

const CATALOG_RULES_KEY = "catalog_rules";

export async function getCatalogRules(): Promise<CatalogRules> {
  const db = getDb();
  const row = await db.query.settings.findFirst({
    where: eq(settings.key, CATALOG_RULES_KEY),
  });
  if (!row) return DEFAULT_CATALOG_RULES;

  const stored = row.value as Partial<CatalogRules>;
  return {
    minStockQty: Number.isFinite(stored.minStockQty)
      ? Number(stored.minStockQty)
      : DEFAULT_CATALOG_RULES.minStockQty,
  };
}

export async function saveCatalogRules(rules: CatalogRules): Promise<void> {
  const db = getDb();
  await db
    .insert(settings)
    .values({ key: CATALOG_RULES_KEY, value: rules, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: settings.key,
      set: { value: rules, updatedAt: new Date() },
    });
}

/**
 * Every condition a product must satisfy to be offered to customers. Used by
 * the storefront queries and by the cart, so a rule can't be bypassed by
 * deep-linking a product that no longer qualifies.
 */
export function sellableConditions(rules: CatalogRules): SQL[] {
  const conditions: SQL[] = [eq(products.active, true)];
  if (rules.minStockQty > 0) {
    conditions.push(gte(products.stockQty, rules.minStockQty));
  }
  return conditions;
}

/** How many active products the current rules currently exclude from sale. */
export async function countBlockedByRules(rules: CatalogRules): Promise<number> {
  if (rules.minStockQty <= 0) return 0;
  const db = getDb();
  const rows = await db.execute<{ n: number }>(sql`
    SELECT COUNT(*)::int AS n
    FROM products
    WHERE active = true AND stock_qty < ${rules.minStockQty}
  `);
  return Number(rows.rows[0]?.n ?? 0);
}

/**
 * Recomputes sell prices for a supplier's products from their cost price at
 * the given margin. Products an admin has hand-priced (`customized`) keep
 * their price — same contract the supplier sync already honours, so a margin
 * change never silently undoes manual pricing.
 *
 * Returns how many rows were repriced.
 */
export async function applySupplierMargin(
  supplierId: string,
  markupPercent: number,
): Promise<number> {
  const db = getDb();
  // Deliberately not `.returning()`: a supplier can hold 70k+ rows and we
  // only need the count, not every id shipped back over the wire.
  const result = await db.execute(sql`
    UPDATE products
    SET price_cents = ROUND(cost_price_cents * (1 + ${markupPercent}::numeric / 100)),
        updated_at = now()
    WHERE supplier_id = ${supplierId}::uuid
      AND customized = false
      AND cost_price_cents IS NOT NULL
      AND cost_price_cents > 0
  `);

  return result.rowCount ?? 0;
}
