/**
 * Runs the shop's recurring jobs inside Docker (the Vercel cron in vercel.ts
 * only fires when the app is hosted on Vercel).
 *
 *   - supplier sync: asks the app every 10 minutes to sync the suppliers
 *     whose own interval (Admin -> Leveranciers) has passed.
 *
 * Runs one job at a time and waits for it to finish, so syncs never overlap.
 *
 *   volgen          : docker logs -f cosmeweb-scheduler
 *   nu alles syncen : docker exec cosmeweb-scheduler node scripts/scheduler.mjs --once --all
 */

import http from "node:http";

const APP = process.env.APP_INTERNAL_URL ?? "http://app:3000";
const SECRET = process.env.CRON_SECRET ?? "";
const EVERY_MS = 10 * 60 * 1000;
const ONCE = process.argv.includes("--once");
const ALL = process.argv.includes("--all");

const time = () => new Date().toLocaleTimeString("nl-NL");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * GET returning parsed JSON. Plain node:http rather than fetch: fetch gives
 * up when response headers take longer than 5 minutes, and a full catalogue
 * sync answers only when it is done.
 */
function getJson(url, timeoutMs) {
  return new Promise((resolve, reject) => {
    const req = http.get(
      url,
      { headers: SECRET ? { authorization: `Bearer ${SECRET}` } : {}, timeout: timeoutMs },
      (res) => {
        let body = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => (body += chunk));
        res.on("end", () => {
          if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`));
          try {
            resolve(JSON.parse(body));
          } catch (err) {
            reject(err);
          }
        });
      },
    );
    req.on("timeout", () => req.destroy(new Error("timeout")));
    req.on("error", reject);
  });
}

async function syncSuppliers() {
  const { results } = await getJson(`${APP}/api/cron/sync-suppliers${ALL ? "?all=1" : ""}`, 90 * 60 * 1000);
  if (results.length === 0) return;
  for (const r of results) {
    const line = r.ok
      ? `${r.supplierName}: ${r.productsUpserted} bijgewerkt, ${r.productsDeactivated} gedeactiveerd${r.warning ? ` — LET OP: ${r.warning}` : ""}`
      : `${r.supplierName}: MISLUKT — ${r.error}`;
    console.log(`${time()} sync ${line}`);
  }
}

if (ONCE) {
  console.log(`${time()} sync gestart${ALL ? " (alle leveranciers)" : ""}`);
  await syncSuppliers();
  console.log(`${time()} klaar`);
  process.exit(0);
}

// Give the app a moment to start after a `docker compose up`.
await sleep(30_000);
console.log(`${time()} scheduler gestart (sync-check elke ${EVERY_MS / 60000} min)`);
for (;;) {
  try {
    await syncSuppliers();
  } catch (err) {
    console.error(`${time()} sync-check mislukt: ${err.message}`);
  }
  await sleep(EVERY_MS);
}
