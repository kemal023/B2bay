import { and, asc, eq, ilike, or, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { products } from "@/db/schema";

export const PRODUCTS_PAGE_SIZE = 24;

export async function listProducts(
  opts: { q?: string; category?: string; page?: number } = {},
) {
  const db = getDb();
  const conditions = [eq(products.active, true)];

  if (opts.q) {
    const term = `%${opts.q}%`;
    conditions.push(
      or(
        ilike(products.name, term),
        ilike(products.category, term),
        ilike(products.ean, term),
      )!,
    );
  }
  if (opts.category) {
    conditions.push(eq(products.category, opts.category));
  }

  const page = Math.max(1, opts.page ?? 1);
  const where = and(...conditions);

  const [rows, totalRow] = await Promise.all([
    db.query.products.findMany({
      where,
      orderBy: asc(products.name),
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
  return db.query.products.findFirst({
    where: and(eq(products.id, id), eq(products.active, true)),
  });
}

export async function listCategories() {
  const db = getDb();
  const rows = await db
    .selectDistinct({ category: products.category })
    .from(products)
    .where(eq(products.active, true))
    .orderBy(asc(products.category));
  return rows.map((r) => r.category).filter((c): c is string => Boolean(c));
}
