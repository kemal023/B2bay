import "server-only";
import { sql } from "drizzle-orm";
import { getDb } from "@/db";

/**
 * Figures for the admin reports page. Revenue is net (excl. VAT): goods plus
 * shipping of every invoiced order that wasn't cancelled — the moment the
 * sale is final. Margin is goods revenue minus the cost price frozen on each
 * order line when the order was placed.
 */

/** Orders that count as a sale. */
const SOLD = sql`o.invoiced_at IS NOT NULL AND o.status <> 'cancelled'`;

export type MonthRow = { month: string; orders: number; revenueCents: number; marginCents: number | null };

export async function revenueByMonth(months = 12): Promise<MonthRow[]> {
  const db = getDb();
  const res = await db.execute<{ month: string; orders: number; revenue: number; margin: number | null }>(sql`
    WITH months AS (
      SELECT generate_series(
        date_trunc('month', now()) - make_interval(months => ${months - 1}),
        date_trunc('month', now()),
        interval '1 month'
      ) AS month
    ),
    lines AS (
      SELECT oi.order_id,
             SUM(oi.unit_price_cents * oi.quantity) AS goods,
             SUM((oi.unit_price_cents - oi.unit_cost_cents) * oi.quantity) AS margin,
             bool_and(oi.unit_cost_cents IS NOT NULL) AS cost_known
      FROM order_items oi GROUP BY oi.order_id
    ),
    sold AS (
      SELECT date_trunc('month', o.invoiced_at) AS month,
             o.subtotal_cents + coalesce(o.shipping_cents, 0) AS net,
             CASE WHEN l.cost_known THEN l.margin END AS margin
      FROM orders o JOIN lines l ON l.order_id = o.id
      WHERE ${SOLD}
    )
    SELECT to_char(m.month, 'YYYY-MM') AS month,
           COUNT(s.net)::int AS orders,
           COALESCE(SUM(s.net), 0)::bigint AS revenue,
           SUM(s.margin)::bigint AS margin
    FROM months m LEFT JOIN sold s ON s.month = m.month
    GROUP BY m.month ORDER BY m.month
  `);
  return res.rows.map((r) => ({
    month: r.month,
    orders: Number(r.orders),
    revenueCents: Number(r.revenue),
    marginCents: r.margin == null ? null : Number(r.margin),
  }));
}

export type RankRow = { label: string; quantity: number; revenueCents: number; marginCents: number | null };

/** Best-selling products over the last `days` days, by revenue. */
export async function topProducts(days = 365, limit = 10): Promise<RankRow[]> {
  const db = getDb();
  const res = await db.execute<{ label: string; qty: number; revenue: number; margin: number | null }>(sql`
    SELECT oi.name_snapshot AS label, SUM(oi.quantity)::int AS qty,
           SUM(oi.unit_price_cents * oi.quantity)::bigint AS revenue,
           SUM((oi.unit_price_cents - oi.unit_cost_cents) * oi.quantity)::bigint AS margin
    FROM order_items oi JOIN orders o ON o.id = oi.order_id
    WHERE ${SOLD} AND o.invoiced_at > now() - make_interval(days => ${days})
    GROUP BY oi.product_id, oi.name_snapshot
    ORDER BY revenue DESC LIMIT ${limit}
  `);
  return res.rows.map((r) => ({
    label: r.label,
    quantity: Number(r.qty),
    revenueCents: Number(r.revenue),
    marginCents: r.margin == null ? null : Number(r.margin),
  }));
}

/** Biggest customers over the last `days` days, by net revenue. */
export async function topCustomers(days = 365, limit = 10): Promise<RankRow[]> {
  const db = getDb();
  const res = await db.execute<{ label: string; orders: number; revenue: number }>(sql`
    SELECT c.name AS label, COUNT(*)::int AS orders,
           SUM(o.subtotal_cents + coalesce(o.shipping_cents, 0))::bigint AS revenue
    FROM orders o JOIN companies c ON c.id = o.company_id
    WHERE ${SOLD} AND o.invoiced_at > now() - make_interval(days => ${days})
    GROUP BY c.id, c.name
    ORDER BY revenue DESC LIMIT ${limit}
  `);
  return res.rows.map((r) => ({
    label: r.label,
    quantity: Number(r.orders),
    revenueCents: Number(r.revenue),
    marginCents: null,
  }));
}

/** Goods revenue and margin per supplier over the last `days` days. */
export async function marginBySupplier(days = 365): Promise<RankRow[]> {
  const db = getDb();
  const res = await db.execute<{ label: string; qty: number; revenue: number; margin: number | null }>(sql`
    SELECT coalesce(s.name, 'Eigen producten') AS label, SUM(oi.quantity)::int AS qty,
           SUM(oi.unit_price_cents * oi.quantity)::bigint AS revenue,
           SUM((oi.unit_price_cents - oi.unit_cost_cents) * oi.quantity)::bigint AS margin
    FROM order_items oi
    JOIN orders o ON o.id = oi.order_id
    LEFT JOIN suppliers s ON s.id = oi.supplier_id
    WHERE ${SOLD} AND o.invoiced_at > now() - make_interval(days => ${days})
    GROUP BY s.name
    ORDER BY revenue DESC
  `);
  return res.rows.map((r) => ({
    label: r.label,
    quantity: Number(r.qty),
    revenueCents: Number(r.revenue),
    marginCents: r.margin == null ? null : Number(r.margin),
  }));
}
