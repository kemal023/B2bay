"use server";

import { redirect } from "next/navigation";
import { after } from "next/server";
import { eq } from "drizzle-orm";
import { getDictionary, getLocale } from "@/lib/i18n/server";
import { isLocale } from "@/lib/i18n/config";
import { consumeResetToken, createResetToken } from "@/lib/auth/password-reset";
import { appUrl, sendEmail } from "@/lib/email/send";
import { passwordResetEmail } from "@/lib/email/templates";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { createSession, destroySession, findUserByEmail } from "@/lib/auth/session";
import { blockedFor, clearAttempts, clientIp, LIMITS, recordAttempt } from "@/lib/auth/rate-limit";

const tooManyAttempts = (minutes: number) =>
  `Te veel pogingen. Probeer het over ${minutes} ${minutes === 1 ? "minuut" : "minuten"} opnieuw.`;

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

  const ipKey = `register:${await clientIp()}`;
  const wait = blockedFor(ipKey, LIMITS.registerPerIp);
  if (wait) return { ok: false, error: tooManyAttempts(wait) };
  recordAttempt(ipKey, LIMITS.registerPerIp);

  const existing = await findUserByEmail(email);
  if (existing) return { ok: false, error: "Er bestaat al een account met dit e-mailadres." };

  const db = getDb();
  const [user] = await db
    .insert(users)
    .values({
      email,
      passwordHash: await hashPassword(password),
      name: name || null,
      locale: await getLocale(),
    })
    .returning();

  await createSession(user.id);
  redirect("/onboarding");
}

export async function loginAction(formData: FormData): Promise<ActionResult> {
  const email = normalizeEmail(String(formData.get("email") ?? ""));
  const password = String(formData.get("password") ?? "");

  // Password guessing: a few tries per account, more per network address.
  const emailKey = `login:${email}`;
  const ipKey = `login-ip:${await clientIp()}`;
  const wait = Math.max(blockedFor(emailKey, LIMITS.loginPerEmail), blockedFor(ipKey, LIMITS.loginPerIp));
  if (wait) return { ok: false, error: tooManyAttempts(wait) };

  const user = await findUserByEmail(email);
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    recordAttempt(emailKey, LIMITS.loginPerEmail);
    recordAttempt(ipKey, LIMITS.loginPerIp);
    return { ok: false, error: "Onjuist e-mailadres of wachtwoord." };
  }

  clearAttempts(emailKey);
  await createSession(user.id);
  redirect(user.companyId ? "/dashboard" : "/onboarding");
}

export async function logoutAction(): Promise<void> {
  await destroySession();
  redirect("/");
}

export type ResetRequestResult = { ok: true; sent: boolean } | { ok: false; error: string };

/**
 * Always answers the same whether or not the address has an account, so the
 * form can't be used to find out who is a customer.
 */
export async function requestPasswordReset(formData: FormData): Promise<ResetRequestResult> {
  const { t, locale } = await getDictionary();
  const email = normalizeEmail(String(formData.get("email") ?? ""));
  if (!email || !email.includes("@")) return { ok: false, error: t.auth.invalidEmail };

  const ipKey = `reset:${await clientIp()}`;
  const wait = blockedFor(ipKey, LIMITS.resetPerIp);
  if (wait) return { ok: false, error: tooManyAttempts(wait) };
  recordAttempt(ipKey, LIMITS.resetPerIp);

  const user = await findUserByEmail(email);
  if (user) {
    const token = await createResetToken(user.id);
    if (token) {
      const link = appUrl(`/reset-password?token=${encodeURIComponent(token)}`);
      after(() => sendEmail(passwordResetEmail(user.email, isLocale(user.locale) ? user.locale : locale, link)));
    }
  }
  return { ok: true, sent: true };
}

export async function resetPasswordAction(formData: FormData): Promise<ActionResult> {
  const { t } = await getDictionary();
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");
  if (password.length < 8) return { ok: false, error: t.auth.passwordTooShort };

  const userId = await consumeResetToken(token, await hashPassword(password));
  if (!userId) return { ok: false, error: t.auth.resetInvalid };

  const user = await getDb().query.users.findFirst({ where: eq(users.id, userId) });
  await createSession(userId);
  redirect(user?.companyId ? "/dashboard" : "/onboarding");
}
