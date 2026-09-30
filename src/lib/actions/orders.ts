"use server";

import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { cartItems, orderItems, orders } from "@/db/schema";
import { getAppUserWithCompany } from "@/lib/auth";

export type ActionResult = { ok: true; orderId: string } | { ok: false; error: string };

/**
 * Places an order from the company's current cart. No online payment is
 * collected here — shipping cost depends on the products/quantities
 * ordered, so an admin determines it afterwards and sends an invoice that
 * the customer pays by bank transfer (see lib/actions/admin-orders.ts).
 */
export async function placeOrder(): Promise<ActionResult> {
  const user = await getAppUserWithCompany();
  if (!user || !user.company) return { ok: false, error: "Geen bedrijfsaccount gekoppeld." };
  if (user.company.status !== "approved") {
    return { ok: false, error: "Je bedrijfsaccount is nog niet goedgekeurd." };
  }

  const db = getDb();
  const items = await db.query.cartItems.findMany({
    where: eq(cartItems.companyId, user.company.id),
    with: { product: { with: { supplier: true } } },
  });

  if (items.length === 0) return { ok: false, error: "Je winkelmandje is leeg." };

  const subtotalCents = items.reduce(
    (sum, i) => sum + i.product.priceCents * i.quantity,
    0,
  );

  const [order] = await db
    .insert(orders)
    .values({
      companyId: user.company.id,
      placedByUserId: user.id,
      status: "placed",
      subtotalCents,
      totalCents: subtotalCents,
      currency: "EUR",
    })
    .returning();

  await db.insert(orderItems).values(
    items.map((i) => ({
      orderId: order.id,
      productId: i.product.id,
      supplierId: i.product.supplierId,
      nameSnapshot: i.product.name,
      unitPriceCents: i.product.priceCents,
      quantity: i.quantity,
    })),
  );

  await db.delete(cartItems).where(eq(cartItems.companyId, user.company.id));

  redirect(`/dashboard/orders/${order.id}`);
}
