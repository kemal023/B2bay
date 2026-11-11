import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AddToCartForm } from "@/components/add-to-cart-form";
import { ProductCard } from "@/components/product-card";
import { getProduct, listProducts, requestDescriptionTranslation } from "@/lib/products";
import { getAppUserWithCompany } from "@/lib/auth";
import { priceAccessFor } from "@/lib/price-visibility";
import { formatPriceCents } from "@/lib/format";
import { getDictionary } from "@/lib/i18n/server";
import { getVolumeTiers, unitPriceCents } from "@/lib/pricing";
import { FavoriteButton } from "@/components/bulk-cart-actions";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { favorites } from "@/db/schema";
import { intlLocale } from "@/lib/i18n/config";
import { fmt } from "@/lib/i18n/dictionaries";
import {
  localizedCategory,
  localizedDescription,
  localizedName,
  localizedUnit,
} from "@/lib/product-text";
import { FileCheck2, ImageOff, Languages, Lock, PackageCheck, Truck } from "lucide-react";

const USP_ICONS = [PackageCheck, Truck, FileCheck2];

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const [{ id }, { locale }] = await Promise.all([params, getDictionary()]);
  const product = await getProduct(id);
  if (!product) return {};
  const name = localizedName(product, locale);
  const description = localizedDescription(product, locale).text;
  const category = localizedCategory(product, locale);
  const summary = (description ?? [name, category, product.ean && `EAN ${product.ean}`].filter(Boolean).join(" · "))
    .replace(/s+/g, " ")
    .slice(0, 160);
  return {
    title: name,
    description: summary,
    alternates: { canonical: `/products/${product.id}` },
    openGraph: {
      title: name,
      description: summary,
      type: "website",
      ...(product.imageUrl ? { images: [{ url: product.imageUrl }] } : {}),
    },
  };
}

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [product, user, { locale, t }] = await Promise.all([
    getProduct(id),
    getAppUserWithCompany(),
    getDictionary(),
  ]);
  if (!product) notFound();

  const priceAccess = priceAccessFor(user);
  // Staff see list prices; a customer sees its own price agreement.
  const discount = user?.role === "platform_admin" ? 0 : (user?.company?.discountPercent ?? 0);
  const pricing = { companyDiscountPercent: discount, tiers: priceAccess === "visible" ? await getVolumeTiers() : [] };
  const yourPrice = unitPriceCents(product.priceCents, 1, pricing);
  const isFavorite = user?.company
    ? Boolean(
        await getDb().query.favorites.findFirst({
          where: and(eq(favorites.companyId, user.company.id), eq(favorites.productId, product.id)),
        }),
      )
    : false;
  const showPrice = priceAccess === "visible";
  const p = t.product;
  const num = (n: number) => n.toLocaleString(intlLocale(locale));

  const name = localizedName(product, locale);
  const category = localizedCategory(product, locale);
  const unit = localizedUnit(product.unit, locale);
  const description = localizedDescription(product, locale);

  // Someone wants to read this one: let it skip the translation queue.
  if (description.pending) await requestDescriptionTranslation(product.id);

  const related = product.category
    ? (await listProducts({ category: product.category, sort: "relevant", locale })).products
        .filter((r) => r.id !== product.id)
        .slice(0, 4)
    : [];

  const specs = [
    product.ean ? { label: p.ean, value: product.ean } : null,
    category ? { label: p.category, value: category } : null,
    { label: p.unit, value: unit },
    { label: p.minOrder, value: `${product.minOrderQty} ${unit}` },
    {
      label: p.stock,
      value: product.stockQty > 0 ? fmt(p.pieces, { count: num(product.stockQty) }) : p.onRequest,
    },
  ].filter((s): s is { label: string; value: string } => s !== null);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:py-10">
      <nav className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
        <Link href="/" className="transition-colors hover:text-foreground">
          {t.common.home}
        </Link>
        <span className="text-border">/</span>
        <Link href="/products" className="transition-colors hover:text-foreground">
          {t.common.products}
        </Link>
        {product.category && (
          <>
            <span className="text-border">/</span>
            <Link
              href={`/products?category=${encodeURIComponent(product.category)}`}
              className="transition-colors hover:text-foreground"
            >
              {category}
            </Link>
          </>
        )}
      </nav>

      <div className="mt-6 grid gap-10 lg:grid-cols-[1fr_420px]">
        <div className="min-w-0">
          <div className="overflow-hidden rounded-xl border border-border bg-white p-6 sm:p-10">
            <div className="aspect-square">
              {product.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- supplier image domains are dynamic and admin-managed
                <img src={product.imageUrl} alt={name} className="h-full w-full object-contain" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-zinc-300">
                  <ImageOff className="h-16 w-16" />
                </div>
              )}
            </div>
          </div>

          <div className="mt-10">
            <h2 className="text-lg font-semibold tracking-tight">{p.specs}</h2>
            <dl className="mt-4 overflow-hidden rounded-xl border border-border">
              {specs.map((spec, i) => (
                <div
                  key={spec.label}
                  className={`flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm ${
                    i % 2 === 0 ? "bg-muted/40" : "bg-card"
                  }`}
                >
                  <dt className="text-muted-foreground">{spec.label}</dt>
                  <dd className="font-medium tabular-nums">{spec.value}</dd>
                </div>
              ))}
            </dl>
          </div>

          {(description.text || description.pending) && (
            <div className="mt-10">
              <h2 className="text-lg font-semibold tracking-tight">{p.description}</h2>
              {description.text ? (
                <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                  {description.text}
                </p>
              ) : (
                <p className="mt-3 flex items-center gap-2 rounded-lg bg-muted/50 p-4 text-sm text-muted-foreground">
                  <Languages className="h-4 w-4 shrink-0" />
                  {p.descriptionPending}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Buy box */}
        <div className="lg:sticky lg:top-[8.5rem] lg:h-fit">
          {category && (
            <Badge variant="secondary" className="mb-3">
              {category}
            </Badge>
          )}
          <div className="flex items-start justify-between gap-3">
            <h1 className="text-2xl font-semibold leading-snug tracking-tight sm:text-3xl">{name}</h1>
            {user?.company && <FavoriteButton productId={product.id} initial={isFavorite} />}
          </div>

          <div className="mt-6 rounded-xl border border-border bg-card p-5 shadow-sm">
            {showPrice ? (
              <>
                <div className="flex flex-wrap items-end gap-2">
                  <span className="text-3xl font-semibold tracking-tight">
                    {formatPriceCents(yourPrice, product.currency)}
                  </span>
                  <span className="pb-1 text-sm text-muted-foreground">/ {unit}</span>
                  {yourPrice < product.priceCents && (
                    <span className="pb-1 text-sm text-muted-foreground line-through">
                      {formatPriceCents(product.priceCents, product.currency)}
                    </span>
                  )}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {fmt(p.exclVatMin, { qty: product.minOrderQty, unit })}
                </p>
                {pricing.tiers.length > 0 && (
                  <div className="mt-4 rounded-lg bg-muted/50 p-3">
                    <p className="text-xs font-semibold">{t.pricing.volumeTitle}</p>
                    <ul className="mt-1.5 space-y-1 text-xs">
                      {pricing.tiers.map((tier) => (
                        <li key={tier.minQty} className="flex justify-between gap-3">
                          <span className="text-muted-foreground">
                            {fmt(t.pricing.volumeFrom, { qty: tier.minQty, unit })}
                          </span>
                          <span className="tabular-nums">
                            {formatPriceCents(unitPriceCents(product.priceCents, tier.minQty, pricing), product.currency)}{" "}
                            <span className="text-emerald-600 dark:text-emerald-400">−{tier.percent}%</span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            ) : (
              <div className="rounded-lg bg-brand-soft p-4">
                <p className="flex items-center gap-2 text-sm font-medium text-accent-foreground">
                  <Lock className="h-4 w-4" />
                  {priceAccess === "pending" ? p.pricesAfterApproval : p.pricesAfterLogin}
                </p>
                <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                  {priceAccess === "pending" ? p.pricesApprovalBody : p.pricesLoginBody}
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  {fmt(p.minPurchase, { qty: product.minOrderQty, unit })}
                </p>
              </div>
            )}

            <div className="mt-4 flex items-center gap-2 text-sm">
              {product.stockQty > 0 ? (
                <>
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  <span className="font-medium text-emerald-700 dark:text-emerald-400">
                    {t.common.inStock}
                  </span>
                  <span className="text-muted-foreground">
                    {fmt(p.inStockCount, { count: num(product.stockQty) })}
                  </span>
                </>
              ) : (
                <>
                  <span className="h-2 w-2 rounded-full bg-amber-500" />
                  <span className="font-medium text-amber-700 dark:text-amber-400">
                    {p.stockOnRequest}
                  </span>
                </>
              )}
            </div>

            <div className="mt-5">
              <AddToCartForm
                productId={product.id}
                minOrderQty={product.minOrderQty}
                access={priceAccess}
              />
            </div>

            <ul className="mt-5 space-y-2.5 border-t border-border pt-4 text-xs text-muted-foreground">
              {p.usps.map((usp, i) => {
                const Icon = USP_ICONS[i];
                return (
                  <li key={usp} className="flex items-center gap-2">
                    <Icon className="h-4 w-4 shrink-0 text-primary" />
                    {usp}
                  </li>
                );
              })}
            </ul>
          </div>

          {product.ean && (
            <p className="mt-3 text-center text-xs text-muted-foreground">EAN {product.ean}</p>
          )}
        </div>
      </div>

      {related.length > 0 && (
        <section className="mt-16 border-t border-border pt-10">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <h2 className="text-xl font-semibold tracking-tight">
              {fmt(p.moreFrom, { category: category ?? "" })}
            </h2>
            <Button asChild variant="ghost" className="text-primary hover:text-primary">
              <Link href={`/products?category=${encodeURIComponent(product.category!)}`}>
                {p.viewAll}
              </Link>
            </Button>
          </div>
          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {related.map((r) => (
              <ProductCard key={r.id} product={r} priceAccess={priceAccess} locale={locale} discountPercent={discount} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
