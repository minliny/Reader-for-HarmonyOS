import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { createHash } from 'node:crypto';
import ts from '/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/ets/build-tools/ets-loader/node_modules/typescript/lib/typescript.js';
import * as gesture from '../../entry/src/main/ets/features/reading/ReaderPageGestureState.ts';
import * as rapid from '../../entry/src/main/ets/features/reading/ReaderRapidPageTurnState.ts';
import { wholeBookProgressPercent } from '../../entry/src/main/ets/features/reading/LocalReadingWholeBookProgress.ts';
import { ReadingPaginationPrefix } from '../../entry/src/main/ets/features/reading/ReadingPaginationIndex.ts';

// Read-only production-method audit. Surrounding I/O, animation and ArkUI
// scheduling are explicitly mocked; outputs are not on-device latency results.
const base = new URL('../../entry/src/main/ets/features/reading/', import.meta.url);
const source = name => readFileSync(new URL(name, base), 'utf8');
function methodText(file, name) {
  const s = source(file), start = s.indexOf(`  private ${name}(`);
  assert.ok(start >= 0, name);
  const end = s.indexOf('\n  private ', start + 10);
  return s.slice(start, end < 0 ? s.lastIndexOf('\n}') : end);
}
function make(file, names, bindings = {}) {
  return new Function(...Object.keys(bindings), stripTypeScriptTypes(
    `class Probe {\n${names.map(n => methodText(file, n)).join('\n')}\n}`, { mode: 'strip' }) + '\nreturn Probe;')(...Object.values(bindings));
}
const result = value => console.log(JSON.stringify(value));
const noop = () => {};
const Pointer = make('ReaderPageInteractionLayer.ets', ['updateRawPointer'], gesture);
const Prepared = class {
  constructor(direction, page, context, key, originChapterIndex, originPageStartScalar, generation) {
    Object.assign(this, { direction, page, context, key, originChapterIndex, originPageStartScalar, generation });
  }
};
const Owner = make('LocalReadingExperience.ets', [
  'requestPageTurn', 'drainRapidPageTurn', 'canTurnPage', 'pageTurnTapOnlyInput',
  'completePreparedPageTurn', 'performPageTurn', 'startPreparedPageTurnSettlement',
], { ...rapid, PreparedReaderPageTurn: Prepared, readerPageTransitionUsesPreparedPages: () => true });
const fixtures = [];

for (const direction of ['next', 'previous']) {
  const events = [];
  const owner = Object.assign(new Owner(), {
    mounted: true, exitRequested: false, controlVisible: () => false,
    controlObscured: false, interactionBlocked: false, phase: 'measuring',
    measurementCompleting: false, commitInFlight: false, continuousCommitInFlight: false,
    visiblePage: { startScalar: 100 }, chapter: { chapterIndex: 0 },
    visiblePageSelectionToken: 1, materializedChapterSelectionToken: 1, chapterSelectionToken: 1,
    pendingPointerSegmentReserved: false, pageTurnSettlementActive: false,
    pageTurnSettlementGeneration: 2, pageTurnGeneration: 1, pageTurnRenderRevision: 0,
    pageTurnPreparation: { direction, origin: {}, originChapterIndex: 0, originPageStartScalar: 100, generation: 1 },
    rapidPageTurnState: rapid.createReaderRapidPageTurnState(), readerSettingsSnapshot: { navigationMode: 'paged' },
    pageTurnGestureState: gesture.startReaderPagePan(390, 195, 200, 0, 800),
    isMeasurementCurrent: () => true, captureMaterializedChapterContext: () => ({}),
    currentPaginationKey: () => ({}), restoreMaterializedChapterContext: noop,
    releaseUnretainedReadingImages: noop, resumePendingAutoPageTurn: noop,
    drainPageTurnPreparationQueue: noop, scheduleBookTurnTextureRefresh: noop,
    usesNoAnimationPageTurnRuntime: () => false, usesBookTurnSimulation: () => false,
    preparedPageTurn(d) { return d === 'next' ? this.preparedNextPage : this.preparedPreviousPage; },
    isPreparedPageTurnFresh: () => true, viewportWidth: 390, lifecycleToken: 1,
    beginPageTurnPerf: noop, readingLayout: () => ({}), armPageTurnSettlementDeadline: noop,
    animatePreparedPageTurnSlide: x => events.push({ kind: 'animate', target: x }),
    beginPreparedPageTurnPersistence: () => events.push({ kind: 'persist' }),
  });
  // A previous completed pointer segment queued an intent while preparation
  // was busy; a new physical pointer begins before preparation completes.
  assert.equal(owner.requestPageTurn(direction).kind, 'busy');
  assert.equal(owner.pageTurnTapOnlyInput(), false);
  const pointer = Object.assign(new Pointer(), {
    gestureState: owner.pageTurnGestureState, activePointerId: 7,
    tapOnlyPointer: false, pointerRejected: false, velocityX: 0, velocityY: 0,
    pageLocalX: (_e, p) => p.x, pageLocalY: (_e, p) => p.y, eventTimeMs: e => e.time,
    updateVelocity: noop, isPageOwner: s => s.owner === 'horizontalPage',
    canStartTurn: () => owner.canTurnPage(), canStartBookmark: () => true,
    reportManualInteraction: noop, clearLongPressTimer: noop, ownPointer: noop,
    armPointerWatchdog: noop, onGestureStateChange: s => { owner.pageTurnGestureState = s; },
    onBookmarkStateChange: noop,
  });
  pointer.updateRawPointer({ time: 60 }, { x: direction === 'next' ? 115 : 275, y: 200 });
  assert.equal(pointer.pointerRejected, true);
  assert.equal(events.length, 0);
  // No further MOVE, UP, CANCEL or timer is executed here. Only the real
  // preparation-completion method and its real drain/settlement chain run.
  owner.completePreparedPageTurn({ startScalar: 200 }, 1, 1, 1);
  assert.equal(pointer.activePointerId, 7);
  assert.equal(owner.pageTurnGestureState.active, true);
  assert.equal(owner.pageTurnSettlementActive, true);
  assert.deepEqual(events.map(e => e.kind), ['animate', 'persist']);
  result({ case: 'old queued intent starts while newer pointer is still held', direction,
    activePointer: pointer.activePointerId, newPointerUpReceived: false, events,
    meaning: 'old intent bypasses active pointer ownership; conditional code reproduction, not attribution of all user delays' });
  fixtures.push({ owner, events });
}

