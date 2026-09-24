import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks, stripTypeScriptTypes } from 'node:module';
import { productionMotionMethods } from './lib/reader-motion-method-probe.mjs';
import { ReadingChapterWindow, hasKnownReadingImageGeometry } from '../entry/src/main/ets/features/reading/ReadingChapterWindow.ts';
import * as style from '../entry/src/main/ets/features/reading/ReaderAppearanceRenderStyle.ts';

registerHooks({ resolve(specifier, context, next) {
  try { return next(specifier, context); } catch (error) {
    if ((specifier.startsWith('./') || specifier.startsWith('../')) && !specifier.endsWith('.ts'))
      return next(`${specifier}.ts`, context);
    throw error;
  }
} });
const { materializePreparedReadingDocument } = await import('../entry/src/main/ets/features/reading/ReadingDocumentProjection.ts');
const dir = new URL('../entry/src/main/ets/features/reading/', import.meta.url);
const file = new URL('LocalReadingExperience.ets', dir);
const surface = readFileSync(new URL('ReadingSurface.ets', dir), 'utf8');
const fragmentClass = surface.slice(surface.indexOf('export class ReadingSurfacePageFragment'), surface.indexOf('/** Shared scalar-aware'));
const Fragment = new Function(stripTypeScriptTypes(fragmentClass).replace('export ', '') + ';return ReadingSurfacePageFragment;')();
const bookId = 'local:' + 'a'.repeat(64);
const encode = value => Buffer.from(value).toString('base64').replaceAll('+', '-').replaceAll('/', '_');
const source = `reader-local-epub://${encode(bookId)}/${encode('OPS/logo.png')}`;
const block = { kind: 'image', source, startScalar: 0, endScalar: 1,
  imageIntrinsicWidth: 357, imageIntrinsicHeight: 359, imageWidthBasisPoints: 3000 };
const document = image => ({ sourceId: 'local', content: '\uFFFC\n正文😀', blocks: [image,
  { kind: 'text', text: '\n正文😀', startScalar: 1, endScalar: 5 }] });
const prepared = materializePreparedReadingDocument(document(block), 0, 'layout-v1');
assert.equal(prepared.content, '\uFFFC\n正文😀');
assert.equal(prepared.images[0].state, 'pending');
assert.equal(hasKnownReadingImageGeometry(prepared.images[0]), true);
const legacy = materializePreparedReadingDocument(document({ ...block,
  imageIntrinsicWidth: undefined, imageIntrinsicHeight: undefined }), 0, 'layout-v1');
assert.equal(legacy.images[0].state, 'pending');
assert.equal(hasKnownReadingImageGeometry(legacy.images[0]), false,
  'unknown local geometry stays pending; actual page measurement decides whether it is needed');
for (const change of [{ imageIntrinsicWidth: 0 }, { imageIntrinsicWidth: 4097 }, { imageIntrinsicHeight: undefined },
  { imageIntrinsicWidth: 4096, imageIntrinsicHeight: 4096 }, { imageIntrinsicWidth: 1.5 },
  { source: 'https://example.invalid/logo.png' }, { source: 'reader-local-epub://unbound/logo' }])
  assert.throws(() => materializePreparedReadingDocument(document({ ...block, ...change }), 0, 'layout-v1'));
assert.throws(() => materializePreparedReadingDocument({ ...document(block), sourceId: 'remote' }, 0, 'layout-v1'));

const Resolver = productionMotionMethods(new URL('ReadingSessionFlowGateway.ts', dir),
  ['resolveReadingImage', 'failedReadingImage'], { errorMessageOf: String, diagnosticCodeOf: String });
const releases = [];
let payload = { width: 179, height: 180, intrinsicWidth: 357, intrinsicHeight: 359, fileUri: 'file:///logo', revision: 'r' };
const resolver = Object.assign(new Resolver(), { sourceId: 'local', bookId, source: { kind: 'local' }, runtimeOwner: {
  loadReadingImage: async () => payload, releaseReadingImage: (...args) => releases.push(args),
} });
const chapterTemplate = { sourceId: 'local', bookId, chapterIndex: 0, chapterTitle: '章',
  content: prepared.content, contentVersion: 'layout-v1', images: prepared.images, extractionVia: 'local' };
