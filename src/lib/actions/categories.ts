"use server";

import { revalidatePath } from "next/cache";
import { eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { categoryMappings } from "@/db/schema";
import { isPlatformAdmin } from "@/lib/auth";
import { parseShopCategory } from "@/lib/shop-category";

export type ActionResult = { ok: true } | { ok: false; error: string };

async function requireAdmin() {
  if (!(await isPlatformAdmin())) throw new Error("Geen toegang.");
}

/**
 * Sets (and thereby confirms) where a supplier category goes in the shop.
 * Products in it are moved by the background job (scripts/categorize.mjs)
 * within a few minutes: a confirmed mapping changes the version every
 * product's category_key is checked against.
 */
export async function saveCategoryMapping(id: string, value: string): Promise<ActionResult> {
  try {
    await requireAdmin();
    const place = parseShopCategory(value);
    if (!place) return { ok: false, error: "Kies een categorie." };
    await getDb()
      .update(categoryMappings)
      .set({
        mainCategory: place.main,
        subCategory: place.sub,
        status: "confirmed",
        updatedAt: new Date(),
      })
      .where(eq(categoryMappings.id, id));
    revalidatePath("/admin/categories");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Onbekende fout." };
  }
}

/** Accepts every suggestion of one supplier at once. */
export async function confirmAllSuggestions(supplierId: string): Promise<ActionResult> {
  try {
    await requireAdmin();
    await getDb().execute(sql`
      UPDATE category_mappings SET status = 'confirmed', updated_at = now()
      WHERE supplier_id = ${supplierId}::uuid AND status = 'suggested' AND main_category IS NOT NULL
    `);
    revalidatePath("/admin/categories");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Onbekende fout." };
  }
}
