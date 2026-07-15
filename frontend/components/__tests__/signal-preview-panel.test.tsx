import { useState } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SignalPreviewPanel } from "@/components/signal-preview-panel";
import { api } from "@/lib/api";
import { signalFixture } from "./fixtures";

vi.mock("@/lib/api", () => ({api: {signalPreview: vi.fn(), review: vi.fn()}}));

describe("быстрый просмотр сигнала", () => {
  beforeEach(() => { vi.mocked(api.signalPreview).mockResolvedValue(signalFixture); });

  it("показывает загрузку, затем контекст сигнала и закрывается", async () => {
    const close = vi.fn();
    render(<SignalPreviewPanel signalId={10} onClose={close} onUpdated={vi.fn()}/>);
    expect(screen.getByLabelText("Загрузка быстрого просмотра")).toBeInTheDocument();
    expect(await screen.findByText("Компьютерная томография")).toBeInTheDocument();
    expect(screen.getByText("Приоритет проверки")).toBeInTheDocument();
    expect(screen.getByText("Финансовая значимость")).toBeInTheDocument();
    expect(screen.getByText("Обоснование").closest("details")).not.toHaveAttribute("open");
    fireEvent.click(screen.getByRole("button", {name: "Закрыть панель"}));
    expect(close).toHaveBeenCalledOnce();
  });

  it("обновляет статус в панели после решения", async () => {
    const updated = {...signalFixture, status: "На рассмотрении" as const};
    vi.mocked(api.review).mockResolvedValue(updated);
    const onUpdated = vi.fn();
    render(<SignalPreviewPanel signalId={10} onClose={vi.fn()} onUpdated={onUpdated}/>);
    await screen.findByText("Компьютерная томография");
    fireEvent.click(screen.getByRole("button", {name: "Начать проверку"}));
    await waitFor(() => expect(onUpdated).toHaveBeenCalledWith(updated));
    expect(screen.getByText("Проверка начата")).toBeInTheDocument();
    expect(screen.getByRole("link", {name: "Продолжить проверку"})).toBeInTheDocument();
  });

  it("переходит к предыдущему и следующему сигналу в текущей очереди", async () => {
    const navigate = vi.fn();
    render(<SignalPreviewPanel signalId={10} previousId={9} nextId={11} onNavigate={navigate} onClose={vi.fn()} onUpdated={vi.fn()}/>);
    await screen.findByText("Компьютерная томография");
    fireEvent.click(screen.getByRole("button", {name: "Предыдущий сигнал"}));
    fireEvent.click(screen.getByRole("button", {name: "Следующий сигнал"}));
    expect(navigate).toHaveBeenNthCalledWith(1, 9);
    expect(navigate).toHaveBeenNthCalledWith(2, 11);
  });

  it("закрывается клавишей Escape", async () => {
    const close = vi.fn();
    render(<SignalPreviewPanel signalId={10} onClose={close} onUpdated={vi.fn()}/>);
    await screen.findByText("Компьютерная томография");
    fireEvent.keyDown(window, {key: "Escape"});
    expect(close).toHaveBeenCalledOnce();
  });

  it("показывает ошибку и действие повторной попытки", async () => {
    vi.mocked(api.signalPreview).mockRejectedValueOnce(new Error("Сервис недоступен"));
    render(<SignalPreviewPanel signalId={10} onClose={vi.fn()} onUpdated={vi.fn()}/>);
    expect(await screen.findByText("Не удалось загрузить сигнал")).toBeInTheDocument();
    expect(screen.getByRole("button", {name: "Повторить"})).toBeInTheDocument();
  });

  it("объясняет отсутствие сигнала", async () => {
    vi.mocked(api.signalPreview).mockResolvedValueOnce(null as never);
    render(<SignalPreviewPanel signalId={10} onClose={vi.fn()} onUpdated={vi.fn()}/>);
    expect(await screen.findByText("Сигнал недоступен")).toBeInTheDocument();
  });

  it("блокирует прокрутку фона, удерживает фокус и возвращает его при закрытии", async () => {
    function Harness() {
      const [open, setOpen] = useState(false);
      return <><button type="button" onClick={() => setOpen(true)}>Открыть сигнал</button>{open && <SignalPreviewPanel signalId={10} onClose={() => setOpen(false)} onUpdated={vi.fn()}/>}</>;
    }
    render(<Harness/>);
    const trigger = screen.getByRole("button", { name: "Открыть сигнал" });
    trigger.focus();
    fireEvent.click(trigger);
    await screen.findByText("Компьютерная томография");
    expect(document.body.style.overflow).toBe("hidden");
    const dialog = screen.getByRole("dialog");
    const controls = Array.from(dialog.querySelectorAll<HTMLElement>("a[href], button:not(:disabled), details > summary"));
    controls.at(-1)?.focus();
    fireEvent.keyDown(window, { key: "Tab" });
    expect(document.activeElement).toBe(controls[0]);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(trigger).toHaveFocus();
    expect(document.body.style.overflow).toBe("");
  });

  it("отключает навигацию на границе очереди и раскрывает вторичный контекст по запросу", async () => {
    render(<SignalPreviewPanel signalId={10} previousId={null} nextId={null} onClose={vi.fn()} onUpdated={vi.fn()}/>);
    await screen.findByText("Компьютерная томография");
    expect(screen.getByRole("button", { name: "Предыдущий сигнал" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Следующий сигнал" })).toBeDisabled();
    const rationale = screen.getByText("Обоснование").closest("details");
    fireEvent.click(screen.getByText("Обоснование"));
    expect(rationale).toHaveAttribute("open");
  });
});
