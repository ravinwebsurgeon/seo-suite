import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./db/schema";

declare global {
  // eslint-disable-next-line no-var
  var __dbPool: Pool | undefined;
}

function createPool(): Pool {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    // Bound how long we'll wait to acquire a usable connection. The pg default
    // is 0 (wait forever): against Neon's serverless pooler a cold start, a
    // busy pooler, or a dropped tunnel connection then hangs the request with
    // no timeout. Since every route loader does `authenticate.admin()` (a
    // session DB read), that hang is what freezes App Bridge on "Handling
    // response" — sometimes forever.
    connectionTimeoutMillis: 10_000,
    // Recycle idle connections well before Neon's pooler closes them
    // server-side, so we never hand a half-open socket to a query.
    idleTimeoutMillis: 30_000,
    max: 10,
    // Client-side per-query ceiling so a stuck statement can't wedge a loader
    // indefinitely. (query_timeout is enforced by node-postgres itself, so it
    // works regardless of what the PgBouncer pooler allows.)
    query_timeout: 15_000,
    keepAlive: true,
  });

  // Critical: without a listener, an error emitted on an *idle* client (Neon
  // closing a pooled connection) has no handler and crashes the Node process.
  // Logging it lets the pool quietly discard the dead client and move on.
  pool.on("error", (err) => {
    console.error("[db] idle client error:", err.message);
  });

  return pool;
}

function getPool(): Pool {
  if (!globalThis.__dbPool) {
    globalThis.__dbPool = createPool();
  }
  return globalThis.__dbPool;
}

const db = drizzle(getPool(), { schema });

export default db;
export type DrizzleDB = typeof db;
