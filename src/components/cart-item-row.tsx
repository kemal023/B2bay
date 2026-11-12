"use client";

import { useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { removeCartItem, updateCartItemQuantity } from "@/lib/actions/cart";
import { formatPriceCents } from "@/lib/format";
import { ImageOff, Loader2, Trash2 } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { fmt } from "@/lib/i18n/dictionaries";
import { localizedName, localizedUnit } from "@/lib/product-text";

type CartItem = {
  id: string;
  quantity: number;
  /** This customer’s price per unit at this quantity (agreement + volume tier). */
  unitPriceCents: number;
  product: {
    id: string;
    name: string;
    nameNl: string | null;
    nameDe?: string | null;
    nameFr?: string | null;
    hasImage: boolean;
    unit: string;
    priceCents: number;
    currency: string;
    minOrderQty: number;
  };
};

export function CartItemRow({ item }: { item: CartItem }) {
  const [isPending, startTransition] = useTransition();
  const { locale, t } = useI18n();
  const name = localizedName(item.product, locale);
  const unit = localizedUnit(item.product.unit, locale);

  function setQuantity(quantity: number) {
    startTransition(async () => {
      const result = await updateCartItemQuantity(item.id, quantity);
      if (!result.ok) toast.error(result.error);
    });
  }

  function remove() {
    startTransition(async () => {
      const result = await removeCartItem(item.id);
      if (!result.ok) toast.error(result.error);
    });
  }

  return (
    <div className="flex gap-4 rounded-xl border border-border bg-card p-4 transition-shadow hover:shadow-sm">
      <Link
        href={`/products/${item.product.id}`}
        className="h-24 w-24 shrink-0 overflow-hidden rounded-lg border border-border bg-white p-2"
      >
        {item.product.hasImage ? (
          // eslint-disable-next-line @next/next/no-img-element -- supplier image domains are dynamic
          <img
            src={`/img/${item.product.id}`}
            alt=""
            className="h-full w-full object-contain"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-zinc-300">
            <ImageOff className="h-6 w-6" />
          </div>
        )}
      </Link>

      <div className="flex min-w-0 flex-1 flex-col justify-between gap-3">
        <div className="min-w-0">
          <Link
            href={`/products/${item.product.id}`}
            className="line-clamp-2 text-sm font-medium leading-snug transition-colors hover:text-primary"
          >
            {name}
          </Link>
          <p className="mt-1 text-xs text-muted-foreground">
            {fmt(t.cart.unitLine, {
              price: formatPriceCents(item.unitPriceCents, item.product.currency),
              unit,
              qty: item.product.minOrderQty,
            })}
          </p>
          {item.unitPriceCents < item.product.priceCents && (
            <p className="mt-0.5 text-xs text-emerald-600 dark:text-emerald-400">
              {fmt(t.pricing.youSave, {
                percent: Math.round((1 - item.unitPriceCents / item.product.priceCents) * 100),
              })}{" "}
              <span className="text-muted-foreground line-through">
                {formatPriceCents(item.product.priceCents, item.product.currency)}
              </span>
            </p>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Input
            type="number"
            min={item.product.minOrderQty}
            value={item.quantity}
            onChange={(e) => setQuantity(Math.max(0, Number(e.target.value) || 0))}
            className="h-9 w-20"
            disabled={isPending}
            aria-label={t.product.quantity}
          />
          <Button
            variant="ghost"
            size="icon"
            onClick={remove}
            disabled={isPending}
            aria-label={t.cart.remove}
            className="text-muted-foreground hover:text-destructive"
          >
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      <div className="shrink-0 text-right">
        <div className="font-semibold tabular-nums">
          {formatPriceCents(item.unitPriceCents * item.quantity, item.product.currency)}
        </div>
        <div className="mt-0.5 text-xs text-muted-foreground">{t.cart.exclVat}</div>
      </div>
    </div>
  );
}
