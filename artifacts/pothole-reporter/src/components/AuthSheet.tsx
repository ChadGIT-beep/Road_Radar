import React, { useState, useEffect } from 'react';
import { Drawer } from 'vaul';
import { Loader2, Mail, Lock, User as UserIcon, AlertCircle } from 'lucide-react';
import { useAuth } from '@/store/AuthContext';
import { cn } from '@/lib/utils';

export type AuthMode = 'signin' | 'signup';

interface AuthSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialMode?: AuthMode;
  /** Why the sheet opened, when it was triggered by a gated action. */
  reason?: string | null;
}

const MIN_PASSWORD_LENGTH = 8;

/**
 * Turn whatever the API threw into something worth reading.
 *
 * The server deliberately returns the same "Wrong email or password" for a
 * missing account and a bad password, so there is nothing to improve on there
 * — but a network failure has to be distinguishable from a rejection, or
 * people retype a correct password over and over.
 */
function errorMessage(error: unknown): string {
  if (error && typeof error === 'object') {
    const data = (error as { data?: { error?: unknown } }).data;
    if (data && typeof data.error === 'string') return data.error;

    const status = (error as { status?: unknown }).status;
    if (typeof status !== 'number') {
      return "Couldn't reach the server. Check your connection and try again.";
    }
  }
  return 'Something went wrong. Try again.';
}

export function AuthSheet({ open, onOpenChange, initialMode = 'signin', reason }: AuthSheetProps) {
  const { signUp, logIn, isSubmitting } = useAuth();

  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setMode(initialMode);
      setError(null);
      setPassword('');
    }
  }, [open, initialMode]);

  const isSignUp = mode === 'signup';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (isSignUp && password.length < MIN_PASSWORD_LENGTH) {
      setError(`Use at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }

    try {
      if (isSignUp) {
        await signUp({ email, password, displayName });
      } else {
        await logIn({ email, password });
      }
      onOpenChange(false);
    } catch (err) {
      setError(errorMessage(err));
      // Never leave a rejected password in the box — it is almost always the
      // wrong one, and re-submitting it unchanged is the most common reflex.
      setPassword('');
    }
  };

  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50" />
        <Drawer.Content className="bg-white dark:bg-slate-900 flex flex-col rounded-t-[2rem] mt-24 h-fit max-h-[92vh] fixed bottom-0 left-0 right-0 z-50 focus:outline-none border-t border-slate-200 dark:border-slate-800 shadow-[0_-10px_40px_rgba(0,0,0,0.1)]">
          <div className="p-4 bg-white dark:bg-slate-900 rounded-t-[2rem] flex-1 overflow-y-auto">
            <div className="mx-auto w-12 h-1.5 flex-shrink-0 rounded-full bg-slate-300 dark:bg-slate-700 mb-8" />

            <div className="max-w-md mx-auto pb-safe">
              <Drawer.Title className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
                {isSignUp ? 'Create an account' : 'Welcome back'}
              </Drawer.Title>

              <Drawer.Description className="text-slate-600 dark:text-slate-400 mb-8 text-sm">
                {reason ??
                  'The map is public — an account is only needed to report and confirm potholes.'}
              </Drawer.Description>

              <form onSubmit={handleSubmit} className="space-y-5">
                {isSignUp && (
                  <div>
                    <label
                      htmlFor="auth-name"
                      className="block text-sm font-bold text-slate-900 dark:text-white mb-2"
                    >
                      Display name
                    </label>
                    <div className="relative">
                      <UserIcon className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        id="auth-name"
                        type="text"
                        required
                        maxLength={60}
                        autoComplete="nickname"
                        value={displayName}
                        onChange={e => setDisplayName(e.target.value)}
                        placeholder="How you'll appear"
                        className="w-full bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-2xl py-3.5 pl-11 pr-4 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-primary transition-colors"
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label
                    htmlFor="auth-email"
                    className="block text-sm font-bold text-slate-900 dark:text-white mb-2"
                  >
                    Email
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      id="auth-email"
                      type="email"
                      required
                      autoComplete="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="w-full bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-2xl py-3.5 pl-11 pr-4 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-primary transition-colors"
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="auth-password"
                    className="block text-sm font-bold text-slate-900 dark:text-white mb-2"
                  >
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      id="auth-password"
                      type="password"
                      required
                      minLength={isSignUp ? MIN_PASSWORD_LENGTH : undefined}
                      autoComplete={isSignUp ? 'new-password' : 'current-password'}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder={isSignUp ? `At least ${MIN_PASSWORD_LENGTH} characters` : '••••••••'}
                      className="w-full bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-2xl py-3.5 pl-11 pr-4 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-primary transition-colors"
                    />
                  </div>
                </div>

                {error && (
                  <div
                    role="alert"
                    data-testid="auth-error"
                    className="flex items-start gap-2 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 rounded-2xl px-4 py-3"
                  >
                    <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                    <span className="text-sm font-medium text-red-900 dark:text-red-200">
                      {error}
                    </span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isSubmitting}
                  data-testid="auth-submit"
                  className={cn(
                    'w-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 py-4 rounded-xl font-bold text-[15px] transition-transform active:scale-[0.98] shadow-lg shadow-slate-900/20 dark:shadow-white/20 flex items-center justify-center gap-2',
                    'disabled:opacity-60 disabled:pointer-events-none',
                  )}
                >
                  {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  {isSignUp ? 'Create account' : 'Sign in'}
                </button>
              </form>

              <button
                type="button"
                onClick={() => {
                  setMode(isSignUp ? 'signin' : 'signup');
                  setError(null);
                }}
                data-testid="auth-toggle-mode"
                className="w-full text-center mt-6 text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
              >
                {isSignUp ? (
                  <>Already have an account? <span className="font-bold">Sign in</span></>
                ) : (
                  <>New here? <span className="font-bold">Create an account</span></>
                )}
              </button>
            </div>
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
