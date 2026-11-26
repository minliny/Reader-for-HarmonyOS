import assert from 'node:assert/strict';
import { test } from 'node:test';
import { setImmediate } from 'node:timers/promises';
import { ReaderChapterSelectionOwner, ReaderDeferredChapterSelection } from
  '../../entry/src/main/ets/features/reading/presentation/ReaderChapterSelectionOwner.ts';
import type { ReaderControlDeferredCatalogSelection } from
  '../../entry/src/main/ets/features/reading/presentation/ReaderControlSelectionRouting.ts';
import type { ReaderControlSelectionDisplayAnchor, ReaderControlSelectionCommit, ReaderControlSelectionTicket } from
  '../../entry/src/main/ets/features/reading/application/ReaderControlSelectionTransaction.ts';
import type { LocalReadingProgressState } from '../../entry/src/main/ets/features/reading/application/LocalReadingFlowGateway.ts';
import type { ReadingSessionChapter } from '../../entry/src/main/ets/features/reading/application/ReadingChapterWindow.ts';
import type { RemoteReadingPositionContext } from '../../entry/src/main/ets/features/reading/application/RemoteReadingPositionMigration.ts';

interface Display { label: string; anchor: ReaderControlSelectionDisplayAnchor; matchesLayout: boolean; }

function fixture() {
  const origin: Display = { label: 'origin', anchor: { chapterIndex: 3, pageStartScalar: 5, visibleScalar: 5,
    scalarCount: 80, continuous: false, bodyVersion: 'origin-body', processingVersion: 'rules' }, matchesLayout: true };
  const target: Display = { label: 'target', anchor: { chapterIndex: 4, pageStartScalar: 7, visibleScalar: 7,
    scalarCount: 100, continuous: false, bodyVersion: 'body', processingVersion: 'rules' }, matchesLayout: true };
  const chapter: ReadingSessionChapter = { sourceId: 'source', bookId: 'book', chapterIndex: 4, chapterTitle: 'Chapter',
    chapterUrl: undefined, content: 'body', images: [], contentVersion: 'body', bodyVersion: 'body', processingVersion: 'rules',
    extractionVia: 'rule' };
  const calls: string[] = [];
  const scope = { sourceId: 'source', bookId: 'book', lifecycleToken: 2, selectionToken: 3 };
  const state = { openRevision: 8, mounted: true, controlVisible: true, prepared: true, known: true,
    pending: false, settling: false, visible: origin as Display | undefined };
  const serial = Promise.withResolvers<void>();
  const read = Promise.withResolvers<LocalReadingProgressState>();
  const deferred: ReaderControlDeferredCatalogSelection[] = [];
  const loads: ReaderDeferredChapterSelection[] = [];
  const reopen: Array<{ ticket: ReaderControlSelectionTicket; context: RemoteReadingPositionContext; offset: number }> = [];
  let settleRequest: ReaderDeferredChapterSelection | undefined;
  let retry: (() => void) | undefined;
  let failReopen = false;
  const owner = new ReaderChapterSelectionOwner<Display, Display, Display>({
    prepare: () => { calls.push('prepare'); return state.prepared; },
    scope: () => ({ ...scope }),
    owner: () => ({ ...scope, mounted: state.mounted, controlOpenRevision: state.openRevision,
      exitRequested: false, controlVisible: state.controlVisible, controlClosing: false }),
    nextSelection: () => { scope.selectionToken += 1; calls.push(`advance:${scope.selectionToken}`); return scope.selectionToken; },
    adoptControlRevision: () => state.controlVisible ? state.openRevision : -1,
    openRevision: () => state.openRevision,
    selectionActive: (lifecycle, selection) => state.mounted && lifecycle === scope.lifecycleToken && selection === scope.selectionToken,
    isKnown: () => state.known, catalogPending: () => state.pending,
    deferCatalog: capture => { calls.push('catalogue'); deferred.push(capture()); },
    chapterAt: index => index === 4 ? chapter : undefined,
    queueOnSettlement: request => { calls.push(`loading:${request.chapterIndex}`); if (state.settling) settleRequest = request; return state.settling; },
    interruptPlayback: stop => { calls.push(`stop:${stop}`); },
    resetObservations: () => { calls.push('reset-observations'); },
    load: (request, life, selection) => { calls.push(`load:${life}:${selection}`); loads.push(request); },
    closeControl: () => { calls.push('close-panel'); },
  }, {
    captureVisibleOrigin: () => state.visible,
    anchor: display => display?.anchor,
    matchesLayout: display => display.matchesLayout,
    beginFailure: error => { calls.push(`failed:${error.message}`); },
    invalidateUnverifiedDisplay: () => { calls.push('invalidate-display'); },
    showFailure: (ticket, _error, detail) => { calls.push(`show:${detail}`); retry = owner.retryAction(ticket); },
    restore: (display, stored) => { calls.push(`restore:${display.label}:${stored.chapterOffset}`); },
    completeRestoredTarget: (ticket, _display, stored) => {
      calls.push('complete-target');
      owner.complete(ticket.selectionToken, ticket.lifecycleToken, () => measuredCommit(ticket, stored.chapterOffset), () => { calls.push('report'); });
    },
    notifyRestored: (_ticket, display) => { calls.push(`notify:${display.label}`); },
    reopenRefreshed: async (ticket, stored, context) => {
      calls.push('reopen');
      reopen.push({ ticket, context, offset: stored.chapterOffset });
      if (failReopen) throw new Error('second measurement');
    },
  }, () => ({
    runProgressCommitSerial: async operation => { calls.push('serial'); await serial.promise; await operation(); },
    loadProgress: (book, current) => { assert.equal(book, scope.bookId); assert.equal(current(), true); calls.push('read'); return read.promise; },
  }));
  const request = (chapterIndex = 4, refresh = false) => new ReaderDeferredChapterSelection(chapterIndex, 11, false, true,
    undefined, -2, true, refresh);
  return { owner, state, scope, origin, target, calls, loads, deferred, serial, read, request, reopen,
    queued: () => settleRequest, runRetry: () => retry?.(), rejectReopen: () => { failReopen = true; } };
}

