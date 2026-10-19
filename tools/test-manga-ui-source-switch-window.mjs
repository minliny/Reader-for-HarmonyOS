import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';

export const CONTRACT_CASES = {
  "touch-selection": {
    "description": "Actual Window touch freeze, latest composite key, retained selection and refresh/rollback; structural DataSource fixture only",
    "resources": []
  },
  "anchor-lifecycle": {
    "description": "Actual Window anchor partial offset and delayed-frame touch/unmount cancellation",
    "resources": []
  },
  "text-result-stream": {
    "description": "Actual Window text results ordering and stable selection; no geometry or native lazy range claim",
    "resources": []
  }
};

async function case_touch_selection() {
const { default: assert } = await import('node:assert/strict');
const { readFileSync } = await import('node:fs');
const { stripTypeScriptTypes } = await import('node:module');
const { productionMotionMethods } = await import('./lib/reader-motion-method-probe.mjs');
const novelPresentation = await import('../entry/src/main/ets/features/source/SourceSwitchNovelPresentation.ts');
const { SOURCE_SWITCH_VISUAL } = await import('../entry/src/main/ets/features/source/SourceSwitchVisual.ts');
const { sourceSwitchNovelChapter, sourceSwitchNovelLatency, sourceSwitchNovelDrawerHeight, sourceSwitchNovelRowHeight, sourceSwitchNovelCompact } = novelPresentation;

const page = new URL('../entry/src/main/ets/features/source/SourceSwitchWindow.ets', import.meta.url);
const source = readFileSync(page, 'utf8');
const gateway = readFileSync(new URL('../entry/src/main/ets/features/source/SourceSwitchGateway.ts', import.meta.url), 'utf8');
const identities = gateway.slice(gateway.indexOf('export function sourceSwitchCandidateKey'), gateway.indexOf('function deduplicateSourceSwitchCandidates'));
const { sourceSwitchCandidateKey, sourceSwitchSourceCount } = new Function(`${stripTypeScriptTypes(identities).replaceAll('export ', '')}; return { sourceSwitchCandidateKey, sourceSwitchSourceCount };`)();
const dataStart=source.indexOf('@Observed\nclass SourceSwitchCandidateRow');
const dataEnd=source.indexOf('\n@Component',dataStart);

const SourceSwitchCandidateDataSource=new Function('sourceSwitchCandidateKey',
  `${stripTypeScriptTypes(source.slice(dataStart,dataEnd).replace('@Observed\n',''))};return SourceSwitchCandidateDataSource;`)(sourceSwitchCandidateKey);
const timers = new Map(); let nextTimer = 0;
class LayoutFrame { constructor(action) { this.action = action; } }
const Controller = productionMotionMethods(page,
  ['candidateKey', 'presentationCandidates', 'publishCandidates', 'acceptState', 'cancelPresentation', 'queueReorder', 'publishOrder', 'restoreAnchor',
    'listTouch', 'selectCandidate', 'busy', 'isSweeping', 'requiresReconciliation', 'rollbackRequired', 'requestRefresh', 'statusText', 'errorText', 'listHeaderCount', 'listHeaderHeight', 'rowHeight', 'compactWindow',
    'frameHeight', 'frameWidth', 'drawerWidth', 'novelSafeLeft', 'novelSafeRight', 'narrowWindow', 'sideInset', 'novelFontScale', 'flowChrome', 'scrollBook',
    'headingHeight', 'discoveryHeight', 'columnsHeight', 'footerHeight', 'bookHeight', 'timingWidth', 'drawerHeight', 'safeTop', 'safeBottom', 'safeLeft', 'safeRight'],
  { sourceSwitchCandidateKey, sourceSwitchSourceCount, SourceSwitchLayoutFrame: LayoutFrame,
    ...novelPresentation, SOURCE_SWITCH_VISUAL, ReaderWindowCoordinator: { metrics: () => ({ systemFontScale: 1, windowRect:{width:390,height:844} }) },
    Curve: { EaseInOut: 'curve' }, ScrollAlign: { START: 'start' }, TouchType: { Down: 'down', Up: 'up', Cancel: 'cancel' },
    setTimeout: callback => { const id = ++nextTimer; timers.set(id, callback); return id; },
    clearTimeout: id => timers.delete(id) });
const key = candidate => sourceSwitchCandidateKey(candidate.sourceId, candidate.bookUrl);
const item = (id, latencyMs = 300, bookUrl = `${id}-book`) => ({ sourceId: id, bookUrl, bookName: '书', category: 'novel',
  sourceName: id, latencyMs, latencyKind: 'search', acquisitionState: 'discovered' });
function owner(initial = [], contentKind = 'manga') {
  const page = new Controller(); const selected = [], frames = [], actions = [];
  let offset = 0;
  Object.assign(page, { contentKind, state: { kind: 'candidates', candidates: initial }, displayedCandidates: [], latestCandidates: [],
    candidateDataSource: new SourceSwitchCandidateDataSource(),
    retestingKeys: [], pendingSearchKeys: new Set(), wasRefreshing: false, mounted: true, foreground: true,
    touching: false, scrolling: false, heldKey: '', selectedKey: '', selectionPending: false, listMounted: true,
    firstVisibleIndex: 0, firstVisibleListIndex: 0, contextHeight: 0, statusHeight: 0, containerHeight:0, containerWidth:0, readerWindowMetricsRevision:-1, listStartInset: () => 0, reorderTimer: -1, presentationEpoch: 0, anchorEpoch: 0, restoringAnchor: false, reduceMotion: false,
    onSelectCandidate: candidate => selected.push(candidate), onStop: () => actions.push('stop'),
    onRetry: () => actions.push('retry'), onRefresh: () => actions.push('refresh'), onRollback: () => actions.push('rollback'),
    getUIContext: () => ({ animateTo: (_options, apply) => apply(), postFrameCallback: frame => frames.push(frame.action) }),
    candidateScroller: { currentOffset: () => ({ yOffset: offset }), getItemRect: index => ({ y: index * page.rowHeight() - offset, height: page.rowHeight() }),
      scrollToIndex: index => { offset = index * page.rowHeight(); }, scrollBy: (_x, delta) => { offset += delta; },
      scrollTo: options => { offset = options.yOffset; } } });
  page.acceptState();
  return { page, selected, frames, actions, setOffset: value => { offset = value; }, offset: () => offset };
}
function flush() { const jobs = [...timers.values()]; timers.clear(); for (const job of jobs) job(); }
const a = item('a', 600), b = item('b', 200), c = item('c', 100);
// VM-SS-001: notifications must admit a mounted empty V1 lazy range, then
// preserve native row identities during append and same-key metadata changes.
const progressive = owner(); progressive.page.state = { kind: 'discovering' }; progressive.page.acceptState();
assert.equal(progressive.page.isSweeping(), true); assert.equal(progressive.page.statusText(), '正在查找 · 已发现 0 个');
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
assert.equal(progressive.page.candidateDataSource.totalCount(),0,'empty state clears the native source too');

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
assert.equal(refreshed.page.isSweeping(), false); assert.equal(refreshed.page.statusText(), '已停止 · 已发现 2 个');

}

