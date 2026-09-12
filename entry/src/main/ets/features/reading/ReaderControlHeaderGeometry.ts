import { readerControlActor, readerControlUnit, type ReaderControlActorFrame } from './ReaderControlActorGeometry.ts';

/** Header-local coordinate adapter, not another motion owner.
 * Search 1938:5075 and AutoPage 1938:7519 are under their fractional
 * UnifiedSheetSurface (14,20), unlike the other root-level FullHeaders.
 * Their source TY18→0 is independent of the common shell translation. The
 * Stage already owns opacity=p, so the child must not multiply p again.
 */
export function readerControlHeaderFrame(module: string | undefined, p: number,
  availableWidth: number): ReaderControlActorFrame {
  const width = Number.isFinite(availableWidth) ? Math.max(0, availableWidth) : 338;
  if (module !== 'search' && module !== 'autoPage') return readerControlActor(0, 0, width, 30);
  const remaining = 1 - readerControlUnit(p);
  return readerControlActor(1 - .448 * remaining, 1 + 18.443 * remaining,
    Math.max(0, width - 2), 30);
}
