import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./db/schema";

declare global {
  // eslint-disable-next-line no-var
  var __dbPool: Pool | undefined;
}

function getPool(): Pool {
  if (!globalThis.__dbPool) {
    globalThis.__dbPool = new Pool({
      connectionString: process.env.DATABASE_URL,
    });
  }
  return globalThis.__dbPool;
}

const db = drizzle(getPool(), { schema });

export default db;
export type DrizzleDB = typeof db;
