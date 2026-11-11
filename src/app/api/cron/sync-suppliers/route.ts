import { NextResponse } from "next/server";
import { syncAllActiveSuppliers, syncDueSuppliers } from "@/lib/suppliers/sync";

export const maxDuration = 300;

/**
 * Called by the scheduler container every few minutes. Only suppliers whose
 * own sync interval has passed are synced; `?all=1` forces every active one.
 */
export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const all = new URL(req.url).searchParams.get("all") === "1";
  const results = all ? await syncAllActiveSuppliers() : await syncDueSuppliers();
  return NextResponse.json({ results });
}
