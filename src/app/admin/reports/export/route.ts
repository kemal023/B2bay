import { sql } from "drizzle-orm";
import { getDb } from "@/db";
import { isPlatformAdmin } from "@/lib/auth";
import { csvEuro, toCsv } from "@/lib/purchasing";

/**
 * Sales journal for the bookkeeper: every invoice and credit note in a
 * period (?from=2026-01&to=2026-03, months inclusive), one row each, with
 * net, VAT and total split out and the VAT treatment, so it can be imported
 * into Moneybird, Exact, e-Boekhouden or a spreadsheet. Credit notes are
 * negative. Route handlers skip the admin layout, so access is checked here.
 */
export async function GET(req: Request) {
  if (!(await isPlatformAdmin())) return new Response("Geen toegang", { status: 403 });

  const url = new URL(req.url);
  const month = (v: string | null, fallback: string) => (v && /^\d{4}-\d{2}$/.test(v) ? v : fallback);
  const now = new Date().toISOString().slice(0, 7);
  const from = month(url.searchParams.get("from"), now);
  const to = month(url.searchParams.get("to"), from);
  const start = `${from}-01`;

  const res = await getDb().execute<{
    kind: string;
    number: string;
    date: string;
    invoice_number: string;
    company: string;
    kvk: string | null;
    vat_number: string | null;
    country: string | null;
    net: number;
    rate: number;
    vat: number;
    total: number;
    treatment: string | null;
    paid: string | null;
  }>(sql`
    WITH docs AS (
      SELECT 'Factuur' AS kind, o.invoice_number AS number, o.invoiced_at AS at, o.invoice_number,
             o.company_id, o.buyer_snapshot,
             o.subtotal_cents + coalesce(o.shipping_cents, 0) AS net,
             coalesce(o.vat_rate_percent, 0) AS rate, coalesce(o.vat_cents, 0) AS vat,
             o.total_cents AS total, o.vat_treatment, o.paid_at
      FROM orders o WHERE o.invoice_number IS NOT NULL
      UNION ALL
      SELECT 'Creditnota', c.number, c.created_at, o.invoice_number, o.company_id, o.buyer_snapshot,
             -c.net_cents, c.vat_rate_percent, -c.vat_cents, -c.total_cents, o.vat_treatment, NULL
      FROM credit_notes c JOIN orders o ON o.id = c.order_id
    )
    SELECT d.kind, d.number, to_char(d.at AT TIME ZONE 'Europe/Amsterdam', 'YYYY-MM-DD') AS date,
           d.invoice_number,
           coalesce(d.buyer_snapshot->>'name', co.name) AS company,
           coalesce(d.buyer_snapshot->>'kvkNumber', co.kvk_number) AS kvk,
           coalesce(d.buyer_snapshot->>'vatNumber', co.vat_number) AS vat_number,
           coalesce(d.buyer_snapshot->>'country', co.country) AS country,
           d.net, d.rate, d.vat, d.total, d.vat_treatment AS treatment,
           to_char(d.paid_at AT TIME ZONE 'Europe/Amsterdam', 'YYYY-MM-DD') AS paid
    FROM docs d JOIN companies co ON co.id = d.company_id
    WHERE d.at >= ${start}::date
      AND d.at < (${`${to}-01`}::date + interval '1 month')
    ORDER BY d.at, d.number
  `);

  const rows: (string | number | null)[][] = [
    [
      "Soort",
      "Nummer",
      "Datum",
      "Factuur",
      "Klant",
      "KVK",
      "Btw-nummer klant",
      "Land",
      "Netto",
      "Btw %",
      "Btw",
      "Totaal",
      "Btw-behandeling",
      "Betaald op",
    ],
  ];
  for (const r of res.rows) {
    rows.push([
      r.kind,
      r.number,
      r.date,
      r.invoice_number,
      r.company,
      r.kvk,
      r.vat_number,
      r.country,
      csvEuro(Number(r.net)),
      Number(r.rate),
      csvEuro(Number(r.vat)),
      csvEuro(Number(r.total)),
      r.treatment === "reverse_charge" ? "Btw verlegd (ICP)" : "Binnenland",
      r.paid,
    ]);
  }

  return new Response(toCsv(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="verkoopboek-${from}${to !== from ? `-tot-${to}` : ""}.csv"`,
    },
  });
}