function measuredCommit(ticket: ReaderControlSelectionTicket, offset: number): ReaderControlSelectionCommit {
  return { phaseReady: true, materializedSelectionToken: ticket.selectionToken, visibleSelectionToken: ticket.selectionToken,
    visibleChapterIndex: ticket.targetChapterIndex, visiblePageStartScalar: offset,
    storedChapterIndex: ticket.targetChapterIndex, storedChapterOffset: offset };
}

function stored(chapterIndex: number, offset: number, bodyVersion: string, processingVersion = 'rules'): LocalReadingProgressState {
  return { kind: 'restored', progress: { bookId: 'book', chapterIndex, chapterOffset: offset, chapterProgress: 0.1,
    updatedAt: 55, bodyVersion, processingVersion } };
}

test('an unknown chapter defers to the exact control opening, then waits for settlement without advancing selection', () => {
  const f = fixture();
  f.state.known = false;
  f.state.pending = true;
  f.owner.select(f.request());
  assert.deepEqual(f.calls, ['prepare', 'catalogue']);
  assert.equal(f.deferred[0].isCurrent(), false);
  f.state.pending = false;
  f.state.known = true;
  f.state.openRevision += 1;
  assert.equal(f.deferred[0].isCurrent(), false);
  f.state.openRevision -= 1;
  assert.equal(f.deferred[0].isCurrent(), true);
  f.state.settling = true;
  f.deferred[0].dispatch();
  assert.equal(f.scope.selectionToken, 3);
  assert.equal(f.owner.ticket, undefined);
  assert.equal(f.queued()?.controlOwnerRevision, 8);
  assert.deepEqual(f.queued()?.positionContext?.anchors, [{ id: 'requested', offset: 11 }]);
  assert.deepEqual(f.calls, ['prepare', 'catalogue', 'prepare', 'loading:4']);
});

test('a later selection inherits the committed display and only its current first-page producer may retain a candidate', () => {
  const f = fixture();
  f.owner.select(f.request());
  assert.equal(f.owner.origin, f.origin);
  assert.deepEqual(f.calls, ['prepare', 'loading:4', 'stop:true', 'advance:4', 'reset-observations', 'load:2:4']);
  const older = f.owner.ticket!;
  f.state.visible = undefined;
  f.owner.select(f.request(5));
  assert.equal(f.owner.origin, f.origin);
  f.owner.captureCandidate(older.selectionToken, () => assert.fail('retired token cannot create a candidate'));
  const active = f.owner.ticket!;
  f.owner.captureCandidate(active.selectionToken, () => f.target);
  assert.equal(f.owner.candidate, f.target);
  f.owner.complete(older.selectionToken, older.lifecycleToken, () => assert.fail('old commit facts'), () => {});
  f.state.openRevision += 1;
  f.owner.complete(active.selectionToken, active.lifecycleToken, () => measuredCommit(active, 7), () => f.calls.push('report'));
  assert.equal(f.owner.ticket, undefined);
  assert.equal(f.owner.origin, undefined);
  assert.equal(f.owner.candidate, undefined);
  assert.equal(f.calls.includes('close-panel'), false);
});

