import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { CreatePotholeBody } from "@workspace/api-zod";
import { db, potholesTable } from "@workspace/db";

const router: IRouter = Router();

// ─── Seed data helpers ────────────────────────────────────────────────────────

const MAP_CENTER = { lat: 37.7749, lng: -122.4194 };

const STREETS = [
  "Market St", "Mission St", "Valencia St", "Howard St", "Folsom St",
  "Harrison St", "Bryant St", "Brannan St", "Townsend St", "King St",
];

const NEIGHBORHOODS = [
  "SoMa", "Mission District", "Financial District", "Hayes Valley",
  "Tenderloin", "Civic Center", "Castro", "Dogpatch",
];

let seed = 1;
function rng() {
  const x = Math.sin(seed++) * 10000;
  return x - Math.floor(x);
}
function pick<T>(arr: T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}

type Severity = "minor" | "moderate" | "severe";
type Status = "reported" | "confirmed" | "in-progress" | "fixed";

function buildSeedRows(count = 50) {
  seed = 1; // reset for reproducibility
  const now = Date.now();
  const rows: (typeof potholesTable.$inferInsert)[] = [];

  for (let i = 0; i < count; i++) {
    const isCluster = rng() > 0.7;
    let lat = MAP_CENTER.lat + (rng() - 0.5) * 0.02;
    let lng = MAP_CENTER.lng + (rng() - 0.5) * 0.02;

    if (isCluster && rows.length > 0) {
      const base = rows[Math.floor(rng() * rows.length)];
      lat = base.lat + (rng() - 0.5) * 0.002;
      lng = base.lng + (rng() - 0.5) * 0.002;
    }

    const severities: Severity[] = ["minor", "minor", "moderate", "moderate", "severe"];
    const statuses: Status[] = ["reported", "confirmed", "confirmed", "in-progress", "fixed"];
    const severity = pick(severities);
    const status = pick(statuses);
    const ageMs = Math.floor(rng() * 72 * 3600 * 1000);
    let confirmations = 0;
    if (status !== "reported") {
      confirmations = Math.floor(rng() * 15) + 1;
    } else if (ageMs > 12 * 3600 * 1000) {
      confirmations = Math.floor(rng() * 3);
    }

    rows.push({
      id: `ph-${1000 + i}`,
      lat, lng, severity, status, confirmations,
      createdAt: new Date(now - ageMs).toISOString(),
      streetName: pick(STREETS),
      neighborhood: pick(NEIGHBORHOODS),
    });
  }

  // Demo hotspot near center
  rows[0] = {
    id: "ph-demo-1",
    lat: MAP_CENTER.lat + 0.0003,
    lng: MAP_CENTER.lng + 0.0002,
    severity: "severe",
    status: "confirmed",
    confirmations: 42,
    createdAt: new Date(now - 2 * 24 * 3600 * 1000).toISOString(),
    streetName: "Market St",
    neighborhood: "Civic Center",
  };

  return rows;
}

async function seedIfEmpty() {
  const existing = await db.select({ id: potholesTable.id }).from(potholesTable).limit(1);
  if (existing.length === 0) {
    const rows = buildSeedRows(50);
    await db.insert(potholesTable).values(rows);
  }
}

// Seed on first load (non-blocking to avoid delaying startup)
seedIfEmpty().catch((err) => {
  console.error("Seeding failed:", err);
});

// ─── Routes ──────────────────────────────────────────────────────────────────

router.get("/potholes", async (_req, res) => {
  try {
    const rows = await db.select().from(potholesTable);
    res.json(rows.map(toApiShape));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch potholes" });
  }
});

router.post("/potholes", async (req, res) => {
  const parsed = CreatePotholeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.errors.map((e) => e.message).join(", ") });
    return;
  }

  const { lat, lng, severity, notes, streetName, neighborhood } = parsed.data;

  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    res.status(400).json({ error: "Coordinates out of valid range" });
    return;
  }

  const id = `ph-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const createdAt = new Date().toISOString();

  try {
    const [row] = await db
      .insert(potholesTable)
      .values({ id, lat, lng, severity, status: "reported", confirmations: 0, createdAt, streetName, neighborhood, notes })
      .returning();
    res.status(201).json(toApiShape(row));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create pothole" });
  }
});

router.post("/potholes/:id/confirm", async (req, res) => {
  const { id } = req.params;

  try {
    const [pothole] = await db.select().from(potholesTable).where(eq(potholesTable.id, id));

    if (!pothole) {
      res.status(404).json({ error: "Pothole not found" });
      return;
    }

    if (pothole.status === "fixed") {
      res.status(400).json({ error: "Cannot confirm a pothole that has already been fixed" });
      return;
    }

    const newConfirmations = pothole.confirmations + 1;
    const newStatus: Status =
      pothole.status === "reported" && newConfirmations >= 3
        ? "confirmed"
        : (pothole.status as Status);

    const [updated] = await db
      .update(potholesTable)
      .set({ confirmations: newConfirmations, status: newStatus })
      .where(eq(potholesTable.id, id))
      .returning();

    res.json(toApiShape(updated));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to confirm pothole" });
  }
});

// ─── Shape mapper ─────────────────────────────────────────────────────────────

function toApiShape(row: typeof potholesTable.$inferSelect) {
  return {
    id: row.id,
    lat: row.lat,
    lng: row.lng,
    severity: row.severity,
    status: row.status,
    confirmations: row.confirmations,
    createdAt: row.createdAt,
    streetName: row.streetName,
    neighborhood: row.neighborhood,
    ...(row.notes != null ? { notes: row.notes } : {}),
  };
}

export default router;
