"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { products } from "@/db/schema";
import { isPlatformAdmin } from "@/lib/auth";

export type ActionResult = { ok: true } | { ok: false; error: string };

async function requireAdmin() {
  if (!(await isPlatformAdmin())) throw new Error("Geen toegang.");
}

function revalidateProducts() {
  revalidatePath("/admin/products");
  revalidatePath("/products");
}

function readProductForm(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const ean = String(formData.get("ean") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const imageUrl = String(formData.get("imageUrl") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim();
  const unit = String(formData.get("unit") ?? "stuk").trim() || "stuk";
  const priceEuro = Number(formData.get("priceEuro") ?? 0);
  const stockQty = Number(formData.get("stockQty") ?? 0);
  const minOrderQty = Number(formData.get("minOrderQty") ?? 1);
  const active = formData.get("active") === "on";

  return { name, ean, description, imageUrl, category, unit, priceEuro, stockQty, minOrderQty, active };
}

/** Adds a product the store owns outright — no supplier, admin sets everything. */
export async function createProduct(formData: FormData): Promise<ActionResult> {
  try {
    await requireAdmin();
    const f = readProductForm(formData);

    if (!f.name) return { ok: false, error: "Naam is verplicht." };
    if (!Number.isFinite(f.priceEuro) || f.priceEuro < 0) {
      return { ok: false, error: "Ongeldige verkoopprijs." };
    }

    const db = getDb();
    await db.insert(products).values({
      supplierId: null,
      supplierSku: null,
      name: f.name,
      ean: f.ean || null,
      description: f.description || null,
      imageUrl: f.imageUrl || null,
      category: f.category || null,
      unit: f.unit,
      costPriceCents: null,
      priceCents: Math.round(f.priceEuro * 100),
      stockQty: Number.isFinite(f.stockQty) ? Math.max(0, Math.round(f.stockQty)) : 0,
      minOrderQty: Number.isFinite(f.minOrderQty) ? Math.max(1, Math.round(f.minOrderQty)) : 1,
      active: f.active,
      customized: true,
    });

    revalidateProducts();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Onbekende fout." };
  }
}

/**
 * Updates any product's commercial/display fields — regardless of whether
 * it came from a supplier sync or was added by hand. Marks it `customized`
 * so a future supplier sync won't overwrite what the admin just set.
 */
export async function updateProduct(id: string, formData: FormData): Promise<ActionResult> {
  try {
    await requireAdmin();
    const f = readProductForm(formData);

    if (!f.name) return { ok: false, error: "Naam is verplicht." };
    if (!Number.isFinite(f.priceEuro) || f.priceEuro < 0) {
      return { ok: false, error: "Ongeldige verkoopprijs." };
    }

    const db = getDb();
    await db
      .update(products)
      .set({
        name: f.name,
        ean: f.ean || null,
        description: f.description || null,
        imageUrl: f.imageUrl || null,
        category: f.category || null,
        unit: f.unit,
        priceCents: Math.round(f.priceEuro * 100),
        stockQty: Number.isFinite(f.stockQty) ? Math.max(0, Math.round(f.stockQty)) : 0,
        minOrderQty: Number.isFinite(f.minOrderQty) ? Math.max(1, Math.round(f.minOrderQty)) : 1,
        active: f.active,
        customized: true,
        updatedAt: new Date(),
      })
      .where(eq(products.id, id));

    revalidateProducts();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Onbekende fout." };
  }
}

export async function toggleProductActive(id: string, active: boolean): Promise<ActionResult> {
  try {
    await requireAdmin();
    const db = getDb();
    await db
      .update(products)
      .set({ active, customized: true, updatedAt: new Date() })
      .where(eq(products.id, id));
    revalidateProducts();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Onbekende fout." };
  }
}

export async function deleteProduct(id: string): Promise<ActionResult> {
  try {
    await requireAdmin();
    const db = getDb();
    await db.delete(products).where(eq(products.id, id));
    revalidateProducts();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Onbekende fout." };
  }
}
