/**
 * Shows how far the translation service (scripts/translate-catalog.mjs) has got.
 *
 *   npx dotenv -e .env.local -- node scripts/translate-progress.mjs
 */
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);

const [row] = await sql.query(`
  SELECT COUNT(*)::int AS totaal,
         COUNT(name_tr_hash)::int AS namen,
         COUNT(cat_tr_hash) FILTER (WHERE category IS NOT NULL)::int AS cat,
         COUNT(*) FILTER (WHERE category IS NOT NULL)::int AS cat_totaal,
         COUNT(desc_tr_hash)::int AS oms,
         COUNT(*) FILTER (WHERE coalesce(description, '') <> '')::int AS oms_totaal,
         COUNT(name_de)::int AS namen_de, COUNT(name_fr)::int AS namen_fr,
         COUNT(description_de)::int AS oms_de, COUNT(description_fr)::int AS oms_fr,
         COUNT(*) FILTER (WHERE translation_priority IS NOT NULL)::int AS voorrang
  FROM products WHERE active`);

const nl = (n) => n.toLocaleString("nl-NL");
const pct = (a, b) => `${((a / Math.max(b, 1)) * 100).toFixed(1)}%`;

console.log(`actieve producten        : ${nl(row.totaal)}`);
console.log(`namen EN/NL              : ${nl(row.namen)}  (${pct(row.namen, row.totaal)})`);
console.log(`categorieën EN/NL        : ${nl(row.cat)}  (${pct(row.cat, row.cat_totaal)})`);
console.log(`omschrijvingen EN/NL     : ${nl(row.oms)}  (${pct(row.oms, row.totaal)})`);
console.log(`namen DE / FR            : ${nl(row.namen_de)} / ${nl(row.namen_fr)}  (${pct(row.namen_de, row.totaal)} / ${pct(row.namen_fr, row.totaal)})`);
console.log(`omschrijvingen DE / FR   : ${nl(row.oms_de)} / ${nl(row.oms_fr)}  (${pct(row.oms_de, row.oms_totaal)} / ${pct(row.oms_fr, row.oms_totaal)})`);
console.log(`met voorrang             : ${nl(row.voorrang)}`);

process.exit(0);
