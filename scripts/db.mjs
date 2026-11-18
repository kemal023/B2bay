/**
 * Database client for the scripts. Usable the way the scripts were written:
 *
 *   const rows = await sql`select … where id = ${id}`;
 *   const rows = await sql.query("select … where id = $1", [id]);
 *
 * Both return the rows. Backed by a small pg pool on DATABASE_URL.
 */
import pg from "pg";

export function connect(url = process.env.DATABASE_URL) {
  const pool = new pg.Pool({ connectionString: url, max: 4, allowExitOnIdle: true });
  const query = async (text, params = []) => (await pool.query(text, params)).rows;
  const sql = (strings, ...values) =>
    query(strings.reduce((text, s, i) => text + `$${i}` + s), values);
  sql.query = query;
  sql.end = () => pool.end();
  return sql;
}
