import { eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { products } from "@/db/schema";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { SupplierForm } from "@/components/admin/supplier-form";
import { SupplierRowActions } from "@/components/admin/supplier-row-actions";
import { formatDate } from "@/lib/format";
import { Plug } from "lucide-react";

// A supplier sync (via the "Sync" button's server action) can take a while
// for large feeds — e.g. Annapol's ~70k-product XML catalog.
export const maxDuration = 300;

export default async function AdminSuppliersPage() {
  const db = getDb();
  const [allSuppliers, productCounts] = await Promise.all([
    db.query.suppliers.findMany({ orderBy: (t, { desc }) => desc(t.createdAt) }),
    db
      .select({ supplierId: products.supplierId, count: sql<number>`count(*)::int` })
      .from(products)
      .where(eq(products.active, true))
      .groupBy(products.supplierId),
  ]);
  const countBySupplier = new Map(productCounts.map((r) => [r.supplierId, r.count]));

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Leveranciers &amp; API-koppelingen</h2>
          <p className="text-sm text-muted-foreground">
            Voeg een nieuwe leverancier-API toe om automatisch producten in de
            catalogus te krijgen.
          </p>
        </div>
        <SupplierForm />
      </div>

      {allSuppliers.length === 0 ? (
        <Card className="mt-8">
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center text-muted-foreground">
            <Plug className="h-10 w-10" />
            <p>Nog geen leveranciers gekoppeld. Voeg er hierboven één toe.</p>
          </CardContent>
        </Card>
      ) : (
        <Table className="mt-6">
          <TableHeader>
            <TableRow>
              <TableHead>Leverancier</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Producten</TableHead>
              <TableHead>Laatste sync</TableHead>
              <TableHead className="text-right">Acties</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {allSuppliers.map((s) => (
              <TableRow key={s.id}>
                <TableCell>
                  <div className="font-medium">{s.name}</div>
                  <div className="text-xs text-muted-foreground">{s.baseUrl}</div>
                </TableCell>
                <TableCell>
                  <Badge variant={s.active ? "default" : "secondary"}>
                    {s.active ? "Actief" : "Inactief"}
                  </Badge>
                  {s.lastSyncError && (
                    <p className="mt-1 max-w-64 truncate text-xs text-destructive" title={s.lastSyncError}>
                      {s.lastSyncError}
                    </p>
                  )}
                </TableCell>
                <TableCell>{countBySupplier.get(s.id) ?? 0}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {s.lastSyncedAt ? formatDate(s.lastSyncedAt) : "Nog niet gesynchroniseerd"}
                </TableCell>
                <TableCell className="text-right">
                  <SupplierRowActions id={s.id} active={s.active} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
