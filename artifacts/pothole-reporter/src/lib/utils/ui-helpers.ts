import { Pothole } from "@/lib/types";
import { AlertCircle, AlertTriangle, CheckCircle2, Cone, Hammer } from "lucide-react";
import { cva } from "class-variance-authority";

export const getSeverityColor = (severity: Pothole['severity']) => {
  switch (severity) {
    case 'severe': return 'text-destructive';
    case 'moderate': return 'text-primary';
    case 'minor': return 'text-amber-500';
  }
};

export const getSeverityBg = (severity: Pothole['severity']) => {
  switch (severity) {
    case 'severe': return 'bg-destructive';
    case 'moderate': return 'bg-primary';
    case 'minor': return 'bg-amber-500';
  }
};

export const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80",
        outline: "text-foreground",
        minor: "border-transparent bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
        moderate: "border-transparent bg-primary/10 text-primary dark:bg-primary/20",
        severe: "border-transparent bg-destructive/10 text-destructive dark:bg-destructive/20",
        fixed: "border-transparent bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);
