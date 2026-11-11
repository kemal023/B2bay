import {
  pgTable,
  text,
  timestamp,
  integer,
  boolean,
  pgEnum,
  uniqueIndex,
  jsonb,
  uuid,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const companyStatusEnum = pgEnum("company_status", [
  "pending",
  "approved",
  "suspended",
]);

export const userRoleEnum = pgEnum("user_role", [
  "buyer",
  "company_admin",
  "platform_admin",
]);

export const supplierAuthTypeEnum = pgEnum("supplier_auth_type", [
  "none",
  "bearer",
  "api_key_header",
  "basic",
]);

/**
 * B2B-flow zonder online betaling: de klant plaatst een bestelling, wij
 * bepalen de verzendkosten (die afhangen van producten/aantallen) en sturen
 * een factuur die per bank overgemaakt wordt.
 */
export const orderStatusEnum = pgEnum("order_status", [
  "placed", // net geplaatst, wacht op verzendkosten + factuur
  "invoiced", // factuur verstuurd, wacht op betaling
  "paid", // betaling ontvangen (handmatig gemarkeerd)
  "fulfilled",
  "cancelled",
]);

/** A B2B customer organization that can place orders. */
export const companies = pgTable("companies", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  kvkNumber: text("kvk_number"),
  vatNumber: text("vat_number"),
  billingEmail: text("billing_email"),
  // Billing address — required on an invoice, and the country decides VAT.
  addressLine: text("address_line"),
  postalCode: text("postal_code"),
  city: text("city"),
  /** ISO 3166-1 alpha-2, e.g. "NL", "DE". */
  country: text("country").notNull().default("NL"),
  /** Result of the last VIES check of vatNumber: unverified | valid | invalid. */
  vatStatus: text("vat_status").notNull().default("unverified"),
  vatCheckedAt: timestamp("vat_checked_at", { withTimezone: true }),
  /** Company name as registered in VIES, to compare with what they typed. */
  vatRegisteredName: text("vat_registered_name"),
  /** Price agreement: percentage off every list price for this company. */
  discountPercent: integer("discount_percent").notNull().default(0),
  status: companyStatusEnum("status").notNull().default("pending"),
  joinCode: text("join_code").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
}, (t) => [uniqueIndex("companies_join_code_idx").on(t.joinCode)]);

/** A person who can sign in, scoped to a company. Auth is self-hosted: no third-party auth provider. */
export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    companyId: uuid("company_id").references(() => companies.id, {
      onDelete: "set null",
    }),
    name: text("name"),
    role: userRoleEnum("role").notNull().default("buyer"),
    /** Language for e-mails; follows the storefront language switcher. */
    locale: text("locale").notNull().default("nl"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex("users_email_idx").on(t.email)],
);

/** A signed-in session, identified by the SHA-256 hash of the bearer token stored in the session cookie. */
export const sessions = pgTable("sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
}, (t) => [uniqueIndex("sessions_token_hash_idx").on(t.tokenHash)]);

/**
 * A credit note (creditfactuur) against an invoiced order: a refund or
 * correction. Invoices are never edited once issued; a mistake or a return is
 * corrected with a credit note in its own numbered series (C2026-0001, ...).
 * Amounts are stored as positive numbers and printed as negative.
 */
export const creditNotes = pgTable(
  "credit_notes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "restrict" }),
    number: text("number").notNull(),
    reason: text("reason").notNull(),
    netCents: integer("net_cents").notNull(),
    vatRatePercent: integer("vat_rate_percent").notNull(),
    vatCents: integer("vat_cents").notNull(),
    totalCents: integer("total_cents").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("credit_notes_number_idx").on(t.number)],
);

/** A product a company keeps on its favourites list (shared by its users). */
export const favorites = pgTable(
  "favorites",
  {
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("favorites_company_product_idx").on(t.companyId, t.productId)],
);

