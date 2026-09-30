"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  cancelOrder,
  invoiceOrder,
  markOrderFulfilled,
  markOrderPaid,
} from "@/lib/actions/admin-orders";
import { Ban, CheckCircle2, Loader2, Send } from "lucide-react";

export function InvoiceForm({ orderId }: { orderId: string }) {
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await invoiceOrder(orderId, formData);
      if (result.ok) toast.success("Factuur gemarkeerd als verstuurd");
      else toast.error(result.error);
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Verzendkosten &amp; factuur</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="shippingEuro">Verzendkosten (€)</Label>
            <Input id="shippingEuro" name="shippingEuro" type="number" step="0.01" min="0" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="invoiceNumber">Factuurnummer</Label>
            <Input id="invoiceNumber" name="invoiceNumber" placeholder="2026-0001" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="invoiceNotes">Notitie voor klant (optioneel)</Label>
            <Textarea id="invoiceNotes" name="invoiceNotes" rows={3} />
          </div>
          <Button type="submit" disabled={isPending} className="w-full">
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Markeren als gefactureerd
          </Button>
        </form>
      </CardContent>
    </Card>
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
