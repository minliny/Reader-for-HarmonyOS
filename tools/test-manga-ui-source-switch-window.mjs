import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { productionMotionMethods } from './lib/reader-motion-method-probe.mjs';
import { novelPresentation, sourceSwitchLiveSdk } from './lib/source-switch-sdk-consumer.mjs';
import { boundedSurfaceSdk } from './lib/bounded-surface-sdk-probe.mjs';
import { SOURCE_SWITCH_VISUAL } from '../entry/src/main/ets/features/source/SourceSwitchVisual.ts';
const { sourceSwitchNovelChapter, sourceSwitchNovelLatency, sourceSwitchNovelDrawerHeight, sourceSwitchNovelRowHeight, sourceSwitchNovelCompact } = novelPresentation;

const page = new URL('../entry/src/main/ets/features/source/SourceSwitchWindow.ets', import.meta.url);
const source = readFileSync(page, 'utf8');
const gateway = readFileSync(new URL('../entry/src/main/ets/features/source/SourceSwitchGateway.ts', import.meta.url), 'utf8');
const identities = gateway.slice(gateway.indexOf('export function sourceSwitchCandidateKey'), gateway.indexOf('function deduplicateSourceSwitchCandidates'));
const { sourceSwitchCandidateKey, sourceSwitchSourceCount } = new Function(`${stripTypeScriptTypes(identities).replaceAll('export ', '')}; return { sourceSwitchCandidateKey, sourceSwitchSourceCount };`)();
const dataStart=source.indexOf('class SourceSwitchCandidateDataSource');
const dataEnd=source.indexOf('\n@Component',dataStart);
assert.ok(dataStart>=0&&dataEnd>dataStart,'production V1 lazy data source is present');
const holderStart=source.indexOf('class SourceSwitchCandidateRow');
assert.match(source,/@Observed\s+class SourceSwitchCandidateRow/,'same-key metadata is observed by the native runtime');
const SourceSwitchCandidateRow=new Function(`${stripTypeScriptTypes(source.slice(holderStart,source.indexOf('/** Native lazy admission',holderStart)))};return SourceSwitchCandidateRow;`)();
const SourceSwitchCandidateDataSource=new Function('sourceSwitchCandidateKey','SourceSwitchCandidateRow',
  `${stripTypeScriptTypes(source.slice(dataStart,dataEnd))};return SourceSwitchCandidateDataSource;`)(sourceSwitchCandidateKey,SourceSwitchCandidateRow);
