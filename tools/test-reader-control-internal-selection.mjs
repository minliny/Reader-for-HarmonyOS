import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import * as selectionPolicy from '../entry/src/main/ets/features/reading/ReaderControlSelectionTransaction.ts';
import { wholeBookAnchorForPercent } from '../entry/src/main/ets/features/reading/LocalReadingWholeBookProgress.ts';
import { ReaderTtsPageFollow, readerTtsFollowActive } from '../entry/src/main/ets/features/reading/ReaderTtsPageFollow.ts';

const source = readFileSync(new URL('../entry/src/main/ets/features/reading/LocalReadingExperience.ets',
  import.meta.url), 'utf8');
function balanced(start) {
  assert.ok(start >= 0);
  const open = source.indexOf('{', start); let depth = 1, end = open + 1;
  while (depth > 0 && end < source.length) {
    if (source[end] === '{') depth++;
    if (source[end] === '}') depth--;
    end++;
  }
  assert.equal(depth, 0);
  return source.slice(start, end);
}
function method(name) {
  const match = new RegExp('  private (?:async )?' + name + '\\(').exec(source);
  assert.ok(match, 'actual Host ' + name);
  return balanced(match.index);
}
const deferredClass = balanced(source.indexOf('class ReaderDeferredChapterSelection {'));
const names = ['isUnknownCatalogEdge', 'entryChapterPosition', 'ttsFollowScope', 'isTtsFollowLeaseCurrent', 'positionContextForScope', 'loadNextTtsChapter', 'clearTtsChapterEndTimer', 'reloadCurrentChapterAfterContentProjectionChange', 'reloadMigratedContentPosition', 'selectChapterAnchor',
  'onRequestedBookmarkAnchorChanged', 'selectSearchResult', 'selectBookmarkAnchor', 'selectControlChapter',
  'stepControlChapter', 'readingTocEntries', 'seekControlProgress', 'controlSelectionOwner', 'completeControlSelectionAfterCommit',
  'resumeDeferredPageTurnWork', 'clearDeferredPageTurnWork'];
