import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {productionMotionMethods} from './lib/reader-motion-method-probe.mjs';
import {BookshelfViewState} from '../entry/src/main/ets/features/bookshelf/BookshelfViewState.ts';
const source=new URL('../entry/src/main/ets/features/bookshelf/BookshelfPage.ets',import.meta.url);
class Frame { constructor(callback){this.callback=callback;} }
const Page=productionMotionMethods(source,['shelfHeaderItems','saveShelfViewport','restoreShelfViewport','publishVisibleReadingBooks','aboutToDisappear','aboutToAppear'],{
 BookshelfMotionFrameCallback:Frame, ScrollAlign:{START:'start'}, registerReaderShelfFonts(){}
});
const state=new BookshelfViewState(); const frames=[]; const calls=[]; const prepared=[];
const books=[{sourceId:'source',bookId:'first',group:'历史分组'},{sourceId:'another',bookId:'same',group:'默认'}].map(Object.freeze);
let rows=[books]; let offset=345;let itemY=-25;
function page(){ return Object.assign(new Page(), {
 viewState:state,mounted:true,viewportRestored:true,viewportRestoreGeneration:0,firstVisibleItem:3,
 continueReading:{},filterRowVisible:true,viewModeError:'',viewModeRevision:0,
 webDavCredentials:{currentBookshelfViewMode:()=>undefined},
 storedViewMode:'list',storedSelectedGroup:'默认',readingFilter:'reading',sourceFilter:'online',books,
 shelfScroller:{currentOffset:()=>({yOffset:offset}),getItemRect:()=>({y:itemY}),
  scrollTo:args=>calls.push(['offset',args.yOffset]),scrollToIndex:index=>{calls.push(['index',index]);itemY=0;},scrollBy:(_x,y)=>calls.push(['by',y])},
 rowDataSource:{totalCount:()=>rows.length,getData:index=>rows[index]},
 getUIContext:()=>({postFrameCallback:frame=>frames.push(frame.callback),getFont:()=>({})}),
 resetViewSwitchMotion(){},setRestingProjectionOpacity(){},rebuildShelfProjection(){},loadViewMode(){},
 onVisibleBooksChanged:books=>prepared.push(books),
});}
const first=page(); first.saveShelfViewport();first.aboutToDisappear();
assert.equal(state.anchorKey,JSON.stringify(['source','first'])); assert.equal(state.anchorItemY,-25);
assert.equal(state.filterExpanded,true);assert.equal(state.anchorOffset,345);
const returned=page();returned.filterRowVisible=false;returned.aboutToAppear();
assert.equal(returned.viewMode,'list');assert.equal(returned.filterRowVisible,true);
assert.equal(returned.storedSelectedGroup,'','removed group entry cannot leave books hidden by an unreachable filter');
assert.equal(returned.readingFilter,'reading');assert.equal(returned.sourceFilter,'online');
assert.deepEqual(books.map(book=>book.group),['历史分组','默认'],'clearing transient selection must preserve Core book groups');
// Added books before the saved identity must not turn the restore into a raw offset.
rows=[[{sourceId:'new',bookId:'first'}],books];returned.restoreShelfViewport();frames.shift()();
assert.deepEqual(calls,[['index',4]]);returned.saveShelfViewport();assert.equal(state.anchorItemY,-25);
frames.shift()();assert.deepEqual(calls,[['index',4],['by',25]]);assert.equal(returned.viewportRestored,true);
// Late layout callbacks after leaving cannot mutate the next route's viewport.
calls.length=0;returned.restoreShelfViewport();returned.aboutToDisappear();frames.shift()();assert.deepEqual(calls,[]);
const missing=page();rows=[];missing.restoreShelfViewport();frames.shift()();assert.deepEqual(calls,[['offset',345]]);
// Preparation follows the restored visible identity and never guesses at the
// top of the shelf while the saved viewport is still being applied.
{
 const p=page();p.viewportRestored=false;p.continueReading=undefined;
 rows=Array.from({length:8},(_,i)=>Array.from({length:3},(_,j)=>({sourceId:'local',bookId:`${i}:${j}`})));
 prepared.length=0;p.publishVisibleReadingBooks();assert.equal(prepared.length,0);
 p.viewportRestored=true;p.firstVisibleItem=p.shelfHeaderItems()+4;p.publishVisibleReadingBooks();
 assert.deepEqual(prepared[0].map(b=>b.bookId),['4:0','4:1','4:2','5:0','5:1','5:2']);
 p.mounted=false;p.publishVisibleReadingBooks();assert.equal(prepared.length,1);
}
const text=readFileSync(source,'utf8');assert.match(text,/List\(\{ space: TOK_SPACE_CONTROL_INLINE, scroller: this\.shelfScroller \}\)/);
assert.match(text,/maintainVisibleContentPosition\(true\)/);assert.match(text,/onAppear\(\(\): void => this\.restoreShelfViewport\(\)\)/);
const index=readFileSync(new URL('../entry/src/main/ets/pages/Index.ets',import.meta.url),'utf8');
assert.match(index,/private readonly bookshelfViewState: BookshelfViewState = new BookshelfViewState/);
assert.match(index,/BookshelfPage\(\{\s*viewState: this\.bookshelfViewState/);
console.log('PASS bookshelf route return: identity+item offset, list/state/type filters, removed group-filter migration, reordered books, late callback isolation');
