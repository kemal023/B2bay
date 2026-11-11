/** Carriers with a public tracking page we can link to straight from the order. */
export const CARRIERS = [
  { id: "postnl", name: "PostNL" },
  { id: "dhl", name: "DHL" },
  { id: "dpd", name: "DPD" },
  { id: "gls", name: "GLS" },
  { id: "ups", name: "UPS" },
  { id: "other", name: "Anders" },
] as const;

export type CarrierId = (typeof CARRIERS)[number]["id"];

export function carrierName(id: string | null | undefined): string | null {
  if (!id) return null;
  return CARRIERS.find((c) => c.id === id)?.name ?? id;
}

/**
 * Tracking link for a known carrier. PostNL needs the destination country and
 * postal code as well; without them it falls back to its generic search.
 */
export function trackingUrlFor(
  carrier: string,
  code: string,
  destination?: { country?: string | null; postalCode?: string | null },
): string | null {
  const c = encodeURIComponent(code.trim());
  if (!c) return null;
  switch (carrier) {
    case "postnl": {
      const country = destination?.country ?? "NL";
      const postal = (destination?.postalCode ?? "").replace(/\s+/g, "").toUpperCase();
      return postal
        ? `https://jouw.postnl.nl/track-and-trace/${c}-${country}-${encodeURIComponent(postal)}`
        : `https://jouw.postnl.nl/track-and-trace/${c}`;
    }
    case "dhl":
      return `https://www.dhl.com/nl-nl/home/tracking.html?tracking-id=${c}`;
    case "dpd":
      return `https://tracking.dpd.de/status/nl_NL/parcel/${c}`;
    case "gls":
      return `https://gls-group.com/NL/nl/volg-je-pakket?match=${c}`;
    case "ups":
      return `https://www.ups.com/track?tracknum=${c}`;
    default:
      return null;
  }
}
