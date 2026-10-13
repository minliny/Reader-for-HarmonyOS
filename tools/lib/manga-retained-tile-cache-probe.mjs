import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';

// Execute the complete chapter lease owner over the built-in Map. No cache
// replacement, transport, pixels or mock retention algorithm is substituted.
const source = readFileSync(new URL('../../entry/src/main/ets/features/manga/MangaRetainedTileCache.ts', import.meta.url), 'utf8')
  .replace(/^import[\s\S]*?;\n/gm, '').replace(/^export /gm, '');
export const MangaRetainedTileCache = new Function(`${stripTypeScriptTypes(source)}\nreturn MangaRetainedTileCache;`)();
