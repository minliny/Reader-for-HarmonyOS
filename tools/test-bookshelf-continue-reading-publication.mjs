import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createReaderBuilderProbe } from './lib/reader-control-builder-probe.mjs';
import { createArkUIPropertyRuntimeProbe } from './lib/arkui-property-runtime-probe.mjs';

const read = path => readFileSync(new URL(`../entry/src/main/ets/${path}`, import.meta.url), 'utf8');
const indexSource = read('pages/Index.ets');
const pageSource = read('features/bookshelf/BookshelfPage.ets');
const require = createRequire(import.meta.url);
const sdk = process.env.READER_ETS_LOADER_ROOT ?? '/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/ets/build-tools/ets-loader';
const syntax = require(`${sdk}/lib/validate_ui_syntax.js`);
const builders = require(`${sdk}/lib/component_map.js`).CUSTOM_BUILDER_METHOD;
for (const name of ['sectionAction', 'filterRow', 'projectionRow']) builders.add(name);
for (const [name, source] of [['BookshelfPage', pageSource], ['BookshelfEmptyPage', read('features/bookshelf/BookshelfEmptyPage.ets')],
  ['BookshelfStatusContent', read('features/bookshelf/BookshelfStatusContent.ets')], ['NoCoverCover', read('features/bookshelf/NoCoverCover.ets')]]) {
  syntax.componentCollection.customComponents.add(name);
  syntax.propCollection.set(name, new Set([...source.matchAll(/@Prop(?:\s+@\w+(?:\([^)]*\))?)*\s+(\w+)\s*:/g)].map(match => match[1])));
}
class Child { constructor(owner, params, _storage, id) { Object.assign(this, { owner, params, id }); } }
const results = [];
for (const withCover of [true, false]) {
const runtime = createArkUIPropertyRuntimeProbe();
const mountedItems = new WeakMap();
const hooks = { ...runtime.hooks, onObserverExit(owner, id) {
  runtime.hooks.onObserverExit();
  const node = owner.nodes.get(id);
  if (node.type !== 'ListItem' || !Array.isArray(node.create) || typeof node.create[0] !== 'function') return;
  let mounted = mountedItems.get(owner); if (!mounted) mountedItems.set(owner, mounted = new Set());
  if (!mounted.has(id)) { mounted.add(id); node.create[0](); }
} };
const { Component: Page } = createReaderBuilderProbe(pageSource,
  ['continueReading', 'bookshelfList', 'continueReadingCard', 'hasCover'], {
    ...runtime.sdk, NoCoverCover: Child, ImageFit: { Cover: 'cover' },
    LazyForEach: { create() {}, pop() {} }, ViewStackProcessor: { StartGetAccessRecordingFor() {}, StopGetAccessRecording() {} },
  }, hooks);
let page, pageMounts = 0, propUpdates = 0;
class ShelfChild extends Child {
  constructor(owner, params, storage, id) {
    super(owner, params, storage, id); pageMounts++;
    page = new Page(undefined, params);
    Object.assign(page, { appThemeScheme: 'day', filterRowVisible: false, viewModeError: '', visibleBookCount: 2,
      viewSwitchHeaderOpacity: 1, shelfScroller: {}, rowDataSource: {}, sectionAction() {}, filterRow() {}, projectionRow() {},
      shelfContentWidth: () => 352, onBookSelected: params.onBookSelected });
    page.bookshelfList(false);
  }
  updateStateVars(params) {
    propUpdates++;
    Object.assign(this.params, params);
    page.updateStateVars(params);
  }
}
// Real Index state -> actual component call -> SDK @Prop copy/reset -> actual
// ListItem and continueReadingCard observers. No manual page replay, remount,
// mutated A object or production-source substitutions can hide a stale closure.
const { owner: index } = createReaderBuilderProbe(indexSource, ['continueReading', 'bookshelfContent'], {
  ...runtime.sdk, BookshelfPage: ShelfChild, BookshelfEmptyPage: Child, BookshelfStatusContent: Child,
}, runtime.hooks);
const a = { sourceId: 'local', bookId: 'a', title: '短书 A', author: '作者 A', coverUrl: withCover ? 'file:///a.png' : undefined };
const b = { sourceId: 'local', bookId: 'b', title: '长书 B', author: '作者 B', coverUrl: withCover ? 'file:///b.png' : undefined };
const clicks = [];
Object.assign(index, { isBookshelfVisualAdmitted: true, shelfBooks: [a], shelfProjectionRevision: 'a',
  continueReading: a, settingsSnapshot: { reduceMotion: false }, bookshelfViewState: {},
  shelfReadingPreparation: false, readingSessionActive: false, openShelfBook: book => clicks.push(book.bookId) });
index.bookshelfContent();
const card = [...page.nodes.values()].find(node => node.type === 'Row' && node.height === 100);
assert.ok(card); card.onClick(); assert.deepEqual(clicks, ['a']);
const actorIds = [...page.nodes.keys()];
const title = [...page.nodes.values()].find(node => node.type === 'Text' && node.create === a.title);
const author = [...page.nodes.values()].find(node => node.type === 'Text' && node.create === a.author);
const cover = [...page.nodes.values()].find(node => node.type === 'Image');
assert.ok(title && author);
assert.equal(cover !== undefined, withCover);
const childIds = [...page.children.keys()];
if (!withCover) {
  assert.equal(page.children.size, 1, 'the original NoCover actor is mounted once');
  assert.deepEqual([...page.children.values()][0].params, { coverWidth: 62, coverHeight: 93 });
}
index.shelfBooks = [b, a]; index.continueReading = b;
runtime.flush();
assert.equal(pageMounts, 1, 'one retained BookshelfPage');
assert.ok(propUpdates > 0, 'real parent observer delivered a child update');
assert.equal(page.continueReading.bookId, 'b', 'new identity reached the actual SDK @Prop');
assert.equal([...index.children.values()].find(child => child instanceof ShelfChild).params.continueReading.bookId, 'b');
assert.deepEqual([...page.nodes.keys()], actorIds, 'card publication cannot create replacement native actors');
card.onClick();
const actual = { title: title.create, author: author.create, cover: cover?.create, clicked: clicks.at(-1) };
results.push({ withCover, evidence: runtime.source, deliveredProp: page.continueReading.bookId,
  pageMounts, propUpdates, actual, actorCount: actorIds.length });
assert.deepEqual(actual, { title: b.title, author: b.author, cover: b.coverUrl, clicked: 'b' },
  'retained Continue Reading native text, cover and click must publish the new proven book');
assert.deepEqual([...page.children.keys()], childIds, 'the existing NoCover actor is retained');
// A queued Prop removal can arrive before ArkUI removes the branch. A gesture
// in that interval must not reopen the previous book. Deliver the real parent
// observer only; no fake native unmount/remount is asserted by this probe.
index.continueReading = a; runtime.flush();
assert.equal(title.create, a.title);
index.continueReading = undefined;
index.replayOnly(runtime.dependencies.get(index).get('continueReading'));
assert.equal(page.continueReading, undefined);
const clickCount = clicks.length; card.onClick(); assert.equal(clicks.length, clickCount);
// Coalesce the following publication before child rendering. Real native
// A→absent→B branch removal is outside this observer-only harness's scope.
index.continueReading = b; runtime.flush();
assert.equal(title.create, b.title); card.onClick(); assert.equal(clicks.at(-1), 'b');
assert.deepEqual([...page.nodes.keys()], actorIds);
assert.deepEqual([...page.children.keys()], childIds);
}
console.log(JSON.stringify(results));
console.log('PASS actual SDK Index state/Prop -> retained Continue Reading A→B with/without covers, coalesced absent Prop and safe click; native branch removal/pixels unverified');
