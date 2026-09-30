/**
 * Promotes an existing user (identified by email) to platform_admin.
 * The user must have signed in at least once already, since app users are
 * created lazily on first sign-in / onboarding visit.
 *
 * Usage: npx dotenv -e .env.local -- npx tsx scripts/promote-admin.ts you@example.com
 */
import { eq } from "drizzle-orm";
import { getDb } from "../src/db";
import { users } from "../src/db/schema";

async function main() {
  const email = process.argv[2];
  if (!email) {
    console.error("Usage: tsx scripts/promote-admin.ts <email>");
    process.exit(1);
  }

  const db = getDb();
  const user = await db.query.users.findFirst({ where: eq(users.email, email) });
  if (!user) {
    console.error(
      `No user found with email "${email}". Ask them to sign in / visit /onboarding at least once first.`,
    );
    process.exit(1);
  }

  await db.update(users).set({ role: "platform_admin" }).where(eq(users.id, user.id));
  console.log(`Promoted ${email} to platform_admin.`);
}

main().then(() => process.exit(0));
