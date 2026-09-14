import type { ReaderControlSearchScrollLayout, ReaderControlSearchScrollProjection } from './ReaderControlSearchScroll';

/** Internal native coordinate ruler, not a visual row/font size. Keeping it
 * fixed avoids resetting AceList's ChildrenMainSize/PosMap at every morph tick.
 * Actual rows retain the authored 54→72vp height and unchanged typography. */
export const READER_SEARCH_LIST_ITEM_HEIGHT = 72;
export const READER_SEARCH_LIST_CACHE_COUNT = 2;

export interface ReaderControlSearchListProjection {
  viewportHeightVp: number;
  targetOffsetVp: number;
  maxOffsetVp: number;
  contentEndOffsetVp: number;
  visualToNativeRatio: number;
}

export function readerControlSearchListProjection(layout: ReaderControlSearchScrollLayout,
  scroll: ReaderControlSearchScrollProjection): ReaderControlSearchListProjection {
  const ratio = Number.isFinite(layout.rowHeightVp) && layout.rowHeightVp > 0 ?
    READER_SEARCH_LIST_ITEM_HEIGHT / layout.rowHeightVp : 1;
  const viewport = Math.max(0, layout.viewportHeightVp) * ratio;
  const end = Math.max(0, (layout.contentOriginVp ?? 0) + (layout.contentEndPaddingVp ?? 0)) * ratio;
  return { viewportHeightVp: viewport, targetOffsetVp: scroll.offsetVp * ratio,
    maxOffsetVp: scroll.maxOffsetVp * ratio,
    // Native List rejects negative offsets and clears offsets >= viewport.
    // Negative origin shortens the legal range in the existing scroll policy;
    // the input adapter clamps against maxOffsetVp instead of negative padding.
    contentEndOffsetVp: viewport > end ? end : 0,
    visualToNativeRatio: ratio };
}

export function readerControlSearchListRowTranslation(index: number, layout: ReaderControlSearchScrollLayout,
  scroll: ReaderControlSearchScrollProjection, nativeOffsetVp: number): number {
  // Native layout: i*72-B. Combined paint: origin+i*H-O exactly, including
  // fractional/negative origins and a late native offset receipt.
  return (layout.contentOriginVp ?? 0) + index * (layout.rowHeightVp - READER_SEARCH_LIST_ITEM_HEIGHT) +
    nativeOffsetVp - scroll.offsetVp;
}

export function readerControlSearchListScrollDelta(nativeOffsetVp: number, deltaVp: number,
  maxOffsetVp: number): number {
  if (!Number.isFinite(nativeOffsetVp) || !Number.isFinite(deltaVp) || !Number.isFinite(maxOffsetVp)) return 0;
  const base = Math.max(0, nativeOffsetVp);
  return Math.min(Math.max(0, maxOffsetVp), Math.max(0, base + deltaVp)) - base;
}
