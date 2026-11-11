import { notFound, redirect } from "next/navigation";
import { getAppUserWithCompany } from "@/lib/auth";
import {
  getCompanyDetails,
  getOrderForInvoice,
  invoiceDueDate,
  paymentReference,
  sellerForInvoice,
} from "@/lib/invoicing";
import { formatDateOnly, formatPriceCents } from "@/lib/format";
import { PrintButton } from "@/components/print-button";
import { SiteLogo } from "@/components/site-logo";
import { countryName } from "@/lib/vat";
import type { DeliverySnapshot } from "@/lib/delivery";

type BuyerSnapshot = {
  name: string;
  addressLine: string | null;
  postalCode: string | null;
  city: string | null;
  country: string | null;
  kvkNumber: string | null;
  vatNumber: string | null;
  billingEmail: string | null;
};

export const dynamic = "force-dynamic";

export default async function InvoicePage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;
  const user = await getAppUserWithCompany();
  if (!user) redirect("/sign-in");

  const [order, currentDetails] = await Promise.all([
    getOrderForInvoice(orderId),
    getCompanyDetails(),
  ]);
  if (!order) notFound();

  const seller = sellerForInvoice(order.sellerSnapshot, currentDetails);

  // An invoice is readable by the company it belongs to, and by staff.
  const isAdmin = user.role === "platform_admin";
  if (!isAdmin && order.companyId !== user.company?.id) notFound();
  if (!order.invoiceNumber || !order.invoicedAt) notFound();

  const vatRate = order.vatRatePercent ?? 0;
  const vatCents = order.vatCents ?? 0;
  const shippingCents = order.shippingCents ?? 0;
  const netCents = order.subtotalCents + shippingCents;
  const dueDate = invoiceDueDate(order.invoicedAt, seller.paymentTermDays);
  // The buyer as it was when invoiced; invoices from before snapshots use the live record.
  const buyer = (order.buyerSnapshot as BuyerSnapshot | null) ?? order.company;
  const reverseCharge = order.vatTreatment === "reverse_charge";
  // Only printed when it differs from the billing address.
  const delivery = order.deliveryAddress as DeliverySnapshot | null;

  return (
    <div className="min-h-screen bg-muted/40 py-8 print:bg-white print:py-0">
      <div className="mx-auto max-w-[210mm] px-4 print:px-0">
        <div className="mb-4 flex items-center justify-between gap-4 print:hidden">
          <a
            href={isAdmin ? `/admin/orders/${order.id}` : `/dashboard/orders/${order.id}`}
            className="text-sm text-muted-foreground underline-offset-2 hover:underline"
          >
            &larr; Terug naar bestelling
          </a>
          <PrintButton />
        </div>

        <article className="rounded-xl border border-border bg-white p-10 text-zinc-900 shadow-sm print:rounded-none print:border-0 print:p-0 print:shadow-none">
          <header className="flex flex-wrap items-start justify-between gap-6 border-b border-zinc-200 pb-8">
            <div>
              <SiteLogo height={44} />
              {seller.legalName && (
                <div className="mt-3 text-sm font-semibold tracking-tight">
                  {seller.legalName}
                </div>
              )}
              <address className="mt-2 text-sm not-italic leading-relaxed text-zinc-600">
                {seller.addressLine && <div>{seller.addressLine}</div>}
                {(seller.postalCode || seller.city) && (
                  <div>
                    {seller.postalCode} {seller.city}
                  </div>
                )}
                {seller.country && <div>{seller.country}</div>}
                {seller.email && <div className="mt-2">{seller.email}</div>}
                {seller.phone && <div>{seller.phone}</div>}
              </address>
            </div>

            <div className="text-right">
              <h1 className="text-2xl font-semibold tracking-tight">Factuur</h1>
              <dl className="mt-4 space-y-1 text-sm">
                <div className="flex justify-end gap-3">
                  <dt className="text-zinc-500">Factuurnummer</dt>
                  <dd className="font-medium tabular-nums">{order.invoiceNumber}</dd>
                </div>
                <div className="flex justify-end gap-3">
                  <dt className="text-zinc-500">Factuurdatum</dt>
                  <dd className="tabular-nums">{formatDateOnly(order.invoicedAt)}</dd>
                </div>
                <div className="flex justify-end gap-3">
                  <dt className="text-zinc-500">Vervaldatum</dt>
                  <dd className="tabular-nums">{formatDateOnly(dueDate)}</dd>
                </div>
                <div className="flex justify-end gap-3">
                  <dt className="text-zinc-500">Besteldatum</dt>
                  <dd className="tabular-nums">{formatDateOnly(order.createdAt)}</dd>
                </div>
              </dl>
            </div>
          </header>

          {/* Only the buyer here: the seller is the letterhead above and the
              fiscal identifiers sit in the footer, so neither party is
              repeated halfway down the page. */}
          <section className="grid gap-8 py-8 sm:grid-cols-2">
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                Factuuradres
              </h2>
              <address className="mt-3 text-sm not-italic leading-relaxed">
                <div className="font-medium">{buyer.name}</div>
                {buyer.addressLine && <div>{buyer.addressLine}</div>}
                {(buyer.postalCode || buyer.city) && (
                  <div>
                    {buyer.postalCode} {buyer.city}
                  </div>
                )}
                {buyer.country && <div>{countryName(buyer.country)}</div>}
                {buyer.billingEmail && <div className="mt-2 text-zinc-600">{buyer.billingEmail}</div>}
                {buyer.kvkNumber && <div className="text-zinc-600">KVK: {buyer.kvkNumber}</div>}
                {buyer.vatNumber && <div className="text-zinc-600">Btw-nr.: {buyer.vatNumber}</div>}
              </address>
            </div>
            {delivery && (
              <div>
                <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  Afleveradres
                </h2>
                <address className="mt-3 text-sm not-italic leading-relaxed">
                  <div className="font-medium">{delivery.label}</div>
                  {delivery.recipient && <div>t.a.v. {delivery.recipient}</div>}
                  <div>{delivery.addressLine}</div>
                  <div>
                    {delivery.postalCode} {delivery.city}
                  </div>
                  <div>{countryName(delivery.country)}</div>
                </address>
              </div>
            )}
          </section>

          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-y border-zinc-200 text-left">
                <th className="py-2.5 font-semibold">Omschrijving</th>
                <th className="py-2.5 text-right font-semibold">Aantal</th>
                <th className="py-2.5 text-right font-semibold">Stukprijs</th>
                <th className="py-2.5 text-right font-semibold">Bedrag</th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((item) => (
                <tr key={item.id} className="border-b border-zinc-100 align-top">
                  <td className="py-2.5 pr-4">{item.nameSnapshot}</td>
                  <td className="py-2.5 text-right tabular-nums">{item.quantity}</td>
                  <td className="py-2.5 text-right tabular-nums">
                    {formatPriceCents(item.unitPriceCents, order.currency)}
                  </td>
                  <td className="py-2.5 text-right tabular-nums">
                    {formatPriceCents(item.unitPriceCents * item.quantity, order.currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <section className="mt-6 flex justify-end">
            <dl className="w-full max-w-xs space-y-2 text-sm">
              <div className="flex justify-between gap-6">
                <dt className="text-zinc-600">Subtotaal producten</dt>
                <dd className="tabular-nums">
                  {formatPriceCents(order.subtotalCents, order.currency)}
                </dd>
              </div>
              <div className="flex justify-between gap-6">
                <dt className="text-zinc-600">Verzendkosten</dt>
                <dd className="tabular-nums">
                  {formatPriceCents(shippingCents, order.currency)}
                </dd>
              </div>
              <div className="flex justify-between gap-6 border-t border-zinc-200 pt-2">
                <dt className="text-zinc-600">Totaal excl. btw</dt>
                <dd className="tabular-nums">{formatPriceCents(netCents, order.currency)}</dd>
              </div>
              <div className="flex justify-between gap-6">
                <dt className="text-zinc-600">{reverseCharge ? "Btw verlegd (0%)" : `Btw ${vatRate}%`}</dt>
                <dd className="tabular-nums">{formatPriceCents(vatCents, order.currency)}</dd>
              </div>
              <div className="flex justify-between gap-6 border-t-2 border-zinc-900 pt-2 text-base font-semibold">
                <dt>Totaal te betalen</dt>
                <dd className="tabular-nums">
                  {formatPriceCents(order.totalCents, order.currency)}
                </dd>
              </div>
            </dl>
          </section>

          {reverseCharge && (
            <p className="mt-6 rounded-lg border border-zinc-200 p-4 text-sm leading-relaxed">
              <span className="font-semibold">Btw verlegd</span> — intracommunautaire levering, art. 138
              Richtlijn 2006/112/EG. De btw wordt verlegd naar de afnemer ({buyer.vatNumber}).
              <br />
              <span className="text-zinc-600">
                VAT reverse charge — intra-Community supply of goods, Art. 138 Directive 2006/112/EC.
              </span>
            </p>
          )}

          <section className="mt-10 rounded-lg bg-zinc-50 p-5 text-sm print:border print:border-zinc-200">
            <h2 className="font-semibold">Betaalgegevens</h2>
            <p className="mt-2 leading-relaxed text-zinc-600">
              Maak {formatPriceCents(order.totalCents, order.currency)} over vóór{" "}
              {formatDateOnly(dueDate)} op{" "}
              <span className="font-medium text-zinc-900">{seller.iban}</span>
              {seller.bic && ` (BIC ${seller.bic})`} ten name van{" "}
              <span className="font-medium text-zinc-900">{seller.legalName}</span>, onder
              vermelding van{" "}
              <span className="font-medium text-zinc-900">
                {paymentReference(order.invoiceNumber)}
              </span>
              .
            </p>
            {order.invoiceNotes && (
              <p className="mt-3 border-t border-zinc-200 pt-3 leading-relaxed text-zinc-600">
                {order.invoiceNotes}
              </p>
            )}
          </section>

          {order.paidAt && (
            <p className="mt-6 text-sm font-medium text-emerald-700">
              Betaald op {formatDateOnly(order.paidAt)} — dank u wel.
            </p>
          )}

          {/* Legal identifiers belong on the invoice but not competing with
              the addresses — the usual place is a footer strip. */}
          <footer className="mt-10 flex flex-wrap justify-center gap-x-4 gap-y-1 border-t border-zinc-200 pt-4 text-xs text-zinc-500">
            {seller.legalName && <span>{seller.legalName}</span>}
            {seller.kvkNumber && <span>KVK {seller.kvkNumber}</span>}
            {seller.vatNumber && <span>Btw-nr. {seller.vatNumber}</span>}
          </footer>
        </article>
      </div>
    </div>
  );
}
