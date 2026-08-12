/**
 * PatchWork Mobile — design tokens synced from the sibling web artifact.
 *
 * Source: artifacts/pothole-reporter/src/index.css
 *   --primary: 24 100% 55%   → Safety Orange
 *   --destructive: 0 84.2% 60.2% → Red
 *   --background: 0 0% 100% → White
 *   --foreground: 222.2 84% 4.9% → Dark Navy
 *   --muted: 210 40% 96.1% → Light Gray-Blue
 *   --border: 214.3 31.8% 91.4% → Blue-Gray
 *   --radius: 1rem = 16px
 *   Font: Outfit (--app-font-sans)
 */

const colors = {
  light: {
    // Legacy aliases
    text: '#020817',
    tint: '#ff751a',

    background: '#ffffff',
    foreground: '#020817',

    card: '#ffffff',
    cardForeground: '#020817',

    // Safety Orange — primary CTA
    primary: '#ff751a',
    primaryForeground: '#ffffff',

    secondary: '#f1f5f9',
    secondaryForeground: '#0f172a',

    muted: '#f1f5f9',
    mutedForeground: '#64748b',

    accent: '#f1f5f9',
    accentForeground: '#0f172a',

    destructive: '#ef4444',
    destructiveForeground: '#ffffff',

    border: '#e2e8f0',
    input: '#e2e8f0',

    // Severity — marker & badge colours
    severityMinor: '#f59e0b',       // Amber
    severityModerate: '#ff751a',     // Safety Orange
    severitySevere: '#ef4444',       // Red
  },

  dark: {
    text: '#f8fafc',
    tint: '#ff751a',

    background: '#020817',
    foreground: '#f8fafc',

    card: '#0f172a',
    cardForeground: '#f8fafc',

    primary: '#ff751a',
    primaryForeground: '#ffffff',

    secondary: '#1e293b',
    secondaryForeground: '#f8fafc',

    muted: '#1e293b',
    mutedForeground: '#94a3b8',

    accent: '#1e293b',
    accentForeground: '#f8fafc',

    destructive: '#ef4444',
    destructiveForeground: '#ffffff',

    border: '#1e293b',
    input: '#1e293b',

    severityMinor: '#f59e0b',
    severityModerate: '#ff751a',
    severitySevere: '#ef4444',
  },

  // 1rem = 16px (matches web --radius: 1rem)
  radius: 16,
};

export default colors;
