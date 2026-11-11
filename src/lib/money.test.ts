import { describe, expect, it } from "vitest";
import { computeInvoiceTotals, invoiceDueDate } from "@/lib/invoicing";
import { parseTiers, tierPercent, unitPriceCents } from "@/lib/pricing";
import { qualifiesForFreeShipping } from "@/lib/shipping";

describe("computeInvoiceTotals", () => {
  it("applies VAT to goods and shipping together", () => {
    expect(computeInvoiceTotals(10000, 1250, 21)).toEqual({
      subtotalCents: 10000,
      shippingCents: 1250,
      netCents: 11250,
      vatCents: 2363, // 2362.5 rounds up
      vatRatePercent: 21,
      totalCents: 13613,
    });
  });

  it("adds no VAT under reverse charge", () => {
    const t = computeInvoiceTotals(10000, 0, 0);
    expect(t.vatCents).toBe(0);
    expect(t.totalCents).toBe(10000);
  });
});

describe("invoiceDueDate", () => {
  it("adds the payment term in days", () => {
    const due = invoiceDueDate(new Date("2026-01-25T10:00:00Z"), 14);
    expect(due.toISOString().slice(0, 10)).toBe("2026-02-08");
  });
});

describe("volume tiers", () => {
  const tiers = parseTiers([
    { minQty: 50, percent: 5 },
    { minQty: 10, percent: 3 },
    { minQty: 1, percent: 9 }, // below 2: ignored
    { minQty: 20, percent: 0 }, // no discount: ignored
    { minQty: 10, percent: 4 }, // duplicate quantity: last wins
  ]);

  it("keeps valid tiers only, sorted", () => {
    expect(tiers).toEqual([
      { minQty: 10, percent: 4 },
      { minQty: 50, percent: 5 },
    ]);
  });

  it("picks the highest tier reached", () => {
    expect(tierPercent(9, tiers)).toBe(0);
    expect(tierPercent(10, tiers)).toBe(4);
    expect(tierPercent(500, tiers)).toBe(5);
  });

  it("stacks a company agreement and a tier", () => {
    const ctx = { companyDiscountPercent: 10, tiers };
    expect(unitPriceCents(1000, 1, ctx)).toBe(900);
    expect(unitPriceCents(1000, 10, ctx)).toBe(864); // 1000 × 0.9 × 0.96
    expect(unitPriceCents(1000, 60, ctx)).toBe(855);
  });

  it("is the list price without any discount", () => {
    expect(unitPriceCents(1234, 100, { companyDiscountPercent: 0, tiers: [] })).toBe(1234);
  });
});

describe("free shipping", () => {
  it("starts at the threshold, inclusive", () => {
    const s = { freeShippingThresholdCents: 150000 };
    expect(qualifiesForFreeShipping(149999, s)).toBe(false);
    expect(qualifiesForFreeShipping(150000, s)).toBe(true);
  });

  it("never applies when switched off", () => {
    expect(qualifiesForFreeShipping(10_000_000, { freeShippingThresholdCents: null })).toBe(false);
  });
});
