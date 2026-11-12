/**
 * Guardrails around machine translation of product names (en -> nl).
 *
 * Plain .mjs so the same rules apply in the Next app and in the batch job
 * (scripts/translate-names.mjs), which runs under bare Node in a container.
 *
 * Built from a manual review of LibreTranslate output on this catalogue:
 * brand names got translated ("blow" -> "blaas"), words silently vanished
 * ("Metal drill Baildon …" lost "Metal drill"), and Polish left over in the
 * English source was mangled rather than left alone ("drewna" -> "drakena").
 * The policy is: when a translation can't be trusted, keep the English name.
 * English on a Dutch wholesale site is acceptable; wrong Dutch is not.
 */
import { POLISH_VOCABULARY } from "./polish-words.mjs";

/**
 * Names that must come through untouched. Several are also English words
 * (Blow, Rebel, Tracer), which is exactly why the translator mangles them.
 * Add to this list when a new brand shows up mistranslated.
 */
export const PROTECTED_TERMS = [
  "Kruger&Matz",
  "I'm Genius",
  "Uni-T",
  "Baildon",
  "Bestway",
  "Blow",
  "Cabletech",
  "Cellfast",
  "Cynel",
  "Dedra",
  "Esperanza",
  "Greenmill",
  "Kinghoff",
  "Klausberg",
  "Kruzzel",
  "Lahti",
  "Maclean",
  "Malatec",
  "Proline",
  "Psi Patrol",
  "Rebel",
  "Ruhhy",
  "Teesa",
  "Tracer",
  "Trefl",
  "Trizand",
  "Xtrobb",
];

/**
 * Fixed translations for terms LibreTranslate gets wrong in this catalogue.
 * Every entry was checked against the translator's actual output; terms it
 * already handles well (metaalboor, cirkelzaag, verlengsnoer, …) are left to
 * it on purpose. They are swapped out before translation like the brands,
 * and the Dutch term is put back afterwards.
 *
 * Only unambiguous phrases. "socket" alone is deliberately absent: it is a
 * power socket, a socket-wrench socket or a connector depending on context.
 * Add a line here whenever a recurring term turns up mistranslated.
 */
export const GLOSSARY = [
  ["abrasive cloth", "schuurdoek"],
  ["battery powered", "op batterijen"],
  ["bit socket", "bitdop"],
  ["bulb", "lamp"],
  ["bulbs", "lampen"],
  ["ceiling fixture", "plafondarmatuur"],
  ["clamp meter", "stroomtang"],
  ["display port", "DisplayPort"],
  ["drill bit", "boor"],
  ["drill bits", "boren"],
  ["drill driver", "schroefboormachine"],
  ["ear muffs", "gehoorkappen"],
  ["fan", "ventilator"],
  ["hex key", "inbussleutel"],
  ["hole saw", "gatzaag"],
  ["impact socket", "krachtdop"],
  ["pencil case", "etui"],
  ["power extension", "stekkerdoos"],
  ["power strip", "stekkerdoos"],
  ["quick connector", "snelkoppeling"],
  ["rectifier bridge", "gelijkrichterbrug"],
  ["reel extension", "kabelhaspel"],
  ["remote", "afstandsbediening"],
  ["remote control", "afstandsbediening"],
  ["remote controlled", "radiografisch bestuurbare"],
  ["ring terminal", "ringkabelschoen"],
  ["rubber bands", "elastiekjes"],
  ["scroll saw", "figuurzaag"],
  ["set", "set"],
  ["socket wrench", "dopsleutel"],
  ["splash proof", "spatwaterdicht"],
  ["spirit level", "waterpas"],
  ["steering wheel cover", "stuurhoes"],
  ["surface mounted", "opbouw"],
  ["switch", "schakelaar"],
  ["tape measure", "rolmaat"],
  ["toe cap", "neus"],
  ["toggle switch", "tuimelschakelaar"],
];

/**
 * Polish left behind in names that are supposed to be English. The bulk
 * comes from polish-words.mjs, generated from the catalogue's own pl -> en
 * translations (scripts/build-polish-wordlist.mjs). The hand-written entries
 * below cover what that generator leaves out by design: words of one or two
 * letters, and stems for inflected forms too rare to be counted on their own.
 */
const POLISH_WORDS = new Set([
  "dla", "do", "na", "od", "ze",
  "arkusz", "betonu", "bezpiecznik", "bluza", "filtr", "grot", "kolor",
  "kontaktron", "krete", "mlotek", "opaski", "oplot", "pilot", "powietrza",
  "siewnik", "stacji", "stal", "szpula", "szt", "termiczny", "typ", "ustnik",
  "zawieszka", "zestaw",
]);
const POLISH_PREFIXES = [
  "alarmow", "bial", "biurk", "czarn", "czerwon", "drewn", "elektryczn",
  "gniazd", "klucz", "lutownicz", "meblow", "niebiesk", "ogrodow", "plastikow",
  "robocz", "sieciow", "stalow", "wiertl", "wkret", "wtyk", "zaciskow",
  "zielon", "zolt",
];
// Generated words that are also legitimate English (or trade) terms in this
// catalogue; flagging them would keep perfectly good names untranslated.
const NOT_POLISH = new Set(["canbus", "pendrive", "pod", "ram"]);
const POLISH_DIACRITICS = /[ąćęłńśźżĄĆĘŁŃŚŹŻ]/;

