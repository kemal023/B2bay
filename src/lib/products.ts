import { and, asc, desc, eq, gte, ilike, inArray, lte, or, sql, type SQL } from "drizzle-orm";
import { cache } from "react";
import { getDb } from "@/db";
import { products } from "@/db/schema";
import { getCatalogRules, sellableConditions } from "@/lib/rules";
import type { Locale } from "@/lib/i18n/config";
import { OTHER, TAXONOMY } from "@/lib/taxonomy.mjs";

export const PRODUCTS_PAGE_SIZE = 24;

/** The name the visitor actually sees, so "A → Z" sorts in their language. */
const displayName = (locale: Locale) => {
  const translated = { nl: products.nameNl, de: products.nameDe, fr: products.nameFr, en: null }[locale];
  return translated ? sql`coalesce(${translated}, ${products.name})` : sql`${products.name}`;
};

/**
 * "Most relevant" while browsing (no search): ordering by stock put the
 * biggest piles first — batteries and connectors at €0.03 — so the catalogue
 * opened with its least interesting products. Now: products with a photo, in
 * stock and in a normal price range (€2–€500) first, mixed across categories
 * by a shuffle that changes daily but stays put while paging within a day.
 */
const showcaseOrder = [
  desc(sql`${products.imageUrl} is not null`),
  desc(sql`${products.stockQty} > 0`),
  desc(sql`${products.priceCents} between 200 and 50000`),
  asc(sql`md5(${products.id}::text || current_date::text)`),
];

// Labels live in the dictionaries (catalog.sortOptions).
export const SORT_OPTIONS = {
  relevant: { orderBy: () => showcaseOrder },
  "price-asc": { orderBy: () => [asc(products.priceCents)] },
  "price-desc": { orderBy: () => [desc(products.priceCents)] },
  name: { orderBy: (l: Locale) => [asc(displayName(l))] },
  newest: { orderBy: () => [desc(products.createdAt)] },
} as const;

export type SortKey = keyof typeof SORT_OPTIONS;

export function isSortKey(value: string | undefined): value is SortKey {
  return value !== undefined && value in SORT_OPTIONS;
}

export type ListOptions = {
  q?: string;
  /** Main category slug (src/lib/taxonomy.mjs). */
  main?: string;
  /** Subcategory slug; only applied together with its main category. */
  sub?: string;
  page?: number;
  sort?: SortKey;
  locale?: Locale;
  /** List-price bounds in cents (the caller converts from the customer's own price). */
  minPriceCents?: number;
  maxPriceCents?: number;
};

const ALL_LOCALES = ["nl", "en", "de", "fr"] as const;

/** Shop categories whose name (in any language) contains the word: "gereedschap" finds the tools. */
function categoriesNamed(word: string) {
  const w = word.toLowerCase();
  const hit = (labels: Record<string, string>) => ALL_LOCALES.some((l) => labels[l].toLowerCase().includes(w));
  return {
    mains: TAXONOMY.filter((m) => hit(m.labels)).map((m) => m.slug),
    subs: TAXONOMY.flatMap((m) => m.subs).filter((s) => hit(s.labels)).map((s) => s.slug),
  };
}

/** A word that literally appears in the name, category, EAN or item number. */
function exactWordMatch(word: string): SQL {
  const term = `%${word}%`;
  const named = word.length >= 4 ? categoriesNamed(word) : { mains: [], subs: [] };
  // Both languages, so a Dutch search finds a product whose Dutch name
  // isn't ready yet, and an English one still works on the NL site.
  return or(
    ilike(products.name, term),
    ilike(products.nameNl, term),
    ilike(products.nameDe, term),
    ilike(products.nameFr, term),
    ilike(products.category, term),
    ilike(products.categoryNl, term),
    ilike(products.ean, term),
    ilike(products.supplierSku, term),
    named.mains.length ? inArray(products.mainCategory, named.mains) : undefined,
    named.subs.length ? inArray(products.subCategory, named.subs) : undefined,
  )!;
}

/** A word that resembles a word in the name — catches typos ("shampo"). */
function fuzzyWordMatch(word: string): SQL {
  return sql`(${word} <% ${products.name} OR ${word} <% ${products.nameNl})`;
}

/** How well the whole query matches the name, for "most relevant first". */
function relevance(q: string): SQL {
  return sql`greatest(word_similarity(${q}, ${products.name}), word_similarity(${q}, coalesce(${products.nameNl}, '')))`;
}

