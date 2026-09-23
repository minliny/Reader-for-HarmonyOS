import { installReaderMeasurementOwner } from './lib/reader-measurement-owner-fixture.mjs';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire, stripTypeScriptTypes } from 'node:module';
import { productionMotionMethods } from './lib/reader-motion-method-probe.mjs';
import { createReaderBuilderProbe } from './lib/reader-control-builder-probe.mjs';
import { copyReaderAppearanceSnapshot, createDefaultReaderAppearanceSnapshot } from '../entry/src/main/ets/features/reading/ReaderAppearanceState.ts';
import * as appearanceStyle from '../entry/src/main/ets/features/reading/ReaderAppearanceRenderStyle.ts';
import { ReaderPageChromeSnapshot } from '../entry/src/main/ets/features/reading/ReaderPageChromeModel.ts';
import { ReadingSessionProgressOwner } from '../entry/src/main/ets/features/reading/ReadingSessionProgressOwner.ts';

// Execute production methods and SDK-emitted Builder closures. These assertions
// concern publication inputs and async ownership, not native paint timing.
const lreFile = new URL('../entry/src/main/ets/features/reading/LocalReadingExperience.ets', import.meta.url);
const stageFile = new URL('../entry/src/main/ets/features/reading/ReaderPageTurnStage.ets', import.meta.url);
const lreSource = readFileSync(lreFile, 'utf8'), stageSource = readFileSync(stageFile, 'utf8');
const require = createRequire(import.meta.url);
const sdk = process.env.READER_ETS_LOADER_ROOT ?? '/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/ets/build-tools/ets-loader';
const ts = require(`${sdk}/node_modules/typescript`), options = require(`${sdk}/lib/ets_checker.js`).compilerOptions;
function actualClass(source, name, dependencies = {}) {
  const tree = ts.createSourceFile('/tmp/AppearancePage.ets', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.ETS, options);
  const node = tree.statements.find(n => ts.isClassDeclaration(n) && n.name?.getText(tree) === name);
  assert.ok(node, name);
  return new Function(...Object.keys(dependencies), stripTypeScriptTypes(node.getText(tree)).replace(/^export /, '') + `;return ${name};`)(...Object.values(dependencies));
}
const PhysicalReadingPage = actualClass(lreSource, 'PhysicalReadingPage');
const CoreReadingAnchor = actualClass(lreSource, 'CoreReadingAnchor');
const ReaderPageTurnRenderPage = actualClass(stageSource, 'ReaderPageTurnRenderPage', { ReaderPageChromeSnapshot });
const snapshot = size => ({ ...createDefaultReaderAppearanceSnapshot(), fontSize: size });
const page = size => new PhysicalReadingPage([{ text: `measured-${size}`, startScalar: 173, endScalar: 223 }], 173, 223, 300, 600, snapshot(size));
function deferred() { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; }
const settle = async () => { for (let i = 0; i < 5; i++) await new Promise(resolve => setImmediate(resolve)); };
const methods = ['admitAppearanceSnapshot', 'sameAppearanceLayout', 'visibleReadingAppearance', 'pageReadingAppearance',
  'beginMeasurement', 'measuredPageEndLimit', 'retainMeasuredParagraphWindow', 'beginFirstPageCommit', 'publishMeasuredFirstPage', 'completeFirstPage', 'resumeSupersededAppearanceMeasurement', 'resumeDeferredMeasurement',
  'persistOrdinaryFirstPage', 'isOrdinaryFirstPagePresentationCurrent', 'awaitOrdinaryFirstPagePersistence', 'isOrdinaryPageMeasurement',
  'isMountedToken', 'isSessionActive', 'isSelectionActive', 'isSelectionCurrent', 'isMeasurementCurrent', 'hasCurrentMaterializedChapter',
  'hasContinuousRenderContent', 'currentPageTurnRenderPage', 'preparedPageTurnRenderPage',
  'resumeDeferredPageTurnWork', 'clearDeferredPageTurnWork'];
