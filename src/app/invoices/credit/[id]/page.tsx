import { notFound, redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { creditNotes } from "@/db/schema";
import { getAppUserWithCompany } from "@/lib/auth";
import { getCompanyDetails, sellerForInvoice } from "@/lib/invoicing";
import { formatDateOnly, formatPriceCents } from "@/lib/format";
import { countryName } from "@/lib/vat";
import { PrintButton } from "@/components/print-button";
import { SiteLogo } from "@/components/site-logo";

export const dynamic = "force-dynamic";

type BuyerSnapshot = {
  name: string;
  addressLine: string | null;
  postalCode: string | null;
  city: string | null;
  country: string | null;
  kvkNumber: string | null;
  vatNumber: string | null;
};

/** A credit note: same letterhead and parties as the invoice it corrects, amounts negative. */
export default async function CreditNotePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getAppUserWithCompany();
  if (!user) redirect("/sign-in");

  const [note, currentDetails] = await Promise.all([
    getDb().query.creditNotes.findFirst({
      where: eq(creditNotes.id, id),
      with: { order: { with: { company: true } } },
    }),
    getCompanyDetails(),
  ]);
  if (!note) notFound();
  const { order } = note;

  const isAdmin = user.role === "platform_admin";
  if (!isAdmin && order.companyId !== user.company?.id) notFound();

  const seller = sellerForInvoice(order.sellerSnapshot, currentDetails);
  const buyer = (order.buyerSnapshot as BuyerSnapshot | null) ?? order.company;
  const reverseCharge = order.vatTreatment === "reverse_charge";
  const neg = (cents: number) => formatPriceCents(-cents, order.currency);

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
              {seller.legalName && <div className="mt-3 text-sm font-semibold tracking-tight">{seller.legalName}</div>}
              <address className="mt-2 text-sm not-italic leading-relaxed text-zinc-600">
                {seller.addressLine && <div>{seller.addressLine}</div>}
                {(seller.postalCode || seller.city) && (
                  <div>
                    {seller.postalCode} {seller.city}
                  </div>
                )}
                {seller.country && <div>{seller.country}</div>}
                {seller.email && <div className="mt-2">{seller.email}</div>}
              </address>
            </div>
            <div className="text-right">
              <h1 className="text-2xl font-semibold tracking-tight">Creditnota</h1>
              <dl className="mt-4 space-y-1 text-sm">
                <div className="flex justify-end gap-3">
                  <dt className="text-zinc-500">Creditnotanummer</dt>
                  <dd className="font-medium tabular-nums">{note.number}</dd>
                </div>
                <div className="flex justify-end gap-3">
                  <dt className="text-zinc-500">Datum</dt>
                  <dd className="tabular-nums">{formatDateOnly(note.createdAt)}</dd>
                </div>
                <div className="flex justify-end gap-3">
                  <dt className="text-zinc-500">Betreft factuur</dt>
                  <dd className="tabular-nums">{order.invoiceNumber}</dd>
                </div>
              </dl>
            </div>
          </header>

          <section className="py-8">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Klant</h2>
            <address className="mt-3 text-sm not-italic leading-relaxed">
              <div className="font-medium">{buyer.name}</div>
              {buyer.addressLine && <div>{buyer.addressLine}</div>}
              {(buyer.postalCode || buyer.city) && (
                <div>
                  {buyer.postalCode} {buyer.city}
                </div>
              )}
              {buyer.country && <div>{countryName(buyer.country)}</div>}
              {buyer.vatNumber && <div className="mt-2 text-zinc-600">Btw-nr.: {buyer.vatNumber}</div>}
            </address>
          </section>

          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-y border-zinc-200 text-left">
                <th className="py-2.5 font-semibold">Omschrijving</th>
                <th className="py-2.5 text-right font-semibold">Bedrag</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-zinc-100 align-top">
                <td className="py-2.5 pr-4">
                  Creditering op factuur {order.invoiceNumber}
                  <div className="text-zinc-600">{note.reason}</div>
                </td>
                <td className="py-2.5 text-right tabular-nums">{neg(note.netCents)}</td>
              </tr>
            </tbody>
          </table>

          <section className="mt-6 flex justify-end">
            <dl className="w-full max-w-xs space-y-2 text-sm">
              <div className="flex justify-between gap-6">
                <dt className="text-zinc-600">Totaal excl. btw</dt>
                <dd className="tabular-nums">{neg(note.netCents)}</dd>
              </div>
              <div className="flex justify-between gap-6">
                <dt className="text-zinc-600">{reverseCharge ? "Btw verlegd (0%)" : `Btw ${note.vatRatePercent}%`}</dt>
                <dd className="tabular-nums">{neg(note.vatCents)}</dd>
              </div>
              <div className="flex justify-between gap-6 border-t-2 border-zinc-900 pt-2 text-base font-semibold">
                <dt>Totaal gecrediteerd</dt>
                <dd className="tabular-nums">{neg(note.totalCents)}</dd>
              </div>
            </dl>
          </section>

          {reverseCharge && (
            <p className="mt-6 rounded-lg border border-zinc-200 p-4 text-sm leading-relaxed">
              <span className="font-semibold">Btw verlegd</span> — intracommunautaire levering, art. 138 Richtlijn
              2006/112/EG.
            </p>
          )}

          <p className="mt-10 rounded-lg bg-zinc-50 p-5 text-sm text-zinc-600 print:border print:border-zinc-200">
            Dit bedrag wordt met u verrekend of teruggestort op uw rekening.
          </p>

          <footer className="mt-10 flex flex-wrap justify-center gap-x-4 gap-y-1 border-t border-zinc-200 pt-4 text-xs text-zinc-500">
            {seller.legalName && <span>{seller.legalName}</span>}
            {seller.kvkNumber && <span>KVK {seller.kvkNumber}</span>}
            {seller.vatNumber && <span>Btw-nr. {seller.vatNumber}</span>}
            {seller.iban && <span>IBAN {seller.iban}</span>}
          </footer>
        </article>
      </div>
    </div>
  );
}
