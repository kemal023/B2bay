/**
 * Loads the hand-written starting mappings (scripts/category-seed.mjs) as
 * confirmed rows. Safe to re-run: a row an admin already changed is left alone.
 *
 *   npx dotenv -e .env.local -- node scripts/seed-category-mappings.mjs
 */
import { neon } from "@neondatabase/serverless";
import { isSubOf, TAXONOMY } from "../src/lib/taxonomy.mjs";
import { SEED } from "./category-seed.mjs";

const sql = neon(process.env.DATABASE_URL);
const mains = new Set(TAXONOMY.map((m) => m.slug));

for (const [supplierName, paths] of Object.entries(SEED)) {
  const [supplier] = await sql`select id from suppliers where name = ${supplierName}`;
  if (!supplier) {
    console.log(`${supplierName}: niet gevonden, overgeslagen`);
    continue;
  }
  const rows = Object.entries(paths).map(([path, [main, sub]]) => {
    if (!mains.has(main)) throw new Error(`${supplierName} "${path}": onbekende hoofdcategorie ${main}`);
    if (sub && !isSubOf(sub, main)) throw new Error(`${supplierName} "${path}": ${sub} hoort niet bij ${main}`);
    return { path, main, sub };
  });
  await sql`
    insert into category_mappings (supplier_id, source_path, main_category, sub_category, status)
    select ${supplier.id}::uuid, x.p, x.m, nullif(x.s, ''), 'confirmed'
    from unnest(${rows.map((r) => r.path)}::text[], ${rows.map((r) => r.main)}::text[], ${rows.map((r) => r.sub ?? "")}::text[]) as x(p, m, s)
    on conflict (supplier_id, source_path) do update
      set main_category = excluded.main_category, sub_category = excluded.sub_category,
          status = 'confirmed', updated_at = now()
      where category_mappings.status = 'suggested'`;
  console.log(`${supplierName}: ${rows.length} koppelingen`);
}
