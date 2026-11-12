import { describe, expect, it } from "vitest";
import { billingAsDelivery, deliveryFor } from "@/lib/delivery";
import { localizedDescription, localizedName, localizedUnit } from "@/lib/product-text";
import { parseQuickOrder } from "@/lib/quick-order";
import { trackingUrlFor } from "@/lib/shipping-carriers";
import { csvEuro, toCsv } from "@/lib/purchasing";

describe("parseQuickOrder", () => {
  it("reads codes with optional quantities in common separators", () => {
    expect(parseQuickOrder("5901234123457 12\n5901234123464; 6\nABC-123,24\n5901234123471\n  X9\t3  \n\n")).toEqual([
      { code: "5901234123457", quantity: 12 },
      { code: "5901234123464", quantity: 6 },
      { code: "ABC-123", quantity: 24 },
      { code: "5901234123471", quantity: 1 },
      { code: "X9", quantity: 3 },
    ]);
  });

  it("drops lines with quantity 0", () => {
    expect(parseQuickOrder("ABC 0")).toEqual([]);
  });
});

describe("product texts", () => {
  const p = {
    name: "Insulation tape",
    nameNl: "Isolatietape",
    nameDe: null,
    nameFr: "Ruban isolant",
  };

  it("shows the visitor's language, else English", () => {
    expect(localizedName(p, "nl")).toBe("Isolatietape");
    expect(localizedName(p, "fr")).toBe("Ruban isolant");
    expect(localizedName(p, "de")).toBe("Insulation tape");
    expect(localizedName(p, "en")).toBe("Insulation tape");
  });

  it("never shows an untranslated Polish description", () => {
    const polish = {
      description: "Samoprzylepna taśma",
      descriptionNl: null,
      sourceLang: "pl",
      customized: false,
      descTrHash: null,
    };
    expect(localizedDescription(polish, "nl")).toEqual({ text: null, pending: true });
    expect(localizedDescription(polish, "en")).toEqual({ text: null, pending: true });
  });

  it("uses English as a stand-in once the description is processed", () => {
    const done = {
      description: "Self-adhesive tape",
      descriptionNl: "Zelfklevende tape",
      descriptionDe: null,
      sourceLang: "pl",
      customized: false,
      descTrHash: "x",
    };
    expect(localizedDescription(done, "nl").text).toBe("Zelfklevende tape");
    expect(localizedDescription(done, "de").text).toBe("Self-adhesive tape");
  });

  it("maps supplier unit words", () => {
    expect(localizedUnit("pcs", "nl")).toBe("stuk");
    expect(localizedUnit("Stuks", "de")).toBe("Stück");
    expect(localizedUnit("pallet", "fr")).toBe("pallet");
  });
});

describe("delivery address", () => {
  const company = { name: "Acme", addressLine: "Straat 1", postalCode: "1234 AB", city: "Utrecht", country: "NL" };

  it("falls back to the billing address", () => {
    expect(deliveryFor({ deliveryAddress: null, company })?.city).toBe("Utrecht");
  });

  it("uses the order's own address when set", () => {
    const own = { ...billingAsDelivery(company)!, city: "Antwerpen", country: "BE" };
    expect(deliveryFor({ deliveryAddress: own, company })?.country).toBe("BE");
  });

  it("has none when the company has no address", () => {
    expect(billingAsDelivery({ ...company, addressLine: null })).toBeNull();
  });
});

describe("tracking links", () => {
  it("includes destination for PostNL", () => {
    expect(trackingUrlFor("postnl", "3SABC", { country: "BE", postalCode: "1000" })).toBe(
      "https://jouw.postnl.nl/track-and-trace/3SABC-BE-1000",
    );
  });

  it("has no link for an unknown carrier", () => {
    expect(trackingUrlFor("other", "X")).toBeNull();
  });
});

describe("CSV export", () => {
  it("is Excel-friendly: BOM, semicolons, quoting, decimal comma", () => {
    expect(toCsv([["a;b", 'say "hi"', null, 3]])).toBe('﻿"a;b";"say ""hi""";;3\r\n');
    expect(csvEuro(123456)).toBe("1234,56");
    expect(csvEuro(-500)).toBe("-5,00");
    expect(csvEuro(null)).toBe("");
  });
});

describe("shop categories", () => {
  it("knows its tree and rejects places outside it", async () => {
    const { parseShopCategory } = await import("@/lib/shop-category");
    expect(parseShopCategory("tools/power-tools")).toEqual({ main: "tools", sub: "power-tools" });
    expect(parseShopCategory("tools")).toEqual({ main: "tools", sub: null });
    expect(parseShopCategory("tools/baby")).toBeNull(); // baby belongs to toys
    expect(parseShopCategory("nonsense")).toBeNull();
  });

  it("labels every category in all four languages", async () => {
    const { TAXONOMY } = await import("@/lib/taxonomy.mjs");
    const slugs = new Set<string>();
    for (const m of TAXONOMY) {
      for (const node of [m, ...m.subs]) {
        for (const l of ["nl", "en", "de", "fr"] as const) expect(node.labels[l]).toBeTruthy();
        expect(slugs.has(node.slug)).toBe(false);
        slugs.add(node.slug);
      }
    }
  });

  it("seeds only valid places", async () => {
    const { SEED } = await import("../../scripts/category-seed.mjs");
    const { isMainSlug, isSubOf } = await import("@/lib/taxonomy.mjs");
    for (const paths of Object.values(SEED) as Record<string, [string, string | null]>[]) {
      for (const [path, [main, sub]] of Object.entries(paths)) {
        expect(isMainSlug(main), path).toBe(true);
        if (sub) expect(isSubOf(sub, main), path).toBe(true);
      }
    }
  });
});
