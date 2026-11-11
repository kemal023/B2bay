import { sql } from "drizzle-orm";
import { getDb } from "@/db";

export const dynamic = "force-dynamic";

/**
 * For an external uptime monitor (e.g. UptimeRobot): 200 when the app and its
 * database answer, 503 otherwise. Deliberately says nothing more.
 */
export async function GET() {
  try {
    await getDb().execute(sql`SELECT 1`);
    return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ ok: false }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
