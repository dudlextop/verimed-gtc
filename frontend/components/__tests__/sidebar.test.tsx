import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Sidebar } from "@/components/sidebar";

vi.mock("next/navigation", () => ({usePathname: () => "/signals"}));

describe("основная навигация", () => {
  it("объединяет проверку и группирует экспертную работу", () => {
    render(<Sidebar/>);
    const main = screen.getByRole("navigation", {name: "Основная навигация"});
    expect(main).toHaveTextContent("Проверка");
    expect(main).not.toHaveTextContent("Очередь на проверку");
    expect(main).not.toHaveTextContent("Сигналы риска");

    const expert = screen.getByRole("navigation", {name: "Экспертная работа"});
    expect(expert).toHaveTextContent("Результаты экспертной оценки");
    expect(expert).toHaveTextContent("Журнал решений");

    expect(screen.queryByText("Загрузка данных")).not.toBeInTheDocument();
    expect(screen.queryByText("Настройки")).not.toBeInTheDocument();
  });
});