async function case_anchor_lifecycle() {
const { default: assert } = await import('node:assert/strict');
const { readFileSync } = await import('node:fs');
const { stripTypeScriptTypes } = await import('node:module');
const { productionMotionMethods } = await import('./lib/reader-motion-method-probe.mjs');
const novelPresentation = await import('../entry/src/main/ets/features/source/SourceSwitchNovelPresentation.ts');
const { SOURCE_SWITCH_VISUAL } = await import('../entry/src/main/ets/features/source/SourceSwitchVisual.ts');
const { sourceSwitchNovelChapter, sourceSwitchNovelLatency, sourceSwitchNovelDrawerHeight, sourceSwitchNovelRowHeight, sourceSwitchNovelCompact } = novelPresentation;

const page = new URL('../entry/src/main/ets/features/source/SourceSwitchWindow.ets', import.meta.url);
const source = readFileSync(page, 'utf8');
const gateway = readFileSync(new URL('../entry/src/main/ets/features/source/SourceSwitchGateway.ts', import.meta.url), 'utf8');
const identities = gateway.slice(gateway.indexOf('export function sourceSwitchCandidateKey'), gateway.indexOf('function deduplicateSourceSwitchCandidates'));
const { sourceSwitchCandidateKey, sourceSwitchSourceCount } = new Function(`${stripTypeScriptTypes(identities).replaceAll('export ', '')}; return { sourceSwitchCandidateKey, sourceSwitchSourceCount };`)();
const dataStart=source.indexOf('@Observed\nclass SourceSwitchCandidateRow');
const dataEnd=source.indexOf('\n@Component',dataStart);

const SourceSwitchCandidateDataSource=new Function('sourceSwitchCandidateKey',
  `${stripTypeScriptTypes(source.slice(dataStart,dataEnd).replace('@Observed\n',''))};return SourceSwitchCandidateDataSource;`)(sourceSwitchCandidateKey);
const timers = new Map(); let nextTimer = 0;
class LayoutFrame { constructor(action) { this.action = action; } }
const Controller = productionMotionMethods(page,
  ['candidateKey', 'presentationCandidates', 'publishCandidates', 'acceptState', 'cancelPresentation', 'queueReorder', 'publishOrder', 'restoreAnchor',
    'listTouch', 'selectCandidate', 'busy', 'isSweeping', 'requiresReconciliation', 'rollbackRequired', 'requestRefresh', 'statusText', 'errorText', 'listHeaderCount', 'listHeaderHeight', 'rowHeight', 'compactWindow',
    'frameHeight', 'frameWidth', 'drawerWidth', 'novelSafeLeft', 'novelSafeRight', 'narrowWindow', 'sideInset', 'novelFontScale', 'flowChrome', 'scrollBook',
    'headingHeight', 'discoveryHeight', 'columnsHeight', 'footerHeight', 'bookHeight', 'timingWidth', 'drawerHeight', 'safeTop', 'safeBottom', 'safeLeft', 'safeRight'],
  { sourceSwitchCandidateKey, sourceSwitchSourceCount, SourceSwitchLayoutFrame: LayoutFrame,
    ...novelPresentation, SOURCE_SWITCH_VISUAL, ReaderWindowCoordinator: { metrics: () => ({ systemFontScale: 1, windowRect:{width:390,height:844} }) },
    Curve: { EaseInOut: 'curve' }, ScrollAlign: { START: 'start' }, TouchType: { Down: 'down', Up: 'up', Cancel: 'cancel' },
    setTimeout: callback => { const id = ++nextTimer; timers.set(id, callback); return id; },
    clearTimeout: id => timers.delete(id) });
const key = candidate => sourceSwitchCandidateKey(candidate.sourceId, candidate.bookUrl);
const item = (id, latencyMs = 300, bookUrl = `${id}-book`) => ({ sourceId: id, bookUrl, bookName: '书', category: 'novel',
  sourceName: id, latencyMs, latencyKind: 'search', acquisitionState: 'discovered' });
function owner(initial = [], contentKind = 'manga') {
  const page = new Controller(); const selected = [], frames = [], actions = [];
  let offset = 0;
  Object.assign(page, { contentKind, state: { kind: 'candidates', candidates: initial }, displayedCandidates: [], latestCandidates: [],
    candidateDataSource: new SourceSwitchCandidateDataSource(),
    retestingKeys: [], pendingSearchKeys: new Set(), wasRefreshing: false, mounted: true, foreground: true,
    touching: false, scrolling: false, heldKey: '', selectedKey: '', selectionPending: false, listMounted: true,
    firstVisibleIndex: 0, firstVisibleListIndex: 0, contextHeight: 0, statusHeight: 0, containerHeight:0, containerWidth:0, readerWindowMetricsRevision:-1, listStartInset: () => 0, reorderTimer: -1, presentationEpoch: 0, anchorEpoch: 0, restoringAnchor: false, reduceMotion: false,
    onSelectCandidate: candidate => selected.push(candidate), onStop: () => actions.push('stop'),
    onRetry: () => actions.push('retry'), onRefresh: () => actions.push('refresh'), onRollback: () => actions.push('rollback'),
    getUIContext: () => ({ animateTo: (_options, apply) => apply(), postFrameCallback: frame => frames.push(frame.action) }),
    candidateScroller: { currentOffset: () => ({ yOffset: offset }), getItemRect: index => ({ y: index * page.rowHeight() - offset, height: page.rowHeight() }),
      scrollToIndex: index => { offset = index * page.rowHeight(); }, scrollBy: (_x, delta) => { offset += delta; },
      scrollTo: options => { offset = options.yOffset; } } });
  page.acceptState();
  return { page, selected, frames, actions, setOffset: value => { offset = value; }, offset: () => offset };
}
function flush() { const jobs = [...timers.values()]; timers.clear(); for (const job of jobs) job(); }
const a = item('a', 600), b = item('b', 200), c = item('c', 100);
// VM-SS-001: notifications must admit a mounted empty V1 lazy range, then
// preserve native row identities during append and same-key metadata changes.

const anchored = owner([a, b, c]); flush(); anchored.setOffset(53); anchored.page.firstVisibleIndex = 1;
anchored.page.state = { kind: 'candidates', candidates: [b, c, a] }; anchored.page.acceptState(); flush();
assert.equal(anchored.frames.length, 1); anchored.frames.shift()(); anchored.frames.shift()();
assert.equal(anchored.offset(), 3, 'visible source b keeps its -3vp partial-row offset at its new index');
const cancelled = owner([a, b, c]); flush(); cancelled.setOffset(53); cancelled.page.firstVisibleIndex = 1;
cancelled.page.state = { kind: 'candidates', candidates: [c, a, b] }; cancelled.page.acceptState(); flush();
cancelled.page.listTouch({ type: 'down' }); cancelled.frames.shift()(); assert.equal(cancelled.offset(), 53, 'touch revokes delayed scroll restoration');
const departed = owner([a, b]); flush(); departed.page.state = { kind: 'candidates', candidates: [b, a] }; departed.page.acceptState();
departed.page.mounted = false; departed.page.cancelPresentation(); flush(); assert.deepEqual(departed.page.displayedCandidates.map(key), [a, b].map(key));

}

