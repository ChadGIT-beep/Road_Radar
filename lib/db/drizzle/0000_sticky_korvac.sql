CREATE TABLE IF NOT EXISTS "potholes" (
	"id" text PRIMARY KEY NOT NULL,
	"lat" real NOT NULL,
	"lng" real NOT NULL,
	"severity" text NOT NULL,
	"status" text NOT NULL,
	"confirmations" integer DEFAULT 0 NOT NULL,
	"created_at" text NOT NULL,
	"street_name" text NOT NULL,
	"neighborhood" text NOT NULL,
	"notes" text
);
