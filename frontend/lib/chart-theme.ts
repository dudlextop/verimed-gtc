export const chartTheme = {
  primary: "hsl(var(--primary))",
  accent: "hsl(var(--accent))",
  finance: "hsl(var(--finance))",
  importance: "hsl(var(--importance))",
  stability: "hsl(var(--stability))",
  grid: "hsl(var(--border))",
  axis: "hsl(var(--muted-foreground))",
  surface: "hsl(var(--card))",
  foreground: "hsl(var(--foreground))",
  risk: {
    "Низкий": "hsl(var(--risk-low))",
    "Средний": "hsl(var(--risk-medium))",
    "Высокий": "hsl(var(--risk-high))",
    "Критический": "hsl(var(--risk-critical))",
  } as Record<string, string>,
};

export const chartTooltipStyle = {
  backgroundColor: chartTheme.surface,
  border: `1px solid ${chartTheme.grid}`,
  borderRadius: "10px",
  boxShadow: "0 16px 42px -26px rgb(25 39 78 / .45)",
  color: chartTheme.foreground,
  fontSize: "12px",
};

export const chartTick = { fontSize: 12, fill: chartTheme.axis };