const Auto = make('LocalReadingExperience.ets', ['requestAutoPageTurn'], { isReaderAutoPageTurnDue: () => true });
const Volume = make('LocalReadingExperience.ets', ['onVolumeKeyPageTurn']);
for (const producer of ['autoPage', 'volumeKey']) {
  const { owner, events } = fixtures[0];
  events.length = 0;
  Object.assign(owner, {
    pageTurnSettlementActive: false, pageTurnSettlingPrepared: undefined,
    rapidPageTurnState: rapid.createReaderRapidPageTurnState(),
    pageTurnGestureState: gesture.startReaderPagePan(390, 195, 200, 100, 800),
    autoPageState: { generation: 3 }, onReaderManualInteraction: noop,
  });
  if (producer === 'autoPage') Auto.prototype.requestAutoPageTurn.call(owner, 3);
  else Volume.prototype.onVolumeKeyPageTurn.call(owner, 'next');
  assert.equal(owner.pageTurnGestureState.phase, 'tracking');
  assert.equal(owner.pageTurnGestureState.active, true);
  assert.equal(owner.pageTurnSettlementActive, true);
  assert.deepEqual(events.map(e => e.kind), ['animate', 'persist']);
  result({ case: 'another input producer can start settlement during live pointer tracking', producer, events,
    meaning: 'requires enabled due Auto Page or an actual volume key; does not prove either occurred in user episode' });
}

let readinessCalls = 0, callbacks = 0, watchdogArms = 0;
const hot = Object.assign(new Pointer(), {
  gestureState: gesture.startReaderPagePan(390, 300, 200, 0, 800),
  tapOnlyPointer: false, pointerRejected: false, velocityX: 0, velocityY: 0,
  pageLocalX: (_e, p) => p.x, pageLocalY: (_e, p) => p.y, eventTimeMs: e => e.time,
  updateVelocity: noop, isPageOwner: s => s.owner === 'horizontalPage',
  canStartTurn: () => { readinessCalls++; return true; }, canStartBookmark: () => true,
  reportManualInteraction: noop, clearLongPressTimer: noop, ownPointer: noop,
  armPointerWatchdog: () => watchdogArms++, onGestureStateChange: () => callbacks++, onBookmarkStateChange: noop,
});
for (let i = 0; i < 120; i++) hot.updateRawPointer({ time: (i + 1) * 8 }, { x: 280 - i, y: 200 });
assert.equal(readinessCalls, 120); assert.equal(callbacks, 120); assert.equal(watchdogArms, 120);
result({ case: 'hot MOVE repeats readiness check and watchdog restart', moveCount: 120, readinessCalls, callbacks, watchdogArms });

