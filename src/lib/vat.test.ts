import { describe, expect, it } from "vitest";
import { countryName, normalizeVatNumber, vatNumberCountry, vatTreatmentFor } from "@/lib/vat";

describe("vatTreatmentFor", () => {
  const de = { country: "DE", vatNumber: "DE123456789", vatStatus: "valid" };

  it("reverse-charges a verified buyer in another EU country", () => {
    expect(vatTreatmentFor(de)).toBe("reverse_charge");
    expect(vatTreatmentFor(de, "BE")).toBe("reverse_charge");
  });

  it("charges Dutch VAT when the goods stay in the Netherlands", () => {
    expect(vatTreatmentFor(de, "NL")).toBe("domestic");
  });

  it("charges Dutch VAT to Dutch buyers, even shipping abroad", () => {
    expect(vatTreatmentFor({ country: "NL", vatNumber: "NL123456789B01", vatStatus: "valid" }, "BE")).toBe(
      "domestic",
    );
  });

  it("needs a VIES-confirmed number from the buyer's own country", () => {
    expect(vatTreatmentFor({ ...de, vatStatus: "unverified" })).toBe("domestic");
    expect(vatTreatmentFor({ ...de, vatStatus: "invalid" })).toBe("domestic");
    expect(vatTreatmentFor({ ...de, vatNumber: null })).toBe("domestic");
    expect(vatTreatmentFor({ ...de, vatNumber: "FR12345678901" })).toBe("domestic");
  });

  it("treats Greece's EL prefix as GR", () => {
    expect(vatTreatmentFor({ country: "GR", vatNumber: "EL123456789", vatStatus: "valid" })).toBe("reverse_charge");
  });
});

describe("VAT number helpers", () => {
  it("normalises spacing, dots and case", () => {
    expect(normalizeVatNumber("de 123.456-789")).toBe("DE123456789");
  });

  it("maps a number to its country", () => {
    expect(vatNumberCountry("NL123456789B01")).toBe("NL");
    expect(vatNumberCountry("EL123")).toBe("GR");
    expect(vatNumberCountry("XX123")).toBeNull();
    expect(vatNumberCountry(null)).toBeNull();
  });

  it("names countries in the visitor's language", () => {
    expect(countryName("DE", "nl")).toBe("Duitsland");
    expect(countryName("DE", "en")).toBe("Germany");
    expect(countryName("DE", "de")).toBe("Deutschland");
    expect(countryName("DE", "fr")).toBe("Allemagne");
  });
});
