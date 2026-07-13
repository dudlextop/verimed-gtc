export const QUEUE_SCROLL_PREFIX = "verimed:queue-scroll:";

export function contextHref(
  pathname: string,
  returnTo: string,
  orderedIds: number[],
): string {
  const params = new URLSearchParams();
  params.set("returnTo", returnTo);
  if (orderedIds.length) params.set("queueIds", orderedIds.join(","));
  return `${pathname}?${params.toString()}`;
}

export function parseOrderedIds(value: string | null): number[] {
  if (!value) return [];
  return value.split(",").map(Number).filter((item) => Number.isInteger(item) && item > 0);
}

export function adjacentIds(ids: number[], currentId: number): {previousId: number | null; nextId: number | null} {
  const index = ids.indexOf(currentId);
  if (index < 0) return {previousId: null, nextId: null};
  return {previousId: index > 0 ? ids[index - 1] : null, nextId: index < ids.length - 1 ? ids[index + 1] : null};
}

export function queueScrollKey(queueUrl: string): string {
  return `${QUEUE_SCROLL_PREFIX}${queueUrl}`;
}
