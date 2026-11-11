import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CartLink } from "@/components/cart-link";
import { UserMenu } from "@/components/user-menu";
import { MobileNav } from "@/components/mobile-nav";
import { SiteLogo } from "@/components/site-logo";
import { getAppUser } from "@/lib/auth";
import { listCategorySummaries } from "@/lib/products";
import { getDictionary } from "@/lib/i18n/server";
import { localizedCategory } from "@/lib/product-text";
import { LanguageSwitcher } from "@/components/language-switcher";
import { fmt } from "@/lib/i18n/dictionaries";
import { formatPriceCents } from "@/lib/format";
import { getShippingSettings } from "@/lib/shipping";
import {
  BadgeCheck,
  LayoutDashboard,
  PackageCheck,
  Search,
  ShieldCheck,
  Truck,
} from "lucide-react";

const NAV_CATEGORY_COUNT = 6;

export async function SiteHeader() {
  const [user, categories, { locale, t }, shipping] = await Promise.all([
    getAppUser(),
    listCategorySummaries(),
    getDictionary(),
    getShippingSettings(),
  ]);
  const navCategories = categories
    .slice(0, NAV_CATEGORY_COUNT)
    .map((c) => ({ value: c.category, label: localizedCategory(c, locale) ?? c.category }))
    .sort((a, b) => a.label.localeCompare(b.label, locale));

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
            <a href="mailto:info@cosmeweb.nl" className="transition-colors hover:text-foreground">
              info@cosmeweb.nl
            </a>
            <LanguageSwitcher />
          </div>
        </div>
      </div>

      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6">
        <MobileNav categories={navCategories} signedIn={Boolean(user)} />

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

      {navCategories.length > 0 && (
        <nav className="hidden border-t border-border/60 md:block">
          <div className="mx-auto flex h-11 max-w-7xl items-center gap-1 px-4 sm:px-6">
            <Link
              href="/products"
              className="rounded-md px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              {t.common.allProducts}
            </Link>
            <span className="mx-1 h-4 w-px bg-border" />
            {navCategories.map((c) => (
              <Link
                key={c.value}
                href={`/products?category=${encodeURIComponent(c.value)}`}
                className="rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                {c.label}
              </Link>
            ))}
            <Link
              href="/#assortiment"
              className="ml-auto rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              {t.common.allCategories}
            </Link>
          </div>
        </nav>
      )}
    </header>
  );
}
