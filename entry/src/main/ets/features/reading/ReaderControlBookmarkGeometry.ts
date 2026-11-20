import { readerControlActor as actor, readerControlLerp as lerp, readerControlUnit as unit,
  type ReaderControlActorFrame } from './ReaderControlActorGeometry.ts';

export interface ReaderControlBookmarkFrame {
  card: ReaderControlActorFrame;
  title: ReaderControlActorFrame;
  accent: ReaderControlActorFrame;
  excerpt: ReaderControlActorFrame;
  divider: ReaderControlActorFrame;
  metadata: ReaderControlActorFrame;
}

/** Restored 1841:3781..3790, all coordinates inside the real clipped card.
 * M-02 overrides Title SCALE .857->1: native text stays at Full font/line size.
 * The title box reflows to the current card for existing position/time metadata;
 * other source actor position/size tracks remain unchanged. No local clock.
 */
export function sampleReaderControlBookmark(progress: number, availableWidth: number, fontScale: number = 1): ReaderControlBookmarkFrame {
  const p = unit(progress);
  const scale = Number.isFinite(fontScale) ? Math.max(1, fontScale) : 1;
  const metadataHeight = scale > 1.3 ? 14 * scale + 4 : 0;
  const sourceWidth = lerp(254, 316, p);
  const width = Number.isFinite(availableWidth) ? Math.max(0, availableWidth) : sourceWidth;
  const delta = width - sourceWidth;
  return {
    card: actor(0, 0, width, lerp(54, 74, p) * scale + metadataHeight),
    title: actor(lerp(8, 10, p), lerp(7, 9, p) * scale, Math.max(0, width - 20), 14 * scale),
    metadata: actor(lerp(8, 10, p), (lerp(7, 9, p) + 14) * scale + 2,
      Math.max(0, width - 20), metadataHeight > 0 ? 14 * scale : 0),
    accent: actor(lerp(8, 10, p), lerp(23, 33, p) * scale + metadataHeight, 1, lerp(24, 28, p) * scale),
    excerpt: actor(lerp(24, 28, p), lerp(23, 32, p) * scale + metadataHeight, Math.max(0, lerp(222, 278, p) + delta), lerp(24, 28, p) * scale),
    divider: actor(lerp(8, 10, p), lerp(53, 73, p) * scale + metadataHeight, Math.max(0, lerp(238, 296, p) + delta), 1),
  };
}
