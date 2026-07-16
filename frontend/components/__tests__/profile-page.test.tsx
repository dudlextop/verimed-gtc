import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProfilePageContent } from "@/components/profile-page-content";
import { Sidebar } from "@/components/sidebar";
import { LOCAL_PROFILE_KEY, LOCAL_PROFILE_VERSION, saveLocalProfile, SYNTHETIC_PROFILE } from "@/lib/local-profile";

vi.mock("next/navigation", () => ({ usePathname: () => "/profile" }));

describe("локальный профиль пользователя", () => {
  beforeEach(() => localStorage.clear());

  it("показывает synthetic fallback и честное ограничение локального хранения", async () => {
    render(<ProfilePageContent />);
    expect(await screen.findByRole("heading", { name: "Профиль пользователя" })).toBeInTheDocument();
    expect(screen.getAllByText(SYNTHETIC_PROFILE.displayName).length).toBeGreaterThan(0);
    expect(screen.getByText("Изменения сохраняются только в этом браузере")).toBeInTheDocument();
    expect(screen.queryByText(/парол/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/управление ролями/i)).not.toBeInTheDocument();
  });

  it("валидирует имя, email и инициалы рядом с полями", async () => {
    render(<ProfilePageContent />);
    const name = await screen.findByLabelText("Отображаемое имя");
    fireEvent.change(name, { target: { value: " " } });
    fireEvent.change(screen.getByLabelText("Контактная почта"), { target: { value: "ошибка" } });
    fireEvent.change(screen.getByLabelText("Инициалы"), { target: { value: "А1" } });
    fireEvent.click(screen.getByRole("button", { name: "Сохранить" }));
    expect(screen.getByText("Укажите отображаемое имя")).toBeInTheDocument();
    expect(screen.getByText("Укажите корректную контактную почту")).toBeInTheDocument();
    expect(screen.getByText("Укажите от одной до трёх букв")).toBeInTheDocument();
    await waitFor(() => expect(name).toHaveFocus());
  });

  it("сохраняет профиль, обновляет summary и Sidebar без reload", async () => {
    render(<><Sidebar /><ProfilePageContent /></>);
    const form = screen.getByRole("heading", { name: "Редактирование отображения" }).closest("section")!;
    fireEvent.change(within(form).getByLabelText("Отображаемое имя"), { target: { value: "  Эксперт   Verimed " } });
    fireEvent.change(within(form).getByLabelText("Должность"), { target: { value: "Специалист контроля" } });
    fireEvent.change(within(form).getByLabelText("Инициалы"), { target: { value: "эв" } });
    fireEvent.change(within(form).getByLabelText("Нейтральный аватар"), { target: { value: "teal" } });
    fireEvent.click(within(form).getByRole("button", { name: "Сохранить" }));

    await waitFor(() => expect(localStorage.getItem(LOCAL_PROFILE_KEY)).toContain("Эксперт Verimed"));
    expect(await screen.findByText("Локальный профиль сохранён")).toBeInTheDocument();
    await waitFor(() => expect(screen.getAllByRole("link", { name: /Эксперт Verimed/ }).length).toBeGreaterThan(0));
    expect(screen.getAllByText("ЭВ").length).toBeGreaterThan(0);
  });

  it("сбрасывает локальные изменения и восстанавливает fallback", async () => {
    saveLocalProfile({ displayName: "Локальный эксперт", initials: "ЛЭ" });
    render(<ProfilePageContent />);
    await screen.findByText("Локальный эксперт");
    const reset = screen.getByRole("button", { name: "Сбросить локальные изменения" });
    await waitFor(() => expect(reset).toBeEnabled());
    fireEvent.click(reset);
    await waitFor(() => expect(localStorage.getItem(LOCAL_PROFILE_KEY)).toBeNull());
    expect(await screen.findByText("Локальные изменения сброшены")).toBeInTheDocument();
    expect(screen.getAllByText(SYNTHETIC_PROFILE.displayName).length).toBeGreaterThan(0);
  });

  it("восстанавливает сохранённые данные после повторного открытия страницы", async () => {
    saveLocalProfile({ displayName: "Сохранённый эксперт", jobTitle: "Эксперт контроля", initials: "СЭ" });
    const first = render(<ProfilePageContent />);
    expect(await screen.findByText("Сохранённый эксперт")).toBeInTheDocument();
    first.unmount();
    render(<ProfilePageContent />);
    expect(await screen.findByText("Сохранённый эксперт")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByLabelText("Отображаемое имя")).toHaveValue("Сохранённый эксперт"));
  });

  it("использует только существующие рабочие маршруты", async () => {
    render(<ProfilePageContent />);
    await screen.findByRole("heading", { name: "Рабочие разделы" });
    expect(screen.getByRole("link", { name: /Перейти к проверке/ })).toHaveAttribute("href", "/signals");
    expect(screen.getByRole("link", { name: /Открыть журнал решений/ })).toHaveAttribute("href", "/decision-journal");
    expect(screen.getByRole("link", { name: /Результаты экспертной оценки/ })).toHaveAttribute("href", "/reviews");
    expect(screen.getByRole("link", { name: /Открыть методику/ })).toHaveAttribute("href", "/methodology");
  });

  it("синхронизирует Sidebar через storage event другой вкладки", async () => {
    render(<Sidebar />);
    const envelope = {
      version: LOCAL_PROFILE_VERSION,
      data: { ...SYNTHETIC_PROFILE, displayName: "Эксперт другой вкладки", initials: "ЭД" },
      updatedAt: new Date().toISOString(),
    };
    localStorage.setItem(LOCAL_PROFILE_KEY, JSON.stringify(envelope));
    act(() => window.dispatchEvent(new StorageEvent("storage", { key: LOCAL_PROFILE_KEY, newValue: JSON.stringify(envelope) })));
    await waitFor(() => expect(screen.getAllByRole("link", { name: /Эксперт другой вкладки/ }).length).toBeGreaterThan(0));
  });

  it("показывает недоступность localStorage и блокирует сохранение", async () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("blocked"); });
    render(<ProfilePageContent />);
    expect(await screen.findByText("Локальное сохранение недоступно")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Сохранить" })).toBeDisabled();
    setItem.mockRestore();
  });
});