async function case_text_result_stream() {
const { default: assert } = await import('node:assert/strict');
const { readFileSync } = await import('node:fs');
const { stripTypeScriptTypes } = await import('node:module');
const { productionMotionMethods } = await import('./lib/reader-motion-method-probe.mjs');
const novelPresentation = await import('../entry/src/main/ets/features/source/SourceSwitchNovelPresentation.ts');
const { SOURCE_SWITCH_VISUAL } = await import('../entry/src/main/ets/features/source/SourceSwitchVisual.ts');
const { sourceSwitchNovelChapter, sourceSwitchNovelLatency, sourceSwitchNovelDrawerHeight, sourceSwitchNovelRowHeight, sourceSwitchNovelCompact } = novelPresentation;

const page = new URL('../entry/src/main/ets/features/source/SourceSwitchWindow.ets', import.meta.url);
const source = readFileSync(page, 'utf8');
const gateway = readFileSync(new URL('../entry/src/main/ets/features/source/SourceSwitchGateway.ts', import.meta.url), 'utf8');
const identities = gateway.slice(gateway.indexOf('export function sourceSwitchCandidateKey'), gateway.indexOf('function deduplicateSourceSwitchCandidates'));
const { sourceSwitchCandidateKey, sourceSwitchSourceCount } = new Function(`${stripTypeScriptTypes(identities).replaceAll('export ', '')}; return { sourceSwitchCandidateKey, sourceSwitchSourceCount };`)();
const dataStart=source.indexOf('@Observed\nclass SourceSwitchCandidateRow');
const dataEnd=source.indexOf('\n@Component',dataStart);

const SourceSwitchCandidateDataSource=new Function('sourceSwitchCandidateKey',
  `${stripTypeScriptTypes(source.slice(dataStart,dataEnd).replace('@Observed\n',''))};return SourceSwitchCandidateDataSource;`)(sourceSwitchCandidateKey);
const timers = new Map(); let nextTimer = 0;
class LayoutFrame { constructor(action) { this.action = action; } }
const Controller = productionMotionMethods(page,
  ['candidateKey', 'presentationCandidates', 'publishCandidates', 'acceptState', 'cancelPresentation', 'queueReorder', 'publishOrder', 'restoreAnchor',
    'listTouch', 'selectCandidate', 'busy', 'isSweeping', 'requiresReconciliation', 'rollbackRequired', 'requestRefresh', 'statusText', 'errorText', 'listHeaderCount', 'listHeaderHeight', 'rowHeight', 'compactWindow',
    'frameHeight', 'frameWidth', 'drawerWidth', 'novelSafeLeft', 'novelSafeRight', 'narrowWindow', 'sideInset', 'novelFontScale', 'flowChrome', 'scrollBook',
    'headingHeight', 'discoveryHeight', 'columnsHeight', 'footerHeight', 'bookHeight', 'timingWidth', 'drawerHeight', 'safeTop', 'safeBottom', 'safeLeft', 'safeRight'],
  { sourceSwitchCandidateKey, sourceSwitchSourceCount, SourceSwitchLayoutFrame: LayoutFrame,
    ...novelPresentation, SOURCE_SWITCH_VISUAL, ReaderWindowCoordinator: { metrics: () => ({ systemFontScale: 1, windowRect:{width:390,height:844} }) },
    Curve: { EaseInOut: 'curve' }, ScrollAlign: { START: 'start' }, TouchType: { Down: 'down', Up: 'up', Cancel: 'cancel' },
    setTimeout: callback => { const id = ++nextTimer; timers.set(id, callback); return id; },
    clearTimeout: id => timers.delete(id) });
const key = candidate => sourceSwitchCandidateKey(candidate.sourceId, candidate.bookUrl);
const item = (id, latencyMs = 300, bookUrl = `${id}-book`) => ({ sourceId: id, bookUrl, bookName: '书', category: 'novel',
  sourceName: id, latencyMs, latencyKind: 'search', acquisitionState: 'discovered' });
function owner(initial = [], contentKind = 'manga') {
  const page = new Controller(); const selected = [], frames = [], actions = [];
  let offset = 0;
  Object.assign(page, { contentKind, state: { kind: 'candidates', candidates: initial }, displayedCandidates: [], latestCandidates: [],
    candidateDataSource: new SourceSwitchCandidateDataSource(),
    retestingKeys: [], pendingSearchKeys: new Set(), wasRefreshing: false, mounted: true, foreground: true,
    touching: false, scrolling: false, heldKey: '', selectedKey: '', selectionPending: false, listMounted: true,
    firstVisibleIndex: 0, firstVisibleListIndex: 0, contextHeight: 0, statusHeight: 0, containerHeight:0, containerWidth:0, readerWindowMetricsRevision:-1, listStartInset: () => 0, reorderTimer: -1, presentationEpoch: 0, anchorEpoch: 0, restoringAnchor: false, reduceMotion: false,
    onSelectCandidate: candidate => selected.push(candidate), onStop: () => actions.push('stop'),
    onRetry: () => actions.push('retry'), onRefresh: () => actions.push('refresh'), onRollback: () => actions.push('rollback'),
    getUIContext: () => ({ animateTo: (_options, apply) => apply(), postFrameCallback: frame => frames.push(frame.action) }),
    candidateScroller: { currentOffset: () => ({ yOffset: offset }), getItemRect: index => ({ y: index * page.rowHeight() - offset, height: page.rowHeight() }),
      scrollToIndex: index => { offset = index * page.rowHeight(); }, scrollBy: (_x, delta) => { offset += delta; },
      scrollTo: options => { offset = options.yOffset; } } });
  page.acceptState();
  return { page, selected, frames, actions, setOffset: value => { offset = value; }, offset: () => offset };
}
function flush() { const jobs = [...timers.values()]; timers.clear(); for (const job of jobs) job(); }
const a = item('a', 600), b = item('b', 200), c = item('c', 100);
// VM-SS-001: notifications must admit a mounted empty V1 lazy range, then
// preserve native row identities during append and same-key metadata changes.
const fasterA={...a,latencyMs:50};
const novel = owner([a, b], 'text'); flush();
assert.equal(novel.page.listHeaderCount(), 0);
assert.equal(novel.page.listHeaderHeight(), 0);
assert.equal(novel.page.rowHeight(), 50);
assert.equal(novel.page.statusText(), '查找结束 · 已找到 2 个书源');
const fasterC={...c,latencyMs:25};
novel.page.state = { kind: 'candidates', candidates: [fasterC, fasterA, b], refreshing: true };
novel.page.acceptState(); flush();
assert.deepEqual(novel.page.displayedCandidates.map(key), [c,a,b].map(key), 'a faster completed source moves ahead while the remaining sweep is active');
assert.deepEqual(Array.from({length:novel.page.candidateDataSource.totalCount()},(_value,index)=>novel.page.candidateDataSource.getData(index).key),[c,a,b].map(key),'native data receives the exact same measured ordering');
assert.equal(novel.page.displayedCandidates[1].latencyMs, 50, 'metadata still updates on the same identity');
novel.page.listTouch({type:'down'}); novel.page.heldKey = key(b);
novel.page.state = { kind: 'candidates', candidates: [fasterC, { ...fasterA, latestChapterTitle: '新章节' }, b], refreshing: true };
novel.page.acceptState(); novel.page.selectCandidate(key(a)); assert.equal(novel.selected.length, 0);
novel.page.listTouch({type:'up'}); novel.page.selectCandidate(key(b));
assert.equal(novel.selected.length, 1); assert.equal(novel.selected[0].sourceId, 'b');
assert.equal(novel.actions.length, 0, 'selection calls the real owner without synthetic refresh/commit');
assert.equal(sourceSwitchNovelChapter({ ...a, latestChapterTitle: ' 新章节 ', acquisitionState:'failed' }), '新章节');
assert.equal(sourceSwitchNovelChapter({ ...a, latestChapterTitle: undefined, acquisitionState:'failed' }), '暂无最新章节');
assert.equal(sourceSwitchNovelLatency({ ...a, latencyMs:0 }), '0 ms');
assert.equal(sourceSwitchNovelLatency({ ...a, latencyKind:undefined, timeout:true, offline:true }), '—', 'cached success does not become a failed or pending-check row');
for (const latencyMs of [undefined, -1, Infinity, NaN]) assert.equal(sourceSwitchNovelLatency({ ...a, latencyMs }), '—');
assert.equal(sourceSwitchNovelDrawerHeight(844,24),699);
assert.equal(sourceSwitchNovelDrawerHeight(390,24),366);

}

const implementations = {'touch-selection':case_touch_selection,'anchor-lifecycle':case_anchor_lifecycle,'text-result-stream':case_text_result_stream};
for (const id of selectContractCases(CONTRACT_CASES)) {
  await implementations[id]();
  recordContractCasePass(id);
}
