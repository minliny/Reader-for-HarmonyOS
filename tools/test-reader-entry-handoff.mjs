import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire, registerHooks, stripTypeScriptTypes } from 'node:module';
import { ReadingEntryHandoff, registerReadingEntryMemoryRelease, releaseReadingEntryMemory,
  estimateRetainedRemoteSessionBytes } from '../entry/src/main/ets/features/reading/ReadingEntryHandoff.ts';
import { productionMotionMethods } from './lib/reader-motion-method-probe.mjs';
import { ReadingPaginationPrefix } from '../entry/src/main/ets/features/reading/ReadingPaginationIndex.ts';
registerHooks({ resolve(specifier, context, next) {
  try { return next(specifier, context); } catch (error) {
    if (specifier.startsWith('.') && !specifier.endsWith('.ts')) return next(`${specifier}.ts`, context);
    throw error;
  }
} });
const { ReadingSessionFlowGateway } = await import('../entry/src/main/ets/features/reading/ReadingSessionFlowGateway.ts');
const file = new URL('../entry/src/main/ets/features/reading/LocalReadingExperience.ets', import.meta.url);
const handoff = new ReadingEntryHandoff();
let current = true;
assert.equal(handoff.publish('local', 'a', { marker: 1 }, 40, () => current), true);
assert.equal(handoff.current('local', 'a').marker, 1);
assert.equal(handoff.current('remote', 'a'), undefined);
current = false;
assert.equal(handoff.current('local', 'a'), undefined);
current = true;
assert.equal(handoff.current('local', 'a'), undefined, 'invalidated handoffs never revive');
assert.equal(handoff.publish('local', 'large', {}, 16 * 1024 * 1024 + 1, () => true), false);
assert.equal(handoff.current('local', 'large'), undefined, 'optional data has a byte cap');
{
  const owner = {}, other = {};
  handoff.publish('local','a',{},1,()=>true);
  registerReadingEntryMemoryRelease(owner,()=>handoff.clear());
  releaseReadingEntryMemory(other); assert.ok(handoff.current('local','a'));
  releaseReadingEntryMemory(owner); assert.equal(handoff.current('local','a'),undefined);
  let preparationDrops=0;
  const Runtime = productionMotionMethods(new URL('../entry/src/main/ets/app/ReaderRuntimeOwner.ts',import.meta.url),
    ['releaseOptionalReadingEntryMemory'], {releaseReadingEntryMemory});
  const Ability = productionMotionMethods(new URL('../entry/src/main/ets/entryability/EntryAbility.ets',import.meta.url),['onMemoryLevel']);
  const runtime = Object.assign(new Runtime(),{entryPreparations:{releaseOptionalMemory(){preparationDrops++;}}});
  const ability = Object.assign(new Ability(),{runtimeOwner:runtime});
  handoff.publish('local','a',{},1,()=>true);
  registerReadingEntryMemoryRelease(runtime,()=>handoff.clear());
  ability.onMemoryLevel(2);
  assert.equal(preparationDrops,1); assert.equal(handoff.current('local','a'),undefined);
}

