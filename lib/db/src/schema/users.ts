import { pgTable, text, timestamp, uniqueIndex, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * A person who can report and confirm potholes.
 *
 * Reading PatchWork needs no account — the map and the hotspot ranking are
 * public. An account exists only so that a *write* can be attributed to
 * someone, which is what stops one caller inflating a street's ranking.
 *
 * `emailNormalized` is what the unique index and every lookup use, so
 * `Chad@Example.com` and `chad@example.com` cannot become two accounts.
 * `email` keeps whatever the person actually typed, for display.
 */
export const usersTable = pgTable(
  "users",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull(),
    emailNormalized: text("email_normalized").notNull(),
    // scrypt, encoded as `scrypt$N$r$p$salt$hash`. Never leaves the server.
    passwordHash: text("password_hash").notNull(),
    displayName: text("display_name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("users_email_normalized_idx").on(table.emailNormalized)],
);

/**
 * A logged-in browser session, keyed by the opaque token held in the cookie.
 *
 * Sessions live in Postgres rather than in memory so that they survive a
 * restart and hold up across autoscale instances — an in-memory map would sign
 * everyone out whenever a container recycled, and would sign them out at
 * random when two instances disagreed.
 */
export const sessionsTable = pgTable(
  "sessions",
  {
    // sha256 of the cookie token. A database leak must not hand over live
    // sessions, so the raw token is never stored.
    tokenHash: text("token_hash").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (table) => [index("sessions_user_id_idx").on(table.userId)],
);

export const insertUserSchema = createInsertSchema(usersTable).omit({
  id: true,
  createdAt: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;
export type Session = typeof sessionsTable.$inferSelect;
