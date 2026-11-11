import { eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { products } from "@/db/schema";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SupplierForm } from "@/components/admin/supplier-form";
import { SupplierRowActions } from "@/components/admin/supplier-row-actions";
import { AdminPageHeader, AdminTableShell } from "@/components/admin/page-header";
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
      <AdminPageHeader
        title="Leveranciers & API-koppelingen"
        description="Voeg een nieuwe leverancier-API toe om automatisch producten in de catalogus te krijgen."
        action={<SupplierForm />}
      />

      {allSuppliers.length === 0 ? (
        <div className="mt-8 flex flex-col items-center gap-4 rounded-xl border border-dashed border-border py-16 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <Plug className="h-6 w-6 text-muted-foreground" />
          </div>
          <div>
            <p className="font-medium">Nog geen leveranciers gekoppeld</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Voeg er hierboven één toe om producten te synchroniseren.
            </p>
          </div>
        </div>
      ) : (
        <AdminTableShell>
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead>Leverancier</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Producten</TableHead>
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
                  <TableCell className="text-right font-medium tabular-nums">
                    {(countBySupplier.get(s.id) ?? 0).toLocaleString("nl-NL")}
                  </TableCell>
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
        </AdminTableShell>
      )}
    </div>
  );
}
