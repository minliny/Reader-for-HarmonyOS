/** Rendered paper displacement in vp, independent of stage size or pointer acceleration. */
export function readerPaperPullOffset(rawY: number): number {
  return Number.isFinite(rawY) ? 86 * (1 - Math.exp(-Math.max(rawY, 0) / 115)) : 0;
}
