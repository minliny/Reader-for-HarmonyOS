import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire, stripTypeScriptTypes } from 'node:module';
import { productionMotionMethods } from './lib/reader-motion-method-probe.mjs';
import { completeReaderPageGestureSettlement, createReaderPageGestureState } from '../entry/src/main/ets/features/reading/ReaderPageGestureState.ts';
import { observeReaderProgressOperation, reconcileReaderControlSelectionProgress } from '../entry/src/main/ets/features/reading/ReaderControlSelectionTransaction.ts';

const file = new URL('../entry/src/main/ets/features/reading/LocalReadingExperience.ets', import.meta.url);
const gatewayFile = new URL('../entry/src/main/ets/features/reading/ReadingSessionFlowGateway.ts', import.meta.url);
const require = createRequire(import.meta.url);
const sdk = process.env.READER_ETS_LOADER_ROOT ?? '/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/ets/build-tools/ets-loader';
const ts = require(`${sdk}/node_modules/typescript`);
const options = require(`${sdk}/lib/ets_checker.js`).compilerOptions;
const source = readFileSync(file, 'utf8');
const tree = ts.createSourceFile('/tmp/ReaderPresentedTurnClasses.ets', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.ETS, options);
const classes = Object.fromEntries(['CoreReadingAnchor', 'PreparedReaderPageTurn', 'ReadingCommit', 'ReaderUIFrameCallback'].map(name => {
  const node = tree.statements.find(node => ts.isClassDeclaration(node) && node.name?.getText(tree) === name);
  assert.ok(node, name);
  return [name, new Function('FrameCallback', `${stripTypeScriptTypes(node.getText(tree)).replace(/^export /, '')}; return ${name};`)(class {})];
}));
const events = Object.fromEntries(['SURFACE_READY', 'TEXTURE_READY', 'VISUAL_COMMIT_ENDPOINT', 'ROLLBACK_COMPLETE',
  'SURFACE_LOST', 'RENDER_FAILURE', 'SLOTS_COMMITTED', 'TERMINAL_RELEASED', 'FRAME_PRESENTED']
  .map((name, index) => [`BOOK_TURN_EVENT_${name}`, index + 1]));
const methods = ['beginPreparedPageTurnPersistence', 'canPresentOrdinaryPage', 'persistPresentedPageTurn',
  'finishPreparedPageTurnSettlement', 'promotePreparedPageTurn', 'finishSuccessfulPageTurnPresentation',
  'isPreparedPageTurnCommitCurrent', 'isPreparedPageTurnFresh', 'isMountedToken',
  'isOrdinaryFirstPagePresentationCurrent', 'admitCommittedProgress', 'persistPreparedPageTurn',
  'admitPageTurnPersistenceOutcome', 'reconcilePreparedPageTurn', 'pageTurnInputPhase',
  'onBookTurnNativeEvent', 'confirmBookTurnPresented', 'scheduleBookTurnSurfaceRelease',
  'onBookTurnArkUIContentReady', 'onBookTurnArkUIFramePresented',
  'notifyControlSelectionReadingReady', 'notifyReadingPresentationReady', 'isStableVisiblePageOwner', 'isSelectionCurrent'];
const Gateway = productionMotionMethods(gatewayFile, ['canPersistPresentedProgress', 'hasPendingSourceSwitch']);
const noop = () => {};
function deferred() {
  let resolve, reject;
  const promise = new Promise((ok, bad) => { resolve = ok; reject = bad; });
  return { promise, resolve, reject };
}
async function settle() { for (let i = 0; i < 12; i++) await Promise.resolve(); }

