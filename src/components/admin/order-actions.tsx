"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  cancelOrder,
  createCreditNote,
  invoiceOrder,
  markOrderFulfilled,
  markOrderPaid,
} from "@/lib/actions/admin-orders";
import { Ban, CheckCircle2, FileMinus, FileText, Loader2, Send, Truck } from "lucide-react";
import { CARRIERS } from "@/lib/shipping-carriers";

export function InvoiceForm({
  orderId,
  freeShipping,
  vatPreview,
}: {
  orderId: string;
  /** Placed above the free-shipping threshold: shipping is prefilled at 0. */
  freeShipping: boolean;
  vatPreview: { text: string; warning: boolean };
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
      <p
        className={`mt-3 rounded-md px-3 py-2 text-xs ${
          vatPreview.warning
            ? "bg-amber-500/10 text-amber-700 dark:text-amber-400"
            : "bg-muted text-muted-foreground"
        }`}
      >
        {vatPreview.text}
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
      {status !== "cancelled" && status !== "fulfilled" && (
        <Button size="sm" variant="outline" onClick={() => run(cancelOrder)} disabled={isPending}>
          <Ban className="h-4 w-4" /> Annuleren
        </Button>
      )}
    </div>
  );
}

/** Marks the order as shipped; carrier and tracking code end up in the customer's mail. */
export function ShipOrderForm({ orderId }: { orderId: string }) {
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await markOrderFulfilled(orderId, formData);
      if (result.ok) toast.success("Gemarkeerd als verzonden");
      else toast.error(result.error);
    });
  }

  return (
    <section className="rounded-xl border border-border p-5">
      <h3 className="flex items-center gap-2 text-sm font-semibold">
        <Truck className="h-4 w-4 text-muted-foreground" />
        Verzenden
      </h3>
      <p className="mt-1 text-xs text-muted-foreground">
        De klant krijgt een mail met de trackinglink. Trackingcode is optioneel.
      </p>
      <form action={handleSubmit} className="mt-4 space-y-4">
        <div className="space-y-2">
          <Label htmlFor="carrier">Vervoerder</Label>
          <select
            id="carrier"
            name="carrier"
            defaultValue="postnl"
            className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30 [&>option]:bg-popover [&>option]:text-popover-foreground"
          >
            {CARRIERS.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="trackingCode">Trackingcode</Label>
          <Input id="trackingCode" name="trackingCode" placeholder="3SABCD1234567" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="trackingUrl">Trackinglink (alleen bij &quot;Anders&quot;)</Label>
          <Input id="trackingUrl" name="trackingUrl" type="url" placeholder="https://…" />
        </div>
        <Button type="submit" disabled={isPending} className="w-full">
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Truck className="h-4 w-4" />}
          Markeer als verzonden
        </Button>
      </form>
    </section>
  );
}

/** Credit (part of) an invoiced order; the remaining creditable amount is the default. */
export function CreditNoteForm({ orderId, maxNetCents }: { orderId: string; maxNetCents: number }) {
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await createCreditNote(orderId, formData);
      if (result.ok) toast.success("Creditnota aangemaakt en naar de klant gemaild");
      else toast.error(result.error);
    });
  }

  return (
    <form action={handleSubmit} className="mt-4 space-y-3 border-t border-border pt-4">
      <p className="text-xs text-muted-foreground">
        Nieuwe creditnota — nog maximaal {(maxNetCents / 100).toFixed(2).replace(".", ",")} euro excl. btw.
        De btw volgt de oorspronkelijke factuur.
      </p>
      <div className="space-y-2">
        <Label htmlFor="amountEuro">Bedrag excl. btw (€)</Label>
        <Input
          id="amountEuro"
          name="amountEuro"
          type="number"
          step="0.01"
          min="0.01"
          max={maxNetCents / 100}
          defaultValue={(maxNetCents / 100).toFixed(2)}
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="reason">Reden (staat op de creditnota)</Label>
        <Input id="reason" name="reason" placeholder="Retour: 2 stuks beschadigd" required />
      </div>
      <Button type="submit" variant="outline" disabled={isPending} className="w-full">
        {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileMinus className="h-4 w-4" />}
        Creditnota maken
      </Button>
    </form>
  );
}
