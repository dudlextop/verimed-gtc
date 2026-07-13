import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SignalsView } from "@/components/signals-view";
import { api } from "@/lib/api";
import { signalFixture } from "./fixtures";

const replace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({replace}),
  useSearchParams: () => new URLSearchParams("page=2&region=Астана"),
}));
vi.mock("@/lib/api", () => ({api: {signals: vi.fn(), signalPreview: vi.fn(), review: vi.fn()}}));

describe("очередь на проверку", () => {
  it("открывает быстрый просмотр, сохраняя страницу и фильтры", async () => {
    vi.mocked(api.signals).mockResolvedValue({items: [signalFixture], total: 21, page: 2, page_size: 20, anomaly_types: ["Отклонение стоимости"]});
    render(<SignalsView/>);
    expect(await screen.findByLabelText("Сортировка очереди")).toHaveValue("priority");
    fireEvent.click(await screen.findByRole("button", {name: "Открыть быстрый просмотр сигнала 10"}));
    expect(replace).toHaveBeenCalledWith(expect.stringContaining("page=2"), {scroll: false});
    expect(replace).toHaveBeenCalledWith(expect.stringContaining("region=%D0%90%D1%81%D1%82%D0%B0%D0%BD%D0%B0"), {scroll: false});
    expect(replace).toHaveBeenCalledWith(expect.stringContaining("signal=10"), {scroll: false});
    expect(screen.getByTestId("signals-mobile-list")).toBeInTheDocument();
    expect(screen.getByText("Применено фильтров: 1")).toBeInTheDocument();
    for (const heading of ["Приоритет", "Медицинская организация", "Медицинская услуга", "Финансовая значимость", "Основная причина", "Статус", "Дата"]) {
      expect(screen.getByRole("columnheader", {name: heading})).toBeInTheDocument();
    }
  });
});