function fixture({ mode = 'paged', initial = true, queued = false, file = lreFile } = {}) {
  const Owner = productionMotionMethods(file, methods, { ...appearanceStyle, copyReaderAppearanceSnapshot,
    PhysicalReadingPage, CoreReadingAnchor, ReaderPageTurnRenderPage, TextController: class {}, hilog: { error() {} } });
  const owner = new Owner(), events = [], writes = [], commits = [], queueGate = deferred();
  const ranges = [{ id: 'p', startScalar: 0, endScalar: 1000, startUtf16: 0, endUtf16: 1000 }];
  const chapter = { chapterIndex: 2, chapterTitle: 'chapter', bodyVersion: 'body', processingVersion: 'processing' };
  const old = initial ? page(20) : undefined;
  let activeTurn = false;
  const Serial=productionMotionMethods(new URL('../entry/src/main/ets/features/reading/LocalReadingFlowGateway.ts',import.meta.url),['runProgressCommitSerial']);
  const lane=Object.assign(new Serial(),{progressCommitTail:Promise.resolve()});
  const persistence=new ReadingSessionProgressOwner({captureReadingContentValidity:()=>()=>true},'source','book',fn=>lane.runProgressCommitSerial(fn));
  const gateway = { runProgressCommitSerial: async fn => { if (queued) await queueGate.promise; return persistence.runSerial(fn); },
    resolveAndUpdateProgress: (...args) => { const gate = deferred(); writes.push({ args, gate }); return gate.promise; } };
  gateway.persistPresentedProgress=(_book,title,anchor,layout)=>persistence.persistPresented(title,anchor,layout,{
    read:async()=>({kind:'missing'}), write:(title,anchor,layout,guard)=>gateway.resolveAndUpdateProgress('book',title,anchor,layout,guard)});
  gateway.awaitPresentedProgressPersistence=()=>persistence.awaitPersistence();
  Object.assign(owner, {
    mounted: true, exitRequested: false, lifecycleToken: 1, chapterSelectionToken: 2, materializedChapterSelectionToken: 2,
    measurementGeneration: 7, measurementSelectionToken: 2, measurementEpoch: 0, measurementBatch: [], measurementCompleting: false,
    phase: initial ? 'ready' : 'measuring', readerSettingsSnapshot: { navigationMode: mode },
    sourceId: 'source', bookId: 'book', chapter, chapterLayoutMap: {
      scalarCount: () => 1000, residentStart: () => 0, residentEnd: () => 1000,
    },
    appearanceSnapshot: snapshot(20), visiblePage: old, visiblePageSelectionToken: 2, visibleFragments: old?.fragments ?? [],
    continuousFragments: initial && mode === 'continuous' ? [{ text: 'old-continuous' }] : [], continuousRenderRevision: 0,
    continuousVisibleScalar: 173, desiredChapterOffset: 173, desiredChapterProgress: .173,
    hasMeasuredViewport: () => true, pageTurnInputPhase: () => activeTurn ? 'settling' : 'idle',
    rollbackPageTurnForDeferredMutation: () => events.push('turn-rollback'), invalidatePageTurnRuntime: () => events.push('invalidate'),
    applyWindowChrome: () => events.push('chrome'), paginationLayoutSignature: () => `font-${owner.appearanceSnapshot.fontSize}`,
    paginationIndex: { invalidateLayout: (...args) => events.push(['invalidate-layout', ...args]), findContainingPage: () => undefined },
    resetPaginationDraft: () => events.push('reset-draft'), measuringChapter: () => chapter,
    measuringRanges: () => ranges, requireMeasurementLayoutMap: () => owner.chapterLayoutMap,
    requireMeasurementChapter: () => chapter,
    measuringDraft: () => undefined, measurementPaginationKey: () => ({ layoutSignature: owner.paginationLayoutSignature() }),
    measuringRequestedAnchor: () => owner.desiredChapterOffset,
    lastMeasurableScalar: () => 999, measuringOffset: () => owner.desiredChapterOffset,
    setMeasuringOffset: value => { owner.desiredChapterOffset = value; }, setMeasuringProgress() {}, setMeasuringRequestedAnchor() {},
    rebuildContinuousFragments: () => { owner.continuousFragments = [{ text: `continuous-${owner.visibleReadingAppearance().fontSize}` }]; events.push(['continuous-rebuild', owner.visibleReadingAppearance().fontSize]); },
    setContinuousInitialAnchor: value => events.push(['continuous-anchor', value]), rangeIndexForOffset: () => 0,
    resetPendingPage() {}, ensureFirstPageReadyDeadline: () => events.push('first-page-deadline'),
    prepareNextMeasurementBatch: () => { events.push(['measure', owner.appearanceSnapshot.fontSize]); return true; }, armMeasurementDeadline() {},
    activeGateway: () => gateway, requireChapter: () => chapter, requireChapterLayoutMap: () => owner.chapterLayoutMap,
    coreLayout: () => ({ fontSize: owner.appearanceSnapshot.fontSize }),
    releaseUnretainedReadingImages() {}, isChapterFirstPageStart: () => false, beginReadingRecordClock() {}, finishPageTurnPerf() {},
    cancelFirstPageReadyDeadline() {}, cancelFirstPageCompletionDeadline() {}, schedulePageTurnPreparation() {},
    admitCommittedProgress: stored => commits.push(stored), completeControlSelectionAfterCommit() {},
    notifyReadingPresentationReady: () => true,
    notifyControlSelectionReadingReady: () => { events.push(['ready', owner.visiblePage?.measuredAppearance?.fontSize]); return true; },
    prefetchNextChapter() {}, completeRapidPageTurnTransaction() {}, drainRapidPageTurn() {}, onAutoPagePageCommitted() {},
    errorMessage: error => error.message,
    fail: error => { events.push(['failure', error.message]); owner.phase = 'failed'; },
    observeMeasuredPhysicalPage: measured => { owner.lastMeasuredPage = measured; }, pendingPageBodyCapacity: () => 600,
    cancelMeasurementDeadline() {}, continueCanonicalModeMeasurement: () => false, armFirstPageCompletionDeadline() {},
    pageTurnRenderRevision: 1, pageTurnFrozenRevision: -1, materializedContentVersion: 'body',
    pageChromePaginationKey: () => ({ layoutSignature: owner.paginationLayoutSignature() }),
    pageChromeSnapshot: () => new ReaderPageChromeSnapshot(), pageBottomJustifyGap: () => 0,
    bookTurnTextureIdentity: () => 'texture', bookTurnSurfaceIdentity: () => 'surface', isPreparedPageTurnFresh: () => true,
  });
  installReaderMeasurementOwner(owner);
  owner.clearDeferredPageTurnWork();
  return { owner, old, events, writes, commits, queueGate, turn(value) { activeTurn = value; },
    start(size) { owner.admitAppearanceSnapshot(snapshot(size)); },
    finish(size, startScalar = 173) {
      const measured = page(size); measured.startScalar = startScalar; owner.measurementCompleting = true;
      return owner.completeFirstPage(measured, owner.measurementGeneration, 2, 1);
    },
    ack(index = writes.length - 1, offset = 173) { writes[index].gate.resolve({ bookId: 'book', chapterIndex: 2, chapterOffset: offset, bodyVersion: 'body', processingVersion: 'processing' }); },
  };
}
const cases = [];
for (const mode of ['paged', 'continuous']) {
  const f = fixture({ mode }); f.start(21);
  assert.equal(f.owner.visiblePage, f.old); assert.equal(f.owner.visibleReadingAppearance().fontSize, 20);
  assert.equal(f.owner.currentPageTurnRenderPage().appearance.fontSize, 20);
  assert.equal(f.owner.appearanceSnapshot.fontSize, 21, 'control and hidden measurement admit the latest font intent');
  if (mode === 'continuous') assert.equal(f.events.some(e => Array.isArray(e) && e[0] === 'continuous-rebuild'), false);
  const finishing = f.finish(21, 170); await settle();
  f.start(22); assert.equal(f.owner.visibleReadingAppearance().fontSize, 20);
  assert.equal(f.owner.desiredChapterOffset, 173); assert.equal(f.writes[0].args[3].fontSize, 21, 'Core write keeps measured layout');
  assert.equal(f.writes[0].args[4](), true, 'new font intent does not cancel the already-dispatched atomic Core write');
  f.ack(0, 170); await finishing;
  assert.equal(f.owner.visiblePage, f.old, 'superseded ACK cannot expose its line breaks');
  assert.equal(f.events.some(e => Array.isArray(e) && e[0] === 'ready'), false);
  assert.equal(f.owner.measurementCompleting, false); assert.equal(f.owner.remeasurePending, false);
  assert.equal(f.owner.desiredChapterOffset, 173, 'superseded rounded page start cannot replace the semantic reflow anchor');
  assert.equal(f.events.filter(e => Array.isArray(e) && e[0] === 'measure').at(-1)[1], 22);
  assert.equal(f.commits.length, 1, 'a confirmed obsolete Core write remains known');
  const latest = f.finish(22); await settle(); f.ack(); await latest;
  assert.equal(f.owner.visibleReadingAppearance().fontSize, 22); assert.equal(f.owner.visibleFragments[0].text, 'measured-22');
  assert.deepEqual(f.events.filter(e => Array.isArray(e) && e[0] === 'ready'), [['ready', 22]]);
  if (mode === 'continuous') assert.deepEqual(f.events.filter(e => Array.isArray(e) && e[0] === 'continuous-rebuild'), [['continuous-rebuild', 22]]);
  cases.push(`20→21→22:${mode}:ACK`);
}
{
  const f = fixture({ queued: true }); f.start(21); const pending = f.finish(21); f.start(22);
  f.queueGate.resolve(); await pending;
  assert.equal(f.writes.length, 0, 'obsolete queued page must not dispatch a Core write');
  assert.equal(f.owner.visiblePage, f.old); assert.equal(f.owner.measurementCompleting, false);
  assert.equal(f.events.filter(e => Array.isArray(e) && e[0] === 'measure').at(-1)[1], 22);
  cases.push('queued-old-layout');
}
for (const outcome of ['obsolete-reject', 'obsolete-wrong-anchor', 'current-reject', 'obsolete-generation', 'unmount']) {
  const f = fixture(); f.start(21); const pending = f.finish(21); await settle();
  if (outcome !== 'current-reject') f.start(22);
  if (outcome === 'obsolete-generation') f.owner.paginationIndex.invalidateMeasurement();
  if (outcome === 'unmount') f.owner.mounted = false;
  if (outcome === 'obsolete-wrong-anchor') f.ack(0, 176); else f.writes[0].gate.reject(Error('WRITE_REJECTED'));
  await pending;
  assert.equal(f.owner.visiblePage, f.old);
  const failures = f.events.filter(e => Array.isArray(e) && e[0] === 'failure');
  assert.equal(failures.length, ['obsolete-wrong-anchor', 'current-reject'].includes(outcome) ? 1 : 0);
  if (outcome === 'obsolete-wrong-anchor') assert.equal(failures[0][1], 'READING_INITIAL_PROGRESS_ANCHOR_MISMATCH');
  cases.push(outcome);
}
{
  const f = fixture({ initial: false }); f.start(21);
  assert.equal(f.owner.visibleReadingAppearance().fontSize, 21); assert.equal(f.owner.visiblePage, undefined);
  assert.ok(f.events.includes('first-page-deadline'));
  const pending = f.finish(21); await settle(); assert.equal(f.owner.visibleFragments[0].text, 'measured-21');
  assert.equal(f.owner.phase, 'ready');assert.equal(f.events.some(e => Array.isArray(e) && e[0] === 'ready'), false);
  f.ack(); await pending; assert.equal(f.owner.visibleReadingAppearance().fontSize, 21);
  cases.push('cold-first-page');
}
for (const mode of ['paged', 'continuous']) {
  const f = fixture({ mode, initial: false }); f.start(21);
  const pending = f.finish(21); await settle(); const preview = f.owner.visiblePage;
  assert.equal(preview.measuredAppearance.fontSize, 21); assert.equal(f.owner.phase, 'ready');
  f.start(22); assert.equal(f.owner.visiblePage, preview); assert.equal(f.owner.visibleReadingAppearance().fontSize, 21);
  f.ack(); await pending;
  assert.equal(f.owner.visiblePage, preview, 'confirmed obsolete layout cannot publish a new frame');
  assert.equal(f.events.some(e => Array.isArray(e) && e[0] === 'ready'), false);
  const latest = f.finish(22); await settle(); f.ack(); await latest;
  assert.equal(f.owner.visibleReadingAppearance().fontSize, 22);
  assert.deepEqual(f.events.filter(e => Array.isArray(e) && e[0] === 'ready'), [['ready', 22]]);
  cases.push(`cold-projection-reflow:${mode}`);
}
{
  const f = fixture(); const dark = { ...snapshot(20), activeTheme: 'night' }; f.owner.admitAppearanceSnapshot(dark);
  assert.equal(f.owner.visibleReadingAppearance().activeTheme, 'night'); assert.equal(f.owner.visibleReadingAppearance().fontSize, 20);
  assert.equal(f.old.measuredAppearance.activeTheme, snapshot(20).activeTheme, 'theme overlay does not mutate measured snapshot');
  assert.equal(f.events.some(e => Array.isArray(e) && e[0] === 'measure'), false);
  f.start(21); f.owner.admitAppearanceSnapshot({ ...snapshot(21), activeTheme: 'night' });
  assert.equal(f.owner.visibleReadingAppearance().activeTheme, 'night'); assert.equal(f.owner.visibleReadingAppearance().fontSize, 20);
  cases.push('theme-immediate-during-reflow');
}
{
  const f = fixture(); f.turn(true); f.start(21); f.start(22);
  assert.equal(f.owner.appearanceSnapshot.fontSize, 20); assert.equal(f.owner.pageTurnPendingAppearanceSnapshot.fontSize, 22);
  assert.equal(f.events.filter(e => Array.isArray(e) && e[0] === 'measure').length, 0);
  f.turn(false); f.owner.resumeDeferredPageTurnWork();
  assert.equal(f.owner.appearanceSnapshot.fontSize, 22); assert.equal(f.owner.visibleReadingAppearance().fontSize, 20);
  assert.equal(f.owner.pageTurnPendingAppearanceSnapshot, undefined);
  cases.push('page-turn-defers-latest-appearance');
}
{
  const f = fixture(); f.start(21);
  Object.assign(f.owner, { pendingPageFragments: [{ text: 'new-21' }], pendingPageStartScalar: 173,
    pendingPageEndScalar: 223, pendingPageHeight: 300 });
  // The actual begin method copies measured typography before dispatching Core.
  f.owner.completeFirstPage = () => Promise.resolve();
  f.owner.beginFirstPageCommit(f.owner.measurementGeneration, 2, 1);
  assert.equal(f.owner.lastMeasuredPage.measuredAppearance.fontSize, 21);
  assert.notEqual(f.owner.lastMeasuredPage.measuredAppearance, f.owner.appearanceSnapshot);
  f.owner.appearanceSnapshot.fontSize = 22;
  assert.equal(f.owner.lastMeasuredPage.measuredAppearance.fontSize, 21);
  const prepared = { page: page(19), key: { chapterIndex: 1, layoutSignature: 'old', contentVersion: 'v' },
    context: { chapter: { chapterTitle: 'previous' }, paragraphRanges: [], layoutMap: { scalarCount: () => 1000 } } };
  f.owner.preparedPreviousPage = prepared;
  assert.equal(f.owner.preparedPageTurnRenderPage('previous').appearance.fontSize, 19);
  cases.push('measured-page-copy-and-adjacent-DTO');
}

