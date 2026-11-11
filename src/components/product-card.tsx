import Link from "next/link";
import { ImageOff, Lock } from "lucide-react";
import { formatPriceCents } from "@/lib/format";
import type { PriceAccess } from "@/lib/price-visibility";
import type { Locale } from "@/lib/i18n/config";
import { dictionaries, fmt } from "@/lib/i18n/dictionaries";
import { localizedCategory, localizedName, localizedUnit } from "@/lib/product-text";

export type ProductCardProduct = {
  id: string;
  name: string;
  nameNl: string | null;
  nameDe?: string | null;
  nameFr?: string | null;
  category: string | null;
  categoryNl: string | null;
  categoryDe?: string | null;
  categoryFr?: string | null;
  imageUrl: string | null;
  priceCents: number;
  currency: string;
  unit: string;
  minOrderQty: number;
  stockQty: number;
};

export function ProductCard({
  product,
  priceAccess,
  locale,
  discountPercent = 0,
}: {
  product: ProductCardProduct;
  priceAccess: PriceAccess;
  locale: Locale;
  /** The customer’s price agreement; volume tiers show on the product page. */
  discountPercent?: number;
}) {
  const t = dictionaries[locale];
  const showPrice = priceAccess === "visible";
  const name = localizedName(product, locale);
  const category = localizedCategory(product, locale);
  const price = Math.round(product.priceCents * (1 - discountPercent / 100));

  return (
    <Link
      href={`/products/${product.id}`}
      className="group flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {/* Supplier photos are catalogue shots on white, so a white tile with
          contain (not cover) keeps them uncropped and consistent in both themes. */}
      <div className="relative aspect-square bg-white p-4">
        {product.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- supplier image domains are dynamic and admin-managed
          <img
            src={product.imageUrl}
            alt={name}
            loading="lazy"
            className="h-full w-full object-contain transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-zinc-300">
            <ImageOff className="h-10 w-10" />
          </div>
        )}
        {product.stockQty > 0 && (
          <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 ring-1 ring-emerald-600/20">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            {t.common.inStock}
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-1 p-4">
        {category && (
          <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            {category}
          </span>
        )}
        <h3 className="line-clamp-2 text-sm font-medium leading-snug text-foreground transition-colors group-hover:text-primary">
          {name}
        </h3>

        <div className="mt-auto flex items-end justify-between gap-2 pt-3">
          {showPrice ? (
            <div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-lg font-semibold tracking-tight text-foreground">
                  {formatPriceCents(price, product.currency)}
                </span>
                {price < product.priceCents && (
                  <span className="text-xs text-muted-foreground line-through">
                    {formatPriceCents(product.priceCents, product.currency)}
                  </span>
                )}
              </div>
              <div className="text-[11px] text-muted-foreground">
                {fmt(t.common.perUnit, { unit: localizedUnit(product.unit, locale) })}
              </div>
            </div>
          ) : (
            <div>
              <div className="flex items-center gap-1.5 text-sm font-medium text-primary">
                <Lock className="h-3.5 w-3.5" />
                {priceAccess === "pending" ? t.card.priceAfterApproval : t.card.loginForPrices}
              </div>
              <div className="text-[11px] text-muted-foreground">
                {priceAccess === "pending" ? t.card.underReview : t.card.businessOnly}
              </div>
            </div>
          )}
          {product.minOrderQty > 1 && (
            <span className="rounded-md bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
              {fmt(t.card.min, { qty: product.minOrderQty })}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
