import Link from "next/link";
import { and, eq, ilike, or, sql, isNull } from "drizzle-orm";
import { getDb } from "@/db";
import { products } from "@/db/schema";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ProductForm } from "@/components/admin/product-form";
import { ProductRowActions } from "@/components/admin/product-row-actions";
import { formatPriceCents } from "@/lib/format";
import { ChevronLeft, ChevronRight, Package, Plus } from "lucide-react";

const PAGE_SIZE = 50;

export default async function AdminProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; supplier?: string; page?: string }>;
}) {
  const { q, supplier: supplierFilter, page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);

  const db = getDb();

  const conditions = [];
  if (q) {
    const term = `%${q}%`;
    conditions.push(or(ilike(products.name, term), ilike(products.category, term))!);
  }
  if (supplierFilter === "manual") {
    conditions.push(isNull(products.supplierId));
  } else if (supplierFilter) {
    conditions.push(eq(products.supplierId, supplierFilter));
  }
  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [allProducts, totalRow, allSuppliers] = await Promise.all([
    db.query.products.findMany({
      where,
      orderBy: (t, { desc }) => desc(t.updatedAt),
      with: { supplier: { columns: { name: true } } },
      limit: PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE,
    }),
    db.select({ count: sql<number>`count(*)::int` }).from(products).where(where),
    db.query.suppliers.findMany({ columns: { id: true, name: true }, orderBy: (t, { asc }) => asc(t.name) }),
  ]);

  const total = totalRow[0]?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function pageHref(target: number) {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (supplierFilter) params.set("supplier", supplierFilter);
    if (target > 1) params.set("page", String(target));
    const qs = params.toString();
    return qs ? `/admin/products?${qs}` : "/admin/products";
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Producten &amp; prijzen</h2>
          <p className="text-sm text-muted-foreground">
            {total.toLocaleString("nl-NL")} product{total === 1 ? "" : "en"} — van
            leveranciers gesynchroniseerd of handmatig toegevoegd. Verkoopprijzen
            zijn hier altijd aanpasbaar.
          </p>
        </div>
        <ProductForm
          trigger={
            <Button>
              <Plus className="h-4 w-4" />
              Product toevoegen
            </Button>
          }
        />
      </div>

      <form className="mt-6 flex flex-wrap items-center gap-2" action="/admin/products">
        <Input name="q" placeholder="Zoek op naam of categorie..." defaultValue={q} className="w-64" />
        <select
          name="supplier"
          defaultValue={supplierFilter ?? ""}
          className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
        >
          <option value="">Alle bronnen</option>
          <option value="manual">Handmatig</option>
          {allSuppliers.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <Button type="submit" variant="outline">Filteren</Button>
        {(q || supplierFilter) && (
          <Button asChild variant="ghost">
            <Link href="/admin/products">Wissen</Link>
          </Button>
        )}
      </form>

      {allProducts.length === 0 ? (
        <Card className="mt-8">
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center text-muted-foreground">
            <Package className="h-10 w-10" />
            <p>Geen producten gevonden. Pas je filter aan, of voeg er hierboven één toe.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <Table className="mt-6">
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>Bron</TableHead>
                <TableHead className="text-right">Kostprijs</TableHead>
                <TableHead className="text-right">Verkoopprijs</TableHead>
                <TableHead className="text-right">Marge</TableHead>
                <TableHead className="text-right">Voorraad</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Acties</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {allProducts.map((p) => {
                const margin =
                  p.costPriceCents != null && p.costPriceCents > 0
                    ? Math.round(((p.priceCents - p.costPriceCents) / p.costPriceCents) * 100)
                    : null;

                return (
                  <TableRow key={p.id}>
                    <TableCell>
                      <div className="font-medium">{p.name}</div>
                      {p.category && <div className="text-xs text-muted-foreground">{p.category}</div>}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {p.supplier?.name ?? "Handmatig"}
                    </TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground">
                      {p.costPriceCents != null ? formatPriceCents(p.costPriceCents, p.currency) : "—"}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatPriceCents(p.priceCents, p.currency)}
                    </TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground">
                      {margin != null ? `${margin}%` : "—"}
                    </TableCell>
                    <TableCell className="text-right">{p.stockQty}</TableCell>
                    <TableCell>
                      <Badge variant={p.active ? "default" : "secondary"}>
                        {p.active ? "Zichtbaar" : "Verborgen"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <ProductRowActions
                        product={{
                          id: p.id,
                          name: p.name,
                          description: p.description,
                          imageUrl: p.imageUrl,
                          category: p.category,
                          unit: p.unit,
                          priceCents: p.priceCents,
                          costPriceCents: p.costPriceCents,
                          stockQty: p.stockQty,
                          minOrderQty: p.minOrderQty,
                          active: p.active,
                        }}
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          {totalPages > 1 && (
            <div className="mt-6 flex items-center justify-center gap-4">
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
