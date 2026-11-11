import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "@/db";
import { translations } from "@/db/schema";
import {
  isLikelyPolish,
  protectTerms,
  rejectReason,
  restoreTerms,
} from "./translation-guard.mjs";

/**
 * Client for the self-hosted LibreTranslate service (see docker-compose.yml).
 *
 * Every result is written to the `translations` table, so the same string is
 * never sent twice — product names repeat heavily across variants, and the
 * cache is what makes re-running a batch cheap and resumable.
 */

const TRANSLATE_URL = process.env.TRANSLATE_URL ?? "http://localhost:5050";

export type Lang = "en" | "nl" | "pl";

export async function translateAvailable(): Promise<boolean> {
  try {
    const res = await fetch(`${TRANSLATE_URL}/languages`, {
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Raw call to the service — no caching. Order of results matches input. */
async function translateRaw(
  texts: string[],
  source: Lang,
  target: Lang,
): Promise<string[]> {
  if (texts.length === 0) return [];

  const res = await fetch(`${TRANSLATE_URL}/translate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ q: texts, source, target, format: "text" }),
    cache: "no-store",
    signal: AbortSignal.timeout(120_000),
  });

  if (!res.ok) {
    throw new Error(`LibreTranslate ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }

  const data = (await res.json()) as { translatedText: string | string[] };
  const out = Array.isArray(data.translatedText)
    ? data.translatedText
    : [data.translatedText];

  if (out.length !== texts.length) {
    throw new Error(
      `LibreTranslate returned ${out.length} results for ${texts.length} inputs`,
    );
  }
  return out;
}

async function readCache(
  texts: string[],
  source: Lang,
  target: Lang,
): Promise<Map<string, string>> {
  if (texts.length === 0) return new Map();
  const db = getDb();
  const rows = await db
    .select({
      sourceText: translations.sourceText,
      translatedText: translations.translatedText,
    })
    .from(translations)
    .where(
      and(
        eq(translations.sourceLang, source),
        eq(translations.targetLang, target),
        inArray(translations.sourceText, texts),
      ),
    );
  return new Map(rows.map((r) => [r.sourceText, r.translatedText]));
}

async function writeCache(
  entries: { sourceText: string; translatedText: string }[],
  source: Lang,
  target: Lang,
): Promise<void> {
  if (entries.length === 0) return;
  const db = getDb();
  await db
    .insert(translations)
    .values(
      entries.map((e) => ({
        sourceLang: source,
        targetLang: target,
        sourceText: e.sourceText,
        translatedText: e.translatedText,
      })),
    )
    .onConflictDoNothing();
}

/**
 * Translates a batch, serving what it can from the cache and only calling the
 * service for the rest. Every result passes the same guardrails as the batch
 * job (see translation-guard.mjs). Returns a map keyed by the original text;
 * a text that could not be translated *reliably* is absent, so callers fall
 * back to the original rather than showing a wrong translation.
 */
export async function translateTexts(
  texts: string[],
  source: Lang,
  target: Lang,
): Promise<Map<string, string>> {
  const unique = [...new Set(texts.map((t) => t.trim()).filter(Boolean))].filter(
    (t) => !isLikelyPolish(t),
  );
  if (unique.length === 0) return new Map();

  const result = new Map<string, string>();
  for (const [sourceText, translatedText] of await readCache(unique, source, target)) {
    if (rejectReason(sourceText, translatedText) === null) {
      result.set(sourceText, translatedText);
    }
  }

  const missing = unique.filter((t) => !result.has(t));
  if (missing.length === 0) return result;

  const shielded = missing.map((t) => protectTerms(t));
  const fresh = await translateRaw(
    shielded.map((s) => s.text),
    source,
    target,
  );

  const entries = missing
    .map((sourceText, i) => ({
      sourceText,
      translatedText: restoreTerms((fresh[i] ?? "").trim(), shielded[i].originals),
    }))
    .filter((e) => rejectReason(e.sourceText, e.translatedText) === null);

  await writeCache(entries, source, target);
  for (const e of entries) result.set(e.sourceText, e.translatedText);
  return result;
}