const timers = new Map(); let nextTimer = 0;
class LayoutFrame { constructor(action) { this.action = action; } }
const Controller = productionMotionMethods(page,
  ['candidateKey', 'publishCandidates', 'acceptState', 'cancelPresentation', 'queueReorder', 'publishOrder', 'restoreAnchor',
    'listTouch', 'selectCandidate', 'busy', 'isSweeping', 'requiresReconciliation', 'rollbackRequired', 'requestRefresh', 'statusText', 'errorText', 'listHeaderCount', 'listHeaderHeight', 'rowHeight', 'compactWindow',
    'frameHeight', 'frameWidth', 'drawerWidth', 'novelSafeLeft', 'novelSafeRight', 'narrowWindow', 'sideInset', 'novelFontScale', 'flowChrome', 'scrollBook', 'novelDiscoveryPhase',
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
// The production platform projection covers every domain field. Updating a
// previously enriched candidate also clears absent optional metadata rather
// than leaving stale timing, identity proof or acquisition feedback behind.
const candidateContract=gateway.slice(gateway.indexOf('export type SourceSwitchCandidate = {'),gateway.indexOf('export type SourceSwitchProbeQuery'));
const candidateFields=[...candidateContract.matchAll(/^  (\w+)\??:/gm)].map(match=>match[1]);
assert.equal(candidateFields.length,25);
const complete={...a,acquisitionState:'readable',acquisitionMessage:'ok',verifiedChapterUrl:'chapter',sourceVersion:'version',
  searchVariables:[{name:'token',value:'value'}],sourceOrder:3,author:'@作者',authorIdentity:{schemaVersion:1,sourceVersion:'version',field:'search',raw:'@作者',label:'作者',rule:'author-nickname-at-v1'},coverUrl:'cover',
  latestChapterTitle:'新章节',currentChapterTitle:'当前章节',currentChapterIndex:2,chapterWordCount:500,checkedAt:123,
  latencyMeasuredAt:456,offline:true,timeout:true,isCurrent:true};
const projected=new SourceSwitchCandidateRow(complete);
for(const field of candidateFields){assert.ok(Object.hasOwn(projected,field),`projection owns ${field}`);assert.equal(projected[field],complete[field],`constructor retains ${field}`);}
projected.update(item('replacement',0));
for(const field of candidateFields)assert.equal(projected[field],item('replacement',0)[field],`update replaces or clears ${field}`);
const sharedRowStart=source.indexOf('struct SourceSwitchNovelRow'),sharedRowEnd=source.indexOf('/** Real reading',sharedRowStart);
assert.ok(sharedRowStart>=0&&sharedRowEnd>sharedRowStart,'production shared row source is present');
const sharedRowSource=source.slice(sharedRowStart,sharedRowEnd);
assert.doesNotMatch(sharedRowSource,/get candidate\(/,'native struct uses the actual ObjectLink field, never a getter omitted by the SDK');
// VM-SS-001: notifications must admit a mounted empty V1 lazy range, then
// preserve native row identities during append and same-key metadata changes.
const lazyData=new SourceSwitchCandidateDataSource(),notifications=[];
const listener={onDataAdd:index=>notifications.push(['add',index]),
  onDataChange:index=>notifications.push(['change',index]),onDataReloaded:()=>notifications.push(['reload'])};
lazyData.registerDataChangeListener(listener);lazyData.registerDataChangeListener(listener);
assert.equal(lazyData.totalCount(),0);
lazyData.publish([a,b]);assert.deepEqual(notifications,[['add',0],['add',1]],'empty-prefix results enter the existing native range');
assert.equal(lazyData.totalCount(),2);assert.equal(lazyData.getData(1).sourceId,b.sourceId);assert.equal(lazyData.getData(1).latencyMs,b.latencyMs);
notifications.length=0;lazyData.publish([a,b,c]);assert.deepEqual(notifications,[['add',2]],'stable-prefix append notifies only the appended position');
const enrichedA={...a,latestChapterTitle:'新章节',latencyMs:50};
const originalHolder=lazyData.getData(0);
notifications.length=0;lazyData.publish([enrichedA,b,c]);assert.deepEqual(notifications,[],'same-key metadata uses ObjectLink without invalidating the native lazy child');
assert.equal(lazyData.getData(0),originalHolder);assert.equal(originalHolder.latestChapterTitle,enrichedA.latestChapterTitle);assert.equal(originalHolder.latencyMs,enrichedA.latencyMs);
notifications.length=0;lazyData.publish([b,c,enrichedA]);assert.deepEqual(notifications,[['reload']],'non-prefix authoritative order uses platform keyed reload');
notifications.length=0;lazyData.publish([]);assert.deepEqual(notifications,[['reload']]);assert.equal(lazyData.totalCount(),0);
lazyData.unregisterDataChangeListener(listener);notifications.length=0;
lazyData.publish([a]);assert.deepEqual(notifications,[],'retired native listeners receive no later publication');
assert.equal(lazyData.totalCount(),1);assert.equal(lazyData.getData(0).sourceId,a.sourceId);assert.equal(lazyData.getData(0).latencyMs,a.latencyMs);
assert.notEqual(lazyData.getData(0),originalHolder,'a deleted and re-added identity receives a new observer, not a retired holder');
assert.doesNotMatch(source,/Repeat\([\s\S]*virtualScroll/,'V1 picker cannot reintroduce the unsupported renderer');
assert.match(source,/LazyForEach\(this\.candidateDataSource/);
assert.match(source,/\}\.width\('100%'\)\.height\(this\.rowHeight\(\)\);/,'native ListItem has a bounded row extent');
assert.equal((source.match(/this\.displayedCandidates =/g)??[]).length,1,'all admitted arrays and clear operations pass through the synchronized publication method');

// Same-key lazy caching retains the native child. Execute the installed SDK's
// ObjectLink/proxy classes and the production row builder, rather than merely
// checking an onDataChange notification. Ace layout/paint still needs VM proof.
{
  const native=boundedSurfaceSdk({allowEmptyBranchAdmission:true});
  const deps=sourceSwitchLiveSdk(native,{setTimeout(){return 1;},clearTimeout(){}});
  const data=new deps.SourceSwitchCandidateDataSource(),events=[];
  data.registerDataChangeListener({onDataAdd:index=>events.push(['add',index]),onDataChange:index=>events.push(['change',index]),onDataReloaded:()=>events.push(['reload'])});
  const cached={...item('retained'),latencyMs:undefined,latencyKind:undefined,latestChapterTitle:'旧章节'};
  const unknownHolder=new deps.SourceSwitchCandidateRow(cached);
  const unknownRow=new deps.SourceSwitchNovelRow(undefined,{candidate:unknownHolder,reduceMotion:true},undefined,7000);unknownRow.initialRender();
  assert.ok(native.nodes(unknownRow).some(node=>node.type==='Text'&&node.create==='—'));
  // The finite builder probe cannot remove a non-empty conditional branch.
  // Prove the unknown-to-measured value contract through the real ObjectLink
  // class separately; Ace's initial dash-to-number paint remains VM evidence.
  const valueHolder=new deps.SourceSwitchCandidateRow(cached);
  const valueLink=new native.properties.sdk.SynchedPropertyNestedObjectPU(valueHolder,unknownRow,'valueRow');
  assert.equal(sourceSwitchNovelLatency(valueLink.get()),'—');
  valueHolder.update({...cached,latencyKind:'search',latencyMs:325});
  assert.equal(sourceSwitchNovelLatency(valueLink.get()),'325 ms');
  data.publish([{...cached,latencyKind:'search',latencyMs:0}]);const holder=data.getData(0);events.length=0;
  const linked=new deps.SourceSwitchNovelRow(undefined,{candidate:holder,reduceMotion:true},undefined,7001);linked.initialRender();
  const hit=native.nodes(linked).find(node=>node.type==='Row');
  assert.ok(native.nodes(linked).some(node=>node.type==='Text'&&node.create==='0'));
  // Negative control uses the actual SDK's old ordinary-prop deep copy plus
  // a bounded stable-key cache model. It does not execute Ace's native cache.
  const oldProp=native.properties.deepCopy(cached),keyedCache=new Map([[key(cached),oldProp]]);
  const legacyChanged={...cached,latencyKind:'search',latencyMs:325};
  assert.equal(key(legacyChanged),key(cached));
  assert.equal(sourceSwitchNovelLatency(keyedCache.get(key(legacyChanged))),'—',
    'the old same-key ordinary-prop row keeps the initial dash despite a new candidate');
  for(const duration of [325,441]){
    const enriched={...cached,latencyKind:'search',latencyMs:duration,latestChapterTitle:`最新章节${duration}`};
    data.publish([enriched]);native.properties.flush();
    assert.equal(data.getData(0),holder,'metadata retains the same native observation owner');
    assert.equal(linked.candidate,holder,'the real SDK ObjectLink keeps the original holder');
    assert.equal(native.nodes(linked).find(node=>node.type==='Row'),hit,'same-key update does not remount/reset the hit target');
    assert.ok(native.nodes(linked).some(node=>node.type==='Text'&&node.create===String(duration)),
      'actual SDK observer updates the production latency text');
    assert.ok(native.nodes(linked).some(node=>node.type==='Text'&&node.create===`最新章节${duration}`));
    assert.deepEqual(events,[],'metadata creates no native replacement/add/reload operation');
  }
  data.publish([holder,b]);assert.deepEqual(events,[['add',1]]);events.length=0;
  const secondHolder=data.getData(1);data.publish([b,holder]);
  assert.deepEqual(events,[['reload']]);assert.equal(data.getData(0),secondHolder);assert.equal(data.getData(1),holder);
  data.publish([]);data.publish([cached]);
  assert.notEqual(data.getData(0),holder,'deleted and re-added key cannot reuse an old observer');
  assert.equal(holder.latencyMs,441,'retired holder no longer receives subsequent publications');
  const anotherScope=new deps.SourceSwitchCandidateDataSource();anotherScope.publish([cached]);
  assert.notEqual(anotherScope.getData(0),data.getData(0),'a new picker scope has no previous holder ownership');
  assert.doesNotMatch(source,/struct SourceSwitchLiveRow\b/, 'both content kinds retain the selected shared native row visual');
  assert.match(source,/struct SourceSwitchNovelRow[\s\S]*?@ObjectLink candidate: SourceSwitchCandidateRow/);
}
console.log('source-switch V1 native data admission: empty, append, metadata, reload and listener retirement PASS');
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

const anchored = owner([a, b, c]); flush(); anchored.setOffset(53); anchored.page.firstVisibleIndex = 1;
anchored.page.state = { kind: 'candidates', candidates: [b, c, a] }; anchored.page.acceptState(); flush();
assert.equal(anchored.frames.length, 1); anchored.frames.shift()(); anchored.frames.shift()();
assert.equal(anchored.offset(), 3, 'visible source b keeps its -3vp partial-row offset at its new index');
const cancelled = owner([a, b, c]); flush(); cancelled.setOffset(53); cancelled.page.firstVisibleIndex = 1;
cancelled.page.state = { kind: 'candidates', candidates: [c, a, b] }; cancelled.page.acceptState(); flush();
cancelled.page.listTouch({ type: 'down' }); cancelled.frames.shift()(); assert.equal(cancelled.offset(), 53, 'touch revokes delayed scroll restoration');
const departed = owner([a, b]); flush(); departed.page.state = { kind: 'candidates', candidates: [b, a] }; departed.page.acceptState();
departed.page.mounted = false; departed.page.cancelPresentation(); flush(); assert.deepEqual(departed.page.displayedCandidates.map(key), [a, b].map(key));

assert.equal((source.match(/SearchSpinner\(\{/g) ?? []).length, 0, 'both formats use the selected shared spinner');
assert.equal((source.match(/SourceSwitchSpinner\(\{/g) ?? []).length, 1, 'one shared discovery spinner implementation');
assert.match(source, /Text\('搜索耗时'\)/); assert.doesNotMatch(source, /SourceSwitchDemo|sourceSwitchDemoEvents/);
assert.match(source, /duration: this\.reduceMotion \? 0 : 220/);
console.log('source-switch live window: progressive state, stable touch identity, real callbacks, zero/failure/refresh, search latency, anchor and lifecycle PASS');

// Both formats share the drawer geometry. Novel arrival ordering and manga
// authoritative delayed ordering/anchors above retain their original policies.
const novel = owner([a, b], 'text'); flush();
assert.equal(novel.page.listHeaderCount(), 0);
assert.equal(novel.page.listHeaderHeight(), 0);
assert.equal(novel.page.rowHeight(), 50);
assert.equal(novel.page.statusText(), '查找结束 · 已找到 2 个书源');
novel.page.state = { kind: 'candidates', candidates: [c, b, fasterA], refreshing: true };
novel.page.acceptState(); flush();
assert.deepEqual(novel.page.displayedCandidates.map(key), [a,b,c].map(key), 'successful additions append without re-sorting existing novel rows');
assert.deepEqual(Array.from({length:novel.page.candidateDataSource.totalCount()},(_value,index)=>key(novel.page.candidateDataSource.getData(index))),[a,b,c].map(key),'native data receives the same held-order novel projection');
assert.equal(novel.page.displayedCandidates[0].latencyMs, 50, 'metadata still updates in place');
novel.page.listTouch({type:'down'}); novel.page.heldKey = key(b);
novel.page.state = { kind: 'candidates', candidates: [c, b, { ...fasterA, latestChapterTitle: '新章节' }], refreshing: true };
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
assert.equal(sourceSwitchNovelDrawerHeight(844,160),684);
assert.equal(sourceSwitchNovelDrawerHeight(-1,24),0);
assert.equal(sourceSwitchNovelDrawerHeight(NaN,24),0);
assert.equal(sourceSwitchNovelRowHeight(1),50); assert.equal(sourceSwitchNovelRowHeight(2),100);
assert.equal(sourceSwitchNovelRowHeight(NaN),50);
assert.match(source, /sourceSwitchNovelDrawerHeight\(this.frameHeight\(\), this.safeTop\(\)\)/);
assert.match(source, /if \(this.state.kind === 'switching'\)/);
assert.match(source, /TransitionEffect.move\(TransitionEdge.BOTTOM\)/);
assert.doesNotMatch(sharedRowSource, /待检测|重测中|超时|离线|待重测|chevron/);
console.log('novel source-switch drawer: real successful-result stream, stable selection, fixed headers, density, safe-window geometry and honest cached latency PASS');

const compact = owner([a,b,c], 'text'); compact.page.containerHeight=390; compact.page.contextHeight=88;
assert.equal(compact.page.compactWindow(),true);
assert.equal(compact.page.listHeaderCount(),1,'short-window book context remains reachable inside the result scroller');
assert.equal(compact.page.listHeaderHeight(),100, 'header extent follows the selected fixed book box, not a smaller measured text box');
const resultViewport=sourceSwitchNovelDrawerHeight(390,24)-44-42-28-35-24;
assert.ok(resultViewport>=3*compact.page.rowHeight(),'short-window fixed chrome leaves at least three row heights to scroll after the book context');
assert.equal(sourceSwitchNovelCompact(844),false);
assert.equal(sourceSwitchNovelCompact(0),false);
assert.match(source, /if \(this.scrollBook\(\)\) \{\s*ListItem\(\) \{ this.novelBookContext\(\);/);
console.log('novel compact-window metadata scroll and usable candidate viewport PASS');

// A failed re-search retains usable rows while both the visible phase and
// accessibility summary report failure, rather than a normal completion.
const failedRefresh = owner([a], 'text');
failedRefresh.page.state = { kind: 'candidates', candidates: [a], refreshing: false,
  refreshError: '本次换源搜索全部失败，已保留原有结果' };
failedRefresh.page.acceptState();
assert.equal(failedRefresh.page.novelDiscoveryPhase(), '查找失败');
assert.equal(failedRefresh.page.statusText(), '查找失败');
assert.equal(failedRefresh.page.errorText(), failedRefresh.page.state.refreshError);
failedRefresh.page.requestRefresh();
assert.deepEqual(failedRefresh.actions, ['refresh'], 'retained-row failure retries the full discovery flow');
assert.equal(failedRefresh.page.displayedCandidates.length, 1, 'the failed refresh does not remove existing rows');
