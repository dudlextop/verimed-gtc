import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Sidebar } from "@/components/sidebar";

let pathname = "/signals";
vi.mock("next/navigation", () => ({ usePathname: () => pathname }));

describe("оболочка навигации", () => {
  it("сохраняет структуру и отмечает активный маршрут", () => {
    pathname = "/signals/840";
    render(<Sidebar />);

    const main = screen.getByRole("navigation", { name: "Основная навигация" });
    expect(main).toHaveTextContent("Сводная аналитика");
    expect(main).toHaveTextContent("Медицинские организации");
    expect(main).toHaveTextContent("Проверка");
    expect(main).toHaveTextContent("Повторяющиеся модели");
    expect(within(main).getByRole("link", { name: "Проверка" })).toHaveAttribute("aria-current", "page");

    const expert = screen.getByRole("navigation", { name: "Экспертная работа" });
    expect(expert).toHaveTextContent("Результаты экспертной оценки");
    expect(expert).toHaveTextContent("Журнал решений");

    expect(screen.queryByText("Загрузка данных")).not.toBeInTheDocument();
    expect(screen.queryByText("Настройки")).not.toBeInTheDocument();
    expect(screen.queryByText("Сигналы риска")).not.toBeInTheDocument();
    expect(screen.queryByText("foundation-preview")).not.toBeInTheDocument();
  });

  it("использует утверждённый логотип и профиль как прямую ссылку", () => {
    pathname = "/profile";
    render(<Sidebar />);

    expect(screen.getAllByAltText("Verimed").length).toBeGreaterThan(0);
    const profile = screen.getByRole("link", { name: /Айдана Сарсенова/ });
    expect(profile).toHaveAttribute("href", "/profile");
    expect(profile).toHaveAttribute("aria-current", "page");
    expect(screen.queryByRole("button", { name: /профил/i })).not.toBeInTheDocument();
  });

  it("открывает mobile sheet, блокирует прокрутку и закрывается по Escape", () => {
    pathname = "/signals";
    render(<Sidebar />);
    const trigger = screen.getByRole("button", { name: "Открыть навигацию" });
    trigger.focus();

    fireEvent.click(trigger);
    const dialog = screen.getByRole("dialog", { name: "Навигация" });
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(document.body.style.overflow).toBe("hidden");
    expect(within(dialog).getByRole("button", { name: "Закрыть навигацию" })).toHaveFocus();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog", { name: "Навигация" })).not.toBeInTheDocument();
    expect(document.body.style.overflow).toBe("");
    expect(trigger).toHaveFocus();
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it("удерживает фокус внутри mobile sheet", () => {
    pathname = "/patterns";
    render(<Sidebar />);
    fireEvent.click(screen.getByRole("button", { name: "Открыть навигацию" }));

    const dialog = screen.getByRole("dialog", { name: "Навигация" });
    const closeButton = within(dialog).getByRole("button", { name: "Закрыть навигацию" });
    const logoLink = within(dialog).getByRole("link", { name: "Verimed — на сводную аналитику" });
    const profile = within(dialog).getByRole("link", { name: /Айдана Сарсенова/ });

    logoLink.focus();
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(profile).toHaveFocus();

    fireEvent.keyDown(document, { key: "Tab" });
    expect(logoLink).toHaveFocus();
    expect(closeButton).not.toHaveFocus();
  });
});
