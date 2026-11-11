import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { orders } from "@/db/schema";
import { getAppUserWithCompany } from "@/lib/auth";
import { formatDate, formatPriceCents } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Clock, Download, FileText, Truck } from "lucide-react";
import { carrierName } from "@/lib/shipping-carriers";
import { getDictionary } from "@/lib/i18n/server";
import { fmt, plural } from "@/lib/i18n/dictionaries";
import { ReorderButton } from "@/components/bulk-cart-actions";

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getAppUserWithCompany();
  if (!user) redirect("/sign-in");
  if (!user.company) redirect("/onboarding");

  const { locale, t } = await getDictionary();
  const o = t.order;
  const db = getDb();
  const order = await db.query.orders.findFirst({
    where: eq(orders.id, id),
    with: { items: true },
  });

  if (!order || order.companyId !== user.company.id) notFound();

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:py-10">
      <Button asChild variant="ghost" size="sm" className="mb-4 -ml-2">
        <Link href="/dashboard">
          <ArrowLeft className="h-4 w-4" /> {o.back}
        </Link>
      </Button>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {fmt(o.title, { date: formatDate(order.createdAt, locale) })}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {plural(order.items.length, t.cart.linesOne, t.cart.linesOther)}
            {order.invoiceNumber && fmt(o.invoiceRef, { number: order.invoiceNumber })}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant={order.status === "paid" || order.status === "fulfilled" ? "default" : "secondary"}>
            {(o.statuses as Record<string, string>)[order.status] ?? order.status}
          </Badge>
          {user.company?.status === "approved" && <ReorderButton orderId={order.id} />}
        </div>
      </div>

      {order.status === "placed" && (
        <Alert className="mt-6">
          <Clock className="h-4 w-4" />
          <AlertTitle>{order.shippingCents === 0 ? o.awaitingFreeTitle : o.awaitingTitle}</AlertTitle>
          <AlertDescription>
            {order.shippingCents === 0 ? o.awaitingFreeBody : o.awaitingBody}
          </AlertDescription>
        </Alert>
      )}

      {order.status === "fulfilled" && (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-5">
          <div className="flex min-w-0 items-start gap-3">
            <Truck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <div className="min-w-0">
              <p className="font-medium">{o.shippedTitle}</p>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {order.shippedAt && fmt(o.shippedOn, { date: formatDate(order.shippedAt, locale) })}
                {order.carrier && ` ${fmt(o.via, { carrier: carrierName(order.carrier) ?? "" })}`}
                {order.trackingCode && (
                  <>
                    {" · "}
                    {o.trackingCode}: <span className="font-mono">{order.trackingCode}</span>
                  </>
                )}
              </p>
            </div>
          </div>
          {order.trackingUrl && (
            <Button asChild>
              <a href={order.trackingUrl} target="_blank" rel="noopener noreferrer">
                {o.track}
              </a>
            </Button>
          )}
        </div>
      )}

      {order.invoiceNumber && (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border bg-muted/30 p-5">
          <div className="min-w-0">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <FileText className="h-4 w-4" />
              {fmt(o.invoiceTitle, { number: order.invoiceNumber })}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {order.invoiceNotes || o.invoiceBody}
            </p>
          </div>
          <Button asChild>
            <Link href={`/invoices/${order.id}`}>
              {o.viewInvoice}
              <Download className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      )}

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">{o.products}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {order.items.map((item) => (
            <div key={item.id} className="flex items-start justify-between gap-4 text-sm">
              <span className="min-w-0">
                {item.nameSnapshot}{" "}
                <span className="text-muted-foreground">× {item.quantity}</span>
              </span>
              <span className="shrink-0 font-medium tabular-nums">
                {formatPriceCents(item.unitPriceCents * item.quantity, order.currency)}
              </span>
            </div>
          ))}

          <Separator className="my-2" />

          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{o.subtotal}</span>
            <span className="tabular-nums">
              {formatPriceCents(order.subtotalCents, order.currency)}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{o.shipping}</span>
            <span className="tabular-nums">
              {order.shippingCents === 0
                ? o.free
                : order.shippingCents != null
                  ? formatPriceCents(order.shippingCents, order.currency)
                  : o.toBeDetermined}
            </span>
          </div>
          {order.vatCents != null && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{order.vatTreatment === "reverse_charge"
                  ? o.vatReverseCharge
                  : fmt(o.vat, { rate: order.vatRatePercent ?? 0 })}</span>
              <span className="tabular-nums">
                {formatPriceCents(order.vatCents, order.currency)}
              </span>
            </div>
          )}
          <div className="flex items-center justify-between border-t border-border pt-3 text-base font-semibold">
            <span>{order.vatCents != null ? o.totalInclVat : o.total}</span>
            <span className="tabular-nums">
              {formatPriceCents(order.totalCents, order.currency)}
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
