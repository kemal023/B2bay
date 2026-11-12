"use server";

import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { cartItems, deliveryAddresses, orderItems, orders } from "@/db/schema";
import { getDictionary } from "@/lib/i18n/server";
import type { DeliverySnapshot } from "@/lib/delivery";
import { getPricingContext, unitPriceCents } from "@/lib/pricing";
import { getAppUserWithCompany } from "@/lib/auth";
import { getShippingSettings, qualifiesForFreeShipping } from "@/lib/shipping";
import { notifyNewOrder } from "@/lib/email/notify";
import { localizedName } from "@/lib/product-text";

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

  // The customer’s own price (agreement + volume tier), frozen per line.
  const pricing = await getPricingContext(user.company);
  const priced = items.map((i) => ({ ...i, unitPriceCents: unitPriceCents(i.product.priceCents, i.quantity, pricing) }));
  const subtotalCents = priced.reduce((sum, i) => sum + i.unitPriceCents * i.quantity, 0);

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

  // Line names in the language the customer ordered in: they end up on the
  // invoice, which must not change afterwards.
  const { locale } = await getDictionary();
  await db.insert(orderItems).values(
    priced.map((i) => ({
      orderId: order.id,
      productId: i.product.id,
      supplierId: i.product.supplierId,
      nameSnapshot: localizedName(i.product, locale),
      unitPriceCents: i.unitPriceCents,
      unitCostCents: i.product.costPriceCents,
      quantity: i.quantity,
    })),
  );

  await db.delete(cartItems).where(eq(cartItems.companyId, user.company.id));
  notifyNewOrder(order.id);

  redirect(`/dashboard/orders/${order.id}`);
}

