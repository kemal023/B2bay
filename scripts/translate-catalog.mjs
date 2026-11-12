/**
 * Translation service for the whole catalogue. Runs continuously as the
 * `translator` container (docker-compose.yml) and keeps every product's
 * name, category and description available in English and Dutch — and from
 * the English also German and French — whatever language the supplier sends,
 * including suppliers added later.
 *
 *   docker compose up -d translator            (normal operation)
 *   npx dotenv -e .env.local -- node scripts/translate-catalog.mjs --once
 *
 * How it decides what to do:
 *  - Language: suppliers.source_language ("pl", "en", …) or, for "auto" and
 *    hand-made products, LibreTranslate's language detection.
 *  - What is stale: name_tr_hash / cat_tr_hash / desc_tr_hash are "done"
 *    markers. The supplier sync clears a marker when that field's source
 *    text changes, and an admin edit clears all three, so only the affected
 *    field is redone. Checking for NULL keeps each step cheap; comparing
 *    hashes would mean re-reading ~50M characters of descriptions every time.
 *  - Order: descriptions visitors have opened, then names, then categories,
 *    then the description backlog. Names are short and shown everywhere;
 *    descriptions are ~50M characters and take days.
 *
 * Every translation passes src/lib/translation-guard.mjs. Anything it can't
 * trust falls back to English (for Dutch) or is left out (never Polish).
 */
import { neon } from "@neondatabase/serverless";
import {
  expandPolishAbbreviations,
  inchesKept,
  isLikelyPolish,
  polishWordCount,
  protectForForeign,
  protectTerms,
  rejectReason,
  restoreTerms,
  sentenceCase,
  untranslatedWords,
} from "../src/lib/translation-guard.mjs";
import { categorizeStep } from "./categorize.mjs";

const sql = neon(process.env.DATABASE_URL);
const TRANSLATE_URL = process.env.TRANSLATE_URL ?? "http://localhost:5050";
const NAME_BATCH = Number(process.env.TRANSLATE_BATCH ?? 25);
const DESC_BATCH = Number(process.env.TRANSLATE_DESC_BATCH ?? 4);
const PAUSE_MS = Number(process.env.TRANSLATE_PAUSE_MS ?? 300);
// How long to wait for new work once everything is translated.
const IDLE_MS = Number(process.env.TRANSLATE_IDLE_MS ?? 5 * 60_000);
const ONCE = process.argv.includes("--once");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const nl = (n) => n.toLocaleString("nl-NL");
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);


// ---------------------------------------------------------------------------
// LibreTranslate
// ---------------------------------------------------------------------------

let supported = new Set();

