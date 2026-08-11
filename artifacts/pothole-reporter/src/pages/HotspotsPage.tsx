import React from 'react';
import { usePotholeStore } from '@/store/PotholeContext';
import { FloatingNav } from '@/components/FloatingNav';
import { AlertTriangle, MapPin, TrendingUp, CheckCircle2, Flame, Activity } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

interface HotspotEntry {
  street: string;
  neighborhood: string;
  count: number;
  active: number;
  fixed: number;
  severe: number;
  moderate: number;
  minor: number;
  severityScore: number;
  totalConfirmations: number;
}

export default function HotspotsPage() {
  const { potholes } = usePotholeStore();

  const hotspots = React.useMemo(() => {
    const map = new Map<string, HotspotEntry>();

    potholes.forEach(p => {
      const key = `${p.streetName}|${p.neighborhood}`;
      if (!map.has(key)) {
        map.set(key, {
          street: p.streetName,
          neighborhood: p.neighborhood,
          count: 0, active: 0, fixed: 0,
          severe: 0, moderate: 0, minor: 0,
          severityScore: 0,
          totalConfirmations: 0,
        });
      }
      const d = map.get(key)!;
      d.count++;
      d.totalConfirmations += p.confirmations;
      if (p.status === 'fixed') {
        d.fixed++;
      } else {
        d.active++;
        d[p.severity]++;
        const wt = p.severity === 'severe' ? 4 : p.severity === 'moderate' ? 2 : 1;
        d.severityScore += wt * (p.confirmations + 1);
      }
    });

    return Array.from(map.values())
      .filter(h => h.count >= 2)
      .sort((a, b) => b.severityScore - a.severityScore);
  }, [potholes]);

  const totalActive = potholes.filter(p => p.status !== 'fixed').length;
  const totalFixed = potholes.length - totalActive;
  const totalConfirmations = potholes.reduce((s, p) => s + p.confirmations, 0);
  const maxScore = hotspots[0]?.severityScore ?? 1;

  return (
    <div className="min-h-[100dvh] w-full bg-slate-50 dark:bg-slate-950 pb-32">
      {/* Sticky header */}
      <div className="px-5 pt-14 pb-5 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md sticky top-0 z-10 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-2 mb-1">
          <Flame className="w-5 h-5 text-red-500" />
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            City Hotspots
          </h1>
        </div>
        <p className="text-slate-500 dark:text-slate-400 text-sm">
          Streets ranked by community-reported severity
        </p>
      </div>

      <div className="px-4 py-5 space-y-6">
        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { icon: <AlertTriangle className="w-4 h-4 text-orange-500" />, value: totalActive,        label: 'Active',        bg: 'bg-orange-50 dark:bg-orange-950/40' },
            { icon: <CheckCircle2 className="w-4 h-4 text-emerald-500" />, value: totalFixed,         label: 'Fixed',         bg: 'bg-emerald-50 dark:bg-emerald-950/40' },
            { icon: <Activity className="w-4 h-4 text-blue-500" />,        value: totalConfirmations, label: 'Confirmations', bg: 'bg-blue-50 dark:bg-blue-950/40' },
          ].map(({ icon, value, label, bg }) => (
            <div key={label} className={cn('rounded-2xl p-3.5 text-center', bg)}>
              <div className="flex justify-center mb-1">{icon}</div>
              <div className="text-2xl font-black text-slate-900 dark:text-white">{value}</div>
              <div className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{label}</div>
            </div>
          ))}
        </div>

        {/* Rank header */}
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-primary" />
          <span className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
            Ranked by Severity Score
          </span>
        </div>

        {/* Hotspot cards */}
        <div className="space-y-3">
          {hotspots.map((h, idx) => {
            const barPct = Math.round((h.severityScore / maxScore) * 100);
            const rankColor =
              idx === 0 ? 'bg-red-500 text-white shadow-red-400/40' :
              idx === 1 ? 'bg-orange-500 text-white shadow-orange-400/30' :
              idx === 2 ? 'bg-amber-400 text-white shadow-amber-400/30' :
              'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300';

            return (
              <motion.div
                key={`${h.street}|${h.neighborhood}`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.04, duration: 0.25 }}
                className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700/60 p-4 shadow-sm"
              >
                <div className="flex items-start gap-3 mb-3">
                  {/* Rank badge */}
                  <div className={cn(
                    'w-10 h-10 rounded-full flex items-center justify-center font-black text-sm flex-shrink-0 shadow',
                    rankColor,
                  )}>
                    {idx + 1}
                  </div>

                  {/* Street info */}
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-slate-900 dark:text-white text-base leading-tight truncate">
                      {h.street}
                    </div>
                    <div className="flex items-center gap-1 text-slate-500 dark:text-slate-400 text-xs mt-0.5">
                      <MapPin className="w-3 h-3 flex-shrink-0" />
                      <span className="truncate">{h.neighborhood}</span>
                    </div>
                  </div>

                  {/* Active count */}
                  <div className="text-right flex-shrink-0">
                    <div className="text-xl font-black text-slate-900 dark:text-white leading-none">{h.active}</div>
                    <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">active</div>
                  </div>
                </div>

                {/* Severity breakdown pills */}
                <div className="flex items-center gap-1.5 mb-3">
                  {h.severe > 0 && (
                    <span className="inline-flex items-center gap-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-[10px] font-bold px-2 py-0.5 rounded-full">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block" />
                      {h.severe} severe
                    </span>
                  )}
                  {h.moderate > 0 && (
                    <span className="inline-flex items-center gap-1 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 text-[10px] font-bold px-2 py-0.5 rounded-full">
                      <span className="w-1.5 h-1.5 rounded-full bg-orange-500 inline-block" />
                      {h.moderate} moderate
                    </span>
                  )}
                  {h.minor > 0 && (
                    <span className="inline-flex items-center gap-1 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-[10px] font-bold px-2 py-0.5 rounded-full">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />
                      {h.minor} minor
                    </span>
                  )}
                  {h.fixed > 0 && (
                    <span className="inline-flex items-center gap-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-[10px] font-bold px-2 py-0.5 rounded-full">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                      {h.fixed} fixed
                    </span>
                  )}
                </div>

                {/* Severity bar */}
                <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                  <motion.div
                    className={cn(
                      'h-full rounded-full',
                      idx === 0 ? 'bg-red-500' : idx === 1 ? 'bg-orange-500' : 'bg-amber-400',
                    )}
                    initial={{ width: 0 }}
                    animate={{ width: `${barPct}%` }}
                    transition={{ delay: idx * 0.04 + 0.15, duration: 0.5, ease: 'easeOut' }}
                  />
                </div>
              </motion.div>
            );
          })}

          {hotspots.length === 0 && (
            <div className="text-center py-16 text-slate-400 dark:text-slate-600">
              <MapPin className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm font-medium">No hotspots detected yet</p>
            </div>
          )}
        </div>
      </div>

      <FloatingNav />
    </div>
  );
}
