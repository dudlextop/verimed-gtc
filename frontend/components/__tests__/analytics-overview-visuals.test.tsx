import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OverviewSignalTimeline } from "@/components/overview-signal-timeline";
import { RegionalMonitoringMap } from "@/components/regional-monitoring-map";
import type { RegionalMonitoringItem } from "@/lib/types";

const almaty: RegionalMonitoringItem = {
  region_name: "Алматы",
  region_code: "KZ-ALA",
  signal_count: 12,
  unique_record_count: 10,
  financial_significance: "150000",
  organization_count: 2,
  maximum_priority: 91,
  leading_organization: { id: 1, name: "Организация Алматы", priority_score: 91 },
};
const geometry = {
  type: "FeatureCollection",
  features: [
    { type: "Feature", properties: { shapeID: "16772668B7707561767580", shapeName: "Almaty" }, geometry: { type: "Polygon", coordinates: [[[76, 43], [77, 43], [77, 44], [76, 44], [76, 43]]] } },
    { type: "Feature", properties: { shapeID: "16772668B31479154893463", shapeName: "Karaganda" }, geometry: { type: "Polygon", coordinates: [[[70, 48], [71, 48], [71, 49], [70, 49], [70, 48]]] } },
  ],
};

describe("региональная карта", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => geometry }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("показывает фактический tooltip и ведёт в список организаций с region filter", async () => {
    render(<RegionalMonitoringMap regions={[almaty]} />);
    const almatyLink = (await screen.findAllByRole("link", { name: /Алматы.*12 сигналов/ }))[0];
    expect(almatyLink).toHaveAttribute("href", "/organizations?region=%D0%90%D0%BB%D0%BC%D0%B0%D1%82%D1%8B");
    fireEvent.focus(almatyLink);
    const tooltip = screen.getAllByTestId("region-tooltip")[0];
    expect(tooltip).toHaveTextContent("Уникальные записи");
    expect(tooltip).toHaveTextContent("10");
    expect(tooltip).toHaveTextContent("Организация Алматы");
  });

  it("переключает слои клавиатурой и не полагается только на цвет", async () => {
    render(<RegionalMonitoringMap regions={[almaty]} />);
    await waitFor(() => expect(document.querySelector("[data-region-code='KZ-ALA']")).toBeInTheDocument());
    const signals = screen.getByRole("radio", { name: "Сигналы" });
    fireEvent.keyDown(signals.closest("[role='radiogroup']") as HTMLElement, { key: "ArrowRight" });
    expect(screen.getByRole("radio", { name: "Финансовая значимость" })).toHaveAttribute("aria-checked", "true");
    fireEvent.keyDown(screen.getByRole("radiogroup"), { key: "End" });
    expect(screen.getByRole("radio", { name: "Приоритет" })).toHaveAttribute("aria-checked", "true");
  });

  it("показывает регион без агрегата как «Нет данных»", async () => {
    render(<RegionalMonitoringMap regions={[almaty]} />);
    const noData = (await screen.findAllByRole("link", { name: /Карагандинская область.*Нет данных/ }))[0];
    fireEvent.focus(noData);
    expect(screen.getAllByTestId("region-tooltip")[0]).toHaveTextContent("Нет данных");
    expect(document.querySelector("[data-region-code='KZ-KAR']")).toHaveAttribute("data-state", "no-data");
  });

  it("не сопоставляет Шымкент и неизвестный регион со случайной геометрией", async () => {
    const shymkent = { ...almaty, region_name: "Шымкент", region_code: "KZ-SHY" };
    const unknown = { ...almaty, region_name: "Неизвестный регион", region_code: "unknown-123" };
    render(<RegionalMonitoringMap regions={[shymkent, unknown]} />);
    await waitFor(() => expect(document.querySelector("[data-region-code='KZ-ALA']")).toBeInTheDocument());
    expect(document.querySelector("[data-region-code='KZ-SHY']")).not.toBeInTheDocument();
    expect(document.querySelector("[data-region-code='unknown-123']")).not.toBeInTheDocument();
    expect(screen.getAllByText("Шымкент").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Неизвестный регион").length).toBeGreaterThan(0);
  });

  it("сохраняет ranked list при частичной ошибке карты", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));
    render(<RegionalMonitoringMap regions={[almaty]} />);
    expect((await screen.findAllByText("Карта временно недоступна")).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: /Алматы/ }).length).toBeGreaterThan(0);
  });

  it("содержит mobile-first ranked list и вторичное раскрытие карты", async () => {
    render(<RegionalMonitoringMap regions={[almaty]} />);
    expect(screen.getByRole("list", { name: "Регионы: Сигналы" })).toBeInTheDocument();
    expect(screen.getByText("Показать карту")).toBeInTheDocument();
    await waitFor(() => expect(document.querySelector("[data-region-code='KZ-ALA']")).toBeInTheDocument());
  });
});

describe("динамика сигналов", () => {
  const timeline = [
    { period: "Май", services: 100, amount: "1000", signals: 12 },
    { period: "Июнь", services: 120, amount: "1300", signals: 18 },
  ];

  it("сохраняет порядок фактических периодов и текстовую альтернативу", () => {
    render(<OverviewSignalTimeline data={timeline} />);
    const alternative = screen.getByLabelText("Текстовая альтернатива динамики сигналов");
    expect(alternative).toHaveTextContent("Май: 12 сигналов");
    expect(alternative).toHaveTextContent("Июнь: 18 сигналов");
    expect(alternative.textContent?.indexOf("Май")).toBeLessThan(alternative.textContent?.indexOf("Июнь") ?? 0);
    expect(screen.getByRole("img", { name: "Динамика сигналов за 2 периодов" })).toBeInTheDocument();
  });

  it("различает отсутствующий, пустой и недостаточный timeline", async () => {
    const unavailable = render(<OverviewSignalTimeline data={undefined} />);
    expect(screen.getByText("Динамика недоступна")).toBeInTheDocument();
    unavailable.unmount();
    const empty = render(<OverviewSignalTimeline data={[]} />);
    expect(screen.getByText("История сигналов пока отсутствует")).toBeInTheDocument();
    empty.unmount();
    render(<OverviewSignalTimeline data={timeline.slice(0, 1)} />);
    await waitFor(() => expect(screen.getByText("Недостаточно периодов для динамики")).toBeInTheDocument());
  });
});
