import {
  pgTable,
  text,
  doublePrecision,
  integer,
  timestamp,
  primaryKey,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const SEVERITIES = ["minor", "moderate", "severe"] as const;
export const STATUSES = ["reported", "confirmed", "in-progress", "fixed"] as const;

export type Severity = (typeof SEVERITIES)[number];
export type Status = (typeof STATUSES)[number];

/**
 * A reported pothole. Public to read, signed-in to create.
 *
 * Severity and status are plain text rather than pg enums so that adding a
 * value later is a code change, not a migration that has to be coordinated
 * with a deploy. The API validates them against the OpenAPI contract before
 * anything reaches this table.
 *
 * `reportedBy` is nullable on purpose: the seeded demo rows have no author,
 * and a real report should outlive the account that filed it rather than
 * disappearing from the map when someone deletes their profile.
 */
export const potholesTable = pgTable(
  "potholes",
  {
    id: text("id").primaryKey(),
    lat: doublePrecision("lat").notNull(),
    lng: doublePrecision("lng").notNull(),
    severity: text("severity").notNull().$type<Severity>(),
    status: text("status").notNull().$type<Status>().default("reported"),
    // Denormalised count of the confirmations table. Kept because every map
    // marker and the whole hotspot ranking read it, and a COUNT per pothole
    // per request would be the app's first scaling problem.
    confirmations: integer("confirmations").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    streetName: text("street_name").notNull(),
    neighborhood: text("neighborhood").notNull(),
    notes: text("notes"),
    reportedBy: text("reported_by").references(() => usersTable.id, {
      onDelete: "set null",
    }),
  },
  (table) => [
    index("potholes_created_at_idx").on(table.createdAt),
    index("potholes_status_idx").on(table.status),
  ],
);

/**
 * One row per (user, pothole). The composite primary key is the rule: a person
 * can confirm a given pothole exactly once, enforced by the database rather
 * than by a check the client could skip.
 */
export const confirmationsTable = pgTable(
  "confirmations",
  {
    potholeId: text("pothole_id")
      .notNull()
      .references(() => potholesTable.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.potholeId, table.userId] }),
    index("confirmations_user_id_idx").on(table.userId),
  ],
);

export const insertPotholeSchema = createInsertSchema(potholesTable).omit({
  createdAt: true,
});

export type InsertPothole = z.infer<typeof insertPotholeSchema>;
export type Pothole = typeof potholesTable.$inferSelect;
export type Confirmation = typeof confirmationsTable.$inferSelect;
