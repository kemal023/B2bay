/**
 * Storefront languages. The choice lives in a cookie rather than the URL, so
 * every page works in both languages without a second set of routes. The
 * admin area and invoices stay Dutch on purpose (internal / legal documents).
 */
export const LOCALES = ["nl", "en"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "nl";
export const LOCALE_COOKIE = "lang";

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

/** BCP 47 tag for number and date formatting. */
export function intlLocale(locale: Locale): string {
  return locale === "en" ? "en-GB" : "nl-NL";
}