function Host(mutate = code => code) {
  const deps = { ...selectionPolicy, wholeBookAnchorForPercent, readerTtsFollowActive, LOCAL_READING_SOURCE_ID: 'local' };
  const code = mutate(names.map(method).join('\n'));
  return new Function(...Object.keys(deps), stripTypeScriptTypes(deferredClass +
    '\nclass InternalSelectionProbe {' + code + '}') + ';return InternalSelectionProbe;')(
      ...Object.values(deps));
}
function owner(Type = Host()) {
  const host = new Type();
  Object.assign(host, { sourceId: 'source', bookId: 'book', lifecycleToken: 1, mounted: true,
    exitRequested: false, controlOpenRevision: 41, chapterSelectionToken: 10,
    materializedChapterSelectionToken: 10, visiblePageSelectionToken: 10,
    pageTurnSettlementActive: false, chapter: { chapterIndex: 2 }, visiblePage: { startScalar: 70 },
    phase: 'ready', sessionGateway: {}, contentMetrics: undefined, knownContentVersions: [1],
    pendingControlSelection: undefined, hideCalls: 0, stops: 0, opens: [],
    tocEntries: [{ index: 2 }, { index: 3 }, { index: 4 }],
    controlVisible: () => true, controlShellExitArmed: () => false,
    isKnownControlChapter: index => [2, 3, 4].includes(index),
    isSessionActive(token) { return this.mounted && !this.exitRequested && this.lifecycleToken === token; },
    isSelectionActive(token, selection) { return this.isSessionActive(token) && this.chapterSelectionToken === selection; },
    activeGateway: () => ({ loadProgress: async () => ({kind:'restored',progress:{chapterIndex:2,chapterOffset:81}}) }),
    captureControlSelectionOrigin: () => undefined,
    currentChapterIndex() { return this.chapter.chapterIndex; },
    adjacentChapterIndex: (index, delta) => index + delta,
    loadSessionChapter: async index => ({ chapterIndex: index, content: 'text', contentVersion: 'v1' }),
    admitChapterContentVersion() {}, chapterWindow: { get:()=>undefined, admitNeighbour() {}, clear() {} },
    ttsChapterRef: chapter => ({ sourceId: 'source', bookId: 'book', chapterIndex: chapter.chapterIndex }),
    ttsTimerMode: 'duration', ttsTimerMinutes: 25, ttsTimerSeconds: 0,
    ttsPageFollow: new ReaderTtsPageFollow(),
    ttsState: { status: 'playing', sessionGeneration: 1, utteranceGeneration: 1,
      chapterIndex: 2, chapterKey: 'source\u0000book\u00002', contentVersion: 'v1' },
    ttsCoordinator: { stop: async () => { host.stops++; }, setTimer: value => { host.timerSet = value; } },
    logTtsFailure() {}, resetForChapterSelection() {}, armFirstPageReadyDeadline() {},
    openChapter: async (...args) => { host.opens.push(args); },
    hideControl() { this.hideCalls++; },
    invalidatePageTurnRuntime() {}, paginationIndex: { invalidateBook() {} }, resetPaginationDraft() {},
  });
  host.clearDeferredPageTurnWork();
  return host;
}
function commit(host, chapterIndex = host.opens.at(-1)?.[0] ?? 2, offset = 0) {
  host.chapter = { chapterIndex };
  host.phase = 'ready';
  host.materializedChapterSelectionToken = host.chapterSelectionToken;
  host.visiblePageSelectionToken = host.chapterSelectionToken;
  host.completeControlSelectionAfterCommit({ chapterIndex, chapterOffset: offset },
    { startScalar: offset }, host.chapterSelectionToken, host.lifecycleToken);
}
async function checkTts(Type = Host()) {
  const host = owner(Type);
  const next = await host.loadNextTtsChapter({ sourceId: 'source', bookId: 'book', chapterIndex: 2 }, 1);
  assert.ok(next);
  // Automatic playback admission can arrive after a newer control opening.
  host.controlOpenRevision++;
  next.onAdmitted();
  assert.equal(host.pendingControlSelection, undefined,
    'automatic TTS chapter admission must not capture the new control session');
  assert.equal(host.stops, 0, 'automatic TTS continuation keeps stopTts=false');
  assert.equal(host.pendingControlSelectionRetry.controlOwnerRevision, -1);
  commit(host, 3);
  assert.equal(host.hideCalls, 0);
}
{
  const host = owner();
  host.ttsTimerMode = 'chapterEnd';
  assert.equal(await host.loadNextTtsChapter({ sourceId: 'source', bookId: 'book', chapterIndex: 2 }, 1), undefined,
    'chapter-end mode stops at the admitted chapter boundary instead of loading a successor');
}
{
  const host = owner();
  host.ttsTimerMode = 'chapterEnd';
  host.selectBookmarkAnchor(3, 0);
  assert.equal(host.ttsTimerMode, 'off', 'manual chapter navigation clears a chapter-bound one-shot timer');
  assert.equal(host.ttsTimerMinutes, 0);
  assert.equal(host.timerSet, undefined, 'timer is already unarmed before a new chapter session starts');
}
async function checkProjection(Type = Host()) {
  const host = owner(Type);
  host.controlOpenRevision++;
  host.reloadCurrentChapterAfterContentProjectionChange(1, 2);
  await Promise.resolve();
  assert.equal(host.pendingControlSelection, undefined,
    'internal conversion/projection reflow must not capture the new control session');
  assert.equal(host.pendingControlSelectionRetry.controlOwnerRevision, -1);
  assert.equal(host.stops, 1, 'projection keeps its existing TTS contentChanged stop semantics');
  commit(host, 2, 70);
  assert.equal(host.hideCalls, 0);
}
await checkTts();
{
  const host = owner();
  host.ttsState.chapterIndex = 3;
  host.ttsState.chapterKey = 'source\u0000book\u00003';
  const next = await host.loadNextTtsChapter({ sourceId: 'source', bookId: 'book', chapterIndex: 3 }, 1);
  assert.equal(next?.chapter.chapterIndex, 4,
    'audio may advance again while the visible chapter still waits behind a page-turn transaction');
  assert.equal(host.chapter.chapterIndex, 2, 'audio preparation must not mutate the visible chapter');
}
{
  const host = owner();
  let finish;
  host.loadSessionChapter = () => new Promise(resolve => { finish = resolve; });
  const loading = host.loadNextTtsChapter({ sourceId: 'source', bookId: 'book', chapterIndex: 2 }, 1);
  host.ttsPageFollow.invalidate(host.ttsFollowScope(), host.ttsState);
  finish({ chapterIndex: 3, content: 'text', contentVersion: 'v1' });
  const next = await loading;
  assert.ok(next, 'manual UI navigation does not interrupt independent audio preparation');
  next.onAdmitted();
  assert.equal(host.opens.length, 0, 'invalidated UI lease cannot later select the audio chapter');
}
{
  const host = owner();
  let finish;
  host.loadSessionChapter = () => new Promise(resolve => { finish = resolve; });
  const loading = host.loadNextTtsChapter({ sourceId: 'source', bookId: 'book', chapterIndex: 2 }, 1);
  host.ttsState.sessionGeneration++;
  finish({ chapterIndex: 3, content: 'text', contentVersion: 'v1' });
  assert.equal(await loading, undefined, 'stopped or replaced audio session rejects a late chapter read');
}
await checkProjection();
const oldTts = code => {
  const old = code.replace('this.selectChapterAnchor(target, 0, true, false, undefined, -1,',
    'this.selectChapterAnchor(target, 0, true, false, undefined, -2,');
  assert.notEqual(old, code); return old;
};
await assert.rejects(checkTts(Host(oldTts)), /automatic TTS chapter admission must not capture/,
  're-injecting the old callback reproduces capture of a newer control session');
