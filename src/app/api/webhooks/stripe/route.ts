import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { cartItems, orders } from "@/db/schema";
import { getStripe } from "@/lib/stripe";

export async function POST(req: Request) {
  const signature = req.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!signature || !webhookSecret) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  const body = await req.text();
  const stripe = getStripe();

  let event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const db = getDb();

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      const orderId = session.metadata?.orderId;
      const companyId = session.metadata?.companyId;
      if (orderId) {
        await db
          .update(orders)
          .set({
            status: "paid",
            stripePaymentIntentId:
              typeof session.payment_intent === "string" ? session.payment_intent : null,
          })
          .where(eq(orders.id, orderId));
      }
      if (companyId) {
        await db.delete(cartItems).where(eq(cartItems.companyId, companyId));
      }
      break;
    }
    case "checkout.session.expired": {
      const session = event.data.object;
      const orderId = session.metadata?.orderId;
      if (orderId) {
        await db.update(orders).set({ status: "cancelled" }).where(eq(orders.id, orderId));
      }
      break;
    }
    default:
      break;
  }

  return NextResponse.json({ received: true });
}
