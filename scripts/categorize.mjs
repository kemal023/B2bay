/**
 * Places every product in the shop's own category tree (src/lib/taxonomy.mjs).
 * Runs inside the translator loop (scripts/translate-catalog.mjs) and can be
 * run on its own:
 *
 *   npx dotenv -e .env.local -- node scripts/categorize.mjs --once
 *   npx dotenv -e .env.local -- node scripts/categorize.mjs --evaluate
 *
 * Per product, in order:
 *  1. An admin's choice (category_origin = "manual") is never touched.
 *  2. A confirmed mapping of the supplier's category path (category_mappings;
 *     the longest matching path prefix wins) sets the main category, and the
 *     subcategory too when the mapping has one.
 *  3. Whatever is still open is guessed from the English product name by a
 *     naive Bayes classifier trained on the products placed by steps 1–2.
 *     Not confident enough: main "other", or no subcategory.
 *
 * Every supplier category path (top two levels) gets a row in
 * category_mappings; unknown ones are added as "suggested", with the
 * classifier's majority vote over their products, for an admin to confirm on
 * /admin/categories.
 *
 * category_key records what a placement was based on (path, name, version of
 * the confirmed mappings), so only products whose inputs changed are redone.
 */
import { neon } from "@neondatabase/serverless";
import { TAXONOMY, OTHER, isSubOf } from "../src/lib/taxonomy.mjs";

const BATCH = 2000;
const RETRAIN_MS = 6 * 60 * 60_000;
// Log-probability margins between the best and second-best class, chosen
// with --evaluate on the catalogue (see the commit that set them).
export const MAIN_MIN_MARGIN = 1;
export const SUB_MIN_MARGIN = 2;
const PATH_DEPTH = 2;

const MAIN_SLUGS = TAXONOMY.map((m) => m.slug);

// ---------------------------------------------------------------------------
// Naive Bayes over the words of the English name
// ---------------------------------------------------------------------------

const STOP = new Set(["and", "for", "the", "with", "pcs", "set", "size", "mm", "cm", "black", "white", "blue", "red"]);
export function tokens(name) {
  return (name ?? "")
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter((w) => w.length > 2 && !STOP.has(w));
}

function train(examples) {
  const docs = new Map();
  const words = new Map();
  const totals = new Map();
  const vocab = new Set();
  for (const { label, name } of examples) {
    docs.set(label, (docs.get(label) ?? 0) + 1);
    let m = words.get(label);
    if (!m) words.set(label, (m = new Map()));
    for (const w of tokens(name)) {
      vocab.add(w);
      m.set(w, (m.get(w) ?? 0) + 1);
      totals.set(label, (totals.get(label) ?? 0) + 1);
    }
  }
  return { docs, words, totals, vocab, n: examples.length };
}

function predict(model, name, allowed) {
  if (!model || model.n === 0) return null;
  const ws = tokens(name).filter((w) => model.vocab.has(w));
  if (ws.length === 0) return null;
  const V = model.vocab.size;
  let best = null;
  let bestScore = -Infinity;
  let second = -Infinity;
  for (const [label, n] of model.docs) {
    if (allowed && !allowed(label)) continue;
    let s = Math.log(n / model.n);
    const m = model.words.get(label);
    const t = model.totals.get(label) ?? 0;
    for (const w of ws) s += Math.log(((m.get(w) ?? 0) + 1) / (t + V));
    if (s > bestScore) [second, best, bestScore] = [bestScore, label, s];
    else if (s > second) second = s;
  }
  return best ? { label: best, margin: second === -Infinity ? Infinity : bestScore - second } : null;
}

// ---------------------------------------------------------------------------
// Mappings
// ---------------------------------------------------------------------------

const topPath = (path) => (path ? path.split(" > ").slice(0, PATH_DEPTH).join(" > ") : null);

async function loadMappings(sql) {
  const rows = await sql`select supplier_id, source_path, main_category, sub_category, status from category_mappings`;
  return new Map(rows.map((r) => [`${r.supplier_id}|${r.source_path}`, r]));
}

/** Confirmed mapping for the longest matching prefix of the path, if any. */
function resolveMapping(mappings, supplierId, path) {
  if (!supplierId || !path) return null;
  const segs = path.split(" > ");
  for (let i = segs.length; i > 0; i--) {
    const m = mappings.get(`${supplierId}|${segs.slice(0, i).join(" > ")}`);
    if (m?.status === "confirmed" && m.main_category) return m;
  }
  return null;
}

/** Changes whenever a confirmed mapping is added, changed or removed. */
async function mappingVersion(sql) {
  const [r] = await sql`
    select count(*)::int as n, coalesce(md5(string_agg(supplier_id || source_path || coalesce(main_category,'') || coalesce(sub_category,''), ',' order by supplier_id, source_path)), '') as h
    from category_mappings where status = 'confirmed'`;
  return `${r.n}-${r.h.slice(0, 12)}`;
}

