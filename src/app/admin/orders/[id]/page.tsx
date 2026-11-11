import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { orders } from "@/db/schema";
import { formatDate, formatPriceCents } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { InvoiceForm, OrderStatusActions, ShipOrderForm } from "@/components/admin/order-actions";
import { carrierName } from "@/lib/shipping-carriers";
import { countryName, isEuCountry, SELLER_COUNTRY, vatTreatmentFor } from "@/lib/vat";
import { ArrowLeft, Building2, ExternalLink, FileText, Receipt, Truck } from "lucide-react";

const statusLabels: Record<string, string> = {
  placed: "Wacht op factuur",
  invoiced: "Factuur verstuurd",
  paid: "Betaald",
  fulfilled: "Verzonden",
  cancelled: "Geannuleerd",
};

const companyStatusLabels: Record<string, string> = {
  approved: "Goedgekeurd",
  pending: "In beoordeling",
  suspended: "Opgeschort",
};

/** Which VAT the invoice will get, so there are no surprises when it is issued. */
function vatPreview(c: {
  country: string;
  vatNumber: string | null;
  vatStatus: string;
  addressLine: string | null;
}): { text: string; warning: boolean } {
  if (!c.addressLine) {
    return { text: "Adres van dit bedrijf ontbreekt — vul het eerst in bij Zakelijke accounts.", warning: true };
  }
  if (!isEuCountry(c.country) || c.country === SELLER_COUNTRY) {
    return { text: "Normaal btw-tarief (klant in Nederland).", warning: false };
  }
  if (vatTreatmentFor(c) === "reverse_charge") {
    return { text: `Btw verlegd (0%) — ${countryName(c.country)}, btw-nummer geldig in VIES.`, warning: false };
  }
  return c.vatNumber
    ? { text: `Klant in ${countryName(c.country)}; btw-nummer wordt bij het aanmaken in VIES gecontroleerd. Geldig → 0% verlegd, anders normaal tarief.`, warning: false }
    : { text: `Klant in ${countryName(c.country)} zonder btw-nummer: normaal btw-tarief.`, warning: true };
}

