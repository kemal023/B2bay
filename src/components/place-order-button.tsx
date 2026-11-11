"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { selectClassName } from "@/components/billing-fields";
import { placeOrder } from "@/lib/actions/orders";
import { Loader2, Send } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";

export type AddressOption = { id: string; label: string };

export function PlaceOrderButton({
  addresses = [],
  billingLabel,
}: {
  /** The company's saved delivery addresses; empty = deliver to billing address. */
  addresses?: AddressOption[];
  billingLabel?: string | null;
}) {
  const [isPending, startTransition] = useTransition();
  const [addressId, setAddressId] = useState("");
  const { t } = useI18n();

  function handleClick() {
    startTransition(async () => {
      const result = await placeOrder(addressId || null);
      // placeOrder redirects on success, so we only get here on failure.
      if (!result.ok) toast.error(result.error);
    });
  }

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="deliveryAddress" className="text-xs">
            {t.addresses.deliverTo}
          </Label>
          <Link href="/dashboard/addresses" className="text-xs text-muted-foreground underline-offset-2 hover:underline">
            {t.addresses.manage}
          </Link>
        </div>
        <select
          id="deliveryAddress"
          value={addressId}
          onChange={(e) => setAddressId(e.target.value)}
          className={selectClassName}
        >
          <option value="">
            {t.addresses.billing}
            {billingLabel ? ` — ${billingLabel}` : ""}
          </option>
          {addresses.map((a) => (
            <option key={a.id} value={a.id}>
              {a.label}
            </option>
          ))}
        </select>
      </div>
      <Button className="w-full" size="lg" onClick={handleClick} disabled={isPending}>
        {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        {t.cart.placeOrder}
      </Button>
    </div>
  );
}
