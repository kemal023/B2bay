"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { suppliers } from "@/db/schema";
import { getAppUser } from "@/lib/auth";
import { applySupplierMargin, saveCatalogRules } from "@/lib/rules";

export type RuleActionResult =
  | { ok: true; message: string }
  | { ok: false; error: string };

async function requireAdmin() {
  const user = await getAppUser();
  if (!user || user.role !== "platform_admin") {
    throw new Error("Geen toegang.");
  }
}

export async function updateCatalogRules(formData: FormData): Promise<RuleActionResult> {
  try {
    await requireAdmin();

    const minStockQty = Number(formData.get("minStockQty") ?? 0);
    if (!Number.isFinite(minStockQty) || minStockQty < 0) {
      return { ok: false, error: "Minimale voorraad moet 0 of hoger zijn." };
    }

    await saveCatalogRules({ minStockQty: Math.floor(minStockQty) });

    revalidatePath("/admin/rules");
    revalidatePath("/products");
    revalidatePath("/");

    return {
      ok: true,
      message:
        minStockQty > 0
          ? `Regel opgeslagen: alleen producten met minimaal ${minStockQty} op voorraad zijn te koop.`
          : "Regel opgeslagen: er geldt geen voorraaddrempel meer.",
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Onbekende fout." };
  }
}

/**
 * Stores the new margin on the supplier *and* reprices its existing catalogue
 * — otherwise the change would only show up on products imported after the
 * next sync, which is not what "set Annapol to 40%" means.
 */
export async function updateSupplierMargin(formData: FormData): Promise<RuleActionResult> {
  try {
    await requireAdmin();

    const supplierId = String(formData.get("supplierId") ?? "");
    const markupPercent = Number(formData.get("markupPercent") ?? 0);

    if (!supplierId) return { ok: false, error: "Leverancier ontbreekt." };
    if (!Number.isFinite(markupPercent) || markupPercent < 0) {
      return { ok: false, error: "Marge moet 0 of hoger zijn." };
    }

    const db = getDb();
    const supplier = await db.query.suppliers.findFirst({
      where: eq(suppliers.id, supplierId),
    });
    if (!supplier) return { ok: false, error: "Leverancier niet gevonden." };

    const margin = Math.round(markupPercent);
    await db
      .update(suppliers)
      .set({ defaultMarkupPercent: margin })
      .where(eq(suppliers.id, supplierId));

    const repriced = await applySupplierMargin(supplierId, margin);

    revalidatePath("/admin/rules");
    revalidatePath("/admin/products");
    revalidatePath("/products");

    return {
      ok: true,
      message: `${supplier.name} staat nu op ${margin}% marge — ${repriced.toLocaleString("nl-NL")} product${repriced === 1 ? "" : "en"} herberekend.`,
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Onbekende fout." };
  }
}
