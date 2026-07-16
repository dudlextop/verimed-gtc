import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import MethodologyPage from "@/app/methodology/page";
import { api } from "@/lib/api";
import type { Methodology } from "@/lib/types";

vi.mock("@/lib/api", () => ({ api: { methodology: vi.fn() } }));

const methodology: Methodology = {
  title: "Методика анализа",
  introduction: "Verimed формирует объяснимую оценку риска.",
  sections: [
    { title: "Проверяемые отклонения", description: "Проверяются фактические отклонения.", items: ["Отклонение стоимости"] },
    { title: "Сопоставимые группы", description: "Организации сравниваются внутри групп.", items: ["Группы формируются по региону"] },
    { title: "Формирование оценки", description: "Оценка рассчитывается по прозрачной формуле.", items: ["55% — сигналы проверок"] },
    { title: "Качество текущего анализа", description: "Качество рассчитано по эталонной разметке.", items: ["F1-мера: 87,2%"] },
    { title: "Роль специалиста", description: "Финальное решение принимает специалист.", items: ["Решение фиксируется с комментарием"] },
  ],
  disclaimer: "Сигнал не является доказательством несоответствия. Финальный вывод делает специалист.",
};

describe("методика анализа", () => {
  beforeEach(() => vi.mocked(api.methodology).mockResolvedValue(methodology));

  it("показывает четыре последовательных этапа и фактический API-контент", async () => {
    render(<MethodologyPage />);
    expect(await screen.findByRole("heading", { name: "Методика анализа" })).toBeInTheDocument();
    for (const stage of ["Подготовка и сопоставление данных", "Выявление проверяемых отклонений", "Формирование оценки", "Экспертная проверка и решение"]) {
      expect(screen.getByRole("heading", { name: stage })).toBeInTheDocument();
    }
    expect(screen.getByText("F1-мера: 87,2%")).toBeInTheDocument();
    expect(screen.getByText(methodology.disclaimer)).toBeInTheDocument();
  });

  it("раскрывает подробности этапа с клавиатурно доступным summary", async () => {
    render(<MethodologyPage />);
    const disclosures = await screen.findAllByText("Подробности этапа");
    fireEvent.click(disclosures[0]);
    expect(screen.getByText("Группы формируются по региону")).toBeVisible();
  });

  it("не добавляет формулы, отсутствующие в ответе API", async () => {
    render(<MethodologyPage />);
    await screen.findByRole("heading", { name: "Методика анализа" });
    expect(screen.queryByText(/Isolation Forest/)).not.toBeInTheDocument();
    expect(screen.queryAllByText("55% — сигналы проверок")).toHaveLength(1);
  });

  it("показывает понятную ошибку загрузки без технических деталей", async () => {
    vi.mocked(api.methodology).mockRejectedValueOnce(new Error("network"));
    render(<MethodologyPage />);
    expect(await screen.findByText("Не удалось загрузить методику")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Повторить" })).toBeInTheDocument();
  });
});