const Time = make('ReaderPageInteractionLayer.ets', ['eventTimeMs', 'updateVelocity'], {
  Date: { now: () => 1789000000000 },
});
const time = Object.assign(new Time(), { lastSampleTimeMs: 1000, lastLocalX: 0, lastLocalY: 0, velocityX: 400, velocityY: 0 });
time.updateVelocity(10, 0, time.eventTimeMs({ timestamp: NaN }));
const poisonedClock = time.lastSampleTimeMs, poisonedVelocity = time.velocityX;
time.lastLocalX = 10;
time.updateVelocity(30, 0, time.eventTimeMs({ timestamp: 1016 * 1e6 }));
assert.equal(time.lastSampleTimeMs, poisonedClock); assert.equal(time.velocityX, poisonedVelocity);
result({ case: 'invalid timestamp mixes wall and event clocks and prevents velocity recovery', poisonedClock, velocity: time.velocityX,
  meaning: 'defensive input defect; no evidence real device emitted invalid timestamp' });

for (const count of [100, 1000, 10000]) {
  let reads = 0;
  const chapters = Array.from({ length: count }, (_, i) => ({
    get chapterIndex() { reads++; return i; }, scalarLength: 100, cumulativeStart: i * 100, cumulativeEnd: (i + 1) * 100,
  }));
  const percent = wholeBookProgressPercent({ totalScalarLength: count * 100, chapters }, count - 1, 50);
  assert.equal(reads, count);
  result({ case: 'page chrome whole-book metric lookup scans to target chapter', chapters: count, reads, percent });
}
const key = { sourceId: 'fixture', bookId: 'fixture', chapterIndex: 0, contentVersion: 'fixture', layoutSignature: 'fixture' };
const prefix = new ReadingPaginationPrefix(key, { requestScalar: 0, startScalar: 0, endScalarExclusive: 100 });
for (let i = 1; i < 100; i++) prefix.admit({ requestScalar: i * 100, startScalar: i * 100, endScalarExclusive: (i + 1) * 100 });
assert.notEqual(prefix.pageStartScalars(), prefix.pageStartScalars());
result({ case: 'prefix page ordinal projection allocates a full page-start array each call', length: prefix.pageStartScalars().length });

// Audit compiler output only after comparing every non-callback Stage binding
// against current .ets. A stale build-cache timestamp is not source provenance.
const compiledURL = new URL('../../entry/build/default/cache/default/default@CompileArkTS/esmodule/debug/entry/src/main/ets/features/reading/LocalReadingExperience.ts', import.meta.url);
const compiled = readFileSync(compiledURL, 'utf8');
function objectAt(s, start) {
  const file = ts.createSourceFile('probe.ts', `const binding = ${s.slice(start)};`, ts.ScriptTarget.Latest, true);
  return { file, object: file.statements[0].declarationList.declarations[0].initializer };
}
const src = source('LocalReadingExperience.ets');
const current = objectAt(src, src.indexOf('{', src.indexOf('ReaderPageTurnStage({')));
const begin = compiled.indexOf('let componentCall = new ReaderPageTurnStage');
const updateStart = compiled.indexOf('this.updateStateVarsOfChildByElmtId(elmtId, {', begin);
const cached = objectAt(compiled, compiled.indexOf('{', updateStart));
const printer = ts.createPrinter({ removeComments: true });
const values = ({ file, object }) => Object.fromEntries(object.properties.map(p => [p.name.getText(file), printer.printNode(ts.EmitHint.Expression, p.initializer, file)]));
const liveValues = values(current), cachedValues = values(cached);
for (const [name, expression] of Object.entries(cachedValues)) assert.equal(liveValues[name], expression, `current compiler binding: ${name}`);
const expression = printer.printNode(ts.EmitHint.Expression, cached.object, cached.file);
let projections = 0, layouts = 0;
const paramsOwner = {
  currentPageTurnRenderPage() { projections++; return {}; },
  preparedPageTurnRenderPage() { projections++; return {}; },
  usesBookTurnSimulation: () => false, effectivePageTurnStyle: () => 'slide',
  pageTurnStageViewportWidth: () => 390, readingLayout() { layouts++; return {}; },
  autoPageHighlightStart: noop, autoPageHighlightEnd: noop, readerTextSelectionEnabled: () => false,
  pageTurnOffsetX: -80,
};
const invokeUpdate = new Function(`return (${expression});`);
const first = invokeUpdate.call(paramsOwner);
paramsOwner.pageTurnOffsetX = -160;
const second = invokeUpdate.call(paramsOwner);
assert.notEqual(first.currentPage, second.currentPage); assert.equal(projections, 6); assert.equal(layouts, 2);
result({ case: 'verified compiled Stage update callback recomputes page projections with offset',
  comparedBindings: Object.keys(cachedValues).length, updateInvocations: 2, projections, explicitLayouts: layouts,
  meaning: 'one dirty callback may coalesce multiple MOVE events; this does not count actual layout or raster passes' });
writeFileSync(new URL('expanded-stage-update-binding.json', import.meta.url), JSON.stringify({
  sourceSha256: createHash('sha256').update(src).digest('hex'),
  compiledSha256: createHash('sha256').update(compiled).digest('hex'),
  comparedBindings: cachedValues, callbackExpression: expression,
}, null, 2) + '\n');
