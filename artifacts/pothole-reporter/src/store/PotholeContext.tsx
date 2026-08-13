import React, { createContext, useContext, useState, useMemo, useCallback, useEffect } from 'react';
import { Pothole, Severity, Status, MAP_CENTER, ReportFormData } from '../lib/types';
import { generateMockPotholes } from '../lib/mock-data';

interface PotholeStore {
  potholes: Pothole[];
  currentLocation: { lat: number; lng: number };
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

// Reports live in localStorage so they survive a reload. Anything unreadable or
// malformed falls back to a fresh seed rather than leaving the map empty.
function loadPotholes(): Pothole[] {
  if (typeof window === 'undefined') return generateMockPotholes(SEED_COUNT);

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0 && parsed.every(isPothole)) {
        return parsed as Pothole[];
      }
    }
  } catch {
    // Unreadable storage (disabled, corrupt JSON) — fall through to a fresh seed.
  }

  return generateMockPotholes(SEED_COUNT);
}

export function PotholeProvider({ children }: { children: React.ReactNode }) {
  const [potholes, setPotholes] = useState<Pothole[]>(loadPotholes);
  const currentLocation = MAP_CENTER; // Mock user always at center

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(potholes));
    } catch {
      // Quota exceeded or storage unavailable — keep working from memory.
    }
  }, [potholes]);

  const addPothole = useCallback((lat: number, lng: number, data: ReportFormData) => {
    const newPothole: Pothole = {
      id: `ph-new-${Date.now()}`,
      lat,
      lng,
      severity: data.severity,
      status: 'reported',
      confirmations: 1,
      createdAt: new Date().toISOString(),
      streetName: 'Unknown Street',
      neighborhood: 'Current Location',
    };
    setPotholes(prev => [...prev, newPothole]);
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
    addPothole,
    confirmPothole
  }), [potholes, currentLocation, addPothole, confirmPothole]);

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