/** A place a company wants goods delivered — e.g. one per branch. */
export const deliveryAddresses = pgTable("delivery_addresses", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id")
    .notNull()
    .references(() => companies.id, { onDelete: "cascade" }),
  /** Short name the customer recognises, e.g. "Vestiging Rotterdam". */
  label: text("label").notNull(),
  /** Recipient / attention line on the parcel. */
  recipient: text("recipient"),
  addressLine: text("address_line").notNull(),
  postalCode: text("postal_code").notNull(),
  city: text("city").notNull(),
  country: text("country").notNull().default("NL"),
  phone: text("phone"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * A one-time password reset link. Only the SHA-256 of the token is stored,
 * like sessions, so a database leak does not hand out working links.
 */
export const passwordResetTokens = pgTable(
  "password_reset_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("password_reset_tokens_hash_idx").on(t.tokenHash)],
);

/**
 * A pluggable upstream product source (e.g. Maxy, Annapol). New suppliers
 * are added from the admin UI without a code deploy: `adapterType` picks the
 * fetch/normalize strategy, `config` holds adapter-specific settings such as
 * the field mapping used by the generic REST adapter.
 */
export const suppliers = pgTable(
  "suppliers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    adapterType: text("adapter_type").notNull().default("generic_rest"),
    baseUrl: text("base_url").notNull(),
    authType: supplierAuthTypeEnum("auth_type").notNull().default("none"),
    // API key / token / basic-auth secret. Stored server-side only, never
    // sent to the client. For production, consider moving this to an
    // encrypted secrets store instead of plaintext in Postgres.
    credential: text("credential"),
    // Adapter-specific config, e.g. field mapping for the generic adapter:
    // { itemsPath: "data.products", sku: "sku", name: "title", ... }
    config: jsonb("config").$type<Record<string, unknown>>().default({}),
    syncIntervalMinutes: integer("sync_interval_minutes").notNull().default(60),
    // Applied to a product's cost price to compute its initial sell price
    // when it's first imported. Purely a starting point — admins can then
    // fine-tune the sell price per product from /admin/products.
    defaultMarkupPercent: integer("default_markup_percent").notNull().default(30),
    // Language of the names and descriptions this supplier sends ("pl",
    // "en", …), or "auto" to detect it per product. Drives the translation
    // service (scripts/translate-catalog.mjs); only languages loaded into
    // LibreTranslate (LT_LOAD_ONLY in docker-compose.yml) can be translated.
    sourceLanguage: text("source_language").notNull().default("auto"),
    active: boolean("active").notNull().default(true),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
    lastSyncError: text("last_sync_error"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex("suppliers_slug_idx").on(t.slug)],
);

/**
 * A product in our own store catalog. Customers only ever see this — never
 * where it came from. `supplierId`/`supplierSku` are set when a product was
 * imported via a supplier API sync (see lib/suppliers/sync.ts); they're null
 * for products an admin added by hand. `costPriceCents` is what we pay the
 * supplier (never shown to customers); `priceCents` is what we charge —
 * admins control it independently so there's room for margin.
 *
 * Once `customized` is true, sync no longer overwrites the commercial/
 * display fields (name, description, image, category, price, unit, min
 * order qty) an admin has edited — it keeps refreshing cost price, stock,
 * and availability though, since those must stay accurate.
 */
export const products = pgTable(
  "products",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    supplierId: uuid("supplier_id").references(() => suppliers.id, {
      onDelete: "set null",
    }),
    supplierSku: text("supplier_sku"),
    // Barcode (European Article Number) — globally unique per physical
    // product. When two suppliers list the same EAN, sync.ts links them to
    // the same product row instead of creating a duplicate listing, and
    // customers can search by EAN.
    ean: text("ean"),
    name: text("name").notNull(),
    // The name exactly as the supplier sent it (e.g. Polish), before
    // translation. As long as name === sourceName the product hasn't been
    // translated yet. Sync always refreshes sourceName from the feed, but
    // only overwrites the customer-facing `name` when it still equals the
    // previous sourceName — so a translated name is never clobbered by a
    // later sync, without needing the `customized` flag.
    sourceName: text("source_name"),
    // Dutch translation of `name`, denormalised onto the product so the
    // catalogue can sort and search on it directly instead of joining the
    // translation cache for every row.
    nameNl: text("name_nl"),
    // German and French, translated from the English once that is final.
    // Null = not translated yet; the storefront then shows English.
    nameDe: text("name_de"),
    nameFr: text("name_fr"),
    // English description. For a non-English supplier it starts out as the
    // raw source text and is replaced by the translation; the storefront
    // never shows it while it still equals sourceDescription in a foreign
    // language (see lib/product-text.ts).
    description: text("description"),
    descriptionNl: text("description_nl"),
    descriptionDe: text("description_de"),
    descriptionFr: text("description_fr"),
    // Raw supplier text, refreshed on every sync — same contract as
    // sourceName: the customer-facing field is only overwritten while it
    // still equals the previous source value.
    sourceDescription: text("source_description"),
    imageUrl: text("image_url"),
    category: text("category"),
    categoryNl: text("category_nl"),
    categoryDe: text("category_de"),
    categoryFr: text("category_fr"),
    sourceCategory: text("source_category"),
    // Detected or configured language of the source_* fields.
    sourceLang: text("source_lang"),
    // md5 of the inputs each field was last translated from. When a sync
    // changes the source text (or an admin edits the English), the hash no
    // longer matches and the translation service redoes just that field.
    nameTrHash: text("name_tr_hash"),
    descTrHash: text("desc_tr_hash"),
    catTrHash: text("cat_tr_hash"),
    // Set when a visitor opens a product whose description is not translated
    // yet, so the translation service handles it before the backlog.
    translationPriority: timestamp("translation_priority", { withTimezone: true }),
    unit: text("unit").notNull().default("stuk"),
    // What we pay the supplier. Null for products with no supplier (added by hand).
    costPriceCents: integer("cost_price_cents"),
    // What the customer pays.
    priceCents: integer("price_cents").notNull(),
    currency: text("currency").notNull().default("EUR"),
    stockQty: integer("stock_qty").notNull().default(0),
    minOrderQty: integer("min_order_qty").notNull().default(1),
    active: boolean("active").notNull().default(true),
    customized: boolean("customized").notNull().default(false),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("products_supplier_sku_idx").on(t.supplierId, t.supplierSku),
    uniqueIndex("products_ean_idx").on(t.ean),
  ],
);

/**
 * Cache of translated text (product categories, and any product name that
 * repeats verbatim across multiple SKUs — common for colour/size variants)
 * so the exact same source string is never translated twice. One-time,
 * done directly (no external translation API) and stored here for reuse.
 */
export const translations = pgTable(
  "translations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sourceLang: text("source_lang").notNull(),
    // The cache originally only ever ran pl -> en, so the target was implicit.
    // With Dutch added it has to be part of the key, otherwise an English and
    // a Dutch translation of the same source text collide.
    targetLang: text("target_lang").notNull().default("en"),
    sourceText: text("source_text").notNull(),
    translatedText: text("translated_text").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("translations_source_idx").on(t.sourceLang, t.targetLang, t.sourceText),
  ],
);

