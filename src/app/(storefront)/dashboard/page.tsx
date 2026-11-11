import { redirect } from "next/navigation";
import Link from "next/link";
import { eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { orders } from "@/db/schema";
import { getAppUserWithCompany } from "@/lib/auth";
import { formatDate, formatPriceCents } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  ArrowRight,
  CircleAlert,
  CircleCheck,
  Clock,
  Copy,
  Euro,
  Package,
  Receipt,
  ListPlus,
  MapPin,
} from "lucide-react";
import { getDictionary } from "@/lib/i18n/server";
import { intlLocale } from "@/lib/i18n/config";
import { fmt } from "@/lib/i18n/dictionaries";

export default async function DashboardPage() {
  const user = await getAppUserWithCompany();
  if (!user) redirect("/sign-in");
  if (!user.company) redirect("/onboarding");

  const { locale, t } = await getDictionary();
  const d = t.dashboard;
  const db = getDb();
  const companyId = user.company.id;

  const [companyOrders, statsRows] = await Promise.all([
    db.query.orders.findMany({
      where: eq(orders.companyId, companyId),
      orderBy: (o, { desc }) => desc(o.createdAt),
      limit: 25,
    }),
    db.execute<{ total_orders: number; open_orders: number; total_spent: number }>(sql`
      SELECT
        COUNT(*)::int AS total_orders,
        COUNT(*) FILTER (WHERE status IN ('placed', 'invoiced'))::int AS open_orders,
        COALESCE(SUM(total_cents) FILTER (WHERE status <> 'cancelled'), 0)::int AS total_spent
      FROM orders
      WHERE company_id = ${companyId}::uuid
    `),
  ]);

  const stats = statsRows.rows[0];
  const totalOrders = Number(stats?.total_orders ?? 0);
  const openOrders = Number(stats?.open_orders ?? 0);
  const totalSpent = Number(stats?.total_spent ?? 0);
  const approved = user.company.status === "approved";

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:py-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              {user.company.name}
            </h1>
            <Badge variant={approved ? "default" : "secondary"}>
              {approved ? (
                <>
                  <CircleCheck className="h-3 w-3" />
                  {d.verified}
                </>
              ) : (
                <>
                  <Clock className="h-3 w-3" />
                  {d.inReview}
                </>
              )}
            </Badge>
          </div>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {fmt(d.subtitle, { email: user.email })}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href="/dashboard/addresses">
              <MapPin className="h-4 w-4" />
              {t.addresses.title}
            </Link>
          </Button>
          {approved && (
            <Button asChild variant="outline">
              <Link href="/quick-order">
                <ListPlus className="h-4 w-4" />
                {t.quickOrder.title}
              </Link>
            </Button>
          )}
          <Button asChild>
            <Link href="/products">
              {t.common.continueShopping}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>

      {!approved && (
        <Alert className="mt-6">
          <Clock className="h-4 w-4" />
          <AlertTitle>{d.reviewTitle}</AlertTitle>
          <AlertDescription>{d.reviewBody}</AlertDescription>
        </Alert>
      )}

      <dl className="mt-8 grid gap-4 sm:grid-cols-3">
        {[
          { icon: Package, label: d.statOrders, value: totalOrders.toLocaleString(intlLocale(locale)) },
          { icon: Receipt, label: d.statOpen, value: openOrders.toLocaleString(intlLocale(locale)) },
          { icon: Euro, label: d.statTotal, value: formatPriceCents(totalSpent) },
        ].map(({ icon: Icon, label, value }) => (
          <div key={label} className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Icon className="h-4 w-4 text-primary" />
              <dt>{label}</dt>
            </div>
            <dd className="mt-2 text-2xl font-semibold tracking-tight tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>

      {user.role === "company_admin" && (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border bg-muted/30 p-5">
          <div>
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <Copy className="h-4 w-4" />
              {d.inviteTitle}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">{d.inviteBody}</p>
          </div>
          <code className="rounded-lg border border-border bg-background px-4 py-2.5 font-mono text-lg font-semibold tracking-widest">
            {user.company.joinCode}
          </code>
        </div>
      )}

      <div className="mt-10">
        <h2 className="text-lg font-semibold tracking-tight">{d.ordersTitle}</h2>

        {companyOrders.length === 0 ? (
          <div className="mt-4 flex flex-col items-center gap-4 rounded-xl border border-dashed border-border py-16 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <Package className="h-6 w-6 text-muted-foreground" />
            </div>
            <div>
              <p className="font-medium">{d.noOrdersTitle}</p>
              <p className="mt-1 text-sm text-muted-foreground">{d.noOrdersBody}</p>
            </div>
            <Button asChild variant="outline">
              <Link href="/products">{t.common.viewCatalogue}</Link>
            </Button>
          </div>
        ) : (
          <div className="mt-4 overflow-hidden rounded-xl border border-border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead>{d.date}</TableHead>
                  <TableHead>{d.status}</TableHead>
                  <TableHead className="text-right">{d.total}</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {companyOrders.map((order) => (
                  <TableRow key={order.id} className="group">
                    <TableCell>
                      <Link href={`/dashboard/orders/${order.id}`} className="block font-medium">
                        {formatDate(order.createdAt, locale)}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          order.status === "paid" || order.status === "fulfilled"
                            ? "default"
                            : "secondary"
                        }
                      >
                        {order.status === "paid" || order.status === "fulfilled" ? (
                          <CircleCheck className="h-3 w-3" />
                        ) : order.status === "cancelled" ? (
                          <CircleAlert className="h-3 w-3" />
                        ) : (
                          <Clock className="h-3 w-3" />
                        )}
                        {(d.statuses as Record<string, string>)[order.status] ?? order.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {formatPriceCents(order.totalCents, order.currency)}
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/dashboard/orders/${order.id}`}
                        className="text-muted-foreground transition-colors group-hover:text-primary"
                        aria-label={d.viewOrder}
                      >
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}
