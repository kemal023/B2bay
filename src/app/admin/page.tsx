import Link from "next/link";
import { sql } from "drizzle-orm";
import { getDb } from "@/db";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AdminPageHeader } from "@/components/admin/page-header";
import { StatCard } from "@/components/admin/stat-card";
import { formatDate, formatPriceCents } from "@/lib/format";
import {
  ArrowRight,
  Building2,
  CircleAlert,
  CircleCheck,
  ClipboardList,
  Euro,
  Package,
  Plug,
  TriangleAlert,
} from "lucide-react";

const statusLabels: Record<string, string> = {
  placed: "Wacht op factuur",
  invoiced: "Factuur verstuurd",
  paid: "Betaald",
  fulfilled: "Verzonden",
  cancelled: "Geannuleerd",
};

export default async function AdminOverviewPage() {
  const db = getDb();

  const [statsRows, recentOrders, suppliers, pendingCompanies] = await Promise.all([
    db.execute<{
      active_products: number;
      open_orders: number;
      pending_companies: number;
      revenue_cents: number;
      failing_suppliers: number;
    }>(sql`
      SELECT
        (SELECT COUNT(*) FROM products WHERE active = true)::int AS active_products,
        (SELECT COUNT(*) FROM orders WHERE status IN ('placed', 'invoiced'))::int AS open_orders,
        (SELECT COUNT(*) FROM companies WHERE status = 'pending')::int AS pending_companies,
        (SELECT COALESCE(SUM(total_cents), 0) FROM orders WHERE status IN ('paid', 'fulfilled'))::int AS revenue_cents,
        (SELECT COUNT(*) FROM suppliers WHERE last_sync_error IS NOT NULL AND active = true)::int AS failing_suppliers
    `),
    db.query.orders.findMany({
      orderBy: (t, { desc }) => desc(t.createdAt),
      with: { company: { columns: { name: true } } },
      limit: 6,
    }),
    db.query.suppliers.findMany({ orderBy: (t, { asc }) => asc(t.name) }),
    db.query.companies.findMany({
      where: (t, { eq }) => eq(t.status, "pending"),
      orderBy: (t, { desc }) => desc(t.createdAt),
      limit: 5,
    }),
  ]);

  const stats = statsRows.rows[0];
  const activeProducts = Number(stats?.active_products ?? 0);
  const openOrders = Number(stats?.open_orders ?? 0);
  const pendingCount = Number(stats?.pending_companies ?? 0);
  const revenueCents = Number(stats?.revenue_cents ?? 0);
  const failingSuppliers = Number(stats?.failing_suppliers ?? 0);

  const awaitingInvoice = recentOrders.filter((o) => o.status === "placed").length;
  const hasActions = pendingCount > 0 || awaitingInvoice > 0 || failingSuppliers > 0;

  return (
    <div>
      <AdminPageHeader
        title="Overzicht"
        description="De actuele status van de catalogus, bestellingen en zakelijke accounts."
        action={
          <Button asChild variant="outline">
            <Link href="/admin/products">
              Naar producten
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        }
      />

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={Package}
          label="Actieve producten"
          value={activeProducts.toLocaleString("nl-NL")}
          href="/admin/products"
        />
        <StatCard
          icon={ClipboardList}
          label="Openstaande bestellingen"
          value={openOrders.toLocaleString("nl-NL")}
          hint="Wacht op factuur of betaling"
          href="/admin/orders"
          tone={openOrders > 0 ? "warning" : "default"}
        />
        <StatCard
          icon={Building2}
          label="Wacht op goedkeuring"
          value={pendingCount.toLocaleString("nl-NL")}
          hint="Nieuwe bedrijfsaccounts"
          href="/admin/companies"
          tone={pendingCount > 0 ? "warning" : "default"}
        />
        <StatCard
          icon={Euro}
          label="Omzet (betaald)"
          value={formatPriceCents(revenueCents)}
          hint="Betaalde en afgeronde bestellingen"
        />
      </div>

      {hasActions && (
        <div className="mt-6 rounded-xl border border-amber-500/30 bg-amber-500/5 p-5">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <TriangleAlert className="h-4 w-4 text-amber-500" />
            Actie vereist
          </h2>
          <ul className="mt-3 space-y-2 text-sm">
            {pendingCount > 0 && (
              <li>
                <Link href="/admin/companies" className="group flex items-center gap-2">
                  <span className="text-muted-foreground">
                    {pendingCount} bedrijf{pendingCount === 1 ? "" : "saccounts"} wacht
                    {pendingCount === 1 ? "" : "en"} op beoordeling
                  </span>
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                </Link>
              </li>
            )}
            {awaitingInvoice > 0 && (
              <li>
                <Link href="/admin/orders" className="group flex items-center gap-2">
                  <span className="text-muted-foreground">
                    {awaitingInvoice} bestelling{awaitingInvoice === 1 ? "" : "en"} wacht
                    {awaitingInvoice === 1 ? "" : "en"} op een factuur
                  </span>
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                </Link>
              </li>
            )}
            {failingSuppliers > 0 && (
              <li>
                <Link href="/admin/suppliers" className="group flex items-center gap-2">
                  <span className="text-muted-foreground">
                    {failingSuppliers} leverancier{failingSuppliers === 1 ? "" : "s"} met een
                    synchronisatiefout
                  </span>
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                </Link>
              </li>
            )}
          </ul>
        </div>
      )}

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_340px]">
        <section className="min-w-0">
          <div className="flex items-center justify-between gap-4">
            <h2 className="font-semibold tracking-tight">Recente bestellingen</h2>
            <Button asChild variant="ghost" size="sm">
              <Link href="/admin/orders">
                Alle bestellingen
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>

          {recentOrders.length === 0 ? (
            <div className="mt-3 flex flex-col items-center gap-3 rounded-xl border border-dashed border-border py-14 text-center">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-muted">
                <ClipboardList className="h-5 w-5 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">Nog geen bestellingen geplaatst.</p>
            </div>
          ) : (
            <div className="mt-3 overflow-hidden rounded-xl border border-border">
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
                  {recentOrders.map((o) => (
                    <TableRow key={o.id}>
                      <TableCell className="font-medium">
                        <Link href={`/admin/orders/${o.id}`} className="hover:underline">
                          {o.company.name}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            o.status === "paid" || o.status === "fulfilled" ? "default" : "secondary"
                          }
                        >
                          {statusLabels[o.status] ?? o.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(o.createdAt)}
                      </TableCell>
                      <TableCell className="text-right font-medium tabular-nums">
                        {formatPriceCents(o.totalCents, o.currency)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {pendingCompanies.length > 0 && (
            <div className="mt-8">
              <div className="flex items-center justify-between gap-4">
                <h2 className="font-semibold tracking-tight">Wacht op goedkeuring</h2>
                <Button asChild variant="ghost" size="sm">
                  <Link href="/admin/companies">
                    Beheer accounts
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
              <div className="mt-3 overflow-hidden rounded-xl border border-border">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40 hover:bg-muted/40">
                      <TableHead>Bedrijf</TableHead>
                      <TableHead>KVK</TableHead>
                      <TableHead>Aangemeld</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingCompanies.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium">{c.name}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {c.kvkNumber || "—"}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDate(c.createdAt)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </section>

        <aside>
          <div className="flex items-center justify-between gap-4">
            <h2 className="font-semibold tracking-tight">Leveranciers</h2>
            <Button asChild variant="ghost" size="sm">
              <Link href="/admin/suppliers">Beheer</Link>
            </Button>
          </div>

          {suppliers.length === 0 ? (
            <div className="mt-3 flex flex-col items-center gap-3 rounded-xl border border-dashed border-border py-12 text-center">
              <Plug className="h-6 w-6 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Nog geen koppelingen.</p>
            </div>
          ) : (
            <ul className="mt-3 space-y-2">
              {suppliers.map((s) => (
                <li key={s.id} className="rounded-xl border border-border bg-card p-4">
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-medium">{s.name}</span>
                    {s.lastSyncError ? (
                      <CircleAlert className="h-4 w-4 shrink-0 text-destructive" />
                    ) : s.active ? (
                      <CircleCheck className="h-4 w-4 shrink-0 text-emerald-500" />
                    ) : (
                      <span className="h-2 w-2 shrink-0 rounded-full bg-muted-foreground" />
                    )}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {s.lastSyncedAt
                      ? `Laatste sync ${formatDate(s.lastSyncedAt)}`
                      : "Nog niet gesynchroniseerd"}
                  </p>
                  {s.lastSyncError && (
                    <p className="mt-1.5 line-clamp-2 text-xs text-destructive" title={s.lastSyncError}>
                      {s.lastSyncError}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </aside>
      </div>
    </div>
  );
}
