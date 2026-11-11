import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { settings } from "@/db/schema";

/**
 * Shipping rules the admin configures at /admin/settings. Orders whose
 * subtotal (excl. VAT) reaches the threshold ship for free; below it the
 * admin still determines the shipping cost per order when invoicing.
 */
export type ShippingSettings = {
  /** null = free shipping is switched off. */
  freeShippingThresholdCents: number | null;
};

export const DEFAULT_SHIPPING_SETTINGS: ShippingSettings = {
  freeShippingThresholdCents: 150000,
};

const SHIPPING_KEY = "shipping";

export async function getShippingSettings(): Promise<ShippingSettings> {
  const db = getDb();
  const row = await db.query.settings.findFirst({ where: eq(settings.key, SHIPPING_KEY) });
  if (!row?.value || typeof row.value !== "object") return DEFAULT_SHIPPING_SETTINGS;

  const threshold = (row.value as Partial<ShippingSettings>).freeShippingThresholdCents;
  return {
    freeShippingThresholdCents:
      threshold === null
        ? null
        : Number.isFinite(threshold) && Number(threshold) > 0
          ? Math.round(Number(threshold))
          : DEFAULT_SHIPPING_SETTINGS.freeShippingThresholdCents,
  };
}

export async function saveShippingSettings(value: ShippingSettings): Promise<void> {
  const db = getDb();
  await db
    .insert(settings)
    .values({ key: SHIPPING_KEY, value, updatedAt: new Date() })
    .onConflictDoUpdate({ target: settings.key, set: { value, updatedAt: new Date() } });
}

export function qualifiesForFreeShipping(
  subtotalCents: number,
  { freeShippingThresholdCents }: ShippingSettings,
): boolean {
  return freeShippingThresholdCents != null && subtotalCents >= freeShippingThresholdCents;
}
