import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { productionMotionMethods } from './lib/reader-motion-method-probe.mjs';

const page = new URL('../entry/src/main/ets/features/source/SourceSwitchWindow.ets', import.meta.url);
const source = readFileSync(page, 'utf8');
const gateway = readFileSync(new URL('../entry/src/main/ets/features/source/SourceSwitchGateway.ts', import.meta.url), 'utf8');
const identities = gateway.slice(gateway.indexOf('export function sourceSwitchCandidateKey'), gateway.indexOf('function deduplicateSourceSwitchCandidates'));
const { sourceSwitchCandidateKey, sourceSwitchSourceCount } = new Function(`${stripTypeScriptTypes(identities).replaceAll('export ', '')}; return { sourceSwitchCandidateKey, sourceSwitchSourceCount };`)();
const timers = new Map(); let nextTimer = 0;
class LayoutFrame { constructor(action) { this.action = action; } }
const Controller = productionMotionMethods(page,
  ['candidateKey', 'acceptState', 'cancelPresentation', 'queueReorder', 'publishOrder', 'restoreAnchor',
    'listTouch', 'selectCandidate', 'busy', 'isSweeping', 'rollbackRequired', 'requestRefresh', 'statusText', 'errorText'],
  { sourceSwitchCandidateKey, sourceSwitchSourceCount, SourceSwitchLayoutFrame: LayoutFrame,
    Curve: { EaseInOut: 'curve' }, ScrollAlign: { START: 'start' }, TouchType: { Down: 'down', Up: 'up', Cancel: 'cancel' },
    setTimeout: callback => { const id = ++nextTimer; timers.set(id, callback); return id; },
    clearTimeout: id => timers.delete(id) });
const Candidate = productionMotionMethods(page, ['latencyText', 'chapterText']);
const key = candidate => sourceSwitchCandidateKey(candidate.sourceId, candidate.bookUrl);
const item = (id, latencyMs = 300, bookUrl = `${id}-book`) => ({ sourceId: id, bookUrl, bookName: '书', category: 'novel',
  sourceName: id, latencyMs, latencyKind: 'search', acquisitionState: 'discovered' });
function owner(initial = []) {
  const page = new Controller(); const selected = [], frames = [], actions = [];
  let offset = 0;
  Object.assign(page, { state: { kind: 'candidates', candidates: initial }, displayedCandidates: [], latestCandidates: [],
    retestingKeys: [], pendingSearchKeys: new Set(), wasRefreshing: false, mounted: true, foreground: true,
    touching: false, scrolling: false, heldKey: '', selectedKey: '', selectionPending: false, listMounted: true,
    firstVisibleIndex: 0, reorderTimer: -1, presentationEpoch: 0, anchorEpoch: 0, restoringAnchor: false, reduceMotion: false,
    onSelectCandidate: candidate => selected.push(candidate), onStop: () => actions.push('stop'),
    onRetry: () => actions.push('retry'), onRefresh: () => actions.push('refresh'), onRollback: () => actions.push('rollback'),
    getUIContext: () => ({ animateTo: (_options, apply) => apply(), postFrameCallback: frame => frames.push(frame.action) }),
    candidateScroller: { currentOffset: () => ({ yOffset: offset }), getItemRect: index => ({ y: index * 70 - offset, height: 70 }),
      scrollToIndex: index => { offset = index * 70; }, scrollBy: (_x, delta) => { offset += delta; },
      scrollTo: options => { offset = options.yOffset; } } });
  page.acceptState();
  return { page, selected, frames, actions, setOffset: value => { offset = value; }, offset: () => offset };
}
function flush() { const jobs = [...timers.values()]; timers.clear(); for (const job of jobs) job(); }
const a = item('a', 600), b = item('b', 200), c = item('c', 100);
const progressive = owner(); progressive.page.state = { kind: 'discovering' }; progressive.page.acceptState();
assert.equal(progressive.page.isSweeping(), true); assert.equal(progressive.page.statusText(), '正在查找 · 0 个来源');
progressive.page.state = { kind: 'candidates', candidates: [a, b], refreshing: true }; progressive.page.acceptState(); flush();
progressive.page.listTouch({ type: 'down' }); progressive.page.heldKey = key(a);
const fasterA = { ...a, latencyMs: 50 };
progressive.page.state = { kind: 'candidates', candidates: [fasterA, c, b], refreshing: true }; progressive.page.acceptState(); flush();
assert.deepEqual(progressive.page.displayedCandidates.map(key), [a, b, c].map(key), 'touch freezes physical order while additions appear');
assert.equal(progressive.page.displayedCandidates[0].latencyMs, 50, 'metadata updates without replacing row identity');
progressive.page.selectCandidate(key(b)); assert.equal(progressive.selected.length, 0, 'a moved hit target cannot select another identity');
progressive.page.listTouch({ type: 'up' }); flush();
assert.deepEqual(progressive.page.displayedCandidates.map(key), [a, c, b].map(key), 'idle publishes authoritative live order');
progressive.page.selectCandidate(key(a)); progressive.page.selectCandidate(key(a));
assert.equal(progressive.selected.length, 1); assert.equal(progressive.selected[0], fasterA, 'click resolves latest candidate by composite identity');
progressive.page.state = { kind: 'switching', targetSourceId: 'a' }; progressive.page.acceptState();
assert.equal(progressive.page.displayedCandidates.length, 3, 'real switching retains list');
progressive.page.state = { kind: 'failure', message: '失败', transactionId: 'tx' }; progressive.page.acceptState();
progressive.page.requestRefresh(); assert.equal(progressive.actions.length, 0, 'a live transaction only admits rollback');
assert.equal(progressive.page.displayedCandidates.length, 3);
progressive.page.state = { kind: 'empty' }; progressive.page.acceptState();
assert.equal(progressive.page.displayedCandidates.length, 0); assert.equal(progressive.page.latestCandidates.length, 0);

