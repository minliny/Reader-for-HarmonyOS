import { resolveEtsLoaderRoot, virtualFilePath } from './lib/tool-environment.mjs';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire, stripTypeScriptTypes } from 'node:module';
import { MangaRetainedTileCache } from './lib/manga-retained-tile-cache-probe.mjs';
import { createReaderBuilderProbe } from './lib/reader-control-builder-probe.mjs';
import { createArkUIPropertyRuntimeProbe } from './lib/arkui-property-runtime-probe.mjs';
import { mangaSurfaceSdkDependencies, mountMangaViewportBuilder } from './lib/manga-surface-sdk-probe.mjs';
import { MangaStripProjection } from '../entry/src/main/ets/features/manga/MangaStripProjection.ts';
import { createDefaultReaderWindowMetrics } from '../entry/src/main/ets/features/common/ReaderWindowMetrics.ts';
import { mangaUserError } from '../entry/src/main/ets/features/manga/MangaUserError.ts';
import { findReaderTheme } from '../entry/src/main/ets/features/common/ReaderThemeRegistry.ts';

// SDK-emitted Surface/Image/PullToRefresh closures and the installed SDK's
// unmodified @State property runtime execute here. Native frames, geometry,
// image decoding, imported child mounting and subscriber delivery are ports.
// This proves retained property updates, not native rendering or VM gestures.
const root = new URL('../entry/src/main/ets/', import.meta.url);
const source = readFileSync(new URL('features/manga/MangaReadingSurface.ets', root), 'utf8');
const require = createRequire(import.meta.url);
const sdk = resolveEtsLoaderRoot();
const ts = require(`${sdk}/node_modules/typescript`);
const tree = ts.createSourceFile(virtualFilePath('MangaRollbackPaintProbe.ets'), source, ts.ScriptTarget.Latest, true,
  ts.ScriptKind.ETS, require(`${sdk}/lib/ets_checker.js`).compilerOptions);
