/**
 * VAT for cross-border B2B sales inside the EU.
 *
 * - Buyer in the seller's own country: the normal (domestic) rate.
 * - Buyer in another EU country with a VAT number that VIES confirms as
 *   valid: an intra-community supply at 0%, VAT reverse-charged to the
 *   buyer (art. 138 of Directive 2006/112/EC). The invoice must say so and
 *   show both VAT numbers.
 * - Buyer in another EU country without a valid VAT number: domestic rate.
 *
 * Whether a particular sale qualifies (e.g. proof of transport) is the
 * seller's responsibility; this only applies the standard rule.
 */

import { intlLocale, type Locale } from "@/lib/i18n/config";

/** EU member states by ISO code, with the prefix VIES uses (Greece is EL). */
export const EU_COUNTRIES = [
  { code: "AT", vies: "AT", nl: "Oostenrijk", en: "Austria" },
  { code: "BE", vies: "BE", nl: "België", en: "Belgium" },
  { code: "BG", vies: "BG", nl: "Bulgarije", en: "Bulgaria" },
  { code: "HR", vies: "HR", nl: "Kroatië", en: "Croatia" },
  { code: "CY", vies: "CY", nl: "Cyprus", en: "Cyprus" },
  { code: "CZ", vies: "CZ", nl: "Tsjechië", en: "Czechia" },
  { code: "DK", vies: "DK", nl: "Denemarken", en: "Denmark" },
  { code: "EE", vies: "EE", nl: "Estland", en: "Estonia" },
  { code: "FI", vies: "FI", nl: "Finland", en: "Finland" },
  { code: "FR", vies: "FR", nl: "Frankrijk", en: "France" },
  { code: "DE", vies: "DE", nl: "Duitsland", en: "Germany" },
  { code: "GR", vies: "EL", nl: "Griekenland", en: "Greece" },
  { code: "HU", vies: "HU", nl: "Hongarije", en: "Hungary" },
  { code: "IE", vies: "IE", nl: "Ierland", en: "Ireland" },
  { code: "IT", vies: "IT", nl: "Italië", en: "Italy" },
  { code: "LV", vies: "LV", nl: "Letland", en: "Latvia" },
  { code: "LT", vies: "LT", nl: "Litouwen", en: "Lithuania" },
  { code: "LU", vies: "LU", nl: "Luxemburg", en: "Luxembourg" },
  { code: "MT", vies: "MT", nl: "Malta", en: "Malta" },
  { code: "NL", vies: "NL", nl: "Nederland", en: "Netherlands" },
  { code: "PL", vies: "PL", nl: "Polen", en: "Poland" },
  { code: "PT", vies: "PT", nl: "Portugal", en: "Portugal" },
  { code: "RO", vies: "RO", nl: "Roemenië", en: "Romania" },
  { code: "SK", vies: "SK", nl: "Slowakije", en: "Slovakia" },
  { code: "SI", vies: "SI", nl: "Slovenië", en: "Slovenia" },
  { code: "ES", vies: "ES", nl: "Spanje", en: "Spain" },
  { code: "SE", vies: "SE", nl: "Zweden", en: "Sweden" },
] as const;

export type CountryCode = (typeof EU_COUNTRIES)[number]["code"];

export const SELLER_COUNTRY: CountryCode = "NL";

export function isEuCountry(code: string | null | undefined): code is CountryCode {
  return EU_COUNTRIES.some((c) => c.code === code);
}

export function countryName(code: string | null | undefined, locale: Locale = "nl"): string {
  const c = EU_COUNTRIES.find((x) => x.code === code);
  if (!c) return code ?? "";
  if (locale === "nl" || locale === "en") return c[locale];
  try {
    return new Intl.DisplayNames([intlLocale(locale)], { type: "region" }).of(c.code) ?? c.en;
  } catch {
    return c.en;
  }
}

/** "de 123.456.789" → "DE123456789". */
export function normalizeVatNumber(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export type VatStatus = "unverified" | "valid" | "invalid";
export type ViesResult = { status: "valid" | "invalid"; name: string | null } | { status: "unavailable" };

/**
 * Checks a VAT number against the EU's VIES service. "unavailable" means the
 * member state's service didn't answer, which happens regularly — never
 * treat that as invalid.
 */
export async function checkVies(vatNumber: string): Promise<ViesResult> {
  const vat = normalizeVatNumber(vatNumber);
  const prefix = vat.slice(0, 2);
  if (!EU_COUNTRIES.some((c) => c.vies === prefix) || vat.length < 4) {
    return { status: "invalid", name: null };
  }

  try {
    const res = await fetch(
      `https://ec.europa.eu/taxation_customs/vies/rest-api/ms/${prefix}/vat/${encodeURIComponent(vat.slice(2))}`,
      { signal: AbortSignal.timeout(10_000), cache: "no-store" },
    );
    if (!res.ok) return { status: "unavailable" };
    const body = (await res.json()) as { isValid?: boolean; userError?: string; name?: string };
    if (body.isValid) {
      const name = body.name && body.name !== "---" ? body.name.trim() : null;
      return { status: "valid", name };
    }
    return body.userError === "INVALID" ? { status: "invalid", name: null } : { status: "unavailable" };
  } catch {
    return { status: "unavailable" };
  }
}

/** The country a VAT number belongs to, by its prefix (EL → GR). */
export function vatNumberCountry(vatNumber: string | null | undefined): CountryCode | null {
  if (!vatNumber) return null;
  const prefix = normalizeVatNumber(vatNumber).slice(0, 2);
  return EU_COUNTRIES.find((c) => c.vies === prefix)?.code ?? null;
}

export type VatTreatment = "domestic" | "reverse_charge";

export type BuyerVatInfo = {
  country: string | null;
  vatNumber: string | null;
  /** A VatStatus; typed loosely because it comes straight from a text column. */
  vatStatus: string;
};

/**
 * Reverse charge only when the buyer is established in another EU country,
 * its VAT number (issued by that same country) is confirmed valid, and the
 * goods actually leave the seller's country: a foreign buyer having goods
 * delivered inside the Netherlands pays Dutch VAT.
 *
 * @param destination Delivery country; defaults to the buyer's own country.
 */
export function vatTreatmentFor(buyer: BuyerVatInfo, destination?: string | null): VatTreatment {
  const to = destination ?? buyer.country;
  const crossBorder =
    isEuCountry(buyer.country) &&
    buyer.country !== SELLER_COUNTRY &&
    isEuCountry(to) &&
    to !== SELLER_COUNTRY;
  const vatMatchesCountry = vatNumberCountry(buyer.vatNumber) === buyer.country;
  return crossBorder && vatMatchesCountry && buyer.vatStatus === "valid" ? "reverse_charge" : "domestic";
}

/** A VIES confirmation is reused for this long before invoicing checks again. */
export const VIES_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