/** One line in a company's persistent shopping cart. */
export const cartItems = pgTable(
  "cart_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    quantity: integer("quantity").notNull().default(1),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex("cart_items_company_product_idx").on(t.companyId, t.productId)],
);

export const orders = pgTable("orders", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id")
    .notNull()
    .references(() => companies.id, { onDelete: "restrict" }),
  placedByUserId: uuid("placed_by_user_id").references(() => users.id, {
    onDelete: "set null",
  }),
  status: orderStatusEnum("status").notNull().default("placed"),
  subtotalCents: integer("subtotal_cents").notNull(),
  // Null until an admin determines it (depends on products/quantities).
  shippingCents: integer("shipping_cents"),
  // subtotalCents + shippingCents once shipping is known, else subtotalCents.
  totalCents: integer("total_cents").notNull(),
  currency: text("currency").notNull().default("EUR"),
  // Set when the invoice is created. The rate is stored alongside the amount
  // because an invoice is a legal record: changing the rate in settings later
  // must never alter what an already-issued invoice says.
  vatCents: integer("vat_cents"),
  vatRatePercent: integer("vat_rate_percent"),
  // The seller's name, address and fiscal identifiers exactly as they stood
  // when the invoice was issued. Read live, a later address or bank change
  // would silently rewrite every invoice ever sent.
  /** Where to deliver, frozen at order time; null = the billing address. */
  deliveryAddress: jsonb("delivery_address"),
  /** Latest online payment attempt (Mollie payment id, tr_...). */
  paymentId: text("payment_id"),
  // Shipment, filled in when the order is marked as shipped.
  carrier: text("carrier"),
  trackingCode: text("tracking_code"),
  trackingUrl: text("tracking_url"),
  shippedAt: timestamp("shipped_at", { withTimezone: true }),
  /** domestic | reverse_charge — fixed when the invoice is issued. */
  vatTreatment: text("vat_treatment"),
  /** Buyer name/address/VAT number as on the invoice, frozen like the seller. */
  buyerSnapshot: jsonb("buyer_snapshot"),
  sellerSnapshot: jsonb("seller_snapshot").$type<Record<string, unknown>>(),
  invoiceNumber: text("invoice_number"),
  invoiceNotes: text("invoice_notes"),
  invoicedAt: timestamp("invoiced_at", { withTimezone: true }),
  paidAt: timestamp("paid_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
}, (t) => [uniqueIndex("orders_invoice_number_idx").on(t.invoiceNumber)]);

