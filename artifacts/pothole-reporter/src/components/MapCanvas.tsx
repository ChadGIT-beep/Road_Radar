import React, { useEffect, useRef, useState, useReducer, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Map as MapLibreMap, Marker, type GeoJSONSource } from 'maplibre-gl';
import type { FeatureCollection } from 'geojson';
import 'maplibre-gl/dist/maplibre-gl.css';
import { usePotholeStore } from '@/store/PotholeContext';
import { Pothole } from '@/lib/types';
import { cn } from '@/lib/utils';
import { MAP_STYLE_URL, USER_ZOOM } from '@/lib/map-config';
import {
  AlertCircle,
  ShieldAlert,
  AlertTriangle,
  Plus,
  Minus,
  Crosshair,
  Flame,
  MapPin,
} from 'lucide-react';

const HEAT_SOURCE = 'potholes';
const HEAT_LAYER = 'potholes-heat';

// Severity colours
const SEVERITY_CONFIG = {
  severe:   { bg: 'bg-red-500',    border: 'border-red-600',    shadow: 'shadow-red-500/40',    triangle: 'border-t-red-500'    },
  moderate: { bg: 'bg-orange-500', border: 'border-orange-600', shadow: 'shadow-orange-500/40', triangle: 'border-t-orange-500' },
  minor:    { bg: 'bg-amber-400',  border: 'border-amber-500',  shadow: 'shadow-amber-400/40',  triangle: 'border-t-amber-400'  },
  fixed:    { bg: 'bg-emerald-500',border: 'border-emerald-600',shadow: 'shadow-emerald-500/40',triangle: 'border-t-emerald-500'},
} as const;

const ICON_MAP = {
  severe:   <AlertCircle className="w-4 h-4 text-white" strokeWidth={2.5} />,
  moderate: <ShieldAlert className="w-4 h-4 text-white" strokeWidth={2.5} />,
  minor:    <AlertTriangle className="w-4 h-4 text-white" strokeWidth={2.5} />,
} as const;

interface MapCanvasProps {
  onMarkerClick: (pothole: Pothole) => void;
  selectedId: string | null;
}

function heatmapFeatures(potholes: Pothole[]): FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: potholes
      .filter(p => p.status !== 'fixed')
      .map(p => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
        // +1 so a brand-new report with no confirmations still registers.
        properties: { weight: p.confirmations + 1 },
      })),
  };
}

