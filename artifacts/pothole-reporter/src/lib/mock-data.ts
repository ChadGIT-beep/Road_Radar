import { Pothole, MAP_CENTER } from './types';
import { subDays, subHours, subMinutes, formatISO } from 'date-fns';

const STREETS = [
  "Market St", "Mission St", "Valencia St", "Howard St", "Folsom St", 
  "Harrison St", "Bryant St", "Brannan St", "Townsend St", "King St"
];

const NEIGHBORHOODS = [
  "SoMa", "Mission District", "Financial District", "Hayes Valley", 
  "Tenderloin", "Civic Center", "Castro", "Dogpatch"
];

// Generate reproducible random numbers
let seed = 1;
function random() {
  const x = Math.sin(seed++) * 10000;
  return x - Math.floor(x);
}

function randomChoice<T>(arr: T[]): T {
  return arr[Math.floor(random() * arr.length)];
}

function randomLat(centre: Coords) {
  // roughly +/- 1km from centre (0.01 deg)
  return centre.lat + (random() - 0.5) * 0.02;
}

function randomLng(centre: Coords) {
  return centre.lng + (random() - 0.5) * 0.02;
}

export interface Coords {
  lat: number;
  lng: number;
}

/**
 * Seeded demo data around `centre`.
 *
 * The centre is a parameter so the demo works wherever the user actually is —
 * seeding around a hardcoded San Francisco would hand anyone outside SF an
 * empty map.
 */
export function generateMockPotholes(count = 50, centre: Coords = MAP_CENTER): Pothole[] {
  // Reset the stream so every call reproduces the same map — otherwise a second
  // call (e.g. reseeding after storage is cleared) continues the sequence.
  seed = 1;

  const potholes: Pothole[] = [];
  const now = new Date();

  for (let i = 0; i < count; i++) {
    const id = `ph-${1000 + i}`;
    
    // Create some clusters (hotspots)
    const isCluster = random() > 0.7;
    let lat = randomLat(centre);
    let lng = randomLng(centre);
    
    if (isCluster && potholes.length > 0) {
      const base = randomChoice(potholes);
      lat = base.lat + (random() - 0.5) * 0.002;
      lng = base.lng + (random() - 0.5) * 0.002;
    }

    const severities: ("minor" | "moderate" | "severe")[] = ["minor", "minor", "moderate", "moderate", "severe"];
    const statuses: ("reported" | "confirmed" | "in-progress" | "fixed")[] = ["reported", "confirmed", "confirmed", "in-progress", "fixed"];
    
    const severity = randomChoice(severities);
    const status = randomChoice(statuses);
    
    // older ones have more confirmations
    const ageHours = Math.floor(random() * 72);
    const createdAt = formatISO(subHours(now, ageHours));
    
    let confirmations = 0;
    if (status !== 'reported') {
      confirmations = Math.floor(random() * 15) + 1;
    } else if (ageHours > 12) {
      confirmations = Math.floor(random() * 3);
    }

    potholes.push({
      id,
      lat,
      lng,
      severity,
      status,
      confirmations,
      createdAt,
      streetName: randomChoice(STREETS),
      neighborhood: randomChoice(NEIGHBORHOODS)
    });
  }

  // Ensure there's a highly confirmed one near center for demonstration
  potholes[0] = {
    id: 'ph-demo-1',
    lat: centre.lat + 0.0003, // approx 38m away
    lng: centre.lng + 0.0002,
    severity: 'severe',
    status: 'confirmed',
    confirmations: 42,
    createdAt: formatISO(subDays(now, 2)),
    streetName: 'Market St',
    neighborhood: 'Civic Center'
  };

  return potholes;
}
