export const chartTheme = {
  primary: "var(--v2-primary)",
  accent: "var(--v2-cyan)",
  finance: "var(--v2-teal)",
  importance: "var(--v2-primary-active)",
  stability: "var(--v2-cyan)",
  grid: "var(--v2-border)",
  axis: "var(--v2-text-secondary)",
  surface: "var(--v2-surface)",
  foreground: "var(--v2-text)",
  risk: {
    "Низкий": "var(--v2-low)",
    "Средний": "var(--v2-medium)",
    "Высокий": "var(--v2-high)",
    "Критический": "var(--v2-critical)",
  } as Record<string, string>,
};

export const chartTooltipStyle = {
  backgroundColor: chartTheme.surface,
  border: `1px solid ${chartTheme.grid}`,
  borderRadius: "10px",
  boxShadow: "var(--v2-shadow-dropdown)",
  color: chartTheme.foreground,
  fontSize: "12px",
};

export const chartTick = { fontSize: 12, fill: chartTheme.axis };
