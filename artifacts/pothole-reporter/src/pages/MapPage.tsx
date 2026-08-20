import React, { useState } from 'react';
import { MapCanvas } from '@/components/MapCanvas';
import { FloatingNav } from '@/components/FloatingNav';
import { PotholeDetailSheet } from '@/components/PotholeDetailSheet';
import { ReportSheet } from '@/components/ReportSheet';
import { Pothole } from '@/lib/types';
import { usePotholeStore } from '@/store/PotholeContext';
import { useToast } from '@/hooks/use-toast';
import { Plus } from 'lucide-react';

export default function MapPage() {
  const [selectedPothole, setSelectedPothole] = useState<Pothole | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isReportOpen, setIsReportOpen] = useState(false);
  
  const { confirmPothole } = usePotholeStore();
  const { toast } = useToast();

  const handleMarkerClick = (pothole: Pothole) => {
    setSelectedPothole(pothole);
    setIsDetailOpen(true);
  };

  // Confirming is a server round-trip now, so it can fail — a silent no-op
  // would look identical to success and quietly lose the confirmation.
  const handleConfirm = async (id: string) => {
    try {
      await confirmPothole(id);
      setIsDetailOpen(false);
    } catch {
      toast({
        variant: 'destructive',
        title: "Couldn't confirm that report",
        description: 'You are offline, or someone already marked it fixed.',
      });
    }
  };

  return (
    <div className="relative w-full h-[100dvh] overflow-hidden bg-slate-100 dark:bg-slate-900">
      {/* Top Bar for aesthetic context */}
      <div className="absolute top-0 left-0 right-0 h-24 bg-gradient-to-b from-white/80 dark:from-slate-900/80 to-transparent pointer-events-none z-10 flex items-start px-6 pt-6">
        <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white drop-shadow-sm">
          PatchWork
        </h1>
      </div>

      <MapCanvas onMarkerClick={handleMarkerClick} selectedId={selectedPothole?.id ?? null} />
      
      {/* Report FAB */}
      <button
        onClick={() => setIsReportOpen(true)}
        className="absolute bottom-24 right-6 w-14 h-14 bg-primary text-primary-foreground rounded-full flex items-center justify-center shadow-[0_8px_30px_rgb(255,87,34,0.4)] hover:scale-105 active:scale-95 transition-all z-30 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        aria-label="Report a pothole"
      >
        <Plus className="w-6 h-6" />
      </button>

      <FloatingNav />

      <PotholeDetailSheet 
        pothole={selectedPothole}
        open={isDetailOpen}
        onOpenChange={setIsDetailOpen}
        onConfirm={handleConfirm}
      />

      <ReportSheet 
        open={isReportOpen}
        onOpenChange={setIsReportOpen}
      />
    </div>
  );
}
