import type { Locale } from "@/lib/i18n/config";
import { appUrl, type Email } from "@/lib/email/send";

export const SHOP_NAME = "CosmeWeb";

function escape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

type Content = {
  subject: string;
  heading: string;
  /** Plain text paragraphs; escaped here. */
  paragraphs: string[];
  /** Label/value rows shown as a small table, e.g. order details. */
  details?: [string, string][];
  button?: { label: string; url: string };
  footer: string;
};

/** One simple, table-based layout: renders in every mail client, incl. Outlook. */
function render(c: Content, to: string | string[]): Email {
  const details = c.details?.length
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:20px 0;border-collapse:collapse;font-size:14px">${c.details
        .map(
          ([k, v]) =>
            `<tr><td style="padding:8px 0;color:#64748b;border-bottom:1px solid #e2e8f0">${escape(k)}</td><td style="padding:8px 0;text-align:right;font-weight:600;border-bottom:1px solid #e2e8f0">${escape(v)}</td></tr>`,
        )
        .join("")}</table>`
    : "";
  const button = c.button
    ? `<p style="margin:28px 0"><a href="${escape(c.button.url)}" style="display:inline-block;background:#0f766e;color:#ffffff;text-decoration:none;font-weight:600;padding:12px 22px;border-radius:8px">${escape(c.button.label)}</a></p>`
    : "";

  const html = `<!doctype html><html><body style="margin:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;color:#0f172a">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden">
