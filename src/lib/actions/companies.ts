"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { companies } from "@/db/schema";
import { isPlatformAdmin } from "@/lib/auth";
import { notifyCompanyApproved } from "@/lib/email/notify";
import { parseBillingInput, recheckCompanyVat, verifyVat } from "@/lib/company-billing";
import { dictionaries } from "@/lib/i18n/dictionaries";

export type ActionResult = { ok: true } | { ok: false; error: string };

export async function setCompanyStatus(
  id: string,
  status: "pending" | "approved" | "suspended",
): Promise<ActionResult> {
  try {
    if (!(await isPlatformAdmin())) throw new Error("Geen toegang.");
    const db = getDb();
    const before = await db.query.companies.findFirst({ where: eq(companies.id, id) });
    await db.update(companies).set({ status }).where(eq(companies.id, id));
    // Only on the first transition to approved, not when re-approving after a suspension toggle.
    if (status === "approved" && before?.status === "pending") notifyCompanyApproved(id);
    revalidatePath("/admin/companies");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Onbekende fout." };
  }
}

/** Admin edit of a company's name and billing details; a changed VAT number is re-checked in VIES. */
export async function updateCompanyBilling(id: string, formData: FormData): Promise<ActionResult> {
  try {
    if (!(await isPlatformAdmin())) throw new Error("Geen toegang.");
    const o = dictionaries.nl.onboarding;
    const name = String(formData.get("name") ?? "").trim();
    if (!name) return { ok: false, error: o.nameRequired };
    const billing = parseBillingInput(formData, o);
    if (!billing.ok) return billing;

    const db = getDb();
    const current = await db.query.companies.findFirst({ where: eq(companies.id, id) });
    if (!current) return { ok: false, error: "Bedrijf niet gevonden." };

    const vatChanged = billing.value.vatNumber !== current.vatNumber;
    const vat = vatChanged ? await verifyVat(billing.value.vatNumber) : {};

    await db
      .update(companies)
      .set({
        name,
        kvkNumber: String(formData.get("kvkNumber") ?? "").trim() || null,
        billingEmail: String(formData.get("billingEmail") ?? "").trim() || null,
        ...billing.value,
        ...vat,
      })
      .where(eq(companies.id, id));
    revalidatePath("/admin/companies");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Onbekende fout." };
  }
}

export async function recheckVat(id: string): Promise<{ ok: true; message: string } | { ok: false; error: string }> {
  try {
    if (!(await isPlatformAdmin())) throw new Error("Geen toegang.");
    const result = await recheckCompanyVat(id);
    revalidatePath("/admin/companies");
    if (result === null) return { ok: false, error: "Dit bedrijf heeft geen btw-nummer." };
    if (result === "unavailable") {
      return { ok: false, error: "VIES is nu niet bereikbaar voor dit land. Probeer het later opnieuw." };
    }
    return result.vatStatus === "valid"
      ? { ok: true, message: `Geldig${result.vatRegisteredName ? `: ${result.vatRegisteredName}` : ""}` }
      : { ok: false, error: "Volgens VIES is dit btw-nummer niet geldig." };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Onbekende fout." };
  }
}
