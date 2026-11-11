import { countSellableProducts, PRODUCTS_PER_SITEMAP, siteUrl, xml } from "@/lib/sitemap";

export const dynamic = "force-dynamic";

/** Sitemap index: the fixed pages plus one file per 40,000 products. */
export async function GET() {
  const pages = Math.max(1, Math.ceil((await countSellableProducts()) / PRODUCTS_PER_SITEMAP));
  const files = ["pages", ...Array.from({ length: pages }, (_, i) => `products-${i}`)];
  return xml(
    `<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${files
      .map((f) => `<sitemap><loc>${siteUrl(`/sitemaps/${f}.xml`)}</loc></sitemap>`)
      .join("\n")}\n</sitemapindex>`,
  );
}