assert.equal(tree.parseDiagnostics.length, 0);
const component = tree.statements.find(node => node.name?.getText(tree) === 'MangaReadingSurface');
const names = component.members.map(node => node.name?.getText(tree)).filter(Boolean);
const classText = name => tree.statements.find(node => node.name?.getText(tree) === name).getText(tree);
const DataSource = new Function('MangaStripProjection', `${stripTypeScriptTypes(classText('MangaStripDataSource'))};return MangaStripDataSource`)(MangaStripProjection);
const MangaLayoutFrame = new Function('FrameCallback', `${stripTypeScriptTypes(classText('MangaLayoutFrame'))};return MangaLayoutFrame`)(class {});
const windowSource = readFileSync(new URL('app/ReaderWindowCoordinator.ts', root), 'utf8');
const windowTree = ts.createSourceFile(virtualFilePath('MangaRollbackWindowValues.ts'), windowSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
const windowValue = name => new Function('findReaderTheme', `${stripTypeScriptTypes(windowTree.statements.find(node => node.name?.getText(windowTree) === name).getText(windowTree).replace(/^export /, ''))};return ${name}`)(findReaderTheme);
const ReaderWindowChromeStyle = windowValue('ReaderWindowChromeStyle'), ReaderWindowPolicy = windowValue('ReaderWindowPolicy');
function load(name, dependencies = {}) {
  const text = readFileSync(new URL(`features/manga/${name}.ts`, root), 'utf8')
    .replace(/^import[\s\S]*?;\n/gm, '').replace(/^export type \{[^;]+;\n/gm, '').replace(/^export /gm, '');
  return new Function(...Object.keys(dependencies), `${stripTypeScriptTypes(text)};return ${name}`)(...Object.values(dependencies));
}
const MangaSessionGateway = load('MangaSessionGateway'), MangaResourceGateway = load('MangaResourceGateway');
const Controller = load('MangaSessionController', { MangaSessionGateway, MangaResourceGateway, MangaRetainedTileCache });
const gesture = new Proxy({}, { get: () => () => {} });
const pageId = `mp1:${'a'.repeat(64)}`;
const entry = { chapter: { manifest: { chapter: { sourceId: 's', bookId: 'b', chapterId: '/origin' },
  manifestVersion: 'origin-v1', sourceRuleVersion: 'rules-v1', decodeRevision: 'identity-v1',
  pages: [{ ordinal: 0, pageId, resourceRef: `manga:${pageId}` }] },
  chapterIndex: 0, chapterTitle: 'Origin', pageStart: 0, totalPages: 1, cached: true, resources: [] },
  targetOrdinal: 0, recoveryRequired: false, progress: { token: { epoch: 1, revision: 0 }, location: null } };

async function fixture(text) {
  const frames = [], released = [], properties = createArkUIPropertyRuntimeProbe();
  const controller = new Controller({ supportsCoreCapability: () => true,
    async loadReadingImage() { return { fileUri: 'file://retained-origin.png', width: 600, height: 600,
      intrinsicWidth: 600, intrinsicHeight: 600, revision: 'image-v1' }; },
    releaseReadingImage(uri) { released.push(uri); } });
  await controller.openPrepared(structuredClone(entry), true);
  await controller.setTileWindow([{ ordinal: 0, tileIndex: 0 }]);
  class ListScroller {
    getItemRect(index) { assert.equal(index, 0); return { x: 0, y: 0, width: 300, height: 300 }; }
    getItemIndex() { return 0; }
    isAtEnd() { return true; }
    scrollToIndex() {}
    scrollBy() {}
  }
  class Scroller { currentOffset() { return { xOffset: 0, yOffset: 0 }; } scrollTo() {} }
  let owner;
  const built = createReaderBuilderProbe(text, names, {
    ...properties.sdk, ...mangaSurfaceSdkDependencies, MangaStripDataSource: DataSource, MangaLayoutFrame,
    ListScroller, Scroller, PhotoViewScaleModel: class {}, mangaUserError, ReaderWindowChromeStyle, ReaderWindowPolicy,
    ReaderWindowCoordinator: new Proxy({}, { get: (_target, key) => key === 'metrics' ? () => createDefaultReaderWindowMetrics() : async () => {} }),
    hilog: { warn() {}, error() {} }, uiContext: { postFrameCallback(frame) { frames.push(frame); } },
    ScrollAlign: { START: 0 }, ImageFit: { Fill: 0 }, ScrollDirection: { Horizontal: 0 }, TouchType: { Down: 0, Up: 1 },
    LazyForEach: { create(_id, generatedOwner, data, item) { assert.equal(generatedOwner, owner); item(data.getData(0), 0); }, pop() {} },
    Gesture: gesture, GestureGroup: gesture, PinchGesture: gesture, SwipeGesture: gesture, TapGesture: gesture,
    GesturePriority: { Parallel: 0 }, GestureMode: { Exclusive: 0 }, SwipeDirection: { Horizontal: 0 },
  }, properties.hooks);
  owner = built.owner;
  Object.assign(owner, { controller, runtime: { hasCurrentCatalogProjection: () => true }, sourceId: 's', bookId: 'b',
    mounted: true, opened: true, viewportWidth: 300, viewportHeight: 300, first: 0, last: 0,
    restoringAnchor: false, layoutGeneration: 1, appliedLayoutGeneration: 1, boundaryBusy: false,
    rollbackChapterController: controller, rollbackPainting: true, boundaryPaintGeneration: 1,
    previousChapterPixels: [{ key: 'origin', uri: 'file://retained-origin.png', x: 0, y: 0, width: 300, height: 300 }],
    remoteSession: { sourceVersion: 'rules-v1', contentKind: 'manga', identity: { sourceId: 's', bookId: 'b' },
      entries: [{ index: 0, url: '/origin', title: 'Origin', navigable: true }, { index: 1, url: '/next', title: 'Next', navigable: true }] },
    loginRequired: () => false,
  });
  owner.windowChromeActive = true;
  owner.data.projection.publish(controller.chapter.manifest, i => controller.pageGeometry(i), undefined, controller.totalPages, i => controller.pageAt(i));
  assert.equal(owner.rememberVisible(), true);
  const previousGesture = globalThis.Gesture; globalThis.Gesture = gesture;
  try { owner.initialRender(); mountMangaViewportBuilder(owner); }
  finally { if (previousGesture === undefined) delete globalThis.Gesture; else globalThis.Gesture = previousGesture; }
  const list = [...owner.nodes.values()].find(node => node.type === 'List');
  const scroll = [...owner.nodes.values()].find(node => node.type === 'Scroll');
  const wrapper = [...owner.children.values()].find(child => typeof child.params?.customList === 'function');
  const image = [...owner.nodes.values()].find(node => node.type === 'Image' && typeof node.onComplete === 'function');
  assert.ok(list && scroll && wrapper && image);
  assert.equal(owner.controller, controller); assert.equal(owner.rollbackChapterController, controller);
  assert.equal(Object.hasOwn(owner, '__controller'), false); assert.equal(Object.hasOwn(owner, '__rollbackChapterController'), false);
  assert.equal(list.enableScrollInteraction, false); assert.equal(scroll.enableScrollInteraction, false); assert.equal(wrapper.params.pullEnabled, false);
  return { owner, controller, properties, frames, built, list, scroll, wrapper, image, released };
}

async function completeRollback(f) {
  const { owner, controller, image, frames, properties } = f;
  assert.equal(owner.boundaryBusy, false); assert.equal(owner.restoringAnchor, false);
  const generation = owner.boundaryPaintGeneration;
  const row = owner.data.getData(0), currentKey = owner.rowRenderKey(row);
  owner.boundaryPaintGeneration = generation - 1;
  const staleKey = owner.rowRenderKey(row);
  owner.boundaryPaintGeneration = generation;
  owner.tileImage(row, controller.tile(0, 0).image.fileUri, staleKey, controller, controller.chapter.manifest);
  const stale = [...owner.nodes.values()].filter(node => node.type === 'Image' && typeof node.onComplete === 'function').at(-1);
  stale.onComplete({ loadingStatus: 1 });
  assert.equal(owner.rollbackChapterImages.size, 0, 'same owner and URI from before rollback cannot acknowledge its new paint generation');
  assert.equal(frames.length, 0);
  image.onComplete({ loadingStatus: 0 });
  assert.equal(owner.rollbackChapterImages.size, 0, 'file loading completion is not a decoded Image receipt');
  assert.equal(owner.rollbackPainting, true); assert.equal(owner.previousChapterPixels.length, 1);
  assert.equal(frames.length, 0);
  assert.equal(f.list.enableScrollInteraction, false); assert.equal(f.scroll.enableScrollInteraction, false); assert.equal(f.wrapper.params.pullEnabled, false);
  image.onComplete({ loadingStatus: 1 });
  assert.equal(owner.rollbackChapterImages.has(currentKey), true);
  assert.equal(owner.previousChapterPixels.length, 1); assert.equal(owner.rollbackPainting, true);
  assert.equal(frames.length, 1);
  const frame = frames.shift(); frame.onFrame(0); properties.flush();
  assert.equal(owner.rollbackPainting, true, 'pre-render callback cannot retire the snapshot');
  frame.onIdle(0); properties.flush();
  assert.equal(owner.rollbackChapterController, undefined); assert.equal(owner.rollbackPainting, false); assert.equal(owner.previousChapterPixels.length, 0);
  assert.equal(owner.controller, controller, 'the actual Controller remains a plain stable owner');
  const updates = f.built.owner.attributeCalls.length; frame.onIdle(0); properties.flush();
  assert.equal(f.built.owner.attributeCalls.length, updates, 'a posted after-render receipt executes once');
}

{
  const f = await fixture(source), ids = [f.list.id, f.scroll.id, f.wrapper.id];
  for (const id of ids) assert.ok(f.properties.reads.some(read => read.owner === f.owner && read.name === 'rollbackPainting' && read.id === id),
    'each scrolling/pull gate must subscribe to the actual SDK @State property');
  await completeRollback(f);
  assert.equal(f.owner.nodes.get(ids[0]), f.list); assert.equal(f.owner.nodes.get(ids[1]), f.scroll); assert.equal(f.owner.children.get(ids[2]), f.wrapper);
  assert.equal(f.list.enableScrollInteraction, true); assert.equal(f.scroll.enableScrollInteraction, true); assert.equal(f.wrapper.params.pullEnabled, true);
  await f.controller.close();
}
// Counterfactual: identical production code without the boolean's @State must
// lose these retained dependencies even though snapshot state still changes.
{
  const plain = source.replace('@State private rollbackPainting: boolean = false;', 'private rollbackPainting: boolean = false;');
  assert.notEqual(plain, source);
  const f = await fixture(plain); await completeRollback(f);
  assert.equal(f.list.enableScrollInteraction, false); assert.equal(f.scroll.enableScrollInteraction, false); assert.equal(f.wrapper.params.pullEnabled, false);
  assert.equal(f.properties.reads.some(read => read.owner === f.owner && read.name === 'rollbackPainting'), false);
  await f.controller.close();
}
console.log('PASS SDK @State rollback paint delivery: late native Image receipt retires snapshot after render and re-enables retained List, Scroll and PullToRefresh without proxying the Controller; same-owner stale paint and missing-State counterfactual stay rejected');
console.log('BOUNDARY actual SDK/property/Controller methods; controlled frames, rectangles, decoding and imported-child mounting. No native paint, HAP, VM, gestures or user acceptance claim.');
