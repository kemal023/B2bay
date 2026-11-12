/**
 * One-off clean-up of product texts that name a supplier (see
 * src/lib/supplier-scrub.mjs). New and changed texts are cleaned by the
 * supplier sync itself; this does the rows already in the database.
 *
 *   npx dotenv -e .env.local -- node scripts/scrub-supplier-traces.mjs
 *
 * Every text column is cleaned so customers see the result right away. The
 * description's translation marker is cleared too, so the translator redoes
 * the other languages from the cleaned English (machine translations had
 * turned "Maxy" into things like "Max.").
 */
import { neon } from "@neondatabase/serverless";
import { scrubSupplierTraces } from "../src/lib/supplier-scrub.mjs";

const sql = neon(process.env.DATABASE_URL);
const COLS = ["source_description", "description", "description_nl", "description_de", "description_fr",
  "source_name", "name", "name_nl", "name_de", "name_fr"];
const match = COLS.map((c) => `${c} ~* 'maxy|annapol'`).join(" or ");
const rows = await sql.query(`select id, ${COLS.join(", ")} from products where ${match}`);

let changed = 0;
for (const r of rows) {
  const next = {};
  for (const c of COLS) if (r[c]) next[c] = scrubSupplierTraces(r[c]);
  const descChanged = ["source_description", "description"].some((c) => r[c] && next[c] !== r[c]);
  await sql.query(
    `update products set ${COLS.map((c, i) => `${c} = coalesce($${i + 2}, ${c})`).join(", ")}
       ${descChanged ? ", desc_tr_hash = null" : ""}
     where id = $1`,
    [r.id, ...COLS.map((c) => (r[c] ? next[c] : null))],
  );
  changed++;
}
const [left] = await sql.query(`select count(*)::int n from products where ${COLS.map((c) => `${c} ~* '\\mmaxy\\M|annapol'`).join(" or ")}`);
console.log(`opgeschoond: ${changed} producten · nog met een vermelding: ${left.n}`);
