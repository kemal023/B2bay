"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { companies } from "@/db/schema";
import { isPlatformAdmin } from "@/lib/auth";
import { notifyCompanyApproved } from "@/lib/email/notify";

export type ActionResult = { ok: true } | { ok: false; error: string };

export async function setCompanyStatus(
  id: string,
  status: "pending" | "approved" | "suspended",
): Promise<ActionResult> {
  try {
    if (!(await isPlatformAdmin())) throw new Error("Geen toegang.");
    const db = getDb();
    const before = await db.query.companies.findFirst({ where: eq(companies.id, id) });
    await db.update(companies).set({ status }).where(eq(companies.id, id));
    // Only on the first transition to approved, not when re-approving after a suspension toggle.
    if (status === "approved" && before?.status === "pending") notifyCompanyApproved(id);
    revalidatePath("/admin/companies");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Onbekende fout." };
  }
}
