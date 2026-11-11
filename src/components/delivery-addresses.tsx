"use client";

import { useRef, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CountrySelect } from "@/components/billing-fields";
import { useI18n } from "@/components/i18n-provider";
import { addDeliveryAddress, deleteDeliveryAddress } from "@/lib/actions/addresses";
import { Loader2, Plus, Trash2 } from "lucide-react";

export function AddDeliveryAddressForm() {
  const { t } = useI18n();
  const a = t.addresses;
  const o = t.onboarding;
  const formRef = useRef<HTMLFormElement>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <form
      ref={formRef}
      action={(formData) =>
        startTransition(async () => {
          const result = await addDeliveryAddress(formData);
          if (!result.ok) return void toast.error(result.error);
          toast.success(result.message);
          formRef.current?.reset();
        })
      }
      className="space-y-4"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="label">{a.label}</Label>
          <Input id="label" name="label" placeholder={a.labelPlaceholder} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="recipient">{a.recipient}</Label>
          <Input id="recipient" name="recipient" autoComplete="name" />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="addressLine">{o.address}</Label>
        <Input id="addressLine" name="addressLine" autoComplete="street-address" required />
      </div>
      <div className="grid gap-4 sm:grid-cols-[1fr_2fr]">
        <div className="space-y-2">
          <Label htmlFor="postalCode">{o.postalCode}</Label>
          <Input id="postalCode" name="postalCode" autoComplete="postal-code" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="city">{o.city}</Label>
          <Input id="city" name="city" autoComplete="address-level2" required />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="country">{o.country}</Label>
          <CountrySelect />
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone">{a.phone}</Label>
          <Input id="phone" name="phone" type="tel" autoComplete="tel" />
        </div>
      </div>
      <Button type="submit" disabled={isPending}>
        {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
        {a.add}
      </Button>
    </form>
  );
}

export function DeleteDeliveryAddressButton({ id }: { id: string }) {
  const { t } = useI18n();
  const [isPending, startTransition] = useTransition();
  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={isPending}
      aria-label={t.addresses.remove}
      onClick={() =>
        startTransition(async () => {
          const result = await deleteDeliveryAddress(id);
          if (result.ok) toast.success(result.message);
          else toast.error(result.error);
        })
      }
    >
      {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
    </Button>
  );
}
