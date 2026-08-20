import { sql } from "drizzle-orm";
import { db, potholesTable, type Severity, type Status } from "@workspace/db";
import { logger } from "./logger";

const MAP_CENTER = { lat: 37.7749, lng: -122.4194 };

const STREETS = [
  "Market St", "Mission St", "Valencia St", "Howard St", "Folsom St",
  "Harrison St", "Bryant St", "Brannan St", "Townsend St", "King St",
];

const NEIGHBORHOODS = [
  "SoMa", "Mission District", "Financial District", "Hayes Valley",
  "Tenderloin", "Civic Center", "Castro", "Dogpatch",
];

interface SeedPothole {
  id: string;
  lat: number;
  lng: number;
  severity: Severity;
  status: Status;
  confirmations: number;
  createdAt: Date;
  streetName: string;
  neighborhood: string;
}

function buildSeed(count = 50): SeedPothole[] {
  // Deterministic pseudo-random, so the demo map looks the same every time it
  // is seeded into a fresh database.
  let seed = 1;
  const rng = () => {
    const x = Math.sin(seed++) * 10000;
    return x - Math.floor(x);
  };
  const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(rng() * arr.length)]!;

  const now = Date.now();
  const items: SeedPothole[] = [];

  for (let i = 0; i < count; i++) {
    const isCluster = rng() > 0.7;
    let lat = MAP_CENTER.lat + (rng() - 0.5) * 0.02;
    let lng = MAP_CENTER.lng + (rng() - 0.5) * 0.02;

    if (isCluster && items.length > 0) {
      const base = items[Math.floor(rng() * items.length)]!;
      lat = base.lat + (rng() - 0.5) * 0.002;
      lng = base.lng + (rng() - 0.5) * 0.002;
    }

    const severities: Severity[] = ["minor", "minor", "moderate", "moderate", "severe"];
    const statuses: Status[] = ["reported", "confirmed", "confirmed", "in-progress", "fixed"];
    const status = pick(statuses);
    const ageMs = Math.floor(rng() * 72 * 3600 * 1000);

    let confirmations = 0;
    if (status !== "reported") {
      confirmations = Math.floor(rng() * 15) + 1;
    } else if (ageMs > 12 * 3600 * 1000) {
      confirmations = Math.floor(rng() * 3);
    }

    items.push({
      id: `ph-${1000 + i}`,
      lat,
      lng,
      severity: pick(severities),
      status,
      confirmations,
      createdAt: new Date(now - ageMs),
      streetName: pick(STREETS),
      neighborhood: pick(NEIGHBORHOODS),
    });
  }

  // Demo hotspot near the centre, close enough to trigger the duplicate-report
  // nudge for anyone standing at MAP_CENTER.
  items[0] = {
    id: "ph-demo-1",
    lat: MAP_CENTER.lat + 0.0003,
    lng: MAP_CENTER.lng + 0.0002,
    severity: "severe",
    status: "confirmed",
    confirmations: 42,
    createdAt: new Date(now - 2 * 24 * 3600 * 1000),
    streetName: "Market St",
    neighborhood: "Civic Center",
  };

  return items;
}

/**
 * Fill an empty potholes table with the demo data.
 *
 * This used to run on every process start, because the store was a module-level
 * array. Now that reports are persisted, re-seeding would duplicate the demo
 * rows on every deploy and every autoscale cold start — so it only runs when
 * the table is genuinely empty, and does nothing thereafter.
 *
 * Seeded rows have no `reportedBy`: nobody filed them.
 */
export async function seedPotholesIfEmpty(): Promise<void> {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(potholesTable);

  if ((row?.count ?? 0) > 0) return;

  const items = buildSeed();
  // onConflictDoNothing covers the race where two instances start against the
  // same empty database at once.
  await db.insert(potholesTable).values(items).onConflictDoNothing();

  logger.info({ count: items.length }, "Seeded empty potholes table");
}
