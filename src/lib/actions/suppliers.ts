"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { suppliers } from "@/db/schema";
import { isPlatformAdmin } from "@/lib/auth";
import { syncSupplier } from "@/lib/suppliers/sync";
import type { GenericRestConfig } from "@/lib/suppliers/generic-rest";

export type ActionResult =
  | { ok: true }
  | { ok: false; error: string };

async function requireAdmin() {
  if (!(await isPlatformAdmin())) throw new Error("Geen toegang.");
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export async function createSupplier(formData: FormData): Promise<ActionResult> {
  try {
    await requireAdmin();
    const db = getDb();

    const name = String(formData.get("name") ?? "").trim();
    const baseUrl = String(formData.get("baseUrl") ?? "").trim();
    const authType = String(formData.get("authType") ?? "none") as
      | "none"
      | "bearer"
      | "api_key_header"
      | "basic";
    const credential = String(formData.get("credential") ?? "").trim();
    const syncIntervalMinutes = Number(formData.get("syncIntervalMinutes") ?? 60);
    const itemsPath = String(formData.get("itemsPath") ?? "").trim();
    const priceIsDecimal = formData.get("priceIsDecimal") === "on";

    if (!name || !baseUrl) return { ok: false, error: "Naam en API-URL zijn verplicht." };

    const fieldMap: GenericRestConfig["fields"] = {
      sku: String(formData.get("fieldSku") ?? "sku"),
      name: String(formData.get("fieldName") ?? "name"),
      description: String(formData.get("fieldDescription") ?? "description"),
      imageUrl: String(formData.get("fieldImageUrl") ?? "imageUrl"),
      category: String(formData.get("fieldCategory") ?? "category"),
      unit: String(formData.get("fieldUnit") ?? "unit"),
      price: String(formData.get("fieldPrice") ?? "price"),
      priceIsDecimal,
      currency: String(formData.get("fieldCurrency") ?? "currency"),
      stock: String(formData.get("fieldStock") ?? "stock"),
      minOrderQty: String(formData.get("fieldMinOrderQty") ?? "minOrderQty"),
    };

    const config: GenericRestConfig = { itemsPath: itemsPath || undefined, fields: fieldMap };

    await db.insert(suppliers).values({
      name,
      slug: slugify(name) || crypto.randomUUID(),
      adapterType: "generic_rest",
      baseUrl,
      authType,
      credential: credential || null,
      config,
      syncIntervalMinutes: Number.isFinite(syncIntervalMinutes) ? syncIntervalMinutes : 60,
      active: true,
    });

    revalidatePath("/admin/suppliers");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Onbekende fout." };
  }
}

export async function toggleSupplierActive(id: string, active: boolean): Promise<ActionResult> {
  try {
    await requireAdmin();
    const db = getDb();
    await db.update(suppliers).set({ active }).where(eq(suppliers.id, id));
    revalidatePath("/admin/suppliers");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Onbekende fout." };
  }
}

export async function deleteSupplier(id: string): Promise<ActionResult> {
  try {
    await requireAdmin();
    const db = getDb();
    await db.delete(suppliers).where(eq(suppliers.id, id));
    revalidatePath("/admin/suppliers");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Onbekende fout." };
  }
}

export async function triggerSupplierSync(id: string): Promise<
  ActionResult & { productsUpserted?: number }
> {
  try {
    await requireAdmin();
    const db = getDb();
    const supplier = await db.query.suppliers.findFirst({ where: eq(suppliers.id, id) });
    if (!supplier) return { ok: false, error: "Leverancier niet gevonden." };

    const result = await syncSupplier(supplier);
    revalidatePath("/admin/suppliers");
    revalidatePath("/products");

    if (!result.ok) return { ok: false, error: result.error ?? "Synchronisatie mislukt." };
    return { ok: true, productsUpserted: result.productsUpserted };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Onbekende fout." };
  }
}
