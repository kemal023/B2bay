import Link from "next/link";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { listCategories, listProducts } from "@/lib/products";
import { formatPriceCents } from "@/lib/format";
import { ChevronLeft, ChevronRight, PackageSearch } from "lucide-react";

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string; page?: string }>;
}) {
  const { q, category, page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);
  const [{ products, total, totalPages }, categories] = await Promise.all([
    listProducts({ q, category, page }),
    listCategories(),
  ]);

  function pageHref(target: number) {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (category) params.set("category", category);
    if (target > 1) params.set("page", String(target));
    const qs = params.toString();
    return qs ? `/products?${qs}` : "/products";
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Productcatalogus</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {total.toLocaleString("nl-NL")} product{total === 1 ? "" : "en"} beschikbaar
          </p>
        </div>

        <form className="flex flex-wrap gap-2" action="/products">
          <Input
            name="q"
            placeholder="Zoek op naam of categorie..."
            defaultValue={q}
            className="w-56"
          />
          {categories.length > 0 && (
            <select
              name="category"
              defaultValue={category ?? ""}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">Alle categorieën</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          )}
          <Button type="submit" variant="outline">Zoeken</Button>
          {(q || category) && (
            <Button asChild variant="ghost">
              <Link href="/products">Wissen</Link>
            </Button>
          )}
        </form>
      </div>

      {products.length === 0 ? (
        <div className="mt-16 flex flex-col items-center gap-3 text-center text-muted-foreground">
          <PackageSearch className="h-10 w-10" />
          <p>Geen producten gevonden. Pas je zoekopdracht of filter aan.</p>
        </div>
      ) : (
        <>
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {products.map((p) => (
              <Link key={p.id} href={`/products/${p.id}`}>
                <Card className="h-full overflow-hidden transition-shadow hover:shadow-md">
                  <div className="relative aspect-square bg-muted">
                    {p.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element -- supplier image domains are dynamic and admin-managed
                      <img
                        src={p.imageUrl}
                        alt={p.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-muted-foreground">
                        <PackageSearch className="h-10 w-10" />
                      </div>
                    )}
                  </div>
                  <CardContent className="pt-4">
                    {p.category && (
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        {p.category}
                      </p>
                    )}
                    <h3 className="mt-1 line-clamp-2 font-medium">{p.name}</h3>
                  </CardContent>
                  <CardFooter className="flex items-center justify-between">
                    <span className="font-semibold">
                      {formatPriceCents(p.priceCents, p.currency)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      per {p.unit} · min. {p.minOrderQty}
                    </span>
                  </CardFooter>
                </Card>
              </Link>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="mt-10 flex items-center justify-center gap-4">
              {page > 1 ? (
                <Button asChild variant="outline" size="sm">
                  <Link href={pageHref(page - 1)}>
                    <ChevronLeft className="h-4 w-4" /> Vorige
                  </Link>
                </Button>
              ) : (
                <Button variant="outline" size="sm" disabled>
                  <ChevronLeft className="h-4 w-4" /> Vorige
                </Button>
              )}
              <span className="text-sm text-muted-foreground">
                Pagina {page} van {totalPages}
              </span>
              {page < totalPages ? (
                <Button asChild variant="outline" size="sm">
                  <Link href={pageHref(page + 1)}>
                    Volgende <ChevronRight className="h-4 w-4" />
                  </Link>
                </Button>
              ) : (
                <Button variant="outline" size="sm" disabled>
                  Volgende <ChevronRight className="h-4 w-4" />
                </Button>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
