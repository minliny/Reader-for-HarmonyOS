export type ReaderWidthClass = 'compact' | 'expanded';

/** Single app-wide width breakpoint. Pages must not redeclare 600 locally. */
export const READER_EXPANDED_MIN_WIDTH: number = 600;

export function readerWidthClass(viewportWidth: number): ReaderWidthClass {
  return Number.isFinite(viewportWidth) && viewportWidth >= READER_EXPANDED_MIN_WIDTH ? 'expanded' : 'compact';
}

/** Reading may start before a viewport measurement is available. */
export function readerWidthClassWithHint(viewportWidth: number, expandedHint: boolean): ReaderWidthClass {
  if (Number.isFinite(viewportWidth) && viewportWidth > 0) return readerWidthClass(viewportWidth);
  return expandedHint ? 'expanded' : 'compact';
}

export function readerIsExpandedWidth(viewportWidth: number): boolean {
  return readerWidthClass(viewportWidth) === 'expanded';
}