// ---------------------------------------------------------------------------
// Placing products
// ---------------------------------------------------------------------------

function place(state, p) {
  if (p.category_origin === "manual") return null;
  const m = resolveMapping(state.mappings, p.supplier_id, p.supplier_category_path);
  if (m) {
    let sub = m.sub_category && isSubOf(m.sub_category, m.main_category) ? m.sub_category : null;
    if (!sub) {
      const guess = predict(state.subModels.get(m.main_category), p.name);
      if (guess && guess.margin >= SUB_MIN_MARGIN) sub = guess.label;
    }
    return { main: m.main_category, sub, origin: "mapping" };
  }
  const main = predict(state.mainModel, p.name);
  if (!main || main.margin < MAIN_MIN_MARGIN) return { main: OTHER.slug, sub: null, origin: "auto" };
  const sub = predict(state.subModels.get(main.label), p.name);
  return { main: main.label, sub: sub && sub.margin >= SUB_MIN_MARGIN ? sub.label : null, origin: "auto" };
}

async function loadAll(sql) {
  return sql`
    select id, supplier_id, supplier_category_path, name, category_origin, main_category, sub_category
    from products where active`;
}

function trainState(products, mappings) {
  const mainExamples = [];
  const subExamples = new Map(MAIN_SLUGS.map((s) => [s, []]));
  for (const p of products) {
    let main = null;
    let sub = null;
    if (p.category_origin === "manual") [main, sub] = [p.main_category, p.sub_category];
    else {
      const m = resolveMapping(mappings, p.supplier_id, p.supplier_category_path);
      if (m) [main, sub] = [m.main_category, m.sub_category];
    }
    if (!main || !subExamples.has(main)) continue;
    mainExamples.push({ label: main, name: p.name });
    if (sub && isSubOf(sub, main)) subExamples.get(main).push({ label: sub, name: p.name });
  }
  return {
    mainModel: train(mainExamples),
    subModels: new Map([...subExamples].map(([k, v]) => [k, train(v)])),
    trainedOn: mainExamples.length,
  };
}

/** A "suggested" row for every supplier path not seen before; counts refreshed for all. */
async function refreshMappingRows(sql, state, products) {
  const groups = new Map();
  for (const p of products) {
    const path = topPath(p.supplier_category_path);
    if (!p.supplier_id || !path) continue;
    const key = `${p.supplier_id}|${path}`;
    let g = groups.get(key);
    if (!g) groups.set(key, (g = { supplierId: p.supplier_id, path, names: [], count: 0 }));
    g.count++;
    if (g.names.length < 300) g.names.push(p.name);
  }
  const fresh = [];
  for (const [key, g] of groups) {
    if (state.mappings.has(key)) continue;
    const votes = new Map();
    for (const name of g.names) {
      const guess = predict(state.mainModel, name);
      const main = guess && guess.margin >= MAIN_MIN_MARGIN ? guess.label : OTHER.slug;
      const sub = main !== OTHER.slug ? predict(state.subModels.get(main), name) : null;
      const k = `${main}|${sub && sub.margin >= SUB_MIN_MARGIN ? sub.label : ""}`;
      votes.set(k, (votes.get(k) ?? 0) + 1);
    }
    const mainVotes = new Map();
    for (const [k, n] of votes) mainVotes.set(k.split("|")[0], (mainVotes.get(k.split("|")[0]) ?? 0) + n);
    const main = [...mainVotes].sort((a, b) => b[1] - a[1])[0]?.[0] ?? OTHER.slug;
    const subVotes = [...votes].filter(([k]) => k.startsWith(`${main}|`) && k.split("|")[1]).sort((a, b) => b[1] - a[1]);
    // Only suggest a subcategory when most of the path's products agree on it.
    const sub = subVotes[0] && subVotes[0][1] >= g.names.length * 0.6 ? subVotes[0][0].split("|")[1] : null;
    fresh.push({ ...g, main, sub });
  }
  if (fresh.length) {
    await sql`
      insert into category_mappings (supplier_id, source_path, main_category, sub_category, status, product_count)
      select x.s::uuid, x.p, x.m, nullif(x.u, ''), 'suggested', x.c
      from unnest(${fresh.map((f) => f.supplierId)}::text[], ${fresh.map((f) => f.path)}::text[],
                  ${fresh.map((f) => f.main)}::text[], ${fresh.map((f) => f.sub ?? "")}::text[],
                  ${fresh.map((f) => f.count)}::int[]) as x(s, p, m, u, c)
      on conflict (supplier_id, source_path) do nothing`;
  }
  // Counts only; updated_at stays the moment the mapping itself last changed.
  const all = [...groups.values()];
  if (all.length) {
    await sql`
      update category_mappings c set product_count = x.c
      from unnest(${all.map((g) => g.supplierId)}::text[], ${all.map((g) => g.path)}::text[], ${all.map((g) => g.count)}::int[]) as x(s, p, c)
      where c.supplier_id = x.s::uuid and c.source_path = x.p and c.product_count <> x.c`;
  }
  return fresh.length;
}

