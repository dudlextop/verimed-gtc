import { describe, expect, it } from "vitest";
import { adjacentIds, contextHref, parseOrderedIds, queueScrollKey } from "@/lib/work-context";

describe("контекст рабочего списка", () => {
  it("сохраняет маршрут возврата и порядок объектов", () => {
    const href = contextHref("/signals/10", "/signals?priority_level=Высокий&page=2", [9, 10, 11]);
    expect(href).toContain("returnTo=%2Fsignals%3Fpriority_level%3D%D0%92%D1%8B%D1%81%D0%BE%D0%BA%D0%B8%D0%B9%26page%3D2");
    expect(parseOrderedIds(new URLSearchParams(href.split("?")[1]).get("queueIds"))).toEqual([9, 10, 11]);
    expect(adjacentIds([9, 10, 11], 10)).toEqual({previousId: 9, nextId: 11});
  });

  it("создаёт отдельный ключ позиции для каждого состояния очереди", () => {
    expect(queueScrollKey("/signals?page=2")).not.toBe(queueScrollKey("/signals?page=3"));
  });
});
