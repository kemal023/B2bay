import type { Locale } from "@/lib/i18n/config";

/**
 * Picks the text a visitor sees for a product in their language. The
 * translation service (scripts/translate-catalog.mjs) fills English and Dutch
 * from the supplier text, then German and French from the English; until it
 * has, a field may still hold the supplier's raw text.
 *
 * The rule: never show a description in a language the visitor didn't ask
 * for unless it is English (readable fallback) — in particular never the raw
 * Polish. A missing description with a "being translated" note beats that.
 */

type NameFields = {
  name: string;
  nameNl: string | null;
  nameDe?: string | null;
  nameFr?: string | null;
};
type CategoryFields = {
  category: string | null;
  categoryNl: string | null;
  categoryDe?: string | null;
  categoryFr?: string | null;
};
type DescriptionFields = {
  description: string | null;
  descriptionNl: string | null;
  descriptionDe?: string | null;
  descriptionFr?: string | null;
  sourceLang: string | null;
  customized: boolean;
  descTrHash: string | null;
};

/** The translated value for the locale, else the English one. */
function pick<T>(locale: Locale, en: T, nl: T | null, de?: T | null, fr?: T | null): T {
  const translated = { en: null, nl, de: de ?? null, fr: fr ?? null }[locale];
  return translated ?? en;
}

export function localizedName(p: NameFields, locale: Locale): string {
  return pick(locale, p.name, p.nameNl, p.nameDe, p.nameFr);
}

export function localizedCategory(p: CategoryFields, locale: Locale): string | null {
  return pick(locale, p.category, p.categoryNl, p.categoryDe, p.categoryFr);
}

export function localizedDescription(
  p: DescriptionFields,
  locale: Locale,
): { text: string | null; pending: boolean } {
  if (p.descTrHash !== null) {
    const text = pick(locale, p.description, p.descriptionNl, p.descriptionDe, p.descriptionFr);
    return { text: text?.trim() ? text : null, pending: false };
  }

  // Not processed yet: only text that is already in a readable language.
  const text = p.description?.trim() ? p.description : null;
  if (!text) return { text: null, pending: false };
  if (p.sourceLang === locale) return { text, pending: false };
  // English is an acceptable stand-in until the translation is ready.
  if (p.customized || p.sourceLang === "en") return { text, pending: false };
  return { text: null, pending: true };
}

const UNITS: Record<string, Record<Locale, string>> = {
  stuk: { nl: "stuk", en: "piece", de: "Stück", fr: "pièce" },
  set: { nl: "set", en: "set", de: "Set", fr: "lot" },
  doos: { nl: "doos", en: "box", de: "Karton", fr: "boîte" },
};
const UNIT_ALIASES: Record<string, keyof typeof UNITS> = {
  stuk: "stuk",
  stuks: "stuk",
  pcs: "stuk",
  pc: "stuk",
  piece: "stuk",
  set: "set",
  doos: "doos",
  box: "doos",
};

/** Suppliers use different words for the same unit ("stuk", "pcs"). */
export function localizedUnit(unit: string, locale: Locale): string {
  const key = UNIT_ALIASES[unit.trim().toLowerCase()];
  return key ? UNITS[key][locale] : unit;
}
