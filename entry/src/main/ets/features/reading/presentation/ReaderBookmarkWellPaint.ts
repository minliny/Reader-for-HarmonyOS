export const READER_BOOKMARK_WELL_TINT_DAY = '#172B241D';
export const READER_BOOKMARK_WELL_TINT_NIGHT = '#57000000';
export const READER_BOOKMARK_WELL_BLEED_VP = 18;
export const READER_BOOKMARK_WELL_FADE_RANGE_VP = 10;

export function readerBookmarkWellTint(day: boolean): string {
  return day ? READER_BOOKMARK_WELL_TINT_DAY : READER_BOOKMARK_WELL_TINT_NIGHT;
}

export function readerBookmarkWellOpacity(offset: number): number {
  if (!Number.isFinite(offset) || offset <= 0) return 0;
  return Math.min(1, offset / READER_BOOKMARK_WELL_FADE_RANGE_VP);
}

export function readerBookmarkWellHeight(paperTop: number, offset: number): number {
  const top = Number.isFinite(paperTop) && paperTop > 0 ? paperTop : 0;
  const pull = Number.isFinite(offset) && offset > 0 ? offset : 0;
  return top + pull + READER_BOOKMARK_WELL_BLEED_VP;
}
