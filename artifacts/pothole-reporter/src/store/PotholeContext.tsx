import React, { createContext, useContext, useState, useMemo, useCallback } from 'react';
import { Pothole, MAP_CENTER, ReportFormData } from '../lib/types';
import { generateMockPotholes } from '../lib/mock-data';

interface PotholeStore {
  potholes: Pothole[];
  currentLocation: { lat: number; lng: number };
  addPothole: (lat: number, lng: number, data: ReportFormData) => void;
  confirmPothole: (id: string) => void;
}

const PotholeContext = createContext<PotholeStore | null>(null);

export function PotholeProvider({ children }: { children: React.ReactNode }) {
  const [potholes, setPotholes] = useState<Pothole[]>(() => generateMockPotholes(50));
  const currentLocation = MAP_CENTER; // Mock user always at center

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
