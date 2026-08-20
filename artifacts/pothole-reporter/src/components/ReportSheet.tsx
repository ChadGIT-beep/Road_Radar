import React, { useState, useMemo } from "react";
import { Drawer } from "vaul";
import { usePotholeStore } from "@/store/PotholeContext";
import { getDistanceInMeters } from "@/lib/types";
import { AlertTriangle, MapPin, Camera, ThumbsUp, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

interface ReportSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ReportSheet({ open, onOpenChange }: ReportSheetProps) {
  const {
    potholes,
    currentLocation,
    addPothole,
    confirmPothole,
    isSubmitting,
    isConfirming,
  } = usePotholeStore();
  const { toast } = useToast();
  const [step, setStep] = useState<'check' | 'form'>('check');
  const [severity, setSeverity] = useState<'minor' | 'moderate' | 'severe'>('moderate');
  const [notes, setNotes] = useState('');

  // Find nearby potholes within 50m
  const nearbyPotholes = useMemo(() => {
    return potholes.filter(p => p.status !== 'fixed' && getDistanceInMeters(
      p.lat, p.lng, currentLocation.lat, currentLocation.lng
    ) < 50);
  }, [potholes, currentLocation]);

  const nearest = nearbyPotholes[0];

  // Reset state when opened
  React.useEffect(() => {
    if (open) {
      if (nearbyPotholes.length > 0) {
        setStep('check');
      } else {
        setStep('form');
      }
      setSeverity('moderate');
      setNotes('');
    }
  }, [open, nearbyPotholes.length]);

  // Both actions now go to the server — a reverse-geocode then a POST — so the
  // sheet has to stay open until they land, and say so if they don't.
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addPothole(currentLocation.lat, currentLocation.lng, { severity, notes });
      onOpenChange(false);
    } catch {
      toast({
        variant: 'destructive',
        title: "Couldn't submit your report",
        description: 'Check your connection and try again.',
      });
    }
  };

  const handleConfirmExisting = async () => {
    if (!nearest) return;
    try {
      await confirmPothole(nearest.id);
      onOpenChange(false);
    } catch {
      toast({
        variant: 'destructive',
        title: "Couldn't confirm that report",
        description: 'You are offline, or someone already marked it fixed.',
      });
    }
  };

  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50" />
        <Drawer.Content className="bg-white dark:bg-slate-900 flex flex-col rounded-t-[2rem] mt-24 h-fit max-h-[90vh] fixed bottom-0 left-0 right-0 z-50 focus:outline-none border-t border-slate-200 dark:border-slate-800 shadow-[0_-10px_40px_rgba(0,0,0,0.1)]">
          <div className="p-4 bg-white dark:bg-slate-900 rounded-t-[2rem] flex-1 overflow-y-auto">
            <div className="mx-auto w-12 h-1.5 flex-shrink-0 rounded-full bg-slate-300 dark:bg-slate-700 mb-8" />
            
            <div className="max-w-md mx-auto pb-safe">
              {step === 'check' && nearest ? (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
                  <div className="w-16 h-16 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center mb-6 mx-auto">
                    <MapPin className="w-8 h-8 text-amber-600 dark:text-amber-400" />
                  </div>
                  <h2 className="text-2xl font-bold text-slate-900 dark:text-white text-center mb-3">
                    Wait, is it this one?
                  </h2>
                  <p className="text-slate-600 dark:text-slate-400 text-center mb-8">
                    Someone else already reported a pothole very close to you on <strong className="text-slate-900 dark:text-white">{nearest.streetName}</strong>. 
                  </p>
                  
                  <div className="space-y-3">
                    <button 
                      onClick={handleConfirmExisting}
                      disabled={isConfirming}
                      className="w-full bg-primary text-primary-foreground hover:bg-primary/90 py-4 rounded-xl font-bold text-sm transition-transform active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-60 disabled:pointer-events-none"
                    >
                      {isConfirming ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <ThumbsUp className="w-5 h-5" />
                      )}
                      {isConfirming ? 'Confirming…' : "Yes, it's the same one (Confirm)"}
                    </button>
                    <button 
                      onClick={() => setStep('form')}
                      className="w-full bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white hover:bg-slate-200 dark:hover:bg-slate-700 py-4 rounded-xl font-bold text-sm transition-transform active:scale-[0.98]"
                    >
                      No, this is a different one
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="animate-in fade-in slide-in-from-right-4 duration-300">
                  <div className="flex items-center justify-between mb-8">
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
                      Report a Problem
                    </h2>
                  </div>

                  <div className="space-y-8">
                    <div>
                      <label className="block text-sm font-bold text-slate-900 dark:text-white mb-4">
                        How severe is it?
                      </label>
                      <div className="grid grid-cols-3 gap-3">
                        {(['minor', 'moderate', 'severe'] as const).map(s => (
                          <button
                            key={s}
                            type="button"
                            onClick={() => setSeverity(s)}
                            className={cn(
                              "py-3 px-2 rounded-2xl border-2 transition-all flex flex-col items-center gap-2",
                              severity === s 
                                ? s === 'severe' ? "border-destructive bg-destructive/10 text-destructive" : s === 'moderate' ? "border-primary bg-primary/10 text-primary" : "border-amber-500 bg-amber-500/10 text-amber-700 dark:text-amber-400"
                                : "border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-slate-500 hover:border-slate-200 dark:hover:border-slate-700"
                            )}
                          >
                            <AlertTriangle className={cn("w-6 h-6", severity === s ? "" : "opacity-50")} />
                            <span className="text-xs font-bold capitalize">{s}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-bold text-slate-900 dark:text-white mb-3">
                        Add a photo (optional)
                      </label>
                      <button type="button" className="w-full border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl py-8 flex flex-col items-center justify-center text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                        <Camera className="w-8 h-8 mb-2 opacity-50" />
                        <span className="text-sm font-medium">Tap to take a photo</span>
                      </button>
                    </div>

                    <button 
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 py-4 rounded-xl font-bold text-[15px] transition-transform active:scale-[0.98] shadow-lg shadow-slate-900/20 dark:shadow-white/20 mt-4 flex items-center justify-center gap-2 disabled:opacity-60 disabled:pointer-events-none"
                    >
                      {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                      {isSubmitting ? 'Submitting…' : 'Submit Report'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
