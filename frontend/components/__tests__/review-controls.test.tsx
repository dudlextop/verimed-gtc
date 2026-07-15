import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ReviewActions, ReviewDialog } from "@/components/signal-review-controls";

describe("закреплённые действия", () => {
  it("показывает все доступные экспертные решения", () => {
    render(<ReviewActions currentStatus="Не проверено" onChoose={vi.fn()}/>);
    expect(screen.getByRole("button", {name: "Направить на углублённую проверку"})).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", {name: "Другие действия"}));
    expect(screen.getByRole("menuitem", {name: "Подтвердить сигнал"})).toBeInTheDocument();
    expect(screen.getByRole("menuitem", {name: "Отклонить сигнал"})).toBeInTheDocument();
    expect(screen.queryByRole("button", {name: "Добавить комментарий"})).not.toBeInTheDocument();
  });

  it("требует комментарий при отклонении", () => {
    render(<ReviewDialog choice={{status: "Сигнал не подтверждён"}} saving={false} onCancel={vi.fn()} onSave={vi.fn()}/>);
    expect(screen.getByRole("button", {name: "Сохранить решение"})).toBeDisabled();
  });

  it("закрывает диалог клавишей Escape", () => {
    const cancel = vi.fn();
    render(<ReviewDialog choice={{status: "Подтверждён сигнал"}} saving={false} onCancel={cancel} onSave={vi.fn()}/>);
    fireEvent.keyDown(window, {key: "Escape"});
    expect(cancel).toHaveBeenCalledOnce();
  });
});