const syntax = require(`${sdk}/lib/validate_ui_syntax.js`);
const surfaceSource = readFileSync(new URL('../entry/src/main/ets/features/reading/ReadingSurface.ets', import.meta.url), 'utf8');
for (const [name, source] of [['ReaderPageTurnSurface', stageSource], ['ReadingSurface', surfaceSource]]) {
  syntax.componentCollection.customComponents.add(name);
  syntax.propCollection.set(name, new Set([...source.matchAll(/@Prop\s+(\w+)\s*:/g)].map(m => m[1])));
}
class Child { constructor(owner, params, _storage, id) { Object.assign(this, { owner, params, id }); } }
function stageProbe(source) {
  const onlyStage = source.slice(source.lastIndexOf('@Component', source.indexOf('export struct ReaderPageTurnStage')));
  const stage = createReaderBuilderProbe(onlyStage, ['build'], { ReaderPageTurnSurface: Child }).owner;
  const pages = { a: { fragments: ['20'], appearance: snapshot(20) }, b: { fragments: ['19'], appearance: snapshot(19) } };
  Object.assign(stage, { translateY: 0, currentPageSlot: 'a', layout: {}, appearance: snapshot(21),
    slotPage: slot => pages[slot], slotIdentity: slot => slot, slotSnapshotId: () => '', slotX: () => 0,
    slotVisible: slot => slot === 'a', slotLayer: () => 0, slotShadow: () => 0, hasActiveTurn: () => false });
  stage.initialRender();
  return { stage, pages, fonts: () => [...stage.children.values()].map(child => child.params.appearance.fontSize) };
}
const bound = stageProbe(stageSource);
assert.deepEqual(bound.fonts(), [20, 19], 'each slot renders the typography that measured its own fragments');
bound.stage.appearance = snapshot(22); bound.stage.replay(); assert.deepEqual(bound.fonts(), [20, 19]);
bound.pages.a = { fragments: ['22'], appearance: snapshot(22) }; bound.stage.replay(); assert.deepEqual(bound.fonts(), [22, 19]);
for (const slot of bound.stage.children.values()) {
  const surface = createReaderBuilderProbe(stageSource, ['build'], { ReadingSurface: Child,
    COVER_OCCLUSION_RADIUS_VP: 16, COVER_OCCLUSION_OFFSET_X_VP: 6 }).owner;
  Object.assign(surface, slot.params, { shadowColor: () => '#00000000' }); surface.initialRender();
  assert.equal([...surface.children.values()][0].params.appearance.fontSize, slot.params.appearance.fontSize);
}
cases.push('SDK-slot-bindings-initial-and-update');
const NativeBatch = productionMotionMethods(lreFile, ['measureNativeTextBatch', 'measureNativeChapterTitle', 'measureNativeParagraph'], {
  ...appearanceStyle, UNICODE_PROBE: 'probe', FontWeight: {Regular:400}, TextAlign: {JUSTIFY:'justify',Start:'start'},
});
const batch = new NativeBatch(), nativeStyles=[];
Object.assign(batch, {nativeTextMeasurement:{clear(){},measure(_context,_text,_controller,style){nativeStyles.push(style);}},
  getUIContext:()=>({}),measurementIncludesChapterTitle:()=>false,unicodeProbeVerified:true,
  measurementBatch:[{id:1,text:'new'}],measurementNodeText:p=>p.text,measurementTextWidth:()=>300,
  appearanceSnapshot:snapshot(21)});
