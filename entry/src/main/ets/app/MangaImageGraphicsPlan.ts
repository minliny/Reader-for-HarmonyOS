import type { JsonObject } from '@reader/core-harmony';

export interface MangaGraphicsDimensions { width: number; height: number }
export interface MangaGraphicsStrip { sourceY: number; targetY: number; height: number }
export interface MangaGraphicsPlan extends MangaGraphicsDimensions { strips: MangaGraphicsStrip[] }
export interface MangaImageGraphicsAdapter {
  inspect(bytes: Uint8Array, current: () => boolean): Promise<MangaGraphicsDimensions>;
  transform(bytes: Uint8Array, plan: JsonObject, current: () => boolean): Promise<Uint8Array>;
}
export function validateMangaGraphicsDimensions(width: unknown, height: unknown): MangaGraphicsDimensions {
  if (typeof width !== 'number' || typeof height !== 'number' || !Number.isSafeInteger(width) || !Number.isSafeInteger(height) ||
    width < 1 || height < 1 || width > 4096 || height > 65536 || width * height > 16 * 1024 * 1024) {
    throw new Error('MANGA_GRAPHICS_DIMENSIONS');
  }
  return { width, height };
}
export function validateMangaGraphicsPlan(value: JsonObject): MangaGraphicsPlan {
  const size = validateMangaGraphicsDimensions(value['width'], value['height']);
  if (value['__readerMangaGraphicsPlan'] !== true || value['format'] !== 'jpeg' || value['quality'] !== 90 || value['pixelFormat'] !== 'rgb565') {
    throw new Error('MANGA_GRAPHICS_FORMAT');
  }
  const rows = value['strips'];
  if (!Array.isArray(rows) || rows.length < 1 || rows.length > 64) throw new Error('MANGA_GRAPHICS_STRIPS');
  const strips: MangaGraphicsStrip[] = [];
  rows.forEach((raw): void => {
    if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('MANGA_GRAPHICS_STRIP');
    const item = raw as JsonObject, sourceY = item['sourceY'], targetY = item['targetY'], height = item['height'];
    if (typeof sourceY !== 'number' || typeof targetY !== 'number' || typeof height !== 'number' ||
      !Number.isSafeInteger(sourceY) || !Number.isSafeInteger(targetY) || !Number.isSafeInteger(height) ||
      sourceY < 0 || targetY < 0 || height < 1 || sourceY + height > size.height || targetY + height > size.height) {
      throw new Error('MANGA_GRAPHICS_STRIP');
    }
    strips.push({ sourceY, targetY, height });
  });
  const source = [...strips].sort((a: MangaGraphicsStrip, b: MangaGraphicsStrip): number => a.sourceY - b.sourceY);
  const target = [...strips].sort((a: MangaGraphicsStrip, b: MangaGraphicsStrip): number => a.targetY - b.targetY);
  let sourceEnd = 0, targetEnd = 0;
  for (let i = 0; i < strips.length; i++) {
    if (source[i].sourceY !== sourceEnd || target[i].targetY !== targetEnd) throw new Error('MANGA_GRAPHICS_COVERAGE');
    sourceEnd += source[i].height; targetEnd += target[i].height;
  }
  if (sourceEnd !== size.height || targetEnd !== size.height) throw new Error('MANGA_GRAPHICS_COVERAGE');
  return { width: size.width, height: size.height, strips };
}
