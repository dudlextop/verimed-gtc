import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import OrganizationPage from "../page";
import { api } from "@/lib/api";
import { patternFixture, signalFixture } from "@/components/__tests__/fixtures";
import type { OrganizationComparison, OrganizationDetail } from "@/lib/types";

const push = vi.fn();
let query = new URLSearchParams("returnTo=%2Forganizations%3Fregion%3DШымкент%26page%3D2");

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "18" }),
  useRouter: () => ({ push }),
  useSearchParams: () => query,
}));
vi.mock("@/lib/api", () => ({ api: { organization: vi.fn(), organizationComparison: vi.fn(), organizationPatterns: vi.fn() } }));

const factors = Array.from({ length: 5 }, (_, index) => ({
  name: `Причина ${index + 1}`,
  weight: 20,
  normalized_value: 80 - index,
  contribution: 24 - index,
  actual_value: `${80 - index} из 100`,
  typical_value: "медиана 40",
  explanation: `Объяснение причины ${index + 1}.`,
}));

const organization: OrganizationDetail = {
  id: 18,
  name: "Центр диагностики «Оңтүстік»",
  region: "Шымкент",
  organization_type: "Диагностический центр",
  services_count: 1000,
  total_amount: "4273966",
  signals_count: 230,
  risk_score: 98,
  risk_level: "Критический",
  primary_reason: "Всплеск в конце месяца",
  review_status: "Не проверено",
  priority_score: 95,
  priority_level: "Критический",
  financial_significance: "4273966",
  affected_patients: 209,
  unreviewed_share: 1,
  priority_factors: factors,
  priority_history: [
    { analysis_run_id: 1, period: "май", value: 71, level: "Высокий", financial_significance: "3100000" },
    { analysis_run_id: 2, period: "июн", value: 84, level: "Критический", financial_significance: "3700000" },
    { analysis_run_id: 3, period: "июл", value: 95, level: "Критический", financial_significance: "4273966" },
  ],
  comparison: "Сопоставимая группа диагностических центров",
  timeline: [{ period: "июл", services: 1000, amount: "4273966", signals: 230 }],
  service_structure: [],
  risk_distribution: [{ name: "Критический", value: 230, amount: "4273966" }],
  deviations: [],
  recent_signals: [{ ...signalFixture, id: 10, organization_id: 18, organization_name: "Центр диагностики «Оңтүстік»" }],
  review_history: [],
  high_critical_amount: "4273966",
  confirmed_amount: "0",
  rejected_amount: "0",
  unreviewed_amount: "4273966",
  signal_amount_share: 0.26,
  priority_change: 10,
  financial_change: "532640",
};

const comparison: OrganizationComparison = {
  organization_id: 18,
  analysis_run_id: 3,
  peer_group_size: 8,
  reliability: "Высокая",
  limitation: "",
  items: [{ metric_key: "high_critical_share", metric_label: "Доля услуг высокого и критического риска", value: 0.264, peer_median: 0.037, typical_low: 0.012, typical_high: 0.186, deviation_percent: 608.3, position: 1, peer_group_size: 8, reliability: "Высокая", limitation: "", explanation: "Показатель выше медианы сопоставимой группы." }],
};

