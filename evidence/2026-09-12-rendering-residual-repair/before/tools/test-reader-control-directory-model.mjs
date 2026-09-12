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
  'queuePosition', 'listHeight', 'listTop'].map(name => {
  const start=ui.indexOf('  private '+name+'('); assert.ok(start>=0);
  const open=ui.indexOf('{',start); let depth=1,end=open+1;
  while(depth){if(ui[end]==='{')depth++;if(ui[end]==='}')depth--;end++;}
  return ui.slice(start,end);
});
const frames=[];
const AnchorOwner = new Function('ControlDirectoryFrame','LengthMetrics','ScrollAlign',
  stripTypeScriptTypes('class Owner { '+methods.join('\n')+' }')+'; return Owner;')(
  class { constructor(action){this.action=action;} }, {vp:value=>({value})}, {START:'START',CENTER:'CENTER'});
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
