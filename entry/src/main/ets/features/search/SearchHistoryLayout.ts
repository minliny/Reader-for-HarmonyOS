/** Widths come from the platform font measurer, never character counts. */
export function collapsedHistoryCount(widths: number[], availableWidth: number, gap: number = 8): number {
  if (!Number.isFinite(availableWidth) || availableWidth <= 0) return 0;
  let row = 0;
  let used = 0;
  let count = 0;
  for (const measured of widths) {
    const width = Math.min(availableWidth, Math.max(0, measured));
    if (used > 0 && used + gap + width > availableWidth) { row += 1; used = 0; }
    if (row >= 2) break;
    used += (used > 0 ? gap : 0) + width;
    count += 1;
  }
  return count;
}
