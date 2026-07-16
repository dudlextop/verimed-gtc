import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { OrganizationsView } from "@/components/organizations-view";
import { api } from "@/lib/api";
import type { OrganizationsResponse } from "@/lib/types";

const replace = vi.fn();
const push = vi.fn();
let currentParams = new URLSearchParams("page=2&region=Шымкент&sort=priority&direction=desc");

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, push }),
  useSearchParams: () => currentParams,
}));
vi.mock("@/lib/api", () => ({ API_URL: "/api", api: { organizations: vi.fn() } }));

const organization = {
  id: 18,
  name: "Центр диагностики «Оңтүстік»",
  region: "Шымкент",
  organization_type: "Диагностический центр",
  services_count: 1000,
  total_amount: "4200000",
  signals_count: 38,
  risk_score: 88,
  risk_level: "Критический" as const,
  primary_reason: "Отклонение стоимости",
  review_status: "Не проверено" as const,
  priority_score: 95,
  priority_level: "Критический" as const,
  financial_significance: "1200000",
  affected_patients: 20,
  unreviewed_share: 0.8,
  priority_factors: [],
  priority_history: [],
};
const response: OrganizationsResponse = { items: [organization], total: 21, page: 2, page_size: 20, regions: ["Шымкент", "Астана"], organization_types: ["Диагностический центр"] };

describe("список медицинских организаций", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentParams = new URLSearchParams("page=2&region=Шымкент&sort=priority&direction=desc");
    vi.mocked(api.organizations).mockResolvedValue(response);
    vi.stubGlobal("fetch", vi.fn());
    vi.stubGlobal("URL", { ...URL, createObjectURL: vi.fn(() => "blob:organizations"), revokeObjectURL: vi.fn() });
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
  });

  it("показывает V2-таблицу и мобильную карточку без горизонтальной копии таблицы", async () => {
    render(<OrganizationsView />);
    expect(await screen.findByRole("heading", { name: "Медицинские организации" })).toBeInTheDocument();
    for (const heading of ["Приоритет", "Медицинская организация", "Регион и тип", "Сигналы", "Финансовая значимость", "Риск и отклонение", "Статус", "Действия"]) {
      expect(screen.getByRole("columnheader", { name: heading })).toBeInTheDocument();
    }
    const cards = screen.getByTestId("organizations-mobile-list");
    expect(within(cards).getByText("95")).toBeInTheDocument();
    expect(within(cards).getByText("Центр диагностики «Оңтүстік»")).toHaveClass("line-clamp-2");
  });

  it("сохраняет фильтры и сортировку в URL", async () => {
    render(<OrganizationsView />);
    fireEvent.change(await screen.findByLabelText("Уровень риска"), { target: { value: "Высокий" } });
    expect(replace).toHaveBeenCalledWith(expect.stringContaining("risk_level=%D0%92%D1%8B%D1%81%D0%BE%D0%BA%D0%B8%D0%B9"), { scroll: false });
    expect(replace).toHaveBeenCalledWith(expect.stringContaining("region=%D0%A8%D1%8B%D0%BC%D0%BA%D0%B5%D0%BD%D1%82"), { scroll: false });
    fireEvent.click(screen.getByRole("button", { name: /Дополнительные фильтры/ }));
    fireEvent.change(screen.getByLabelText("Сортировка организаций"), { target: { value: "financial" } });
    expect(replace).toHaveBeenCalledWith(expect.stringContaining("sort=financial"), { scroll: false });
    expect(replace).toHaveBeenCalledWith(expect.stringContaining("direction=desc"), { scroll: false });
  });

  it("открывает карточку строкой и передаёт контекст списка", async () => {
    render(<OrganizationsView />);
    fireEvent.click(await screen.findByRole("row", { name: /Открыть карточку организации/ }));
    expect(push).toHaveBeenCalledWith(expect.stringContaining("/organizations/18?returnTo="));
    expect(push).toHaveBeenCalledWith(expect.stringContaining("page%3D2"));
    fireEvent.click(within(screen.getByTestId("organizations-mobile-list")).getByRole("button", { name: /Центр диагностики/ }));
    expect(push).toHaveBeenCalledTimes(2);
  });

  it("меняет страницу через URL и сохраняет действующие условия", async () => {
    render(<OrganizationsView />);
    fireEvent.click(await screen.findByRole("button", { name: "Предыдущая страница" }));
    expect(replace).toHaveBeenCalledWith(expect.stringContaining("page=1"), { scroll: false });
    expect(replace).toHaveBeenCalledWith(expect.stringContaining("region=%D0%A8%D1%8B%D0%BC%D0%BA%D0%B5%D0%BD%D1%82"), { scroll: false });
    expect(replace).toHaveBeenCalledWith(expect.stringContaining("sort=priority"), { scroll: false });
  });

  it("экспортирует всю текущую выборку с фильтрами и сортировкой без пагинации", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response("\ufeffОрганизация\r\nОңтүстік", { status: 200, headers: { "content-type": "text/csv", "content-disposition": "attachment; filename=organizations.csv" } }));
    render(<OrganizationsView />);
    await screen.findAllByText("Центр диагностики «Оңтүстік»");
    fireEvent.click(screen.getByRole("button", { name: /Экспортировать.*Текущая выборка/ }));
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    const url = String(vi.mocked(fetch).mock.calls[0][0]);
    expect(url).toContain("/exports/organizations.csv?");
    expect(url).toContain("region=%D0%A8%D1%8B%D0%BC%D0%BA%D0%B5%D0%BD%D1%82");
    expect(url).toContain("sort=priority");
    expect(url).not.toContain("page=2");
  });

  it("объясняет ошибку лимита и не сбрасывает фильтры", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ detail: { code: "export_limit_exceeded", message: "В выборке 5001 строк. Сузьте фильтры до 5000 строк." } }), { status: 413, headers: { "content-type": "application/json" } }));
    render(<OrganizationsView />);
    await screen.findAllByText("Центр диагностики «Оңтүстік»");
    fireEvent.click(screen.getByRole("button", { name: /Экспортировать.*Текущая выборка/ }));
    expect(await screen.findByText("В выборке 5001 строк. Сузьте фильтры до 5000 строк.")).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });

  it("показывает list skeleton, понятную ошибку и пустое состояние", async () => {
    vi.mocked(api.organizations).mockImplementationOnce(() => new Promise(() => undefined));
    const view = render(<OrganizationsView />);
    expect(screen.getByLabelText("Загрузка данных")).toHaveAttribute("data-skeleton", "list");
    await waitFor(() => expect(api.organizations).toHaveBeenCalled());
    view.unmount();

    vi.mocked(api.organizations).mockRejectedValueOnce(new Error("Техническая ошибка"));
    const errorView = render(<OrganizationsView />);
    expect(await screen.findByText("Не удалось загрузить организации")).toBeInTheDocument();
    expect(screen.queryByText("Техническая ошибка")).not.toBeInTheDocument();
    errorView.unmount();

    vi.mocked(api.organizations).mockResolvedValueOnce({ ...response, items: [], total: 0 });
    render(<OrganizationsView />);
    expect(await screen.findByText("По выбранным условиям организаций нет")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Сбросить все" }).length).toBeGreaterThan(0);
  });
});
