"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateShippingSettings } from "@/lib/actions/settings";
import type { ShippingSettings } from "@/lib/shipping";
import { Loader2, Save } from "lucide-react";

export function ShippingSettingsForm({ shipping }: { shipping: ShippingSettings }) {
  const [isPending, startTransition] = useTransition();
  const [enabled, setEnabled] = useState(shipping.freeShippingThresholdCents != null);

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await updateShippingSettings(formData);
      if (result.ok) toast.success(result.message);
      else toast.error(result.error);
    });
  }

  return (
    <form action={handleSubmit} className="space-y-6">
      <div>
        <h3 className="text-sm font-medium">Gratis verzending</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Bestellingen met een subtotaal (excl. btw) vanaf dit bedrag worden automatisch gratis
          verzonden. Daaronder bepaal je de verzendkosten zelf bij het factureren.
        </p>
      </div>

      <label className="flex w-fit items-center gap-2.5 text-sm">
        <input
          type="checkbox"
          name="freeShippingEnabled"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
          className="h-4 w-4 accent-primary"
        />
        Gratis verzending boven een drempelbedrag
      </label>

      <div className="max-w-xs space-y-2">
        <Label htmlFor="freeShippingThresholdEuro">Drempelbedrag (€, excl. btw)</Label>
        <Input
          id="freeShippingThresholdEuro"
          name="freeShippingThresholdEuro"
          type="number"
          step="0.01"
          min="0.01"
          disabled={!enabled}
          defaultValue={
            shipping.freeShippingThresholdCents != null
              ? shipping.freeShippingThresholdCents / 100
              : 1500
          }
        />
      </div>

      <div className="border-t border-border pt-6">
        <Button type="submit" disabled={isPending}>
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Opslaan
        </Button>
      </div>
    </form>
  );
}
