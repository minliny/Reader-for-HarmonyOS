/**
 * Legado-compatible full-page bottom adjustment.
 *
 * A short page keeps its natural top alignment. Only the small residual space
 * left after a page has accepted its last full text line is distributed.
 */
export function readerPageBottomJustifyGap(
  enabled: boolean,
  fragmentCount: number,
  contentHeight: number,
  bodyCapacity: number,
  lastFragmentHeight: number,
  lastFragmentIsImage: boolean,
): number {
  if (!enabled || fragmentCount <= 1 || lastFragmentIsImage || lastFragmentHeight <= 0) {
    return 0;
  }
  const surplus = bodyCapacity - contentHeight;
  if (!Number.isFinite(surplus) || surplus <= 0 || surplus >= lastFragmentHeight) {
    return 0;
  }
  return surplus / (fragmentCount - 1);
}
