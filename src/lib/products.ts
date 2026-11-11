import { and, asc, desc, eq, ilike, or, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { products } from "@/db/schema";
import { getCatalogRules, sellableConditions } from "@/lib/rules";
import type { Locale } from "@/lib/i18n/config";

export const PRODUCTS_PAGE_SIZE = 24;

/** The name the visitor actually sees, so "A → Z" sorts in their language. */
const displayName = (locale: Locale) =>
  locale === "nl" ? sql`coalesce(${products.nameNl}, ${products.name})` : sql`${products.name}`;

// Labels live in the dictionaries (catalog.sortOptions).
export const SORT_OPTIONS = {
  relevant: { orderBy: (l: Locale) => [desc(products.stockQty), asc(displayName(l))] },
  "price-asc": { orderBy: () => [asc(products.priceCents)] },
  "price-desc": { orderBy: () => [desc(products.priceCents)] },
  name: { orderBy: (l: Locale) => [asc(displayName(l))] },
  newest: { orderBy: () => [desc(products.createdAt)] },
} as const;

export type SortKey = keyof typeof SORT_OPTIONS;

export function isSortKey(value: string | undefined): value is SortKey {
  return value !== undefined && value in SORT_OPTIONS;
}

export async function listProducts(
  opts: { q?: string; category?: string; page?: number; sort?: SortKey; locale?: Locale } = {},
) {
  const db = getDb();
  const conditions = sellableConditions(await getCatalogRules());

  if (opts.q) {
    // Match each word independently (not as one literal phrase) so word
    // order/adjacency in the query doesn't matter — "A4 paper" should find
    // "A4 80g cardboard photocopy paper - 5 reams".
    const words = opts.q.trim().split(/\s+/).filter(Boolean);
    for (const word of words) {
      const term = `%${word}%`;
      conditions.push(
        // Both languages, so a Dutch search finds a product whose Dutch
        // name isn't ready yet, and an English one still works on the NL site.
        or(
          ilike(products.name, term),
          ilike(products.nameNl, term),
          ilike(products.category, term),
          ilike(products.categoryNl, term),
          ilike(products.ean, term),
        )!,
      );
    }
  }
  if (opts.category) {
    conditions.push(eq(products.category, opts.category));
  }

  const page = Math.max(1, opts.page ?? 1);
  const where = and(...conditions);

  const sort = SORT_OPTIONS[opts.sort ?? "relevant"];

  const [rows, totalRow] = await Promise.all([
    db.query.products.findMany({
      where,
      orderBy: sort.orderBy(opts.locale ?? "nl"),
      limit: PRODUCTS_PAGE_SIZE,
      offset: (page - 1) * PRODUCTS_PAGE_SIZE,
    }),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(products)
      .where(where),
  ]);

  const total = totalRow[0]?.count ?? 0;
  return {
    products: rows,
    total,
    page,
    totalPages: Math.max(1, Math.ceil(total / PRODUCTS_PAGE_SIZE)),
  };
}

export async function getProduct(id: string) {
  const db = getDb();
  const rules = await getCatalogRules();
  return db.query.products.findFirst({
    where: and(eq(products.id, id), ...sellableConditions(rules)),
  });
}

/** `category` is the stable key used in URLs; `categoryNl` is its Dutch label. */
export type CategorySummary = { category: string; categoryNl: string | null; productCount: number };

/**
 * Categories with their live product counts.
 *
 * "name" for a full list the customer scans to find one category; "size" when
 * only the first few are shown, since slicing an alphabetical list would
 * surface whatever starts with an A rather than what we actually sell most of.
 */
export async function listCategorySummaries(
  orderBy: "size" | "name" = "size",
): Promise<CategorySummary[]> {
  const db = getDb();
  const { minStockQty } = await getCatalogRules();
  const rows = await db.execute<{ category: string; category_nl: string | null; n: number }>(sql`
    SELECT category, MAX(category_nl) AS category_nl, COUNT(*)::int AS n
    FROM products
    WHERE active = true AND category IS NOT NULL AND stock_qty >= ${minStockQty}
    GROUP BY category
    ORDER BY ${orderBy === "name" ? sql`lower(category) ASC` : sql`n DESC`}
  `);
  return rows.rows.map((r) => ({
    category: r.category,
    categoryNl: r.category_nl,
    productCount: Number(r.n),
  }));
}

export async function getCatalogStats() {
  const db = getDb();
  const { minStockQty } = await getCatalogRules();
  const rows = await db.execute<{ products: number; categories: number; in_stock: number }>(sql`
    SELECT
      COUNT(*)::int AS products,
      COUNT(DISTINCT category)::int AS categories,
      COUNT(*) FILTER (WHERE stock_qty > 0)::int AS in_stock
    FROM products
    WHERE active = true AND stock_qty >= ${minStockQty}
  `);
  const row = rows.rows[0];
  return {
    products: Number(row?.products ?? 0),
    categories: Number(row?.categories ?? 0),
    inStock: Number(row?.in_stock ?? 0),
  };
}

export type ShowcaseProduct = {
  id: string;
  name: string;
  nameNl: string | null;
  category: string | null;
  categoryNl: string | null;
  imageUrl: string | null;
  priceCents: number;
  currency: string;
  unit: string;
  minOrderQty: number;
  stockQty: number;
};

/**
 * Homepage showcase. Genuine order volume comes first, but the shop is young
 * and that alone would only fill a slot or two — so the rest is filled with
 * well-stocked, photographed products, one per category so the row reads as a
 * cross-section of the catalog rather than eight variants of one item.
 */
export async function listTopDeals(limit = 8): Promise<ShowcaseProduct[]> {
  const db = getDb();
  const { minStockQty } = await getCatalogRules();
  const rows = await db.execute<{
    id: string;
    name: string;
    name_nl: string | null;
    category: string | null;
    category_nl: string | null;
    image_url: string | null;
    price_cents: number;
    currency: string;
    unit: string;
    min_order_qty: number;
    stock_qty: number;
  }>(sql`
    WITH best_sellers AS (
      SELECT p.id, SUM(oi.quantity)::int AS sold
      FROM order_items oi
      JOIN products p ON p.id = oi.product_id
      WHERE p.active = true AND p.image_url IS NOT NULL AND p.stock_qty > 0
        AND p.stock_qty >= ${minStockQty}
      GROUP BY p.id
    ),
    per_category AS (
      SELECT DISTINCT ON (p.category) p.id, p.stock_qty
      FROM products p
      WHERE p.active = true
        AND p.image_url IS NOT NULL
        AND p.category IS NOT NULL
        AND p.stock_qty > 20
        AND p.stock_qty >= ${minStockQty}
        AND p.price_cents >= 500
      ORDER BY p.category, p.stock_qty DESC
    ),
    picked AS (
      SELECT id, 0 AS tier, sold AS score FROM best_sellers
      UNION ALL
      SELECT id, 1 AS tier, stock_qty AS score FROM per_category
      WHERE id NOT IN (SELECT id FROM best_sellers)
    )
    SELECT p.id, p.name, p.name_nl, p.category, p.category_nl, p.image_url, p.price_cents,
           p.currency, p.unit, p.min_order_qty, p.stock_qty
    FROM picked
    JOIN products p ON p.id = picked.id
    ORDER BY picked.tier, picked.score DESC
    LIMIT ${limit}
  `);

  return rows.rows.map((r) => ({
    id: r.id,
    name: r.name,
    nameNl: r.name_nl,
    category: r.category,
    categoryNl: r.category_nl,
    imageUrl: r.image_url,
    priceCents: Number(r.price_cents),
    currency: r.currency,
    unit: r.unit,
    minOrderQty: Number(r.min_order_qty),
    stockQty: Number(r.stock_qty),
  }));
}

/**
 * A visitor opened a product whose description isn't translated yet: move it
 * to the front of the translation service's queue (scripts/translate-catalog.mjs
 * handles these before its backlog). Idempotent, and cheap enough to call
 * during a page render.
 */
export async function requestDescriptionTranslation(id: string): Promise<void> {
  const db = getDb();
  await db.execute(sql`
    UPDATE products SET translation_priority = now()
    WHERE id = ${id}::uuid AND desc_tr_hash IS NULL AND translation_priority IS NULL
  `);
}
