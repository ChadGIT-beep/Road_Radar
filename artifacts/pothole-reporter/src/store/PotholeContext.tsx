import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  getListPotholesQueryKey,
  useConfirmPothole,
  useCreatePothole,
  useListPotholes,
} from '@workspace/api-client-react';
import { Pothole, MAP_CENTER, ReportFormData } from '../lib/types';
import { reverseGeocode, UNKNOWN_PLACE } from '../lib/geocode';

interface PotholeStore {
  potholes: Pothole[];
  isLoading: boolean;
  currentLocation: { lat: number; lng: number };
  /** True while waiting on the first GPS fix. */
  isLocating: boolean;
  addPothole: (lat: number, lng: number, data: ReportFormData) => void;
  confirmPothole: (id: string) => void;
}

const PotholeContext = createContext<PotholeStore | null>(null);

export function PotholeProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [currentLocation, setCurrentLocation] = useState(MAP_CENTER);
  const [isLocating, setIsLocating] = useState(
    typeof navigator !== 'undefined' && 'geolocation' in navigator,
  );

  const { data: rawPotholes = [], isLoading } = useListPotholes();
  const potholes = rawPotholes as unknown as Pothole[];

  // Use the user's real position when available. The map still falls back to
  // the demo centre when location access is unavailable or denied.
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
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 30_000 },
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  const createMutation = useCreatePothole({
    mutation: {
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: getListPotholesQueryKey() });
      },
    },
  });

  const confirmMutation = useConfirmPothole({
    mutation: {
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: getListPotholesQueryKey() });
      },
    },
  });

  const addPothole = useCallback(
    (lat: number, lng: number, data: ReportFormData) => {
      // Resolve the address before writing so the street and neighbourhood
      // stored in PostgreSQL are useful on the map and Hotspots page.
      void reverseGeocode(lat, lng).then(place => {
        createMutation.mutate({
          data: {
            lat,
            lng,
            severity: data.severity,
            notes: data.notes,
            streetName: place.streetName || UNKNOWN_PLACE.streetName,
            neighborhood: place.neighborhood || UNKNOWN_PLACE.neighborhood,
          },
        });
      });
    },
    [createMutation],
  );

  const confirmPothole = useCallback(
    (id: string) => {
      confirmMutation.mutate({ id });
    },
    [confirmMutation],
  );

  const value = useMemo(
    () => ({
      potholes,
      isLoading,
      currentLocation,
      isLocating,
      addPothole,
      confirmPothole,
    }),
    [
      potholes,
      isLoading,
      currentLocation,
      isLocating,
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