const oldProjection = code => {
  const old = code.replace('progress.chapterOffset, false, true, undefined, -1,',
    'progress.chapterOffset, false, true, undefined, -2,');
  assert.notEqual(old, code); return old;
};
await assert.rejects(checkProjection(Host(oldProjection)), /internal conversion\/projection reflow must not capture/);

// A delayed projection reload still carries an internal (-1) owner after page
// settlement. Neither automatic deferral nor resume turns it into a user pick.
{
  const host = owner();
  host.pageTurnSettlementActive = true;
  host.reloadCurrentChapterAfterContentProjectionChange(1, 2);
  assert.equal(host.pageTurnPendingProjectionChapterIndex, 2);
  assert.equal(host.opens.length, 0);
  host.pageTurnSettlementActive = false; host.controlOpenRevision++;
  host.resumeDeferredPageTurnWork();
  await Promise.resolve();
  assert.equal(host.pendingControlSelection, undefined);
  commit(host, 2, 70); assert.equal(host.hideCalls, 0);
}

const scope = { sourceId: 'source', bookId: 'book', chapterIndex: 3, bodyVersion: 'body', processingVersion: 'processing' };
// Discrete list/bookmark/search picks retain close AFTER the real commit.
// Progress scrubbing is a continuous control and keeps the same panel open.
const picks = [
  ['directory', host => host.selectControlChapter(3)],
  ['bookmark', host => host.selectBookmarkAnchor(3, 50, scope)],
  ['search', host => host.selectSearchResult({ sourceId: 'source', bookId: 'book', chapterIndex: 3, chapterOffset: 50, positionScope: scope })],
  ['external bookmark request', host => {
    host.requestedBookmarkAnchor = { chapterIndex: 3, chapterOffset: 50, positionScope: scope }; host.onRequestedBookmarkAnchorChanged();
  }],
  ['chapter button', host => host.stepControlChapter(1)],
  ['progress fallback', host => host.seekControlProgress(50)],
  ['progress exact', host => {
    host.contentMetrics = { totalScalarLength: 200, chapters: [
      { chapterIndex: 2, scalarLength: 100, cumulativeStart: 0, cumulativeEnd: 100 },
      { chapterIndex: 3, scalarLength: 100, cumulativeStart: 100, cumulativeEnd: 200 }] };
    host.seekControlProgress(75);
  }],
];
for (const [name, pick] of picks) {
  const host = owner(); pick(host);
  assert.equal(host.pendingControlSelection?.controlOpenRevision, 41, name);
  assert.equal(host.hideCalls, 0, name + ' must not close on download/start');
  commit(host, host.pendingControlSelection.targetChapterIndex, 0);
  assert.equal(host.hideCalls, name.startsWith('progress') ? 0 : 1,
    name + ' applies its explicitly chosen close policy after real commit');

  const newer = owner(); pick(newer);
  newer.controlOpenRevision = 42;
  commit(newer, newer.pendingControlSelection.targetChapterIndex, 0);
  assert.equal(newer.hideCalls, 0, name + ' cannot close a later reopening');
}
for (const deferred of [false, true]) {
  const host = owner(); host.pageTurnSettlementActive = deferred;
  host.seekControlProgress(25);
  if (deferred) {
    assert.equal(host.pageTurnPendingChapterSelection.closeControlOnCommit, false);
    host.pageTurnSettlementActive = false; host.resumeDeferredPageTurnWork();
  }
  const first = host.pendingControlSelection;
  assert.equal(first.closeOnCommit, false); assert.equal(first.controlOpenRevision, 41);
  host.seekControlProgress(75);
  const latest = host.pendingControlSelection;
  assert.notEqual(first.selectionToken, latest.selectionToken);
  host.completeControlSelectionAfterCommit({chapterIndex:first.targetChapterIndex,chapterOffset:0},
    {startScalar:0},first.selectionToken,first.lifecycleToken);
  assert.strictEqual(host.pendingControlSelection, latest, 'late older scrub commit cannot clear the current intent');
  commit(host, latest.targetChapterIndex, 0);
  assert.equal(host.hideCalls, 0, 'consecutive progress commits keep controls open');
  assert.equal(host.pendingControlSelection, undefined);
  host.seekControlProgress(40); commit(host, host.pendingControlSelection.targetChapterIndex, 0);
  assert.equal(host.hideCalls, 0, 'a third continuous adjustment remains available');
}
assert.match(method('showControlSelectionFailure'), /retry\.controlOwnerRevision, retry\.closeControlOnCommit/,
  'a failed scrub retry preserves its no-close policy and recoverable selection owner');
{
  const host = owner();
  host.pageTurnSettlementActive = true;
  host.selectBookmarkAnchor(3, 70, scope);
  assert.equal(host.pageTurnPendingChapterSelection.controlOwnerRevision, 41);
  host.pageTurnSettlementActive = false; host.controlOpenRevision = 42;
  host.resumeDeferredPageTurnWork();
  await Promise.resolve();
  assert.equal(host.pendingControlSelection.controlOpenRevision, 41,
    'deferred user choice reuses the origin owner instead of capturing a new opening');
  commit(host, 3, 70); assert.equal(host.hideCalls, 0);
}
assert.match(method('showControlSelectionFailure'),
  /retry\.stopTts, retry\.requestedProgress, retry\.controlOwnerRevision/,
  'explicit retry also preserves the original selection owner');
// An already committed directory chapter uses the existing safe no-load close.
{
  const host = owner();
  host.captureControlSelectionOrigin = () => ({ committedProgress: { chapterIndex: 2 } });
  host.selectControlChapter(2);
  assert.equal(host.hideCalls, 1); assert.equal(host.opens.length, 0);
}
console.log('PASS internal/user selection ownership: actual Host methods, stale reopen, TTS/projection negative mutations and committed-close semantics; NOT device acceptance');
