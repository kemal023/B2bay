"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { orders } from "@/db/schema";
import { isPlatformAdmin } from "@/lib/auth";

export type ActionResult = { ok: true } | { ok: false; error: string };

async function requireAdmin() {
  if (!(await isPlatformAdmin())) throw new Error("Geen toegang.");
}

function revalidateOrder(id: string) {
  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${id}`);
  revalidatePath(`/dashboard/orders/${id}`);
  revalidatePath("/dashboard");
}

/** Sets the shipping cost and marks the order as invoiced. */
export async function invoiceOrder(
  orderId: string,
  formData: FormData,
): Promise<ActionResult> {
  try {
    await requireAdmin();
    const db = getDb();

    const shippingEuro = Number(formData.get("shippingEuro") ?? 0);
    const invoiceNumber = String(formData.get("invoiceNumber") ?? "").trim();
    const invoiceNotes = String(formData.get("invoiceNotes") ?? "").trim();

    if (!Number.isFinite(shippingEuro) || shippingEuro < 0) {
      return { ok: false, error: "Ongeldige verzendkosten." };
    }

    const order = await db.query.orders.findFirst({ where: eq(orders.id, orderId) });
    if (!order) return { ok: false, error: "Bestelling niet gevonden." };

    const shippingCents = Math.round(shippingEuro * 100);

    await db
      .update(orders)
      .set({
        shippingCents,
        totalCents: order.subtotalCents + shippingCents,
        status: "invoiced",
        invoiceNumber: invoiceNumber || null,
        invoiceNotes: invoiceNotes || null,
        invoicedAt: new Date(),
      })
      .where(eq(orders.id, orderId));

    revalidateOrder(orderId);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Onbekende fout." };
  }
}

export async function markOrderPaid(orderId: string): Promise<ActionResult> {
  try {
    await requireAdmin();
    const db = getDb();
    await db
      .update(orders)
      .set({ status: "paid", paidAt: new Date() })
      .where(eq(orders.id, orderId));
    revalidateOrder(orderId);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Onbekende fout." };
  }
}

export async function markOrderFulfilled(orderId: string): Promise<ActionResult> {
  try {
    await requireAdmin();
    const db = getDb();
    await db.update(orders).set({ status: "fulfilled" }).where(eq(orders.id, orderId));
    revalidateOrder(orderId);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Onbekende fout." };
  }
}

export async function cancelOrder(orderId: string): Promise<ActionResult> {
  try {
    await requireAdmin();
    const db = getDb();
    await db.update(orders).set({ status: "cancelled" }).where(eq(orders.id, orderId));
    revalidateOrder(orderId);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Onbekende fout." };
  }
}
