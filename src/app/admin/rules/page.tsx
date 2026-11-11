import { eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { products } from "@/db/schema";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AdminPageHeader } from "@/components/admin/page-header";
import { MinStockRuleForm, SupplierMarginForm } from "@/components/admin/rule-forms";
import { countBlockedByRules, getCatalogRules } from "@/lib/rules";
import { Info, Package, Percent } from "lucide-react";

export default async function AdminRulesPage() {
  const db = getDb();

  const [rules, allSuppliers, countsRows] = await Promise.all([
    getCatalogRules(),
    db.query.suppliers.findMany({ orderBy: (t, { asc }) => asc(t.name) }),
    db
      .select({
        supplierId: products.supplierId,
        total: sql<number>`count(*)::int`,
        customized: sql<number>`count(*) FILTER (WHERE ${products.customized})::int`,
      })
      .from(products)
      .where(eq(products.active, true))
      .groupBy(products.supplierId),
  ]);

  const blocked = await countBlockedByRules(rules);
  const countsBySupplier = new Map(
    countsRows.map((r) => [r.supplierId, { total: r.total, customized: r.customized }]),
  );

  return (
    <div>
      <AdminPageHeader
        title="Regels"
        description="Voorwaarden die automatisch gelden voor de hele catalogus — zonder per product iets aan te passen."
      />

      <section className="mt-6 rounded-xl border border-border bg-card p-5">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
            <Package className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="font-semibold tracking-tight">Verkoopregels</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Producten die niet aan deze regels voldoen, verdwijnen uit de
              webshop en kunnen niet besteld worden. Ze blijven wel in de
              catalogus staan en komen vanzelf terug zodra ze er weer aan
              voldoen.
            </p>

            <div className="mt-5 border-t border-border pt-5">
              <h3 className="text-sm font-medium">
                Alleen verkopen bij voldoende voorraad
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Zet dit op bijvoorbeeld 10 om alleen producten te verkopen
                waarvan er minimaal 10 op voorraad liggen. Op 0 geldt er geen
                drempel.
              </p>
              <div className="mt-4">
                <MinStockRuleForm minStockQty={rules.minStockQty} />
              </div>

              {rules.minStockQty > 0 && (
                <p className="mt-4 flex items-start gap-2 rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
                  <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  Met de huidige regel zijn{" "}
                  <strong className="font-medium text-foreground">
                    {blocked.toLocaleString("nl-NL")}
                  </strong>{" "}
                  actieve producten niet te koop omdat hun voorraad onder{" "}
                  {rules.minStockQty} ligt.
                </p>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="mt-6 rounded-xl border border-border bg-card p-5">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
            <Percent className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="font-semibold tracking-tight">Marge per leverancier</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              De opslag op de inkoopprijs. Bij opslaan worden alle bestaande
              producten van die leverancier direct herberekend, en nieuwe
              producten volgen bij de eerstvolgende synchronisatie.
            </p>

            {allSuppliers.length === 0 ? (
              <p className="mt-5 border-t border-border pt-5 text-sm text-muted-foreground">
                Nog geen leveranciers gekoppeld.
              </p>
            ) : (
              <div className="mt-5 overflow-hidden rounded-xl border border-border">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40 hover:bg-muted/40">
                      <TableHead>Leverancier</TableHead>
                      <TableHead className="text-right">Producten</TableHead>
                      <TableHead className="text-right">Eigen prijs</TableHead>
                      <TableHead className="text-right">Marge</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {allSuppliers.map((s) => {
                      const counts = countsBySupplier.get(s.id);
                      return (
                        <TableRow key={s.id}>
                          <TableCell className="font-medium">{s.name}</TableCell>
                          <TableCell className="text-right tabular-nums text-muted-foreground">
                            {(counts?.total ?? 0).toLocaleString("nl-NL")}
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-muted-foreground">
                            {(counts?.customized ?? 0).toLocaleString("nl-NL")}
                          </TableCell>
                          <TableCell>
                            <div className="flex justify-end">
                              <SupplierMarginForm
                                supplierId={s.id}
                                markupPercent={s.defaultMarkupPercent}
                              />
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}

            <p className="mt-4 flex items-start gap-2 rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Producten in de kolom &quot;eigen prijs&quot; hebben een
              handmatig ingestelde verkoopprijs en worden door een
              margewijziging niet overschreven.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
