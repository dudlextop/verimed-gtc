import { API_URL } from "./api";

export type DownloadNotification = {
  tone: "success" | "error";
  message: string;
};

export type DownloadRequest = {
  path: string;
  method?: "GET" | "POST";
  body?: unknown;
  fallbackFilename: string;
  signal?: AbortSignal;
  notify?: (notification: DownloadNotification) => void;
};

export type DownloadResult = {
  filename: string;
};

export function parseContentDisposition(
  value: string | null,
  fallbackFilename: string,
): string {
  if (!value) return fallbackFilename;
  const encoded = value.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  if (encoded) {
    try {
      return decodeURIComponent(encoded.replace(/^"|"$/g, ""));
    } catch {
      return fallbackFilename;
    }
  }
  const plain = value.match(/filename="([^"]+)"/i)?.[1] ?? value.match(/filename=([^;]+)/i)?.[1];
  return plain?.trim() || fallbackFilename;
}

async function downloadError(response: Response): Promise<Error> {
  const payload = await response.json().catch(() => null) as
    | { detail?: string | { message?: string }; message?: string }
    | null;
  const detail = payload?.detail;
  const message =
    (typeof detail === "string" ? detail : detail?.message) ??
    payload?.message ??
    "Не удалось подготовить файл";
  return new Error(message);
}

export async function downloadFile(request: DownloadRequest): Promise<DownloadResult> {
  const method = request.method ?? "GET";
  const response = await fetch(`${API_URL}${request.path}`, {
    method,
    body: method === "POST" ? JSON.stringify(request.body ?? {}) : undefined,
    headers: method === "POST" ? { "Content-Type": "application/json" } : undefined,
    signal: request.signal,
    cache: "no-store",
  });
  if (!response.ok) {
    const error = await downloadError(response);
    request.notify?.({ tone: "error", message: error.message });
    throw error;
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const error = await downloadError(response);
    request.notify?.({ tone: "error", message: error.message });
    throw error;
  }

  const blob = await response.blob();
  const filename = parseContentDisposition(
    response.headers.get("content-disposition"),
    request.fallbackFilename,
  );
  const objectUrl = URL.createObjectURL(blob);
  try {
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = filename;
    anchor.hidden = true;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
  request.notify?.({ tone: "success", message: "Файл подготовлен" });
  return { filename };
}