async function loadLanguages() {
  const res = await fetch(`${TRANSLATE_URL}/languages`, { signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error(`LibreTranslate ${res.status}`);
  supported = new Set((await res.json()).map((l) => l.code));
}

async function callTranslate(texts, from, to) {
  const res = await fetch(`${TRANSLATE_URL}/translate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ q: texts, source: from, target: to, format: "text" }),
    signal: AbortSignal.timeout(240_000),
  });
  if (!res.ok) throw new Error(`LibreTranslate ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  const out = Array.isArray(data.translatedText) ? data.translatedText : [data.translatedText];
  if (out.length !== texts.length) throw new Error(`${out.length} resultaten voor ${texts.length} teksten`);
  return out;
}

async function detect(text) {
  const res = await fetch(`${TRANSLATE_URL}/detect`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ q: text.slice(0, 1000) }),
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) return null;
  const [best] = await res.json();
  return best?.language ?? null;
}

/**
 * Translates distinct strings with caching and the guardrails. Returns a Map
 * of accepted translations only; callers decide the fallback.
 *
 * allowPolish: also accept a pl -> en result with a Polish word left in;
 * the caller then compares it with the alternatives (names only).
 */
async function translateTexts(texts, from, to, { allowPolish = false } = {}) {
  const unique = [...new Set(texts.filter((t) => t && t.trim()))];
  const result = new Map();
  if (unique.length === 0 || from === to) return result;

  const toEnglish = to === "en";
  const foreign = to === "de" || to === "fr";
  const guard = { glossary: to === "nl" && from === "en", minRatio: toEnglish ? 0.45 : 0.6 };
  const accept = (src, out) =>
    rejectReason(src, out, guard) === null &&
    !(from === "pl" && !allowPolish && isLikelyPolish(out)) &&
    (!foreign || inchesKept(src, out));

  const cached = await sql.query(
    `SELECT source_text, translated_text FROM translations
     WHERE source_lang = $1 AND target_lang = $2 AND source_text = ANY($3)`,
    [from, to, unique],
  );
  const stale = [];
  for (const r of cached) {
    if (accept(r.source_text, r.translated_text)) result.set(r.source_text, r.translated_text);
    else stale.push(r.source_text);
  }
  if (stale.length > 0) {
    await sql.query(
      `DELETE FROM translations WHERE source_lang = $1 AND target_lang = $2 AND source_text = ANY($3)`,
      [from, to, stale],
    );
  }

  const missing = unique.filter((t) => !result.has(t));
  if (missing.length === 0) return result;

  // Pipe-separated names lose whole segments when sent as one string.
  const parts = missing.map((t) =>
    t.split(" | ").map((s) => (foreign ? protectForForeign(s) : protectTerms(s, { glossary: guard.glossary }))),
  );
  const raw = await callTranslate(parts.flat().map((p) => p.text), from, to);

  const fresh = [];
  let i = 0;
  missing.forEach((src, n) => {
    const out = parts[n].map((p) => restoreTerms((raw[i++] ?? "").trim(), p.originals)).join(" | ");
    if (accept(src, out)) {
      result.set(src, out);
      fresh.push([src, out]);
    }
  });

  if (fresh.length > 0) {
    await sql.query(
      `INSERT INTO translations (source_lang, target_lang, source_text, translated_text)
       SELECT $1, $2, s, t FROM unnest($3::text[], $4::text[]) AS x(s, t)
       ON CONFLICT DO NOTHING`,
      [from, to, fresh.map(([s]) => s), fresh.map(([, t]) => t)],
    );
  }
  return result;
}

// ---------------------------------------------------------------------------
// Source language
// ---------------------------------------------------------------------------

async function assignLanguages() {
  // Suppliers with a configured language: one statement for all their rows.
  // A changed language invalidates every translation of that product.
  await sql.query(`
    UPDATE products p SET source_lang = s.source_language,
      name_tr_hash = NULL, cat_tr_hash = NULL, desc_tr_hash = NULL
    FROM suppliers s
    WHERE p.supplier_id = s.id AND s.source_language <> 'auto'
      AND p.source_lang IS DISTINCT FROM s.source_language`);

  // "auto" suppliers and hand-made products: detect per product.
  const rows = await sql.query(`
    SELECT p.id, p.name, p.description FROM products p
    LEFT JOIN suppliers s ON s.id = p.supplier_id
    WHERE p.source_lang IS NULL AND (s.id IS NULL OR s.source_language = 'auto')
    LIMIT 200`);
  for (const r of rows) {
    const lang = (await detect(`${r.name}. ${r.description ?? ""}`)) ?? "en";
    await sql.query(`UPDATE products SET source_lang = $1 WHERE id = $2`, [lang, r.id]);
  }
  return rows.length;
}

// ---------------------------------------------------------------------------
// Names
// ---------------------------------------------------------------------------

/**
 * Polish names into English. Annapol abbreviates heavily ("Rękawice nitr.
 * gran.-czarne"), and a translation with one such word left in used to be
 * thrown away, leaving the far more Polish original on the site. Now the
 * name is tried as is and with the abbreviations written out, and the least
 * Polish of those and the current name wins (the current name wins ties).
 * The other checks (codes, numbers, length) still apply to every attempt.
 */
async function polishNamesToEnglish(group) {
  const sources = group.map((p) => p.source);
  const expanded = new Map(sources.map((s) => [s, expandPolishAbbreviations(s)]));
  const plain = await translateTexts(sources, "pl", "en", { allowPolish: true });
  const changed = [...expanded].filter(([s, e]) => s !== e).map(([, e]) => e);
  const written = await translateTexts(changed, "pl", "en", { allowPolish: true });

  for (const p of group) {
    // The current name first: a fresh attempt must be strictly less Polish to
    // replace it, because on equal footing the earlier one was often better
    // ("Chopper" became "Splitter", "Tape measure" "Curved measurement").
    const candidates = [p.name, written.get(expanded.get(p.source)), plain.get(p.source)].filter(Boolean);
    let best = candidates[0];
    for (const c of candidates) {
      // ...and must not get there by dropping words ("Poziomnica stand…" lost the "spirit level").
      if (polishWordCount(c) < polishWordCount(best) && c.length >= best.length * 0.8) best = c;
    }
    p.en = best;
  }
}

async function translateNames() {
  const rows = await sql.query(`
    SELECT p.id, p.name, p.source_name, p.source_lang, p.customized FROM products p
    WHERE p.source_lang IS NOT NULL AND p.name_tr_hash IS NULL
    ORDER BY p.active DESC, (p.stock_qty > 0) DESC
    LIMIT ${NAME_BATCH}`);
  if (rows.length === 0) return 0;

  const plans = [];
  for (const r of rows) {
    // An admin's edit is in whatever language they typed (often Dutch), not
    // the supplier's, so it is detected rather than assumed.
    const lang = r.customized ? ((await detect(r.name)) ?? "en") : r.source_lang;
    const source = r.customized ? r.name : (r.source_name ?? r.name);
    // en: English text, or null while it still has to be translated.
    // english: whether `en` really is English — false for a language
    // LibreTranslate can't handle, which must not be fed to en -> nl.
    let en = null;
    let english = true;
    if (lang === "en") en = source;
    else if (r.customized) [en, english] = [r.name, false]; // the admin's own wording stays
    else if (r.name !== source && !isLikelyPolish(r.name)) en = r.name; // translated earlier
    else if (!supported.has(lang)) [en, english] = [r.name, false];
    plans.push({ ...r, lang, source, en, english });
  }

  // Source -> English, grouped per language.
  for (const lang of new Set(plans.filter((p) => p.en === null).map((p) => p.lang))) {
    const group = plans.filter((p) => p.en === null && p.lang === lang);
    if (lang === "pl") {
      await polishNamesToEnglish(group);
      continue;
    }
    const done = await translateTexts(group.map((p) => p.source), lang, "en");
    for (const p of group) {
      // Untrustworthy translation: keep what we had rather than nothing.
      p.en = done.get(p.source) ?? p.name;
    }
  }

  // English -> Dutch. Names that are still partly Polish stay as they are.
  const translatable = (p) => p.english && p.lang !== "nl" && !isLikelyPolish(p.en);
  const nlDone = await translateTexts(plans.filter(translatable).map((p) => p.en), "en", "nl");
  for (const p of plans) {
    p.nl = p.lang === "nl" ? p.source : (nlDone.get(p.en) ?? p.en);
  }

  await sql.query(
    `UPDATE products p SET
       name = x.en, name_nl = x.nl, name_tr_hash = md5(x.en),
       name_de = NULL, name_fr = NULL
     FROM unnest($1::uuid[], $2::text[], $3::text[]) AS x(id, en, nl)
     WHERE p.id = x.id`,
    [plans.map((p) => p.id), plans.map((p) => p.en), plans.map((p) => p.nl)],
  );
  return rows.length;
}

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

async function translateCategories() {
  const groups = await sql.query(`
    SELECT p.supplier_id, p.source_category, p.category, p.customized, COUNT(*)::int AS n
    FROM products p
    WHERE p.source_lang IS NOT NULL AND p.category IS NOT NULL AND p.cat_tr_hash IS NULL
    GROUP BY 1, 2, 3, 4`);
  if (groups.length === 0) return 0;

  // A supplier's categories are not necessarily in its product language
  // (Annapol sends Polish products under English category names), so the
  // language is detected over all of that supplier's categories together.
  const catLang = new Map();
  for (const supplierId of new Set(groups.map((g) => g.supplier_id))) {
    const cats = await sql.query(
      `SELECT DISTINCT source_category FROM products
       WHERE supplier_id IS NOT DISTINCT FROM $1 AND source_category IS NOT NULL LIMIT 200`,
      [supplierId],
    );
    const text = cats.map((c) => c.source_category).join(". ");
    catLang.set(supplierId, text ? ((await detect(text)) ?? "en") : "en");
  }

  for (const g of groups) {
    const lang = catLang.get(g.supplier_id);
    const source = g.source_category ?? g.category;
    let en = g.customized ? g.category : source;
    let english = g.customized || lang === "en";
    if (!english && supported.has(lang)) {
      const done = (await translateTexts([source], lang, "en")).get(source);
      if (done) [en, english] = [done, true];
    }
    const nlText =
      lang === "nl" && !g.customized
        ? source
        : english
          ? ((await translateTexts([en], "en", "nl")).get(en) ?? en)
          : en;

    await sql.query(
      `UPDATE products p SET category = $4, category_nl = $5, cat_tr_hash = md5($4::text),
         category_de = NULL, category_fr = NULL
       WHERE p.supplier_id IS NOT DISTINCT FROM $1
         AND p.source_category IS NOT DISTINCT FROM $2
         AND p.category = $3 AND p.customized = $6 AND p.cat_tr_hash IS NULL`,
      [g.supplier_id, g.source_category, g.category, en, nlText, g.customized],
    );
  }
  return groups.length;
}

// ---------------------------------------------------------------------------
// Descriptions
// ---------------------------------------------------------------------------

/** Sentences, so repeated boilerplate is cached and one bad sentence costs one sentence. */
function segments(text) {
  const out = [];
  for (const s of text.split(/(?<=[.!?])\s+(?=[\p{Lu}\d"„(])/u)) {
    let rest = s.trim();
    while (rest.length > 600) {
      const cut = rest.lastIndexOf(" ", 600);
      const at = cut > 200 ? cut : 600;
      out.push(rest.slice(0, at).trim());
      rest = rest.slice(at).trim();
    }
    if (rest) out.push(rest);
  }
  return out;
}

async function translateDescriptions(priorityOnly) {
  const rows = await sql.query(`
    SELECT p.id, p.description, p.source_description, p.source_lang, p.customized FROM products p
    WHERE p.source_lang IS NOT NULL AND p.desc_tr_hash IS NULL
      ${priorityOnly ? "AND p.translation_priority IS NOT NULL" : ""}
    ORDER BY p.translation_priority DESC NULLS LAST, p.active DESC, (p.stock_qty > 0) DESC,
             (p.image_url IS NOT NULL) DESC
    LIMIT ${DESC_BATCH}`);
  if (rows.length === 0) return 0;

  const plans = [];
  for (const r of rows) {
    if (r.customized) {
      // The admin's own text, in whatever language they typed it.
      const text = r.description ?? "";
      const lang = text.trim() ? ((await detect(text)) ?? "en") : "en";
      let nlText = text || null;
      if (text.trim() && lang === "en") {
        const segs = segments(text);
        const done = await translateTexts(segs, "en", "nl");
        nlText = segs.map((s) => done.get(s) ?? s).join(" ");
      }
      plans.push({ id: r.id, en: r.description, nl: nlText });
      continue;
    }

    const source = r.source_description ?? r.description ?? "";
    let en;
    if (!source.trim()) en = null;
    else if (r.source_lang === "en") en = source;
    else if (r.description && r.description !== source && !isLikelyPolish(r.description)) en = r.description;
    else if (!supported.has(r.source_lang)) en = null;
    else {
      const segs = segments(source);
      const done = await translateTexts(segs, r.source_lang, "en");
      // A sentence that couldn't be translated reliably is dropped: a
      // description with a sentence missing beats one with Polish in it.
      const kept = segs.map((s) => done.get(s)).filter(Boolean);
      en = kept.length > 0 ? kept.join(" ") : null;
    }

    let nlText = null;
    if (en) {
      if (r.source_lang === "nl") nlText = source;
      else {
        const segs = segments(en);
        const done = await translateTexts(segs.filter((s) => !isLikelyPolish(s)), "en", "nl");
        // Here a failed sentence stays English: still readable, nothing lost.
        nlText = segs.map((s) => done.get(s) ?? s).join(" ");
      }
    }
    plans.push({ id: r.id, en, nl: nlText });
  }

  await sql.query(
    `UPDATE products p SET
       description = x.en, description_nl = x.nl, translation_priority = NULL,
       description_de = NULL, description_fr = NULL,
       desc_tr_hash = md5(coalesce(x.en, ''))
     FROM unnest($1::uuid[], $2::text[], $3::text[]) AS x(id, en, nl)
     WHERE p.id = x.id`,
    [plans.map((p) => p.id), plans.map((p) => p.en), plans.map((p) => p.nl)],
  );
  return rows.length;
}

// ---------------------------------------------------------------------------
// German and French
//
// Translated from the final English, once the English/Dutch pass for that
// field is done (its *_tr_hash is set). That pass resets these columns to
// NULL whenever it rewrites the English, so NULL again means "to do". Until
// then the storefront shows English. An admin's own wording (customized) is
// in an unknown language and is copied rather than translated.
// ---------------------------------------------------------------------------

const EXTRA_LANGS = ["de", "fr"];

/**
 * Bumped when the way names are put into German/French improves, so names
 * done the old way are redone. Until a product's turn comes, its current
 * translation stays on the site.
 *   1: sentence-case retry for skipped words, inch sizes protected.
 */
const NAME_EXTRA_VERSION = 1;

/** Restores the capitals of words that came through the lower-cased retry untranslated. */
function restoreCase(source, text) {
  let out = text;
  for (const word of new Set(source.match(/\b[A-Z][a-z]{2,}\b/g) ?? [])) {
    out = out.replace(new RegExp(`\\b${word.toLowerCase()}\\b`, "g"), word);
  }
  // The first real word keeps its capital ("DA185A porte cintre" -> "Porte").
  const firstWord = (s) => s.split(/\s+/).findIndex((t) => /^\p{L}/u.test(t) && !/\d/.test(t));
  const srcTokens = source.split(/\s+/);
  const si = firstWord(source);
  if (si >= 0 && /^\p{Lu}/u.test(srcTokens[si])) {
    const tokens = out.split(" ");
    const i = firstWord(out);
    if (i >= 0) tokens[i] = tokens[i][0].toUpperCase() + tokens[i].slice(1);
    out = tokens.join(" ");
  }
  return out;
}

/**
 * English names into German or French. A name that comes back with English
 * words left in is tried once more in sentence case; the attempt with the
 * fewest untranslated words wins (a tie keeps the first).
 */
async function translateNamesForeign(names, lang) {
  const first = await translateTexts(names, "en", lang);
  const retry = new Map();
  for (const name of names) {
    const out = first.get(name);
    if (out !== undefined && untranslatedWords(name, out) === 0) continue;
    const variant = sentenceCase(name);
    if (variant !== name) retry.set(name, variant);
  }
  const second = retry.size ? await translateTexts([...retry.values()], "en", lang) : new Map();

  const result = new Map();
  for (const name of names) {
    const a = first.get(name);
    const raw = retry.has(name) ? second.get(retry.get(name)) : undefined;
    const b = raw === undefined ? undefined : restoreCase(name, raw);
    // Fewer English words left only counts if nothing was dropped to get
    // there ("Candy Set Desserts Ice Cream Cookies" lost half its words).
    const better =
      b !== undefined &&
      (a === undefined ||
        (untranslatedWords(name, b) < untranslatedWords(name, a) && b.length >= a.length * 0.85));
    const best = better ? b : a;
    if (best !== undefined) result.set(name, best);
  }
  return result;
}

async function translateExtraNames() {
  const langs = EXTRA_LANGS.filter((l) => supported.has(l));
  if (langs.length === 0) return 0;
  const rows = await sql.query(`
    SELECT p.id, p.name, p.customized FROM products p
    WHERE p.name_tr_hash IS NOT NULL
      AND (p.name_de IS NULL OR p.name_fr IS NULL OR p.name_extra_version < ${NAME_EXTRA_VERSION})
    ORDER BY (p.name_de IS NULL OR p.name_fr IS NULL) DESC, p.active DESC, (p.stock_qty > 0) DESC
    LIMIT ${NAME_BATCH}`);
  if (rows.length === 0) return 0;

  const names = [...new Set(rows.filter((r) => !r.customized && !isLikelyPolish(r.name)).map((r) => r.name))];
  const done = {};
  for (const lang of langs) done[lang] = await translateNamesForeign(names, lang);
  const pick = (lang, r) => done[lang]?.get(r.name) ?? r.name;

  await sql.query(
    `UPDATE products p SET
       name_de = CASE WHEN $4 THEN x.de ELSE p.name_de END,
       name_fr = CASE WHEN $5 THEN x.fr ELSE p.name_fr END,
       name_extra_version = ${NAME_EXTRA_VERSION}
     FROM unnest($1::uuid[], $2::text[], $3::text[]) AS x(id, de, fr) WHERE p.id = x.id`,
    [
      rows.map((r) => r.id),
      rows.map((r) => pick("de", r)),
      rows.map((r) => pick("fr", r)),
      langs.includes("de"),
      langs.includes("fr"),
    ],
  );
  return rows.length;
}

async function translateExtraCategories(lang) {
  const groups = await sql.query(`
    SELECT DISTINCT p.category FROM products p
    WHERE p.cat_tr_hash IS NOT NULL AND p.category IS NOT NULL AND p.category_${lang} IS NULL
    LIMIT 50`);
  if (groups.length === 0) return 0;

  const cats = groups.map((g) => g.category);
  const done = await translateTexts(cats, "en", lang);
  await sql.query(
    `UPDATE products p SET category_${lang} = x.t
     FROM unnest($1::text[], $2::text[]) AS x(c, t)
     WHERE p.category = x.c AND p.cat_tr_hash IS NOT NULL AND p.category_${lang} IS NULL`,
    [cats, cats.map((c) => done.get(c) ?? c)],
  );
  return groups.length;
}

async function translateExtraDescriptions(lang) {
  const rows = await sql.query(`
    SELECT p.id, p.description, p.customized FROM products p
    WHERE p.desc_tr_hash IS NOT NULL AND p.description_${lang} IS NULL
      AND coalesce(p.description, '') <> ''
    ORDER BY p.active DESC, (p.stock_qty > 0) DESC, (p.image_url IS NOT NULL) DESC
    LIMIT ${DESC_BATCH}`);
  if (rows.length === 0) return 0;

  const texts = [];
  for (const r of rows) {
    if (r.customized) {
      texts.push(r.description);
      continue;
    }
    const segs = segments(r.description);
    const done = await translateTexts(segs.filter((s) => !isLikelyPolish(s)), "en", lang);
    // A sentence that failed the guard stays English: readable, nothing lost.
    texts.push(segs.map((s) => done.get(s) ?? s).join(" "));
  }
  await sql.query(
    `UPDATE products p SET description_${lang} = x.t
     FROM unnest($1::uuid[], $2::text[]) AS x(id, t) WHERE p.id = x.id`,
    [rows.map((r) => r.id), texts],
  );
  return rows.length;
}

// ---------------------------------------------------------------------------
// Main loop
// ---------------------------------------------------------------------------

const totals = { names: 0, categories: 0, descriptions: 0, placed: 0 };

/** German/French work, only for languages LibreTranslate has loaded. */
async function extraStep(kind) {
  for (const lang of EXTRA_LANGS) {
    if (!supported.has(lang)) continue;
    const n =
      kind === "categories"
          ? await translateExtraCategories(lang)
          : await translateExtraDescriptions(lang);
    if (n) return n;
  }
  return 0;
}

async function step() {
  // Shop categories first: no translation calls, a few seconds per 2,000
  // products, and a new or changed product should be findable in the menu
  // right away (scripts/categorize.mjs).
  let placed = await categorizeStep(sql, log);
  if (placed) return (totals.placed += placed), true;
  // English and Dutch first: they are what most visitors see.
  let n = await translateDescriptions(true);
  if (n) return (totals.descriptions += n), true;
  n = await translateNames();
  if (n) return (totals.names += n), true;
  n = await translateCategories();
  if (n) return (totals.categories += n), true;
  // Short German/French texts before the long English/Dutch backlog.
  n = await translateExtraNames();
  if (n) return (totals.names += n), true;
  n = await extraStep("categories");
  if (n) return (totals.categories += n), true;
  n = await translateDescriptions(false);
  if (n) return (totals.descriptions += n), true;
  n = await extraStep("descriptions");
  if (n) return (totals.descriptions += n), true;
  return false;
}

async function main() {
  let failures = 0;
  let steps = 0;
  for (;;) {
    let worked = false;
    try {
      // New suppliers/products only arrive via sync, so the language pass
      // (a scan over every product) runs now and then, not every step.
      if (steps % 100 === 0) {
        await loadLanguages();
        await assignLanguages();
      }
      worked = await step();
      failures = 0;
    } catch (err) {
      failures++;
      log(`fout (${failures}): ${err.message}`);
      // LibreTranslate recycles its worker every 250 requests and stalls for
      // a few minutes while doing so; wait it out rather than crash.
      await sleep(Math.min(failures, 6) * 30_000);
      continue;
    }

    if (worked) {
      if (++steps % 25 === 0) {
        log(`namen ${nl(totals.names)} · categorieën ${nl(totals.categories)} · omschrijvingen ${nl(totals.descriptions)} · ingedeeld ${nl(totals.placed)}`);
      }
      await sleep(PAUSE_MS);
    } else {
      if (ONCE) break;
      log("alles bijgewerkt — wachten op nieuwe of gewijzigde producten");
      await sleep(IDLE_MS);
      steps = 0; // re-run the language pass after idling
    }
  }
  log(`klaar: ${JSON.stringify(totals)}`);
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  },
);
