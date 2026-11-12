import type { suppliers } from "@/db/schema";

export type SupplierRow = typeof suppliers.$inferSelect;

/**
 * A product as normalized from any upstream supplier API. `costPriceCents`
 * is what the supplier charges us — never shown to customers and never the
 * same as our sell price (see lib/suppliers/sync.ts for how sell price is
 * derived and protected from being overwritten once an admin sets it).
 */
export type NormalizedProduct = {
  supplierSku: string;
  /** Barcode (EAN/UPC), when the supplier provides one. Used to link the
   * same physical product across suppliers instead of duplicating it. */
  ean?: string;
  name: string;
  description?: string;
  imageUrl?: string;
  category?: string;
  /** The supplier's category from the top down (["Tools", "Hand tools"]).
   * Mapped onto the shop's own tree; defaults to [category]. */
  categoryPath?: string[];
  unit?: string;
  costPriceCents: number;
  currency?: string;
  stockQty: number;
  minOrderQty?: number;
};

/**
 * A supplier adapter knows how to talk to one upstream API shape and
 * normalize its response into our internal product model. New supplier
 * *types* are registered here in code; new supplier *instances* (a specific
 * base URL + credentials) are added from the admin UI with no deploy.
 */
export interface SupplierAdapter {
  fetchProducts(supplier: SupplierRow): Promise<NormalizedProduct[]>;
}

export function buildAuthHeaders(supplier: SupplierRow): HeadersInit {
  switch (supplier.authType) {
    case "bearer":
      return supplier.credential
        ? { Authorization: `Bearer ${supplier.credential}` }
        : {};
    case "api_key_header":
      return supplier.credential ? { "X-Api-Key": supplier.credential } : {};
    case "basic":
      return supplier.credential
        ? { Authorization: `Basic ${Buffer.from(supplier.credential).toString("base64")}` }
        : {};
    case "none":
    default:
      return {};
  }
}
