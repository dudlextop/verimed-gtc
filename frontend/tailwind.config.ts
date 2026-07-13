import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
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
        info: "hsl(var(--info))", "info-soft": "hsl(var(--info-soft))"
      },
      borderRadius: { lg: "var(--radius)", md: "var(--radius-sm)", xl: "var(--radius-lg)" },
      boxShadow: { card: "var(--shadow-surface)", raised: "var(--shadow-raised)", overlay: "var(--shadow-overlay)", glow: "0 18px 46px -24px hsl(var(--primary) / .52)" }
    }
  },
  plugins: []
};
export default config;
