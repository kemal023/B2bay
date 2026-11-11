import "server-only";
import { randomBytes, createHash } from "node:crypto";
import { and, eq, gt, isNull } from "drizzle-orm";
import { getDb } from "@/db";
import { passwordResetTokens, sessions, users } from "@/db/schema";

const TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour
/** At most one fresh link per address per minute, so the form can't be used to flood an inbox. */
const RESEND_COOLDOWN_MS = 60 * 1000;

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

/** Returns a new raw token, or null when one was issued for this user less than a minute ago. */
export async function createResetToken(userId: string): Promise<string | null> {
  const db = getDb();
  const recent = await db.query.passwordResetTokens.findFirst({
    where: and(
      eq(passwordResetTokens.userId, userId),
      gt(passwordResetTokens.createdAt, new Date(Date.now() - RESEND_COOLDOWN_MS)),
    ),
  });
  if (recent) return null;

  const token = randomBytes(32).toString("base64url");
  await db.insert(passwordResetTokens).values({
    userId,
    tokenHash: hashToken(token),
    expiresAt: new Date(Date.now() + TOKEN_TTL_MS),
  });
  return token;
}

/** Whether the link can still be used — for showing the form or an error up front. */
export async function isResetTokenValid(token: string): Promise<boolean> {
  const db = getDb();
  const row = await db.query.passwordResetTokens.findFirst({
    where: and(
      eq(passwordResetTokens.tokenHash, hashToken(token)),
      isNull(passwordResetTokens.usedAt),
      gt(passwordResetTokens.expiresAt, new Date()),
    ),
  });
  return Boolean(row);
}

/**
 * Sets the new password and burns the token. Every existing session of the
 * user is ended, so whoever might have had access is signed out. Returns the
 * user id, or null when the token is invalid, used or expired.
 */
export async function consumeResetToken(token: string, passwordHash: string): Promise<string | null> {
  const db = getDb();
  // Marking it used in the same statement that checks it makes a double submit harmless.
  const [row] = await db
    .update(passwordResetTokens)
    .set({ usedAt: new Date() })
    .where(
      and(
        eq(passwordResetTokens.tokenHash, hashToken(token)),
        isNull(passwordResetTokens.usedAt),
        gt(passwordResetTokens.expiresAt, new Date()),
      ),
    )
    .returning({ userId: passwordResetTokens.userId });
  if (!row) return null;

  await db.update(users).set({ passwordHash }).where(eq(users.id, row.userId));
  await db.delete(sessions).where(eq(sessions.userId, row.userId));
  await db
    .update(passwordResetTokens)
    .set({ usedAt: new Date() })
    .where(and(eq(passwordResetTokens.userId, row.userId), isNull(passwordResetTokens.usedAt)));
  return row.userId;
}