<tr><td style="padding:22px 32px;border-bottom:1px solid #e2e8f0"><img src="${appUrl("/logo.png")}" alt="${SHOP_NAME}" height="32" style="height:32px"></td></tr>
<tr><td style="padding:28px 32px;font-size:15px;line-height:1.6">
<h1 style="margin:0 0 16px;font-size:20px">${escape(c.heading)}</h1>
${c.paragraphs.map((p) => `<p style="margin:0 0 12px">${escape(p)}</p>`).join("")}
${details}${button}
</td></tr>
<tr><td style="padding:18px 32px;background:#f8fafc;color:#64748b;font-size:12px">${escape(c.footer)}</td></tr>
</table></td></tr></table></body></html>`;

  const text = [
    c.heading,
    "",
    ...c.paragraphs,
    ...(c.details ?? []).map(([k, v]) => `${k}: ${v}`),
    ...(c.button ? ["", `${c.button.label}: ${c.button.url}`] : []),
    "",
    "--",
    c.footer,
  ].join("\n");

  return { to, subject: c.subject, html, text };
}

const footer = (locale: Locale) =>
  locale === "en"
    ? `${SHOP_NAME} · B2B wholesale. You receive this e-mail because you have a business account with us.`
    : `${SHOP_NAME} · Zakelijke groothandel. Je ontvangt deze e-mail omdat je een zakelijk account bij ons hebt.`;

// ---------------------------------------------------------------------------
// Customer mails (NL/EN, following the user's chosen language)
// ---------------------------------------------------------------------------

export function passwordResetEmail(to: string, locale: Locale, link: string): Email {
  return render(
    locale === "en"
      ? {
          subject: `Reset your ${SHOP_NAME} password`,
          heading: "Reset your password",
          paragraphs: [
            "We received a request to reset the password for your account. Click the button below to choose a new password.",
            "This link is valid for 1 hour and can be used once. Didn't request this? Then you can ignore this e-mail — your password stays the same.",
          ],
          button: { label: "Choose a new password", url: link },
          footer: footer(locale),
        }
      : {
          subject: `Stel je ${SHOP_NAME}-wachtwoord opnieuw in`,
          heading: "Wachtwoord opnieuw instellen",
          paragraphs: [
            "We kregen een verzoek om het wachtwoord van je account opnieuw in te stellen. Klik op de knop hieronder om een nieuw wachtwoord te kiezen.",
            "Deze link is 1 uur geldig en werkt één keer. Heb je dit niet aangevraagd? Dan kun je deze e-mail negeren — je wachtwoord blijft hetzelfde.",
          ],
          button: { label: "Nieuw wachtwoord kiezen", url: link },
          footer: footer(locale),
        },
    to,
  );
}

export function companyApprovedEmail(to: string, locale: Locale, companyName: string): Email {
  return render(
    locale === "en"
      ? {
          subject: `Your business account has been approved`,
          heading: "Welcome — your account is approved",
          paragraphs: [
            `Good news: ${companyName} has been approved. You can now see our wholesale prices and place orders.`,
          ],
          button: { label: "View the catalogue", url: appUrl("/products") },
          footer: footer(locale),
        }
      : {
          subject: `Je zakelijke account is goedgekeurd`,
          heading: "Welkom — je account is goedgekeurd",
          paragraphs: [
            `Goed nieuws: ${companyName} is goedgekeurd. Je ziet nu onze groothandelsprijzen en kunt bestellen.`,
          ],
          button: { label: "Bekijk de catalogus", url: appUrl("/products") },
          footer: footer(locale),
        },
    to,
  );
}

export function invoiceIssuedEmail(
  to: string | string[],
  locale: Locale,
  invoice: { number: string; total: string; dueDate: string; orderId: string },
): Email {
  const url = appUrl(`/invoices/${invoice.orderId}`);
  return render(
    locale === "en"
      ? {
          subject: `Invoice ${invoice.number}`,
          heading: `Invoice ${invoice.number}`,
          paragraphs: [
            "Thank you for your order. Your invoice is ready. You can view and download it (as PDF) via the button below.",
            "Please transfer the amount before the due date, stating the invoice number.",
          ],
          details: [
            ["Invoice number", invoice.number],
            ["Amount due", invoice.total],
            ["Due date", invoice.dueDate],
          ],
          button: { label: "View invoice", url },
          footer: footer(locale),
        }
      : {
          subject: `Factuur ${invoice.number}`,
          heading: `Factuur ${invoice.number}`,
          paragraphs: [
            "Bedankt voor je bestelling. Je factuur staat klaar. Je kunt hem bekijken en downloaden (als pdf) via de knop hieronder.",
            "Maak het bedrag vóór de vervaldatum over onder vermelding van het factuurnummer.",
          ],
          details: [
            ["Factuurnummer", invoice.number],
            ["Te betalen", invoice.total],
            ["Vervaldatum", invoice.dueDate],
          ],
          button: { label: "Factuur bekijken", url },
          footer: footer(locale),
        },
    to,
  );
}

export function orderShippedEmail(
  to: string,
  locale: Locale,
  order: { reference: string; orderId: string; carrier?: string | null; trackingUrl?: string | null; trackingCode?: string | null },
): Email {
  const details: [string, string][] = [];
  if (order.carrier) details.push([locale === "en" ? "Carrier" : "Vervoerder", order.carrier]);
  if (order.trackingCode) details.push([locale === "en" ? "Tracking code" : "Trackingcode", order.trackingCode]);
  const button = order.trackingUrl
    ? { label: locale === "en" ? "Track your shipment" : "Volg je zending", url: order.trackingUrl }
    : { label: locale === "en" ? "View order" : "Bestelling bekijken", url: appUrl(`/dashboard/orders/${order.orderId}`) };

  return render(
    locale === "en"
      ? {
          subject: `Your order ${order.reference} has been shipped`,
          heading: "Your order is on its way",
          paragraphs: [`Order ${order.reference} has been shipped.`],
          details,
          button,
          footer: footer(locale),
        }
      : {
          subject: `Je bestelling ${order.reference} is verzonden`,
          heading: "Je bestelling is onderweg",
          paragraphs: [`Bestelling ${order.reference} is verzonden.`],
          details,
          button,
          footer: footer(locale),
        },
    to,
  );
}

// ---------------------------------------------------------------------------
// Admin notifications (Dutch, like the rest of the admin)
// ---------------------------------------------------------------------------

export function adminNewCompanyEmail(
  to: string[],
  company: { name: string; kvkNumber: string | null; vatNumber: string | null; email: string },
): Email {
  return render(
    {
      subject: `Nieuwe aanmelding: ${company.name}`,
      heading: "Nieuw bedrijf wacht op goedkeuring",
      paragraphs: [`${company.name} heeft zich aangemeld en wacht op je beoordeling.`],
      details: [
        ["Bedrijf", company.name],
        ["KVK", company.kvkNumber || "—"],
        ["Btw-nummer", company.vatNumber || "—"],
        ["E-mail", company.email],
      ],
      button: { label: "Beoordelen", url: appUrl("/admin/companies") },
      footer: `${SHOP_NAME} · admin-melding`,
    },
    to,
  );
}

export function adminNewOrderEmail(
  to: string[],
  order: { id: string; company: string; subtotal: string; lines: number; freeShipping: boolean },
): Email {
  return render(
    {
      subject: `Nieuwe bestelling van ${order.company} (${order.subtotal})`,
      heading: "Nieuwe bestelling",
      paragraphs: [
        order.freeShipping
          ? "Deze bestelling komt boven de drempel voor gratis verzending."
          : "Bepaal de verzendkosten en maak de factuur aan.",
      ],
      details: [
        ["Bedrijf", order.company],
        ["Subtotaal (excl. btw)", order.subtotal],
        ["Regels", String(order.lines)],
      ],
      button: { label: "Bestelling openen", url: appUrl(`/admin/orders/${order.id}`) },
      footer: `${SHOP_NAME} · admin-melding`,
    },
    to,
  );
}
