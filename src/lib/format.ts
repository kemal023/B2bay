export function formatPriceCents(cents: number, currency = "EUR"): string {
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency,
  }).format(cents / 100);
}

export function formatDate(date: Date | string, locale: "nl" | "en" = "nl"): string {
  return new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "nl-NL", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(date));
}

/** Date without a time — invoice, due and payment dates are whole days. */
export function formatDateOnly(date: Date | string): string {
  return new Intl.DateTimeFormat("nl-NL", { dateStyle: "long" }).format(new Date(date));
}
