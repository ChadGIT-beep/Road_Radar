import { pgTable, text, real, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const potholesTable = pgTable("potholes", {
  id: text("id").primaryKey(),
  lat: real("lat").notNull(),
  lng: real("lng").notNull(),
  severity: text("severity", { enum: ["minor", "moderate", "severe"] }).notNull(),
  status: text("status", { enum: ["reported", "confirmed", "in-progress", "fixed"] }).notNull(),
  confirmations: integer("confirmations").notNull().default(0),
  createdAt: text("created_at").notNull(),
  streetName: text("street_name").notNull(),
  neighborhood: text("neighborhood").notNull(),
  notes: text("notes"),
});

export const insertPotholeSchema = createInsertSchema(potholesTable);
export type InsertPothole = z.infer<typeof insertPotholeSchema>;
export type DbPothole = typeof potholesTable.$inferSelect;