function fixture({ capability = true, sourceSwitch = false, gatewaySwitch = false,
  migration, controlSelection = false, simulation = true } = {}) {
  const calls = { presented: [], strong: [], committed: [], dialogs: [], rollback: 0,
    observations: 0, native: [], perf: [], logs: [], ready: [] };
  const frames = [], save = deferred();
  const Owner = productionMotionMethods(file, methods, { ...classes, ...events,
    completeReaderPageGestureSettlement, reconcileReaderControlSelectionProgress,
    observeReaderProgressOperation: operation => {
      calls.observations++;
      return observeReaderProgressOperation(operation, 5);
    }, hilog: { error: (...args) => calls.logs.push(args) } });
  const gateway = Object.assign(new Gateway(), {
    sourceSwitchTransactionId: gatewaySwitch ? 'gateway-switch' : undefined,
    runtimeOwner: { supportsCoreCapability: name => {
      assert.equal(name, 'reading.progress.compareAndSet.v1'); return capability;
    } },
    persistPresentedProgress: (...args) => { calls.presented.push(args); return save.promise; },
    runProgressCommitSerial: async operation => operation(),
    resolveAndUpdateProgress: (...args) => { calls.strong.push(args); return save.promise; },
    loadProgress: async () => ({ kind: 'restored', progress: stored }),
  });
  const chapter = { sourceId: 's', bookId: 'b', chapterIndex: 1, chapterTitle: '正文',
    bodyVersion: 'body-v1', processingVersion: 'rules-v1', images: [],
    positionMigration: migration === undefined ? undefined : { status: migration } };
  const context = { chapter, layoutMap: { scalarCount: () => 100 }, contentVersion: 'content-v1' };
  const origin = { startScalar: 10, endScalar: 40, fragments: [{ text: '原页' }] };
  const page = { startScalar: 40, endScalar: 70, fragments: [{ text: '目标页' }] };
  const key = { sourceId: 's', bookId: 'b', chapterIndex: 1, contentVersion: 'content-v1', layoutSignature: 'layout' };
  const prepared = new classes.PreparedReaderPageTurn('next', page, context, key, 1, 10, 3);
  const stored = { sourceId: 's', bookId: 'b', chapterIndex: 1, chapterOffset: 40,
    chapterProgress: 0.4, locationRevision: 'r2', updatedAt: 2 };
  const owner = Object.assign(new Owner(), {
    mounted: true, exitRequested: false, lifecycleToken: 1, sourceId: 's', bookId: 'b', chapter,
    chapterSelectionToken: 2, materializedChapterSelectionToken: 2, visiblePageSelectionToken: 2,
    sourceSwitchTransactionId: sourceSwitch ? 'switch' : undefined,
    pendingControlSelection: controlSelection ? { targetChapterIndex: 1 } : undefined,
    phase: 'ready', visiblePage: origin, visibleFragments: origin.fragments,
    lastCommittedProgress: { chapterIndex: 1, chapterOffset: 10, updatedAt: 1 },
    pageTurnGeneration: 3, pageTurnSettlementGeneration: 7, bookTurnSurfaceGeneration: 7,
    pageTurnRenderRevision: 10, pageTurnCurrentSlot: 'a', pageTurnSettlingPrepared: prepared,
    pageTurnSettlementActive: true, pageTurnCommitStarted: false, pageTurnCommitFinished: false,
    pageTurnCommitSucceeded: false, pageTurnAnimationFinished: false, pageTurnInputOwned: true,
    pageTurnGestureState: { ...createReaderPageGestureState(), phase: 'settling', direction: 'next' },
    pageTurnPresentationPhase: 'settling', bookTurnSurfaceOpacity: 1,
    bookTurnArkUIReadyRevision: 10, bookTurnArkUIContentRevision: 10, bookTurnAwaitingSlotCommit: false,
    bookTurn2DFallbackPending: false, pageTurnDirection: 'next', commitInFlight: false,
    activeGateway: () => gateway, coreLayout: () => ({ width: 390, height: 844 }),
    paginationLayoutSignature: () => 'layout', knownContentVersion: () => 'content-v1',
    isReaderIdentityCurrent: () => true, usesBookTurnSimulation: () => simulation,
    getUIContext: () => ({ postFrameCallback: callback => frames.push(callback),
      showAlertDialog: dialog => calls.dialogs.push(dialog) }),
    bookTurnSession: {
      retainTerminalFrame: generation => calls.native.push(['retain', generation]),
      commitSlots: (generation, direction) => { calls.native.push(['slots', generation, direction]); return true; },
      releaseTerminalFrame: generation => { calls.native.push(['release', generation]); return true; },
      clearSurface: generation => calls.native.push(['clear', generation]),
    },
    captureMaterializedChapterContext: () => context, currentPaginationKey: () => key,
    restoreMaterializedChapterContext(next) { this.chapter = next.chapter; },
    clearPageTurnProjection: noop, isChapterFirstPageStart: start => start === 0,
    releaseUnretainedReadingImages: noop, schedulePageTurnPreparation: noop, prefetchNextChapter: noop,
    onAutoPagePageCommitted: noop, onReadingCommitted: progress => calls.committed.push(progress),
    onChapterCommitted: noop, onReadingReady: index => calls.ready.push(index),
    scheduleTtsPresentationWarmup: noop, armPageTurnSettlementDeadline: noop,
    cancelPageTurnSettlementDeadline: noop, automaticReadingState: () => ({ generation: 1 }),
    autoPageCoordinator: { retryTurn: noop }, animatePageTurnRollback: () => calls.rollback++,
    finishPageTurnPerf: kind => calls.perf.push(kind), recoverBookTurnSurfaceIfIdle: noop,
    flushDeferredPageChromeState: noop, completeRapidPageTurnTransaction: noop,
    resumeDeferredPageTurnWork: noop, drainRapidPageTurn: noop, resumePendingAutoPageTurn: noop,
    drainPageTurnPreparationQueue: noop, scheduleBookTurnTextureRefresh: noop,
    errorMessage: error => error.message,
  });
  return { owner, prepared, origin, page, chapter, stored, gateway, calls, save, frames,
    endpoint() { owner.onBookTurnNativeEvent({ event: events.BOOK_TURN_EVENT_VISUAL_COMMIT_ENDPOINT, generation: 7 }); },
    frame() { assert.ok(frames.length > 0, 'expected a scheduled ArkUI callback'); frames.shift().onFrame(0); },
  };
}

