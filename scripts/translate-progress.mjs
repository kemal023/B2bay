/**
 * Shows how far the translation service (scripts/translate-catalog.mjs) has got.
 *
 *   npx dotenv run -f .env.local -- node scripts/translate-progress.mjs
 */
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);

const [row] = await sql.query(`
  SELECT COUNT(*)::int AS totaal,
         COUNT(name_tr_hash)::int AS namen,
         COUNT(cat_tr_hash) FILTER (WHERE category IS NOT NULL)::int AS cat,
         COUNT(*) FILTER (WHERE category IS NOT NULL)::int AS cat_totaal,
         COUNT(desc_tr_hash)::int AS oms,
         COUNT(*) FILTER (WHERE translation_priority IS NOT NULL)::int AS voorrang
  FROM products WHERE active`);

const nl = (n) => n.toLocaleString("nl-NL");
const pct = (a, b) => `${((a / Math.max(b, 1)) * 100).toFixed(1)}%`;

console.log(`actieve producten : ${nl(row.totaal)}`);
console.log(`namen             : ${nl(row.namen)}  (${pct(row.namen, row.totaal)})`);
console.log(`categorieën       : ${nl(row.cat)}  (${pct(row.cat, row.cat_totaal)})`);
console.log(`omschrijvingen    : ${nl(row.oms)}  (${pct(row.oms, row.totaal)})`);
console.log(`met voorrang      : ${nl(row.voorrang)}`);

process.exit(0);