const ready = await resolver.resolveReadingImage(chapterTemplate, prepared.images[0]);
assert.equal(ready.intrinsicWidth, 357, 'layout uses original rather than rounded downsample width');
assert.equal(ready.intrinsicHeight, 359);
payload = { ...payload, intrinsicWidth: 358 };
const rejected = await resolver.resolveReadingImage(chapterTemplate, prepared.images[0]);
assert.equal(rejected.state, 'failed', 'mismatched platform dimensions cannot replace admitted geometry');
assert.equal(rejected.intrinsicWidth, 357);
assert.equal(rejected.intrinsicHeight, 359);
assert.equal(releases.length, 1, 'rejected pixels release their lease');

const nativeOriginal = { width: 8191, height: 4093 };
let decoded, decodedReleased = 0, sourceReleased = 0;
const NativePayload = productionMotionMethods(new URL('../entry/src/main/ets/app/ReadingBodyImageHost.ts', import.meta.url),
  ['decodeBytes','withDecodedPixelMap','boundedDecodeSize','assertCurrent'], {
    MAX_READING_IMAGE_BYTES: 16 * 1024 * 1024, MAX_READING_IMAGE_DIMENSION: 4096, MAX_READING_IMAGE_PIXELS: 4 * 1024 * 1024,
    image: { createImageSource: () => ({ getImageInfo: async () => ({ size: nativeOriginal }),
      async createPixelMap(options) { decoded = options.desiredSize; return {
        getImageInfo: async () => ({ size: decoded }), release() { decodedReleased++; },
      }; }, release() { sourceReleased++; } }) },
  });
const nativeOwner = Object.assign(new NativePayload(), { resourceGeneration: 0, sha256: async () => 'hash',
  materializeDisplayFile: async () => 'file:///downsampled' });
const nativePayload = await nativeOwner.decodeBytes(new Uint8Array([1]));
assert.equal(nativePayload.intrinsicWidth, nativeOriginal.width);
assert.equal(nativePayload.intrinsicHeight, nativeOriginal.height);
assert.equal(nativePayload.width, decoded.width); assert.equal(nativePayload.height, decoded.height);
assert.notEqual(nativePayload.width, nativePayload.intrinsicWidth);
assert.equal(decodedReleased, 1); assert.equal(sourceReleased, 1);

const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
const settle = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
let activeRuntime;
const methods = ['resolvePageImagePixels', 'resolveGeometryImagePixels', 'matchingImageChapter', 'geometryImageOwners',
  'replaceFragmentPixels', 'publishGeometryImagePixels', 'flushDeferredReadingImagePixels', 'readingImageKey',
  'rebuildChapterImageIndexes', 'adoptReadingImage', 'releaseUnadmittedReadingImage', 'releaseAllReadingImages',
  'sameReadingImageResource', 'scaledReadingImageHeight', 'consumeReversePageParagraph', 'rebuildContinuousFragments'];
const Owner = productionMotionMethods(file, methods, { ReadingSurfacePageFragment: Fragment, ...style,
  readerNativeParagraphKey: () => 'title', TYPE_READER_CHAPTER_TITLE: {}, TextAlign: { Center: 'center' },
  ReaderRuntimeOwner: { current: () => activeRuntime }, hilog: { error() {} } });
