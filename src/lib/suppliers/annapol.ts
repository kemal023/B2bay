import sax from "sax";
import { Readable } from "node:stream";
import type { NormalizedProduct, SupplierAdapter, SupplierRow } from "./types";

/**
 * Annapol splits its catalog across three XML feeds instead of one JSON API:
 *
 * - xml-categories.php — category id -> name, in several languages (we use "en")
 * - xml-stock.php      — live stock + price per product id (~14 MB, ~70k rows)
 * - xml-products.php   — name/description/category/images per product id
 *                         (~150 MB, ~70k rows) — the big one, so this adapter
 *                         streams it (SAX) instead of buffering it whole.
 *
 * All three are linked by Annapol's internal numeric product `id`.
 * `user`/`hash` (their auth) live in supplier.config.user / supplier.credential.
 */

export type AnnapolConfig = {
  user: string;
};

const ANNAPOL_BASE = "https://www.annapol.com";

function buildUrl(path: string, user: string, hash: string): string {
  return `${ANNAPOL_BASE}/${path}?user=${encodeURIComponent(user)}&hash=${encodeURIComponent(hash)}`;
}

/** Descriptions arrive as inline HTML; we sell a plain-text field, so strip tags. */
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

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Annapol responded ${res.status} ${res.statusText} for ${url}`);
  }
  return res.text();
}

/** Category id -> English name. The feed is small enough to buffer whole. */
function parseCategoryNames(xml: string): Map<number, string> {
  const names = new Map<number, string>();
  const parser = sax.parser(false, { trim: true, lowercase: true });

  let currentId: number | null = null;
  let inName = false;
  let currentLang = "";
  let buf = "";

  parser.onopentag = (node) => {
    if (node.name === "category") {
      currentId = Number(node.attributes.id);
    } else if (node.name === "name") {
      inName = true;
      buf = "";
      currentLang = String(node.attributes.code ?? "");
    }
  };
  parser.ontext = (t) => {
    if (inName) buf += t;
  };
  parser.oncdata = (t) => {
    if (inName) buf += t;
  };
  parser.onclosetag = (tag) => {
    if (tag === "name") {
      inName = false;
      if (currentId != null && currentLang === "en" && buf.trim()) {
        names.set(currentId, buf.trim());
      }
    }
  };

  parser.write(xml).close();
  return names;
}

type StockEntry = { stock: number; priceEur: number };

/** Annapol product id -> live stock + price. ~14 MB — still fine to buffer whole. */
function parseStock(xml: string): Map<number, StockEntry> {
  const stock = new Map<number, StockEntry>();
  const parser = sax.parser(false, { trim: true, lowercase: true });

  parser.onopentag = (node) => {
    if (node.name !== "product") return;
    const id = Number(node.attributes.id);
    if (!Number.isFinite(id)) return;
    const qty = Number(node.attributes.stock);
    const priceEur = Number(node.attributes.price_eur);
    stock.set(id, {
      stock: Number.isFinite(qty) ? qty : 0,
      priceEur: Number.isFinite(priceEur) ? priceEur : 0,
    });
  };

  parser.write(xml).close();
  return stock;
}

type CurrentProduct = {
  id: number;
  symbol: string;
  stockAttr: number;
  priceEurAttr: number;
  name: string;
  description: string;
  inCategory: boolean;
  categoryId: number | null;
  categoryNamePl: string;
  images: string[];
};

type TextField = "name" | "description" | "categoryId" | "categoryName" | "gfx" | null;

/**
 * Streams the large products feed via SAX so the ~150 MB response body is
 * never fully buffered in memory — only one `<product>` at a time.
 */
async function streamProducts(
  url: string,
  stockById: Map<number, StockEntry>,
  categoryNames: Map<number, string>,
): Promise<NormalizedProduct[]> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Annapol responded ${res.status} ${res.statusText} for products feed`);
  }
  if (!res.body) throw new Error("Annapol products feed returned no response body");

  const products: NormalizedProduct[] = [];
  const parser = sax.createStream(false, { trim: true, lowercase: true });

  let current: CurrentProduct | null = null;
  let field: TextField = null;
  let buf = "";

  parser.on("opentag", (node: sax.Tag) => {
    switch (node.name) {
      case "product":
        current = {
          id: Number(node.attributes.id),
          symbol: String(node.attributes.symbol ?? ""),
          stockAttr: Number(node.attributes.stock ?? 0),
          priceEurAttr: Number(node.attributes.price_eur ?? 0),
          name: "",
          description: "",
          inCategory: false,
          categoryId: null,
          categoryNamePl: "",
          images: [],
        };
        break;
      case "category":
        if (current) current.inCategory = true;
        break;
      case "name":
        field = current?.inCategory ? "categoryName" : "name";
        buf = "";
        break;
      case "id":
        if (current?.inCategory) {
          field = "categoryId";
          buf = "";
        }
        break;
      case "description":
        field = "description";
        buf = "";
        break;
      case "gfx":
        field = "gfx";
        buf = "";
        break;
    }
  });

  parser.on("text", (t: string) => {
    if (field) buf += t;
  });
  parser.on("cdata", (t: string) => {
    if (field) buf += t;
  });

  parser.on("closetag", (tagName: string) => {
    if (!current) return;

    switch (tagName) {
      case "name":
        if (field === "name") current.name = buf.trim();
        else if (field === "categoryName") current.categoryNamePl = buf.trim();
        field = null;
        break;
      case "id":
        if (field === "categoryId") {
          const n = Number(buf.trim());
          current.categoryId = Number.isFinite(n) ? n : null;
        }
        field = null;
        break;
      case "description":
        current.description = buf.trim();
        field = null;
        break;
      case "gfx":
        if (buf.trim()) current.images.push(buf.trim());
        field = null;
        break;
      case "category":
        current.inCategory = false;
        break;
      case "product": {
        const p = current;
        current = null;
        if (!p.symbol) break;

        const live = stockById.get(p.id);
        const priceEur = live?.priceEur || p.priceEurAttr;
        const stockQty = live ? live.stock : p.stockAttr;
        const category = (p.categoryId != null ? categoryNames.get(p.categoryId) : undefined) ?? p.categoryNamePl ?? undefined;

        products.push({
          supplierSku: p.symbol,
          name: p.name || p.symbol,
          description: p.description ? stripHtml(p.description) : undefined,
          imageUrl: p.images[0],
          category: category || undefined,
          unit: "stuk",
          costPriceCents: Math.round(priceEur * 100),
          currency: "EUR",
          stockQty,
          minOrderQty: 1,
        });
        break;
      }
    }
  });

  await new Promise<void>((resolve, reject) => {
    parser.on("error", (err) => {
      // Non-strict mode tolerates most quirks; log and keep parsing the
      // ~70k-row feed rather than aborting the whole sync on one bad row.
      console.error("Annapol products XML parse warning:", err.message);
    });
    parser.on("end", () => resolve());
    Readable.fromWeb(res.body as import("node:stream/web").ReadableStream)
      .pipe(parser)
      .on("error", reject);
  });

  return products;
}

export const annapolAdapter: SupplierAdapter = {
  async fetchProducts(supplier: SupplierRow): Promise<NormalizedProduct[]> {
    const config = (supplier.config ?? {}) as AnnapolConfig;
    const user = config.user;
    const hash = supplier.credential;
    if (!user || !hash) {
      throw new Error("Annapol: e-mailadres (user) en hash zijn verplicht in de leveranciersinstellingen.");
    }

    const [categoriesXml, stockXml] = await Promise.all([
      fetchText(buildUrl("xml-categories.php", user, hash)),
      fetchText(buildUrl("xml-stock.php", user, hash)),
    ]);

    const categoryNames = parseCategoryNames(categoriesXml);
    const stockById = parseStock(stockXml);

    return streamProducts(buildUrl("xml-products.php", user, hash), stockById, categoryNames);
  },
};
