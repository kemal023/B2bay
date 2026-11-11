import "server-only";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { orders } from "@/db/schema";
import { appUrl } from "@/lib/email/send";

/**
 * Online payment of invoices via Mollie (iDEAL, Bancontact, credit card, ...).
 * Optional: without MOLLIE_API_KEY the pay button is hidden and customers pay
 * by bank transfer as before. Plain REST calls — no SDK needed.
 *
 * Mollie reports the outcome to the webhook; because a webhook can't reach a
 * local machine, the payment is also checked when the customer comes back.
 */

const API = "https://api.mollie.com/v2";

export function paymentsEnabled(): boolean {
  return Boolean(process.env.MOLLIE_API_KEY);
}

async function mollie<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${process.env.MOLLIE_API_KEY}`,
      "Content-Type": "application/json",
      ...init?.headers,
    },
    signal: AbortSignal.timeout(15_000),
    cache: "no-store",
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Mollie ${res.status}: ${body?.detail ?? body?.title ?? "onbekende fout"}`);
  return body as T;
}

type MolliePayment = {
  id: string;
  status: "open" | "canceled" | "pending" | "authorized" | "expired" | "failed" | "paid";
  metadata?: { orderId?: string } | null;
  _links?: { checkout?: { href: string } };
};

/** Starts a payment for the invoice total and returns Mollie's checkout URL. */
export async function createPayment(orderId: string): Promise<string> {
  const db = getDb();
  const order = await db.query.orders.findFirst({ where: eq(orders.id, orderId) });
  if (!order?.invoiceNumber) throw new Error("Deze bestelling heeft nog geen factuur.");
  if (order.paidAt) throw new Error("Deze factuur is al betaald.");

  // Webhooks can't reach localhost; Mollie rejects such URLs, so leave it out
  // there and rely on the check when the customer returns.
  const base = appUrl();
  const publicUrl = !/localhost|127\.0\.0\.1/.test(base);

  const payment = await mollie<MolliePayment>("/payments", {
    method: "POST",
    body: JSON.stringify({
      amount: { currency: order.currency, value: (order.totalCents / 100).toFixed(2) },
      description: `Factuur ${order.invoiceNumber}`,
      redirectUrl: appUrl(`/dashboard/orders/${order.id}?payment=return`),
      ...(publicUrl ? { webhookUrl: appUrl("/api/payments/mollie") } : {}),
      metadata: { orderId: order.id },
    }),
  });
  const checkout = payment._links?.checkout?.href;
  if (!checkout) throw new Error("Mollie gaf geen betaalpagina terug.");

  await db.update(orders).set({ paymentId: payment.id }).where(eq(orders.id, order.id));
  return checkout;
}

/**
 * Looks the payment up at Mollie (never trusts the caller) and marks the
 * order as paid when it is. Safe to call any number of times.
 */
export async function syncPayment(paymentId: string): Promise<MolliePayment["status"] | null> {
  const payment = await mollie<MolliePayment>(`/payments/${encodeURIComponent(paymentId)}`);
  const orderId = payment.metadata?.orderId;
  if (!orderId) return null;

  if (payment.status === "paid") {
    const db = getDb();
    const order = await db.query.orders.findFirst({ where: eq(orders.id, orderId) });
    if (order && !order.paidAt && order.paymentId === payment.id) {
      await db
        .update(orders)
        .set({ paidAt: new Date(), status: order.status === "invoiced" ? "paid" : order.status })
        .where(eq(orders.id, orderId));
    }
  }
  return payment.status;
}
