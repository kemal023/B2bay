import { eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { orders, settings } from "@/db/schema";

/**
 * The seller details printed on every invoice, plus the commercial defaults
 * used when one is issued. Empty by default: these are legal identifiers that
 * only the business owner can supply, so nothing is invented here — the admin
 * fills them in at /admin/settings and the invoice page flags what's missing.
 */
export type CompanyDetails = {
  legalName: string;
  addressLine: string;
  postalCode: string;
  city: string;
  country: string;
  kvkNumber: string;
  vatNumber: string;
  iban: string;
  bic: string;
  email: string;
  phone: string;
  /** Days between invoice date and due date. */
  paymentTermDays: number;
  /** Applied to goods + shipping when an invoice is issued. */
  vatRatePercent: number;
};

export const DEFAULT_COMPANY_DETAILS: CompanyDetails = {
  legalName: "",
  addressLine: "",
  postalCode: "",
  city: "",
  country: "Nederland",
  kvkNumber: "",
  vatNumber: "",
  iban: "",
  bic: "",
  email: "",
  phone: "",
  paymentTermDays: 14,
  vatRatePercent: 21,
};

const COMPANY_DETAILS_KEY = "company_details";

export async function getCompanyDetails(): Promise<CompanyDetails> {
  const db = getDb();
  const row = await db.query.settings.findFirst({
    where: eq(settings.key, COMPANY_DETAILS_KEY),
  });
  return parseCompanyDetails(row?.value);
}

/**
 * Seller details for one invoice: the snapshot taken when it was issued, or —
 * for invoices created before snapshots existed — whatever is configured now.
 */
export function sellerForInvoice(snapshot: unknown, current: CompanyDetails): CompanyDetails {
  return snapshot ? parseCompanyDetails(snapshot) : current;
}

export function parseCompanyDetails(value: unknown): CompanyDetails {
  if (!value || typeof value !== "object") return DEFAULT_COMPANY_DETAILS;

  const stored = value as Partial<CompanyDetails>;
  const text = (key: keyof CompanyDetails) =>
    typeof stored[key] === "string" ? (stored[key] as string) : DEFAULT_COMPANY_DETAILS[key];

  return {
    legalName: text("legalName") as string,
    addressLine: text("addressLine") as string,
    postalCode: text("postalCode") as string,
    city: text("city") as string,
    country: text("country") as string,
    kvkNumber: text("kvkNumber") as string,
    vatNumber: text("vatNumber") as string,
    iban: text("iban") as string,
    bic: text("bic") as string,
    email: text("email") as string,
    phone: text("phone") as string,
    paymentTermDays: Number.isFinite(stored.paymentTermDays)
      ? Number(stored.paymentTermDays)
      : DEFAULT_COMPANY_DETAILS.paymentTermDays,
    vatRatePercent: Number.isFinite(stored.vatRatePercent)
      ? Number(stored.vatRatePercent)
      : DEFAULT_COMPANY_DETAILS.vatRatePercent,
  };
}

export async function saveCompanyDetails(details: CompanyDetails): Promise<void> {
  const db = getDb();
  await db
    .insert(settings)
    .values({ key: COMPANY_DETAILS_KEY, value: details, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: settings.key,
      set: { value: details, updatedAt: new Date() },
    });
}

/** Fields the Dutch tax authority requires on an invoice. */
export function missingCompanyFields(details: CompanyDetails): string[] {
  const required: [keyof CompanyDetails, string][] = [
    ["legalName", "Bedrijfsnaam"],
    ["addressLine", "Adres"],
    ["postalCode", "Postcode"],
    ["city", "Plaats"],
    ["kvkNumber", "KVK-nummer"],
    ["vatNumber", "Btw-nummer"],
    ["iban", "IBAN"],
  ];
  return required.filter(([key]) => !String(details[key]).trim()).map(([, label]) => label);
}

/**
 * Next invoice number in a per-year sequence (2026-0001, 2026-0002, ...).
 * Dutch invoicing requires numbering without gaps, so this derives the next
 * value from the highest number already issued this year rather than from a
 * row count — deleting or cancelling an order must not reuse a number.
 */
export async function nextInvoiceNumber(): Promise<string> {
  const db = getDb();
  const year = new Date().getFullYear();
  const prefix = `${year}-`;

  // split_part rather than a regex: the backslash in a regex class does not
  // survive the trip through the query template intact, which silently left
  // the number unparsed and blew up on the cast.
  const rows = await db.execute<{ max_seq: number | null }>(sql`
    SELECT MAX(NULLIF(split_part(invoice_number, '-', 2), '')::int) AS max_seq
    FROM orders
    WHERE invoice_number LIKE ${prefix + "%"}
  `);

  const next = Number(rows.rows[0]?.max_seq ?? 0) + 1;
  return `${prefix}${String(next).padStart(4, "0")}`;
}

export type InvoiceTotals = {
  subtotalCents: number;
  shippingCents: number;
  netCents: number;
  vatCents: number;
  vatRatePercent: number;
  totalCents: number;
};

/** VAT applies to goods and shipping alike. */
export function computeInvoiceTotals(
  subtotalCents: number,
  shippingCents: number,
  vatRatePercent: number,
): InvoiceTotals {
  const netCents = subtotalCents + shippingCents;
  const vatCents = Math.round((netCents * vatRatePercent) / 100);
  return {
    subtotalCents,
    shippingCents,
    netCents,
    vatCents,
    vatRatePercent,
    totalCents: netCents + vatCents,
  };
}

export function invoiceDueDate(invoicedAt: Date, paymentTermDays: number): Date {
  const due = new Date(invoicedAt);
  due.setDate(due.getDate() + paymentTermDays);
  return due;
}

/** Payment reference customers should quote on the bank transfer. */
export function paymentReference(invoiceNumber: string): string {
  return `Factuur ${invoiceNumber}`;
}

export async function getOrderForInvoice(orderId: string) {
  const db = getDb();
  return db.query.orders.findFirst({
    where: eq(orders.id, orderId),
    with: { items: true, company: true },
  });
}
