import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "@/lib/api";

describe("адрес API", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ analysis: {}, priority: {}, metrics: [] }),
    }));
  });

  it("по умолчанию использует относительный префикс /api", async () => {
    await api.summary();
    expect(fetch).toHaveBeenCalledWith(
      "/api/analytics/summary",
      expect.objectContaining({ cache: "no-store" }),
    );
  });
});