test('failure retains both displays until a single serialized read confirms the old progress, then offers the original retry', async () => {
  const f = fixture();
  f.owner.select(f.request());
  const active = f.owner.ticket!;
  f.owner.captureCandidate(active.selectionToken, () => f.target);
  f.calls.length = 0;
  assert.equal(f.owner.recover(new Error('save timeout'), 2), true);
  assert.equal(f.owner.recover(new Error('second failure'), 2), true);
  assert.equal(f.owner.origin, f.origin);
  assert.equal(f.owner.candidate, f.target);
  assert.deepEqual(f.calls, ['advance:5', 'failed:save timeout', 'serial']);
  f.serial.resolve();
  f.read.resolve(stored(3, 5, 'origin-body'));
  await setImmediate();
  assert.deepEqual(f.calls, ['advance:5', 'failed:save timeout', 'serial', 'read', 'restore:origin:5',
    'show:已核实并保留原阅读位置', 'notify:origin']);
  assert.equal(f.owner.ticket, undefined);
  f.runRetry();
  assert.deepEqual(f.loads.at(-1)?.positionContext, { bodyVersion: 'body', processingVersion: 'rules',
    anchors: [{ id: 'requested', offset: 11 }] });
  assert.equal(f.loads.length, 2);
  f.runRetry();
  assert.equal(f.loads.length, 2);
});

test('a durable target is restored before observation and the matching visible commit can close the old control', async () => {
  const f = fixture();
  f.owner.select(f.request());
  f.owner.captureCandidate(f.owner.ticket!.selectionToken, () => f.target);
  f.calls.length = 0;
  assert.equal(f.owner.recover(new Error('ack missing'), 2), true);
  f.serial.resolve();
  f.read.resolve(stored(4, 7, 'body'));
  await setImmediate();
  assert.deepEqual(f.calls, ['advance:5', 'failed:ack missing', 'serial', 'read', 'restore:target:7',
    'complete-target', 'report', 'close-panel', 'notify:target']);
  assert.equal(f.owner.ticket, undefined);
});

test('an old observation cannot restore or invalidate a newer selection after its Core read has started', async () => {
  const f = fixture();
  f.owner.select(f.request());
  f.owner.recover(new Error('awaited'), 2);
  f.serial.resolve();
  await setImmediate();
  assert.equal(f.calls.at(-1), 'read');
  f.scope.bookId = 'successor';
  f.owner.reset();
  f.owner.select(f.request(8));
  const successor = f.owner.ticket;
  f.read.resolve(stored(3, 5, 'origin-body'));
  await setImmediate();
  assert.equal(f.owner.ticket, successor);
  assert.ok(!f.calls.some(call => /^(restore|show|invalidate-display)/.test(call)));
});

test('a saved fresh body can reopen once with the readback versions and never retries forceRefresh again', async () => {
  const f = fixture();
  f.owner.select(f.request(4, true));
  f.rejectReopen();
  assert.equal(f.owner.recover(new Error('after refresh'), 2), true);
  f.serial.resolve();
  f.read.resolve(stored(4, 17, 'fresh', 'new rules'));
  await setImmediate();
  assert.equal(f.reopen.length, 1);
  assert.deepEqual(f.reopen[0].context, { bodyVersion: 'fresh', processingVersion: 'new rules',
    anchors: [{ id: 'requested', offset: 17 }] });
  assert.equal(f.reopen[0].ticket.selectionToken, 5);
  assert.deepEqual(f.calls.slice(-3), ['reopen', 'invalidate-display', 'show:位置核实或画面恢复未完成：second measurement']);
  assert.equal(f.owner.retryCurrent(), true);
  assert.equal(f.loads.at(-1)?.refreshContent, false);
  assert.equal(f.loads.at(-1)?.chapterOffset, 17);
  assert.equal(f.loads.at(-1)?.positionContext, f.reopen[0].context);
});

test('a changed layout cannot claim the original display even when Core confirms the exact old position', async () => {
  const f = fixture();
  f.owner.select(f.request());
  f.origin.matchesLayout = false;
  f.owner.recover(new Error('layout'), 2);
  f.serial.resolve();
  f.read.resolve(stored(3, 5, 'origin-body'));
  await setImmediate();
  assert.deepEqual(f.calls.slice(-3), ['read', 'invalidate-display', 'show:已保存位置与当前保留画面不同']);
  assert.equal(f.owner.ticket?.targetChapterIndex, 4);
});

test('non-control TTS and progress requests retain their dispatch rules without manufacturing a control ticket', () => {
  const f = fixture();
  const request = new ReaderDeferredChapterSelection(4, 6, false, false, 0.35, -1, false, false);
  f.owner.select(request);
  assert.ok(f.calls.includes('stop:false'));
  assert.equal(f.owner.ticket, undefined);
  assert.equal(f.loads[0].positionContext, undefined);
  assert.equal(f.loads[0].requestedProgress, 0.35);
  assert.equal(f.owner.recover(new Error('background'), 2), false);
});
