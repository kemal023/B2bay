import Link from "next/link";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { listCategories, listProducts } from "@/lib/products";
import { formatPriceCents } from "@/lib/format";
import { PackageSearch } from "lucide-react";

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string }>;
}) {
  const { q, category } = await searchParams;
  const [products, categories] = await Promise.all([
    listProducts({ q, category }),
    listCategories(),
  ]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Productcatalogus</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {products.length} product{products.length === 1 ? "" : "en"} beschikbaar
          </p>
        </div>

        <form className="flex flex-wrap gap-2" action="/products">
          <Input
            name="q"
            placeholder="Zoek op naam of categorie..."
            defaultValue={q}
            className="w-64"
          />
          {category && <input type="hidden" name="category" value={category} />}
          <Button type="submit" variant="outline">Zoeken</Button>
        </form>
      </div>

      {categories.length > 0 && (
        <div className="mt-6 flex flex-wrap gap-2">
          <Link href="/products">
            <Badge variant={!category ? "default" : "secondary"} className="cursor-pointer">
              Alles
            </Badge>
          </Link>
          {categories.map((c) => (
            <Link key={c} href={`/products?category=${encodeURIComponent(c)}`}>
              <Badge variant={category === c ? "default" : "secondary"} className="cursor-pointer">
                {c}
              </Badge>
            </Link>
          ))}
        </div>
      )}

      {products.length === 0 ? (
        <div className="mt-16 flex flex-col items-center gap-3 text-center text-muted-foreground">
          <PackageSearch className="h-10 w-10" />
          <p>Geen producten gevonden. Pas je zoekopdracht of filter aan.</p>
        </div>
      ) : (
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
                  <p className="mt-1 text-xs text-muted-foreground">via {p.supplier.name}</p>
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
      )}
    </div>
  );
}
