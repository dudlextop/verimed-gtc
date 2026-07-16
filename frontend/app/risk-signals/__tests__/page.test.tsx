import { beforeEach, describe, expect, it, vi } from "vitest";
import DataPage from "@/app/data/page";
import SettingsPage from "@/app/settings/page";
import RiskSignalsPage from "../page";

const {redirect} = vi.hoisted(() => ({redirect: vi.fn()}));
vi.mock("next/navigation", () => ({redirect}));

describe("совместимость старого маршрута сигналов", () => {
  beforeEach(() => {
    redirect.mockClear();
  });

  it("перенаправляет в единый раздел Проверка", () => {
    RiskSignalsPage();
    expect(redirect).toHaveBeenCalledWith("/signals");
  });

  it("перенаправляет технические маршруты в рабочую систему", () => {
    DataPage();
    SettingsPage();
    expect(redirect).toHaveBeenNthCalledWith(1, "/");
    expect(redirect).toHaveBeenNthCalledWith(2, "/");
  });
});
