import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { MANGA_DIRECTORY_VISUAL, mangaDirectoryColor } from '../../entry/src/main/ets/features/manga/MangaDirectoryVisual.ts';

/** Execute the real finite modifier. Native press/cancel dispatch is the
 * platform seam, not a replacement gesture engine or compositor simulator. */
export function productionMangaDirectoryPressFeedback(source = readFileSync(new URL(
  '../../entry/src/main/ets/features/manga/MangaDirectoryPressFeedback.ets', import.meta.url), 'utf8'), {
  // These values expose arguments crossing the platform constructor boundary.
  // They do not model focus dispatch, drawing or native color composition.
  LengthMetrics = { vp: value => ({ value, unit: 'vp' }) },
  ColorMetrics = { resourceColor: color => ({ color }) },
} = {}) {
  const executable = stripTypeScriptTypes(source.replace(/^import .*;\n/gm, '').replace('export class ', 'class '));
  return new Function('MANGA_DIRECTORY_VISUAL', 'mangaDirectoryColor', 'LengthMetrics', 'ColorMetrics',
    `${executable}; return MangaDirectoryPressFeedback;`)(MANGA_DIRECTORY_VISUAL, mangaDirectoryColor, LengthMetrics, ColorMetrics);
}
