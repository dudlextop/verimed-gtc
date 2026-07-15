"use client";

import * as React from "react";

export function selectionFilterSignature(params: URLSearchParams | string): string {
  const source = typeof params === "string" ? new URLSearchParams(params) : params;
  const entries = Array.from(source.entries())
    .filter(([key]) => !["page", "page_size", "signal"].includes(key))
    .sort(([leftKey, leftValue], [rightKey, rightValue]) =>
      leftKey.localeCompare(rightKey) || leftValue.localeCompare(rightValue),
    );
  return new URLSearchParams(entries).toString();
}

export function useScopedSelection(
  filterSignature: string,
  onCleared?: (message: string) => void,
) {
  const [selectedIds, setSelectedIds] = React.useState<number[]>([]);
  const previousSignature = React.useRef(filterSignature);

  React.useEffect(() => {
    if (previousSignature.current === filterSignature) return;
    previousSignature.current = filterSignature;
    setSelectedIds((current) => {
      if (current.length) onCleared?.("Выбор очищен после изменения фильтров");
      return [];
    });
  }, [filterSignature, onCleared]);

  const toggle = React.useCallback((id: number) => {
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  }, []);

  const setPageSelection = React.useCallback((pageIds: number[], selected: boolean) => {
    setSelectedIds((current) =>
      selected
        ? [...new Set([...current, ...pageIds])]
        : current.filter((id) => !pageIds.includes(id)),
    );
  }, []);

  const clear = React.useCallback(() => setSelectedIds([]), []);

  return { selectedIds, toggle, setPageSelection, clear, setSelectedIds };
}
