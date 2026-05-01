/**
 * Time formatting helpers for replay-mode UI (US-2-003).
 *
 * `formatTimeNs` mirrors the prototype `fmtTime` helper used in
 * public/app/shell.jsx replay strip, formatting nanosecond timestamps
 * (passed as decimal-string per spec §10 timestampNs convention) into
 * MM:SS.mmm display form.
 */

/**
 * Format a nanosecond timestamp string as MM:SS.mmm.
 *
 * Accepts `'0'` through arbitrarily long decimal-strings; clamps negative
 * inputs to zero. Non-finite parses fall back to `'00:00.000'`.
 */
export function formatTimeNs(ns: string): string {
  // Parse as Number — for our 60-second fixture this never exceeds Number.MAX_SAFE_INTEGER.
  const raw = Number(ns);
  if (!Number.isFinite(raw) || raw < 0) return '00:00.000';
  const totalMs = Math.floor(raw / 1_000_000);
  const mm = Math.floor(totalMs / 60_000);
  const ss = Math.floor((totalMs % 60_000) / 1000);
  const ms = totalMs % 1000;
  const pad2 = (n: number) => (n < 10 ? `0${n}` : String(n));
  const pad3 = (n: number) => (n < 10 ? `00${n}` : n < 100 ? `0${n}` : String(n));
  return `${pad2(mm)}:${pad2(ss)}.${pad3(ms)}`;
}
