import "server-only";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { companies, users } from "@/db/schema";
import { getSessionUser } from "@/lib/auth/session";

export type AppUser = typeof users.$inferSelect;
export type AppCompany = typeof companies.$inferSelect;

/** Returns the signed-in user's row, or null if signed out / session expired. */
export async function getAppUser(): Promise<AppUser | null> {
  return getSessionUser();
}

export async function getAppUserWithCompany(): Promise<
  (AppUser & { company: AppCompany | null }) | null
> {
  const sessionUser = await getSessionUser();
  if (!sessionUser) return null;

  const db = getDb();
  const row = await db.query.users.findFirst({
    where: eq(users.id, sessionUser.id),
    with: { company: true },
  });
  return row ?? null;
}

export async function isPlatformAdmin(): Promise<boolean> {
  const user = await getAppUser();
  return user?.role === "platform_admin";
}

/** Generates a short, human-typeable code for teammates to join a company. */
export function generateJoinCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return `${code.slice(0, 4)}-${code.slice(4)}`;
}
