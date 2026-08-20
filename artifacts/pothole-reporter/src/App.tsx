import { type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { setBaseUrl } from '@workspace/api-client-react';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import {
  Route,
  Switch,
  useLocation,
  Router as WouterRouter,
} from 'wouter';

import { PotholeProvider } from '@/store/PotholeContext';
import MapPage from '@/pages/MapPage';
import HotspotsPage from '@/pages/HotspotsPage';

// In production and in the Replit preview the web app and the API are served
// from one origin (`/` and `/api`), so the generated client's relative URLs
// resolve on their own. Set VITE_API_BASE_URL only when the API lives
// somewhere else — a separately hosted backend, or a plain `vite dev` run
// without the /api proxy configured in vite.config.ts.
const apiBaseUrl = import.meta.env['VITE_API_BASE_URL'];
if (apiBaseUrl) {
  setBaseUrl(apiBaseUrl);
}

const queryClient = new QueryClient({
  defaultOptions: {
    // Matches patchwork-mobile, so both clients treat the shared list the same
    // way rather than each inventing a freshness policy.
    queries: { staleTime: 30_000, retry: 2 },
  },
});

function Router() {
  return (
    <RoutedErrorBoundary>
      <Switch>
        <Route path="/" component={MapPage} />
        <Route path="/hotspots" component={HotspotsPage} />
        <Route component={NotFound} />
      </Switch>
    </RoutedErrorBoundary>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <PotholeProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
            <Router />
          </WouterRouter>
          <Toaster />
        </PotholeProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
