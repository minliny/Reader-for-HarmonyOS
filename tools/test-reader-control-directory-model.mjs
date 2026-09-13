import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { readerControlDirectorySnapshot as project, ReaderControlDirectoryPosition }
  from '../entry/src/main/ets/features/reading/ReaderControlDirectoryModel.ts';
const entries = Array.from({length: 100}, (_, i) => ({ index: i * 10, title: `章节 ${i}`,
  downloadState: 'unknown', bookmarks: [] }));
const place = new ReaderControlDirectoryPosition();
place.open('book:directory');
const ticket = place.ticket();
assert.equal(place.offset(project([], 'directory', '', true, 500), 128, 32, ticket), undefined);
const loaded = project(entries, 'directory', '', true, 500);
assert.equal(loaded.rows.length, 100);
assert.equal(loaded.currentTitle, '章节 50');
assert.equal(loaded.currentPosition, '51 / 100');
assert.equal(place.offset(loaded, 128, 32, ticket), 1552, 'late data fulfills initial centering');
place.commit(ticket);
assert.equal(place.offset(loaded, 518, 40, ticket), undefined, 'Full viewport does not reopen/recenter');
assert.equal(place.offset(project(entries.slice(0, 90), 'directory', '', true, 500), 128, 32, ticket), undefined);
place.open('book:bookmarks');
assert.equal(place.offset(loaded, 128, 32, ticket), undefined, 'old tab callback cannot win');
place.userScroll();
assert.equal(place.offset(loaded, 128, 32, place.ticket()), undefined, 'user input beats pending centering');
place.open('book:directory');
assert.equal(place.offset(loaded, 128, 32, place.ticket()), 1552, 'actual re-entry centers again');
assert.equal(project(entries, 'directory', '', false, 500).targetRow, 49);
assert.equal(project(entries, 'directory', '不存在', true, 500).rows.length, 0);
const copy = structuredClone(entries);
project(entries, 'bookmarks', '', true, 500);
assert.deepEqual(entries, copy, 'presentation cannot mutate Core data');
assert.equal(project(entries, 'bookmarks', '', true, 500).loading, false, 'known empty bookmarks is not loading');
assert.equal(project([{index: 0, title: '未加载', downloadState:'unknown'}], 'bookmarks', '', true, 0).loading, true);
const withBookmarks = structuredClone(entries);
for (const [ordinal, time] of [[48, 200], [52, 100]]) {
  withBookmarks[ordinal].bookmarks = [{ time, chapterIndex: ordinal * 10, chapterOffset: 0,
    chapterTitle: `章节 ${ordinal}`, content: '测试书签' }];
}
const nearest = project(withBookmarks, 'bookmarks', '', true, 500);
assert.equal(nearest.rows[nearest.targetRow].bookmark.chapterIndex, 480,
  'equal chapter-ordinal distance chooses the earlier chapter, not creation time');
assert.equal(project(withBookmarks, 'bookmarks', '章节 52', true, 500).targetRow, 0,
  'nearest positioning uses the visible filtered projection');
console.log('Production directory model: late load, centering ownership, route/data independence PASS');

const ui = readFileSync(new URL('../entry/src/main/ets/features/reading/ReaderControlDirectoryContent.ets', import.meta.url), 'utf8');
const methods = ['captureLeadingRow', 'onProgressChanged', 'queueLeadingCorrection', 'onInputChanged', 'rowHeight', 'value', 'userScroll',
  'queuePosition', 'listHeight', 'listTop', 'openList', 'refreshData', 'leadingAnchorIsAligned'].map(name => {
  const start=ui.indexOf('  private '+name+'('); assert.ok(start>=0);
  const open=ui.indexOf('{',start); let depth=1,end=open+1;
  while(depth){if(ui[end]==='{')depth++;if(ui[end]==='}')depth--;end++;}
  return ui.slice(start,end);
});
const frames=[];
const AnchorOwner = new Function('ControlDirectoryFrame','LengthMetrics','ScrollAlign','readerControlDirectorySnapshot',
  stripTypeScriptTypes('class Owner { '+methods.join('\n')+' }')+'; return Owner;')(
  class { constructor(action){this.action=action;} }, {vp:value=>({value})}, {START:'START',CENTER:'CENTER'}, project);