const variants = owner([{ ...a, isCurrent: true }, item('a', 100, 'alternate')]); flush();
variants.page.selectCandidate(key(a)); assert.equal(variants.selected.length, 0);
variants.page.selectCandidate(key(item('a', 100, 'alternate'))); assert.equal(variants.selected.length, 1, 'same-source alternate URL remains selectable');
const refreshed = owner([a, b]); flush();
refreshed.page.state = { kind: 'candidates', candidates: [a, b].map(candidate => ({ ...candidate, latencyKind: undefined, latencyMs: undefined })), refreshing: true }; refreshed.page.acceptState();
assert.deepEqual(refreshed.page.retestingKeys, [a, b].map(key));
refreshed.page.state = { kind: 'candidates', candidates: [{ ...a, latencyKind: undefined, latencyMs: undefined }, b], refreshing: true };
refreshed.page.acceptState(); assert.ok(refreshed.page.retestingKeys.includes(key(a)), 'cache invalidation keeps old row visibly remeasuring');
refreshed.page.state = { kind: 'candidates', candidates: [a, b], refreshing: true }; refreshed.page.acceptState();
assert.ok(!refreshed.page.retestingKeys.includes(key(a)), 'a fresh equal-duration sample still completes remeasurement');
refreshed.page.requestRefresh(); assert.deepEqual(refreshed.actions, ['stop']);
refreshed.page.state = { kind: 'candidates', candidates: [a, b], stopped: true }; refreshed.page.acceptState();
assert.equal(refreshed.page.isSweeping(), false); assert.equal(refreshed.page.statusText(), '已停止 · 2 个来源');

const anchored = owner([a, b, c]); flush(); anchored.setOffset(73); anchored.page.firstVisibleIndex = 1;
anchored.page.state = { kind: 'candidates', candidates: [b, c, a] }; anchored.page.acceptState(); flush();
assert.equal(anchored.frames.length, 1); anchored.frames.shift()(); anchored.frames.shift()();
assert.equal(anchored.offset(), 3, 'visible source b keeps its -3vp partial-row offset at its new index');
const cancelled = owner([a, b, c]); flush(); cancelled.setOffset(73); cancelled.page.firstVisibleIndex = 1;
cancelled.page.state = { kind: 'candidates', candidates: [c, a, b] }; cancelled.page.acceptState(); flush();
cancelled.page.listTouch({ type: 'down' }); cancelled.frames.shift()(); assert.equal(cancelled.offset(), 73, 'touch revokes delayed scroll restoration');
const departed = owner([a, b]); flush(); departed.page.state = { kind: 'candidates', candidates: [b, a] }; departed.page.acceptState();
departed.page.mounted = false; departed.page.cancelPresentation(); flush(); assert.deepEqual(departed.page.displayedCandidates.map(key), [a, b].map(key));

const row = new Candidate(); Object.assign(row, { candidate: item('source', 0), switching: false, pendingProbe: false, searching: true });
assert.equal(row.latencyText(), '0 ms'); assert.equal(row.chapterText(), '已发现，等待解析');
row.candidate = { ...row.candidate, latencyKind: undefined, latencyMs: 80 }; assert.equal(row.latencyText(), '待检测', 'legacy latency is not search timing');
row.pendingProbe = true; assert.equal(row.latencyText(), '重测中'); row.searching = false; assert.equal(row.latencyText(), '待重测');
row.candidate = { ...row.candidate, acquisitionState: 'catalogReady' }; assert.equal(row.chapterText(), '目录已就绪');
assert.equal((source.match(/SearchSpinner\(\{/g) ?? []).length, 1);
assert.match(source, /Text\('搜索延迟'\)/); assert.doesNotMatch(source, /SourceSwitchDemo|sourceSwitchDemoEvents/);
assert.match(source, /duration: this\.reduceMotion \? 0 : 220/);
console.log('source-switch live window: progressive state, stable touch identity, real callbacks, zero/failure/refresh, search latency, anchor and lifecycle PASS');
