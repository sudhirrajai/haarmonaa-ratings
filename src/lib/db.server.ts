/**
 * src/lib/db.server.ts
 * Singleton Drizzle ORM client backed by mysql2.
 * ONLY import this from *.server.ts files or server functions.
 */
import { ensureEnvLoaded } from "./env.server";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import * as schema from "../../drizzle/schema";

ensureEnvLoaded();

function createDb() {
  const MYSQL_URL = process.env["MYSQL_URL"];
  if (!MYSQL_URL) {
    throw new Error(
      "Missing MYSQL_URL environment variable. Set it in your .env file.",
    );
  }
  const pool = mysql.createPool(MYSQL_URL);
  return drizzle(pool, { schema, mode: "default" });
}

// Singleton — reuse the connection pool across requests in the same process
let _db: ReturnType<typeof createDb> | undefined;

export function getDb() {
  if (!_db) _db = createDb();
  return _db;
}

// Convenience re-export so callers can just `import { db } from "@/lib/db.server"`
export const db = new Proxy({} as ReturnType<typeof createDb>, {
  get(_, prop, receiver) {
    return Reflect.get(getDb(), prop, receiver);
  },
});

export { schema };
