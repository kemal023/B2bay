import Link from "next/link";
import { AdminPageHeader, AdminTableShell } from "@/components/admin/page-header";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatPriceCents } from "@/lib/format";
import { purchaseList } from "@/lib/purchasing";
import { Download, ExternalLink, PackageCheck } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AdminPurchasingPage({
  searchParams,
}: {
  searchParams: Promise<{ placed?: string }>;
}) {
  const includePlaced = (await searchParams).placed === "1";
  const groups = await purchaseList(includePlaced);
  const placedParam = includePlaced ? "&placed=1" : "";

  return (
    <div>
      <AdminPageHeader
        title="Inkooplijst"
        description="Wat je nog bij elke leverancier moet bestellen: alle gefactureerde en betaalde bestellingen die nog niet verzonden zijn, opgeteld per product."
        action={
          groups.length > 0 ? (
            <Button asChild variant="outline">
              <a href={`/admin/purchasing/export?${placedParam.slice(1)}`}>
                <Download className="h-4 w-4" />
                Alles als CSV
              </a>
            </Button>
          ) : undefined
        }
      />

      <div className="mt-4 text-sm">
        <Link
          href={includePlaced ? "/admin/purchasing" : "/admin/purchasing?placed=1"}
          className="text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
        >
          {includePlaced
            ? "Alleen gefactureerde en betaalde bestellingen tonen"
            : "Ook bestellingen meenemen die nog op een factuur wachten"}
        </Link>
      </div>

      {groups.length === 0 ? (
        <div className="mt-16 flex flex-col items-center gap-3 text-center">
          <PackageCheck className="h-10 w-10 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Niets in te kopen — alle bestellingen zijn verzonden.</p>
        </div>
      ) : (
        groups.map((g) => (
          <section key={g.supplierId ?? "none"} className="mt-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-sm font-semibold">
                {g.supplierName}{" "}
                <span className="font-normal text-muted-foreground">
                  · {g.lines.length} product(en) · inkoop {formatPriceCents(g.totalCostCents)}
                </span>
              </h3>
              <div className="flex gap-2">
                {g.baseUrl && (
                  <Button asChild size="sm" variant="ghost">
                    <a href={g.baseUrl} target="_blank" rel="noreferrer">
                      <ExternalLink className="h-4 w-4" />
                      Naar leverancier
                    </a>
                  </Button>
                )}
                <Button asChild size="sm" variant="outline">
                  <a href={`/admin/purchasing/export?supplier=${g.supplierId ?? "none"}${placedParam}`}>
                    <Download className="h-4 w-4" />
                    CSV
                  </a>
                </Button>
              </div>
            </div>
            <AdminTableShell>
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableHead>Product</TableHead>
                    <TableHead>Artikelnr.</TableHead>
                    <TableHead>EAN</TableHead>
                    <TableHead className="text-right">Aantal</TableHead>
                    <TableHead className="text-right">Inkoop</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {g.lines.map((l) => (
                    <TableRow key={`${l.productId}-${l.name}`}>
                      <TableCell className="max-w-md text-sm">
                        <div className="truncate">{l.name}</div>
                        {l.orders > 1 && (
                          <div className="text-xs text-muted-foreground">uit {l.orders} bestellingen</div>
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{l.supplierSku ?? "—"}</TableCell>
                      <TableCell className="font-mono text-xs">{l.ean ?? "—"}</TableCell>
                      <TableCell className="text-right font-medium tabular-nums">{l.quantity}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {l.unitCostCents == null ? "—" : formatPriceCents(l.unitCostCents * l.quantity)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </AdminTableShell>
          </section>
        ))
      )}
    </div>
  );
}
