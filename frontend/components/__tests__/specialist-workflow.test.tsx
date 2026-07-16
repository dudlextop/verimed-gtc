import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import SignalPage from "@/app/signals/[id]/page";
import { CommandCenter, PRIORITY_QUEUE_URL } from "@/components/command-center";
import { SignalPreviewPanel } from "@/components/signal-preview-panel";
import { OrganizationComparisonBlock } from "@/components/organization-comparison";
import { api } from "@/lib/api";
import { commandCenterFixture, signalFixture } from "./fixtures";

vi.mock("next/navigation", () => ({useParams: () => ({id: "10"}), useSearchParams: () => new URLSearchParams()}));
vi.mock("@/lib/api", () => ({api: {
  signalPreview: vi.fn(),
  signal: vi.fn(),
  signalPatterns: vi.fn(),
  signalDecisionHistory: vi.fn(),
  signalRecurrenceHistory: vi.fn(),
  signalDecisionEvent: vi.fn(),
  review: vi.fn(),
}}));

describe("сквозной сценарий специалиста", () => {
  it("проходит от командного центра до экспертного решения", async () => {
    vi.mocked(api.signalPreview).mockResolvedValue(signalFixture);
    vi.mocked(api.signal).mockResolvedValue(signalFixture);
    vi.mocked(api.signalPatterns).mockResolvedValue([]);
    vi.mocked(api.signalDecisionHistory).mockResolvedValue({entity_type: "signal", entity_fingerprint: "f".repeat(64), current_status: null, history_found: false, events: []});
    vi.mocked(api.signalRecurrenceHistory).mockResolvedValue({entity_fingerprint: "f".repeat(64), first_detected_at: null, last_detected_at: null, appeared_runs: 1, absent_runs: 0, last_expert_status: null, points: []});
    const updated = {...signalFixture, status: "Направлено на углублённую проверку" as const, reviews: [{id: 2, status: "Направлено на углублённую проверку" as const, comment: "Нужно дополнительное сопоставление.", reviewer_name: "Айдана Сарсенова", created_at: "2026-07-12T11:00:00"}]};
    vi.mocked(api.review).mockResolvedValue(updated);

    const command = render(<CommandCenter data={commandCenterFixture}/>);
    expect(screen.getByRole("link", {name: "Перейти к проверке"})).toHaveAttribute("href", PRIORITY_QUEUE_URL);
    expect(screen.getByRole("link", {name: /Центр диагностики № 4/})).toHaveAttribute("href", "/organizations/4");
    command.unmount();

    const comparison = render(<OrganizationComparisonBlock data={{organization_id: 4, analysis_run_id: 3, peer_group_size: 4, reliability: "Средняя", limitation: "Группа расширена.", items: [{metric_key: "signal_services_amount", metric_label: "Сумма услуг, связанных с сигналами", value: 12400000, peer_median: 4500000, typical_low: 3200000, typical_high: 6100000, deviation_percent: 175.6, position: 1, peer_group_size: 4, reliability: "Средняя", limitation: "Группа расширена.", explanation: "Показатель выше медианы группы."}]}}/>);
    expect(screen.getByText("Сравнение с сопоставимой группой")).toBeInTheDocument();
    comparison.unmount();

    const preview = render(<SignalPreviewPanel signalId={10} onClose={vi.fn()} onUpdated={vi.fn()}/>);
    expect(await screen.findByRole("link", {name: "Открыть карточку"})).toHaveAttribute("href", "/signals/10");
    preview.unmount();

    render(<SignalPage/>);
    await screen.findByRole("heading", {name: "Компьютерная томография"});
    fireEvent.click(screen.getByRole("button", {name: "Направить на углублённую проверку"}));
    fireEvent.change(screen.getByLabelText("Комментарий специалиста"), {target: {value: "Нужно дополнительное сопоставление."}});
    fireEvent.click(screen.getByRole("button", {name: "Сохранить решение"}));
    await waitFor(() => expect(screen.getByText("Сигнал направлен на проверку")).toBeInTheDocument());
    expect(screen.getAllByText("Направлено на углублённую проверку").length).toBeGreaterThan(0);
  });
});
