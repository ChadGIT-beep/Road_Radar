import { z } from "zod";

export type Severity = "minor" | "moderate" | "severe";
export type Status = "reported" | "confirmed" | "in-progress" | "fixed";

export interface Pothole {
  id: string;
  lat: number;
  lng: number;
  severity: Severity;
  status: Status;
  confirmations: number;
  createdAt: string; // ISO string
  streetName: string;
  neighborhood: string;
}

export const ReportSchema = z.object({
  severity: z.enum(["minor", "moderate", "severe"]),
  notes: z.string().optional(),
});

export type ReportFormData = z.infer<typeof ReportSchema>;

// Center of our mock map (SF)
export const MAP_CENTER = { lat: 37.7749, lng: -122.4194 };
// 1 degree lat ~ 111km. So 0.001 deg ~ 111m.
// 50 meters is ~ 0.00045 degrees.

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
