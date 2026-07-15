import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  Button,
  BrandLogo,
  DataTableCell,
  DataTableRow,
  DataTableShell,
  DomainIndicator,
  EmptyState,
  ExportAction,
  FilterBar,
  ActiveFilterChip,
  OverflowActions,
  PageSkeleton,
} from "@/components/foundation";

describe("foundation Verimed V2", () => {
  it("использует утверждённый логотип с доступным названием", () => {
    render(<BrandLogo />);
    expect(screen.getByAltText("Verimed")).toHaveAttribute("src", expect.stringContaining("verimed-logo%402x.png"));
  });

  it("сохраняет высоту и видимый focus у кнопок", () => {
    render(<div><Button>Продолжить</Button><Button size="compact">Компактная</Button><Button size="icon" aria-label="Открыть" /></div>);
    expect(screen.getByRole("button", { name: "Продолжить" })).toHaveClass("min-h-11", "focus-visible:ring-2");
    expect(screen.getByRole("button", { name: "Компактная" })).toHaveClass("min-h-10", "max-sm:min-h-11");
    expect(screen.getByRole("button", { name: "Открыть" })).toHaveClass("h-11", "w-11");
  });

  it("показывает все состояния интерфейса ExportAction без запуска экспорта", () => {
    render(<div><ExportAction state="idle"/><ExportAction state="loading"/><ExportAction state="success"/><ExportAction state="error"/><ExportAction state="disabled"/></div>);
    expect(screen.getByRole("button", { name: "Экспортировать" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Подготовка…" })).toBeDisabled();
    expect(screen.getByText("Экспорт подготовлен")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Не удалось подготовить файл");
    expect(screen.getByRole("button", { name: "Экспорт недоступен" })).toBeDisabled();
  });

  it("раскрывает дополнительные фильтры и сбрасывает активные", () => {
    const reset = vi.fn();
    render(<FilterBar primary={<label>Статус<select><option>Все</option></select></label>} advanced={<label>Организация<input /></label>} activeCount={1} onResetAll={reset} />);
    const disclosure = screen.getByRole("button", { name: "Дополнительные фильтры (1)" });
    expect(disclosure).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(disclosure);
    expect(disclosure).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Организация")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Сбросить все" }));
    expect(reset).toHaveBeenCalledOnce();
  });

  it("сохраняет мобильный touch target удаления фильтра", () => {
    render(<ActiveFilterChip filter={{ id: "status", label: "Без решения", onRemove: vi.fn() }} />);
    expect(screen.getByRole("button", { name: "Удалить фильтр «Без решения»" })).toHaveClass("max-sm:h-11", "max-sm:w-11");
  });

  it("не показывает декоративную сортировку у неработающей колонки", () => {
    const sort = vi.fn();
    render(
      <DataTableShell columns={[{ id: "priority", label: "Приоритет", sortable: true, onSort: sort }, { id: "organization", label: "Организация", sortable: true }]}>
        <DataTableRow selected><DataTableCell>95</DataTableCell><DataTableCell>Организация</DataTableCell></DataTableRow>
      </DataTableShell>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Сортировать по столбцу «Приоритет»" }));
    expect(sort).toHaveBeenCalledOnce();
    expect(screen.queryByRole("button", { name: "Сортировать по столбцу «Организация»" })).not.toBeInTheDocument();
    expect(screen.getByRole("row", { name: /95 Организация/ })).toHaveAttribute("aria-selected", "true");
  });

  it("различает показатели структурой, а не только цветом", () => {
    const { container } = render(<div><DomainIndicator kind="priority" level="Высокий" value={91}/><DomainIndicator kind="risk" level="Высокий" value={88}/><DomainIndicator kind="importance" level="Высокая" value={93}/><DomainIndicator kind="stability" level="Высокая" value={87}/><DomainIndicator kind="reviewStatus" level="На рассмотрении"/></div>);
    expect(container.querySelectorAll("[data-domain-indicator]")).toHaveLength(5);
    expect(container.querySelector('[data-domain-indicator="priority"]')).toHaveTextContent("Приоритет");
    expect(container.querySelector('[data-domain-indicator="risk"]')).toHaveTextContent("Риск");
    expect(container.querySelector('[data-domain-indicator="stability"]')).toHaveTextContent("Устойчивость");
  });

  it("ограничивает EmptyState одним действием через API компонента", () => {
    render(<EmptyState variant="history" title="История отсутствует" description="Объект обнаружен впервые." action={<Button variant="secondary">Перейти к проверке</Button>} />);
    expect(screen.getByText("История отсутствует")).toBeInTheDocument();
    expect(screen.getAllByRole("button")).toHaveLength(1);
  });

  it("предоставляет геометрию загрузки для всех типов страниц", () => {
    render(<>{(["dashboard", "list", "detail", "journal", "overview"] as const).map((variant) => <PageSkeleton key={variant} variant={variant} />)}</>);
    for (const variant of ["dashboard", "list", "detail", "journal", "overview"]) expect(document.querySelector(`[data-skeleton="${variant}"]`)).toBeInTheDocument();
  });

  it("поддерживает клавиатурное закрытие overflow-меню", () => {
    render(<OverflowActions items={[{ id: "comment", label: "Добавить комментарий", onSelect: vi.fn() }]} />);
    const trigger = screen.getByRole("button", { name: "Другие действия" });
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("menu")).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(trigger).toHaveFocus();
  });

  it("переводит фокус в overflow-меню и перемещает его стрелками", async () => {
    render(<OverflowActions items={[
      { id: "comment", label: "Добавить комментарий", onSelect: vi.fn() },
      { id: "history", label: "Открыть историю", onSelect: vi.fn() },
    ]} />);
    fireEvent.click(screen.getByRole("button", { name: "Другие действия" }));
    await waitFor(() => expect(screen.getByRole("menuitem", { name: "Добавить комментарий" })).toHaveFocus());
    fireEvent.keyDown(screen.getByRole("menu"), { key: "ArrowDown" });
    expect(screen.getByRole("menuitem", { name: "Открыть историю" })).toHaveFocus();
  });

  it("скрывает неработающие overflow-пункты и выполняет async action", async () => {
    let resolveAction: (() => void) | undefined;
    const action = vi.fn(() => new Promise<void>((resolve) => { resolveAction = resolve; }));
    render(<OverflowActions items={[
      { id: "working", label: "Рабочее действие", onSelect: action },
      { id: "placeholder", label: "Неработающая заглушка" },
    ]} />);
    fireEvent.click(screen.getByRole("button", { name: "Другие действия" }));
    expect(screen.queryByText("Неработающая заглушка")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("menuitem", { name: "Рабочее действие" }));
    expect(screen.getByRole("menuitem", { name: "Рабочее действие" })).toHaveAttribute("aria-busy", "true");
    resolveAction?.();
    await waitFor(() => expect(screen.queryByRole("menu")).not.toBeInTheDocument());
    expect(action).toHaveBeenCalledOnce();
  });

  it("управляет состояниями ExportAction для async callback", async () => {
    let resolveAction: (() => void) | undefined;
    render(<ExportAction scopeLabel="Текущая выборка" onAction={() => new Promise<void>((resolve) => { resolveAction = resolve; })} />);
    fireEvent.click(screen.getByRole("button", { name: /Экспортировать/ }));
    expect(screen.getByRole("button", { name: "Подготовка…" })).toBeDisabled();
    resolveAction?.();
    await screen.findByRole("button", { name: "Экспорт подготовлен" });
  });
});
