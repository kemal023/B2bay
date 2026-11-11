"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/components/i18n-provider";
import { EU_COUNTRIES } from "@/lib/vat";

export type BillingDefaults = {
  addressLine?: string | null;
  postalCode?: string | null;
  city?: string | null;
  country?: string | null;
  vatNumber?: string | null;
};

/** Address, country and VAT number — shared by onboarding and the admin company editor. */
export function BillingFields({ defaults = {} }: { defaults?: BillingDefaults }) {
  const { t, locale } = useI18n();
  const o = t.onboarding;
  const countries = [...EU_COUNTRIES].sort((a, b) => a[locale].localeCompare(b[locale], locale));

  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="addressLine">{o.address}</Label>
        <Input
          id="addressLine"
          name="addressLine"
          autoComplete="street-address"
          defaultValue={defaults.addressLine ?? ""}
          required
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-[1fr_2fr]">
        <div className="space-y-2">
          <Label htmlFor="postalCode">{o.postalCode}</Label>
          <Input
            id="postalCode"
            name="postalCode"
            autoComplete="postal-code"
            defaultValue={defaults.postalCode ?? ""}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="city">{o.city}</Label>
          <Input
            id="city"
            name="city"
            autoComplete="address-level2"
            defaultValue={defaults.city ?? ""}
            required
          />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="country">{o.country}</Label>
          <select
            id="country"
            name="country"
            defaultValue={defaults.country ?? "NL"}
            className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30 [&>option]:bg-popover [&>option]:text-popover-foreground"
          >
            {countries.map((c) => (
              <option key={c.code} value={c.code}>
                {c[locale]}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="vatNumber">{o.vat}</Label>
          <Input
            id="vatNumber"
            name="vatNumber"
            placeholder="NL123456789B01"
            defaultValue={defaults.vatNumber ?? ""}
          />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">{o.vatHint}</p>
    </>
  );
}
