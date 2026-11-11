"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { placeOrder } from "@/lib/actions/orders";
import { Loader2, Send } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";

export function PlaceOrderButton() {
  const [isPending, startTransition] = useTransition();
  const { t } = useI18n();

  function handleClick() {
    startTransition(async () => {
      const result = await placeOrder();
      // placeOrder redirects on success, so we only get here on failure.
      if (!result.ok) toast.error(result.error);
    });
  }

  return (
    <Button className="w-full" size="lg" onClick={handleClick} disabled={isPending}>
      {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
      {t.cart.placeOrder}
    </Button>
  );
}
