"use client";

import { useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { removeCartItem, updateCartItemQuantity } from "@/lib/actions/cart";
import { formatPriceCents } from "@/lib/format";
import { Loader2, Trash2 } from "lucide-react";

type CartItem = {
  id: string;
  quantity: number;
  product: {
    id: string;
    name: string;
    imageUrl: string | null;
    unit: string;
    priceCents: number;
    currency: string;
    minOrderQty: number;
  };
};

export function CartItemRow({ item }: { item: CartItem }) {
  const [isPending, startTransition] = useTransition();

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
    <div className="flex gap-4 rounded-lg border border-border p-4">
      <div className="h-20 w-20 shrink-0 overflow-hidden rounded-md bg-muted">
        {item.product.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element -- supplier image domains are dynamic
          <img src={item.product.imageUrl} alt="" className="h-full w-full object-cover" />
        )}
      </div>

      <div className="flex flex-1 flex-col justify-between">
        <div>
          <Link href={`/products/${item.product.id}`} className="font-medium hover:underline">
            {item.product.name}
          </Link>
        </div>
        <div className="flex items-center gap-3">
          <Input
            type="number"
            min={item.product.minOrderQty}
            value={item.quantity}
            onChange={(e) => setQuantity(Math.max(0, Number(e.target.value) || 0))}
            className="w-20"
            disabled={isPending}
          />
          <Button variant="ghost" size="icon" onClick={remove} disabled={isPending} aria-label="Verwijderen">
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      <div className="text-right font-medium">
        {formatPriceCents(item.product.priceCents * item.quantity, item.product.currency)}
      </div>
    </div>
  );
}
