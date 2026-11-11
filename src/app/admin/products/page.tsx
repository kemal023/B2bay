import Link from "next/link";
import { and, eq, gt, ilike, or, sql, isNull } from "drizzle-orm";
import { getDb } from "@/db";
import { products } from "@/db/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ProductForm } from "@/components/admin/product-form";
import { ProductRowActions } from "@/components/admin/product-row-actions";
import { AdminPageHeader, AdminTableShell } from "@/components/admin/page-header";
import { getCatalogRules } from "@/lib/rules";
import { formatPriceCents } from "@/lib/format";
import { ChevronLeft, ChevronRight, ImageOff, Package, Plus, Search } from "lucide-react";

const PAGE_SIZE = 50;

export default async function AdminProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; supplier?: string; minStock?: string; page?: string }>;
}) {
  const { q, supplier: supplierFilter, minStock: minStockParam, page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);
  const minStock = minStockParam ? Number(minStockParam) : undefined;

  const db = getDb();

  const conditions = [];
  if (q) {
    const words = q.trim().split(/\s+/).filter(Boolean);
    for (const word of words) {
      const term = `%${word}%`;
      conditions.push(
        or(ilike(products.name, term), ilike(products.category, term), ilike(products.ean, term))!,
      );
    }
  }
  if (supplierFilter === "manual") {
    conditions.push(isNull(products.supplierId));
  } else if (supplierFilter) {
    conditions.push(eq(products.supplierId, supplierFilter));
  }
  if (minStock !== undefined && Number.isFinite(minStock)) {
    conditions.push(gt(products.stockQty, minStock));
  }
  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [allProducts, totalRow, allSuppliers, rules] = await Promise.all([
    db.query.products.findMany({
      where,
      // Live products first — otherwise a bulk edit of delisted rows pushes
      // them to the top and buries the catalogue the admin actually manages.
      orderBy: (t, { desc }) => [desc(t.active), desc(t.updatedAt)],
      with: { supplier: { columns: { name: true } } },
      limit: PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE,
    }),
    db.select({ count: sql<number>`count(*)::int` }).from(products).where(where),
    db.query.suppliers.findMany({ columns: { id: true, name: true }, orderBy: (t, { asc }) => asc(t.name) }),
    getCatalogRules(),
  ]);

  const total = totalRow[0]?.count ?? 0;
  // Admins see every product, but a row the catalogue rules currently exclude
  // from sale is flagged — otherwise "Zichtbaar" would be a lie.
  const blockedByRule = (p: { active: boolean; stockQty: number }) =>
    p.active && rules.minStockQty > 0 && p.stockQty < rules.minStockQty;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function pageHref(target: number) {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (supplierFilter) params.set("supplier", supplierFilter);
    if (minStockParam) params.set("minStock", minStockParam);
    if (target > 1) params.set("page", String(target));
    const qs = params.toString();
    return qs ? `/admin/products?${qs}` : "/admin/products";
  }

  return (
    <div>
      <AdminPageHeader
        title="Producten & prijzen"
        description={`${total.toLocaleString("nl-NL")} product${total === 1 ? "" : "en"} — van leveranciers gesynchroniseerd of handmatig toegevoegd. Verkoopprijzen zijn hier altijd aanpasbaar.`}
        action={
          <ProductForm
            trigger={
              <Button>
                <Plus className="h-4 w-4" />
                Product toevoegen
              </Button>
            }
          />
        }
      />

      <form
        className="mt-6 flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-3"
        action="/admin/products"
      >
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            name="q"
            placeholder="Zoek op naam, categorie of EAN..."
            defaultValue={q}
            className="w-64 pl-9"
          />
        </div>
        <select
          name="supplier"
          defaultValue={supplierFilter ?? ""}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground"
        >
          <option value="" className="bg-background text-foreground">Alle bronnen</option>
          <option value="manual" className="bg-background text-foreground">Handmatig</option>
          {allSuppliers.map((s) => (
            <option key={s.id} value={s.id} className="bg-background text-foreground">
              {s.name}
            </option>
          ))}
        </select>
        <Input
          name="minStock"
          type="number"
          min={0}
          placeholder="Min. voorraad"
          defaultValue={minStockParam}
          className="w-32"
        />
        <Button type="submit" variant="outline">Filteren</Button>
        {(q || supplierFilter || minStockParam) && (
          <Button asChild variant="ghost">
            <Link href="/admin/products">Wissen</Link>
          </Button>
        )}
        <span className="ml-auto pr-1 text-xs text-muted-foreground">
          {total.toLocaleString("nl-NL")} resultaten
        </span>
      </form>

      {allProducts.length === 0 ? (
        <div className="mt-8 flex flex-col items-center gap-4 rounded-xl border border-dashed border-border py-16 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <Package className="h-6 w-6 text-muted-foreground" />
          </div>
          <div>
            <p className="font-medium">Geen producten gevonden</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Pas je filter aan, of voeg er hierboven één toe.
            </p>
          </div>
        </div>
      ) : (
        <>
          <AdminTableShell>
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead>Product</TableHead>
                <TableHead>Bron</TableHead>
                <TableHead className="text-right">Kostprijs</TableHead>
                <TableHead className="text-right">Prijs</TableHead>
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
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-white">
                          {p.imageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element -- supplier image domains are dynamic and admin-managed
                            <img
                              src={p.imageUrl}
                              alt=""
                              loading="lazy"
                              className="h-full w-full object-contain p-0.5"
                            />
                          ) : (
                            <ImageOff className="h-3.5 w-3.5 text-zinc-300" />
                          )}
                        </div>
                        <div className="w-[184px]">
                          <div className="truncate font-medium" title={p.name}>{p.name}</div>
                          <div className="truncate text-xs text-muted-foreground">
                            {[p.category, p.ean].filter(Boolean).join(" · ")}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {p.supplier?.name ?? "Handmatig"}
                    </TableCell>
                    <TableCell className="text-right text-sm tabular-nums text-muted-foreground">
                      {p.costPriceCents != null ? formatPriceCents(p.costPriceCents, p.currency) : "—"}
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {formatPriceCents(p.priceCents, p.currency)}
                    </TableCell>
                    <TableCell className="text-right text-sm tabular-nums text-muted-foreground">
                      {margin != null ? `${margin}%` : "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {p.stockQty.toLocaleString("nl-NL")}
                    </TableCell>
                    <TableCell>
                      <span
                        className="flex items-center gap-1.5 text-xs"
                        title={
                          blockedByRule(p)
                            ? `Voldoet niet aan de voorraadregel (minimaal ${rules.minStockQty})`
                            : undefined
                        }
                      >
                        <span
                          className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                            !p.active
                              ? "bg-muted-foreground"
                              : blockedByRule(p)
                                ? "bg-amber-500"
                                : "bg-emerald-500"
                          }`}
                        />
                        {!p.active ? "Verborgen" : blockedByRule(p) ? "Geblokkeerd" : "Zichtbaar"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <ProductRowActions
                        product={{
                          id: p.id,
                          name: p.name,
                          ean: p.ean,
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
          </AdminTableShell>

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
