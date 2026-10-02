/** Presentation only: phone landscape keeps its image canvas; tablet owns a
 * stable directory column. The image view restores its admitted anchor when
 * this width class changes, never for control visibility changes. */
export function mangaUsesPersistentDirectory(width: number, height: number, deviceIsTablet: boolean): boolean {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width < 600 || height <= 0) return false;
  return deviceIsTablet || width >= 900 || height >= 600;
}

export function mangaDirectoryColumnWidth(width: number): number {
  return Math.min(360, Math.max(320, width * 0.27));
}
