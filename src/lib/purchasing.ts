import "server-only";
import { sql } from "drizzle-orm";
import { getDb } from "@/db";

/**
 * What still has to be bought from each supplier: the lines of every order
 * that is invoiced or paid but not shipped yet, summed per product. Orders
 * that are only "placed" (no invoice yet) are left out unless asked for —
 * those may still change or be cancelled.
 */

export type PurchaseLine = {
  productId: string | null;
  name: string;
  supplierSku: string | null;
  ean: string | null;
  quantity: number;
  unitCostCents: number | null;
  orders: number;
};

export type PurchaseGroup = {
  supplierId: string | null;
  supplierName: string;
  baseUrl: string | null;
  lines: PurchaseLine[];
  totalCostCents: number;
};

export async function purchaseList(includePlaced = false): Promise<PurchaseGroup[]> {
  const statuses = includePlaced ? ["placed", "invoiced", "paid"] : ["invoiced", "paid"];
  const res = await getDb().execute<{
    supplier_id: string | null;
    supplier_name: string | null;
    base_url: string | null;
    product_id: string | null;
    name: string;
    supplier_sku: string | null;
    ean: string | null;
    qty: number;
    unit_cost: number | null;
    orders: number;
  }>(sql`
    SELECT oi.supplier_id, s.name AS supplier_name, s.base_url,
           oi.product_id, min(oi.name_snapshot) AS name, p.supplier_sku, p.ean,
           SUM(oi.quantity)::int AS qty,
           max(coalesce(oi.unit_cost_cents, p.cost_price_cents)) AS unit_cost,
           COUNT(DISTINCT o.id)::int AS orders
    FROM order_items oi
    JOIN orders o ON o.id = oi.order_id
    LEFT JOIN products p ON p.id = oi.product_id
    LEFT JOIN suppliers s ON s.id = oi.supplier_id
    WHERE o.status = ANY(${`{${statuses.join(",")}}`}::order_status[])
    GROUP BY oi.supplier_id, s.name, s.base_url, oi.product_id, p.supplier_sku, p.ean
    ORDER BY s.name NULLS LAST, name
  `);

  const groups = new Map<string, PurchaseGroup>();
  for (const r of res.rows) {
    const key = r.supplier_id ?? "none";
    let g = groups.get(key);
    if (!g) {
      g = {
        supplierId: r.supplier_id,
        supplierName: r.supplier_name ?? "Eigen producten",
        baseUrl: r.base_url,
        lines: [],
        totalCostCents: 0,
      };
      groups.set(key, g);
    }
    const unitCost = r.unit_cost == null ? null : Number(r.unit_cost);
    g.lines.push({
      productId: r.product_id,
      name: r.name,
      supplierSku: r.supplier_sku,
      ean: r.ean,
      quantity: Number(r.qty),
      unitCostCents: unitCost,
      orders: Number(r.orders),
    });
    g.totalCostCents += (unitCost ?? 0) * Number(r.qty);
  }
  return [...groups.values()];
}

/** CSV with ; as separator and a BOM, so Excel (NL) opens it correctly. */
export function toCsv(rows: (string | number | null)[][]): string {
  const cell = (v: string | number | null) => {
    const s = v == null ? "" : String(v);
    return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return "﻿" + rows.map((r) => r.map(cell).join(";")).join("\r\n") + "\r\n";
}

/** 1234 cents → "12,34" (decimal comma for Dutch spreadsheets). */
export const csvEuro = (cents: number | null) => (cents == null ? "" : (cents / 100).toFixed(2).replace(".", ","));
