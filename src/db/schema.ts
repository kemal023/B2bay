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

export const orderStatusEnum = pgEnum("order_status", [
  "pending_payment",
  "paid",
  "processing",
  "fulfilled",
  "cancelled",
  "refunded",
]);

/** A B2B customer organization that can place orders. */
export const companies = pgTable("companies", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  kvkNumber: text("kvk_number"),
  vatNumber: text("vat_number"),
  billingEmail: text("billing_email"),
  status: companyStatusEnum("status").notNull().default("pending"),
  joinCode: text("join_code").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
}, (t) => [uniqueIndex("companies_join_code_idx").on(t.joinCode)]);

/** A person who can sign in, linked to Clerk and scoped to a company. */
export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clerkUserId: text("clerk_user_id").notNull(),
    companyId: uuid("company_id").references(() => companies.id, {
      onDelete: "set null",
    }),
    email: text("email").notNull(),
    name: text("name"),
    role: userRoleEnum("role").notNull().default("buyer"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex("users_clerk_user_id_idx").on(t.clerkUserId)],
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
    active: boolean("active").notNull().default(true),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
    lastSyncError: text("last_sync_error"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex("suppliers_slug_idx").on(t.slug)],
);

/** A product mirrored from a supplier's catalog into our own store. */
export const products = pgTable(
  "products",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    supplierId: uuid("supplier_id")
      .notNull()
      .references(() => suppliers.id, { onDelete: "cascade" }),
    supplierSku: text("supplier_sku").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    imageUrl: text("image_url"),
    category: text("category"),
    unit: text("unit").notNull().default("stuk"),
    priceCents: integer("price_cents").notNull(),
    currency: text("currency").notNull().default("EUR"),
    stockQty: integer("stock_qty").notNull().default(0),
    minOrderQty: integer("min_order_qty").notNull().default(1),
    active: boolean("active").notNull().default(true),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("products_supplier_sku_idx").on(t.supplierId, t.supplierSku),
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
  status: orderStatusEnum("status").notNull().default("pending_payment"),
  subtotalCents: integer("subtotal_cents").notNull(),
  totalCents: integer("total_cents").notNull(),
  currency: text("currency").notNull().default("EUR"),
  stripeCheckoutSessionId: text("stripe_checkout_session_id"),
  stripePaymentIntentId: text("stripe_payment_intent_id"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

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
  quantity: integer("quantity").notNull(),
});

export const companiesRelations = relations(companies, ({ many }) => ({
  users: many(users),
  cartItems: many(cartItems),
  orders: many(orders),
}));

export const usersRelations = relations(users, ({ one }) => ({
  company: one(companies, {
    fields: [users.companyId],
    references: [companies.id],
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
  items: many(orderItems),
}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, {
    fields: [orderItems.orderId],
    references: [orders.id],
  }),
}));
