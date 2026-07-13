import { describe, expect, it } from "vitest";
import { money, number } from "../utils";

describe("форматирование", () => {
  it("форматирует суммы в тенге", () => expect(money(12500)).toContain("₸"));
  it("использует локализованные разделители", () => expect(number(15000)).not.toBe("15000"));
});

