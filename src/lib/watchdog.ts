import "server-only";
import { readdir, stat } from "node:fs/promises";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { settings } from "@/db/schema";
import { getCompanyDetails } from "@/lib/invoicing";
import { appUrl, sendEmail } from "@/lib/email/send";
import { SHOP_NAME } from "@/lib/brand";

/**
 * Internal health checks, run by the scheduler every few minutes. Problems
 * are mailed to the admins — once when they appear, then at most daily while
 * they last — so nothing breaks silently (a failing supplier feed, backups
 * that stopped, the translation service being down).
 */

export type Problem = { key: string; message: string };

const STATE_KEY = "watchdog";
const REMIND_MS = 24 * 60 * 60 * 1000;
const BACKUP_DIR = process.env.BACKUP_DIR ?? "/backups";

export async function findProblems(): Promise<Problem[]> {
  const problems: Problem[] = [];
  const db = getDb();

  for (const s of await db.query.suppliers.findMany({ where: (t, { eq }) => eq(t.active, true) })) {
    if (s.lastSyncError) {
      problems.push({ key: `sync-error:${s.id}`, message: `Leverancier ${s.name}: ${s.lastSyncError}` });
    }
    const stale = s.syncIntervalMinutes * 3 * 60_000;
    if (!s.lastSyncedAt || Date.now() - s.lastSyncedAt.getTime() > Math.max(stale, 6 * 3600_000)) {
      problems.push({
        key: `sync-stale:${s.id}`,
        message: `Leverancier ${s.name} is sinds ${s.lastSyncedAt?.toLocaleString("nl-NL") ?? "nooit"} niet gesynchroniseerd.`,
      });
    }
  }

  // Backups: the newest dump must be less than 26 hours old.
  try {
    const files = (await readdir(BACKUP_DIR)).filter((f) => f.endsWith(".dump"));
    const newest = Math.max(0, ...(await Promise.all(files.map(async (f) => (await stat(`${BACKUP_DIR}/${f}`)).mtimeMs))));
    if (Date.now() - newest > 26 * 3600_000) {
      problems.push({
        key: "backup-stale",
        message: newest ? `Laatste database-back-up is van ${new Date(newest).toLocaleString("nl-NL")}.` : "Er zijn geen database-back-ups gevonden.",
      });
    }
  } catch {
    problems.push({ key: "backup-missing", message: `Back-upmap ${BACKUP_DIR} is niet leesbaar.` });
  }

  if (process.env.TRANSLATE_URL) {
    try {
      const res = await fetch(`${process.env.TRANSLATE_URL}/languages`, { signal: AbortSignal.timeout(10_000) });
      if (!res.ok) throw new Error(String(res.status));
    } catch {
      problems.push({ key: "translate-down", message: "De vertaaldienst (LibreTranslate) reageert niet." });
    }
  }

  return problems;
}

type State = { notified: Record<string, number> };

/** Mails new problems (and daily reminders); returns what is wrong now. */
export async function runWatchdog(): Promise<{ problems: Problem[]; mailed: boolean }> {
  const db = getDb();
  const problems = await findProblems();
  const row = await db.query.settings.findFirst({ where: eq(settings.key, STATE_KEY) });
  const state = ((row?.value as State | undefined) ?? { notified: {} }) as State;

  const now = Date.now();
  const due = problems.filter((p) => !state.notified[p.key] || now - state.notified[p.key] > REMIND_MS);

  let mailed = false;
  if (due.length > 0) {
    const details = await getCompanyDetails();
    const admins = await db.query.users.findMany({ where: (t, { eq }) => eq(t.role, "platform_admin") });
    const to = [...new Set([details.email, ...admins.map((a) => a.email)].filter(Boolean))];
    const lines = problems.map((p) => `• ${p.message}`);
    mailed = await sendEmail({
      to,
      subject: `${SHOP_NAME}: ${problems.length} probleem/problemen gevonden`,
      text: `De automatische controle vond:\n\n${lines.join("\n")}\n\nAdmin: ${appUrl("/admin")}`,
      html: `<p>De automatische controle vond:</p><ul>${problems
        .map((p) => `<li>${p.message.replace(/</g, "&lt;")}</li>`)
        .join("")}</ul><p><a href="${appUrl("/admin")}">Naar de admin</a></p>`,
    });
  }

  // Only count a problem as reported once the mail actually went out, so it
  // is still mailed after SMTP gets configured.
  const next: State = {
    notified: Object.fromEntries(
      problems
        .map((p) => [p.key, mailed && due.includes(p) ? now : state.notified[p.key]] as const)
        .filter(([, at]) => at != null),
    ),
  };
  await db
    .insert(settings)
    .values({ key: STATE_KEY, value: next, updatedAt: new Date() })
    .onConflictDoUpdate({ target: settings.key, set: { value: next, updatedAt: new Date() } });
  return { problems, mailed };
}
