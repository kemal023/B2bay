"use server";

import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { companies, users } from "@/db/schema";
import { ensureAppUser, generateJoinCode } from "@/lib/auth";

export type ActionResult = { ok: true } | { ok: false; error: string };

export async function createCompany(formData: FormData): Promise<ActionResult> {
  const name = String(formData.get("name") ?? "").trim();
  const kvkNumber = String(formData.get("kvkNumber") ?? "").trim();
  const vatNumber = String(formData.get("vatNumber") ?? "").trim();
  const billingEmail = String(formData.get("billingEmail") ?? "").trim();

  if (!name) return { ok: false, error: "Bedrijfsnaam is verplicht." };

  const appUser = await ensureAppUser();
  if (appUser.companyId) {
    return { ok: false, error: "Je account is al gekoppeld aan een bedrijf." };
  }

  const db = getDb();
  const [company] = await db
    .insert(companies)
    .values({
      name,
      kvkNumber: kvkNumber || null,
      vatNumber: vatNumber || null,
      billingEmail: billingEmail || appUser.email,
      status: "pending",
      joinCode: generateJoinCode(),
    })
    .returning();

  await db
    .update(users)
    .set({ companyId: company.id, role: "company_admin" })
    .where(eq(users.id, appUser.id));

  redirect("/dashboard");
}

export async function joinCompany(formData: FormData): Promise<ActionResult> {
  const code = String(formData.get("joinCode") ?? "").trim().toUpperCase();
  if (!code) return { ok: false, error: "Vul een join-code in." };

  const appUser = await ensureAppUser();
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