const commands=[];
const owner=Object.assign(new AnchorOwner(), {mounted:true,lifecycle:1,correctionQueued:false,
  progress:1,previousRowHeight:40,interactionEnabled:false,availableWidth:338,tab:'directory',
  snapshot:{rows:Array.from({length:150},(_,i)=>({key:'chapter-'+i}))},
  getUIContext:()=>({postFrameCallback:frame=>frames.push(frame),vp2px:value=>value*3}),
  placement:{userScroll(){}},
  scroller:{currentOffset(){throw Error('estimated absolute offset is not a semantic anchor');},
    getItemIndex:()=>61,getItemRect:()=>({y:-8,height:40}),
    scrollToIndex:(...args)=>commands.push(args)} });
owner.onInputChanged();assert.equal(owner.leadingRow,61.2);assert.equal(owner.leadingKey,'chapter-61');
for(const p of [.9,.6,.2,0]) {owner.progress=p;owner.onProgressChanged();}
assert.equal(frames.length,1,'many progress updates schedule at most one correction per frame');
frames.shift().action();assert.deepEqual(commands.pop(),[61,false,'START',{extraOffset:{value:6.4}}],
  'deep virtual row identity and in-row fraction survive Full to Quick without estimated total offset');
owner.scroller.getItemIndex=()=>40;owner.onInputChanged();assert.equal(owner.leadingRow,61.2,
  'late input-disabled notification must not recapture a different row during the same morph');
owner.progress=.5;owner.onProgressChanged();owner.userScroll();frames.shift().action();
assert.equal(commands.length,0,'new user scrolling invalidates pending correction');
owner.scroller.getItemRect=()=>({y:0,height:0});owner.captureLeadingRow();
assert.equal(owner.leadingRow,undefined,'unmeasured item cannot create a zero anchor');
owner.placement=new ReaderControlDirectoryPosition();owner.placement.open('initial');
owner.availableHeight=666;owner.snapshot.targetRow=61;owner.snapshot.loading=false;
owner.queuePosition();frames.shift().action();
assert.deepEqual(commands.pop(),[61,false,'CENTER'],
  'initial centering also targets the real item instead of multiplying estimated offscreen heights');
console.log('Production Directory virtual-row capture, fraction, frame coalescing and late-user-input guards PASS');

// Exercise the production opening/data/frame chain, not just the ticket model.
const residualFailures=[];
function residual(name, action){try{action();}catch(error){residualFailures.push(`${name}: ${error.message}`);}}
function pendingList(){
  const queue=[],scrolls=[];
  const list=Object.assign(new AnchorOwner(),{mounted:true,lifecycle:1,positionQueued:false,
    correctionQueued:false,placement:new ReaderControlDirectoryPosition(),sessionKey:'pending',tab:'directory',
    entries:withBookmarks,query:'',ascending:true,currentChapterIndex:500,progress:1,
    interactionEnabled:true,availableWidth:338,availableHeight:666,dataSource:{replace(){}},
    getUIContext:()=>({postFrameCallback:frame=>queue.push(frame),vp2px:x=>x*3}),
    scroller:{scrollToIndex:(...args)=>scrolls.push(args),getItemRect:()=>({y:-8,height:74})}});
  return {list,queue,scrolls};
}
residual('a new tab owns its queued centering',()=>{
  const {list,queue,scrolls}=pendingList();list.openList();list.tab='bookmarks';list.openList();
  while(queue.length)queue.shift().action();
  assert.deepEqual(scrolls,[[0,false,'CENTER']]);
});
residual('aligned endpoint release discards both parts of the anchor',()=>{
  const {list,queue}=pendingList();list.openList();while(queue.length)queue.shift().action();
  list.leadingRow=48.2;list.leadingFraction=.2;list.leadingKey=list.snapshot.rows[48].key;
  list.scroller.getItemRect=()=>({y:-8,height:40});
  list.onInputChanged();list.refreshData();assert.equal(list.leadingRow,undefined);
  assert.equal(list.leadingKey,undefined);
});
residual('a newer positioning callback survives the old callback',()=>{
  const {list,queue,scrolls}=pendingList();list.openList();list.tab='bookmarks';list.openList();
  queue.shift().action();list.refreshData();while(queue.length)queue.shift().action();
  assert.deepEqual(scrolls,[[0,false,'CENTER']]);
});
residual('scroll cancels a replacement tab placement',()=>{
  const {list,queue,scrolls}=pendingList();list.openList();list.tab='bookmarks';list.openList();list.userScroll();
  while(queue.length)queue.shift().action();assert.deepEqual(scrolls,[]);
});
assert.deepEqual(residualFailures,[]);
console.log('Production Directory rapid tab replacement, endpoint anchor release and user-scroll ownership PASS');

