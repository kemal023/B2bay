import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { products } from "@/db/schema";

/**
 * Product photos under the shop's own address. The supplier's image URL
 * (www.annapol.com/…, old.maxy.eu/…) would tell every visitor where the
 * goods come from — in the page source, on right-click, in the network tab
 * and in link previews. Here the server fetches the photo and passes it on;
 * the browser only ever sees /img/<product id>.
 *
 * Only active products' own image URLs are fetched, so this can't be used to
 * make the server request arbitrary addresses.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response("Not found", { status: 404 });

  const product = await getDb().query.products.findFirst({
    where: and(eq(products.id, id), eq(products.active, true)),
    columns: { imageUrl: true },
  });
  if (!product?.imageUrl || !/^https?:\/\//i.test(product.imageUrl)) {
    return new Response("Not found", { status: 404 });
  }

  let upstream: Response;
  try {
    // Supplier file names sometimes contain spaces ("--------ET101 s 1.jpg").
    upstream = await fetch(product.imageUrl.replace(/ /g, "%20"), {
      signal: AbortSignal.timeout(15_000),
      // No referrer or identifying headers towards the supplier either.
      headers: { "User-Agent": "Mozilla/5.0 (compatible; image-fetch)" },
      cache: "no-store",
    });
  } catch {
    return new Response("Image unavailable", { status: 502 });
  }
  const type = upstream.headers.get("content-type") ?? "";
  if (!upstream.ok || !upstream.body || !type.startsWith("image/")) {
    return new Response("Image unavailable", { status: 502 });
  }

  return new Response(upstream.body, {
    headers: {
      "Content-Type": type,
      // Photos rarely change; browsers keep them a day and may show a stale
      // one for a week while refreshing in the background.
      "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