batch.measureNativeTextBatch();assert.equal(nativeStyles.length,0,'batch creation must not shape body suffix');
batch.measureNativeParagraph(batch.measurementBatch[0]);assert.equal(nativeStyles[0].fontSize,21,'new measurement uses admitted appearance, while visible page retains its own');
cases.push('native-batch-uses-latest-intent');

// Counterfactual restores only the old Stage font binding. The same compiled
// Builder assertions detect the wrong intermediate page without mutating source.
const oldBinding = stageSource.replaceAll(/this\.slotPage\('[ab]'\)\.appearance \?\? this\.appearance/g, 'this.appearance');
assert.notEqual(oldBinding, stageSource);
const bad = stageProbe(oldBinding);
assert.throws(() => assert.deepEqual(bad.fonts(), [20, 19]), /deep-equal/);
assert.deepEqual(bad.fonts(), [21, 21], 'negative control reproduces new-font/old-lines mismatch');
const oldPublication = lreSource.replace('if (measuredLayoutSignature !== this.paginationLayoutSignature()) {', 'if (false) {');
const mutantFile = '/private/tmp/reader-appearance-obsolete-page-publication.ets'; writeFileSync(mutantFile, oldPublication);
const stale = fixture({ file: mutantFile }); stale.start(21); const pending = stale.finish(21); await settle(); stale.start(22); stale.ack(); await pending;
assert.notEqual(stale.owner.visiblePage, stale.old, 'negative control exposes obsolete page publication');
assert.equal(stale.owner.visiblePage.measuredAppearance.fontSize, 21);
cases.push('negative:old-stage-binding', 'negative:obsolete-ACK-publication');
console.log(JSON.stringify({ passed: true, scenarios: cases.length, cases,
  boundary: 'Actual production methods/classes and SDK Builder closure inputs with controlled Core receipts; no assertion of native reactive scheduling, paint frames, device flicker or user acceptance.' }));
