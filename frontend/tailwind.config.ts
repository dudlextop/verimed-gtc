import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}", "./test-harness/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "hsl(var(--background))", foreground: "hsl(var(--foreground))",
        card: "hsl(var(--card))", "card-foreground": "hsl(var(--card-foreground))",
        primary: "hsl(var(--primary))", "primary-foreground": "hsl(var(--primary-foreground))",
        secondary: "hsl(var(--secondary))", "secondary-foreground": "hsl(var(--secondary-foreground))",
        muted: "hsl(var(--muted))", "muted-foreground": "hsl(var(--muted-foreground))",
        border: "hsl(var(--border))", "border-strong": "hsl(var(--border-strong))", ring: "hsl(var(--ring))",
        "surface-soft": "hsl(var(--surface-soft))", "surface-raised": "hsl(var(--surface-raised))", "surface-tint": "hsl(var(--surface-tint))",
        navigation: "hsl(var(--navigation))", "navigation-muted": "hsl(var(--navigation-muted))",
        accent: "hsl(var(--accent))", "accent-soft": "hsl(var(--accent-soft))",
        priority: "hsl(var(--priority))", "priority-soft": "hsl(var(--priority-soft))",
        risk: "hsl(var(--risk))", "risk-soft": "hsl(var(--risk-soft))",
        finance: "hsl(var(--finance))", "finance-soft": "hsl(var(--finance-soft))",
        importance: "hsl(var(--importance))", "importance-soft": "hsl(var(--importance-soft))",
        stability: "hsl(var(--stability))", "stability-soft": "hsl(var(--stability-soft))",
        success: "hsl(var(--success))", "success-soft": "hsl(var(--success-soft))",
        warning: "hsl(var(--warning))", "warning-soft": "hsl(var(--warning-soft))",
        danger: "hsl(var(--danger))", "danger-soft": "hsl(var(--danger-soft))",
        info: "hsl(var(--info))", "info-soft": "hsl(var(--info-soft))",
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
        lg: "var(--radius)", md: "var(--radius-sm)", xl: "var(--radius-lg)",
        "v2-control": "var(--v2-radius-control)",
        "v2-card": "var(--v2-radius-card)",
        "v2-section": "var(--v2-radius-section)",
        "v2-overlay": "var(--v2-radius-overlay)"
      },
      boxShadow: {
        card: "var(--shadow-surface)", raised: "var(--shadow-raised)", overlay: "var(--shadow-overlay)", glow: "0 18px 46px -24px hsl(var(--primary) / .52)",
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
