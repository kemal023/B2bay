import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema";

/**
 * The database is a Postgres container next to the app (docker-compose.yml,
 * service `db`). Connected lazily, so `next build` needs no DATABASE_URL.
 */
function createDb() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL!, max: 10 });
  return drizzle(pool, { schema });
}

let _db: ReturnType<typeof createDb> | null = null;

export function getDb() {
  if (!_db) _db = createDb();
  return _db;
}
