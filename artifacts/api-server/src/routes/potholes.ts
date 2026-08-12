import { Router, type IRouter } from "express";
import { CreatePotholeBody } from "@workspace/api-zod";

const router: IRouter = Router();

// ─── In-memory store (seeded with realistic SF data) ─────────────────────────

type Severity = "minor" | "moderate" | "severe";
type Status = "reported" | "confirmed" | "in-progress" | "fixed";

interface Pothole {
  id: string;
  lat: number;
  lng: number;
  severity: Severity;
  status: Status;
  confirmations: number;
  createdAt: string;
  streetName: string;
  neighborhood: string;
  notes?: string;
}

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

function seedPotholes(count = 50): Pothole[] {
  const now = Date.now();
  const items: Pothole[] = [];

  for (let i = 0; i < count; i++) {
    const isCluster = rng() > 0.7;
    let lat = MAP_CENTER.lat + (rng() - 0.5) * 0.02;
    let lng = MAP_CENTER.lng + (rng() - 0.5) * 0.02;

    if (isCluster && items.length > 0) {
      const base = items[Math.floor(rng() * items.length)];
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

    items.push({
      id: `ph-${1000 + i}`,
      lat, lng, severity, status, confirmations,
      createdAt: new Date(now - ageMs).toISOString(),
      streetName: pick(STREETS),
      neighborhood: pick(NEIGHBORHOODS),
    });
  }

  // Demo hotspot near center
  items[0] = {
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

  return items;
}

const potholes: Pothole[] = seedPotholes();

// ─── Routes ──────────────────────────────────────────────────────────────────

router.get("/potholes", (_req, res) => {
  res.json(potholes);
});

router.post("/potholes", (req, res) => {
  const parsed = CreatePotholeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.errors.map((e) => e.message).join(", ") });
    return;
  }

  const { lat, lng, severity, notes, streetName, neighborhood } = parsed.data;

  // Reject clearly invalid coordinates (non-finite or off-world)
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    res.status(400).json({ error: "Coordinates out of valid range" });
    return;
  }

  const pothole: Pothole = {
    id: `ph-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    lat,
    lng,
    severity,
    status: "reported",
    confirmations: 0,
    createdAt: new Date().toISOString(),
    streetName,
    neighborhood,
    notes,
  };

  potholes.unshift(pothole);
  res.status(201).json(pothole);
});

router.post("/potholes/:id/confirm", (req, res) => {
  const { id } = req.params;
  const pothole = potholes.find((p) => p.id === id);

  if (!pothole) {
    res.status(404).json({ error: "Pothole not found" });
    return;
  }

  if (pothole.status === "fixed") {
    res.status(400).json({ error: "Cannot confirm a pothole that has already been fixed" });
    return;
  }

  pothole.confirmations += 1;
  if (pothole.status === "reported" && pothole.confirmations >= 3) {
    pothole.status = "confirmed";
  }

  res.json(pothole);
});

export default router;
