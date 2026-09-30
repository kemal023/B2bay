import { and, asc, eq, ilike, or } from "drizzle-orm";
import { getDb } from "@/db";
import { products } from "@/db/schema";

export async function listProducts(opts: { q?: string; category?: string } = {}) {
  const db = getDb();
  const conditions = [eq(products.active, true)];

  if (opts.q) {
    const term = `%${opts.q}%`;
    conditions.push(
      or(ilike(products.name, term), ilike(products.category, term))!,
    );
  }
  if (opts.category) {
    conditions.push(eq(products.category, opts.category));
  }

  return db.query.products.findMany({
    where: and(...conditions),
    orderBy: asc(products.name),
  });
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
    .where(eq(products.active, true));
  return rows.map((r) => r.category).filter((c): c is string => Boolean(c));
}
