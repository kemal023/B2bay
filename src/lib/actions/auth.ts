"use server";

import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { createSession, destroySession, findUserByEmail } from "@/lib/auth/session";

export type ActionResult = { ok: true } | { ok: false; error: string };

function normalizeEmail(email: string): string {
  return email.toLowerCase().trim();
}

export async function registerAction(formData: FormData): Promise<ActionResult> {
  const email = normalizeEmail(String(formData.get("email") ?? ""));
  const password = String(formData.get("password") ?? "");
  const name = String(formData.get("name") ?? "").trim();

  if (!email || !email.includes("@")) return { ok: false, error: "Vul een geldig e-mailadres in." };
  if (password.length < 8) return { ok: false, error: "Wachtwoord moet minstens 8 tekens bevatten." };

  const existing = await findUserByEmail(email);
  if (existing) return { ok: false, error: "Er bestaat al een account met dit e-mailadres." };

  const db = getDb();
  const [user] = await db
    .insert(users)
    .values({
      email,
      passwordHash: await hashPassword(password),
      name: name || null,
    })
    .returning();

  await createSession(user.id);
  redirect("/onboarding");
}

export async function loginAction(formData: FormData): Promise<ActionResult> {
  const email = normalizeEmail(String(formData.get("email") ?? ""));
  const password = String(formData.get("password") ?? "");

  const user = await findUserByEmail(email);
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return { ok: false, error: "Onjuist e-mailadres of wachtwoord." };
  }

  await createSession(user.id);
  redirect(user.companyId ? "/dashboard" : "/onboarding");
}

export async function logoutAction(): Promise<void> {
  await destroySession();
  redirect("/");
}
