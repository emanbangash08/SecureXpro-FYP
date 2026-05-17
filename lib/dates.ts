/**
 * Date helpers for backend timestamps.
 *
 * Backend stores datetimes as timezone-aware UTC, but MongoDB strips tzinfo
 * on read, so the API returns naive ISO strings like "2026-05-17T17:09:28".
 * JavaScript's `new Date(iso)` parses those as **local time**, which makes
 * "X ago" wildly wrong for anyone not in UTC (the source of the "queued 5h
 * ago" bug right after a scan was created).
 *
 * `parseServerDate` coerces naive strings to UTC. Always use these helpers
 * — never `new Date(api_value)` directly.
 */

export function parseServerDate(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  // Already has a timezone offset (Z or ±HH:MM)? Trust it.
  const hasTz = /Z$|[+\-]\d{2}:?\d{2}$/.test(iso);
  return new Date(hasTz ? iso : iso + "Z");
}

export function fmtTime(iso: string | null | undefined): string {
  const d = parseServerDate(iso);
  return d ? d.toLocaleString() : "—";
}

export function fmtDate(iso: string | null | undefined): string {
  const d = parseServerDate(iso);
  return d ? d.toLocaleDateString() : "—";
}

export function shortAgo(iso: string | null | undefined): string {
  const d = parseServerDate(iso);
  if (!d) return "never";
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return `${Math.floor(diff)}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}
