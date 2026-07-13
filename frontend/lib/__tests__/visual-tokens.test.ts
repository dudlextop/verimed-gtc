import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(join(process.cwd(), "app", "globals.css"), "utf8");

describe("визуальные токены", () => {
  it("содержит отдельную семантику аналитических понятий", () => {
    for (const token of ["--priority:", "--risk:", "--finance:", "--importance:", "--stability:"]) {
      expect(css).toContain(token);
    }
  });

  it("отключает переходы и анимации при reduced motion", () => {
    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
    expect(css).toContain("transition-duration: 0.01ms !important");
    expect(css).toContain("animation-duration: 0.01ms !important");
  });
});
