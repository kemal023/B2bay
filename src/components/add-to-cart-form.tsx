"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { addToCart } from "@/lib/actions/cart";
import { Loader2, ShoppingCart } from "lucide-react";

export function AddToCartForm({
  productId,
  minOrderQty,
  signedIn,
}: {
  productId: string;
  minOrderQty: number;
  signedIn: boolean;
}) {
  const [quantity, setQuantity] = useState(minOrderQty);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  if (!signedIn) {
    return (
      <Button onClick={() => router.push("/sign-up")} size="lg">
        Log in om te bestellen
      </Button>
    );
  }

  function handleAdd() {
    startTransition(async () => {
      const result = await addToCart(productId, quantity);
      if (result.ok) {
        toast.success("Toegevoegd aan winkelmandje");
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
      />
      <Button size="lg" onClick={handleAdd} disabled={isPending}>
        {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShoppingCart className="h-4 w-4" />}
        Toevoegen
      </Button>
    </div>
  );
}
