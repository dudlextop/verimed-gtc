import { beforeEach, describe, expect, it, vi } from "vitest";
import { downloadFile, parseContentDisposition } from "@/lib/download";

describe("клиент скачивания", () => {
  const createObjectURL = vi.fn(() => "blob:verimed-export");
  const revokeObjectURL = vi.fn();

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubGlobal("fetch", vi.fn());
    vi.stubGlobal("URL", { ...URL, createObjectURL, revokeObjectURL });
    createObjectURL.mockClear();
    revokeObjectURL.mockClear();
  });

  it("извлекает обычное и UTF-8 имя файла", () => {
    expect(parseContentDisposition('attachment; filename="signals.csv"', "fallback.csv")).toBe("signals.csv");
    expect(parseContentDisposition("attachment; filename*=UTF-8''%D1%81%D0%B8%D0%B3%D0%BD%D0%B0%D0%BB%D1%8B.csv", "fallback.csv")).toBe("сигналы.csv");
    expect(parseContentDisposition(null, "fallback.csv")).toBe("fallback.csv");
  });

  it("скачивает GET и освобождает object URL", async () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
    vi.mocked(fetch).mockResolvedValue(new Response("\ufeffДанные", {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="verimed-signals.csv"',
      },
    }));

    const result = await downloadFile({ path: "/exports/signals.csv", fallbackFilename: "signals.csv" });

    expect(fetch).toHaveBeenCalledWith("/api/exports/signals.csv", expect.objectContaining({ method: "GET", body: undefined }));
    expect(result.filename).toBe("verimed-signals.csv");
    expect(click).toHaveBeenCalledOnce();
    expect(createObjectURL).toHaveBeenCalledOnce();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:verimed-export");
  });

  it("передаёт выбранные IDs через POST", async () => {
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
    vi.mocked(fetch).mockResolvedValue(new Response("csv", {
      status: 200,
      headers: { "Content-Type": "text/csv" },
    }));

    await downloadFile({
      path: "/exports/signals.csv",
      method: "POST",
      body: { signal_ids: [3, 7] },
      fallbackFilename: "selected.csv",
    });

    expect(fetch).toHaveBeenCalledWith(
      "/api/exports/signals.csv",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ signal_ids: [3, 7] }),
        headers: { "Content-Type": "application/json" },
      }),
    );
  });

  it("показывает структурированную JSON-ошибку вместо CSV", async () => {
    const notify = vi.fn();
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({
      detail: { message: "Сузьте фильтры до 5 000 строк" },
    }), {
      status: 413,
      headers: { "Content-Type": "application/json" },
    }));

    await expect(downloadFile({
      path: "/exports/signals.csv",
      fallbackFilename: "signals.csv",
      notify,
    })).rejects.toThrow("Сузьте фильтры до 5 000 строк");
    expect(notify).toHaveBeenCalledWith({ tone: "error", message: "Сузьте фильтры до 5 000 строк" });
    expect(createObjectURL).not.toHaveBeenCalled();
  });

  it("передаёт AbortSignal в fetch", async () => {
    const controller = new AbortController();
    vi.mocked(fetch).mockImplementation((_, init) => new Promise((_, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
    }));
    const promise = downloadFile({
      path: "/exports/signals.csv",
      fallbackFilename: "signals.csv",
      signal: controller.signal,
    });
    controller.abort();
    await expect(promise).rejects.toMatchObject({ name: "AbortError" });
  });
});
