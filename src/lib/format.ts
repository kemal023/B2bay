import { intlLocale, type Locale } from "@/lib/i18n/config";

export function formatPriceCents(cents: number, currency = "EUR"): string {
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency,
  }).format(cents / 100);
}

export function formatDate(date: Date | string, locale: Locale = "nl"): string {
  return new Intl.DateTimeFormat(intlLocale(locale), {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(date));
}

/** Date without a time — invoice, due and payment dates are whole days. */
export function formatDateOnly(date: Date | string, locale: Locale = "nl"): string {
  return new Intl.DateTimeFormat(intlLocale(locale), { dateStyle: "long" }).format(new Date(date));
}