function assertLogicalPromotion(f) {
  assert.equal(f.owner.visiblePage, f.page);
  assert.equal(f.owner.visibleFragments, f.page.fragments);
  assert.equal(f.owner.pageTurnCurrentSlot, 'b');
  assert.equal(f.owner.preparedPreviousPage.page, f.origin, 'reverse preparation retains the exact old page');
  assert.equal(f.owner.pageTurnPresentationPhase, 'logicalPromoted');
  assert.equal(f.owner.pageTurnSettlementActive, true);
  assert.equal(f.owner.pageTurnInputPhase(), 'settling', 'logical promotion alone cannot reopen input');
  assert.equal(f.calls.rollback, 0);
}
function finishNativeHandoff(f) {
  const { owner } = f;
  assertLogicalPromotion(f);
  assert.equal(owner.bookTurnAwaitingSlotCommit, true);
  assert.equal(owner.pageTurnInputOwned, true);
  owner.onBookTurnArkUIContentReady(owner.pageTurnRenderRevision);
  owner.onBookTurnArkUIFramePresented(owner.pageTurnRenderRevision);
  assert.equal(owner.pageTurnInputPhase(), 'settling', 'ArkUI cannot skip the Native slot barrier');
  assert.equal(f.calls.native.some(call => call[0] === 'release'), false);
  owner.onBookTurnNativeEvent({ event: events.BOOK_TURN_EVENT_SLOTS_COMMITTED, generation: 7 });
  assert.equal(owner.bookTurnAwaitingSlotCommit, false);
  f.frame();
  assert.equal(owner.pageTurnInputPhase(), 'settling', 'slot commit does not prove the new ArkUI revision');
  assert.equal(f.calls.native.some(call => call[0] === 'release'), false);
  owner.onBookTurnArkUIContentReady(owner.pageTurnRenderRevision);
  owner.onBookTurnArkUIFramePresented(owner.pageTurnRenderRevision);
  assert.equal(owner.pageTurnPresentationPhase, 'surfaceHidden');
  assert.equal(owner.pageTurnInputPhase(), 'settling', 'surface hide still precedes Native release');
  f.frame();
  assert.deepEqual(f.calls.native.slice(-2), [['release', 7], ['clear', 7]]);
  assert.equal(owner.pageTurnInputPhase(), 'settling', 'release request is not its acknowledgement');
  owner.onBookTurnNativeEvent({ event: events.BOOK_TURN_EVENT_TERMINAL_RELEASED, generation: 6 });
  assert.equal(owner.pageTurnInputPhase(), 'settling', 'an obsolete release cannot reopen input');
  owner.onBookTurnNativeEvent({ event: events.BOOK_TURN_EVENT_TERMINAL_RELEASED, generation: 7 });
  assert.equal(owner.pageTurnInputPhase(), 'idle');
  assert.equal(owner.pageTurnInputOwned, false);
  assert.equal(owner.pageTurnSettlementActive, false);
  assert.deepEqual(f.calls.perf, ['committed']);
  assert.equal(f.calls.rollback, 0);
}

// Gateway capability requires an explicit supported CAS contract and no switch.
for (const [capability, expected] of [[true, true], [false, false], [undefined, false], [1, false]]) {
  const f = fixture({ capability });
  f.gateway.runtimeOwner.supportsCoreCapability = () => capability;
  assert.equal(f.gateway.canPersistPresentedProgress(), expected);
}
assert.equal(fixture({ gatewaySwitch: true }).gateway.canPersistPresentedProgress(), false);
assert.equal(fixture({ migration: 'unchanged' }).owner.canPresentOrdinaryPage({ positionMigration: { status: 'unchanged' } }), true);

