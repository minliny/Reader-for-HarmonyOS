import { readerControlActor, readerControlUnit, type ReaderControlActorFrame } from './ReaderControlActorGeometry.ts';
import type { ReaderControlMotionFrame } from './ReaderControlMotionGeometry.ts';

/** Header-local coordinate adapter, not another motion owner.
 * Search 1938:5075 and AutoPage 1938:7519 are under their fractional
 * UnifiedSheetSurface (14,20), unlike the other root-level FullHeaders.
 * Their source TY18→0 is independent of the common shell translation. The
 * Stage already owns opacity=p, so the child must not multiply p again.
 */
export function readerControlHeaderFrame(module: string | undefined, p: number,
  availableWidth: number, fontScale: number = 1): ReaderControlActorFrame {
  const width = Number.isFinite(availableWidth) ? Math.max(0, availableWidth) : 338;
  if (module === 'directory') return readerControlActor(0, 0, width, 44 + 20 * Math.max(0, fontScale - 1));
  if (module !== 'search' && module !== 'autoPage') return readerControlActor(0, 0, width, 30);
  const remaining = 1 - readerControlUnit(p);
  return readerControlActor(1 - .448 * remaining, 1 + 18.443 * remaining,
    Math.max(0, width - 2), 30);
}

/** The directory's transparent hit carrier uses existing space above the
 * authored header. Only enlarged text consumes extra content height. */
export function readerControlDirectoryFrame(frame: ReaderControlMotionFrame, fontScale: number): ReaderControlMotionFrame {
  const growth = 20 * Math.max(0, Number.isFinite(fontScale) ? fontScale - 1 : 0);
  const shift = growth * frame.progress;
  return { ...frame, header: { ...frame.header, y: frame.header.y - 7, height: 44 + growth },
    content: { ...frame.content, y: frame.content.y + shift, height: Math.max(0, frame.content.height - shift) },
    contentSurface: { ...frame.contentSurface, y: frame.contentSurface.y + growth,
      height: Math.max(0, frame.contentSurface.height - growth) } };
}
