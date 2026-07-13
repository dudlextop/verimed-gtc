import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useDebouncedValue } from "@/hooks/use-debounced-value";

describe("отложенный поиск", () => {
  afterEach(() => vi.useRealTimers());

  it("не меняет значение до окончания паузы", () => {
    vi.useFakeTimers();
    const {result, rerender} = renderHook(
      ({value}) => useDebouncedValue(value, 350),
      {initialProps: {value: "томография"}},
    );
    rerender({value: "томография грудной клетки"});
    expect(result.current).toBe("томография");
    act(() => vi.advanceTimersByTime(349));
    expect(result.current).toBe("томография");
    act(() => vi.advanceTimersByTime(1));
    expect(result.current).toBe("томография грудной клетки");
  });
});
