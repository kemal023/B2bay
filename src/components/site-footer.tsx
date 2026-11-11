import Link from "next/link";
import { FileText, Mail, ShieldCheck, Truck } from "lucide-react";
import { SiteLogo } from "@/components/site-logo";
import { getDictionary } from "@/lib/i18n/server";
import { fmt } from "@/lib/i18n/dictionaries";
import { getCompanyDetails } from "@/lib/invoicing";
import { FALLBACK_EMAIL, SHOP_NAME } from "@/lib/brand";

const TRUST_ICONS = [ShieldCheck, Truck, FileText, Mail];

export async function SiteFooter() {
  const [{ t }, seller] = await Promise.all([getDictionary(), getCompanyDetails()]);
  const f = t.footer;
  const email = seller.email || FALLBACK_EMAIL;
  return (
    <footer className="mt-auto border-t border-border bg-muted/30">
      <div className="mx-auto grid max-w-7xl gap-6 border-b border-border px-4 py-8 sm:grid-cols-2 sm:px-6 lg:grid-cols-4">
        {f.trust.map(({ title, body }, i) => {
          const Icon = TRUST_ICONS[i];
          return (
          <div key={title} className="flex items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
              <Icon className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <div className="text-sm font-medium">{title}</div>
              <div className="truncate text-xs text-muted-foreground">{fmt(body, { email })}</div>
            </div>
          </div>
          );
        })}
      </div>

      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-2 lg:grid-cols-4">
        <div className="max-w-xs">
          <SiteLogo height={34} className="dark:rounded-md dark:bg-white dark:px-2 dark:py-1" />
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            {f.tagline}
          </p>
        </div>

        <div>
          <h3 className="text-sm font-semibold">{f.catalogue}</h3>
          <ul className="mt-4 space-y-2.5 text-sm text-muted-foreground">
            <li>
              <Link href="/products" className="transition-colors hover:text-foreground">
                {t.common.allProducts}
              </Link>
            </li>
            <li>
              <Link href="/#assortiment" className="transition-colors hover:text-foreground">
                {f.ourRange}
              </Link>
            </li>
            <li>
              <Link href="/#hoe-werkt-het" className="transition-colors hover:text-foreground">
                {f.howItWorks}
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h3 className="text-sm font-semibold">{f.account}</h3>
          <ul className="mt-4 space-y-2.5 text-sm text-muted-foreground">
            <li>
              <Link href="/sign-up" className="transition-colors hover:text-foreground">
                {t.common.requestBusinessAccount}
              </Link>
            </li>
            <li>
              <Link href="/sign-in" className="transition-colors hover:text-foreground">
                {t.common.signIn}
              </Link>
            </li>
            <li>
              <Link href="/dashboard" className="transition-colors hover:text-foreground">
                {f.myOrders}
              </Link>
            </li>
            <li>
              <Link href="/cart" className="transition-colors hover:text-foreground">
                {t.common.cart}
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h3 className="text-sm font-semibold">{f.contact}</h3>
          <ul className="mt-4 space-y-2.5 text-sm text-muted-foreground">
            {seller.legalName && <li className="text-foreground">{seller.legalName}</li>}
            {seller.addressLine && (
              <li>
                {seller.addressLine}, {seller.postalCode} {seller.city}
              </li>
            )}
            <li>
              <a href={`mailto:${email}`} className="transition-colors hover:text-foreground">
                {email}
              </a>
            </li>
            {seller.phone && (
              <li>
                <a href={`tel:${seller.phone.replace(/s+/g, "")}`} className="transition-colors hover:text-foreground">
                  {seller.phone}
                </a>
              </li>
            )}
            <li>{seller.kvkNumber ? `KVK ${seller.kvkNumber}` : f.kvkOnRequest}</li>
            <li>{seller.vatNumber ? `${f.vat} ${seller.vatNumber}` : f.vatOnRequest}</li>
          </ul>
        </div>
      </div>

      <div className="border-t border-border">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-4 py-5 text-xs text-muted-foreground sm:px-6">
          <span className="flex flex-wrap gap-x-4 gap-y-1">
            <span>© {new Date().getFullYear()} {seller.legalName || SHOP_NAME}. {f.rights}</span>
            <Link href="/terms" className="hover:text-foreground">{t.legal.terms}</Link>
            <Link href="/privacy" className="hover:text-foreground">{t.legal.privacy}</Link>
          </span>
          <span>{f.pricesNote}</span>
        </div>
      </div>
    </footer>
  );
}
