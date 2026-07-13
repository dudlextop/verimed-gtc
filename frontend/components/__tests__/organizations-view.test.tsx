import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { OrganizationsView } from "@/components/organizations-view";
import { api } from "@/lib/api";

vi.mock("next/navigation", () => ({useRouter: () => ({replace: vi.fn()}), useSearchParams: () => new URLSearchParams()}));
vi.mock("@/lib/api", () => ({api: {organizations: vi.fn()}}));

describe("список медицинских организаций", () => {
  it("использует приоритет как главный показатель карточки", async () => {
    vi.mocked(api.organizations).mockResolvedValue({items: [{id: 18, name: "Центр диагностики «Оңтүстік»", region: "Шымкент", organization_type: "диагностический центр", services_count: 1000, total_amount: "4200000", signals_count: 38, risk_score: 88, risk_level: "Критический", primary_reason: "Отклонение стоимости", review_status: "Не проверено", priority_score: 95, priority_level: "Критический", financial_significance: "1200000", affected_patients: 20, unreviewed_share: 0.8, priority_factors: [], priority_history: []}], total: 1, page: 1, page_size: 20, regions: ["Шымкент"], organization_types: ["диагностический центр"]});
    render(<OrganizationsView/>);
    const cards = await screen.findByTestId("organizations-mobile-list");
    expect(within(cards).getByText("Приоритет проверки")).toBeInTheDocument();
    expect(within(cards).getByText("95")).toBeInTheDocument();
  });
});
