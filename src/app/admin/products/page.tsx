import { getDb } from "@/db";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ProductForm } from "@/components/admin/product-form";
import { ProductRowActions } from "@/components/admin/product-row-actions";
import { formatPriceCents } from "@/lib/format";
import { Package, Plus } from "lucide-react";

export default async function AdminProductsPage() {
  const db = getDb();
  const allProducts = await db.query.products.findMany({
    orderBy: (t, { desc }) => desc(t.updatedAt),
    with: { supplier: { columns: { name: true } } },
  });

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Producten &amp; prijzen</h2>
          <p className="text-sm text-muted-foreground">
            Alle producten in de winkel — van leveranciers gesynchroniseerd of
            handmatig toegevoegd. Verkoopprijzen zijn hier altijd aanpasbaar.
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

      {allProducts.length === 0 ? (
        <Card className="mt-8">
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center text-muted-foreground">
            <Package className="h-10 w-10" />
            <p>Nog geen producten. Voeg er hierboven één toe of koppel een leverancier.</p>
          </CardContent>
        </Card>
      ) : (
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
      )}
    </div>
  );
}
