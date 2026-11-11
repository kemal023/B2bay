import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ProductCard } from "@/components/product-card";
import {
  isSortKey,
  listCategorySummaries,
  listProducts,
  SORT_OPTIONS,
  type SortKey,
} from "@/lib/products";
import { getAppUserWithCompany } from "@/lib/auth";
import { priceAccessFor } from "@/lib/price-visibility";
import { getDictionary } from "@/lib/i18n/server";
import { intlLocale } from "@/lib/i18n/config";
import { fmt, plural } from "@/lib/i18n/dictionaries";
import { localizedCategory } from "@/lib/product-text";
import {
  ChevronLeft,
  ChevronRight,
  PackageSearch,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string }>;
}): Promise<Metadata> {
  const [{ q, category }, { locale, t }] = await Promise.all([searchParams, getDictionary()]);
  if (category) {
    const match = (await listCategorySummaries("name")).find((c) => c.category === category);
    const label = match ? (localizedCategory(match, locale) ?? category) : category;
    return { title: label, alternates: { canonical: `/products?category=${encodeURIComponent(category)}` } };
  }
  // Search result pages are thin duplicates of the catalogue: keep them out of the index.
  if (q) return { title: `${t.catalog.searchResults}: ${q}`, robots: { index: false } };
  return { title: t.catalog.title, alternates: { canonical: "/products" } };
}

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    category?: string;
    page?: string;
    sort?: string;
    min?: string;
    max?: string;
  }>;
}) {
  const { q, category, page: pageParam, sort: sortParam, min, max } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);
  const sort: SortKey = isSortKey(sortParam) ? sortParam : "relevant";

  const { locale, t } = await getDictionary();
  const c = t.catalog;
  const user = await getAppUserWithCompany();
  const priceAccess = priceAccessFor(user);
  // Staff see list prices; a customer sees its own price agreement.
  const discount = user?.role === "platform_admin" ? 0 : (user?.company?.discountPercent ?? 0);
  const showPrice = priceAccess === "visible";

  // The price filter is in the customer's own prices; the catalogue stores
  // list prices, so convert the bounds. Ignored for visitors without prices.
  const euro = (v?: string) => {
    const n = Number(String(v ?? "").replace(",", "."));
    return v && Number.isFinite(n) && n >= 0 ? n : undefined;
  };
  const minEuro = showPrice ? euro(min) : undefined;
  const maxEuro = showPrice ? euro(max) : undefined;
  const toList = (e: number) => Math.round((e * 100) / (1 - discount / 100));

  const [{ products, total, totalPages, fuzzy }, categorySummaries] = await Promise.all([
    listProducts({
      q,
      category,
      page,
      sort,
      locale,
      minPriceCents: minEuro != null ? toList(minEuro) : undefined,
      maxPriceCents: maxEuro != null ? toList(maxEuro) : undefined,
    }),
    listCategorySummaries("name"),
  ]);
  const num = (n: number) => n.toLocaleString(intlLocale(locale));
  // URLs keep the stable English key; visitors see the label in their language.
  const categories = categorySummaries
    .map((cat) => ({ ...cat, label: localizedCategory(cat, locale) ?? cat.category }))
    .sort((a, b) => a.label.localeCompare(b.label, locale));
  const categoryLabel = category
    ? (categories.find((cat) => cat.category === category)?.label ?? category)
    : null;
  // Sorting by price would reveal the price order to visitors who aren't
  // allowed to see the prices themselves.
  const sortOptions = Object.entries(SORT_OPTIONS).filter(
    ([key]) => showPrice || !key.startsWith("price-"),
  );

  function hrefWith(overrides: Record<string, string | undefined>) {
    const params = new URLSearchParams();
    const merged = {
      q,
      category,
      sort: sort === "relevant" ? undefined : sort,
      min: minEuro != null ? String(minEuro) : undefined,
      max: maxEuro != null ? String(maxEuro) : undefined,
      ...overrides,
    };
    for (const [key, value] of Object.entries(merged)) {
      if (value) params.set(key, value);
    }
    const qs = params.toString();
    return qs ? `/products?${qs}` : "/products";
  }

  const hasPrice = minEuro != null || maxEuro != null;
  const hasFilters = Boolean(q || category || hasPrice);
  const firstResult = (page - 1) * 24 + 1;
  const lastResult = Math.min(page * 24, total);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:py-10">
      <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Link href="/" className="transition-colors hover:text-foreground">
          {t.common.home}
        </Link>
        <span className="text-border">/</span>
        {category ? (
          <>
            <Link href="/products" className="transition-colors hover:text-foreground">
              {t.common.products}
            </Link>
            <span className="text-border">/</span>
            <span className="text-foreground">{categoryLabel}</span>
          </>
        ) : (
          <span className="text-foreground">{t.common.products}</span>
        )}
      </nav>

      <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            {categoryLabel ?? (q ? c.searchResults : c.title)}
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {total === 0
              ? c.noneFound
              : plural(total, c.countOne, c.countOther, { count: num(total) })}
            {q && (
              <>
                {` ${c.forQuery} `}
                <span className="font-medium text-foreground">&ldquo;{q}&rdquo;</span>
              </>
            )}
            {fuzzy && <span className="mt-1 block text-amber-700 dark:text-amber-400">{c.fuzzyNote}</span>}
          </p>
        </div>

        <form action="/products" className="relative w-full max-w-sm">
          {category && <input type="hidden" name="category" value={category} />}
          {sort !== "relevant" && <input type="hidden" name="sort" value={sort} />}
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            name="q"
            defaultValue={q}
            placeholder={t.common.searchPlaceholder}
            className="h-10 pl-9"
            aria-label={t.common.searchAria}
          />
        </form>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[240px_1fr]">
        {/* Category sidebar */}
        <aside className="hidden lg:block">
          <div className="sticky top-[8.5rem]">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <SlidersHorizontal className="h-4 w-4" />
              {t.common.categories}
            </h2>
            <nav className="mt-3 max-h-[60vh] space-y-0.5 overflow-y-auto pr-1">
              <Link
                href={hrefWith({ category: undefined, page: undefined })}
                className={`flex items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-sm transition-colors ${
                  category
                    ? "text-muted-foreground hover:bg-accent hover:text-foreground"
                    : "bg-accent font-medium text-accent-foreground"
                }`}
              >
                {t.common.allCategories}
              </Link>
              {categories.map((cat) => {
                const active = cat.category === category;
                return (
                  <Link
                    key={cat.category}
                    href={hrefWith({ category: cat.category, page: undefined })}
                    className={`flex items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-sm transition-colors ${
                      active
                        ? "bg-accent font-medium text-accent-foreground"
                        : "text-muted-foreground hover:bg-accent hover:text-foreground"
                    }`}
                  >
                    <span className="truncate">{cat.label}</span>
                    <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                      {num(cat.productCount)}
                    </span>
                  </Link>
                );
              })}
            </nav>

            {showPrice && (
              <form action="/products" className="mt-6 border-t border-border pt-5">
                <h2 className="text-sm font-semibold">{c.priceFilter}</h2>
                {q && <input type="hidden" name="q" value={q} />}
                {category && <input type="hidden" name="category" value={category} />}
                {sort !== "relevant" && <input type="hidden" name="sort" value={sort} />}
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <Input
                    name="min"
                    type="number"
                    min={0}
                    step="0.01"
                    inputMode="decimal"
                    placeholder={c.priceMin}
                    defaultValue={minEuro ?? ""}
                    aria-label={c.priceMin}
                    className="h-9"
                  />
                  <Input
                    name="max"
                    type="number"
                    min={0}
                    step="0.01"
                    inputMode="decimal"
                    placeholder={c.priceMax}
                    defaultValue={maxEuro ?? ""}
                    aria-label={c.priceMax}
                    className="h-9"
                  />
                </div>
                <Button type="submit" variant="outline" size="sm" className="mt-2 w-full">
                  {c.apply}
                </Button>
              </form>
            )}
          </div>
        </aside>

        <div className="min-w-0">
          {/* Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
            <div className="flex flex-wrap items-center gap-2">
              {hasFilters ? (
                <>
                  {category && (
                    <Link
                      href={hrefWith({ category: undefined, page: undefined })}
                      className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/50 px-3 py-1 text-xs font-medium transition-colors hover:bg-muted"
                    >
                      {categoryLabel}
                      <X className="h-3 w-3" />
                    </Link>
                  )}
                  {hasPrice && (
                    <Link
                      href={hrefWith({ min: undefined, max: undefined, page: undefined })}
                      className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/50 px-3 py-1 text-xs font-medium transition-colors hover:bg-muted"
                    >
                      {fmt(c.priceChip, { min: minEuro ?? 0, max: maxEuro ?? "∞" })}
                      <X className="h-3 w-3" />
                    </Link>
                  )}
                  {q && (
                    <Link
                      href={hrefWith({ q: undefined, page: undefined })}
                      className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/50 px-3 py-1 text-xs font-medium transition-colors hover:bg-muted"
                    >
                      &ldquo;{q}&rdquo;
                      <X className="h-3 w-3" />
                    </Link>
                  )}
                  <Link
                    href="/products"
                    className="text-xs text-muted-foreground underline-offset-2 transition-colors hover:text-foreground hover:underline"
                  >
                    {c.clearAll}
                  </Link>
                </>
              ) : (
                total > 0 && (
                  <span className="text-xs text-muted-foreground">
                    {fmt(c.range, { from: num(firstResult), to: num(lastResult), total: num(total) })}
                  </span>
                )
              )}
            </div>

            <form action="/products" className="flex items-center gap-2">
              {q && <input type="hidden" name="q" value={q} />}
              {category && <input type="hidden" name="category" value={category} />}
              <label htmlFor="sort" className="text-xs text-muted-foreground">
                {c.sort}
              </label>
              <select
                id="sort"
                name="sort"
                defaultValue={sort}
                className="h-9 rounded-md border border-input bg-background px-2.5 text-sm text-foreground"
              >
                {sortOptions.map(([key]) => (
                  <option key={key} value={key} className="bg-background text-foreground">
                    {c.sortOptions[key as SortKey]}
                  </option>
                ))}
              </select>
              <Button type="submit" variant="outline" size="sm">
                {c.apply}
              </Button>
            </form>
          </div>

          {products.length === 0 ? (
            <div className="mt-20 flex flex-col items-center gap-4 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
                <PackageSearch className="h-7 w-7 text-muted-foreground" />
              </div>
              <div>
                <p className="font-medium">{c.noneFound}</p>
                <p className="mt-1 text-sm text-muted-foreground">{c.emptyBody}</p>
              </div>
              {hasFilters && (
                <Button asChild variant="outline">
                  <Link href="/products">{c.clearFilters}</Link>
                </Button>
              )}
            </div>
          ) : (
            <>
              <div className="mt-6 grid gap-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                {products.map((p) => (
                  <ProductCard key={p.id} product={p} priceAccess={priceAccess} locale={locale} discountPercent={discount} />
                ))}
              </div>

              {totalPages > 1 && (
                <div className="mt-12 flex items-center justify-center gap-4">
                  {page > 1 ? (
                    <Button asChild variant="outline" size="sm">
                      <Link href={hrefWith({ page: String(page - 1) })}>
                        <ChevronLeft className="h-4 w-4" /> {c.previous}
                      </Link>
                    </Button>
                  ) : (
                    <Button variant="outline" size="sm" disabled>
                      <ChevronLeft className="h-4 w-4" /> {c.previous}
                    </Button>
                  )}
                  <span className="text-sm text-muted-foreground">
                    {fmt(c.pageOf, { page: num(page), total: num(totalPages) })}
                  </span>
                  {page < totalPages ? (
                    <Button asChild variant="outline" size="sm">
                      <Link href={hrefWith({ page: String(page + 1) })}>
                        {c.next} <ChevronRight className="h-4 w-4" />
                      </Link>
                    </Button>
                  ) : (
                    <Button variant="outline" size="sm" disabled>
                      {c.next} <ChevronRight className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
