/** Page-owned bookmark presentation facts. Business writes and acknowledgements
 * remain owned by LocalReadingExperience; this model only crosses render slots. */
export type ReaderPageBookmarkMode = 'hidden' | 'filled' | 'outline';

export const READER_BOOKMARK_TRIGGER_VP = 46;
export const READER_BOOKMARK_RIBBON_WIDTH = 16;
export const READER_BOOKMARK_RIBBON_HEIGHT = 34;
export const READER_BOOKMARK_RIBBON_REST_Y = -13;
export const READER_BOOKMARK_RIBBON_HIDDEN_Y = -READER_BOOKMARK_RIBBON_HEIGHT;

export class ReaderBookmarkRibbonFrame {
  y: number;
  fillHeight: number;
  opacity: number;

  constructor(y: number, fillHeight: number, opacity: number) {
    this.y = y;
    this.fillHeight = fillHeight;
    this.opacity = opacity;
  }
}

export function readerBookmarkRibbonRest(bookmarked: boolean, reduceMotion: boolean = false): ReaderBookmarkRibbonFrame {
  return new ReaderBookmarkRibbonFrame(bookmarked || reduceMotion ? READER_BOOKMARK_RIBBON_REST_Y :
    READER_BOOKMARK_RIBBON_HIDDEN_Y, bookmarked ? READER_BOOKMARK_RIBBON_HEIGHT : 0, bookmarked ? 1 : 0);
}

export function readerBookmarkRibbonPull(offset: number, bookmarked: boolean, reduceMotion: boolean): ReaderBookmarkRibbonFrame {
  if (offset <= 0) return readerBookmarkRibbonRest(bookmarked, reduceMotion);
  const progress = Math.min(1, offset / READER_BOOKMARK_TRIGGER_VP);
  const y = bookmarked ? READER_BOOKMARK_RIBBON_REST_Y - progress * 9 :
    Math.min(0, READER_BOOKMARK_RIBBON_HIDDEN_Y + offset);
  const fillHeight = READER_BOOKMARK_RIBBON_HEIGHT * (bookmarked ? 1 - progress : progress);
  const opacity = bookmarked ? 1 - progress * 0.42 : Math.min(1, (offset / 8) * (0.35 + progress * 0.65));
  if (reduceMotion) {
    return new ReaderBookmarkRibbonFrame(READER_BOOKMARK_RIBBON_REST_Y, bookmarked ?
      READER_BOOKMARK_RIBBON_HEIGHT : 0, opacity);
  }
  return new ReaderBookmarkRibbonFrame(y, fillHeight, opacity);
}

export function readerBookmarkHintAlpha(offset: number): number {
  return Math.max(0, Math.min(0.92, (offset - 10) / 24));
}

export class ReaderPageBookmarkSnapshot {
  mode: ReaderPageBookmarkMode;
  opacity: number;
  topAccessoryX: number;
  topAccessoryY: number;
  topAccessoryWidth: number;
  topAccessoryHeight: number;

  constructor(
    mode: ReaderPageBookmarkMode = 'hidden',
    opacity: number = 0,
    topAccessoryX: number = 0,
    topAccessoryY: number = 0,
    topAccessoryWidth: number = 0,
    topAccessoryHeight: number = 0,
  ) {
    this.mode = mode;
    this.opacity = Number.isFinite(opacity) ? Math.max(0, Math.min(1, opacity)) : 0;
    this.topAccessoryX = finiteLength(topAccessoryX);
    this.topAccessoryY = finiteLength(topAccessoryY);
    this.topAccessoryWidth = finiteLength(topAccessoryWidth);
    this.topAccessoryHeight = finiteLength(topAccessoryHeight);
  }
}

function finiteLength(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : 0;
}
