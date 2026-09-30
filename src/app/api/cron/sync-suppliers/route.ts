import { NextResponse } from "next/server";
import { syncAllActiveSuppliers } from "@/lib/suppliers/sync";

export const maxDuration = 300;

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results = await syncAllActiveSuppliers();
  return NextResponse.json({ results });
}
