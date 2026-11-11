import { describe, expect, it } from "vitest";
import { isLikelyPolish, rejectReason } from "@/lib/translation-guard.mjs";

describe("translation guard", () => {
  it("accepts a faithful translation", () => {
    expect(
      rejectReason("Taśma izolacyjna 20m PVC (H5394899)", "Insulating tape 20m PVC (H5394899)", { minRatio: 0.45 }),
    ).toBeNull();
  });

  it("rejects a translation that lost a product code", () => {
    expect(rejectReason("Pompa TPB1102 do wody", "Water pump", { minRatio: 0.45 })).not.toBeNull();
    expect(rejectReason("Klucz XK-A9 płaski", "Flat wrench", { minRatio: 0.45 })).not.toBeNull();
  });

  it("does not mistake a word glued to a voltage for a code", () => {
    // Regression: "ELEKTROIZOL.7000V" used to be treated as one product code,
    // so every sentence with it was rejected and the description left empty.
    expect(
      rejectReason("TAŚMA ELEKTROIZOL.7000V PCW 20M", "ELECTROIZOL.7000V PVC TAPE 20M", { minRatio: 0.45 }),
    ).toBeNull();
  });

  it("rejects a translation that is far too short", () => {
    expect(rejectReason("Występuje w kolorze białym, idealny do pracy w warsztacie.", "White.", { minRatio: 0.45 })).toBe(
      "te-kort",
    );
  });

  it("recognises Polish", () => {
    expect(isLikelyPolish("Samoprzylepna taśma o właściwościach ochronnych")).toBe(true);
    expect(isLikelyPolish("Self-adhesive tape with protective properties")).toBe(false);
  });
});