export const orderItems = pgTable("order_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  orderId: uuid("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  productId: uuid("product_id").references(() => products.id, {
    onDelete: "set null",
  }),
  supplierId: uuid("supplier_id").references(() => suppliers.id, {
    onDelete: "set null",
  }),
  nameSnapshot: text("name_snapshot").notNull(),
  unitPriceCents: integer("unit_price_cents").notNull(),
  /** What we paid the supplier per unit when the order was placed (for margin reports). */
  unitCostCents: integer("unit_cost_cents"),
  quantity: integer("quantity").notNull(),
});

export const creditNotesRelations = relations(creditNotes, ({ one }) => ({
  order: one(orders, { fields: [creditNotes.orderId], references: [orders.id] }),
}));

export const favoritesRelations = relations(favorites, ({ one }) => ({
  company: one(companies, { fields: [favorites.companyId], references: [companies.id] }),
  product: one(products, { fields: [favorites.productId], references: [products.id] }),
}));

export const deliveryAddressesRelations = relations(deliveryAddresses, ({ one }) => ({
  company: one(companies, { fields: [deliveryAddresses.companyId], references: [companies.id] }),
}));

export const companiesRelations = relations(companies, ({ many }) => ({
  deliveryAddresses: many(deliveryAddresses),
  users: many(users),
  cartItems: many(cartItems),
  orders: many(orders),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  company: one(companies, {
    fields: [users.companyId],
    references: [companies.id],
  }),
  sessions: many(sessions),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
}));

export const suppliersRelations = relations(suppliers, ({ many }) => ({
  products: many(products),
}));

export const productsRelations = relations(products, ({ one }) => ({
  supplier: one(suppliers, {
    fields: [products.supplierId],
    references: [suppliers.id],
  }),
}));

export const cartItemsRelations = relations(cartItems, ({ one }) => ({
  company: one(companies, {
    fields: [cartItems.companyId],
    references: [companies.id],
  }),
  product: one(products, {
    fields: [cartItems.productId],
    references: [products.id],
  }),
}));

export const ordersRelations = relations(orders, ({ one, many }) => ({
  company: one(companies, {
    fields: [orders.companyId],
    references: [companies.id],
  }),
  placedBy: one(users, {
    fields: [orders.placedByUserId],
    references: [users.id],
  }),
  items: many(orderItems),
  creditNotes: many(creditNotes),
}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, {
    fields: [orderItems.orderId],
    references: [orders.id],
  }),
  // Internal only — which supplier to (re)order this line item from to
  // fulfill the order. Never shown to the customer.
  supplier: one(suppliers, {
    fields: [orderItems.supplierId],
    references: [suppliers.id],
  }),
}));

/**
 * Key/value store for platform-wide rules an admin configures at runtime
 * (see lib/rules.ts and /admin/rules). Kept as one row per rule group with a
 * JSON body so a new rule is a field in a typed object rather than a
 * migration — the schema here stays stable while the rule set grows.
 */
export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").$type<Record<string, unknown>>().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
