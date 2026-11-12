import { NextResponse } from "next/server";
import { runWatchdog } from "@/lib/watchdog";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  // Closed when no secret is configured: this route must never run for anyone.
  if (!process.env.CRON_SECRET || req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json(await runWatchdog());
}
