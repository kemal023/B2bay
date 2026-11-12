/**
 * One product (same EAN) offered by more than one supplier is listed once,
 * bought where it's cheapest. Decides whether the supplier being synced
 * takes the listing over from whoever has it now.
 */
export type CurrentListing = {
  supplierId: string | null;
  costPriceCents: number | null;
  stockQty: number;
  active: boolean;
};

export function takesOverListing(
  current: CurrentListing,
  offer: { supplierId: string; costPriceCents: number; stockQty: number },
): boolean {
  // Its own listing: always refreshed.
  if (current.supplierId === offer.supplierId) return true;
  // A product the shop added by hand stays the shop's.
  if (current.supplierId === null) return false;
  // The current supplier dropped it, or can't deliver while this one can.
  if (!current.active) return true;
  const hasStock = offer.stockQty > 0;
  if (current.stockQty <= 0 && hasStock) return true;
  // Strictly cheaper and deliverable; a tie stays put so nothing flip-flops.
  return hasStock && current.costPriceCents != null && offer.costPriceCents < current.costPriceCents;
}