describe("карточка медицинской организации", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    query = new URLSearchParams("returnTo=%2Forganizations%3Fregion%3DШымкент%26page%3D2");
    vi.mocked(api.organization).mockResolvedValue(organization);
    vi.mocked(api.organizationComparison).mockResolvedValue(comparison);
    vi.mocked(api.organizationPatterns).mockResolvedValue([patternFixture]);
  });

  it("показывает рабочий заголовок, четыре метрики и сохраняет фильтр перехода к сигналам", async () => {
    render(<OrganizationPage />);
    expect(await screen.findByRole("heading", { name: organization.name })).toBeInTheDocument();
    const back = screen.getByRole("link", { name: /К списку организаций/ });
    expect(back).toHaveAttribute("href", "/organizations?region=Шымкент&page=2");
    const action = screen.getByRole("link", { name: /Открыть сигналы организации/ });
    expect(action).toHaveAttribute("href", "/signals?organization_id=18&sort=priority");
    for (const label of ["Приоритет проверки", "Финансовая значимость", "Сигналы", "Главное отклонение"]) expect(screen.getAllByText(label).length).toBeGreaterThan(0);
  });

  it("даёт доступную локальную навигацию по длинной карточке", async () => {
    render(<OrganizationPage />);
    const navigation = await screen.findByRole("navigation", { name: "Разделы карточки организации" });
    expect(within(navigation).getByRole("link", { name: "Сводка" })).toHaveAttribute("aria-current", "location");
    fireEvent.click(within(navigation).getByRole("link", { name: "Сравнение" }));
    expect(within(navigation).getByRole("link", { name: "Сравнение" })).toHaveAttribute("aria-current", "location");
  });

  it("показывает четыре причины и раскрывает остальные", async () => {
    render(<OrganizationPage />);
    await screen.findByText("Почему организация в фокусе");
    expect(screen.getByText("Причина 4")).toBeInTheDocument();
    expect(screen.queryByText("Причина 5")).not.toBeInTheDocument();
    const disclosure = screen.getByRole("button", { name: "Показать ещё 1" });
    expect(disclosure).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(disclosure);
    expect(screen.getByText("Причина 5")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Скрыть дополнительные причины" })).toHaveAttribute("aria-expanded", "true");
  });

  it("показывает медиану, типичный диапазон, отклонение и текстовую альтернативу", async () => {
    render(<OrganizationPage />);
    const heading = await screen.findByText("Сравнение с сопоставимой группой");
    const panel = heading.closest("section");
    expect(panel).not.toBeNull();
    expect(within(panel!).getByText("Медиана")).toBeInTheDocument();
    expect(within(panel!).getByText(/Типичный диапазон/)).toBeInTheDocument();
    expect(within(panel!).getByText(/Выше на/)).toBeInTheDocument();
    expect(within(panel!).getByRole("article")).toHaveAccessibleName(/Значение организации/);
  });

  it("показывает связанные сигналы и модели с существующими переходами", async () => {
    render(<OrganizationPage />);
    await screen.findByText("Последние сигналы");
    expect(screen.getByRole("link", { name: /Открыть все сигналы/ })).toHaveAttribute("href", "/signals?organization_id=18&sort=priority");
    expect(screen.getByRole("link", { name: /Открыть все модели/ })).toHaveAttribute("href", "/patterns?organization_id=18");
    expect(screen.getAllByText(signalFixture.service_name).length).toBeGreaterThan(0);
    expect(screen.getByText(patternFixture.name)).toBeInTheDocument();
  });

  it("показывает пустые состояния связанных данных", async () => {
    vi.mocked(api.organization).mockResolvedValueOnce({ ...organization, recent_signals: [] });
    vi.mocked(api.organizationPatterns).mockResolvedValueOnce([]);
    render(<OrganizationPage />);
    expect(await screen.findByText("Сигналы не сформированы")).toBeInTheDocument();
    expect(await screen.findByText("Повторяющиеся модели не сформированы")).toBeInTheDocument();
  });

  it("обрабатывает загрузку и ошибку без технического текста", async () => {
    vi.mocked(api.organization).mockImplementationOnce(() => new Promise(() => undefined));
    const loadingView = render(<OrganizationPage />);
    expect(screen.getByLabelText("Загрузка данных")).toHaveAttribute("data-skeleton", "detail");
    await waitFor(() => expect(api.organization).toHaveBeenCalled());
    loadingView.unmount();

    vi.mocked(api.organization).mockRejectedValueOnce(new Error("stack trace"));
    render(<OrganizationPage />);
    expect(await screen.findByText("Не удалось загрузить организацию")).toBeInTheDocument();
    expect(screen.queryByText("stack trace")).not.toBeInTheDocument();
    await waitFor(() => expect(api.organization).toHaveBeenCalled());
  });
});
