import React, { createContext, useContext, useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { Pothole, Severity, Status, MAP_CENTER, ReportFormData } from '../lib/types';
import { generateMockPotholes } from '../lib/mock-data';
import { reverseGeocode, UNKNOWN_PLACE } from '../lib/geocode';

interface PotholeStore {
  potholes: Pothole[];
  currentLocation: { lat: number; lng: number };
  /** True while waiting on the first GPS fix. */
  isLocating: boolean;
  addPothole: (lat: number, lng: number, data: ReportFormData) => void;
  confirmPothole: (id: string) => void;
}

const PotholeContext = createContext<PotholeStore | null>(null);

const STORAGE_KEY = 'patchwork.potholes.v1';
const SEED_COUNT = 50;

const SEVERITIES: Severity[] = ['minor', 'moderate', 'severe'];
const STATUSES: Status[] = ['reported', 'confirmed', 'in-progress', 'fixed'];

function isPothole(value: unknown): value is Pothole {
  if (typeof value !== 'object' || value === null) return false;
  const p = value as Record<string, unknown>;
  return (
    typeof p['id'] === 'string' &&
    typeof p['lat'] === 'number' && Number.isFinite(p['lat']) &&
    typeof p['lng'] === 'number' && Number.isFinite(p['lng']) &&
    SEVERITIES.includes(p['severity'] as Severity) &&
    STATUSES.includes(p['status'] as Status) &&
    typeof p['confirmations'] === 'number' && Number.isFinite(p['confirmations']) &&
    typeof p['createdAt'] === 'string' &&
    typeof p['streetName'] === 'string' &&
    typeof p['neighborhood'] === 'string'
  );
}

// Reports live in localStorage so they survive a reload. Returns null when there
// is nothing usable saved, which tells the provider it is free to seed the demo
// around the user's real position once GPS reports in.
function loadStored(): Pothole[] | null {
  if (typeof window === 'undefined') return null;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0 && parsed.every(isPothole)) {
        return parsed as Pothole[];
      }
    }
  } catch {
    // Unreadable storage (disabled, corrupt JSON) — treat as a first run.
  }

  return null;
}

export function PotholeProvider({ children }: { children: React.ReactNode }) {
  const stored = useRef(loadStored());
  const [potholes, setPotholes] = useState<Pothole[]>(
    () => stored.current ?? generateMockPotholes(SEED_COUNT),
  );
  const [currentLocation, setCurrentLocation] = useState(MAP_CENTER);
  const [isLocating, setIsLocating] = useState(
    typeof navigator !== 'undefined' && 'geolocation' in navigator,
  );

  // ─── Real GPS ─────────────────────────────────────────────────────────────
  // The whole trust model rests on this: you may only confirm a pothole you are
  // physically near. A hardcoded coordinate makes that gate meaningless.
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      setIsLocating(false);
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      position => {
        const fix = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        setCurrentLocation(fix);
        setIsLocating(false);

        // First run with no saved data: seed the demo around wherever the user
        // actually is, so the map is never empty outside San Francisco.
        if (!stored.current) {
          stored.current = generateMockPotholes(SEED_COUNT, fix);
          setPotholes(stored.current);
        }
      },
      () => {
        // Denied, unavailable, or timed out — fall back to the demo centre.
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 30_000 },
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(potholes));
    } catch {
      // Quota exceeded or storage unavailable — keep working from memory.
    }
  }, [potholes]);

  const addPothole = useCallback((lat: number, lng: number, data: ReportFormData) => {
    const id = `ph-new-${Date.now()}`;
    const newPothole: Pothole = {
      id,
      lat,
      lng,
      severity: data.severity,
      status: 'reported',
      confirmations: 1,
      createdAt: new Date().toISOString(),
      ...UNKNOWN_PLACE,
    };
    setPotholes(prev => [...prev, newPothole]);

    // Hotspots ranks by street, so a report without a real street name never
    // reaches the output. Resolve it in the background and patch it in.
    void reverseGeocode(lat, lng).then(place => {
      setPotholes(prev =>
        prev.map(p => (p.id === id ? { ...p, ...place } : p)),
      );
    });
  }, []);

  const confirmPothole = useCallback((id: string) => {
    setPotholes(prev => prev.map(p => {
      if (p.id === id) {
        return {
          ...p,
          confirmations: p.confirmations + 1,
          status: p.status === 'reported' ? 'confirmed' : p.status
        };
      }
      return p;
    }));
  }, []);

  const value = useMemo(() => ({
    potholes,
    currentLocation,
    isLocating,
    addPothole,
    confirmPothole
  }), [potholes, currentLocation, isLocating, addPothole, confirmPothole]);

  return (
    <PotholeContext.Provider value={value}>
      {children}
    </PotholeContext.Provider>
  );
}

export function usePotholeStore() {
  const context = useContext(PotholeContext);
  if (!context) {
    throw new Error('usePotholeStore must be used within a PotholeProvider');
  }
  return context;
}
