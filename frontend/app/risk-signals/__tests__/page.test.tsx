import { describe, expect, it, vi } from "vitest";
import RiskSignalsPage from "../page";

const {redirect} = vi.hoisted(() => ({redirect: vi.fn()}));
vi.mock("next/navigation", () => ({redirect}));

describe("совместимость старого маршрута сигналов", () => {
  it("перенаправляет в единый раздел Проверка", () => {
    RiskSignalsPage();
    expect(redirect).toHaveBeenCalledWith("/signals");
  });
});
