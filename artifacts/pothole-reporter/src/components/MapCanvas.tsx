import React, { useRef, useCallback } from 'react';
import { motion, useMotionValue, useTransform } from 'framer-motion';
import { usePotholeStore } from '@/store/PotholeContext';
import { MAP_CENTER, Pothole } from '@/lib/types';
import { cn } from '@/lib/utils';
import { AlertCircle, ShieldAlert, AlertTriangle } from 'lucide-react';

// Scale: 1 degree ≈ 111km. We want ~2km visible in ~390px.
// 390px / 2km = ~195px/km. 195px/km * 111km/deg = ~21645 px/deg.
// Use 18000 so 0.02 deg ≈ 360px — potholes spread ±0.01 deg fill the screen nicely.
const SCALE = 18000;
const CANVAS_SIZE = 3000;
const CENTER_OFFSET = CANVAS_SIZE / 2;

function project(lat: number, lng: number) {
  const x = CENTER_OFFSET + (lng - MAP_CENTER.lng) * SCALE;
  const y = CENTER_OFFSET - (lat - MAP_CENTER.lat) * SCALE;
  return { x, y };
}

// Severity colours
const SEVERITY_CONFIG = {
  severe:   { bg: 'bg-red-500',    border: 'border-red-600',    shadow: 'shadow-red-500/40',    triangle: 'border-t-red-500'    },
  moderate: { bg: 'bg-orange-500', border: 'border-orange-600', shadow: 'shadow-orange-500/40', triangle: 'border-t-orange-500' },
  minor:    { bg: 'bg-amber-400',  border: 'border-amber-500',  shadow: 'shadow-amber-400/40',  triangle: 'border-t-amber-400'  },
};

const ICON_MAP = {
  severe:   <AlertCircle className="w-3.5 h-3.5 text-white" />,
  moderate: <ShieldAlert className="w-3.5 h-3.5 text-white" />,
  minor:    <AlertTriangle className="w-3.5 h-3.5 text-white" />,
};

interface MapCanvasProps {
  onMarkerClick: (pothole: Pothole) => void;
  selectedId: string | null;
}

