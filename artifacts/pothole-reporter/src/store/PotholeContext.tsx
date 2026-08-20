import React, { createContext, useContext, useState, useMemo, useCallback, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  useListPotholes,
  useCreatePothole,
  useConfirmPothole,
  getListPotholesQueryKey,
} from '@workspace/api-client-react';
import { Pothole, MAP_CENTER, ReportFormData } from '../lib/types';
import { reverseGeocode, UNKNOWN_PLACE } from '../lib/geocode';

interface PotholeStore {
  /** The shared list, as the API sees it. Empty until the first fetch lands. */
  potholes: Pothole[];
  currentLocation: { lat: number; lng: number };
  /** True while waiting on the first GPS fix. */
  isLocating: boolean;
  /** True during the first load of the shared list. */
  isLoading: boolean;
  /** True when the API could not be reached — the map has nothing to show. */
  hasLoadError: boolean;
  /** True while a report is being submitted. */
  isSubmitting: boolean;
  /** True while a confirmation is in flight. */
  isConfirming: boolean;
  addPothole: (lat: number, lng: number, data: ReportFormData) => Promise<void>;
  confirmPothole: (id: string) => Promise<void>;
}

const PotholeContext = createContext<PotholeStore | null>(null);

export function PotholeProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();

  // The server is the source of truth. There is no local seed and no
  // localStorage copy any more: those made every browser its own island, so a
  // report was invisible to everyone else and Hotspots ranked one session.
  const {
    data: potholes = [],
    isLoading,
    isError,
  } = useListPotholes();

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
        setCurrentLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        setIsLocating(false);
      },
      () => {
        // Denied, unavailable, or timed out — fall back to the demo centre.
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 30_000 },
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  // ─── Writes ───────────────────────────────────────────────────────────────

  const invalidateList = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: getListPotholesQueryKey() });
  }, [queryClient]);

  const createMutation = useCreatePothole({
    mutation: { onSuccess: invalidateList },
  });

  const confirmMutation = useConfirmPothole({
    mutation: { onSuccess: invalidateList },
  });

  const addPothole = useCallback(
    async (lat: number, lng: number, data: ReportFormData) => {
      // streetName and neighborhood are required by the contract, so unlike the
      // old local-only path we have to resolve them *before* posting rather
      // than patching them in afterwards. A failed lookup still submits, with
      // UNKNOWN_PLACE — a report with a vague address beats a lost report.
      const place = await reverseGeocode(lat, lng).catch(() => UNKNOWN_PLACE);

      await createMutation.mutateAsync({
        data: {
          lat,
          lng,
          severity: data.severity,
          notes: data.notes?.trim() || undefined,
          ...place,
        },
      });
    },
    [createMutation],
  );

  const confirmPothole = useCallback(
    async (id: string) => {
      await confirmMutation.mutateAsync({ id });
    },
    [confirmMutation],
  );

  const value = useMemo(
    () => ({
      potholes,
      currentLocation,
      isLocating,
      isLoading,
      hasLoadError: isError,
      isSubmitting: createMutation.isPending,
      isConfirming: confirmMutation.isPending,
      addPothole,
      confirmPothole,
    }),
    [
      potholes,
      currentLocation,
      isLocating,
      isLoading,
      isError,
      createMutation.isPending,
      confirmMutation.isPending,
      addPothole,
      confirmPothole,
    ],
  );

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
