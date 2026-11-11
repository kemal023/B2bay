"use server";

import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { cartItems, deliveryAddresses, orderItems, orders } from "@/db/schema";
import { getDictionary } from "@/lib/i18n/server";
import type { DeliverySnapshot } from "@/lib/delivery";
import { getAppUserWithCompany } from "@/lib/auth";
import { getShippingSettings, qualifiesForFreeShipping } from "@/lib/shipping";
import { notifyNewOrder } from "@/lib/email/notify";

export type ActionResult = { ok: true; orderId: string } | { ok: false; error: string };

/**
 * Places an order from the company's current cart. No online payment is
 * collected here — shipping cost depends on the products/quantities
 * ordered, so an admin determines it afterwards and sends an invoice that
 * the customer pays by bank transfer (see lib/actions/admin-orders.ts).
 * Orders above the free-shipping threshold get shipping fixed at 0 here,
 * judged by the rule in force when the order was placed.
 */
export async function placeOrder(deliveryAddressId?: string | null): Promise<ActionResult> {
  const user = await getAppUserWithCompany();
  if (!user || !user.company) return { ok: false, error: "Geen bedrijfsaccount gekoppeld." };
  if (user.company.status !== "approved") {
    return { ok: false, error: "Je bedrijfsaccount is nog niet goedgekeurd." };
  }

  const db = getDb();
  const items = await db.query.cartItems.findMany({
    where: eq(cartItems.companyId, user.company.id),
    with: { product: true },
  });

  if (items.length === 0) return { ok: false, error: "Je winkelmandje is leeg." };

  // Optional delivery address of this company, copied onto the order so a
  // later edit or deletion of the address never changes where it went.
  let deliveryAddress: DeliverySnapshot | null = null;
  if (deliveryAddressId) {
    const address = await db.query.deliveryAddresses.findFirst({
      where: and(
        eq(deliveryAddresses.id, deliveryAddressId),
        eq(deliveryAddresses.companyId, user.company.id),
      ),
    });
    if (!address) return { ok: false, error: (await getDictionary()).t.addresses.notFound };
    deliveryAddress = {
      label: address.label,
      recipient: address.recipient,
      addressLine: address.addressLine,
      postalCode: address.postalCode,
      city: address.city,
      country: address.country,
      phone: address.phone,
    };
  }

  const subtotalCents = items.reduce(
    (sum, i) => sum + i.product.priceCents * i.quantity,
    0,
  );

  const freeShipping = qualifiesForFreeShipping(subtotalCents, await getShippingSettings());

  const [order] = await db
    .insert(orders)
    .values({
      companyId: user.company.id,
      placedByUserId: user.id,
      status: "placed",
      subtotalCents,
      shippingCents: freeShipping ? 0 : null,
      deliveryAddress,
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
  notifyNewOrder(order.id);

  redirect(`/dashboard/orders/${order.id}`);
}
