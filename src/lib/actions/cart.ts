"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { cartItems, products } from "@/db/schema";
import { getAppUserWithCompany } from "@/lib/auth";
import { getCatalogRules, sellableConditions } from "@/lib/rules";

export type ActionResult = { ok: true } | { ok: false; error: string };

async function requireCompany() {
  const user = await getAppUserWithCompany();
  if (!user) throw new Error("Je moet ingelogd zijn.");
  if (!user.company) throw new Error("Je account is nog niet gekoppeld aan een bedrijf.");
  return user;
}

/**
 * Adding to the cart needs an approved company, not just any company: the
 * cart shows line prices, so a pending account could otherwise read the
 * wholesale prices it is not allowed to see by putting items in a basket.
 */
async function requireApprovedCompany() {
  const user = await requireCompany();
  if (user.company!.status !== "approved") {
    throw new Error("Je bedrijfsaccount is nog niet goedgekeurd.");
  }
  return user;
}

export async function addToCart(
  productId: string,
  quantity: number,
): Promise<ActionResult> {
  try {
    const user = await requireApprovedCompany();
    const db = getDb();

    const rules = await getCatalogRules();
    const product = await db.query.products.findFirst({
      where: and(eq(products.id, productId), ...sellableConditions(rules)),
    });
    if (!product) {
      return {
        ok: false,
        error: "Dit product is op dit moment niet te bestellen.",
      };
    }

    const qty = Math.max(quantity, product.minOrderQty);

    const existing = await db.query.cartItems.findFirst({
      where: and(
        eq(cartItems.companyId, user.company!.id),
        eq(cartItems.productId, productId),
      ),
    });

    if (existing) {
      await db
        .update(cartItems)
        .set({ quantity: existing.quantity + qty, updatedAt: new Date() })
        .where(eq(cartItems.id, existing.id));
    } else {
      await db.insert(cartItems).values({
        companyId: user.company!.id,
        productId,
        quantity: qty,
      });
    }

    revalidatePath("/cart");
    revalidatePath("/products");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Onbekende fout." };
  }
}

export async function updateCartItemQuantity(
  itemId: string,
  quantity: number,
): Promise<ActionResult> {
  try {
    const user = await requireCompany();
    const db = getDb();

    if (quantity <= 0) {
      await db
        .delete(cartItems)
        .where(and(eq(cartItems.id, itemId), eq(cartItems.companyId, user.company!.id)));
    } else {
      await db
        .update(cartItems)
        .set({ quantity, updatedAt: new Date() })
        .where(and(eq(cartItems.id, itemId), eq(cartItems.companyId, user.company!.id)));
    }

    revalidatePath("/cart");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Onbekende fout." };
  }
}

export async function removeCartItem(itemId: string): Promise<ActionResult> {
  return updateCartItemQuantity(itemId, 0);
}

export async function getCartWithTotals() {
  const user = await getAppUserWithCompany();
  if (!user || !user.company) return { items: [], subtotalCents: 0 };

  const db = getDb();
  const rows = await db.query.cartItems.findMany({
    where: eq(cartItems.companyId, user.company.id),
    with: { product: true },
    orderBy: (t, { desc }) => desc(t.updatedAt),
  });

  const subtotalCents = rows.reduce(
    (sum, row) => sum + row.product.priceCents * row.quantity,
    0,
  );

  return { items: rows, subtotalCents };
}
