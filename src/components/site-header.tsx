import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CartLink } from "@/components/cart-link";
import { UserMenu } from "@/components/user-menu";
import { MobileNav } from "@/components/mobile-nav";
import { SiteLogo } from "@/components/site-logo";
import { getAppUser } from "@/lib/auth";
import { listCategoryTree } from "@/lib/products";
import { getDictionary } from "@/lib/i18n/server";
import { mainLabel, subLabel } from "@/lib/taxonomy.mjs";
import type { NavCategory } from "@/components/mobile-nav";
import { LanguageSwitcher } from "@/components/language-switcher";
import { fmt } from "@/lib/i18n/dictionaries";
import { formatPriceCents } from "@/lib/format";
import { getShippingSettings } from "@/lib/shipping";
import { getCompanyDetails } from "@/lib/invoicing";
import { FALLBACK_EMAIL } from "@/lib/brand";
import {
  BadgeCheck,
  ChevronDown,
  LayoutDashboard,
  PackageCheck,
  Search,
  ShieldCheck,
  Truck,
} from "lucide-react";

// Main categories shown directly in the bar (the biggest); all of them are in the "Categories" menu.
const NAV_CATEGORY_COUNT = 5;

export async function SiteHeader() {
  const [user, categories, { locale, t }, shipping, seller] = await Promise.all([
    getAppUser(),
    listCategoryTree(),
    getDictionary(),
    getShippingSettings(),
    getCompanyDetails(),
  ]);
  const contactEmail = seller.email || FALLBACK_EMAIL;
  const allCategories: NavCategory[] = categories.map((c) => ({
    slug: c.slug,
    label: mainLabel(c.slug, locale) ?? c.slug,
    subs: c.subs.map((s) => ({ slug: s.slug, label: subLabel(s.slug, locale) ?? s.slug })),
  }));
  const navCategories = [...categories]
    .filter((c) => c.slug !== "other")
    .sort((a, b) => b.productCount - a.productCount)
    .slice(0, NAV_CATEGORY_COUNT)
    .map((c) => allCategories.find((n) => n.slug === c.slug)!);

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-card/95 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-card/85">
      <div className="hidden border-b border-border/60 bg-muted/40 md:block">
        <div className="mx-auto flex h-9 max-w-7xl items-center justify-between gap-6 px-4 text-xs text-muted-foreground sm:px-6">
          <div className="flex items-center gap-5">
            <span className="inline-flex items-center gap-1.5">
              <BadgeCheck className="h-3.5 w-3.5 text-primary" />
              {t.header.businessOnly}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Truck className="h-3.5 w-3.5 text-primary" />
              {t.header.delivery}
            </span>
            {shipping.freeShippingThresholdCents != null && (
              <span className="inline-flex items-center gap-1.5 font-medium text-foreground">
                <PackageCheck className="h-3.5 w-3.5 text-primary" />
                {fmt(t.header.freeShipping, {
                  amount: formatPriceCents(shipping.freeShippingThresholdCents).replace(/,00$/, ""),
                })}
              </span>
            )}
            <span className="hidden items-center gap-1.5 lg:inline-flex">
              <ShieldCheck className="h-3.5 w-3.5 text-primary" />
              {t.header.invoiceAfter}
            </span>
          </div>
          <div className="flex items-center gap-4">
            <a href={`mailto:${contactEmail}`} className="transition-colors hover:text-foreground">
              {contactEmail}
            </a>
            <LanguageSwitcher />
          </div>
        </div>
      </div>

      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6">
        <MobileNav categories={allCategories} signedIn={Boolean(user)} />

        <Link href="/" className="flex shrink-0 items-center" aria-label="Cosme International">
          <SiteLogo height={36} priority className="dark:rounded-md dark:bg-white dark:px-2 dark:py-1" />
        </Link>

        <form action="/products" className="relative mx-auto hidden w-full max-w-xl md:block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            name="q"
            placeholder={t.common.searchPlaceholder}
            className="h-10 w-full rounded-full border-border pl-9 pr-24"
            aria-label={t.common.searchAria}
          />
          <Button
            type="submit"
            size="sm"
            className="absolute right-1 top-1/2 h-8 -translate-y-1/2 rounded-full px-4"
          >
            {t.common.search}
          </Button>
        </form>

        <div className="ml-auto flex items-center gap-1.5 md:ml-0">
          {user ? (
            <>
              {user.role === "platform_admin" && (
                <Button asChild variant="ghost" size="sm" className="hidden lg:inline-flex">
                  <Link href="/admin">
                    <ShieldCheck className="h-4 w-4" />
                    {t.common.admin}
                  </Link>
                </Button>
              )}
              <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
                <Link href="/dashboard">
                  <LayoutDashboard className="h-4 w-4" />
                  {t.common.dashboard}
                </Link>
              </Button>
              <CartLink />
              <UserMenu email={user.email} name={user.name} />
            </>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm">
                <Link href="/sign-in">{t.common.signIn}</Link>
              </Button>
              <Button asChild size="sm" className="hidden sm:inline-flex">
                <Link href="/sign-up">{t.common.requestAccount}</Link>
              </Button>
            </>
          )}
        </div>
      </div>

      <form action="/products" className="relative border-t border-border/60 px-4 py-2.5 md:hidden">
        <Search className="pointer-events-none absolute left-7 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          name="q"
          placeholder={t.common.searchPlaceholderShort}
          className="h-9 w-full rounded-full pl-9"
          aria-label={t.common.searchAria}
        />
      </form>

      {allCategories.length > 0 && (
        <nav className="hidden border-t border-border/60 md:block">
          <div className="mx-auto flex h-11 max-w-7xl items-center gap-1 px-4 sm:px-6">
            {/* All categories: opens on hover or keyboard focus, no script needed. */}
            <div className="group relative">
              <Link
                href="/products"
                className="inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                {t.common.categories}
                <ChevronDown className="h-3.5 w-3.5 transition-transform group-hover:rotate-180" />
              </Link>
              <div className="invisible absolute left-0 top-full z-50 w-[min(64rem,calc(100vw-2rem))] pt-1 opacity-0 transition-opacity group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100">
                <div className="grid max-h-[70vh] grid-cols-2 gap-x-6 gap-y-5 overflow-y-auto rounded-xl border border-border bg-card p-5 shadow-xl lg:grid-cols-4">
                  {allCategories.map((c) => (
                    <div key={c.slug} className="min-w-0">
                      <Link href={`/products?cat=${c.slug}`} className="text-sm font-semibold hover:text-primary">
                        {c.label}
                      </Link>
                      <ul className="mt-1.5 space-y-1">
                        {c.subs.map((s) => (
                          <li key={s.slug}>
                            <Link
                              href={`/products?cat=${c.slug}&sub=${s.slug}`}
                              className="block truncate text-[13px] text-muted-foreground hover:text-foreground"
                            >
                              {s.label}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <span className="mx-1 h-4 w-px bg-border" />
            {navCategories.map((c) => (
              <div key={c.slug} className="group/item relative">
                <Link
                  href={`/products?cat=${c.slug}`}
                  className="block whitespace-nowrap rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                >
                  {c.label}
                </Link>
                {c.subs.length > 0 && (
                  <div className="invisible absolute left-0 top-full z-50 min-w-56 pt-1 opacity-0 transition-opacity group-focus-within/item:visible group-focus-within/item:opacity-100 group-hover/item:visible group-hover/item:opacity-100">
                    <ul className="rounded-xl border border-border bg-card p-2 shadow-xl">
                      {c.subs.map((s) => (
                        <li key={s.slug}>
                          <Link
                            href={`/products?cat=${c.slug}&sub=${s.slug}`}
                            className="block whitespace-nowrap rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
                          >
                            {s.label}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))}
            <Link
              href="/products"
              className="ml-auto whitespace-nowrap rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              {t.common.allProducts}
            </Link>
          </div>
        </nav>
      )}
    </header>
  );
}
