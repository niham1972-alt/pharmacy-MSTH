import type { Config } from 'tailwindcss';

export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eff6ff',
          100: '#dbeafe',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
        },
        // Colorblind-safe alert palette (Okabe-Ito derived) — always paired with
        // an icon + text label, never used as the sole signal (WCAG 2.1 AA).
        alert: {
          critical: '#d55e00', // red-orange
          warning: '#e69f00', // orange
          notice: '#f0e442', // yellow
          ok: '#009e73', // green
        },
        surface: {
          light: '#ffffff',
          dark: '#111827',
        },
      },
      spacing: {
        18: '4.5rem',
      },
    },
  },
  plugins: [],
} satisfies Config;
