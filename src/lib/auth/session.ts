import "server-only";
import { cookies } from "next/headers";
import { randomBytes, createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { sessions, users } from "@/db/schema";

const COOKIE_NAME = "cw_session";
const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Creates a session for a user and sets the session cookie. Call after registration/login. */
export async function createSession(userId: string): Promise<void> {
  const token = randomBytes(32).toString("hex");
  const db = getDb();

  await db.insert(sessions).values({
    userId,
    tokenHash: hashToken(token),
    expiresAt: new Date(Date.now() + SESSION_DURATION_MS),
  });

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DURATION_MS / 1000,
  });
}

/** Reads the current session's user from the database, or null if signed out / expired. */
export async function getSessionUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;

  const db = getDb();
  const session = await db.query.sessions.findFirst({
    where: eq(sessions.tokenHash, hashToken(token)),
    with: { user: true },
  });

  if (!session || session.expiresAt < new Date()) return null;
  return session.user;
}

/** Destroys the current session (server + cookie). Call on logout. */
export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;

  if (token) {
    const db = getDb();
    await db.delete(sessions).where(eq(sessions.tokenHash, hashToken(token)));
  }

  cookieStore.delete(COOKIE_NAME);
}

export async function findUserByEmail(email: string) {
  const db = getDb();
  return db.query.users.findFirst({ where: eq(users.email, email.toLowerCase().trim()) });
}
