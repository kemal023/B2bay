import sax from "sax";
import { Readable } from "node:stream";
import type { NormalizedProduct, SupplierAdapter, SupplierRow } from "./types";

/**
 * Maxy's IOF 3.0 export feed (same family of shop software Annapol also
 * runs on). One XML export covers everything: `code_on_card` is the EAN
 * (GTIN13), and — unlike Annapol — the feed already carries a genuine
 * English name/description (<name xml:lang="eng">), since we request
 * language=eng. `credential` holds the API token; `config.client` is the
 * account e-mail Maxy issued the token for.
 */

export type MaxyConfig = {
  client: string;
  /** Maxy shop id — defaults to "1" (every account we've seen only has one). */
  shop?: string;
};

const MAXY_BASE = "https://old.maxy.eu/edi/export-offer.php";

function buildUrl(client: string, token: string, shop: string): string {
  const params = new URLSearchParams({
    client,
    language: "eng",
    token,
    shop,
    type: "full",
    format: "xml",
  });
  // Maxy's own sample links append a bare `iof_3_0` flag with no value.
  return `${MAXY_BASE}?${params.toString()}&iof_3_0`;
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

type CurrentProduct = {
  sku: string;
  ean: string;
  currency: string;
  category: string;
  unit: string;
  nameEng: string;
  longDescEng: string;
  stockQty: number;
  /** <iaiext:omnibus_price_wholesale> — the authoritative wholesale price. */
  omniPriceNet: number;
  /** Fallback only: the highest <size><price> seen, used when no product
   * has no omnibus wholesale price at all. Sizes are parsed before the
   * omnibus block in document order, so these must stay separate rather
   * than merged inline — otherwise a size price would wrongly block the
   * real (later) omnibus value from ever being recorded. */
  sizePriceNet: number;
};

type TextField = "name" | "longDesc" | null;

async function streamProducts(url: string): Promise<NormalizedProduct[]> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Maxy responded ${res.status} ${res.statusText}`);
  }
  if (!res.body) throw new Error("Maxy feed returned no response body");

  const products: NormalizedProduct[] = [];
  const parser = sax.createStream(false, { trim: true, lowercase: true });

  let current: CurrentProduct | null = null;
  let inDescription = false;
  let inSizes = false;
  let inWholesaleBlock = false;
  let field: TextField = null;
  let buf = "";

  parser.on("opentag", (node: sax.Tag) => {
    switch (node.name) {
      case "product":
        current = {
          sku: String(node.attributes.id ?? ""),
          ean: String(node.attributes.code_on_card ?? ""),
          currency: String(node.attributes.currency ?? "EUR"),
          category: "",
          unit: "stuk",
          nameEng: "",
          longDescEng: "",
          stockQty: 0,
          omniPriceNet: 0,
          sizePriceNet: 0,
        };
        break;
      case "category":
        if (current && !current.category) current.category = String(node.attributes.name ?? "");
        break;
      case "unit":
        if (current) current.unit = String(node.attributes.name ?? "stuk");
        break;
      case "description":
        inDescription = true;
        break;
      case "sizes":
        inSizes = true;
        break;
      case "price":
        if (current && inSizes) {
          const net = Number(node.attributes.net);
          if (Number.isFinite(net) && net > current.sizePriceNet) current.sizePriceNet = net;
        }
        break;
      case "stock":
        if (current && inSizes) {
          const qty = Number(node.attributes.quantity ?? 0);
          if (Number.isFinite(qty)) current.stockQty += qty;
        }
        break;
      case "iaiext:omnibus_price_wholesale":
        inWholesaleBlock = true;
        break;
      case "iaiext:site":
        if (current && inWholesaleBlock) {
          const net = Number(node.attributes.net);
          if (Number.isFinite(net) && net > current.omniPriceNet) current.omniPriceNet = net;
        }
        break;
      case "name":
        if (inDescription) {
          const lang = node.attributes["xml:lang"] || node.attributes.lang;
          if (lang === "eng") {
            field = "name";
            buf = "";
          }
        }
        break;
      case "long_desc":
        if (inDescription) {
          const lang = node.attributes["xml:lang"] || node.attributes.lang;
          if (lang === "eng") {
            field = "longDesc";
            buf = "";
          }
        }
        break;
    }
  });

  parser.on("text", (t: string) => {
    if (field) buf += t;
  });
  parser.on("cdata", (t: string) => {
    if (field) buf += t;
  });

  parser.on("closetag", (tag: string) => {
    if (tag === "name" && field === "name") {
      if (current) current.nameEng = buf.trim();
      field = null;
    } else if (tag === "long_desc" && field === "longDesc") {
      if (current) current.longDescEng = buf.trim();
      field = null;
    } else if (tag === "description") {
      inDescription = false;
    } else if (tag === "sizes") {
      inSizes = false;
    } else if (tag === "iaiext:omnibus_price_wholesale") {
      inWholesaleBlock = false;
    } else if (tag === "product") {
      const p = current;
      current = null;
      const priceNet = p && p.omniPriceNet > 0 ? p.omniPriceNet : p?.sizePriceNet ?? 0;
      // Some listings carry no wholesale price anywhere in the feed (price
      // and stock both zero) — Maxy isn't actually offering them right now.
      // Importing at cost 0 would show them as free on the storefront.
      if (!p || !p.sku || !p.nameEng || priceNet <= 0) return;

      products.push({
        supplierSku: p.sku,
        ean: p.ean || undefined,
        name: p.nameEng,
        description: p.longDescEng ? stripHtml(p.longDescEng) : undefined,
        category: p.category || undefined,
        unit: p.unit,
        costPriceCents: Math.round(priceNet * 100),
        currency: p.currency,
        stockQty: p.stockQty,
        minOrderQty: 1,
      });
    }
  });

  await new Promise<void>((resolve, reject) => {
    parser.on("error", (err) => {
      // Non-strict mode tolerates most quirks; log and keep parsing rather
      // than aborting the whole sync on one bad row.
      console.error("Maxy feed parse warning:", err.message);
    });
    parser.on("end", () => resolve());
    Readable.fromWeb(res.body as import("node:stream/web").ReadableStream)
      .pipe(parser)
      .on("error", reject);
  });

  return products;
}

export const maxyAdapter: SupplierAdapter = {
  async fetchProducts(supplier: SupplierRow): Promise<NormalizedProduct[]> {
    const config = (supplier.config ?? {}) as MaxyConfig;
    const client = config.client;
    const token = supplier.credential;
    if (!client || !token) {
      throw new Error("Maxy: klant-e-mailadres en token zijn verplicht in de leveranciersinstellingen.");
    }
    const shop = config.shop || "1";

    return streamProducts(buildUrl(client, token, shop));
  },
};
