import { Router, type IRouter } from "express";
import { randomUUID } from "node:crypto";
import { desc, eq, sql } from "drizzle-orm";
import { CreatePotholeBody } from "@workspace/api-zod";
import {
  db,
  potholesTable,
  confirmationsTable,
  type Pothole as PotholeRow,
} from "@workspace/db";
import { requireAuth } from "../lib/auth";

const router: IRouter = Router();

// How many confirmations promote a freshly reported pothole to "confirmed".
const CONFIRMATIONS_TO_CONFIRM = 3;

/**
 * Shape a database row the way the OpenAPI contract describes it.
 *
 * `createdAt` becomes an ISO string and `reportedBy` is dropped: who filed a
 * report is not part of the public contract, and the map is public.
 */
function toApiPothole(row: PotholeRow) {
  return {
    id: row.id,
    lat: row.lat,
    lng: row.lng,
    severity: row.severity,
    status: row.status,
    confirmations: row.confirmations,
    createdAt: row.createdAt.toISOString(),
    streetName: row.streetName,
    neighborhood: row.neighborhood,
    ...(row.notes ? { notes: row.notes } : {}),
  };
}

// ─── Routes ──────────────────────────────────────────────────────────────────

// Public. Anyone can see every pothole without an account — that is the point
// of the app, and the reason auth guards only the two routes below.
router.get("/potholes", (_req, res, next) => {
  void (async () => {
    const rows = await db
      .select()
      .from(potholesTable)
      .orderBy(desc(potholesTable.createdAt));
    res.json(rows.map(toApiPothole));
  })().catch(next);
});

router.post("/potholes", requireAuth, (req, res, next) => {
  void (async () => {
    const parsed = CreatePotholeBody.safeParse(req.body);
    if (!parsed.success) {
      res
        .status(400)
        .json({ error: parsed.error.issues.map((e) => e.message).join(", ") });
      return;
    }

    const { lat, lng, severity, notes, streetName, neighborhood } = parsed.data;

    // Reject clearly invalid coordinates (non-finite or off-world)
    if (
      !Number.isFinite(lat) ||
      !Number.isFinite(lng) ||
      Math.abs(lat) > 90 ||
      Math.abs(lng) > 180
    ) {
      res.status(400).json({ error: "Coordinates out of valid range" });
      return;
    }

    const [row] = await db
      .insert(potholesTable)
      .values({
        id: randomUUID(),
        lat,
        lng,
        severity,
        status: "reported",
        confirmations: 0,
        streetName,
        neighborhood,
        notes: notes ?? null,
        // requireAuth guarantees req.user, so the report always has an author.
        reportedBy: req.user!.id,
      })
      .returning();

    if (!row) throw new Error("Failed to insert pothole");
    res.status(201).json(toApiPothole(row));
  })().catch(next);
});

router.post<{ id: string }>("/potholes/:id/confirm", requireAuth, (req, res, next) => {
  void (async () => {
    // Express 5 types a path param as string | string[], because a repeated
    // param produces an array. This route has exactly one, so pin it here
    // rather than coercing at each of the three uses below.
    const { id } = req.params;
    const userId = req.user!.id;

    const [pothole] = await db
      .select()
      .from(potholesTable)
      .where(eq(potholesTable.id, id))
      .limit(1);

    if (!pothole) {
      res.status(404).json({ error: "Pothole not found" });
      return;
    }

    if (pothole.status === "fixed") {
      res
        .status(400)
        .json({ error: "Cannot confirm a pothole that has already been fixed" });
      return;
    }

    // One confirmation per person per pothole, enforced by the composite
    // primary key rather than by a read-then-write that two concurrent
    // requests could both pass. ON CONFLICT DO NOTHING makes a repeat
    // confirmation a no-op instead of an error, and the empty `returning()`
    // is how we know it was a repeat.
    const inserted = await db
      .insert(confirmationsTable)
      .values({ potholeId: id, userId })
      .onConflictDoNothing()
      .returning({ potholeId: confirmationsTable.potholeId });

    if (inserted.length === 0) {
      res.status(409).json({ error: "You have already confirmed this pothole" });
      return;
    }

    // Increment from the column's own value rather than from the count we read
    // a moment ago, so simultaneous confirmations cannot overwrite each other.
    const [updated] = await db
      .update(potholesTable)
      .set({
        confirmations: sql`${potholesTable.confirmations} + 1`,
        status: sql`CASE
          WHEN ${potholesTable.status} = 'reported'
           AND ${potholesTable.confirmations} + 1 >= ${CONFIRMATIONS_TO_CONFIRM}
          THEN 'confirmed'
          ELSE ${potholesTable.status}
        END`,
      })
      .where(eq(potholesTable.id, id))
      .returning();

    if (!updated) throw new Error("Failed to update pothole");
    res.json(toApiPothole(updated));
  })().catch(next);
});

export default router;
