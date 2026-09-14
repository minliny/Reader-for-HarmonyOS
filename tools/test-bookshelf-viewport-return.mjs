import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {productionMotionMethods} from './lib/reader-motion-method-probe.mjs';
import {BookshelfViewState} from '../entry/src/main/ets/features/bookshelf/BookshelfViewState.ts';
const source=new URL('../entry/src/main/ets/features/bookshelf/BookshelfPage.ets',import.meta.url);
class Frame { constructor(callback){this.callback=callback;} }
const Page=productionMotionMethods(source,['shelfHeaderItems','saveShelfViewport','restoreShelfViewport','aboutToDisappear','aboutToAppear'],{
 BookshelfMotionFrameCallback:Frame, ScrollAlign:{START:'start'}, registerReaderFonts(){}
});
const state=new BookshelfViewState(); const frames=[]; const calls=[];
const books=[{sourceId:'source',bookId:'first'},{sourceId:'another',bookId:'same'}];
let rows=[books]; let offset=345;let itemY=-25;
function page(){ return Object.assign(new Page(), {
 viewState:state,mounted:true,viewportRestored:true,viewportRestoreGeneration:0,firstVisibleItem:3,
 continueReading:{},filterRowVisible:true,groupSelectorVisible:false,viewModeError:'',viewModeRevision:0,
 storedViewMode:'list',storedSelectedGroup:'默认',
 shelfScroller:{currentOffset:()=>({yOffset:offset}),getItemRect:()=>({y:itemY}),
  scrollTo:args=>calls.push(['offset',args.yOffset]),scrollToIndex:index=>{calls.push(['index',index]);itemY=0;},scrollBy:(_x,y)=>calls.push(['by',y])},
 rowDataSource:{totalCount:()=>rows.length,getData:index=>rows[index]},
 getUIContext:()=>({postFrameCallback:frame=>frames.push(frame.callback),getFont:()=>({})}),
 resetViewSwitchMotion(){},setRestingProjectionOpacity(){},rebuildShelfProjection(){},loadViewMode(){},
});}
const first=page(); first.saveShelfViewport();first.aboutToDisappear();
assert.equal(state.anchorKey,JSON.stringify(['source','first'])); assert.equal(state.anchorItemY,-25);
assert.equal(state.filterExpanded,true);assert.equal(state.groupExpanded,false);assert.equal(state.anchorOffset,345);
const returned=page();returned.filterRowVisible=false;returned.groupSelectorVisible=false;returned.aboutToAppear();
assert.equal(returned.viewMode,'list');assert.equal(returned.selectedGroup,'默认');assert.equal(returned.filterRowVisible,true);assert.equal(returned.groupSelectorVisible,false);
// Added books before the saved identity must not turn the restore into a raw offset.
rows=[[{sourceId:'new',bookId:'first'}],books];returned.restoreShelfViewport();frames.shift()();
assert.deepEqual(calls,[['index',4]]);returned.saveShelfViewport();assert.equal(state.anchorItemY,-25);
frames.shift()();assert.deepEqual(calls,[['index',4],['by',25]]);assert.equal(returned.viewportRestored,true);
// Late layout callbacks after leaving cannot mutate the next route's viewport.
calls.length=0;returned.restoreShelfViewport();returned.aboutToDisappear();frames.shift()();assert.deepEqual(calls,[]);
const missing=page();rows=[];missing.restoreShelfViewport();frames.shift()();assert.deepEqual(calls,[['offset',345]]);
const text=readFileSync(source,'utf8');assert.match(text,/List\(\{ space: TOK_SPACE_CONTROL_INLINE, scroller: this\.shelfScroller \}\)/);
assert.match(text,/maintainVisibleContentPosition\(true\)/);assert.match(text,/onAppear\(\(\): void => this\.restoreShelfViewport\(\)\)/);
const index=readFileSync(new URL('../entry/src/main/ets/pages/Index.ets',import.meta.url),'utf8');
assert.match(index,/private readonly bookshelfViewState: BookshelfViewState = new BookshelfViewState/);
assert.match(index,/BookshelfPage\(\{\s*viewState: this\.bookshelfViewState/);
console.log('PASS bookshelf route return: identity+item offset, list/filter/group state, reordered books, late callback isolation');
