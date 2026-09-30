"use server";

import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { cartItems, orderItems, orders } from "@/db/schema";
import { getAppUserWithCompany } from "@/lib/auth";
import { getStripe } from "@/lib/stripe";

export async function startCheckoutSession(): Promise<{ clientSecret: string }> {
  const user = await getAppUserWithCompany();
  if (!user || !user.company) throw new Error("Geen bedrijfsaccount gekoppeld.");
  if (user.company.status !== "approved") {
    throw new Error("Je bedrijfsaccount is nog niet goedgekeurd.");
  }

  const db = getDb();
  const items = await db.query.cartItems.findMany({
    where: eq(cartItems.companyId, user.company.id),
    with: { product: { with: { supplier: true } } },
  });

  if (items.length === 0) throw new Error("Je winkelmandje is leeg.");

  const subtotalCents = items.reduce(
    (sum, i) => sum + i.product.priceCents * i.quantity,
    0,
  );

  const [order] = await db
    .insert(orders)
    .values({
      companyId: user.company.id,
      placedByUserId: user.id,
      status: "pending_payment",
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

  const stripe = getStripe();
  const session = await stripe.checkout.sessions.create({
    ui_mode: "embedded",
    redirect_on_completion: "never",
    mode: "payment",
    customer_email: user.email || undefined,
    metadata: { orderId: order.id, companyId: user.company.id },
    line_items: items.map((i) => ({
      price_data: {
        currency: "eur",
        product_data: {
          name: i.product.name,
          description: `via ${i.product.supplier.name}`,
        },
        unit_amount: i.product.priceCents,
      },
      quantity: i.quantity,
    })),
  });

  await db
    .update(orders)
    .set({ stripeCheckoutSessionId: session.id })
    .where(eq(orders.id, order.id));

  if (!session.client_secret) throw new Error("Kon geen checkout-sessie starten.");
  return { clientSecret: session.client_secret };
}
