/**
 * Storefront languages. The choice lives in a cookie rather than the URL, so
 * every page works in every language without a second set of routes. The
 * admin area and invoices stay Dutch on purpose (internal / legal documents).
 */
export const LOCALES = ["nl", "en", "de", "fr"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "nl";
export const LOCALE_COOKIE = "lang";

/** Names of the languages in their own language, for the switcher. */
export const LOCALE_NAMES: Record<Locale, string> = {
  nl: "Nederlands",
  en: "English",
  de: "Deutsch",
  fr: "Français",
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

/** BCP 47 tag for number and date formatting. */
export function intlLocale(locale: Locale): string {
  return { nl: "nl-NL", en: "en-GB", de: "de-DE", fr: "fr-FR" }[locale];
}