function fixture({ repeated = false } = {}) {
  let current = true, mounted = true, frozen = false, phase = 'idle';
  const reads = [], leasesReleased = [], events = [];
  const images = [prepared.images[0], ...(repeated ? [{ ...prepared.images[0], startScalar: 6, endScalar: 7 }] : [])];
  const chapter = { ...chapterTemplate, images: images.slice() };
  const fragments = images.map(i => new Fragment(`image-${i.startScalar}`, '', true, i.startScalar, i.endScalar,
    undefined, 30 * 359 / 357, undefined, 30 * 359 / 357, 3000));
  fragments[0].nativeTitle = { retained: true }; fragments[0].continuousSpaceBefore = true;
  const page = { startScalar: 0, endScalar: 10, contentHeight: 90, bodyCapacity: 200, fragments: fragments.slice() };
  const window = new ReadingChapterWindow(); window.configure('local', bookId, [0, 1]); window.setCurrent(chapter);
  const owner = Object.assign(new Owner(), { chapter, sourceId: 'local', bookId, lifecycleToken: 1,
    geometryImageRequests: new Map(), chapterWindow: window, readingImageResources: [],
    chapterImageByStartScalar: new Map(), chapterImagePositionByKey: new Map(),
    visibleFragments: page.fragments, visiblePage: page, readingReadyPage: page,
    continuousFragments: fragments.slice(), continuousFragmentIndexByStartScalar: new Map(images.map((i,n)=>[i.startScalar,n])),
    continuousRenderRevision: 0, continuousVisibleScalar: 4, continuousVisibleFragmentIndex: 2,
    preparedPreviousPage: { context: { chapter }, page: { ...page, fragments: fragments.slice() } },
    preparedNextPage: { context: { chapter }, page: { ...page, fragments: fragments.slice() } },
    pendingPageFragments: fragments.slice(), pageTurnRenderRevision: 0,
    bookTurnTextureCaptureGeneration: 0, bookTurnTextureCaptureScheduled: true,
    pageTurnInputPhase: () => phase, pageChromeStateFrozen: () => frozen, isSessionActive: () => mounted,
    activeGateway: () => ({ resolveReadingImage(_chapter, image, guard) {
      const gate = deferred(); reads.push({ ...gate, image, guard }); return gate.promise;
    } }),
    measurementTextWidth: () => 100, retainCurrentChapterWindow() {}, errorMessage: String,
    clearBookTurnCapturedIdentities: () => events.push('clear-texture'),
    scheduleBookTurnTextureRefresh: () => events.push('capture'),
    beginMeasurement: () => assert.fail('pixel readiness cannot remeasure'),
    schedulePageTurnPreparation: () => assert.fail('pixel readiness cannot clear measured neighbours'),
    commitContinuousProgress: () => assert.fail('pixel readiness cannot write progress'),
  });
  activeRuntime = { captureReadingContentValidity: () => () => current,
    releaseReadingImage: (...args) => leasesReleased.push(args) };
  return { owner, chapter, fragments, page, reads, leasesReleased, events,
    freeze(value) { frozen = value; phase = value ? 'settling' : 'idle'; },
    invalidate() { current = false; }, unmount() { mounted = false; },
    resolve(n, state = 'ready') { reads[n].resolve({ ...reads[n].image, state,
      fileUri: state === 'ready' ? 'file:///shared' : '', revision: state, pixelMap: undefined }); },
  };
}
{
  const f = fixture({ repeated: true });
  const before = f.owner.visibleFragments.map(v => ({ ...v }));
  f.owner.resolvePageImagePixels(f.chapter, f.owner.visibleFragments);
  f.owner.resolvePageImagePixels(f.chapter, f.owner.visibleFragments);
  assert.equal(f.reads.length, 2, 'one request per immutable chapter anchor while Host shares the asset');
  assert.equal(f.owner.geometryImageRequests.size, 2);
  assert.equal(f.owner.visiblePage, f.page, 'an unresolved decode does not withhold or replace the readable page');
  f.freeze(true); f.resolve(0); f.resolve(1); await settle();
  assert.equal(f.owner.visibleFragments[0].fileUri, undefined, 'settlement keeps the frozen surface unchanged');
  assert.equal(f.owner.readingImageResources.length, 0);
  assert.equal(f.leasesReleased.length, 0, 'deferred queue owns both leases while frozen');
  f.freeze(false); f.owner.flushDeferredReadingImagePixels();
  assert.equal(f.owner.geometryImageRequests.size, 0);
  assert.equal(f.owner.readingImageResources.length, 1);
  assert.equal(f.leasesReleased.length, 1, 'identical resource aliases retain one session lease');
  for (const [n, old] of before.entries()) {
    const current = f.owner.visibleFragments[n];
    assert.equal(current.fileUri, 'file:///shared');
    for (const key of ['id','startScalar','endScalar','imageHeight','layoutHeight','nativeTitle','continuousSpaceBefore'])
      assert.equal(current[key], old[key], `${key} cannot change when pixels arrive`);
    assert.equal(f.fragments[n].fileUri, undefined, 'previous fragment object remains immutable');
    assert.equal(f.owner.preparedPreviousPage.page.fragments[n].fileUri, 'file:///shared');
    assert.equal(f.owner.preparedNextPage.page.fragments[n].fileUri, 'file:///shared');
    assert.equal(f.owner.continuousFragments[n].fileUri, 'file:///shared');
  }
  assert.equal(f.owner.visiblePage.startScalar, 0); assert.equal(f.owner.visiblePage.endScalar, 10);
  assert.equal(f.owner.visiblePage.contentHeight, 90); assert.equal(f.owner.continuousVisibleScalar, 4);
  assert.equal(f.owner.continuousVisibleFragmentIndex, 2, 'continuous pixels cannot move the viewport anchor');
  assert.equal(f.owner.pageTurnRenderRevision, 1);
  assert.equal(f.owner.bookTurnTextureCaptureGeneration, 1);
  assert.deepEqual(f.events, ['clear-texture','capture']);
  f.owner.releaseAllReadingImages(); assert.equal(f.leasesReleased.length, 2);
}
for (const outcome of ['failed','invalidated','unmounted','removed-chapter','new-version','teardown-pending','teardown-frozen']) {
  const f = fixture();
  f.owner.resolvePageImagePixels(f.chapter, f.owner.visibleFragments);
  if (outcome === 'invalidated') f.invalidate();
  if (outcome === 'unmounted') f.unmount();
  if (outcome === 'removed-chapter' || outcome === 'new-version') {
    f.owner.chapter = { ...f.chapter, chapterIndex: outcome === 'removed-chapter' ? 1 : 0, contentVersion: 'new' };
    f.owner.chapterWindow.clear(); f.owner.preparedPreviousPage = undefined; f.owner.preparedNextPage = undefined;
  }
  if (outcome === 'teardown-pending') f.owner.releaseAllReadingImages();
  if (outcome === 'teardown-frozen') f.freeze(true);
  f.resolve(0, outcome === 'failed' ? 'failed' : 'ready'); await settle();
  if (outcome === 'teardown-frozen') f.owner.releaseAllReadingImages();
  assert.equal(f.owner.visibleFragments[0].fileUri, undefined, outcome);
  assert.equal(f.owner.visibleFragments[0].imageHeight, 30 * 359 / 357);
  assert.equal(f.owner.visiblePage.endScalar, 10);
  assert.equal(f.owner.pageTurnRenderRevision, 0);
  assert.equal(f.leasesReleased.length, outcome === 'failed' ? 0 : 1, `${outcome} releases exactly its own acquired lease`);
  if (outcome === 'failed') assert.equal(f.chapter.images[0].state, 'failed');
}
for (const state of ['pending','failed']) {
  const f = fixture(); const image = { ...f.chapter.images[0], state };
  Object.assign(f.owner, { previousChapterMeasurement: { endScalar: 5, targetChapterIndex: 0 },
    measurementBatch: [{}], pendingPageFragments: [], pendingPageHeight: 0,
    appearanceSnapshot: { paragraphSpacing: 0 }, isMeasurementCurrent: () => true, hasValidUnicodeProbe: () => true,
    readingImageForParagraph: () => image, reversePageCapacityAt: () => 100,
    resolvePendingReadingImage: () => assert.fail('reverse known geometry cannot wait for decode'),
    preparePreviousMeasurementParagraph: () => false, requireMeasurementLayoutMap: () => ({ residentStart: () => 0 }),
    setMeasuringOffset() {}, setMeasuringRequestedAnchor() {}, beginFirstPageCommit() { this.committed = true; },
    fail: error => { throw error; } });
  f.owner.consumeReversePageParagraph(1,1,1);
  assert.equal(f.owner.committed, true); assert.equal(f.owner.pendingPageFragments[0].imageHeight, 30 * 359 / 357);
  let continuous;
  Object.assign(f.owner, { chapterLayoutMap: {}, paragraphRanges: [{ startScalar: 0, endScalar: 1 }],
    visibleReadingAppearance: () => ({ fontSize: 20, lineHeightMultiplier: 1.5 }), continuousImageForRange: () => image,
    readingLayout: () => ({ bodyHeight: () => 100 }),
    commitContinuousRenderProjection: (_chapter, fragments) => { continuous = fragments; } });
  f.owner.chapter = { ...f.chapter, chapterTitle: '' };
  f.owner.rebuildContinuousFragments();
  assert.equal(continuous[0].imageHeight, 30 * 359 / 357, 'continuous pending/failed keeps the same geometry');
}
assert.match(surface, /fragment\.id}:image:/, 'paged ForEach identity remounts the placeholder as Image when pixels arrive');

