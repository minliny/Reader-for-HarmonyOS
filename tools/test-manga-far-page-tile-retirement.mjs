import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';

const root = new URL('../entry/src/main/ets/features/manga/', import.meta.url);
function load(name, dependencies = {}) {
  const source = readFileSync(new URL(`${name}.ts`, root), 'utf8')
    .replace(/^import[\s\S]*?;\n/gm, '').replace(/^export type \{[^;]+;\n/gm, '').replace(/^export /gm, '');
  return new Function(...Object.keys(dependencies), `${stripTypeScriptTypes(source)}\nreturn ${name};`)(...Object.values(dependencies));
}
const MangaSessionGateway = load('MangaSessionGateway');
const MangaResourceGateway = load('MangaResourceGateway');
const Controller = load('MangaSessionController', { MangaSessionGateway, MangaResourceGateway });
const pages = Array.from({ length: 6 }, (_, ordinal) => {
  const pageId = `mp1:${String(ordinal).padStart(64, '0')}`;
  return { ordinal, pageId, resourceRef: `manga:${pageId}` };
});
const chapter = { manifest: { chapter: { sourceId: 's', bookId: 'b', chapterId: '/c' },
  sourceRuleVersion: 'r', manifestVersion: 'v', decodeRevision: 'identity-v1', pages },
  chapterIndex: 0, chapterTitle: 'chapter', totalPages: pages.length, pageStart: 0, cached: true, resources: [] };
const entry = { chapter, targetOrdinal: 0, recoveryRequired: false,
  progress: { token: { epoch: 1, revision: 0 }, location: null } };
const released = [];
let serial = 0;
const runtime = { supportsCoreCapability: () => true,
  async loadReadingImage() { return { fileUri: `file://image-${++serial}`, width: 600, height: 800,
    intrinsicWidth: 600, intrinsicHeight: 3200, revision: 'r' }; },
  releaseReadingImage(uri) { released.push(uri); } };
const controller = new Controller(runtime);
await controller.openPrepared(entry, true);
await controller.setTileWindow([{ ordinal: 0, tileIndex: 3 }]);
const oldTile = controller.tile(0, 3)?.image?.fileUri;
assert.ok(oldTile);
await controller.selectPage(4);
assert.equal(controller.tile(0, 3), undefined, 'a far selection retires a tile outside the new three-page window');
assert.equal(released.filter(uri => uri === oldTile).length, 1, 'the obsolete decoded tile lease is released once');
controller.close();
assert.equal(released.filter(uri => uri === oldTile).length, 1, 'close cannot release an already retired tile twice');
console.log('PASS far-page selection retires the obsolete tile before a new viewport callback');
