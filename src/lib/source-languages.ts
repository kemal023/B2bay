/**
 * Languages a supplier feed can be in. The translator needs a LibreTranslate
 * model for each (LT_LOAD_ONLY in docker-compose.yml); "auto" detects per product.
 */
export const SOURCE_LANGUAGES = [
  { code: "auto", label: "Automatisch herkennen" },
  { code: "pl", label: "Pools" },
  { code: "en", label: "Engels" },
  { code: "nl", label: "Nederlands" },
  { code: "de", label: "Duits" },
  { code: "fr", label: "Frans" },
] as const;

export function isSourceLanguage(value: string): boolean {
  return SOURCE_LANGUAGES.some((l) => l.code === value);
}

export function sourceLanguageLabel(code: string): string {
  return SOURCE_LANGUAGES.find((l) => l.code === code)?.label ?? code;
}
