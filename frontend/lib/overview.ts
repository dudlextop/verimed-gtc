export function isAnalysisStale(value: string | null, now = Date.now()): boolean {
  if (!value) return true;
  const timestamp = new Date(value).getTime();
  return !Number.isFinite(timestamp) || now - timestamp > 7 * 24 * 60 * 60 * 1000;
}
