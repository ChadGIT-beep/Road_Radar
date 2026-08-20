import React, { useState } from 'react';
import { MapCanvas } from '@/components/MapCanvas';
import { FloatingNav } from '@/components/FloatingNav';
import { PotholeDetailSheet } from '@/components/PotholeDetailSheet';
import { ReportSheet } from '@/components/ReportSheet';
import { AuthButton } from '@/components/AuthButton';
import { AuthSheet, type AuthMode } from '@/components/AuthSheet';
import { Pothole } from '@/lib/types';
import { usePotholeStore } from '@/store/PotholeContext';
import { useAuth } from '@/store/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Plus } from 'lucide-react';

export default function MapPage() {
  const [selectedPothole, setSelectedPothole] = useState<Pothole | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isReportOpen, setIsReportOpen] = useState(false);

  const [authSheet, setAuthSheet] = useState<{
    open: boolean;
    mode: AuthMode;
    reason: string | null;
  }>({ open: false, mode: 'signin', reason: null });

  const { confirmPothole } = usePotholeStore();
  const { isSignedIn } = useAuth();
  const { toast } = useToast();

  const promptSignIn = (reason: string) =>
    setAuthSheet({ open: true, mode: 'signin', reason });

  const handleMarkerClick = (pothole: Pothole) => {
    setSelectedPothole(pothole);
    setIsDetailOpen(true);
  };

  // Writing needs an account; reading never does. Catching that here means a
  // signed-out visitor gets the sign-in sheet instead of a 401 they cannot act
  // on — and it keeps the whole map browsable either way.
  const handleReportClick = () => {
    if (!isSignedIn) {
      promptSignIn('Sign in to report a pothole. Browsing the map stays open to everyone.');
      return;
    }
    setIsReportOpen(true);
  };

  const handleConfirm = async (id: string) => {
    if (!isSignedIn) {
      setIsDetailOpen(false);
      promptSignIn('Sign in to confirm this report. Confirmations are tied to an account so one person cannot vote twice.');
      return;
    }

    try {
      await confirmPothole(id);
      setIsDetailOpen(false);
    } catch (error) {
      const status =
        error && typeof error === 'object'
          ? (error as { status?: number }).status
          : undefined;

      toast({
        variant: 'destructive',
        title:
          status === 409
            ? 'You have already confirmed this one'
            : "Couldn't confirm that report",
        description:
          status === 409
            ? 'Each person can confirm a pothole once.'
            : 'You are offline, or someone already marked it fixed.',
      });
      if (status === 409) setIsDetailOpen(false);
    }
  };

  return (
    <div className="relative w-full h-[100dvh] overflow-hidden bg-slate-100 dark:bg-slate-900">
      {/* Top Bar for aesthetic context */}
      <div className="absolute top-0 left-0 right-0 h-24 bg-gradient-to-b from-white/80 dark:from-slate-900/80 to-transparent pointer-events-none z-30 flex items-start justify-between px-6 pt-6">
        <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white drop-shadow-sm">
          PatchWork
        </h1>
        <AuthButton
          onSignInClick={() => setAuthSheet({ open: true, mode: 'signin', reason: null })}
        />
      </div>

      <MapCanvas onMarkerClick={handleMarkerClick} selectedId={selectedPothole?.id ?? null} />

      {/* Report FAB */}
      <button
        onClick={handleReportClick}
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

      <AuthSheet
        open={authSheet.open}
        onOpenChange={open => setAuthSheet(prev => ({ ...prev, open }))}
        initialMode={authSheet.mode}
        reason={authSheet.reason}
      />
    </div>
  );
}
