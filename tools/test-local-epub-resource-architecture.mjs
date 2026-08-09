import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (relative) => readFileSync(new URL(`../${relative}`, import.meta.url), 'utf8');
const registry = read('entry/src/main/ets/app/ReaderHostRegistry.ts');
const importGateway = read('entry/src/main/ets/features/bookshelf/LocalBookImportGateway.ts');
const runtimeOwner = read('entry/src/main/ets/app/ReaderRuntimeOwner.ts');
const coreGateway = read('entry/src/main/ets/app/ReaderCoreGateway.ts');
const resourceHost = read('entry/src/main/ets/app/LocalEpubResourceHost.ts');
const imageHost = read('entry/src/main/ets/app/ReadingBodyImageHost.ts');
const chapterWindow = read('entry/src/main/ets/features/reading/ReadingChapterWindow.ts');

assert.match(registry, /stagedPath: string;[\s\S]*assetKind: 'epub' \| 'none';/,
  'the picker stage must remain a Host-only input until import commits');
assert.match(registry, /async commitLocalBookInput\(/);
assert.match(registry, /reader-import\/books/);
assert.match(registry, /const finalPath = `\$\{this\.localBookAssetDirectory\(\)\}\/\$\{hash\}\.epub`/,
  'a committed EPUB must retain its original archive outside the Core snapshot');
assert.match(registry, /async rollbackLocalBookAsset\([\s\S]*commit\.created/,
  'a failed new import must roll back only the Host asset it created');
assert.match(registry, /async releaseLocalBookAsset\(bookId: string\)[\s\S]*\$\{hash\}\.epub/,
  'a successful Core local-book deletion must have one deterministic Host asset release');
assert.doesNotMatch(registry, /LocalBookRawImportLimitBytes|bytesBase64: string|encodeToString\(bytes\)/,
  'production local-book import must not retain the Base64 transport limit');
assert.match(registry, /HashChunkBytes = 1024 \* 1024[\s\S]*sha256File\(stagePath\)/,
  'Host content identity must be hashed as a bounded stream');
assert.match(importGateway, /filePath: input\.stagedPath/,
  'the JSON control plane must carry only the Host-authorized staging path');
assert.doesNotMatch(importGateway, /bytesBase64/,
  'the production gateway must not send whole local books through JSON Base64');

const commitIndex = importGateway.indexOf('commitLocalBookInput(selection.input)');
const shelfIndex = importGateway.indexOf("request('bookshelf.add'");
assert.ok(commitIndex >= 0 && shelfIndex > commitIndex,
  'Host asset commit must complete before the visible bookshelf commit');
assert.match(importGateway, /rollbackLocalBookAsset\(assetCommit\)/);
assert.match(importGateway, /discardLocalBookInput\(selection\.input\)/);

assert.match(resourceHost, /reader-local-epub:\/\//);
assert.match(resourceHost, /readLocalEpubEntry\(archivePath, locator\.archivePath, MAX_READING_IMAGE_BYTES\)/,
  'Rust Core must read only the requested bounded ZIP entry');
assert.doesNotMatch(resourceHost, /@ohos\.zlib|decompressFile|getOriginalSize|cacheDir/,
  'the Host must not expand a whole EPUB or retain an extracted copy');
assert.match(resourceHost, /segment === '\.' \|\| segment === '\.\.'/,
  'Host resource reads must reject path traversal independently of Core');
assert.match(resourceHost, /ReadingBodyImageHost\.instance\.loadBytes/,
  'local and online images must converge on one byte/dimension adapter');
assert.match(imageHost, /async loadBytes\(/);
assert.match(imageHost, /pixelMap: image\.PixelMap/,
  'decoded images must cross into the reading session as native PixelMap handles');
assert.doesNotMatch(imageHost, /dataUri: `data:|encodeToStringSync\(bytes/,
  'the image adapter must not retain or recreate Base64 data URIs');
assert.match(chapterWindow, /pixelMap: image\.PixelMap \| undefined/);
assert.doesNotMatch(chapterWindow, /dataUri/,
  'the bounded chapter window must not retain Base64 image payloads');
assert.match(runtimeOwner, /sourceId === 'local' && imageUrl\.startsWith\('reader-local-epub:\/\/'\)/);
assert.match(coreGateway, /request\('bookshelf\.remove'/);
assert.match(coreGateway, /releaseLocalBookAsset\(bookId\)/,
  'Host archive release must happen only through the Core-backed bookshelf gateway');
assert.doesNotMatch(resourceHost, /http\.execute|source\.imageRequest|pagination|chapterWindow/,
  'the local resource Host must not become a second downloader or reader');

console.log('local EPUB resource architecture: PASS');
