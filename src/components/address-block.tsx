import type { DeliverySnapshot } from "@/lib/delivery";
import { countryName } from "@/lib/vat";

/** A delivery address as a few plain lines. */
export function AddressBlock({ address, locale = "nl" }: { address: DeliverySnapshot; locale?: "nl" | "en" }) {
  return (
    <address className="text-sm not-italic leading-relaxed">
      <div className="font-medium">{address.label}</div>
      {address.recipient && <div>{address.recipient}</div>}
      <div>{address.addressLine}</div>
      <div>
        {address.postalCode} {address.city}
      </div>
      <div>{countryName(address.country, locale)}</div>
      {address.phone && <div className="text-muted-foreground">{address.phone}</div>}
    </address>
  );
}
