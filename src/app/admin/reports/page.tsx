import { AdminPageHeader, AdminTableShell } from "@/components/admin/page-header";
import { RevenueChart } from "@/components/admin/revenue-chart";
import { StatCard } from "@/components/admin/stat-card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatPriceCents } from "@/lib/format";
import { marginBySupplier, revenueByMonth, topCustomers, topProducts, type RankRow } from "@/lib/reports";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ClipboardList, Download, Euro, Percent, TrendingUp } from "lucide-react";

export const dynamic = "force-dynamic";

const pct = (part: number | null, whole: number) =>
  part == null || whole <= 0 ? "—" : `${((part / whole) * 100).toFixed(1).replace(".", ",")}%`;

function RankTable({
  title,
  rows,
  qtyLabel,
  showMargin,
}: {
  title: string;
  rows: RankRow[];
  qtyLabel: string;
  showMargin: boolean;
}) {
  return (
    <section>
      <h3 className="mt-8 text-sm font-semibold">{title}</h3>
      <AdminTableShell>
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead>Naam</TableHead>
              <TableHead className="text-right">{qtyLabel}</TableHead>
              <TableHead className="text-right">Omzet</TableHead>
              {showMargin && <TableHead className="text-right">Marge</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="py-6 text-center text-sm text-muted-foreground">
                  Nog geen gefactureerde verkopen in deze periode.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r) => (
                <TableRow key={r.label}>
                  <TableCell className="max-w-md truncate text-sm">{r.label}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.quantity.toLocaleString("nl-NL")}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatPriceCents(r.revenueCents)}</TableCell>
                  {showMargin && (
                    <TableCell className="text-right tabular-nums">
                      {r.marginCents == null ? "—" : formatPriceCents(r.marginCents)}{" "}
                      <span className="text-xs text-muted-foreground">{pct(r.marginCents, r.revenueCents)}</span>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </AdminTableShell>
    </section>
  );
}

export default async function AdminReportsPage() {
  const [months, products, customers, suppliers] = await Promise.all([
    revenueByMonth(12),
    topProducts(),
    topCustomers(),
    marginBySupplier(),
  ]);

  const revenue = months.reduce((s, m) => s + m.revenueCents, 0);
  const orders = months.reduce((s, m) => s + m.orders, 0);
  const margin = months.reduce((s, m) => s + (m.marginCents ?? 0), 0);
  const thisMonth = months.at(-1);

  return (
    <div>
      <AdminPageHeader
        title="Cijfers"
        description="Gefactureerde verkopen van de laatste 12 maanden, exclusief btw. Marge = verkoopprijs min inkoopprijs op het moment van bestellen."
      />

      <form
        action="/admin/reports/export"
        className="mt-6 flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-4"
      >
        <div className="space-y-1">
          <label htmlFor="from" className="text-xs font-medium">
            Van maand
          </label>
          <Input id="from" name="from" type="month" defaultValue={months[0]?.month} className="h-9 w-40" />
        </div>
        <div className="space-y-1">
          <label htmlFor="to" className="text-xs font-medium">
            Tot en met
          </label>
          <Input id="to" name="to" type="month" defaultValue={thisMonth?.month} className="h-9 w-40" />
        </div>
        <Button type="submit" variant="outline">
          <Download className="h-4 w-4" />
          Verkoopboek (CSV) voor de boekhouding
        </Button>
        <p className="w-full text-xs text-muted-foreground">
          Alle facturen en creditnota&apos;s in de periode, met netto, btw, totaal en btw-behandeling (binnenland of
          verlegd). Te importeren in Moneybird, Exact, e-Boekhouden of Excel. Voor de ICP-opgave: filter op
          &ldquo;Btw verlegd&rdquo;.
        </p>
      </form>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Euro} label="Omzet 12 maanden" value={formatPriceCents(revenue)} hint="Excl. btw, incl. verzending" />
        <StatCard icon={TrendingUp} label="Deze maand" value={formatPriceCents(thisMonth?.revenueCents ?? 0)} />
        <StatCard
          icon={Percent}
          label="Marge 12 maanden"
          value={formatPriceCents(margin)}
          hint={`${pct(margin, revenue)} van de omzet`}
        />
        <StatCard
          icon={ClipboardList}
          label="Bestellingen"
          value={orders.toLocaleString("nl-NL")}
          hint={orders ? `Gemiddeld ${formatPriceCents(Math.round(revenue / orders))}` : undefined}
        />
      </div>

      <section className="mt-6 rounded-xl border border-border bg-card p-6">
        <h3 className="text-sm font-semibold">Omzet per maand</h3>
        <div className="mt-4">
          <RevenueChart data={months} />
        </div>
        <details className="mt-4 text-sm">
          <summary className="cursor-pointer text-muted-foreground hover:text-foreground">Als tabel</summary>
          <Table className="mt-2">
            <TableHeader>
              <TableRow>
                <TableHead>Maand</TableHead>
                <TableHead className="text-right">Bestellingen</TableHead>
                <TableHead className="text-right">Omzet</TableHead>
                <TableHead className="text-right">Marge</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {months.map((m) => (
                <TableRow key={m.month}>
                  <TableCell>{m.month}</TableCell>
                  <TableCell className="text-right tabular-nums">{m.orders}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatPriceCents(m.revenueCents)}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {m.marginCents == null ? "—" : formatPriceCents(m.marginCents)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </details>
      </section>

      <RankTable title="Marge per leverancier" rows={suppliers} qtyLabel="Stuks" showMargin />
      <div className="grid gap-x-6 xl:grid-cols-2">
        <RankTable title="Best verkochte producten" rows={products} qtyLabel="Stuks" showMargin />
        <RankTable title="Grootste klanten" rows={customers} qtyLabel="Bestellingen" showMargin={false} />
      </div>
    </div>
  );
}
