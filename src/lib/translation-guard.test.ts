import { describe, expect, it } from "vitest";
import {
  inchesKept,
  isLikelyPolish,
  protectForForeign,
  rejectReason,
  restoreTerms,
  sentenceCase,
  untranslatedWords,
} from "@/lib/translation-guard.mjs";

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

describe("names into German and French", () => {
  it("lower-cases Title Case words but keeps brands, codes and the first word", () => {
    expect(sentenceCase('ET101 Notebook Bag 15.6" Classic Esperanza')).toBe('ET101 Notebook bag 15.6" classic Esperanza');
    expect(sentenceCase("Logic Game UFO Magic Capsule")).toBe("Logic game UFO magic capsule");
  });

  it("counts English words the translator skipped", () => {
    expect(untranslatedWords("Axe Handle 600g", "Axe Handle 600g")).toBe(2);
    expect(untranslatedWords("Axe Handle 600g", "Manche à hache 600g")).toBe(0);
    expect(untranslatedWords("Tracer Money Box", "Tracer Geldbox")).toBe(0); // brand doesn't count
  });

  it("protects inch sizes", () => {
    const p = protectForForeign('Notebook bag 15.6" and 3/4" socket');
    expect(p.text).not.toContain('"');
    expect(restoreTerms(p.text, p.originals)).toBe('Notebook bag 15.6" and 3/4" socket');
    expect(inchesKept('Bag 15.6"', "Tasche 15.6")).toBe(false);
  });

  it("rejects a mangled item number", () => {
    expect(rejectReason("Switch 12V amio-03839", "Interrupteur 12V ami-03839", { glossary: false })).toBe(
      "code-kwijt:amio-03839",
    );
  });
});
