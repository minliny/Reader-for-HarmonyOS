import { readerIsExpandedWidth } from '../common/ReaderWidthClass.ts';

/** Presentation only: a compact-width landscape keeps its image canvas; an
 * expanded-width, tablet-like viewport owns a stable directory column. The
 * image view restores its admitted anchor when this capability changes, never
 * for control visibility changes. */
export function mangaUsesPersistentDirectory(width: number, height: number): boolean {
  if (!Number.isFinite(width) || !Number.isFinite(height) || !readerIsExpandedWidth(width) || height <= 0) return false;
  return width >= 900 || height >= 600;
}

export function mangaDirectoryColumnWidth(width: number): number {
  return width <= 700 ? 168 : 258;
}