const state = { version: null, trainedAt: 0, mappings: new Map(), mainModel: null, subModels: new Map() };

// After a pass finds nothing to do, the next check waits this long: the
// translator calls this before every step, and checking means scanning the
// whole catalogue.
const IDLE_CHECK_MS = 60_000;
let idleUntil = 0;

/** One batch. Returns how many products were (re)placed; 0 when all are up to date. */
export async function categorizeStep(sql, log = () => {}) {
  if (Date.now() < idleUntil) return 0;
  const version = await mappingVersion(sql);
  if (version !== state.version || Date.now() - state.trainedAt > RETRAIN_MS) {
    state.mappings = await loadMappings(sql);
    const products = await loadAll(sql);
    Object.assign(state, trainState(products, state.mappings));
    const added = await refreshMappingRows(sql, state, products);
    state.mappings = await loadMappings(sql);
    state.version = version;
    state.trainedAt = Date.now();
    log(`categorieën: getraind op ${state.trainedOn} producten${added ? `, ${added} nieuwe leverancierscategorieën voorgesteld` : ""}`);
  }

  const rows = await sql`
    select id, supplier_id, supplier_category_path, name, category_origin, main_category, sub_category
    from products
    where coalesce(category_origin, '') <> 'manual'
      and category_key is distinct from md5(coalesce(supplier_category_path, '') || '|' || name || '|' || ${version})
    limit ${BATCH}`;
  if (rows.length === 0) {
    idleUntil = Date.now() + IDLE_CHECK_MS;
    return 0;
  }

  const out = rows.map((p) => ({ id: p.id, ...(place(state, p) ?? { main: null, sub: null, origin: null }) }));
  await sql`
    update products p set main_category = x.m, sub_category = nullif(x.s, ''), category_origin = x.o,
      category_key = md5(coalesce(p.supplier_category_path, '') || '|' || p.name || '|' || ${version})
    from unnest(${out.map((o) => o.id)}::uuid[], ${out.map((o) => o.main)}::text[],
                ${out.map((o) => o.sub ?? "")}::text[], ${out.map((o) => o.origin)}::text[]) as x(id, m, s, o)
    where p.id = x.id`;
  return rows.length;
}

/** How well names predict the mapped categories, on products held out from training. */
async function evaluate(sql) {
  const mappings = await loadMappings(sql);
  const products = (await loadAll(sql)).sort(() => Math.random() - 0.5);
  const labelled = products
    .map((p) => ({ p, m: resolveMapping(mappings, p.supplier_id, p.supplier_category_path) }))
    .filter((x) => x.m);
  const test = labelled.slice(0, 4000);
  const testIds = new Set(test.map((x) => x.p.id));
  const st = trainState(products.filter((p) => !testIds.has(p.id)), mappings);
  for (const margin of [0, 1, 2, 3]) {
    let placed = 0;
    let right = 0;
    let subPlaced = 0;
    let subRight = 0;
    let subTotal = 0;
    for (const { p, m } of test) {
      const g = predict(st.mainModel, p.name);
      if (g && g.margin >= margin) {
        placed++;
        if (g.label === m.main_category) right++;
      }
      if (m.sub_category) {
        subTotal++;
        const s = predict(st.subModels.get(m.main_category), p.name);
        if (s && s.margin >= margin) {
          subPlaced++;
          if (s.label === m.sub_category) subRight++;
        }
      }
    }
    console.log(
      `marge ≥ ${margin}: hoofd ${((placed / test.length) * 100).toFixed(0)}% ingedeeld, daarvan ${((right / placed) * 100).toFixed(1)}% goed · ` +
        `sub ${((subPlaced / subTotal) * 100).toFixed(0)}% ingedeeld, daarvan ${((subRight / subPlaced) * 100).toFixed(1)}% goed`,
    );
  }
}

// Run directly (not when imported by the translator).
if (process.argv[1]?.endsWith("categorize.mjs")) {
  const sql = neon(process.env.DATABASE_URL);
  if (process.argv.includes("--evaluate")) {
    await evaluate(sql);
  } else if (process.argv.includes("--once")) {
    let total = 0;
    for (;;) {
      const n = await categorizeStep(sql, console.log);
      if (!n) break;
      total += n;
      console.log(`ingedeeld: ${total}`);
    }
  }
}