for (const outcome of ['held-past-deadline', 'rejected', 'wrong-anchor', 'late-same-page', 'late-newer-page', 'late-unmounted']) {
  const f = fixture();
  f.endpoint();
  assertLogicalPromotion(f);
  f.endpoint();
  assert.equal(f.calls.presented.length, 1);
  assert.equal(f.calls.strong.length, 0);
  assert.equal(f.calls.native.filter(call => call[0] === 'slots').length, 1,
    'repeated endpoint delivery cannot promote, persist, or commit slots twice');
  assert.equal(f.owner.commitInFlight, false, 'an ordinary save is not the foreground commit owner');
  finishNativeHandoff(f);
  if (outcome === 'held-past-deadline') await new Promise(resolve => setTimeout(resolve, 12));
  if (outcome === 'late-newer-page') {
    const next = { startScalar: 70, endScalar: 100, fragments: [{ text: '再下一页' }] };
    f.owner.visiblePage = next; f.owner.visibleFragments = next.fragments;
    f.owner.lastCommittedProgress = { chapterIndex: 1, chapterOffset: 70, updatedAt: 3 };
  }
  if (outcome === 'late-unmounted') { f.owner.mounted = false; f.owner.lifecycleToken++; }
  const visible = f.owner.visiblePage, revision = f.owner.pageTurnRenderRevision, slot = f.owner.pageTurnCurrentSlot;
  if (outcome === 'rejected') f.save.reject(Error('SAVE_REJECTED'));
  else f.save.resolve(outcome === 'wrong-anchor' ? { ...f.stored, chapterOffset: 50 } : f.stored);
  await settle();
  assert.equal(f.owner.visiblePage, visible, `${outcome}: save receipt cannot change the page`);
  assert.equal(f.owner.pageTurnRenderRevision, revision, `${outcome}: save receipt cannot change render generation`);
  assert.equal(f.owner.pageTurnCurrentSlot, slot);
  assert.equal(f.owner.pageTurnInputPhase(), 'idle');
  assert.equal(f.calls.dialogs.length, 0, `${outcome}: ordinary persistence never opens a modal`);
  assert.equal(f.calls.rollback, 0);
  assert.equal(f.calls.observations, 0, 'ordinary persistence never takes the foreground unknown-observation path');
  const samePageSuccess = ['held-past-deadline', 'late-same-page'].includes(outcome);
  assert.equal(f.calls.committed.length, samePageSuccess ? 1 : 0, `${outcome}: only the still-current page admits ACK`);
  if (outcome === 'late-newer-page') assert.equal(f.owner.lastCommittedProgress.chapterOffset, 70);
}

{
  const f = fixture();
  f.endpoint();
  f.save.reject(Error('REJECTED_BEFORE_NATIVE_RELEASE'));
  await settle();
  assertLogicalPromotion(f);
  assert.equal(f.calls.dialogs.length, 0);
  assert.equal(f.calls.committed.length, 0);
  assert.equal(f.owner.pageTurnInputOwned, true, 'save rejection does not release an unfinished presentation');
  finishNativeHandoff(f);
  assert.equal(f.owner.visiblePage, f.page, 'a rejected save never rolls the presented page back');
}

// Legacy capabilities and real mutations retain the original strong save gate.
for (const options of [{ capability: false }, { sourceSwitch: true }, { gatewaySwitch: true },
  { migration: 'committed' }, { controlSelection: true }]) {
  const f = fixture(options);
  f.endpoint();
  await settle();
  assert.equal(f.calls.presented.length, 0);
  assert.equal(f.calls.strong.length, 1);
  assert.equal(f.owner.visiblePage, f.origin, 'strong transaction cannot promote before durable success');
  assert.equal(f.owner.pageTurnInputPhase(), 'settling');
  assert.equal(f.owner.commitInFlight, true);
  f.save.resolve(f.stored); await settle();
  assertLogicalPromotion(f);
  assert.equal(f.calls.committed.length, 1);
  assert.equal(f.owner.commitInFlight, false);
  finishNativeHandoff(f);
}

// The non-Native path also retains the derived input phase until its ArkUI join.
{
  const f = fixture({ simulation: false });
  f.owner.pageTurnAnimationFinished = true;
  f.owner.beginPreparedPageTurnPersistence(f.prepared, 1, 7);
  assertLogicalPromotion(f);
  assert.equal(f.calls.native.length, 0);
  f.frame();
  assert.equal(f.owner.pageTurnInputPhase(), 'idle');
  assert.equal(f.owner.visiblePage, f.page);
  f.save.resolve(f.stored); await settle();
  assert.equal(f.calls.committed.length, 1);
}

console.log(JSON.stringify({ passed: true,
  boundary: 'Unmodified production capability, persistence, promotion, settlement and Native/ArkUI event joins; controlled Core promises and platform callbacks, not physical frame or device proof.',
  cases: ['held-save', 'save-reject', 'reject-before-handoff', 'duplicate-endpoint', 'anchor-mismatch', 'current-ACK', 'obsolete-ACK', 'unmounted-ACK',
    'Native-slots', 'ArkUI-revision', 'terminal-release', 'non-Native-frame', 'legacy-Core', 'source-switch',
    'gateway-switch', 'position-migration', 'control-selection'] }));
