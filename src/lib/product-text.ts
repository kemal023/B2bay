import type { Locale } from "@/lib/i18n/config";

/**
 * Picks the text a visitor sees for a product in their language. The
 * translation service (scripts/translate-catalog.mjs) fills the English and
 * Dutch columns; until it has, a field may still hold the supplier's raw text.
 *
 * The rule: never show a description in a language the visitor didn't ask
 * for unless it is English (readable fallback) — in particular never the raw
 * Polish. A missing description with a "being translated" note beats that.
 */

type NameFields = { name: string; nameNl: string | null };
type CategoryFields = { category: string | null; categoryNl: string | null };
type DescriptionFields = {
  description: string | null;
  descriptionNl: string | null;
  sourceLang: string | null;
  customized: boolean;
  descTrHash: string | null;
};

export function localizedName(p: NameFields, locale: Locale): string {
  return locale === "nl" ? (p.nameNl ?? p.name) : p.name;
}

export function localizedCategory(p: CategoryFields, locale: Locale): string | null {
  return locale === "nl" ? (p.categoryNl ?? p.category) : p.category;
}

export function localizedDescription(
  p: DescriptionFields,
  locale: Locale,
): { text: string | null; pending: boolean } {
  if (p.descTrHash !== null) {
    const text = locale === "nl" ? (p.descriptionNl ?? p.description) : p.description;
    return { text: text?.trim() ? text : null, pending: false };
  }

  // Not processed yet: only text that is already in a readable language.
  const text = p.description?.trim() ? p.description : null;
  if (!text) return { text: null, pending: false };
  if (p.sourceLang === locale) return { text, pending: false };
  // English is an acceptable stand-in until the Dutch version is ready.
  if (p.customized || p.sourceLang === "en") return { text, pending: false };
  return { text: null, pending: true };
}

const UNITS: Record<string, { nl: string; en: string }> = {
  stuk: { nl: "stuk", en: "piece" },
  stuks: { nl: "stuk", en: "piece" },
  pcs: { nl: "stuk", en: "piece" },
  pc: { nl: "stuk", en: "piece" },
  piece: { nl: "stuk", en: "piece" },
  set: { nl: "set", en: "set" },
  doos: { nl: "doos", en: "box" },
  box: { nl: "doos", en: "box" },
};

/** Suppliers use different words for the same unit ("stuk", "pcs"). */
export function localizedUnit(unit: string, locale: Locale): string {
  return UNITS[unit.trim().toLowerCase()]?.[locale] ?? unit;
}
