// Test fixture: approved test company + user + session. `node fixture.mjs up|down`
import { neon } from "@neondatabase/serverless";
import { createHash, randomBytes } from "node:crypto";
const sql = neon(process.env.DATABASE_URL);
const EMAIL = "claude-test@example.invalid";
if (process.argv[2] === "down") {
  const [u] = await sql`select company_id from users where email=${EMAIL}`;
  await sql`delete from users where email=${EMAIL}`;
  if (u?.company_id) {
    await sql`delete from order_items where order_id in (select id from orders where company_id=${u.company_id})`;
    await sql`delete from orders where company_id=${u.company_id}`;
    await sql`delete from companies where id=${u.company_id}`;
  }
  console.log("removed");
} else {
  const [c] = await sql`insert into companies (name, join_code, status, address_line, postal_code, city, country)
    values ('Claude Testbedrijf', 'TEST-' || substr(md5(random()::text),1,4), 'approved', 'Teststraat 1', '1234 AB', 'Teststad', 'NL') returning id`;
  const [u] = await sql`insert into users (email, password_hash, company_id, role, name) values (${EMAIL}, 'x:y', ${c.id}, 'company_admin', 'Test') returning id`;
  const token = randomBytes(32).toString("hex");
  await sql`insert into sessions (user_id, token_hash, expires_at) values (${u.id}, ${createHash("sha256").update(token).digest("hex")}, now() + interval '1 day')`;
  console.log(token);
}
