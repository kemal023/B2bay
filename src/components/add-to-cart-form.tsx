"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { addToCart } from "@/lib/actions/cart";
import type { PriceAccess } from "@/lib/price-visibility";
import { useI18n } from "@/components/i18n-provider";
import { Loader2, ShoppingCart } from "lucide-react";

export function AddToCartForm({
  productId,
  minOrderQty,
  access,
}: {
  productId: string;
  minOrderQty: number;
  access: PriceAccess;
}) {
  const [quantity, setQuantity] = useState(minOrderQty);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const { t } = useI18n();

  if (access === "signed-out") {
    return (
      <Button onClick={() => router.push("/sign-up")} size="lg">
        {t.product.loginToOrder}
      </Button>
    );
  }

  if (access === "pending") {
    return (
      <Button size="lg" disabled className="w-full">
        {t.product.orderAfterApproval}
      </Button>
    );
  }

  function handleAdd() {
    startTransition(async () => {
      const result = await addToCart(productId, quantity);
      if (result.ok) {
        toast.success(t.product.added);
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <div className="flex items-center gap-3">
      <Input
        type="number"
        min={minOrderQty}
        step={1}
        value={quantity}
        onChange={(e) => setQuantity(Math.max(minOrderQty, Number(e.target.value) || minOrderQty))}
        className="w-24"
        aria-label={t.product.quantity}
      />
      <Button size="lg" onClick={handleAdd} disabled={isPending}>
        {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShoppingCart className="h-4 w-4" />}
        {t.product.add}
      </Button>
    </div>
  );
}
