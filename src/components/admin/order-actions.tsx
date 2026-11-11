"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  cancelOrder,
  invoiceOrder,
  markOrderFulfilled,
  markOrderPaid,
} from "@/lib/actions/admin-orders";
import { Ban, CheckCircle2, FileText, Loader2, Send } from "lucide-react";

export function InvoiceForm({
  orderId,
  freeShipping,
}: {
  orderId: string;
  /** Placed above the free-shipping threshold: shipping is prefilled at 0. */
  freeShipping: boolean;
}) {
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await invoiceOrder(orderId, formData);
      if (result.ok) toast.success("Factuur gemarkeerd als verstuurd");
      else toast.error(result.error);
    });
  }

  return (
    <section className="rounded-xl border border-border p-5">
      <h3 className="flex items-center gap-2 text-sm font-semibold">
        <FileText className="h-4 w-4 text-muted-foreground" />
        Verzendkosten &amp; factuur
      </h3>
      <p className="mt-1 text-xs text-muted-foreground">
        Het factuurnummer en de btw worden automatisch toegevoegd.
      </p>
      <form action={handleSubmit} className="mt-4 space-y-4">
        <div className="space-y-2">
          <Label htmlFor="shippingEuro">Verzendkosten (€)</Label>
          <Input
            id="shippingEuro"
            name="shippingEuro"
            type="number"
            step="0.01"
            min="0"
            required
            defaultValue={freeShipping ? 0 : undefined}
          />
          {freeShipping && (
            <p className="text-xs text-emerald-600 dark:text-emerald-400">
              Gratis verzending: deze bestelling kwam boven het drempelbedrag uit.
            </p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="invoiceNotes">Notitie voor klant (optioneel)</Label>
          <Textarea id="invoiceNotes" name="invoiceNotes" rows={3} />
        </div>
        <Button type="submit" disabled={isPending} className="w-full">
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          Factuur aanmaken
        </Button>
      </form>
    </section>
  );
}

export function OrderStatusActions({ orderId, status }: { orderId: string; status: string }) {
  const [isPending, startTransition] = useTransition();

  function run(action: (id: string) => Promise<{ ok: boolean; error?: string }>) {
    startTransition(async () => {
      const result = await action(orderId);
      if (!result.ok) toast.error(result.error);
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
      {status === "invoiced" && (
        <Button size="sm" onClick={() => run(markOrderPaid)} disabled={isPending}>
          <CheckCircle2 className="h-4 w-4" /> Markeer als betaald
        </Button>
      )}
      {status === "paid" && (
        <Button size="sm" onClick={() => run(markOrderFulfilled)} disabled={isPending}>
          <CheckCircle2 className="h-4 w-4" /> Markeer als afgerond
        </Button>
      )}
      {status !== "cancelled" && status !== "fulfilled" && (
        <Button size="sm" variant="outline" onClick={() => run(cancelOrder)} disabled={isPending}>
          <Ban className="h-4 w-4" /> Annuleren
        </Button>
      )}
    </div>
  );
}
