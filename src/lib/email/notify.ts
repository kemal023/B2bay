import "server-only";
import { after } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { companies, orders, users } from "@/db/schema";
import { formatDate, formatDateOnly, formatPriceCents } from "@/lib/format";
import { getCompanyDetails, invoiceDueDate } from "@/lib/invoicing";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { sendEmail, type Email } from "@/lib/email/send";
import { carrierName } from "@/lib/shipping-carriers";
import {
  adminNewCompanyEmail,
  adminNewOrderEmail,
  companyApprovedEmail,
  invoiceIssuedEmail,
  orderShippedEmail,
} from "@/lib/email/templates";

/**
 * Event mails. Each one is sent after the response, so a slow or failing
 * mail server never delays or breaks the action that triggered it.
 */
function later(build: () => Promise<Email | Email[] | null>) {
  after(async () => {
    try {
      const mails = await build();
      for (const mail of [mails ?? []].flat()) await sendEmail(mail);
    } catch (err) {
      console.error("[mail] opbouwen mislukt", err);
    }
  });
}

const localeOf = (value: string | null | undefined): Locale => (isLocale(value) ? value : "nl");

/** The shop's own contact address plus every platform admin. */
async function adminRecipients(): Promise<string[]> {
  const db = getDb();
  const [details, admins] = await Promise.all([
    getCompanyDetails(),
    db.query.users.findMany({ where: eq(users.role, "platform_admin"), columns: { email: true } }),
  ]);
  return [...new Set([details.email, ...admins.map((a) => a.email)].filter(Boolean))];
}

export function notifyNewCompany(companyId: string, registeredBy: string) {
  later(async () => {
    const db = getDb();
    const company = await db.query.companies.findFirst({ where: eq(companies.id, companyId) });
    const to = await adminRecipients();
    if (!company || to.length === 0) return null;
    return adminNewCompanyEmail(to, {
      name: company.name,
      kvkNumber: company.kvkNumber,
      vatNumber: company.vatNumber,
      email: registeredBy,
    });
  });
}

export function notifyCompanyApproved(companyId: string) {
  later(async () => {
    const db = getDb();
    const company = await db.query.companies.findFirst({
      where: eq(companies.id, companyId),
      with: { users: true },
    });
    if (!company) return null;
    return company.users.map((u) => companyApprovedEmail(u.email, localeOf(u.locale), company.name));
  });
}

export function notifyNewOrder(orderId: string) {
  later(async () => {
    const db = getDb();
    const order = await db.query.orders.findFirst({
      where: eq(orders.id, orderId),
      with: { company: true, items: true },
    });
    const to = await adminRecipients();
    if (!order || to.length === 0) return null;
    return adminNewOrderEmail(to, {
      id: order.id,
      company: order.company.name,
      subtotal: formatPriceCents(order.subtotalCents, order.currency),
      lines: order.items.length,
      freeShipping: order.shippingCents === 0,
    });
  });
}

/** To the person who ordered, plus the company's billing address if that's someone else. */
export function notifyInvoiceIssued(orderId: string) {
  later(async () => {
    const db = getDb();
    const order = await db.query.orders.findFirst({
      where: eq(orders.id, orderId),
      with: { company: true, placedBy: true },
    });
    if (!order?.invoiceNumber || !order.invoicedAt) return null;

    const locale = localeOf(order.placedBy?.locale);
    const details = await getCompanyDetails();
    const to = [
      ...new Set([order.placedBy?.email, order.company.billingEmail].filter((e): e is string => !!e)),
    ];
    return invoiceIssuedEmail(to, locale, {
      number: order.invoiceNumber,
      total: formatPriceCents(order.totalCents, order.currency),
      dueDate: formatDateOnly(invoiceDueDate(order.invoicedAt, details.paymentTermDays)),
      orderId: order.id,
    });
  });
}

export function notifyOrderShipped(orderId: string) {
  later(async () => {
    const db = getDb();
    const order = await db.query.orders.findFirst({
      where: eq(orders.id, orderId),
      with: { placedBy: true },
    });
    if (!order?.placedBy) return null;
    const locale = localeOf(order.placedBy.locale);
    return orderShippedEmail(order.placedBy.email, locale, {
      orderId: order.id,
      reference: order.invoiceNumber ?? formatDate(order.createdAt, locale),
      carrier: carrierName(order.carrier),
      trackingCode: order.trackingCode,
      trackingUrl: order.trackingUrl,
    });
  });
}