export default async function AdminOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const db = getDb();
  const order = await db.query.orders.findFirst({
    where: eq(orders.id, id),
    with: {
      items: { with: { supplier: { columns: { name: true, baseUrl: true } } } },
      company: true,
    },
  });

  if (!order) notFound();

  const bySupplier = new Map<
    string,
    { name: string; baseUrl: string | null; items: typeof order.items }
  >();
  for (const item of order.items) {
    const key = item.supplierId ?? "none";
    const entry = bySupplier.get(key) ?? {
      name: item.supplier?.name ?? "Eigen voorraad",
      baseUrl: item.supplier?.baseUrl ?? null,
      items: [],
    };
    entry.items.push(item);
    bySupplier.set(key, entry);
  }

  const itemCount = order.items.reduce((sum, i) => sum + i.quantity, 0);

  return (
    <div>
      <Button asChild variant="ghost" size="sm" className="-ml-2 mb-4">
        <Link href="/admin/orders">
          <ArrowLeft className="h-4 w-4" />
          Terug naar bestellingen
        </Link>
      </Button>

      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-5">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-xl font-semibold tracking-tight">{order.company.name}</h2>
            <Badge
              variant={
                order.status === "paid" || order.status === "fulfilled" ? "default" : "secondary"
              }
            >
              {statusLabels[order.status] ?? order.status}
            </Badge>
          </div>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {formatDate(order.createdAt)} · {order.items.length} regel
            {order.items.length === 1 ? "" : "s"} · {itemCount.toLocaleString("nl-NL")} artikel
            {itemCount === 1 ? "" : "en"}
          </p>
        </div>
        <OrderStatusActions orderId={order.id} status={order.status} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="min-w-0 space-y-6">
          <section className="overflow-hidden rounded-xl border border-border">
            <header className="flex items-center gap-2 border-b border-border bg-muted/40 px-5 py-3">
              <Receipt className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold">Producten</h3>
            </header>
            <div className="divide-y divide-border">
              {order.items.map((item) => (
                <div key={item.id} className="flex items-start justify-between gap-4 px-5 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{item.nameSnapshot}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {formatPriceCents(item.unitPriceCents, order.currency)} × {item.quantity}
                      {item.supplier?.name && ` · ${item.supplier.name}`}
                    </p>
                  </div>
                  <span className="shrink-0 text-sm font-medium tabular-nums">
                    {formatPriceCents(item.unitPriceCents * item.quantity, order.currency)}
                  </span>
                </div>
              ))}
            </div>
            <div className="space-y-2 border-t border-border bg-muted/20 px-5 py-4 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotaal</span>
                <span className="tabular-nums">
                  {formatPriceCents(order.subtotalCents, order.currency)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Verzendkosten</span>
                <span className="tabular-nums">
                  {order.shippingCents != null
                    ? formatPriceCents(order.shippingCents, order.currency)
                    : "Nog te bepalen"}
                </span>
              </div>
              {order.vatCents != null && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    Btw {order.vatRatePercent}%
                  </span>
                  <span className="tabular-nums">
                    {formatPriceCents(order.vatCents, order.currency)}
                  </span>
                </div>
              )}
              <div className="flex justify-between border-t border-border pt-2 text-base font-semibold">
                <span>Totaal{order.vatCents != null ? " incl. btw" : ""}</span>
                <span className="tabular-nums">
                  {formatPriceCents(order.totalCents, order.currency)}
                </span>
              </div>
            </div>
          </section>

          <section className="overflow-hidden rounded-xl border border-border">
            <header className="border-b border-border bg-muted/40 px-5 py-3">
              <h3 className="flex items-center gap-2 text-sm font-semibold">
                <Truck className="h-4 w-4 text-muted-foreground" />
                Inkoop bij leveranciers
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Alleen zichtbaar voor beheerders — de klant ziet dit nergens. Gebruik
                dit om te bepalen waar je deze bestelling moet inkopen.
              </p>
            </header>
            <div className="divide-y divide-border">
              {[...bySupplier.values()].map((group) => (
                <div key={group.name} className="px-5 py-4">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-medium">{group.name}</span>
                    {group.baseUrl && (
                      <a
                        href={group.baseUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1 text-xs text-primary hover:underline"
                      >
                        Naar leverancier
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                  <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                    {group.items.map((item) => (
                      <li key={item.id} className="flex justify-between gap-4">
                        <span className="min-w-0">{item.nameSnapshot}</span>
                        <span className="shrink-0 tabular-nums">× {item.quantity}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>
        </div>

        <aside className="space-y-6">
          <section className="rounded-xl border border-border p-5">
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              Klant
            </h3>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Bedrijf</dt>
                <dd className="text-right font-medium">{order.company.name}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">KVK</dt>
                <dd className="text-right">{order.company.kvkNumber || "—"}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Btw-nummer</dt>
                <dd className="text-right">{order.company.vatNumber || "—"}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Status</dt>
                <dd className="text-right">
                  {companyStatusLabels[order.company.status] ?? order.company.status}
                </dd>
              </div>
            </dl>
          </section>

          {order.status === "placed" ? (
            <InvoiceForm
              orderId={order.id}
              freeShipping={order.shippingCents === 0}
              vatPreview={vatPreview(order.company)}
            />
          ) : (
            <section className="rounded-xl border border-border p-5">
              <h3 className="flex items-center gap-2 text-sm font-semibold">
                <FileText className="h-4 w-4 text-muted-foreground" />
                Factuur
              </h3>
              <dl className="mt-3 space-y-2 text-sm">
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Nummer</dt>
                  <dd className="text-right font-medium">{order.invoiceNumber || "—"}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Aangemaakt</dt>
                  <dd className="text-right">
                    {order.invoicedAt ? formatDate(order.invoicedAt) : "—"}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Betaald</dt>
                  <dd className="text-right">{order.paidAt ? formatDate(order.paidAt) : "—"}</dd>
                </div>
              </dl>
              {order.invoiceNotes && (
                <p className="mt-3 border-t border-border pt-3 text-xs text-muted-foreground">
                  {order.invoiceNotes}
                </p>
              )}
              {order.invoiceNumber && (
                <Button asChild variant="outline" className="mt-4 w-full">
                  <Link href={`/invoices/${order.id}`}>
                    <FileText className="h-4 w-4" />
                    Factuur bekijken
                  </Link>
                </Button>
              )}
            </section>
          )}

          {(order.status === "invoiced" || order.status === "paid") && (
            <ShipOrderForm orderId={order.id} />
          )}

          {order.status === "fulfilled" && (
            <section className="rounded-xl border border-border p-5">
              <h3 className="flex items-center gap-2 text-sm font-semibold">
                <Truck className="h-4 w-4 text-muted-foreground" />
                Verzonden
              </h3>
              <dl className="mt-3 space-y-2 text-sm">
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Datum</dt>
                  <dd className="text-right">{order.shippedAt ? formatDate(order.shippedAt) : "—"}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Vervoerder</dt>
                  <dd className="text-right">{carrierName(order.carrier) ?? "—"}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Trackingcode</dt>
                  <dd className="text-right font-mono text-xs">{order.trackingCode ?? "—"}</dd>
                </div>
              </dl>
              {order.trackingUrl && (
                <Button asChild variant="outline" className="mt-4 w-full">
                  <a href={order.trackingUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4" />
                    Zending volgen
                  </a>
                </Button>
              )}
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}