// Distinctive enough that the translator leaves it alone. Short ones such as
// "X0Q" survive too but trigger the word-dropping problem; this form doesn't.
const placeholder = (i) => `QBRAND${i}Q`;

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Whole-word, case-insensitive: "set" must not fire inside "sets" or "reset". */
const wholeWord = (s) =>
  new RegExp(`(?<![A-Za-z0-9])${escapeRegExp(s)}(?![A-Za-z0-9])`, "gi");

const termPatterns = PROTECTED_TERMS.map((term) => ({ term, pattern: wholeWord(term) }));

/** Keeps a sentence-initial capital: "Toggle switch …" -> "Tuimelschakelaar …". */
function matchCase(found, dutch) {
  return /^[A-Z]/.test(found) ? dutch[0].toUpperCase() + dutch.slice(1) : dutch;
}

/**
 * Brands and glossary terms in one list, longest first — otherwise "switch"
 * would claim the second word of "toggle switch", and "remote" the first of
 * "remote controlled", before the longer phrase got a chance.
 */
const shields = [
  ...PROTECTED_TERMS.map((term) => ({
    length: term.length,
    pattern: wholeWord(term),
    dutch: null,
    restore: (found) => found,
  })),
  ...GLOSSARY.map(([english, dutch]) => ({
    length: english.length,
    pattern: wholeWord(english),
    dutch,
    restore: (found) => matchCase(found, dutch),
  })),
].sort((a, b) => b.length - a.length);

function shield(text, useGlossary = true) {
  const restorations = [];
  const dutchTerms = [];
  let out = text;
  for (const { pattern, dutch, restore } of shields) {
    // The glossary maps English to Dutch, so it only applies to en -> nl.
    if (dutch && !useGlossary) continue;
    out = out.replace(pattern, (found) => {
      restorations.push(restore(found));
      if (dutch) dutchTerms.push(dutch);
      return placeholder(restorations.length - 1);
    });
  }
  return { text: out, restorations, dutchTerms };
}

function words(text) {
  return text.toLowerCase().split(/[^a-ząćęłńóśźż]+/).filter(Boolean);
}

/** True when the "English" source still contains Polish. */
export function isLikelyPolish(text) {
  if (POLISH_DIACRITICS.test(text)) return true;
  return words(text).some(
    (w) =>
      !NOT_POLISH.has(w) &&
      (POLISH_WORDS.has(w) ||
        POLISH_VOCABULARY.has(w) ||
        POLISH_PREFIXES.some((p) => w.startsWith(p))),
  );
}

/**
 * Swaps brands and glossary terms for placeholders before translation.
 * `originals` holds what each placeholder becomes afterwards: the brand as
 * written, or the fixed Dutch term.
 *
 * @param {string} text
 * @param {{ glossary?: boolean }} [options] glossary: apply the en -> nl
 *   glossary (default). Pass false for any other direction; brands are
 *   always protected.
 * @returns {{ text: string, originals: string[] }}
 */
export function protectTerms(text, { glossary = true } = {}) {
  const { text: out, restorations } = shield(text, glossary);
  return { text: out, originals: restorations };
}

/**
 * @param {string} text
 * @param {string[]} originals
 */
export function restoreTerms(text, originals) {
  return originals.reduce((acc, original, i) => acc.split(placeholder(i)).join(original), text);
}

const NUMBER = /\d+(?:[.,]\d+)?/g;
const SKU = /(?<![a-z0-9])[a-z]{2,}-\d{3,}(?![0-9])/g;
// "200pcs", "12V", "3x" — a number with a unit the translator may rewrite
// ("200 st"); only the number itself has to survive.
const NUMBER_WITH_UNIT = /^\d+(?:[.,]\d+)?[a-z]{1,4}$/;

/** Decimal commas and case should not count as a difference. */
function normalize(text) {
  return text.toLowerCase().replace(/(\d),(\d)/g, "$1.$2");
}

/**
 * Model and part codes: pieces that themselves mix letters and digits
 * ("6lr61", "ut204", "B9.52", "or1117"). The translator corrupts these in ways
 * that look plausible ("6lr61" -> "61r61"), so they must survive verbatim.
 *
 * Tokens are split on - / _ first, because "2-wire" or "1-phase" are a number
 * plus a translatable word ("2-draads", "1-fase"), not codes; only the number
 * in them has to survive, and the number check already covers that.
 */
