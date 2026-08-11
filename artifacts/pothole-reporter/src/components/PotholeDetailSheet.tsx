import React from "react";
import { Drawer } from "vaul";
import { Pothole } from "@/lib/types";
import { ThumbsUp, Clock, MapPin, CheckCircle2, Navigation2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { getSeverityBg } from "@/lib/utils/ui-helpers";
import { usePotholeStore } from "@/store/PotholeContext";
import { getDistanceInMeters } from "@/lib/types";

interface PotholeDetailSheetProps {
  pothole: Pothole | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (id: string) => void;
}

export function PotholeDetailSheet({ pothole, open, onOpenChange, onConfirm }: PotholeDetailSheetProps) {
  const { currentLocation } = usePotholeStore();
  
  if (!pothole) return null;

  const isFixed = pothole.status === 'fixed';
  
  const distance = getDistanceInMeters(
    pothole.lat, pothole.lng, currentLocation.lat, currentLocation.lng
  );
  
  const isNearby = distance < 100;

  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50" />
        <Drawer.Content className="bg-white dark:bg-slate-900 flex flex-col rounded-t-[2rem] mt-24 h-fit max-h-[85vh] fixed bottom-0 left-0 right-0 z-50 focus:outline-none border-t border-slate-200 dark:border-slate-800 shadow-[0_-10px_40px_rgba(0,0,0,0.1)]">
          <div className="p-4 bg-white dark:bg-slate-900 rounded-t-[2rem] flex-1">
            <div className="mx-auto w-12 h-1.5 flex-shrink-0 rounded-full bg-slate-300 dark:bg-slate-700 mb-8" />
            
            <div className="max-w-md mx-auto pb-safe">
              <div className="flex items-start justify-between mb-6 gap-4">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2 leading-tight">
                    {pothole.streetName}
                  </h2>
                  <div className="flex items-center text-slate-500 dark:text-slate-400 text-sm">
                    <MapPin className="w-4 h-4 mr-1.5 flex-shrink-0" />
                    <span>{pothole.neighborhood}</span>
                    <span className="mx-2 text-slate-300">•</span>
                    <span>{Math.round(distance)}m away</span>
                  </div>
                </div>
                
                <div className={cn(
                  "px-3 py-1.5 rounded-2xl flex items-center justify-center font-bold uppercase tracking-wider text-[10px]",
                  getSeverityBg(pothole.severity),
                  "text-white shadow-sm"
                )}>
                  {pothole.severity}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-8">
                <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4 border border-slate-100 dark:border-slate-800">
                  <div className="text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1">Status</div>
                  <div className="flex items-center font-medium capitalize text-sm text-slate-900 dark:text-slate-100">
                    {pothole.status === 'fixed' ? (
                      <CheckCircle2 className="w-4 h-4 mr-2 text-emerald-500" />
                    ) : (
                      <Clock className="w-4 h-4 mr-2 text-primary" />
                    )}
                    {pothole.status.replace('-', ' ')}
                  </div>
                </div>
                <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4 border border-slate-100 dark:border-slate-800">
                  <div className="text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1">Reported</div>
                  <div className="font-medium text-sm text-slate-900 dark:text-slate-100">
                    {formatDistanceToNow(new Date(pothole.createdAt), { addSuffix: true })}
                  </div>
                </div>
              </div>

              {!isFixed && (
                <div className={cn(
                  "border rounded-3xl p-5 mb-8 transition-colors",
                  isNearby 
                    ? "bg-primary/5 dark:bg-primary/10 border-primary/20" 
                    : "bg-slate-50 dark:bg-slate-800/50 border-slate-100 dark:border-slate-800"
                )}>
                  <div className="flex items-start gap-4">
                    <div className={cn(
                      "w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0",
                      isNearby ? "bg-primary/20" : "bg-slate-200 dark:bg-slate-700"
                    )}>
                      <ThumbsUp className={cn("w-6 h-6", isNearby ? "text-primary" : "text-slate-400")} />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-1">
                        {pothole.confirmations} people confirmed this
                      </h3>
                      <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                        {isNearby 
                          ? "You're nearby! Confirm this pothole to bump its priority for the city repair team."
                          : "You must be within 100m to confirm this pothole."
                        }
                      </p>
                      <button 
                        disabled={!isNearby}
                        onClick={() => {
                          onConfirm(pothole.id);
                          onOpenChange(false);
                        }}
                        className={cn(
                          "w-full py-3 rounded-xl font-bold text-sm transition-all flex items-center justify-center",
                          isNearby 
                            ? "bg-primary text-primary-foreground hover:bg-primary/90 active:scale-[0.98]" 
                            : "bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed"
                        )}
                      >
                        Confirm Pothole
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex gap-3">
                <button className="flex-1 bg-slate-900 dark:bg-white text-white dark:text-slate-900 py-3.5 rounded-xl font-bold text-sm transition-transform active:scale-[0.98] flex items-center justify-center gap-2">
                  <Navigation2 className="w-4 h-4" />
                  Get Directions
                </button>
              </div>
            </div>
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