export function MapCanvas({ onMarkerClick, selectedId }: MapCanvasProps) {
  const { potholes, currentLocation } = usePotholeStore();
  const constraintsRef = useRef<HTMLDivElement>(null);

  // Initial offset: centre the canvas so the mock user location is in the middle of viewport
  const vw = typeof window !== 'undefined' ? window.innerWidth : 390;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 844;
  const userPos = project(currentLocation.lat, currentLocation.lng);
  const initX = vw / 2 - userPos.x;
  const initY = vh / 2 - userPos.y;

  return (
    <div className="relative w-full h-full overflow-hidden bg-slate-100 dark:bg-slate-900">
      {/* Subtle road-grid background */}
      <div className="absolute inset-0 map-grid pointer-events-none opacity-40 dark:opacity-15" />

      {/* Drag constraint boundary (larger than canvas so drag feels free) */}
      <motion.div
        ref={constraintsRef}
        className="absolute pointer-events-none"
        style={{
          width: CANVAS_SIZE + vw,
          height: CANVAS_SIZE + vh,
          left: -vw / 2,
          top: -vh / 2,
        }}
      />

      <motion.div
        drag
        dragConstraints={constraintsRef}
        dragElastic={0.05}
        dragMomentum={true}
        dragTransition={{ bounceStiffness: 200, bounceDamping: 30 }}
        initial={{ x: initX, y: initY }}
        className="absolute left-0 top-0 will-change-transform cursor-grab active:cursor-grabbing touch-none select-none"
        style={{ width: CANVAS_SIZE, height: CANVAS_SIZE }}
      >
        {/* Hotspot halo rings — faint circles around dense clusters */}
        {potholes
          .filter(p => p.confirmations >= 8 && p.status !== 'fixed')
          .map(p => {
            const pos = project(p.lat, p.lng);
            return (
              <div
                key={`halo-${p.id}`}
                className="absolute rounded-full pointer-events-none"
                style={{
                  left: pos.x,
                  top: pos.y,
                  width: 64,
                  height: 64,
                  transform: 'translate(-50%, -50%)',
                  background: 'radial-gradient(circle, rgba(239,68,68,0.18) 0%, rgba(239,68,68,0) 70%)',
                }}
              />
            );
          })}

        {/* User location beacon */}
        {(() => {
          const pos = project(currentLocation.lat, currentLocation.lng);
          return (
            <div
              className="absolute z-20 pointer-events-none"
              style={{ left: pos.x, top: pos.y, transform: 'translate(-50%, -50%)' }}
            >
              <div className="w-10 h-10 rounded-full bg-blue-500/15 animate-ping absolute inset-0 m-auto" />
              <div className="w-5 h-5 rounded-full bg-blue-500 border-[2.5px] border-white shadow-lg shadow-blue-500/50 relative z-10" />
            </div>
          );
        })()}

        {/* Pothole markers */}
        {potholes.map(p => {
          const pos = project(p.lat, p.lng);
          const isSelected = p.id === selectedId;
          const isFixed = p.status === 'fixed';
          const cfg = isFixed
            ? { bg: 'bg-emerald-500', border: 'border-emerald-600', shadow: 'shadow-emerald-500/30', triangle: 'border-t-emerald-500' }
            : SEVERITY_CONFIG[p.severity];
          const icon = isFixed
            ? <AlertCircle className="w-3.5 h-3.5 text-white" />
            : ICON_MAP[p.severity];

          return (
            <motion.button
              key={p.id}
              onClick={e => { e.stopPropagation(); onMarkerClick(p); }}
              whileHover={{ scale: 1.15, y: -2 }}
              whileTap={{ scale: 0.92 }}
              animate={isSelected ? { scale: 1.35, y: -4 } : { scale: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 400, damping: 22 }}
              className={cn(
                'absolute focus:outline-none origin-bottom',
                'flex flex-col items-center',
              )}
              style={{ left: pos.x, top: pos.y, transform: 'translate(-50%, -100%)' }}
            >
              {/* Bubble */}
              <div className={cn(
                'relative flex items-center justify-center rounded-full border-2 shadow-md transition-all',
                cfg.bg, cfg.border, cfg.shadow,
                isSelected ? 'w-10 h-10 shadow-xl' : 'w-8 h-8',
                isFixed && 'opacity-55',
              )}>
                {icon}
                {/* Confirmation badge */}
                {p.confirmations >= 5 && (
                  <div className="absolute -top-2 -right-2 bg-white dark:bg-slate-900 text-[10px] font-black text-slate-800 dark:text-slate-100 rounded-full min-w-[18px] h-[18px] px-1 flex items-center justify-center shadow border border-slate-100 dark:border-slate-700 leading-none">
                    {p.confirmations}
                  </div>
                )}
              </div>
              {/* Pin tail */}
              <div className={cn(
                'w-0 h-0 border-l-[5px] border-r-[5px] border-t-[7px] border-l-transparent border-r-transparent',
                cfg.triangle,
                isFixed && 'opacity-55',
              )} />
            </motion.button>
          );
        })}
      </motion.div>

      {/* Compass rose — purely decorative */}
      <div className="absolute top-20 right-4 w-8 h-8 rounded-full bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm shadow flex items-center justify-center pointer-events-none">
        <span className="text-[9px] font-black text-slate-700 dark:text-slate-200 tracking-tight">N</span>
      </div>

      {/* Severity legend */}
      <div className="absolute top-20 left-4 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm rounded-xl px-3 py-2 shadow text-[10px] font-semibold space-y-1 pointer-events-none">
        {[
          { label: 'Severe',   cls: 'bg-red-500' },
          { label: 'Moderate', cls: 'bg-orange-500' },
          { label: 'Minor',    cls: 'bg-amber-400' },
          { label: 'Fixed',    cls: 'bg-emerald-500' },
        ].map(({ label, cls }) => (
          <div key={label} className="flex items-center gap-1.5">
            <div className={cn('w-2.5 h-2.5 rounded-full', cls)} />
            <span className="text-slate-700 dark:text-slate-300">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
