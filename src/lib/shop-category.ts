import { isMainSlug, isSubOf, OTHER } from "@/lib/taxonomy.mjs";

/**
 * Reads a ShopCategorySelect value: "main" or "main/sub". Returns null for
 * anything that isn't a real place in the tree (a stale or forged value).
 */
export function parseShopCategory(value: string): { main: string; sub: string | null } | null {
  const [main, sub] = value.split("/");
  if (!main || !isMainSlug(main)) return null;
  if (!sub) return { main, sub: null };
  if (main === OTHER.slug || !isSubOf(sub, main)) return null;
  return { main, sub };
}

/** The select value for a stored main/sub pair. */
export function shopCategoryValue(main: string | null | undefined, sub: string | null | undefined): string {
  if (!main) return "";
  return sub ? `${main}/${sub}` : main;
}
