import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SignalsView } from "@/components/signals-view";
import { api } from "@/lib/api";
import { signalFixture } from "./fixtures";

const replace = vi.fn();
const push = vi.fn();
let currentParams = new URLSearchParams("page=2&region=Астана");

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, push }),
  useSearchParams: () => currentParams,
}));
vi.mock("@/lib/api", () => ({
  API_URL: "/api",
  api: { signals: vi.fn(), signalPreview: vi.fn(), review: vi.fn() },
}));

const response = { items: [signalFixture], total: 21, page: 2, page_size: 20, anomaly_types: ["Отклонение стоимости"] };

describe("очередь на проверку", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentParams = new URLSearchParams("page=2&region=Астана");
    replace.mockReset();
    push.mockReset();
    vi.mocked(api.signals).mockResolvedValue(response);
    vi.stubGlobal("fetch", vi.fn());
    vi.stubGlobal("URL", { ...URL, createObjectURL: vi.fn(() => "blob:signals"), revokeObjectURL: vi.fn() });
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
  });

  it("открывает быстрый просмотр, сохраняя страницу, фильтры и табличную иерархию", async () => {
    render(<SignalsView/>);
    expect(await screen.findByLabelText("Сортировка очереди")).toHaveValue("priority");
    fireEvent.click(screen.getByLabelText("Открыть быстрый просмотр сигнала 10"));
    expect(replace).toHaveBeenCalledWith(expect.stringContaining("page=2"), { scroll: false });
    expect(replace).toHaveBeenCalledWith(expect.stringContaining("region=%D0%90%D1%81%D1%82%D0%B0%D0%BD%D0%B0"), { scroll: false });
    expect(replace).toHaveBeenCalledWith(expect.stringContaining("signal=10"), { scroll: false });
    expect(screen.getByTestId("signals-mobile-list")).toBeInTheDocument();
    expect(screen.getByText("Регион: Астана")).toBeInTheDocument();
    for (const heading of ["Приоритет", "Сигнал / услуга", "Медицинская организация", "Финансовая значимость", "Основная причина", "Статус", "Действия"]) {
      expect(screen.getByRole("columnheader", { name: heading })).toBeInTheDocument();
    }
  });

  it("выбирает строку без открытия preview и сохраняет выбор при пагинации", async () => {
    const view = render(<SignalsView/>);
    const checkbox = await screen.findByRole("checkbox", { name: "Выбрать сигнал 10" });
    fireEvent.click(checkbox);
    expect(replace).not.toHaveBeenCalled();
    expect(screen.getByText("Выбрано: 1")).toBeInTheDocument();

    currentParams = new URLSearchParams("page=3&region=Астана");
    view.rerender(<SignalsView/>);
    await waitFor(() => expect(screen.getByText("Выбрано: 1")).toBeInTheDocument());
  });

  it("очищает выбор при изменении сигнатуры фильтров", async () => {
    const view = render(<SignalsView/>);
    fireEvent.click(await screen.findByRole("checkbox", { name: "Выбрать сигнал 10" }));
    currentParams = new URLSearchParams("page=2&region=Алматы");
    view.rerender(<SignalsView/>);
    await waitFor(() => expect(screen.getByText("Выбор очищен после изменения фильтров")).toBeInTheDocument());
    expect(screen.queryByText("Выбрано: 1")).not.toBeInTheDocument();
  });

  it("передаёт текущие фильтры и сортировку в серверный экспорт", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response("\ufeffСигнал\r\n№ 10", { status: 200, headers: { "content-type": "text/csv", "content-disposition": "attachment; filename=signals.csv" } }));
    render(<SignalsView/>);
    await screen.findAllByText("Компьютерная томография");
    fireEvent.click(screen.getByRole("button", { name: /Экспортировать.*Текущая выборка/ }));
    await waitFor(() => expect(fetch).toHaveBeenCalledWith(expect.stringContaining("/exports/signals.csv?region=%D0%90%D1%81%D1%82%D0%B0%D0%BD%D0%B0"), expect.objectContaining({ method: "GET" })));
    expect(String(vi.mocked(fetch).mock.calls[0][0])).not.toContain("page=2");
  });

  it("экспортирует выбранные идентификаторы и сохраняет выбор при ошибке лимита", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ detail: { code: "export_limit_exceeded", message: "В выборке 5001 строк. Сузьте фильтры до 5000 строк." } }), { status: 413, headers: { "content-type": "application/json" } }));
    render(<SignalsView/>);
    fireEvent.click(await screen.findByRole("checkbox", { name: "Выбрать сигнал 10" }));
    fireEvent.click(screen.getByRole("button", { name: /Экспортировать.*Выбрано: 1/ }));
    await waitFor(() => expect(fetch).toHaveBeenCalledWith(expect.stringContaining("/exports/signals.csv"), expect.objectContaining({ method: "POST", body: JSON.stringify({ signal_ids: [10] }) })));
    expect((await screen.findAllByText("В выборке 5001 строк. Сузьте фильтры до 5000 строк.")).length).toBeGreaterThan(0);
    expect(screen.getByText("Выбрано: 1")).toBeInTheDocument();
  });

  it("показывает компактное пустое состояние", async () => {
    vi.mocked(api.signals).mockResolvedValue({ ...response, items: [], total: 0 });
    render(<SignalsView/>);
    expect(await screen.findByText("По выбранным условиям сигналов нет")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Сбросить все" }).length).toBeGreaterThan(0);
  });

  it("показывает list skeleton во время загрузки", async () => {
    vi.mocked(api.signals).mockImplementationOnce(() => new Promise(() => undefined));
    render(<SignalsView/>);
    expect(screen.getByLabelText("Загрузка данных")).toHaveAttribute("data-skeleton", "list");
    await waitFor(() => expect(api.signals).toHaveBeenCalled());
  });

  it("сохраняет сортировку в URL", async () => {
    render(<SignalsView/>);
    fireEvent.change(await screen.findByLabelText("Сортировка очереди"), { target: { value: "financial" } });
    expect(replace).toHaveBeenCalledWith(expect.stringContaining("sort=financial"), { scroll: false });
    expect(replace).toHaveBeenCalledWith(expect.stringContaining("direction=desc"), { scroll: false });
  });

  it("показывает понятную ошибку загрузки с повторной попыткой", async () => {
    vi.mocked(api.signals).mockRejectedValueOnce(new Error("Сервис недоступен"));
    render(<SignalsView/>);
    expect(await screen.findByText("Не удалось загрузить очередь")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Повторить" })).toBeInTheDocument();
    expect(screen.queryByText("Сервис недоступен")).not.toBeInTheDocument();
  });
});
