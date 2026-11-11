"use server";

import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { companies, users } from "@/db/schema";
import { generateJoinCode, getAppUser } from "@/lib/auth";
import { notifyNewCompany } from "@/lib/email/notify";
import { parseBillingInput, verifyVat } from "@/lib/company-billing";
import { getDictionary } from "@/lib/i18n/server";

export type ActionResult = { ok: true } | { ok: false; error: string };

export async function createCompany(formData: FormData): Promise<ActionResult> {
  const { t } = await getDictionary();
  const name = String(formData.get("name") ?? "").trim();
  const kvkNumber = String(formData.get("kvkNumber") ?? "").trim();
  const billingEmail = String(formData.get("billingEmail") ?? "").trim();

  if (!name) return { ok: false, error: t.onboarding.nameRequired };
  const billing = parseBillingInput(formData, t.onboarding);
  if (!billing.ok) return billing;

  const appUser = await getAppUser();
  if (!appUser) return { ok: false, error: "Je bent niet ingelogd." };
  if (appUser.companyId) {
    return { ok: false, error: "Je account is al gekoppeld aan een bedrijf." };
  }

  const vat = await verifyVat(billing.value.vatNumber);
  if (vat.vatStatus === "invalid") return { ok: false, error: t.onboarding.vatInvalid };

  const db = getDb();
  const [company] = await db
    .insert(companies)
    .values({
      name,
      kvkNumber: kvkNumber || null,
      ...billing.value,
      ...vat,
      billingEmail: billingEmail || appUser.email,
      status: "pending",
      joinCode: generateJoinCode(),
    })
    .returning();

  await db
    .update(users)
    .set({ companyId: company.id, role: "company_admin" })
    .where(eq(users.id, appUser.id));

  notifyNewCompany(company.id, appUser.email);
  redirect("/dashboard");
}

export async function joinCompany(formData: FormData): Promise<ActionResult> {
  const code = String(formData.get("joinCode") ?? "").trim().toUpperCase();
  if (!code) return { ok: false, error: "Vul een join-code in." };

  const appUser = await getAppUser();
  if (!appUser) return { ok: false, error: "Je bent niet ingelogd." };
  if (appUser.companyId) {
    return { ok: false, error: "Je account is al gekoppeld aan een bedrijf." };
  }

  const db = getDb();
  const company = await db.query.companies.findFirst({
    where: eq(companies.joinCode, code),
  });
  if (!company) return { ok: false, error: "Ongeldige join-code." };

  await db
    .update(users)
    .set({ companyId: company.id, role: "buyer" })
    .where(eq(users.id, appUser.id));

  redirect("/dashboard");
}
