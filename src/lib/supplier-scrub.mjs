/**
 * Removes traces of our suppliers from product texts before customers see
 * them. Supplier feeds (and products of brands they manufacture, which
 * other suppliers resell) carry blocks like
 *   "PRODUCER: Maxy Sp. z o.o. Gniewomierz 173 59-241 Legnickie Pole Poland
 *    www.maxy.eu office@maxy.eu RESPONSIBLE PERSON IN THE EU: Maxy …"
 * in any of the feed or translation languages. The manufacturer details are
 * kept on file and can be given to a customer who asks.
 *
 * Plain .mjs: used by the supplier sync (in the app) and by one-off scripts.
 */

/** Company names that must not appear in product texts. */
export const HIDDEN_COMPANIES = ["Maxy", "Annapol"];

const UPPER = "A-ZĄĆĘŁŃÓŚŹŻÄÖÜÉÈÊÀÂÇÎÏÔÛ";
// An all-caps label ending in a colon: "PRODUCER:", "OSOBA ODPOWIEDZIALNA W UE:", "PRODUCTEUR :".
const LABEL = `[${UPPER}][${UPPER}'’ ]{2,}\\s*:`;

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const patterns = HIDDEN_COMPANIES.flatMap((name) => {
  const n = escapeRegExp(name);
  return [
    // "LABEL: Name …address…" up to the next all-caps label or the end of the
    // text, at most ~250 characters so normal text after it is never eaten.
    new RegExp(`${LABEL}\\s*${n}\\b[^:]{0,250}?(?=\\s+${LABEL}|$)`, "g"),
    // Web and mail addresses on the company's domain.
    new RegExp(`\\b(?:https?://)?(?:www\\.)?${n.toLowerCase()}\\.[a-z.]{2,6}\\b`, "gi"),
    new RegExp(`\\b[\\w.+-]+@${n.toLowerCase()}\\.[a-z.]{2,6}\\b`, "gi"),
    // "Manufacturer: Maxy;" inside a specification list: label and value go.
    new RegExp(
      `\\b(?:manufacturer|producer|producent|fabrikant|hersteller|fabricant|producteur|importer|importeur)\\s*:\\s*${n}\\b[;,]?`,
      "gi",
    ),
    // The name itself (any case: "MAXY" too), with a legal form when present.
    new RegExp(`\\b${n}\\b(?:\\s+(?:Sp\\.?\\s*z\\s*o\\.?\\s*o\\.?|Spółka\\s+z\\s+o\\.?\\s*o\\.?|B\\.?V\\.?|GmbH))?`, "gi"),
  ];
});

/** The text without supplier names, addresses and labels left empty by that. */
export function scrubSupplierTraces(text) {
  if (!text) return text;
  let out = text;
  for (const p of patterns) out = out.replace(p, " ");
  return (
    out
      // A label whose content was removed: "PRODUCER: ," / "OSOBA ODPOWIEDZIALNA W UE:" followed by another label.
      .replace(new RegExp(`${LABEL}\\s*(?=[,.;]?\\s*(?:${LABEL}|$))`, "g"), " ")
      .replace(/\s+([,.;:])/g, "$1")
      .replace(/\s{2,}/g, " ")
      .trim()
  );
}

/** True when the text still names a hidden company. */
export function hasSupplierTraces(text) {
  return Boolean(text) && HIDDEN_COMPANIES.some((n) => new RegExp(`\\b${escapeRegExp(n)}\\b`, "i").test(text));
}
