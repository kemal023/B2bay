import "server-only";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { companies } from "@/db/schema";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { checkVies, isEuCountry, normalizeVatNumber, vatNumberCountry, type VatStatus } from "@/lib/vat";

export type BillingInput = {
  addressLine: string;
  postalCode: string;
  city: string;
  country: string;
  vatNumber: string | null;
};

export type VatCheck = { vatStatus: VatStatus; vatCheckedAt: Date | null; vatRegisteredName: string | null };

/** Reads and validates the billing fields shared by onboarding and the admin edit form. */
export function parseBillingInput(
  formData: FormData,
  o: Dictionary["onboarding"],
): { ok: true; value: BillingInput } | { ok: false; error: string } {
  const text = (key: string) => String(formData.get(key) ?? "").trim();
  const addressLine = text("addressLine");
  const postalCode = text("postalCode");
  const city = text("city");
  const country = text("country").toUpperCase();
  const vatRaw = text("vatNumber");

  if (!addressLine || !postalCode || !city) return { ok: false, error: o.addressRequired };
  if (!isEuCountry(country)) return { ok: false, error: o.countryInvalid };

  let vatNumber: string | null = null;
  if (vatRaw) {
    vatNumber = normalizeVatNumber(vatRaw);
    // "123456789B01" typed without the country prefix: add it.
    if (!vatNumberCountry(vatNumber)) vatNumber = `${country === "GR" ? "EL" : country}${vatNumber}`;
    if (vatNumberCountry(vatNumber) !== country) return { ok: false, error: o.vatCountryMismatch };
  }
  return { ok: true, value: { addressLine, postalCode, city, country, vatNumber } };
}

/**
 * VIES check for a new or changed VAT number. A clearly invalid number is
 * returned as such so the form can reject the typo; when VIES is down the
 * number is kept as "unverified" and checked again before invoicing.
 */
export async function verifyVat(vatNumber: string | null): Promise<VatCheck> {
  if (!vatNumber) return { vatStatus: "unverified", vatCheckedAt: null, vatRegisteredName: null };
  const result = await checkVies(vatNumber);
  if (result.status === "unavailable") {
    return { vatStatus: "unverified", vatCheckedAt: null, vatRegisteredName: null };
  }
  return { vatStatus: result.status, vatCheckedAt: new Date(), vatRegisteredName: result.name };
}

/** Re-checks a company's stored VAT number and saves the outcome. */
export async function recheckCompanyVat(companyId: string): Promise<VatCheck | "unavailable" | null> {
  const db = getDb();
  const company = await db.query.companies.findFirst({ where: eq(companies.id, companyId) });
  if (!company?.vatNumber) return null;
  const result = await checkVies(company.vatNumber);
  if (result.status === "unavailable") return "unavailable";
  const check: VatCheck = {
    vatStatus: result.status,
    vatCheckedAt: new Date(),
    vatRegisteredName: result.name,
  };
  await db.update(companies).set(check).where(eq(companies.id, companyId));
  return check;
}
