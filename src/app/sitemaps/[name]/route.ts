import { listCategoryTree } from "@/lib/products";
import { productPage, siteUrl, urlset, xml } from "@/lib/sitemap";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;

  if (name === "pages.xml") {
    const tree = await listCategoryTree();
    return xml(
      urlset([
        { loc: siteUrl("/") },
        { loc: siteUrl("/products") },
        ...tree.flatMap((c) => [
          { loc: siteUrl(`/products?cat=${c.slug}`) },
          ...c.subs.map((s) => ({ loc: siteUrl(`/products?cat=${c.slug}&sub=${s.slug}`) })),
        ]),
        { loc: siteUrl("/terms") },
        { loc: siteUrl("/privacy") },
      ]),
    );
  }

  const match = name.match(/^products-(\d+)\.xml$/);
  if (!match) return new Response("Not found", { status: 404 });
  const rows = await productPage(Number(match[1]));
  if (rows.length === 0) return new Response("Not found", { status: 404 });
  return xml(urlset(rows.map((r) => ({ loc: siteUrl(`/products/${r.id}`), lastmod: r.updated }))));
}