function codes(text) {
  return text
    .split(/[\s,;()"'`*|]+/)
    .flatMap((token) => normalize(token).split(/[-/_.:]/))
    .map((part) => part.replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, ""))
    .filter((part) => /[a-z]/.test(part) && /\d/.test(part) && !NUMBER_WITH_UNIT.test(part));
}

/**
 * Checks a finished translation against its source. Returns the reason it
 * was rejected, or null when it can be trusted.
 *
 * @param {string} source
 * @param {string} translated
 * @param {{ glossary?: boolean, minRatio?: number }} [options]
 *   glossary: also require the glossary terms (en -> nl only).
 *   minRatio: shortest acceptable output relative to the source. 0.6 suits
 *   en -> nl; Polish is wordier than English, so pl -> en needs a lower bar.
 * @returns {string | null}
 */
export function rejectReason(source, translated, { glossary = true, minRatio = 0.6 } = {}) {
  const out = translated.trim();
  if (!out) return "leeg";
  if (/QBRAND\d*Q?/i.test(out)) return "placeholder-over";

  const src = normalize(source);
  const dst = normalize(out);

  for (const { term, pattern } of termPatterns) {
    pattern.lastIndex = 0;
    const inSource = pattern.test(source);
    pattern.lastIndex = 0;
    if (inSource && !pattern.test(out)) return `merk-kwijt:${term}`;
    pattern.lastIndex = 0;
  }

  // Only the glossary terms that actually applied (longest match wins), so
  // "remote controlled" doesn't also demand "afstandsbediening".
  for (const dutch of glossary ? shield(source).dutchTerms : []) {
    if (!dst.includes(dutch.toLowerCase())) return `term-kwijt:${dutch}`;
  }

  for (const n of src.match(NUMBER) ?? []) {
    if (!dst.includes(n)) return `getal-kwijt:${n}`;
  }

  for (const code of codes(source)) {
    if (!dst.includes(code)) return `code-kwijt:${code}`;
  }

  // Item numbers such as "amio-03839": the parts alone pass the checks above
  // (a word and a number), but "ami-03839" is a different article.
  for (const sku of src.match(SKU) ?? []) {
    if (!dst.includes(sku)) return `code-kwijt:${sku}`;
  }

  // Dutch runs as long as English or longer; a much shorter result means
  // words were dropped, a much longer one means the model started looping.
  if (out.length < source.length * minRatio) return "te-kort";
  if (out.length > source.length * 2.5) return "te-lang";

  return null;
}

// ---------------------------------------------------------------------------
// Names into German and French
//
// LibreTranslate treats Title Case words as proper nouns and leaves them in
// English ("Logic Game Puzzle UFO Magic Rotating Capsule Pink" came back
// unchanged), while the same name in sentence case translates fine. Feeding
// it the Polish original instead was tried and is worse: there is no direct
// pl -> de/fr model, so it goes through English anyway and loses more.
// ---------------------------------------------------------------------------

const isProtectedWord = (w) => termPatterns.some(({ term }) => term.toLowerCase() === w.toLowerCase());

/**
 * Lower-cases Title Case words after the first one ("Notebook Bag Classic"
 * -> "Notebook bag classic"). Brands, ALL CAPS and anything with digits keep
 * their form; the first word stays capitalised for German nouns.
 */
export function sentenceCase(text) {
  // Codes in front ("ET101", "75-613#") are not the first word.
  let seenWord = false;
  return text
    .split(" ")
    .map((token) => {
      const word = token.replace(/[^A-Za-z'-]+$/, "");
      const isWord = !/\d/.test(token) && /^[A-Za-z][A-Za-z'-]*$/.test(word);
      if (!isWord) return token;
      const first = !seenWord;
      seenWord = true;
      if (first || isProtectedWord(word) || !/^[A-Z][a-z]+(?:-[A-Za-z]+)*$/.test(word)) return token;
      return word.toLowerCase() + token.slice(word.length);
    })
    .join(" ");
}

/**
 * How many words of the English source came back unchanged — the sign of a
 * word the translator skipped. Some are legitimately the same in German or
 * French (Puzzle, Denim); this is for comparing two attempts, not a verdict.
 */
export function untranslatedWords(source, translated) {
  const out = new Set(translated.toLowerCase().split(/[^a-zàâäçéèêëîïôöùûüÿœß]+/).filter(Boolean));
  const seen = new Set();
  let n = 0;
  for (const word of source.split(/[^A-Za-z]+/)) {
    if (word.length < 3 || /^[A-Z]+$/.test(word) || isProtectedWord(word)) continue;
    const w = word.toLowerCase();
    if (seen.has(w)) continue;
    seen.add(w);
    if (out.has(w)) n++;
  }
  return n;
}

// 15.6", 3/4", 1/2" — the translator tends to drop the inch mark.
const INCHES = /(?<![\w.,/])\d+(?:[.,]\d+)?(?:\/\d+)?"/g;

/** Like protectTerms, plus inch sizes; brands only, no glossary (en -> de/fr). */
export function protectForForeign(text) {
  const { text: shielded, originals } = protectTerms(text, { glossary: false });
  const out = shielded.replace(INCHES, (found) => {
    originals.push(found);
    return placeholder(originals.length - 1);
  });
  return { text: out, originals };
}

/** Every inch size in the source is still there, mark included. */
export function inchesKept(source, translated) {
  return (source.match(INCHES) ?? []).every((size) => translated.includes(size));
}