export async function listProducts(opts: ListOptions = {}) {
  const db = getDb();
  const base = sellableConditions(await getCatalogRules());
  if (opts.main) {
    base.push(eq(products.mainCategory, opts.main));
    if (opts.sub) base.push(eq(products.subCategory, opts.sub));
  }
  if (opts.minPriceCents != null) base.push(gte(products.priceCents, opts.minPriceCents));
  if (opts.maxPriceCents != null) base.push(lte(products.priceCents, opts.maxPriceCents));

  // Match each word independently (not as one literal phrase) so word
  // order/adjacency in the query doesn't matter — "A4 paper" should find
  // "A4 80g cardboard photocopy paper - 5 reams".
  const q = opts.q?.trim() ?? "";
  const words = q.split(/\s+/).filter(Boolean);
  const page = Math.max(1, opts.page ?? 1);
  const sortKey = opts.sort ?? "relevant";

  const run = async (match: (word: string) => SQL) => {
    const where = and(...base, ...words.map(match));
    const orderBy =
      q && sortKey === "relevant"
        ? [desc(relevance(q)), desc(products.stockQty)]
        : SORT_OPTIONS[sortKey].orderBy(opts.locale ?? "nl");
    const [rows, totalRow] = await Promise.all([
      db.query.products.findMany({
        where,
        orderBy,
        limit: PRODUCTS_PAGE_SIZE,
        offset: (page - 1) * PRODUCTS_PAGE_SIZE,
      }),
      db.select({ count: sql<number>`count(*)::int` }).from(products).where(where),
    ]);
    return { rows, total: totalRow[0]?.count ?? 0 };
  };

  let { rows, total } = await run(exactWordMatch);
  // Nothing found literally: try again tolerating typos, and say so.
  let fuzzy = false;
  if (total === 0 && words.some((w) => w.length >= 3)) {
    ({ rows, total } = await run((w) => (w.length >= 3 ? fuzzyWordMatch(w) : exactWordMatch(w))));
    fuzzy = total > 0;
  }

  return {
    products: rows,
    total,
    fuzzy,
    page,
    totalPages: Math.max(1, Math.ceil(total / PRODUCTS_PAGE_SIZE)),
  };
}

/** Cached per request: the product page and its metadata share one query. */
export const getProduct = cache(async (id: string) => {
  // Not a UUID: no query (Postgres would reject the cast anyway).
  if (!/^[0-9a-f-]{36}$/i.test(id)) return undefined;
  const db = getDb();
  const rules = await getCatalogRules();
  return db.query.products.findFirst({
    where: and(eq(products.id, id), ...sellableConditions(rules)),
  });
});

export type CategoryNode = {
  /** Slug from src/lib/taxonomy.mjs; labels come from there too (mainLabel/subLabel). */
  slug: string;
  productCount: number;
  subs: { slug: string; productCount: number }[];
};

/**
 * The shop's category tree with live product counts: main categories in
 * their fixed order, each with the subcategories that have products.
 * "Other" (products nothing could place) comes last, and only if non-empty.
 */
export async function listCategoryTree(): Promise<CategoryNode[]> {
  const db = getDb();
  const { minStockQty } = await getCatalogRules();
  const rows = await db.execute<{ main: string; sub: string | null; n: number }>(sql`
    SELECT main_category AS main, sub_category AS sub, COUNT(*)::int AS n
    FROM products
    WHERE active = true AND main_category IS NOT NULL AND stock_qty >= ${minStockQty}
    GROUP BY 1, 2
  `);
  const counts = new Map<string, { total: number; subs: Map<string, number> }>();
  for (const r of rows.rows) {
    let c = counts.get(r.main);
    if (!c) counts.set(r.main, (c = { total: 0, subs: new Map() }));
    c.total += Number(r.n);
    if (r.sub) c.subs.set(r.sub, Number(r.n));
  }
  const nodes: CategoryNode[] = TAXONOMY.filter((m) => counts.get(m.slug)?.total).map((m) => {
    const c = counts.get(m.slug)!;
    return {
      slug: m.slug,
      productCount: c.total,
      subs: m.subs.filter((s) => c.subs.get(s.slug)).map((s) => ({ slug: s.slug, productCount: c.subs.get(s.slug)! })),
    };
  });
  const other = counts.get(OTHER.slug);
  if (other?.total) nodes.push({ slug: OTHER.slug, productCount: other.total, subs: [] });
  return nodes;
}

export async function getCatalogStats() {
  const db = getDb();
  const { minStockQty } = await getCatalogRules();
  const rows = await db.execute<{ products: number; categories: number; in_stock: number }>(sql`
    SELECT
      COUNT(*)::int AS products,
      COUNT(DISTINCT main_category) FILTER (WHERE main_category <> 'other')::int AS categories,
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
  nameDe: string | null;
  nameFr: string | null;
  mainCategory: string | null;
  subCategory: string | null;
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
    name_de: string | null;
    name_fr: string | null;
    main_category: string | null;
    sub_category: string | null;
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
      SELECT DISTINCT ON (p.main_category) p.id, p.stock_qty
      FROM products p
      WHERE p.active = true
        AND p.image_url IS NOT NULL
        AND p.main_category IS NOT NULL AND p.main_category <> 'other'
        AND p.stock_qty > 20
        AND p.stock_qty >= ${minStockQty}
        AND p.price_cents >= 500
      ORDER BY p.main_category, p.stock_qty DESC
    ),
    picked AS (
      SELECT id, 0 AS tier, sold AS score FROM best_sellers
      UNION ALL
      SELECT id, 1 AS tier, stock_qty AS score FROM per_category
      WHERE id NOT IN (SELECT id FROM best_sellers)
    )
    SELECT p.id, p.name, p.name_nl, p.name_de, p.name_fr,
           p.main_category, p.sub_category, p.image_url, p.price_cents,
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
    nameDe: r.name_de,
    nameFr: r.name_fr,
    mainCategory: r.main_category,
    subCategory: r.sub_category,
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
