import { migrate } from "drizzle-orm/node-postgres/migrator";
import path from "path";
import { db } from "./index";

/**
 * Apply all pending Drizzle migrations from the drizzle/ directory.
 * Safe to call on every startup — already-applied migrations are skipped.
 *
 * At runtime, the bundled file lives at <dist>/index.mjs and the migrations
 * folder is copied next to it as <dist>/drizzle/ by the build step.
 */
export async function runMigrations(): Promise<void> {
  const migrationsFolder = path.join(__dirname, "drizzle");
  await migrate(db, { migrationsFolder });
}
