import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useFileDownload } from "@/hooks/use-file-download";
import { selectionFilterSignature, useScopedSelection } from "@/hooks/use-scoped-selection";

describe("data/actions hooks", () => {
  afterEach(() => vi.restoreAllMocks());

  it("строит стабильную подпись фильтров без page и signal", () => {
    expect(selectionFilterSignature("page=2&region=Алматы&signal=7&levels=Высокий")).toBe(
      "levels=%D0%92%D1%8B%D1%81%D0%BE%D0%BA%D0%B8%D0%B9&region=%D0%90%D0%BB%D0%BC%D0%B0%D1%82%D1%8B",
    );
  });

  it("сохраняет выбор между страницами и очищает при смене фильтра", () => {
    const cleared = vi.fn();
    const { result, rerender } = renderHook(
      ({ signature }) => useScopedSelection(signature, cleared),
      { initialProps: { signature: "region=Алматы" } },
    );
    act(() => result.current.setPageSelection([1, 2], true));
    expect(result.current.selectedIds).toEqual([1, 2]);
    rerender({ signature: "region=Алматы" });
    expect(result.current.selectedIds).toEqual([1, 2]);
    rerender({ signature: "region=Астана" });
    expect(result.current.selectedIds).toEqual([]);
    expect(cleared).toHaveBeenCalledWith("Выбор очищен после изменения фильтров");
  });

  it("отменяет активное скачивание при размонтировании", async () => {
    const fetchMock = vi.fn((_: RequestInfo | URL, init?: RequestInit) => new Promise<Response>((_, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
    }));
    vi.stubGlobal("fetch", fetchMock);
    const { result, unmount } = renderHook(() => useFileDownload());
    let request: Promise<unknown> | undefined;
    act(() => {
      request = result.current.run({ path: "/exports/signals.csv", fallbackFilename: "signals.csv" });
    });
    expect(result.current.state).toBe("loading");
    unmount();
    await expect(request).resolves.toBeNull();
    const signal = fetchMock.mock.calls[0]?.[1]?.signal;
    expect(signal?.aborted).toBe(true);
  });
});
