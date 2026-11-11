"use server";

import { revalidatePath } from "next/cache";
import { and, eq, inArray, or, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { cartItems, favorites, orders, products } from "@/db/schema";
import { getAppUserWithCompany } from "@/lib/auth";
import { getCatalogRules, sellableConditions } from "@/lib/rules";
import { getDictionary } from "@/lib/i18n/server";
import { fmt } from "@/lib/i18n/dictionaries";
import { getPricingContext, unitPriceCents } from "@/lib/pricing";
import { parseQuickOrder } from "@/lib/quick-order";

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

  const pricing = await getPricingContext(user.company);
  const items = rows.map((row) => ({
    ...row,
    unitPriceCents: unitPriceCents(row.product.priceCents, row.quantity, pricing),
  }));
  const subtotalCents = items.reduce((sum, row) => sum + row.unitPriceCents * row.quantity, 0);

  return { items, subtotalCents };
}

/**
 * Adds several products at once (reorder, quick order). Each line is raised
 * to the product's minimum order quantity and merged with what's already in
 * the cart. Only products that are sellable right now are added.
 */
async function addLinesToCart(
  companyId: string,
  lines: { productId: string; quantity: number }[],
): Promise<{ added: string[]; raised: string[]; unavailable: string[] }> {
  const db = getDb();
  const rules = await getCatalogRules();
  const ids = [...new Set(lines.map((l) => l.productId))];
  const sellable = ids.length
    ? await db.query.products.findMany({
        where: and(inArray(products.id, ids), ...sellableConditions(rules)),
      })
    : [];
  const byId = new Map(sellable.map((p) => [p.id, p]));

  const wanted = new Map<string, number>();
  for (const l of lines) wanted.set(l.productId, (wanted.get(l.productId) ?? 0) + l.quantity);

  const added: string[] = [];
  const raised: string[] = [];
  const unavailable: string[] = [];
  for (const [productId, quantity] of wanted) {
    const product = byId.get(productId);
    if (!product) {
      unavailable.push(productId);
      continue;
    }
    const qty = Math.max(quantity, product.minOrderQty);
    if (qty > quantity) raised.push(product.id);
    await db
      .insert(cartItems)
      .values({ companyId, productId, quantity: qty })
      .onConflictDoUpdate({
        target: [cartItems.companyId, cartItems.productId],
        set: { quantity: sql`${cartItems.quantity} + ${qty}`, updatedAt: new Date() },
      });
    added.push(product.id);
  }
  return { added, raised, unavailable };
}

export type BulkResult =
  | { ok: true; message: string; notes: string[] }
  | { ok: false; error: string };

/** Puts everything from an earlier order back in the cart, at the same quantities. */
export async function reorder(orderId: string): Promise<BulkResult> {
  const { t } = await getDictionary();
  try {
    const user = await requireApprovedCompany();
    const db = getDb();
    const order = await db.query.orders.findFirst({
      where: and(eq(orders.id, orderId), eq(orders.companyId, user.company!.id)),
      with: { items: true },
    });
    if (!order) return { ok: false, error: t.reorder.none };

    const lines = order.items
      .filter((i): i is typeof i & { productId: string } => !!i.productId)
      .map((i) => ({ productId: i.productId, quantity: i.quantity }));
    const result = await addLinesToCart(user.company!.id, lines);
    if (result.added.length === 0) return { ok: false, error: t.reorder.none };

    const gone = order.items
      .filter((i) => !i.productId || result.unavailable.includes(i.productId))
      .map((i) => i.nameSnapshot);
    revalidatePath("/cart");
    return {
      ok: true,
      message: fmt(t.reorder.added, { count: result.added.length }),
      notes: gone.length ? [fmt(t.reorder.skipped, { names: gone.join(", ") })] : [],
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : t.common.error };
  }
}

/**
 * Quick order: one EAN or item number per line, optionally followed by a
 * quantity ("5901234123457 12", "ABC-123;6", "5901234123457\t3").
 */
export async function quickOrder(text: string): Promise<BulkResult> {
  const { t } = await getDictionary();
  try {
    const user = await requireApprovedCompany();
    const parsed = parseQuickOrder(text);
    if (parsed.length === 0) return { ok: false, error: t.quickOrder.nothing };
    if (parsed.length > 200) return { ok: false, error: t.quickOrder.tooMany };

    const db = getDb();
    const rules = await getCatalogRules();
    const codes = [...new Set(parsed.map((l) => l.code))];
    const found = await db.query.products.findMany({
      where: and(
        or(inArray(products.ean, codes), inArray(products.supplierSku, codes)),
        ...sellableConditions(rules),
      ),
    });
    const byCode = new Map<string, (typeof found)[number]>();
    for (const p of found) {
      if (p.ean) byCode.set(p.ean, p);
      if (p.supplierSku && !byCode.has(p.supplierSku)) byCode.set(p.supplierSku, p);
    }

    const lines: { productId: string; quantity: number }[] = [];
    const notFound: string[] = [];
    for (const l of parsed) {
      const p = byCode.get(l.code);
      if (p) lines.push({ productId: p.id, quantity: l.quantity });
      else notFound.push(l.code);
    }
    const result = lines.length
      ? await addLinesToCart(user.company!.id, lines)
      : { added: [], raised: [], unavailable: [] };

    const notes: string[] = [];
    if (notFound.length) notes.push(`${t.quickOrder.notFound} ${[...new Set(notFound)].join(", ")}`);
    if (result.raised.length) {
      const codesRaised = found.filter((p) => result.raised.includes(p.id)).map((p) => p.ean ?? p.supplierSku);
      notes.push(`${t.quickOrder.adjusted} ${codesRaised.join(", ")}`);
    }
    if (result.added.length === 0) return { ok: false, error: notes.join(" ") || t.quickOrder.nothing };

    revalidatePath("/cart");
    return { ok: true, message: fmt(t.quickOrder.added, { count: result.added.length }), notes };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : t.common.error };
  }
}

/** Adds or removes a product from the company's favourites; returns the new state. */
export async function toggleFavorite(
  productId: string,
): Promise<{ ok: true; favorite: boolean } | { ok: false; error: string }> {
  try {
    const user = await requireCompany();
    const db = getDb();
    const where = and(eq(favorites.companyId, user.company!.id), eq(favorites.productId, productId));
    const removed = await db.delete(favorites).where(where).returning({ id: favorites.productId });
    if (removed.length === 0) {
      await db.insert(favorites).values({ companyId: user.company!.id, productId }).onConflictDoNothing();
    }
    revalidatePath("/dashboard/favorites");
    return { ok: true, favorite: removed.length === 0 };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Onbekende fout." };
  }
}

/** Every favourite that is sellable right now, at its minimum order quantity. */
export async function addFavoritesToCart(): Promise<BulkResult> {
  const { t } = await getDictionary();
  try {
    const user = await requireApprovedCompany();
    const rows = await getDb().query.favorites.findMany({
      where: eq(favorites.companyId, user.company!.id),
    });
    const result = await addLinesToCart(
      user.company!.id,
      rows.map((r) => ({ productId: r.productId, quantity: 1 })),
    );
    if (result.added.length === 0) return { ok: false, error: t.reorder.none };
    revalidatePath("/cart");
    return { ok: true, message: fmt(t.quickOrder.added, { count: result.added.length }), notes: [] };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : t.common.error };
  }
}
