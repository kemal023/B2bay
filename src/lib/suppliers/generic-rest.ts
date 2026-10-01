import type { NormalizedProduct, SupplierAdapter, SupplierRow } from "./types";
import { buildAuthHeaders } from "./types";

/** Reads a dotted path like "data.products" or "price.amount" off an object. */
function getPath(obj: unknown, path: string): unknown {
  if (!path) return obj;
  return path
    .split(".")
    .reduce<unknown>(
      (acc, key) =>
        acc && typeof acc === "object" ? (acc as Record<string, unknown>)[key] : undefined,
      obj,
    );
}

function toNumber(value: unknown, fallback = 0): number {
  const n = typeof value === "string" ? Number(value) : value;
  return typeof n === "number" && Number.isFinite(n) ? n : fallback;
}

export type GenericRestConfig = {
  /** Path to the array of products in the response body. Empty = root array. */
  itemsPath?: string;
  /** Field name (or dotted path) mappings, relative to each item. */
  fields?: {
    sku?: string;
    /** Barcode field (EAN/UPC), if the supplier provides one. */
    ean?: string;
    name?: string;
    description?: string;
    imageUrl?: string;
    category?: string;
    unit?: string;
    /** Cost price field (what the supplier charges us) — not the customer's price. Assumed to already be in cents unless priceIsDecimal is true. */
    price?: string;
    priceIsDecimal?: boolean;
    currency?: string;
    stock?: string;
    minOrderQty?: string;
  };
  /** Extra query params appended to baseUrl, e.g. { format: "json" }. */
  query?: Record<string, string>;
};

/**
 * A configurable adapter for any upstream that returns a JSON array (or an
 * array nested under a path) of product objects. This is what powers
 * "add a new supplier from the admin UI without shipping code" — the
 * supplier's `config` column holds a GenericRestConfig.
 */
export const genericRestAdapter: SupplierAdapter = {
  async fetchProducts(supplier: SupplierRow): Promise<NormalizedProduct[]> {
    const config = (supplier.config ?? {}) as GenericRestConfig;
    const url = new URL(supplier.baseUrl);
    for (const [key, value] of Object.entries(config.query ?? {})) {
      url.searchParams.set(key, value);
    }

    const res = await fetch(url.toString(), {
      headers: {
        Accept: "application/json",
        ...buildAuthHeaders(supplier),
      },
      // Supplier catalogs change slowly; avoid hammering upstream on every sync.
      cache: "no-store",
    });

    if (!res.ok) {
      throw new Error(
        `Supplier "${supplier.name}" responded ${res.status} ${res.statusText}`,
      );
    }

    const body = await res.json();
    const rawItems = config.itemsPath ? getPath(body, config.itemsPath) : body;
    if (!Array.isArray(rawItems)) {
      throw new Error(
        `Supplier "${supplier.name}": expected an array at itemsPath "${config.itemsPath ?? "(root)"}"`,
      );
    }

    const f = config.fields ?? {};
    return rawItems.map((item): NormalizedProduct => {
      const rawPrice = toNumber(getPath(item, f.price ?? "price"));
      const costPriceCents = f.priceIsDecimal ? Math.round(rawPrice * 100) : Math.round(rawPrice);

      const ean = getPath(item, f.ean ?? "ean");

      return {
        supplierSku: String(getPath(item, f.sku ?? "sku") ?? ""),
        ean: ean ? String(ean) : undefined,
        name: String(getPath(item, f.name ?? "name") ?? "Onbekend product"),
        description: getPath(item, f.description ?? "description") as string | undefined,
        imageUrl: getPath(item, f.imageUrl ?? "imageUrl") as string | undefined,
        category: getPath(item, f.category ?? "category") as string | undefined,
        unit: (getPath(item, f.unit ?? "unit") as string | undefined) ?? "stuk",
        costPriceCents,
        currency: (getPath(item, f.currency ?? "currency") as string | undefined) ?? "EUR",
        stockQty: toNumber(getPath(item, f.stock ?? "stock")),
        minOrderQty: toNumber(getPath(item, f.minOrderQty ?? "minOrderQty"), 1),
      };
    });
  },
};
