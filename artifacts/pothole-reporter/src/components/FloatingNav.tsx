import { Link, useLocation } from "wouter";
import { MapPin, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";

export function FloatingNav() {
  const [location] = useLocation();

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md rounded-full shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-slate-200 dark:border-slate-800 p-1.5 flex gap-1">
      <Link 
        href="/"
        className={cn(
          "flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-medium transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary", 
          location === '/' 
            ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-sm" 
            : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
        )}
      >
        <MapPin className="w-4 h-4" />
        <span>Map</span>
      </Link>
      <Link 
        href="/hotspots"
        className={cn(
          "flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-medium transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary", 
          location === '/hotspots' 
            ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-sm" 
            : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
        )}
      >
        <BarChart3 className="w-4 h-4" />
        <span>Hotspots</span>
      </Link>
    </div>
  );
}