// A watcher can receive only the last revision after several pixel promises.
// Exercise the actual LazyForEach data source, including its separate title row.
const stageSource = readFileSync(new URL('ReaderContinuousReadingStage.ets', dir), 'utf8');
const dataSourceText = stageSource.slice(stageSource.indexOf('class ContinuousFragmentDataSource'),
  stageSource.indexOf('/**\n * A real vertically scrolling'));
const DataSource = new Function(stripTypeScriptTypes(dataSourceText) + ';return ContinuousFragmentDataSource;')();
const Stage = productionMotionMethods(new URL('ReaderContinuousReadingStage.ets', dir),
  ['onContentRevisionChanged', 'continuousListItems', 'reloadFragments', 'restoreImageAnchor'],
  { ReadingSurfacePageFragment: Fragment, CONTINUOUS_TITLE_ID: 'title',
    ContinuousLayoutFrame: class { constructor(action) { this.action = action; } } });
for (const delivery of ['one-frozen-batch', 'two-promises-before-observer']) {
  const f = fixture({ repeated: true }), ds = new DataSource(), frames = [], changes = [];
  ds.replace([new Fragment('title','章',false), ...f.owner.continuousFragments]);
  ds.registerDataChangeListener({ onDataChange: i => changes.push(i), onDataReloaded: () => changes.push('reload') });
  const stage = Object.assign(new Stage(), { mounted: true, imageAnchorGeneration: 0,
    fragmentsProvider: () => f.owner.continuousFragments, changedFragmentIndex: -1, fragmentDataSource: ds,
    visibleFragmentStart: 0, visibleFragmentEnd: 1, titleItemCount: 1, initialScrollPending: false,
    chapterTitle: '章', contentRevision: 0, lastAppliedContentRevision: 0,
    fragmentIndexById: new Map(f.owner.continuousFragments.map((fragment,index)=>[fragment.id,index])),
    layout: { contentTop: 0 }, hasTitleItem: () => true,
    listScroller: { getItemRect: () => ({ y: -3, height: 30 * 359 / 357 }),
      scrollBy: () => assert.fail('fixed geometry pixel publication cannot displace the visible anchor') },
    getUIContext: () => ({ postFrameCallback: frame => frames.push(frame) }), reportCurrentVisibleRange() {},
  });
  f.owner.resolvePageImagePixels(f.chapter, f.owner.visibleFragments);
  if (delivery === 'one-frozen-batch') f.freeze(true);
  f.resolve(0); await settle(); f.resolve(1); await settle();
  f.freeze(false); f.owner.flushDeferredReadingImagePixels();
  stage.changedFragmentIndex = f.owner.continuousChangedFragmentIndex;
  stage.contentRevision = f.owner.continuousRenderRevision; stage.onContentRevisionChanged();
  assert.equal(ds.getData(1).fileUri, 'file:///shared', `${delivery}: coalesced observer includes first image`);
  assert.equal(ds.getData(2).fileUri, 'file:///shared', `${delivery}: coalesced observer includes second image`);
  for (const frame of frames) frame.action();
  f.owner.releaseAllReadingImages();
}
{
  // One watcher callback can observe two completed image promises. The
  // ordinary one-image path must remain constant work for a long chapter.
  const fragments = Array.from({ length: 1000 }, (_, index) => ({ id: `fragment-${index}` }));
  const ds = new DataSource();
  ds.replace([{ id: 'title', text: '章' }, ...fragments]);
  const changed = [];
  ds.registerDataChangeListener({ onDataChange: index => changed.push(index),
    onDataReloaded: () => assert.fail('image pixels must not remount the List') });
  let reads = 0;
  const getData = ds.getData.bind(ds);
  ds.getData = index => { reads++; return getData(index); };
  const stage = Object.assign(new Stage(), { mounted: true, chapterTitle: '章',
    contentRevision: 10, lastAppliedContentRevision: 10, changedFragmentIndex: 500,
    titleItemCount: 1, initialScrollPending: true, visibleFragmentStart: 0,
    fragmentsProvider: () => fragments, fragmentDataSource: ds,
    fragmentIndexById: new Map(fragments.map((fragment,index) => [fragment.id,index])),
    continuousListItems: () => assert.fail('single-image refresh must not copy the chapter') });
  fragments[500] = { id: 'fragment-500', fileUri: 'file:///first' };
  stage.contentRevision = 11;
  stage.onContentRevisionChanged();
  assert.deepEqual(changed, [501]);
  assert.ok(reads < 8, 'one image uses bounded data-source lookups');

  changed.length = 0;
  fragments[200] = { id: 'fragment-200', fileUri: 'file:///second' };
  fragments[800] = { id: 'fragment-800', fileUri: 'file:///third' };
  stage.changedFragmentIndex = 800;
  stage.contentRevision = 13;
  stage.onContentRevisionChanged();
  assert.deepEqual(changed, [201, 801], 'coalesced image revisions notify both lazy rows');
  assert.equal(ds.getData(201), fragments[200]);
  assert.equal(ds.getData(801), fragments[800]);
}
console.log('PASS known image geometry: prepared admission, invalid/remote fallback, original versus decoded sizes, mismatch rejection, forward-independent reverse/continuous geometry, deduplicated late leases, frozen pages, texture invalidation, stale/exit protection and invariant page/progress/scroll anchors. No device pixel claim.');
