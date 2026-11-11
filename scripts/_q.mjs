import { neon } from "@neondatabase/serverless";
const sql = neon(process.env.DATABASE_URL);
await sql`update users set role = ${process.argv[2]} where email = 'claude-test@example.invalid'`;
