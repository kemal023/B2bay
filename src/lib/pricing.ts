import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { settings } from "@/db/schema";

/**
 * Customer-specific prices. Two kinds of discount, applied on top of each
 * other to the list price (products.priceCents):
 *
 * - a fixed percentage per company (a price agreement, set by the admin);
 * - volume tiers per order line, the same for everyone (e.g. 3% from 10 pcs).
 *
 * Every price a customer sees or pays goes through unitPriceCents(), so the
 * product page, the cart and the order can never disagree.
 */

export type VolumeTier = { minQty: number; percent: number };

export type PricingContext = {
  companyDiscountPercent: number;
  tiers: VolumeTier[];
};

export const NO_DISCOUNT: PricingContext = { companyDiscountPercent: 0, tiers: [] };

const TIERS_KEY = "volume_tiers";

export async function getVolumeTiers(): Promise<VolumeTier[]> {
  const db = getDb();
  const row = await db.query.settings.findFirst({ where: eq(settings.key, TIERS_KEY) });
  return parseTiers((row?.value as { tiers?: unknown } | undefined)?.tiers);
}

export async function saveVolumeTiers(tiers: VolumeTier[]): Promise<void> {
  const value = { tiers: parseTiers(tiers) };
  await getDb()
    .insert(settings)
    .values({ key: TIERS_KEY, value, updatedAt: new Date() })
    .onConflictDoUpdate({ target: settings.key, set: { value, updatedAt: new Date() } });
}

/** Valid tiers only, sorted by quantity; one tier per quantity. */
export function parseTiers(value: unknown): VolumeTier[] {
  if (!Array.isArray(value)) return [];
  const byQty = new Map<number, number>();
  for (const t of value) {
    const minQty = Math.floor(Number((t as VolumeTier)?.minQty));
    const percent = Number((t as VolumeTier)?.percent);
    if (minQty >= 2 && percent > 0 && percent < 100) byQty.set(minQty, Math.round(percent * 100) / 100);
  }
  return [...byQty].map(([minQty, percent]) => ({ minQty, percent })).sort((a, b) => a.minQty - b.minQty);
}

/** The pricing that applies to this company (or to staff/guests: tiers only). */
export async function getPricingContext(
  company: { discountPercent: number | string | null } | null | undefined,
): Promise<PricingContext> {
  return {
    companyDiscountPercent: Number(company?.discountPercent ?? 0) || 0,
    tiers: await getVolumeTiers(),
  };
}

export function tierPercent(quantity: number, tiers: VolumeTier[]): number {
  let percent = 0;
  for (const t of tiers) if (quantity >= t.minQty) percent = t.percent;
  return percent;
}

/** Price per unit for this customer at this line quantity, in cents. */
export function unitPriceCents(listPriceCents: number, quantity: number, ctx: PricingContext): number {
  const factor = (1 - ctx.companyDiscountPercent / 100) * (1 - tierPercent(quantity, ctx.tiers) / 100);
  return Math.round(listPriceCents * factor);
}
