import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}", "./test-harness/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        "v2-canvas": "var(--v2-canvas)",
        "v2-surface": "var(--v2-surface)",
        "v2-surface-soft": "var(--v2-surface-soft)",
        "v2-selected": "var(--v2-surface-selected)",
        "v2-border": "var(--v2-border)",
        "v2-border-strong": "var(--v2-border-strong)",
        "v2-text": "var(--v2-text)",
        "v2-text-secondary": "var(--v2-text-secondary)",
        "v2-text-muted": "var(--v2-text-muted)",
        "v2-text-disabled": "var(--v2-text-disabled)",
        "v2-primary": "var(--v2-primary)",
        "v2-primary-hover": "var(--v2-primary-hover)",
        "v2-primary-active": "var(--v2-primary-active)",
        "v2-primary-soft": "var(--v2-primary-soft)",
        "v2-cyan": "var(--v2-cyan)",
        "v2-cyan-soft": "var(--v2-cyan-soft)",
        "v2-cyan-text": "var(--v2-cyan-text)",
        "v2-teal": "var(--v2-teal)",
        "v2-teal-soft": "var(--v2-teal-soft)",
        "v2-teal-text": "var(--v2-teal-text)",
        "v2-success": "var(--v2-success)",
        "v2-success-soft": "var(--v2-success-soft)",
        "v2-success-text": "var(--v2-success-text)",
        "v2-warning": "var(--v2-warning)",
        "v2-warning-soft": "var(--v2-warning-soft)",
        "v2-warning-text": "var(--v2-warning-text)",
        "v2-critical": "var(--v2-critical)",
        "v2-critical-soft": "var(--v2-critical-soft)",
        "v2-critical-text": "var(--v2-critical-text)",
        "v2-high": "var(--v2-high)",
        "v2-high-soft": "var(--v2-high-soft)",
        "v2-high-text": "var(--v2-high-text)",
        "v2-medium": "var(--v2-medium)",
        "v2-medium-soft": "var(--v2-medium-soft)",
        "v2-medium-text": "var(--v2-medium-text)",
        "v2-low": "var(--v2-low)",
        "v2-low-soft": "var(--v2-low-soft)",
        "v2-low-text": "var(--v2-low-text)",
        "v2-info": "var(--v2-info)",
        "v2-info-soft": "var(--v2-info-soft)",
        "v2-overlay": "var(--v2-overlay-scrim)"
      },
      borderRadius: {
        "v2-control": "var(--v2-radius-control)",
        "v2-card": "var(--v2-radius-card)",
        "v2-section": "var(--v2-radius-section)",
        "v2-overlay": "var(--v2-radius-overlay)"
      },
      boxShadow: {
        "v2-panel": "var(--v2-shadow-panel)",
        "v2-dropdown": "var(--v2-shadow-dropdown)",
        "v2-sticky": "var(--v2-shadow-sticky)"
      },
      fontFamily: {
        sans: ["var(--font-inter)", "Inter", "Arial", "ui-sans-serif", "system-ui", "sans-serif"]
      }
    }
  },
  plugins: []
};
export default config;
