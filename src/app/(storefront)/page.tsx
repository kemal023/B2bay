import Link from "next/link";
import {
  ArrowRight,
  Boxes,
  Building2,
  FileCheck2,
  Flame,
  Package,
  ShieldCheck,
  Sparkles,
  Tags,
  Truck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProductCard } from "@/components/product-card";
import {
  getCatalogStats,
  listCategorySummaries,
  listTopDeals,
} from "@/lib/products";
import { getAppUserWithCompany } from "@/lib/auth";
import { priceAccessFor } from "@/lib/price-visibility";
import { getDictionary } from "@/lib/i18n/server";
import { intlLocale } from "@/lib/i18n/config";
import { fmt, plural } from "@/lib/i18n/dictionaries";
import { localizedCategory } from "@/lib/product-text";

const FEATURED_CATEGORY_COUNT = 12;


export default async function HomePage() {
  const [stats, categories, topDeals, user, { locale, t }] = await Promise.all([
    getCatalogStats(),
    listCategorySummaries(),
    listTopDeals(8),
    getAppUserWithCompany(),
    getDictionary(),
  ]);
  const priceAccess = priceAccessFor(user);
  // Staff see list prices; a customer sees its own price agreement.
  const discount = user?.role === "platform_admin" ? 0 : (user?.company?.discountPercent ?? 0);
  const h = t.home;
  const formatCount = (n: number) => n.toLocaleString(intlLocale(locale));

  // Pick the biggest categories, but show them A–Z: sorting before slicing
  // would feature whatever starts with an A instead of what we mostly sell.
  const featuredCategories = categories
    .slice(0, FEATURED_CATEGORY_COUNT)
    .map((c) => ({ ...c, label: localizedCategory(c, locale) ?? c.category }))
    .sort((a, b) => a.label.localeCompare(b.label, locale));

  const heroProducts = topDeals.filter((p) => p.imageUrl).slice(0, 4);

  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border bg-gradient-to-b from-accent/50 via-background to-background">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,var(--color-primary)_0%,transparent_45%)] opacity-[0.07]"
        />
        <div className="relative mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:py-28">
          <div className="grid items-center gap-12 lg:grid-cols-[1fr_minmax(0,440px)]">
          <div className="max-w-3xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card/80 px-3 py-1 text-xs font-medium text-muted-foreground shadow-sm backdrop-blur">
              <Sparkles className="h-3.5 w-3.5 text-brand-accent" />
              {h.badge}
            </span>
            <h1 className="mt-6 text-4xl font-semibold leading-[1.1] tracking-tight text-foreground sm:text-5xl lg:text-6xl">
              {h.titleLine1}
              <br className="hidden sm:block" />{" "}
              <span className="text-primary">{h.titleLine2}</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">
              {fmt(h.intro, { count: formatCount(stats.products) })}
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Button asChild size="lg" className="h-11 px-6">
                <Link href="/products">
                  {t.common.viewCatalogue}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="h-11 px-6">
                <Link href="/sign-up">{t.common.requestBusinessAccount}</Link>
              </Button>
            </div>
          </div>

          {/* Real catalogue photography rather than a stock illustration —
              it shows what is actually for sale. */}
          {heroProducts.length === 4 && (
            <div aria-hidden className="relative hidden lg:block">
              <div className="absolute -inset-6 rounded-[2rem] bg-brand/10 blur-2xl" />
              <div className="relative grid grid-cols-2 gap-4">
                {heroProducts.map((p, i) => (
                  <div
                    key={p.id}
                    className={`overflow-hidden rounded-2xl border border-border bg-white p-4 shadow-md ${
                      i % 2 === 1 ? "translate-y-6" : ""
                    }`}
                  >
                    <div className="aspect-square">
                      {/* eslint-disable-next-line @next/next/no-img-element -- supplier image domains are dynamic */}
                      <img
                        src={p.imageUrl ?? ""}
                        alt=""
                        className="h-full w-full object-contain"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          </div>

          <dl className="mt-16 grid grid-cols-1 gap-px overflow-hidden rounded-xl border border-border bg-border shadow-sm sm:grid-cols-3">
            {[
              { icon: Package, label: h.statProducts, value: formatCount(stats.products) },
              { icon: Tags, label: h.statCategories, value: formatCount(stats.categories) },
              { icon: Truck, label: h.statInStock, value: formatCount(stats.inStock) },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} className="bg-card p-5">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-soft text-accent-foreground">
                  <Icon className="h-4 w-4" />
                </span>
                <dd className="mt-3 text-2xl font-semibold tracking-tight">{value}</dd>
                <dt className="mt-0.5 text-sm text-muted-foreground">{label}</dt>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* Topdeals */}
      {topDeals.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:py-20">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-accent-soft px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-brand-accent-strong">
                <Flame className="h-3 w-3" />
                {h.featured}
              </span>
              <h2 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">{h.topDeals}</h2>
              <p className="mt-2 max-w-xl text-sm text-muted-foreground">{h.topDealsIntro}</p>
            </div>
            <Button asChild variant="ghost" className="text-primary hover:text-primary">
              <Link href="/products">
                {t.common.allProducts}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>

          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {topDeals.map((p) => (
              <ProductCard key={p.id} product={p} priceAccess={priceAccess} locale={locale} discountPercent={discount} />
            ))}
          </div>
        </section>
      )}

      {/* Ons assortiment */}
      {featuredCategories.length > 0 && (
        <section id="assortiment" className="border-y border-border bg-muted/30">
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:py-20">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-soft px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-accent-foreground">
                  <Tags className="h-3 w-3" />
                  {h.categoriesBadge}
                </span>
                <h2 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">
                  {h.rangeTitle}
                </h2>
                <p className="mt-2 max-w-xl text-sm text-muted-foreground">
                  {fmt(h.rangeIntro, { count: formatCount(stats.categories) })}
                </p>
              </div>
            </div>

            <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {featuredCategories.map((c) => (
                <Link
                  key={c.category}
                  href={`/products?category=${encodeURIComponent(c.category)}`}
                  className="group flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium transition-colors group-hover:text-primary">
                      {c.label}
                    </div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      {plural(c.productCount, h.productCountOne, h.productCountOther, {
                        count: formatCount(c.productCount),
                      })}
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-all group-hover:translate-x-0.5 group-hover:text-primary" />
                </Link>
              ))}
            </div>

            {categories.length > FEATURED_CATEGORY_COUNT && (
              <div className="mt-6">
                <Button asChild variant="outline">
                  <Link href="/products">
                    {fmt(h.viewAllCategories, { count: formatCount(categories.length) })}
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Hoe het werkt */}
      <section id="hoe-werkt-het" className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:py-20">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-soft px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-accent-foreground">
          <Boxes className="h-3 w-3" />
          {h.stepsBadge}
        </span>
        <h2 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">{h.howTitle}</h2>
        <p className="mt-2 max-w-xl text-sm text-muted-foreground">{h.howIntro}</p>

        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {h.steps.map((s, i) => ({
            ...s,
            icon: [Building2, Boxes, FileCheck2][i],
            step: String(i + 1).padStart(2, "0"),
          })).map(({ icon: Icon, step, title, body }) => (
            <div
              key={step}
              className="relative overflow-hidden rounded-xl border border-border bg-card p-6 shadow-sm transition-all hover:border-primary/40 hover:shadow-md"
            >
              <span
                aria-hidden
                className="absolute -right-2 top-2 text-5xl font-bold tabular-nums text-brand/10"
              >
                {step}
              </span>
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-soft text-accent-foreground">
                <Icon className="h-5 w-5" />
              </span>
              <h3 className="mt-4 font-semibold tracking-tight">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* USP strip */}
      <section className="border-y border-border bg-muted/30">
        <div className="mx-auto grid max-w-7xl gap-6 px-4 py-12 sm:grid-cols-2 sm:px-6 lg:grid-cols-4">
          {h.usps.map((u, i) => ({
            ...u,
            icon: [ShieldCheck, Package, Truck, FileCheck2][i],
          })).map(({ icon: Icon, title, body }) => (
            <div key={title} className="flex gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-accent-foreground">
                <Icon className="h-4 w-4" />
              </span>
              <div>
                <h3 className="text-sm font-semibold">{title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:py-20">
        <div className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-accent/60 to-card px-6 py-12 text-center sm:px-12">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_bottom_left,var(--color-primary)_0%,transparent_50%)] opacity-[0.06]"
          />
          <div className="relative mx-auto max-w-2xl">
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">{h.ctaTitle}</h2>
            <p className="mt-3 text-muted-foreground">{h.ctaBody}</p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Button asChild size="lg" className="h-11 px-6">
                <Link href="/sign-up">
                  {t.common.requestBusinessAccount}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="h-11 px-6">
                <Link href="/products">{h.ctaSecondary}</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
