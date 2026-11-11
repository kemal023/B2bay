import "server-only";
import { sql } from "drizzle-orm";
import { getDb } from "@/db";
import { getCatalogRules } from "@/lib/rules";

/** Under Google's 50,000-URL limit per sitemap file. */
export const PRODUCTS_PER_SITEMAP = 40_000;

export const siteUrl = (path = "") => `${(process.env.APP_URL ?? "http://localhost:3003").replace(/\/+$/, "")}${path}`;

const escape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function xml(body: string): Response {
  return new Response(`<?xml version="1.0" encoding="UTF-8"?>\n${body}`, {
    headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=3600" },
  });
}

export function urlset(entries: { loc: string; lastmod?: string }[]): string {
  return `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries
    .map((e) => `<url><loc>${escape(e.loc)}</loc>${e.lastmod ? `<lastmod>${e.lastmod}</lastmod>` : ""}</url>`)
    .join("\n")}\n</urlset>`;
}

/** Sellable products — the same rule as the catalogue, so no 404s in the sitemap. */
export async function countSellableProducts(): Promise<number> {
  const { minStockQty } = await getCatalogRules();
  const res = await getDb().execute<{ n: number }>(
    sql`SELECT COUNT(*)::int AS n FROM products WHERE active = true AND stock_qty >= ${minStockQty}`,
  );
  return Number(res.rows[0]?.n ?? 0);
}

export async function productPage(page: number): Promise<{ id: string; updated: string }[]> {
  const { minStockQty } = await getCatalogRules();
  const res = await getDb().execute<{ id: string; updated: string }>(sql`
    SELECT id, to_char(updated_at, 'YYYY-MM-DD') AS updated FROM products
    WHERE active = true AND stock_qty >= ${minStockQty}
    ORDER BY id LIMIT ${PRODUCTS_PER_SITEMAP} OFFSET ${page * PRODUCTS_PER_SITEMAP}
  `);
  return res.rows;
}
