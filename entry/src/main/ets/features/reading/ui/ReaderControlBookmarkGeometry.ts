import { readerControlActor as actor, readerControlLerp as lerp, readerControlUnit as unit,
  type ReaderControlActorFrame } from './ReaderControlActorGeometry.ts';

export interface ReaderControlBookmarkFrame {
  card: ReaderControlActorFrame;
  title: ReaderControlActorFrame;
  accent: ReaderControlActorFrame;
  excerpt: ReaderControlActorFrame;
  divider: ReaderControlActorFrame;
}
export interface ReaderControlBookmarkNaturalSize {
  titleHeightVp: number;
  excerptHeightVp: number;
}

/** Restored 1841:3781..3790, all coordinates inside the real clipped card.
 * M-02 overrides Title SCALE .857->1: native text stays at Full font/line size.
 * The title box reflows to the current card for existing position/time metadata;
 * other source actor position/size tracks remain unchanged. No local clock.
 */
export function sampleReaderControlBookmark(progress: number, availableWidth: number,
  natural?: ReaderControlBookmarkNaturalSize): ReaderControlBookmarkFrame {
  const p = unit(progress);
  const sourceWidth = lerp(254, 316, p);
  const width = Number.isFinite(availableWidth) ? Math.max(0, availableWidth) : sourceWidth;
  const delta = width - sourceWidth;
  const titleY = lerp(7, 9, p);
  const titleHeight = natural === undefined ? 14 : Math.max(14, natural.titleHeightVp);
  const excerptY = natural === undefined ? lerp(23, 32, p) : titleY + titleHeight + lerp(2, 9, p);
  const excerptHeight = natural === undefined ? lerp(24, 28, p) : Math.max(lerp(24, 28, p), natural.excerptHeightVp);
  const cardHeight = natural === undefined ? lerp(54, 74, p) :
    Math.max(lerp(54, 74, p), excerptY + excerptHeight + lerp(7, 14, p));
  return {
    card: actor(0, 0, width, cardHeight),
    title: actor(lerp(8, 10, p), titleY, Math.max(0, width - 20), titleHeight),
    accent: actor(lerp(8, 10, p), natural === undefined ? lerp(23, 33, p) : excerptY, 1, excerptHeight),
    excerpt: actor(lerp(24, 28, p), excerptY, Math.max(0, lerp(222, 278, p) + delta), excerptHeight),
    divider: actor(lerp(8, 10, p), cardHeight - 1, Math.max(0, lerp(238, 296, p) + delta), 1),
  };
}
