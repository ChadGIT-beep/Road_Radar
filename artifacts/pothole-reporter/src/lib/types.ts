import { z } from "zod";
import type {
  Pothole as ApiPothole,
  PotholeSeverity,
  PotholeStatus,
} from "@workspace/api-client-react";

// The API contract in lib/api-spec/openapi.yaml is the single definition of
// what a pothole is. These are aliases, not copies — the web app used to keep
// its own hand-written duplicate, which is how the two clients drifted apart.
export type Severity = PotholeSeverity;
export type Status = PotholeStatus;
export type Pothole = ApiPothole;

export const ReportSchema = z.object({
  severity: z.enum(["minor", "moderate", "severe"]),
  notes: z.string().optional(),
});

export type ReportFormData = z.infer<typeof ReportSchema>;

/** Fallback view until GPS reports in. */
export const MAP_CENTER = { lat: 37.7749, lng: -122.4194 };

// Helper to calculate distance in meters between two coordinates roughly
export function getDistanceInMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371e3; // metres
  const φ1 = lat1 * Math.PI/180; // φ, λ in radians
  const φ2 = lat2 * Math.PI/180;
  const Δφ = (lat2-lat1) * Math.PI/180;
  const Δλ = (lon2-lon1) * Math.PI/180;

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  return R * c;
}
