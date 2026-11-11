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
import { trackingUrlFor } from "@/lib/shipping-carriers";
import { deliveryFor } from "@/lib/delivery";
import { recheckCompanyVat } from "@/lib/company-billing";
import { isEuCountry, SELLER_COUNTRY, VIES_MAX_AGE_MS, vatTreatmentFor } from "@/lib/vat";

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

    const order = await db.query.orders.findFirst({
      where: eq(orders.id, orderId),
      with: { company: true },
    });
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

    let buyer = order.company;
    if (!buyer.addressLine || !buyer.postalCode || !buyer.city) {
      return {
        ok: false,
        error: `Vul eerst het adres van ${buyer.name} in bij Zakelijke accounts — dat moet op de factuur.`,
      };
    }

    // Cross-border EU buyer with a VAT number: confirm it in VIES (again, if
    // the last confirmation is old) before deciding on reverse charge.
    const crossBorder = isEuCountry(buyer.country) && buyer.country !== SELLER_COUNTRY;
    const fresh =
      buyer.vatStatus === "valid" &&
      buyer.vatCheckedAt != null &&
      Date.now() - buyer.vatCheckedAt.getTime() < VIES_MAX_AGE_MS;
    if (crossBorder && buyer.vatNumber && !fresh) {
      const check = await recheckCompanyVat(buyer.id);
      if (check === "unavailable") {
        return {
          ok: false,
          error: "VIES is nu niet bereikbaar, dus het btw-nummer kan niet bevestigd worden. Probeer het over een paar minuten opnieuw.",
        };
      }
      if (check) buyer = { ...buyer, ...check };
    }

    // The goods must actually leave the Netherlands for reverse charge.
    const destination = deliveryFor({ deliveryAddress: order.deliveryAddress, company: buyer });
    const vatTreatment = vatTreatmentFor(buyer, destination?.country);
    const shippingCents = Math.round(shippingEuro * 100);
    const totals = computeInvoiceTotals(
      order.subtotalCents,
      shippingCents,
      vatTreatment === "reverse_charge" ? 0 : details.vatRatePercent,
    );
    const invoiceNumber = await nextInvoiceNumber();

    await db
      .update(orders)
      .set({
        shippingCents,
        vatCents: totals.vatCents,
        vatRatePercent: totals.vatRatePercent,
        sellerSnapshot: details,
        vatTreatment,
        buyerSnapshot: {
          name: buyer.name,
          addressLine: buyer.addressLine,
          postalCode: buyer.postalCode,
          city: buyer.city,
          country: buyer.country,
          kvkNumber: buyer.kvkNumber,
          vatNumber: buyer.vatNumber,
          billingEmail: buyer.billingEmail,
        },
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

/** Marks the order as shipped, optionally with carrier and tracking code. */
export async function markOrderFulfilled(
  orderId: string,
  formData?: FormData,
): Promise<ActionResult> {
  try {
    await requireAdmin();
    const db = getDb();
    const carrier = String(formData?.get("carrier") ?? "").trim() || null;
    const trackingCode = String(formData?.get("trackingCode") ?? "").trim() || null;
    const manualUrl = String(formData?.get("trackingUrl") ?? "").trim() || null;
    if (manualUrl && !/^https?:\/\//i.test(manualUrl)) {
      return { ok: false, error: "De trackinglink moet met http:// of https:// beginnen." };
    }

    const order = await db.query.orders.findFirst({
      where: eq(orders.id, orderId),
      with: { company: true },
    });
    if (!order) return { ok: false, error: "Bestelling niet gevonden." };

    const trackingUrl =
      manualUrl ??
      (carrier && trackingCode
        ? trackingUrlFor(carrier, trackingCode, deliveryFor(order) ?? order.company)
        : null);

    await db
      .update(orders)
      .set({ status: "fulfilled", carrier, trackingCode, trackingUrl, shippedAt: new Date() })
      .where(eq(orders.id, orderId));
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