export function MapCanvas({ onMarkerClick, selectedId }: MapCanvasProps) {
  const { potholes, currentLocation, isLocating } = usePotholeStore();

  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markersRef = useRef(new Map<string, Marker>());
  const nodesRef = useRef(new Map<string, HTMLDivElement>());
  const userMarkerRef = useRef<Marker | null>(null);
  const didFrameUser = useRef(false);

  // Split deliberately: DOM markers only need the map object, but the heatmap is
  // a style layer. If tiles fail we still want pins on screen, not a blank page.
  const [mapReady, setMapReady] = useState(false);
  const [styleReady, setStyleReady] = useState(false);
  const [tileError, setTileError] = useState(false);
  const [showHeat, setShowHeat] = useState(false);
  // Marker DOM nodes are created imperatively; bump this so React re-runs the
  // portal pass once the nodes exist.
  const [, rerender] = useReducer((n: number) => n + 1, 0);

  // ─── Map instance (created once) ─────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current) return;

    const map = new MapLibreMap({
      container: containerRef.current,
      style: MAP_STYLE_URL,
      center: [currentLocation.lng, currentLocation.lat],
      zoom: USER_ZOOM,
      attributionControl: { compact: true },
    });
    mapRef.current = map;
    setMapReady(true);

    if (import.meta.env.DEV) {
      // Handle for browser-driven tests; dev builds only.
      (containerRef.current as HTMLDivElement & { __mapForTests?: MapLibreMap })
        .__mapForTests = map;
    }

    // The container can still be settling when the map is constructed; keep it
    // in step with its box so the canvas never renders at a stale size.
    const resizeObserver = new ResizeObserver(() => map.resize());
    resizeObserver.observe(containerRef.current);

    map.on('load', () => { setStyleReady(true); setTileError(false); });
    map.on('error', event => {
      // A failed style/tile request must not leave the user staring at nothing.
      const url = (event as { error?: { url?: string } }).error?.url ?? '';
      if (!url || url === MAP_STYLE_URL || !map.isStyleLoaded()) setTileError(true);
    });

    return () => {
      resizeObserver.disconnect();
      markersRef.current.clear();
      nodesRef.current.clear();
      userMarkerRef.current = null;
      map.remove();
      mapRef.current = null;
      setMapReady(false);
      setStyleReady(false);
    };
    // Only the initial centre is read here; later moves go through recenter().
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Pothole markers ──────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    const markers = markersRef.current;
    const live = new Set<string>();

    for (const p of potholes) {
      live.add(p.id);
      const existing = markers.get(p.id);
      if (existing) {
        existing.setLngLat([p.lng, p.lat]);
        continue;
      }
      const el = document.createElement('div');
      // `anchor: 'bottom'` puts the pin's tip on the coordinate — the library
      // handles the offset, so nothing fights over `transform` any more.
      const marker = new Marker({ element: el, anchor: 'bottom' })
        .setLngLat([p.lng, p.lat])
        .addTo(map);
      nodesRef.current.set(p.id, el);
      markers.set(p.id, marker);
    }

    for (const [id, marker] of markers) {
      if (live.has(id)) continue;
      marker.remove();
      markers.delete(id);
      nodesRef.current.delete(id);
    }

    rerender();
  }, [potholes, mapReady]);

  // ─── Heatmap layer ────────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleReady) return;

    const data = heatmapFeatures(potholes);
    const source = map.getSource(HEAT_SOURCE) as GeoJSONSource | undefined;

    if (source) {
      source.setData(data);
      return;
    }

    map.addSource(HEAT_SOURCE, { type: 'geojson', data });
    map.addLayer({
      id: HEAT_LAYER,
      type: 'heatmap',
      source: HEAT_SOURCE,
      layout: { visibility: 'none' },
      paint: {
        // Confirmations drive intensity — that is the app's priority signal.
        'heatmap-weight': [
          'interpolate', ['linear'], ['get', 'weight'],
          1, 0.15,
          10, 0.6,
          40, 1,
        ],
        'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 10, 1, 18, 3],
        'heatmap-color': [
          'interpolate', ['linear'], ['heatmap-density'],
          0,    'rgba(255,237,160,0)',
          0.2,  'rgba(254,217,118,0.55)',
          0.4,  'rgba(254,178,76,0.7)',
          0.6,  'rgba(253,141,60,0.8)',
          0.8,  'rgba(240,59,32,0.88)',
          1,    'rgba(189,0,38,0.95)',
        ],
        'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 10, 14, 18, 55],
        'heatmap-opacity': 0.85,
      },
    });
  }, [potholes, styleReady]);

  // Heatmap on/off, and hide the pins while it is showing so the density reads.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleReady || !map.getLayer(HEAT_LAYER)) return;
    map.setLayoutProperty(HEAT_LAYER, 'visibility', showHeat ? 'visible' : 'none');
  }, [showHeat, styleReady]);

  // ─── User location marker ─────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    const lngLat: [number, number] = [currentLocation.lng, currentLocation.lat];

    if (!userMarkerRef.current) {
      const el = document.createElement('div');
      el.className = 'relative flex items-center justify-center';
      el.innerHTML =
        '<span class="absolute w-6 h-6 rounded-full bg-blue-500/30 animate-ping"></span>' +
        '<span class="relative w-4 h-4 rounded-full bg-blue-500 border-2 border-white shadow-md"></span>';
      userMarkerRef.current = new Marker({ element: el })
        .setLngLat(lngLat)
        .addTo(map);
    } else {
      userMarkerRef.current.setLngLat(lngLat);
    }

    // Frame the user once, the first time a real fix arrives.
    if (!didFrameUser.current && !isLocating) {
      didFrameUser.current = true;
      map.easeTo({ center: lngLat, zoom: USER_ZOOM, duration: 800 });
    }
  }, [currentLocation, mapReady, isLocating]);

  const recenter = useCallback(() => {
    mapRef.current?.easeTo({
      center: [currentLocation.lng, currentLocation.lat],
      zoom: USER_ZOOM,
      duration: 600,
    });
  }, [currentLocation]);

  const zoomBy = useCallback((delta: number) => {
    const map = mapRef.current;
    if (!map) return;
    map.easeTo({ zoom: map.getZoom() + delta, duration: 200 });
  }, []);

  const ctrlClass =
    'w-11 h-11 flex items-center justify-center bg-white/95 dark:bg-slate-900/95 ' +
    'backdrop-blur-md text-slate-700 dark:text-slate-200 shadow-lg border ' +
    'border-slate-200 dark:border-slate-700 active:scale-95 transition-all ' +
    'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary';

  return (
    <div className="relative w-full h-full overflow-hidden bg-slate-100 dark:bg-slate-900">
      {/* h-full/w-full rather than inset-0 alone: maplibre-gl.css forces
          `.maplibregl-map { position: relative }`, which beats Tailwind's
          `absolute` and collapses an inset-only container to zero height. */}
      <div ref={containerRef} className="absolute inset-0 h-full w-full" data-testid="map-root" />

      {/* Pin content is rendered by React into the marker nodes MapLibre owns. */}
      {potholes.map(p => {
        const node = nodesRef.current.get(p.id);
        if (!node) return null;

        const isFixed = p.status === 'fixed';
        const isSelected = p.id === selectedId;
        const cfg = isFixed ? SEVERITY_CONFIG.fixed : SEVERITY_CONFIG[p.severity];
        const icon = isFixed
          ? <AlertCircle className="w-4 h-4 text-white" strokeWidth={2.5} />
          : ICON_MAP[p.severity];

        return createPortal(
          <button
            onClick={e => { e.stopPropagation(); onMarkerClick(p); }}
            className="flex flex-col items-center focus:outline-none cursor-pointer"
            aria-label={`${p.severity} pothole on ${p.streetName}`}
            data-testid="pothole-marker"
          >
            <div className={cn(
              'relative flex items-center justify-center rounded-full border-2 shadow-md transition-all',
              cfg.bg, cfg.border, cfg.shadow,
              isSelected ? 'w-10 h-10 shadow-xl scale-110' : 'w-8 h-8',
              isFixed && 'opacity-55',
            )}>
              {icon}
              {p.confirmations >= 5 && (
                <div className="absolute -top-2 -right-2 bg-white dark:bg-slate-900 text-[10px] font-black text-slate-800 dark:text-slate-100 rounded-full min-w-[18px] h-[18px] px-1 flex items-center justify-center shadow border border-slate-100 dark:border-slate-700 leading-none">
                  {p.confirmations}
                </div>
              )}
            </div>
            <div className={cn(
              'w-0 h-0 border-l-[5px] border-r-[5px] border-t-[7px] border-l-transparent border-r-transparent',
              cfg.triangle,
              isFixed && 'opacity-55',
            )} />
          </button>,
          node,
          p.id,
        );
      })}

      {/* Map controls */}
      <div className="absolute right-4 top-28 z-20 flex flex-col rounded-2xl overflow-hidden shadow-lg">
        <button onClick={() => zoomBy(1)} className={cn(ctrlClass, 'rounded-t-2xl border-b-0')} aria-label="Zoom in">
          <Plus className="w-5 h-5" />
        </button>
        <button onClick={() => zoomBy(-1)} className={cn(ctrlClass, 'rounded-b-2xl')} aria-label="Zoom out">
          <Minus className="w-5 h-5" />
        </button>
      </div>

      <div className="absolute right-4 top-52 z-20 flex flex-col gap-2">
        <button onClick={recenter} className={cn(ctrlClass, 'rounded-2xl')} aria-label="Recentre on my location">
          <Crosshair className="w-5 h-5" />
        </button>
        <button
          onClick={() => setShowHeat(v => !v)}
          className={cn(ctrlClass, 'rounded-2xl', showHeat && 'bg-primary text-primary-foreground border-primary')}
          aria-label={showHeat ? 'Show pins' : 'Show heatmap'}
          aria-pressed={showHeat}
        >
          {showHeat ? <MapPin className="w-5 h-5" /> : <Flame className="w-5 h-5" />}
        </button>
      </div>

      {/* Legend */}
      <div className="absolute left-4 top-28 z-20 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700 px-3 py-2.5 space-y-1.5">
        {([
          ['bg-red-500', 'Severe'],
          ['bg-orange-500', 'Moderate'],
          ['bg-amber-400', 'Minor'],
          ['bg-emerald-500', 'Fixed'],
        ] as const).map(([dot, label]) => (
          <div key={label} className="flex items-center gap-2">
            <span className={cn('w-2.5 h-2.5 rounded-full', dot)} />
            <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">{label}</span>
          </div>
        ))}
      </div>

      {isLocating && !tileError && (
        <div className="absolute left-1/2 -translate-x-1/2 top-28 z-20 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md rounded-full shadow-lg border border-slate-200 dark:border-slate-700 px-4 py-2">
          <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Finding your location…</span>
        </div>
      )}

      {tileError && (
        <div
          className="absolute left-1/2 -translate-x-1/2 top-28 z-20 max-w-[85%] bg-amber-50 dark:bg-amber-950/90 backdrop-blur-md rounded-2xl shadow-lg border border-amber-300 dark:border-amber-800 px-4 py-2.5 flex items-center gap-2"
          role="status"
          data-testid="tile-error"
        >
          <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
          <span className="text-xs font-semibold text-amber-900 dark:text-amber-200">
            Map tiles unavailable — reports still work.
          </span>
        </div>
      )}
    </div>
  );
}
