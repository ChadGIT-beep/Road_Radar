import React, { useState, useRef, useEffect } from 'react';
import { LogOut, Loader2 } from 'lucide-react';
import { useAuth } from '@/store/AuthContext';
import { cn } from '@/lib/utils';

interface AuthButtonProps {
  onSignInClick: () => void;
  className?: string;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

/**
 * The signed-in / signed-out control in the top right.
 *
 * Signed out it is a plain "Sign in" button. Signed in it is an avatar that
 * opens a small menu — there is only one item in it today, but sign-out needs
 * to be deliberate rather than a single stray tap on the thing you press to
 * see who you are.
 */
export function AuthButton({ onSignInClick, className }: AuthButtonProps) {
  const { user, isLoading, isSubmitting, logOut } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;

    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };

    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [menuOpen]);

  // Render nothing rather than flashing "Sign in" at someone who is already
  // signed in — the answer arrives a moment later either way.
  if (isLoading) {
    return (
      <div className={cn('h-9 w-9 rounded-full bg-white/70 dark:bg-slate-900/70 animate-pulse', className)} />
    );
  }

  if (!user) {
    return (
      <button
        type="button"
        onClick={onSignInClick}
        data-testid="sign-in-button"
        className={cn(
          'pointer-events-auto bg-white/95 dark:bg-slate-900/95 backdrop-blur-md text-slate-900 dark:text-white',
          'text-sm font-bold px-4 py-2 rounded-full shadow-lg border border-slate-200 dark:border-slate-700',
          'hover:bg-white dark:hover:bg-slate-900 active:scale-95 transition-all',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          className,
        )}
      >
        Sign in
      </button>
    );
  }

  return (
    <div ref={containerRef} className={cn('relative pointer-events-auto', className)}>
      <button
        type="button"
        onClick={() => setMenuOpen(o => !o)}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        aria-label={`Account: ${user.displayName}`}
        data-testid="account-button"
        className={cn(
          'w-9 h-9 rounded-full bg-primary text-primary-foreground font-bold text-xs',
          'flex items-center justify-center shadow-lg border-2 border-white dark:border-slate-800',
          'hover:scale-105 active:scale-95 transition-transform',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        )}
      >
        {initials(user.displayName)}
      </button>

      {menuOpen && (
        <div
          role="menu"
          className="absolute right-0 top-11 w-56 bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150"
        >
          <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800">
            <div className="font-bold text-sm text-slate-900 dark:text-white truncate">
              {user.displayName}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
              {user.email}
            </div>
          </div>

          <button
            type="button"
            role="menuitem"
            disabled={isSubmitting}
            data-testid="sign-out-button"
            onClick={() => {
              void logOut().finally(() => setMenuOpen(false));
            }}
            className="w-full flex items-center gap-2 px-4 py-3 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-60"
          >
            {isSubmitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <LogOut className="w-4 h-4" />
            )}
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
