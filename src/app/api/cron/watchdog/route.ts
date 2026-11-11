import { NextResponse } from "next/server";
import { runWatchdog } from "@/lib/watchdog";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (process.env.CRON_SECRET && req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json(await runWatchdog());
}
