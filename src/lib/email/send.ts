import "server-only";
import nodemailer, { type Transporter } from "nodemailer";

/**
 * Outgoing mail over plain SMTP, so any provider works (own mail host,
 * Brevo, Resend, Mailgun, ...). Configure with SMTP_HOST, SMTP_PORT,
 * SMTP_USER, SMTP_PASS, MAIL_FROM. Without SMTP_HOST mails are only logged:
 * the shop keeps working, it just doesn't send anything.
 */

export type Email = {
  to: string | string[];
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
};

let transporter: Transporter | null = null;

export function emailConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST && process.env.MAIL_FROM);
}

function getTransporter(): Transporter {
  if (!transporter) {
    const port = Number(process.env.SMTP_PORT ?? 587);
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: process.env.SMTP_SECURE ? process.env.SMTP_SECURE === "true" : port === 465,
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined,
    });
  }
  return transporter;
}

/** Sends one mail. Never throws: a mail failure must not fail an order or a sign-up. */
export async function sendEmail(email: Email): Promise<boolean> {
  const to = (Array.isArray(email.to) ? email.to : [email.to]).filter(Boolean);
  if (to.length === 0) return false;

  if (!emailConfigured()) {
    console.info(`[mail] niet verstuurd (SMTP niet ingesteld): "${email.subject}" → ${to.join(", ")}`);
    return false;
  }

  try {
    await getTransporter().sendMail({
      from: process.env.MAIL_FROM,
      to,
      replyTo: email.replyTo,
      subject: email.subject,
      html: email.html,
      text: email.text,
    });
    return true;
  } catch (err) {
    console.error(`[mail] versturen mislukt: "${email.subject}" → ${to.join(", ")}`, err);
    return false;
  }
}

/** Absolute base URL for links in mails. */
export function appUrl(path = ""): string {
  const base = (process.env.APP_URL ?? "http://localhost:3003").replace(/\/+$/, "");
  return `${base}${path}`;
}
