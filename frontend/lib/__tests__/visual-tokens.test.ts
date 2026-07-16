import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(join(process.cwd(), "app", "globals.css"), "utf8");
const foundation = ["actions.tsx", "controls.tsx", "data.tsx", "indicators.tsx", "layout.tsx", "states.tsx"]
  .map((file) => readFileSync(join(process.cwd(), "components", "foundation", file), "utf8"))
  .join("\n");
const rootLayout = readFileSync(join(process.cwd(), "app", "layout.tsx"), "utf8");
const chartTheme = readFileSync(join(process.cwd(), "lib", "chart-theme.ts"), "utf8");
const presentationSource = ["app", "components", "lib", "test-harness", "tailwind.config.ts"]
  .flatMap((entry) => readSource(join(process.cwd(), entry)))
  .join("\n");

function readSource(path: string): string[] {
  if (!existsSync(path)) return [];
  if (!path.endsWith(".ts") && !path.endsWith(".tsx") && !path.endsWith(".css") && !path.endsWith(".mjs")) {
    return readdirSync(path, { withFileTypes: true })
      .filter((entry) => entry.name !== "__tests__")
      .flatMap((entry) => readSource(join(path, entry.name)));
  }
  return [readFileSync(path, "utf8")];
}

function luminance(hex: string) {
  const components = [1, 3, 5].map((index) => Number.parseInt(hex.slice(index, index + 2), 16) / 255)
    .map((value) => value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return components[0] * 0.2126 + components[1] * 0.7152 + components[2] * 0.0722;
}

function contrast(foreground: string, background: string) {
  const first = luminance(foreground);
  const second = luminance(background);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}

describe("визуальные токены", () => {
  it("содержит отдельную семантику аналитических понятий", () => {
    for (const token of ["--v2-primary:", "--v2-teal:", "--v2-critical:", "--v2-high:", "--v2-medium:", "--v2-low:"]) {
      expect(css).toContain(token);
    }
  });

  it("сохраняет утверждённые базовые цвета V2", () => {
    for (const token of ["--v2-canvas: #f7f9fc", "--v2-surface: #ffffff", "--v2-text: #071a42", "--v2-text-muted: #62718a", "--v2-primary: #0f5ef7", "--v2-cyan: #08b9e8", "--v2-teal: #0b8f7a", "--v2-medium: #b78300"]) {
      expect(css).toContain(token);
    }
  });

  it("использует контрастные foreground-токены не ниже WCAG AA", () => {
    for (const [foreground, background] of [
      ["#071a42", "#f7f9fc"], ["#506180", "#ffffff"], ["#62718a", "#f2f6fb"], ["#0f5ef7", "#eaf2ff"],
      ["#06718e", "#e9fafe"], ["#087260", "#eaf8f5"], ["#b62b3d", "#fff0f1"],
      ["#b94a12", "#fff4ea"], ["#946900", "#fff8dd"], ["#1a7050", "#ecf8f2"],
    ]) {
      expect(contrast(foreground, background)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("не вводит запрещённые presentation-акценты в foundation", () => {
    expect(foundation).not.toMatch(/(?:violet|purple|indigo|shadow-glow|radial-gradient)/i);
    expect(foundation).not.toContain("transition-all");
  });

  it("не содержит запрещённых и legacy presentation-паттернов в пользовательском UI", () => {
    expect(presentationSource).not.toMatch(/(?:violet|purple|indigo|shadow-glow|radial-gradient|transition-all|gradient-command|gradient-brand-soft)/i);
    expect(presentationSource).not.toMatch(/\b(?:surface-panel|surface-flat|interactive-card|filter-field|sticky-workbar|metric-number)\b|(?<!v2-)data-table/);
    expect(presentationSource).not.toMatch(/\bfont-mono\b/);
    expect(presentationSource).not.toMatch(/shield-logo/);
  });

  it("удаляет компоненты, которые больше не используются продуктом", () => {
    for (const file of ["expert-work.tsx", "pattern-attention.tsx", "quality-metric.tsx", "ui.tsx"]) {
      expect(existsSync(join(process.cwd(), "components", file))).toBe(false);
    }
  });

  it("подключает Inter через next/font с кириллицей и четырьмя начертаниями", () => {
    expect(rootLayout).toContain('import { Inter } from "next/font/google"');
    expect(rootLayout).toContain('subsets: ["latin", "cyrillic"]');
    expect(rootLayout).toContain('weight: ["400", "500", "600", "700"]');
  });

  it("использует общую V2-палитру в теме графиков", () => {
    for (const token of ["--v2-primary", "--v2-cyan", "--v2-teal", "--v2-border", "--v2-text-secondary"]) expect(chartTheme).toContain(token);
  });

  it("отключает переходы и анимации при reduced motion", () => {
    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
    expect(css).toContain("transition-duration: 0.01ms !important");
    expect(css).toContain("animation-duration: 0.01ms !important");
  });
});
