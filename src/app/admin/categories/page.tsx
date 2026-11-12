import { sql } from "drizzle-orm";
import { getDb } from "@/db";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AdminPageHeader, AdminTableShell } from "@/components/admin/page-header";
import { CategoryMappingControl, ConfirmAllButton } from "@/components/admin/category-mapping-row";
import { mainLabel, subLabel, TAXONOMY, OTHER } from "@/lib/taxonomy.mjs";
import { shopCategoryValue } from "@/lib/shop-category";

export const metadata = { title: "Categorieën" };

type MappingRow = {
  id: string;
  supplier_id: string;
  supplier_name: string;
  source_path: string;
  main_category: string | null;
  sub_category: string | null;
  status: string;
  product_count: number;
};

export default async function AdminCategoriesPage() {
  const db = getDb();
  const [mappingResult, placedResult] = await Promise.all([
    db.execute<MappingRow>(sql`
      SELECT c.id, c.supplier_id, s.name AS supplier_name, c.source_path, c.main_category, c.sub_category,
             c.status, c.product_count
      FROM category_mappings c JOIN suppliers s ON s.id = c.supplier_id
      -- Only paths that currently have products; old ones stay stored but out of the way.
      WHERE c.product_count > 0
      ORDER BY s.name, (c.status = 'suggested') DESC, c.product_count DESC
    `),
    db.execute<{ main: string | null; sub: string | null; origin: string | null; n: number }>(sql`
      SELECT main_category AS main, sub_category AS sub, category_origin AS origin, COUNT(*)::int AS n
      FROM products WHERE active GROUP BY 1, 2, 3
    `),
  ]);

  const bySupplier = new Map<string, MappingRow[]>();
  for (const r of mappingResult.rows) {
    const list = bySupplier.get(r.supplier_name) ?? [];
    list.push(r);
    bySupplier.set(r.supplier_name, list);
  }

  // Overview per main category: how many products, how many of them placed by name.
  const perMain = new Map<string, { total: number; guessed: number; noSub: number }>();
  let unplaced = 0;
  for (const r of placedResult.rows) {
    const n = Number(r.n);
    if (!r.main) {
      unplaced += n;
      continue;
    }
    const m = perMain.get(r.main) ?? { total: 0, guessed: 0, noSub: 0 };
    m.total += n;
    if (r.origin === "auto") m.guessed += n;
    if (!r.sub) m.noSub += n;
    perMain.set(r.main, m);
  }
  const num = (n: number) => n.toLocaleString("nl-NL");

  return (
    <div>
      <AdminPageHeader
        title="Categorieën"
        description="Hoe de categorieën van je leveranciers in de 13 hoofdcategorieën van de shop vallen. Een nieuwe leverancierscategorie krijgt automatisch een voorstel op basis van de productnamen; keur het goed of kies zelf. Wijzigingen zijn binnen een paar minuten zichtbaar in de shop."
      />

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[...TAXONOMY.map((m) => m.slug), OTHER.slug].map((slug) => {
          const m = perMain.get(slug);
          if (!m) return null;
          return (
            <div key={slug} className="rounded-xl border border-border bg-card p-4">
              <div className="text-sm font-medium">{mainLabel(slug, "nl")}</div>
              <div className="mt-1 text-2xl font-semibold tabular-nums">{num(m.total)}</div>
              <div className="mt-1 text-xs text-muted-foreground">
                {num(m.guessed)} op naam ingedeeld · {num(m.noSub)} zonder subcategorie
              </div>
            </div>
          );
        })}
        {unplaced > 0 && (
          <div className="rounded-xl border border-dashed border-border p-4">
            <div className="text-sm font-medium">Nog niet ingedeeld</div>
            <div className="mt-1 text-2xl font-semibold tabular-nums">{num(unplaced)}</div>
            <div className="mt-1 text-xs text-muted-foreground">Wordt in de achtergrond ingedeeld</div>
          </div>
        )}
      </div>

      {[...bySupplier].map(([supplierName, rows]) => {
        const suggested = rows.filter((r) => r.status === "suggested");
        return (
          <section key={supplierName} className="mt-10">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-base font-semibold">
                {supplierName}{" "}
                <span className="text-sm font-normal text-muted-foreground">
                  · {rows.length} categorieën
                  {suggested.length > 0 && ` · ${suggested.length} wachten op goedkeuring`}
                </span>
              </h3>
              {suggested.length > 1 && (
                <ConfirmAllButton supplierId={rows[0].supplier_id} count={suggested.length} />
              )}
            </div>
            <AdminTableShell>
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableHead>Categorie van de leverancier</TableHead>
                    <TableHead className="text-right">Producten</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>In de shop</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="max-w-md">
                        <span className="text-sm">{r.source_path}</span>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{num(Number(r.product_count))}</TableCell>
                      <TableCell>
                        {r.status === "confirmed" ? (
                          <Badge variant="secondary">Bevestigd</Badge>
                        ) : (
                          <Badge className="bg-amber-500/15 text-amber-700 hover:bg-amber-500/15 dark:text-amber-400">
                            Voorstel
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <CategoryMappingControl
                          id={r.id}
                          value={shopCategoryValue(r.main_category, r.sub_category)}
                          confirmed={r.status === "confirmed"}
                        />
                        {r.status === "suggested" && (
                          <p className="mt-1 text-[11px] text-muted-foreground">
                            Tot je het goedkeurt, wordt elk product op zijn eigen naam ingedeeld.
                            {r.main_category &&
                              ` Voorstel: ${mainLabel(r.main_category, "nl")}${r.sub_category ? ` › ${subLabel(r.sub_category, "nl")}` : ""}.`}
                          </p>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </AdminTableShell>
          </section>
        );
      })}
    </div>
  );
}
