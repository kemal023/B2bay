import Link from "next/link";
import { getDb } from "@/db";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AdminPageHeader, AdminTableShell } from "@/components/admin/page-header";
import { formatDate, formatPriceCents } from "@/lib/format";

const statusLabels: Record<string, string> = {
  placed: "Wacht op factuur",
  invoiced: "Factuur verstuurd",
  paid: "Betaald",
  fulfilled: "Verzonden",
  cancelled: "Geannuleerd",
};

export default async function AdminOrdersPage() {
  const db = getDb();
  const allOrders = await db.query.orders.findMany({
    orderBy: (t, { desc }) => desc(t.createdAt),
    with: { company: { columns: { name: true } } },
    limit: 100,
  });

  return (
    <div>
      <AdminPageHeader
        title="Bestellingen"
        description="Alle bestellingen over alle bedrijven."
      />

      <AdminTableShell>
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead>Bedrijf</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Datum</TableHead>
              <TableHead className="text-right">Totaal</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {allOrders.map((o) => (
              <TableRow key={o.id}>
                <TableCell className="font-medium">
                  <Link href={`/admin/orders/${o.id}`} className="hover:underline">
                    {o.company.name}
                  </Link>
                </TableCell>
                <TableCell>
                  <Badge variant={o.status === "paid" || o.status === "fulfilled" ? "default" : "secondary"}>
                    {statusLabels[o.status] ?? o.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{formatDate(o.createdAt)}</TableCell>
                <TableCell className="text-right font-medium tabular-nums">
                  {formatPriceCents(o.totalCents, o.currency)}
                  {o.shippingCents == null && (
                    <span className="ml-1 text-xs text-muted-foreground">(excl. verzending)</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </AdminTableShell>
    </div>
  );
}
