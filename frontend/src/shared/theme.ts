/**
 * Design tokens shared across the whole system (Module 1 sets the visual
 * baseline other modules will reuse). Mirrors tailwind.config.ts so
 * non-Tailwind consumers (e.g. chart libraries that take raw hex) stay in sync.
 */
export const theme = {
  color: {
    brand: { 50: '#eff6ff', 100: '#dbeafe', 500: '#3b82f6', 600: '#2563eb', 700: '#1d4ed8' },
    alert: { critical: '#d55e00', warning: '#e69f00', notice: '#f0e442', ok: '#009e73' },
    surface: { light: '#ffffff', dark: '#111827' },
  },
  spacing: {
    xs: '0.25rem',
    sm: '0.5rem',
    md: '1rem',
    lg: '1.5rem',
    xl: '2rem',
  },
  font: {
    size: { xs: '0.75rem', sm: '0.875rem', md: '1rem', lg: '1.25rem', xl: '1.5rem', '2xl': '2rem' },
  },
} as const;

export type AlertSeverity = 'red' | 'orange' | 'yellow';

export const alertSeverityStyles: Record<AlertSeverity, { bg: string; text: string; icon: string; label: string }> = {
  red: { bg: 'bg-red-50 dark:bg-red-950', text: 'text-red-700 dark:text-red-300', icon: '⚠', label: 'Critical' },
  orange: { bg: 'bg-orange-50 dark:bg-orange-950', text: 'text-orange-700 dark:text-orange-300', icon: '⏰', label: 'Warning' },
  yellow: { bg: 'bg-yellow-50 dark:bg-yellow-950', text: 'text-yellow-800 dark:text-yellow-300', icon: '📦', label: 'Notice' },
};
