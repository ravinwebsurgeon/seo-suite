import { eq, inArray } from "drizzle-orm";
import { Session } from "@shopify/shopify-api";
import db from "../db.server";
import { sessions } from "./schema";
import type { SessionRecord } from "./schema";

type PropertyArray = [string, string | number | boolean][];

function sessionToRecord(session: Session): typeof sessions.$inferInsert {
  const props = Object.fromEntries(session.toPropertyArray(true));
  return {
    id: session.id,
    shop: session.shop,
    state: session.state,
    isOnline: Boolean(session.isOnline),
    scope: typeof props["scope"] === "string" ? props["scope"] : null,
    expires:
      typeof props["expires"] === "string"
        ? new Date(props["expires"])
        : null,
    accessToken: session.accessToken ?? "",
    userId:
      props["userId"] != null ? BigInt(props["userId"] as string) : null,
    firstName:
      typeof props["firstName"] === "string" ? props["firstName"] : null,
    lastName:
      typeof props["lastName"] === "string" ? props["lastName"] : null,
    email: typeof props["email"] === "string" ? props["email"] : null,
    accountOwner: Boolean(props["accountOwner"]),
    locale: typeof props["locale"] === "string" ? props["locale"] : null,
    collaborator:
      typeof props["collaborator"] === "boolean"
        ? props["collaborator"]
        : false,
    emailVerified:
      typeof props["emailVerified"] === "boolean"
        ? props["emailVerified"]
        : false,
    refreshToken:
      typeof props["refreshToken"] === "string"
        ? props["refreshToken"]
        : null,
    refreshTokenExpires:
      typeof props["refreshTokenExpires"] === "string"
        ? new Date(props["refreshTokenExpires"])
        : null,
  };
}

function recordToSession(record: SessionRecord): Session {
  const entries: PropertyArray = [
    ["id", record.id],
    ["shop", record.shop],
    ["state", record.state],
    ["isOnline", record.isOnline],
    ["accessToken", record.accessToken],
  ];

  if (record.scope != null) entries.push(["scope", record.scope]);
  if (record.expires != null)
    entries.push(["expires", record.expires.toISOString()]);
  if (record.userId != null)
    entries.push(["userId", record.userId.toString()]);
  if (record.firstName != null)
    entries.push(["firstName", record.firstName]);
  if (record.lastName != null)
    entries.push(["lastName", record.lastName]);
  if (record.email != null) entries.push(["email", record.email]);
  entries.push(["accountOwner", record.accountOwner]);
  if (record.locale != null) entries.push(["locale", record.locale]);
  if (record.collaborator != null)
    entries.push(["collaborator", record.collaborator]);
  if (record.emailVerified != null)
    entries.push(["emailVerified", record.emailVerified]);
  if (record.refreshToken != null)
    entries.push(["refreshToken", record.refreshToken]);
  if (record.refreshTokenExpires != null)
    entries.push([
      "refreshTokenExpires",
      record.refreshTokenExpires.toISOString(),
    ]);

  return Session.fromPropertyArray(entries);
}

export class DrizzleSessionStorage {
  async storeSession(session: Session): Promise<boolean> {
    const record = sessionToRecord(session);
    const { id, ...updateFields } = record;
    await db
      .insert(sessions)
      .values(record)
      .onConflictDoUpdate({ target: sessions.id, set: updateFields });
    return true;
  }

  async loadSession(id: string): Promise<Session | undefined> {
    const [record] = await db
      .select()
      .from(sessions)
      .where(eq(sessions.id, id))
      .limit(1);
    return record ? recordToSession(record) : undefined;
  }

  async deleteSession(id: string): Promise<boolean> {
    await db.delete(sessions).where(eq(sessions.id, id));
    return true;
  }

  async deleteSessions(ids: string[]): Promise<boolean> {
    if (ids.length > 0) {
      await db.delete(sessions).where(inArray(sessions.id, ids));
    }
    return true;
  }

  async findSessionsByShop(shop: string): Promise<Session[]> {
    const records = await db
      .select()
      .from(sessions)
      .where(eq(sessions.shop, shop));
    return records.map(recordToSession);
  }
}
