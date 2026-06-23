import {
  bigint,
  boolean,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

export const sessions = pgTable("Session", {
  id: text("id").primaryKey(),
  shop: text("shop").notNull(),
  state: text("state").notNull(),
  isOnline: boolean("isOnline").notNull().default(false),
  scope: text("scope"),
  expires: timestamp("expires", { withTimezone: true }),
  accessToken: text("accessToken").notNull().default(""),
  userId: bigint("userId", { mode: "bigint" }),
  firstName: text("firstName"),
  lastName: text("lastName"),
  email: text("email"),
  accountOwner: boolean("accountOwner").notNull().default(false),
  locale: text("locale"),
  collaborator: boolean("collaborator").default(false),
  emailVerified: boolean("emailVerified").default(false),
  refreshToken: text("refreshToken"),
  refreshTokenExpires: timestamp("refreshTokenExpires", { withTimezone: true }),
});

export type SessionRecord = typeof sessions.$inferSelect;
export type NewSessionRecord = typeof sessions.$inferInsert;
