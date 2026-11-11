import { isPlatformAdmin } from "@/lib/auth";
import { csvEuro, purchaseList, toCsv } from "@/lib/purchasing";

/**
 * Purchase list as CSV, for one supplier (?supplier=<id>, "none" for own
 * products) or all of them. Route handlers don't pass through the admin
 * layout, so the admin check happens here.
 */
export async function GET(req: Request) {
  if (!(await isPlatformAdmin())) return new Response("Geen toegang", { status: 403 });

  const url = new URL(req.url);
  const supplier = url.searchParams.get("supplier");
  const groups = (await purchaseList(url.searchParams.get("placed") === "1")).filter(
    (g) => !supplier || (g.supplierId ?? "none") === supplier,
  );

  const rows: (string | number | null)[][] = [
    ["Leverancier", "Artikelnummer", "EAN", "Product", "Aantal", "Inkoopprijs", "Totaal", "Bestellingen"],
  ];
  for (const g of groups) {
    for (const l of g.lines) {
      rows.push([
        g.supplierName,
        l.supplierSku,
        l.ean,
        l.name,
        l.quantity,
        csvEuro(l.unitCostCents),
        csvEuro(l.unitCostCents == null ? null : l.unitCostCents * l.quantity),
        l.orders,
      ]);
    }
  }

  const name = groups.length === 1 ? groups[0].supplierName : "alle-leveranciers";
  const file = `inkooplijst-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${new Date().toISOString().slice(0, 10)}.csv`;
  return new Response(toCsv(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${file}"`,
    },
  });
}
