import "server-only";
import { auth, currentUser } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { companies, users } from "@/db/schema";

export type AppUser = typeof users.$inferSelect;
export type AppCompany = typeof companies.$inferSelect;

/**
 * Returns the signed-in user's row from our own database, or null if signed
 * out or not yet onboarded (no company yet). Does NOT create anything.
 */
export async function getAppUser(): Promise<AppUser | null> {
  const { userId } = await auth();
  if (!userId) return null;

  const db = getDb();
  const row = await db.query.users.findFirst({
    where: eq(users.clerkUserId, userId),
  });
  return row ?? null;
}

export async function getAppUserWithCompany(): Promise<
  (AppUser & { company: AppCompany | null }) | null
> {
  const { userId } = await auth();
  if (!userId) return null;

  const db = getDb();
  const row = await db.query.users.findFirst({
    where: eq(users.clerkUserId, userId),
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

/**
 * Ensures a `users` row exists for the current Clerk session, creating one
 * (with no company yet) on first sign-in. Call this from server components
 * on routes reachable right after sign-up, e.g. the onboarding page.
 */
export async function ensureAppUser(): Promise<AppUser> {
  const { userId } = await auth();
  if (!userId) throw new Error("Not signed in");

  const db = getDb();
  const existing = await db.query.users.findFirst({
    where: eq(users.clerkUserId, userId),
  });
  if (existing) return existing;

  const clerkUser = await currentUser();
  const email = clerkUser?.primaryEmailAddress?.emailAddress ?? "";
  const name = [clerkUser?.firstName, clerkUser?.lastName].filter(Boolean).join(" ");

  const [created] = await db
    .insert(users)
    .values({ clerkUserId: userId, email, name: name || null })
    .returning();
  return created;
}
