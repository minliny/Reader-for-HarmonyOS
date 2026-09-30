import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { readerAppColor } from '../../entry/src/main/ets/features/common/ReaderThemeRegistry.ts';

// Execute the actual modifier, injecting only platform APIs. Native color
// composition and input-state dispatch remain SDK/device evidence boundaries.
export function productionReaderPressFeedback({ Color = { Transparent: '#00000000' }, ColorMetrics } = {}) {
  const source = readFileSync(new URL('../../entry/src/main/ets/features/common/ReaderPressFeedback.ets', import.meta.url), 'utf8')
    .replace(/^import .*;\n/gm, '').replace('export class ', 'class ');
  return new Function('readerAppColor', 'Color', 'ColorMetrics',
    `${stripTypeScriptTypes(source)}; return ReaderPressFeedback;`)(readerAppColor, Color, ColorMetrics);
}
