import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AppShell } from "@/components/app-shell";

let pathname = "/";
vi.mock("next/navigation", () => ({usePathname: () => pathname}));
vi.mock("@/components/sidebar", () => ({Sidebar: () => <aside>Боковая навигация</aside>}));

describe("оболочка приложения", () => {
  it("скрывает рабочую навигацию только в аналитическом обзоре", () => {
    pathname = "/overview";
    const {rerender} = render(<AppShell><div>Обзор</div></AppShell>);
    expect(screen.queryByText("Боковая навигация")).not.toBeInTheDocument();
    expect(screen.getByRole("main")).toHaveClass("overview-main");

    pathname = "/signals";
    rerender(<AppShell><div>Проверка</div></AppShell>);
    expect(screen.getByText("Боковая навигация")).toBeInTheDocument();
    expect(screen.getByRole("main")).toHaveClass("xl:ml-[16.5rem]");
    expect(screen.getByRole("link", {name: "К основному содержанию"})).toHaveAttribute("href", "#main-content");
    expect(screen.getByRole("main")).toHaveAttribute("id", "main-content");
  });
});
