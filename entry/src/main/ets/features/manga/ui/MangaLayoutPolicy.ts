import { readerIsExpandedWidth } from '../../../ui/foundation/ReaderWidthClass.ts';

/** Presentation only: phone landscape keeps its image canvas; tablet owns a
 * stable directory column. The image view restores its admitted anchor when
 * this width class changes, never for control visibility changes. */
export function mangaUsesPersistentDirectory(width: number, height: number, deviceIsTablet: boolean): boolean {
  if (!readerIsExpandedWidth(width) || !Number.isFinite(height) || height <= 0) return false;
  return deviceIsTablet || width >= 900 || height >= 600;
}

export function mangaDirectoryColumnWidth(width: number): number {
  return width <= 700 ? 168 : 258;
}
