"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { orders } from "@/db/schema";
import { isPlatformAdmin } from "@/lib/auth";
import {
  computeInvoiceTotals,
  getCompanyDetails,
  missingCompanyFields,
  nextInvoiceNumber,
} from "@/lib/invoicing";
import { notifyInvoiceIssued, notifyOrderShipped } from "@/lib/email/notify";

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

/**
 * Issues the invoice: fixes the shipping cost, applies VAT at the rate
 * configured at this moment, and assigns the next number in the yearly
 * sequence. The rate and amounts are frozen onto the order, so later changes
 * to the settings never rewrite an invoice that has already been sent.
 */
export async function invoiceOrder(
  orderId: string,
  formData: FormData,
): Promise<ActionResult> {
  try {
    await requireAdmin();
    const db = getDb();

    const shippingEuro = Number(formData.get("shippingEuro") ?? 0);
    const invoiceNotes = String(formData.get("invoiceNotes") ?? "").trim();

    if (!Number.isFinite(shippingEuro) || shippingEuro < 0) {
      return { ok: false, error: "Ongeldige verzendkosten." };
    }

    const order = await db.query.orders.findFirst({ where: eq(orders.id, orderId) });
    if (!order) return { ok: false, error: "Bestelling niet gevonden." };
    if (order.invoiceNumber) {
      return { ok: false, error: "Deze bestelling heeft al een factuur." };
    }

    const details = await getCompanyDetails();
    const missing = missingCompanyFields(details);
    if (missing.length > 0) {
      return {
        ok: false,
        error: `Vul eerst je bedrijfsgegevens aan bij Instellingen: ${missing.join(", ")}.`,
      };
    }

    const shippingCents = Math.round(shippingEuro * 100);
    const totals = computeInvoiceTotals(
      order.subtotalCents,
      shippingCents,
      details.vatRatePercent,
    );
    const invoiceNumber = await nextInvoiceNumber();

    await db
      .update(orders)
      .set({
        shippingCents,
        vatCents: totals.vatCents,
        vatRatePercent: totals.vatRatePercent,
        sellerSnapshot: details,
        totalCents: totals.totalCents,
        status: "invoiced",
        invoiceNumber,
        invoiceNotes: invoiceNotes || null,
        invoicedAt: new Date(),
      })
      .where(eq(orders.id, orderId));

    notifyInvoiceIssued(orderId);
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
    notifyOrderShipped(orderId);
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