// Real production methods with a finite List that applies native tail clamps.
// VM: 150 chapters, Quick content 190vp and Full content 2101px / 3.5;
// expansion legitimately reveals earlier rows, but an untouched round trip
// must not replace the requested semantic row with that temporary clamp.
function boundedNativeList(tab = 'directory') {
  const queue = [], calls = [];
  let nativeOffset = 0;
  const list = Object.assign(new AnchorOwner(), {
    mounted: true, lifecycle: 1, correctionQueued: false,
    progress: 0, previousRowHeight: tab === 'directory' ? 32 : 54,
    interactionEnabled: true, availableWidth: 286, availableHeight: 190, tab,
    snapshot: { rows: Array.from({ length: 150 }, (_, i) => ({ key: `chapter-${i}` })) },
    placement: { userScroll() {} },
    getUIContext: () => ({ postFrameCallback: frame => queue.push(frame), vp2px: x => x * 3.5 }),
  });
  const limit = () => Math.max(0, list.snapshot.rows.length * list.rowHeight() - list.listHeight());
  const clamp = value => Math.max(0, Math.min(value, limit()));
  list.scroller = {
    getItemIndex: (_x, y) => Math.floor((nativeOffset + y) / list.rowHeight()),
    getItemRect: index => ({ y: index * list.rowHeight() - nativeOffset, height: list.rowHeight() }),
    scrollToIndex(index, _animated, align, options) {
      assert.equal(align, 'START');
      const requested = index * list.rowHeight() + options.extraOffset.value;
      nativeOffset = clamp(requested); calls.push({ requested, nativeOffset, progress: list.progress });
    },
  };
  const flush = () => { while (queue.length) queue.shift().action(); };
  const setProgress = p => {
    list.progress = p; list.availableHeight = 190 + (2101 / 3.5 - 190) * p;
    nativeOffset = clamp(nativeOffset); list.onProgressChanged(); flush();
  };
  const settle = () => { list.interactionEnabled = true; list.onInputChanged(); flush(); };
  const begin = () => { list.interactionEnabled = false; list.onInputChanged(); };
  return { list, calls, flush, setProgress, settle, begin, limit,
    getOffset: () => nativeOffset, setOffset: value => { nativeOffset = clamp(value); } };
}
for (const tab of ['directory', 'bookmarks']) {
  const native = boundedNativeList(tab);
  native.setOffset(native.limit());
  const originalQuick = native.getOffset();
  native.begin(); for (const p of [.2, .6, 1]) native.setProgress(p); native.settle();
  assert.equal(native.getOffset(), native.limit(), `${tab}: Full tail clamp remains legal`);
  native.begin(); for (const p of [.8, .4, 0]) native.setProgress(p); native.settle();
  assert.ok(Math.abs(native.getOffset() - originalQuick) <= .5 / 3.5,
    `${tab}: untouched Quick→Full→Quick restores ${originalQuick}, got ${native.getOffset()}`);
  assert.equal(native.list.leadingRow, undefined, `${tab}: aligned Quick releases retained intent`);
  assert.equal(native.list.leadingKey, undefined);

  native.begin(); for (const p of [.4, 1]) native.setProgress(p); native.settle();
  native.list.userScroll();
  native.setOffset(40.25 * native.list.rowHeight());
  native.begin(); for (const p of [.6, .2, 0]) native.setProgress(p); native.settle();
  assert.ok(Math.abs(native.getOffset() - 40.25 * native.list.rowHeight()) <= .5 / 3.5,
    `${tab}: user scrolling in Full replaces the earlier clamped intent`);
}
for (const fraction of [0, .25, .8]) {
  const native = boundedNativeList();
  native.setOffset((61 + fraction) * native.list.rowHeight());
  const originalQuick = native.getOffset();
  native.begin(); for (const p of [.3, .7, 1]) native.setProgress(p); native.settle();
  assert.equal(native.list.leadingRow, undefined, 'a reachable Full anchor is released normally');
  native.begin(); for (const p of [.5, 0]) native.setProgress(p); native.settle();
  assert.ok(Math.abs(native.getOffset() - originalQuick) <= .5 / 3.5,
    'interior row and fraction remain stable without tail clamping');
}
{
  const native = boundedNativeList(); native.setOffset(native.limit());
  const originalQuick = native.getOffset();
  native.begin(); for (const p of [.4, .8, .2, 0]) native.setProgress(p); native.settle();
  assert.ok(Math.abs(native.getOffset() - originalQuick) <= .5 / 3.5,
    'reversal before Full settles still restores the original trailing Quick anchor');
}
console.log('Production Directory finite-tail Quick→Full→Quick semantic anchor restoration PASS');