let metrics = { ready: true, densityPixels: 3, windowRect: { width: 390, height: 844 } };
let paused = false;
const runtime = { optionalReadingEntryMemoryEnabled: () => true, readingEntryPreparations: () => ({ setPaused(value) { paused = value; } }) };
const Owner = productionMotionMethods(file, ['restoreRetainedReadingPresentation', 'admitInitialWindowGeometry'], {
  ReadingPaginationPrefix,
  ReaderRuntimeOwner: { current: () => runtime }, ReaderWindowCoordinator: { metrics: () => metrics },
});
function fixture() {
  const events = [];
  const appearance = { font: 'serif' }, settings = { navigationMode: 'paged' };
  const chapter = { chapterIndex: 4, chapterTitle: '正确的章节', images: [] };
  const page = { startScalar: 123, endScalar: 150, fragments: [{ text: '正确保存位置的正文' }] };
  const key = { sourceId: 'local', bookId: 'book', chapterIndex: 4, contentVersion: 'body', layoutSignature: 'real-window-font-layout' };
  const snapshot = { sourceId: 'local', bookId: 'book', isCurrent: () => true,
    gateway: { hasPendingSourceSwitch: () => false, remoteSession: () => undefined },
    context: { chapter, contentVersion: 'body', paginationDraft: new ReadingPaginationPrefix(key,
      { requestScalar: 124, startScalar: 123, endScalarExclusive: 150 }) }, page, toc: [{ index: 4, title: chapter.chapterTitle }],
    progress: { chapterIndex: 4, chapterOffset: 123, chapterProgress: 0.4 },
    appearanceKey: JSON.stringify(appearance), settingsKey: JSON.stringify(settings),
    layoutKey: 'real-window-font-layout', densityPixels: 3 };
  const owner = Object.assign(new Owner(), { sourceId: 'local', bookId: 'book', readerSettingsLoaded: true,
    appearanceSnapshot: appearance, readerSettingsSnapshot: settings, chapterSelectionToken: 1,
    entryPresentationProvider: () => snapshot, hasMeasuredViewport: () => true,
    isSelectionActive(_lifecycle, selection) { return this.chapterSelectionToken === selection; },
    paginationLayoutSignature: () => 'real-window-font-layout', visibleFragments: [], phase: 'loading',
    admitTocEntries(toc) { this.tocEntries = toc; }, readingTocEntries() { return this.tocEntries; },
    chapterWindow: { configure() {}, setCurrent() {} },
    restoreMaterializedChapterContext(context, admit) { assert.equal(admit, true); this.chapter = context.chapter; },
    rebuildChapterImageIndexes() {},
    publishMeasuredFirstPage(next) { this.visiblePage = next; this.visibleFragments = next.fragments; events.push('body'); },
    admitCommittedProgress(progress) { this.lastCommittedProgress = progress; },
    configureReaderScreenAwakeLease(value) { assert.equal(value, settings); },
    applyReaderSystemEventPolicy(value) { assert.equal(value, settings); }, beginReadingRecordClock() {},
    onDirectoryProjectionChanged() {}, onRemoteSessionReady() {}, schedulePageTurnPreparation() {},
    notifyControlSelectionReadingReady() { events.push('ready'); },
  });
  return { owner, snapshot, page, events };
}
{
  const f = fixture();
  assert.equal(f.owner.restoreRetainedReadingPresentation(1), true);
  assert.equal(f.owner.visiblePage, f.page);
  assert.equal(f.owner.desiredChapterOffset, 123);
  assert.equal(f.owner.phase, 'ready');
  assert.deepEqual(f.events, ['body', 'ready'], 'synchronous body exists before ready without any I/O');
  assert.equal(paused, true);
}
for (const reason of ['stale', 'book', 'chapter-request', 'bookmark', 'transaction', 'gateway-transaction', 'content-version', 'page-end', 'observation-missing',
  'font', 'appearance', 'settings', 'layout', 'density', 'viewport', 'settings-unknown', 'missing']) {
  const f = fixture();
  if (reason === 'stale') f.snapshot.isCurrent = () => false;
  if (reason === 'book') f.snapshot.bookId = 'other';
  if (reason === 'chapter-request') f.owner.requestedChapterIndex = 4;
  if (reason === 'bookmark') f.owner.requestedBookmarkAnchor = {};
  if (reason === 'transaction') f.owner.sourceSwitchTransactionId = 'switch';
  if (reason === 'gateway-transaction') f.snapshot.gateway.hasPendingSourceSwitch = () => true;
  if (reason === 'font') f.owner.appearanceSnapshot.customFont = {};
  if (reason === 'appearance') f.snapshot.appearanceKey = 'old';
  if (reason === 'settings') f.snapshot.settingsKey = 'old';
  if (reason === 'layout') f.snapshot.layoutKey = 'old';
  if (reason === 'density') f.snapshot.densityPixels = 2;
  if (reason === 'viewport') f.owner.hasMeasuredViewport = () => false;
  if (reason === 'settings-unknown') f.owner.readerSettingsLoaded = false;
  if (reason === 'missing') f.owner.entryPresentationProvider = () => undefined;
  if (reason === 'content-version') f.snapshot.context.contentVersion = 'new';
  if (reason === 'page-end') f.snapshot.page.endScalar++;
  if (reason === 'observation-missing') f.snapshot.context.paginationDraft = undefined;
  assert.equal(f.owner.restoreRetainedReadingPresentation(1), false, reason);
  assert.deepEqual(f.events, [], `${reason}: normal acquisition remains available; no stale publication`);
}
for (const callback of ['admitCommittedProgress', 'onDirectoryProjectionChanged', 'onRemoteSessionReady']) {
  const f = fixture();
  f.snapshot.gateway.remoteSession = () => ({});
  f.owner[callback] = () => { f.owner.chapterSelectionToken++; f.owner.phase = 'measuring'; };
  assert.equal(f.owner.restoreRetainedReadingPresentation(1), true, 'the handoff was consumed before observer re-entry');
  assert.deepEqual(f.events, ['body'], `${callback}: re-entry must not announce the old page under the new selection`);
  assert.equal(f.owner.phase, 'measuring');
}
{
  const f = fixture();
  f.owner.admitInitialWindowGeometry();
  assert.equal(f.owner.viewportWidth, 390); assert.equal(f.owner.viewportHeight, 844);
  metrics = { ...metrics, ready: false, windowRect: { width: 600, height: 900 } };
  f.owner.admitInitialWindowGeometry();
  assert.equal(f.owner.viewportWidth, 390, 'unconfirmed geometry cannot replace observed facts');
}
// Run the actual retention method and DTO constructors, including the real
// SessionGateway it creates. Resource assertions must inspect the resulting
// reference graph, not only the displayed chapter's images flag.
const require = createRequire(import.meta.url);
const sdk = process.env.READER_ETS_LOADER_ROOT ?? '/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/ets/build-tools/ets-loader';
const ts = require(`${sdk}/node_modules/typescript`), options = require(`${sdk}/lib/ets_checker.js`).compilerOptions;
const tree = ts.createSourceFile('/tmp/ReaderEntryRetain.ets', readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.ETS, options);
const classes = Object.fromEntries(['ReaderRetainedPresentation', 'ReaderMaterializedChapterContext'].map(name => {
  const node = tree.statements.find(node => ts.isClassDeclaration(node) && node.name?.getText(tree) === name);
  assert.ok(node, name);
  return [name, new Function(stripTypeScriptTypes(node.getText(tree)).replace(/^export /, '') + `;return ${name};`)()];
}));
function retentionFixture() {
  const retained = new ReadingEntryHandoff();
  const runtime = { optionalReadingEntryMemoryEnabled: () => true, readingEntryPreparations: () => ({ captureValidity: () => () => true }) };
  const Owner = productionMotionMethods(file, ['retainConfirmedEntryPresentation', 'samePaginationKey'], { ...classes, ReadingPaginationPrefix,
    ReaderRuntimeOwner: { current: () => runtime }, ReaderWindowCoordinator: { metrics: () => ({ densityPixels: 3 }) },
    ReadingSessionFlowGateway, readingEntryHandoff: () => retained, estimateRetainedRemoteSessionBytes,
  });
  const appearance = { fontSize: 20 }, oldImage = { imageUrl: 'old.png', pixelMap: { nativeResource: true } };
  const remote = { identity: { sourceId: 'remote', bookId: 'book' }, book: { title: 'Book', author: 'Author' },
    entries: [{ index: 4, title: 'Current chapter', url: '/4', variables: [] }], continuationVariables: [],
    preparedChapter: { content: 'Old chapter', images: [oldImage] } };
  const gateway = new ReadingSessionFlowGateway('remote', 'book', { kind: 'remote', session: remote }, runtime);
  const chapter = { chapterIndex: 4, chapterTitle: 'Current chapter', content: 'Current text only', images: [] };
  const key = { sourceId: 'remote', bookId: 'book', chapterIndex: 4, contentVersion: 'current', layoutSignature: 'layout' };
  const page = { startScalar: 4, endScalar: 13, fragments: [{ text: 'text only' }], measuredAppearance: appearance,
    paginationKey: key, paginationObservation: { requestScalar: 5, startScalar: 4, endScalarExclusive: 13 } };
  const context = { chapter, layoutMap: {}, contentVersion: 'current', paragraphRanges: [{ startScalar: 0, endScalar: 17 }] };
  const owner = Object.assign(new Owner(), { sourceId: 'remote', bookId: 'book', phase: 'ready', chapter,
    visiblePage: page, lastCommittedProgress: { sourceId: 'remote', bookId: 'book', chapterIndex: 4, chapterOffset: 4, chapterProgress: .2 },
    sessionGateway: gateway, hasMeasuredViewport: () => true, readerSettingsSnapshot: { navigationMode: 'paged' },
    appearanceSnapshot: appearance, paragraphRanges: context.paragraphRanges, captureMaterializedChapterContext: () => context,
    tocEntries: [{ index: 4, title: 'Current chapter', bookmarks: [{ note: 'old annotation' }] }],
    paginationLayoutSignature: () => 'layout', currentPaginationKey: () => key });
  return { owner, remote, retained, gateway, chapter, page };
}
{
  const f = retentionFixture(), previous = f.remote.preparedChapter;
  f.owner.retainConfirmedEntryPresentation();
  const snapshot = f.retained.current('remote', 'book');
  assert.ok(snapshot); assert.equal(snapshot.page, f.page); assert.equal(snapshot.context.chapter, f.chapter);
  assert.notEqual(snapshot.gateway, f.gateway);
  assert.equal(snapshot.gateway.remoteSession().preparedChapter, undefined, 'handoff cannot retain an old prepared image chapter');
  assert.equal(f.remote.preparedChapter, previous, 'original session is not mutated');
  assert.equal(snapshot.toc[0].bookmarks, undefined, 'independently mutable bookmark projections are not retained');
}
{
  const f = retentionFixture();
  f.remote.entries[0].variables = [{ name: 'large', value: 'x'.repeat(9 * 1024 * 1024) }];
  f.owner.captureMaterializedChapterContext = () => { assert.fail('oversize catalog must be rejected before context copying'); };
  f.remote.toJSON = () => { assert.fail('retention must not serialize a remote session'); };
  f.owner.retainConfirmedEntryPresentation();
  assert.equal(f.retained.current('remote', 'book'), undefined, 'remote catalog counts against the 16 MiB limit');
}
for (const field of ['paragraphRanges', 'tocEntries']) {
  const f = retentionFixture();
  f.owner[field] = new Proxy(new Array(4097), { get(target, key) {
    assert.equal(key, 'length', 'oversize collections must be rejected without traversal');
    return target.length;
  } });
  f.owner.captureMaterializedChapterContext = () => { assert.fail('oversize collection cannot be copied'); };
  f.owner.retainConfirmedEntryPresentation();
  assert.equal(f.retained.current('remote', 'book'), undefined);
}
{
  const f = retentionFixture();
  f.remote.entries = new Proxy(new Array(4097), { get(target, key) {
    assert.equal(key, 'length', 'oversize remote entries must be rejected without traversal');
    return target.length;
  } });
  f.owner.captureMaterializedChapterContext = () => { assert.fail('oversize remote catalog cannot copy context'); };
  f.owner.retainConfirmedEntryPresentation();
  assert.equal(f.retained.current('remote', 'book'), undefined);
}
for (const reason of ['images', 'custom-font', 'chapter-size', 'observation-missing', 'observation-content', 'observation-layout', 'observation-end']) {
  const f = retentionFixture();
  if (reason === 'images') f.chapter.images.push({ imageUrl: 'current.png' });
  if (reason === 'custom-font') f.owner.appearanceSnapshot.customFont = { id: 'font' };
  if (reason === 'chapter-size') f.chapter.content = 'x'.repeat(2 * 1024 * 1024);
  if (reason === 'observation-missing') f.page.paginationObservation = undefined;
  if (reason === 'observation-content') f.page.paginationKey = { ...f.page.paginationKey, contentVersion: 'stale' };
  if (reason === 'observation-layout') f.page.paginationKey = { ...f.page.paginationKey, layoutSignature: 'stale' };
  if (reason === 'observation-end') f.page.paginationObservation = { ...f.page.paginationObservation, endScalarExclusive: 14 };
  f.owner.retainConfirmedEntryPresentation();
  assert.equal(f.retained.current('remote', 'book'), undefined, reason);
}
console.log('optional confirmed entry handoff: synchronous real body, ownership/layout fences, old remote image lease removed without mutation, catalog/body byte cap, image/custom-font refusal and annotation isolation PASS');
