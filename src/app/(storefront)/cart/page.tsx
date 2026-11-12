import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CartItemRow } from "@/components/cart-item-row";
import { PlaceOrderButton } from "@/components/place-order-button";
import { getCartWithTotals } from "@/lib/actions/cart";
import { getAppUserWithCompany } from "@/lib/auth";
import { formatPriceCents } from "@/lib/format";
import { ArrowRight, FileCheck2, ShoppingCart, TriangleAlert, Truck } from "lucide-react";
import { getDictionary } from "@/lib/i18n/server";
import { intlLocale } from "@/lib/i18n/config";
import { fmt, plural } from "@/lib/i18n/dictionaries";
import { getShippingSettings, qualifiesForFreeShipping } from "@/lib/shipping";
import { vatTreatmentFor } from "@/lib/vat";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { deliveryAddresses } from "@/db/schema";

export default async function CartPage() {
  const [{ items, subtotalCents }, user, { locale, t }, shipping] = await Promise.all([
    getCartWithTotals(),
    getAppUserWithCompany(),
    getDictionary(),
    getShippingSettings(),
  ]);
  const threshold = shipping.freeShippingThresholdCents;
  const freeShipping = qualifiesForFreeShipping(subtotalCents, shipping);
  const addresses = user?.company
    ? (
        await getDb().query.deliveryAddresses.findMany({
          where: eq(deliveryAddresses.companyId, user.company.id),
          orderBy: (d, { asc }) => asc(d.label),
        })
      ).map((a) => ({ id: a.id, label: `${a.label} — ${a.city}` }))
    : [];
  const reverseCharge = user?.company ? vatTreatmentFor(user.company) === "reverse_charge" : false;
  const c = t.cart;

  const companyApproved = user?.company?.status === "approved";
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:py-10">
      <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Link href="/" className="transition-colors hover:text-foreground">
          {t.common.home}
        </Link>
        <span className="text-border">/</span>
        <span className="text-foreground">{c.title}</span>
      </nav>

      <div className="mt-4">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{c.title}</h1>
        {items.length > 0 && (
          <p className="mt-1.5 text-sm text-muted-foreground">
            {plural(items.length, c.linesOne, c.linesOther)} ·{" "}
            {plural(itemCount, c.itemsOne, c.itemsOther, {
              count: itemCount.toLocaleString(intlLocale(locale)),
            })}
          </p>
        )}
      </div>

      {!user?.company ? (
        <Alert className="mt-6">
          <TriangleAlert className="h-4 w-4" />
          <AlertTitle>{c.noCompanyTitle}</AlertTitle>
          <AlertDescription>
            {c.noCompanyBody}{" "}
            <Link href="/onboarding" className="font-medium underline underline-offset-2">
              {c.toOnboarding}
            </Link>
          </AlertDescription>
        </Alert>
      ) : !companyApproved ? (
        <Alert className="mt-6">
          <TriangleAlert className="h-4 w-4" />
          <AlertTitle>{c.reviewTitle}</AlertTitle>
          <AlertDescription>{c.reviewBody}</AlertDescription>
        </Alert>
      ) : null}

      {items.length === 0 ? (
        <div className="mt-20 flex flex-col items-center gap-4 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
            <ShoppingCart className="h-7 w-7 text-muted-foreground" />
          </div>
          <div>
            <p className="font-medium">{c.emptyTitle}</p>
            <p className="mt-1 text-sm text-muted-foreground">{c.emptyBody}</p>
          </div>
          <Button asChild>
            <Link href="/products">
              {t.common.viewProducts}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      ) : (
        <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_360px]">
          <div className="space-y-3">
            {items.map((item) => (
              <CartItemRow
                key={item.id}
                // Only what the row shows: this is serialized into the page, and the full
                // product row would hand the browser cost prices and supplier details.
                item={{
                  id: item.id,
                  quantity: item.quantity,
                  unitPriceCents: item.unitPriceCents,
                  product: {
                    id: item.product.id,
                    name: item.product.name,
                    nameNl: item.product.nameNl,
                    nameDe: item.product.nameDe,
                    nameFr: item.product.nameFr,
                    hasImage: Boolean(item.product.imageUrl),
                    unit: item.product.unit,
                    priceCents: item.product.priceCents,
                    currency: item.product.currency,
                    minOrderQty: item.product.minOrderQty,
                  },
                }}
              />
            ))}
            <div className="pt-2">
              <Button asChild variant="outline" size="sm">
                <Link href="/products">{t.common.continueShopping}</Link>
              </Button>
            </div>
          </div>

          <div className="lg:sticky lg:top-[8.5rem] lg:h-fit">
            <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <h2 className="font-semibold tracking-tight">{c.summary}</h2>

              <dl className="mt-4 space-y-2.5 text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">{c.subtotal}</dt>
                  <dd className="font-medium tabular-nums">{formatPriceCents(subtotalCents)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">{c.shipping}</dt>
                  <dd
                    className={
                      freeShipping
                        ? "font-medium text-emerald-600 dark:text-emerald-400"
                        : "text-muted-foreground"
                    }
                  >
                    {freeShipping ? c.free : c.onInvoice}
                  </dd>
                </div>
              </dl>

              {threshold != null && (
                <div className="mt-4 rounded-lg bg-muted/60 p-3 text-xs">
                  <p className={freeShipping ? "font-medium text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}>
                    {freeShipping
                      ? fmt(c.freeShippingReached, { amount: formatPriceCents(threshold) })
                      : fmt(c.freeShippingRemaining, {
                          amount: formatPriceCents(threshold - subtotalCents),
                          threshold: formatPriceCents(threshold),
                        })}
                  </p>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-border">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${Math.min(100, (subtotalCents / threshold) * 100)}%` }}
                    />
                  </div>
                </div>
              )}

              <div className="mt-4 flex items-baseline justify-between border-t border-border pt-4">
                <span className="font-semibold">{c.total}</span>
                <span className="text-xl font-semibold tabular-nums">
                  {formatPriceCents(subtotalCents)}
                </span>
              </div>

              <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                {freeShipping ? null : c.shippingNote}
                {reverseCharge && <span className="mt-1 block">{c.vatReverseNote}</span>}
              </p>

              <div className="mt-5">
                {companyApproved ? (
                  <PlaceOrderButton
                    addresses={addresses}
                    billingLabel={user?.company?.city ?? null}
                  />
                ) : (
                  <Button className="w-full" size="lg" disabled>
                    {c.placeOrder}
                  </Button>
                )}
              </div>

              <ul className="mt-5 space-y-2.5 border-t border-border pt-4 text-xs text-muted-foreground">
                <li className="flex items-center gap-2">
                  <Truck className="h-4 w-4 shrink-0 text-primary" />
                  {t.product.usps[1]}
                </li>
                <li className="flex items-center gap-2">
                  <FileCheck2 className="h-4 w-4 shrink-0 text-primary" />
                  {t.product.usps[2]}
                </li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
