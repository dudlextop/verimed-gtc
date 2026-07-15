"use client";

import * as React from "react";
import {
  downloadFile,
  type DownloadNotification,
  type DownloadRequest,
  type DownloadResult,
} from "@/lib/download";
import type { ExportActionState } from "@/components/foundation";

export function useFileDownload(
  onNotify?: (notification: DownloadNotification) => void,
) {
  const [state, setState] = React.useState<ExportActionState>("idle");
  const [error, setError] = React.useState<string | null>(null);
  const controllerRef = React.useRef<AbortController | null>(null);

  React.useEffect(() => () => controllerRef.current?.abort(), []);

  const cancel = React.useCallback(() => {
    controllerRef.current?.abort();
    controllerRef.current = null;
    setState("idle");
  }, []);

  const run = React.useCallback(
    async (request: Omit<DownloadRequest, "signal" | "notify">): Promise<DownloadResult | null> => {
      controllerRef.current?.abort();
      const controller = new AbortController();
      controllerRef.current = controller;
      setState("loading");
      setError(null);
      try {
        const result = await downloadFile({
          ...request,
          signal: controller.signal,
          notify: onNotify,
        });
        if (controllerRef.current === controller) setState("success");
        return result;
      } catch (caught) {
        if (caught instanceof DOMException && caught.name === "AbortError") {
          if (controllerRef.current === controller) setState("idle");
          return null;
        }
        const message = caught instanceof Error ? caught.message : "Не удалось подготовить файл";
        if (controllerRef.current === controller) {
          setError(message);
          setState("error");
        }
        return null;
      } finally {
        if (controllerRef.current === controller) controllerRef.current = null;
      }
    },
    [onNotify],
  );

  const reset = React.useCallback(() => {
    setState("idle");
    setError(null);
  }, []);

  return { state, error, run, cancel, reset };
}
