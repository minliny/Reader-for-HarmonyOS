import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {selectContractCases,recordContractCasePass} from './lib/contract-case-selection.mjs';

const selected=selectContractCases({
 'route-anchor-capture':{description:'Actual save/restore/lifecycle, captured zero versus unsaved top, signed/identity anchors and scoped reset wiring',resources:[]},
 'header-scroller-identity':{description:'Existing SDK MainTabShell/header measurement and retained List/Scroller/item identities; separate from captured-offset repair',resources:[]},
});
for(const id of selected){
 await runSelectedCase(id);
 recordContractCasePass(id);
}

async function runSelectedCase(selectedCase){
const [
 {createReaderBuilderProbe}, metricsApi,
 {readerFloatingTabContentInset}, {productionMotionMethods}, {readerRecoveryView},
 {BookshelfViewState}, headerMetrics, {pureModuleProbe}, {readerFoundationTokens},
]=await Promise.all([
 import('./lib/reader-control-builder-probe.mjs'),
 import('../entry/src/main/ets/features/common/ReaderWindowMetrics.ts'),
 import('./lib/reader-floating-bar-metrics-probe.mjs'),
 import('./lib/reader-motion-method-probe.mjs'),
 import('../entry/src/main/ets/app/ReaderRecoveryProjection.ts'),
 import('../entry/src/main/ets/features/bookshelf/BookshelfViewState.ts'),
 import('../entry/src/main/ets/features/common/ReaderHeaderMetrics.ts'),
 import('./lib/ets-pure-module-probe.mjs'),
 import('./lib/reader-foundation-control-probe.mjs'),
]);
const source=new URL('../entry/src/main/ets/features/bookshelf/BookshelfPage.ets',import.meta.url);
const common=name=>readFileSync(new URL(`../entry/src/main/ets/features/common/${name}`,import.meta.url),'utf8');
const headerSpecs=pureModuleProbe(common('ReaderHeaderSpecs.ets'),'ViewportReturnHeaderSpecs.ets',
 {...headerMetrics,TOK_BORDER_W:readerFoundationTokens.TOK_BORDER_W},['bookshelfHeaderSpec']);
class Frame { constructor(callback){this.callback=callback;} }
const Page=productionMotionMethods(source,['shelfHeaderItems','saveShelfViewport','restoreShelfViewport','publishVisibleReadingBooks','aboutToDisappear','aboutToAppear','viewModeRecovery','publishHeaderScrolled','onScrollToTopRequested'],{
 ...headerSpecs,readerRecoveryView, BookshelfMotionFrameCallback:Frame, ScrollAlign:{START:'start'}, Edge:{Top:'top'}, registerReaderShelfFonts(){}
});
const state=new BookshelfViewState(); const frames=[]; const calls=[]; const prepared=[];const materials=[];
const books=[{sourceId:'source',bookId:'first',group:'历史分组'},{sourceId:'another',bookId:'same',group:'默认'}].map(Object.freeze);
let rows=[books]; let offset=345;let itemY=-25;
function page(){ return Object.assign(new Page(), {
 viewState:state,mounted:true,viewportRestored:true,viewportRestoreGeneration:0,firstVisibleItem:2,
 navigationGeneration:1,headerScrollPublishedNavigation:-1,headerScrolled:false,headerScrollFrameQueued:'',
 continueReading:{},filterRowVisible:true,viewModeError:'',viewModeRevision:0,
 webDavCredentials:{currentBookshelfViewMode:()=>undefined},
 viewModeHost:{current:()=>({canonical:undefined})},viewModeSnapshot:{canonical:undefined},
 storedViewMode:'list',storedSelectedGroup:'默认',readingFilter:'reading',sourceFilter:'online',books,
 shelfScroller:{currentOffset:()=>({yOffset:offset}),getItemRect:()=>({y:itemY}),
  scrollTo:args=>calls.push(['offset',args.yOffset]),scrollEdge:edge=>calls.push(['edge',edge]),
  scrollToIndex:index=>{calls.push(['index',index]);itemY=0;},scrollBy:(_x,y)=>calls.push(['by',y])},
 rowDataSource:{totalCount:()=>rows.length,getData:index=>rows[index]},
 getUIContext:()=>({postFrameCallback:frame=>frames.push(frame.callback),getFont:()=>({})}),
 resetViewSwitchMotion(){},setRestingProjectionOpacity(){},rebuildShelfProjection(){},loadViewMode(){},
 transientFeedback:{reset(){}},publishContinueCardRect(){},scheduleContinueCardMeasurement(){},scheduleReturnMotionOrigin(){},
 actionSheetChromeId:'',shelfContentStartInset:()=>80,onHeaderScrolledChanged:scrolled=>materials.push(scrolled),
 onVisibleBooksChanged:books=>prepared.push(books),
});}
function routeAnchorCapture(){
assert.equal(state.anchorCaptured,false,'a new route state has no native viewport sample');
const first=page(); first.saveShelfViewport();first.aboutToDisappear();
assert.equal(state.anchorKey,JSON.stringify(['source','first'])); assert.equal(state.anchorItemY,-25);
assert.equal(state.filterExpanded,true);assert.equal(state.anchorOffset,345);
assert.equal(state.anchorCaptured,true,'only a complete native sample admits a stored viewport');
const returned=page();returned.filterRowVisible=false;returned.aboutToAppear();
assert.equal(returned.viewMode,'list');assert.equal(returned.filterRowVisible,true);
assert.equal(returned.storedSelectedGroup,'','removed group entry cannot leave books hidden by an unreachable filter');
assert.equal(returned.readingFilter,'reading');assert.equal(returned.sourceFilter,'online');
assert.deepEqual(books.map(book=>book.group),['历史分组','默认'],'clearing transient selection must preserve Core book groups');
// Added books before the saved identity must not turn the restore into a raw offset.
rows=[[{sourceId:'new',bookId:'first'}],books];returned.restoreShelfViewport();frames.shift()();
const restoredNativeIndex=returned.shelfHeaderItems()+1;
assert.deepEqual(calls,[['index',restoredNativeIndex]]);returned.saveShelfViewport();assert.equal(state.anchorItemY,-25);
frames.shift()();assert.deepEqual(calls,[['index',restoredNativeIndex],['by',25]]);assert.equal(returned.viewportRestored,true);
// Late layout callbacks after leaving cannot mutate the next route's viewport.
calls.length=0;returned.restoreShelfViewport();returned.aboutToDisappear();frames.shift()();assert.deepEqual(calls,[]);
const missing=page();rows=[];missing.restoreShelfViewport();frames.shift()();assert.deepEqual(calls,[['offset',345]]);
for (const saved of [0, -30, -66]) {
 calls.length=0;state.anchorKey='';state.anchorOffset=saved;state.anchorCaptured=false;
 const fresh=page();fresh.restoreShelfViewport();frames.shift()();
 assert.deepEqual(calls,saved === 0 ? [['edge','top']] : [['offset',saved]],
  'fresh top uses the native edge; saved signed positions retain full or partial header clearance');
 assert.equal(fresh.viewportRestored,true);
}
// Zero is a real native offset after scrolling through the start clearance.
// It must remain distinct from a new state whose untouched numeric default is 0.
{
 calls.length=0;offset=0;itemY=0;rows=[];
 const captured=page();captured.firstVisibleItem=0;captured.saveShelfViewport();
 assert.equal(state.anchorKey,'');assert.equal(state.anchorOffset,0);assert.equal(state.anchorCaptured,true);
 captured.restoreShelfViewport();frames.shift()();
 assert.deepEqual(calls,[['offset',0]],'a captured zero offset restores with scrollTo(0), without jumping to the top edge');
 assert.equal(materials.at(-1),true,'captured zero is already past the raised-header scroll threshold');
 calls.length=0;const unsaved=page();unsaved.viewState=new BookshelfViewState();unsaved.restoreShelfViewport();frames.shift()();
 assert.deepEqual(calls,[['edge','top']],'a genuinely unsaved state retains the native initial start clearance');
 assert.equal(materials.at(-1),false);
 const snapshot={...state};offset=Number.NaN;itemY=30;captured.saveShelfViewport();assert.deepEqual({...state},snapshot);
 offset=48;itemY=Number.NaN;captured.saveShelfViewport();assert.deepEqual({...state},snapshot,'an incomplete native sample cannot partly overwrite an admitted viewport');
 offset=345;itemY=-25;
 captured.scrollToTopToken=1;calls.length=0;captured.onScrollToTopRequested();
 assert.equal(state.anchorCaptured,false,'explicit top requests revoke the old captured position');
 assert.deepEqual(calls,[['edge','top']]);
}
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
assert.match(index,/BookshelfPage\(\{[\s\S]*?noticeTopInset: this\.shelfPendingNoticeHeight > 0 \? this\.shelfPendingNoticeHeight \+ 8 : 0,[\s\S]*?headerBottom: this\.shelfHeaderHeight,[\s\S]*?navigationGeneration: this\.navigationGeneration,\s*viewState: this\.bookshelfViewState/);
assert.match(index,/this\.bookshelfViewState\.anchorKey = ''; this\.bookshelfViewState\.anchorOffset = 0;\s*this\.bookshelfViewState\.anchorCaptured = false/,
 'a changed shelf filter revokes the captured viewport rather than restoring numeric zero as a saved scroll');
assert.match(index,/private pendingShelfReadbackKey: string = ''/,
  'detail shelf admission retains a confirmed identity until the bookshelf route readback');
assert.match(index,/this\.getUIContext\(\)\.postFrameCallback\(new ReaderNavigationBackfillFrame/,
  'bookshelf return schedules a fresh read after the route binding is mounted');
assert.match(index,/this\.invalidateBookshelfProjection\(\);\s*this\.refreshBookshelf\(\);\s*this\.pendingShelfReadbackKey = ''/,
  'the post-frame shelf readback invalidates the stale detail projection before clearing the pending identity');
console.log('PASS bookshelf route return: complete native samples, captured zero, new-state top, signed/identity anchors, late callback isolation');
}

// The actual shelf uses a scaffold with its header disabled. LibrarySearch owns
// the public fixed header and publishes its measured bottom to the shelf route.
async function headerScrollerIdentity(){
 const {pageFrameSdkFixture}=await import('./lib/reader-page-frame-sdk-fixture.mjs');
 const {selectedProductionMethods}=await import('./lib/selected-production-methods.mjs');
 const sdk=pageFrameSdkFixture(),text=readFileSync(source,'utf8');
 const section=readFileSync(new URL('./BookshelfSectionHeader.ets',source),'utf8');
 class SectionPort {
  constructor(owner,params,_storage,id){Object.assign(this,{owner,params,id});}
  initialRender(){}
  updateStateVars(next){Object.assign(this.params,next);}
 }
 const metrics=metricsApi.createDefaultReaderWindowMetrics();
 metrics.windowRect.width=390;
 metrics.windowRect.height=844;
 const headerSpec=headerSpecs.bookshelfHeaderSpec();
 const deps={...sdk.deps,...metricsApi,...headerSpecs,ReaderWindowCoordinator:{metrics:()=>metrics},
  BookshelfSectionHeader:SectionPort,LazyForEach:{create(){},pop(){}},
  ViewStackProcessor:{StartGetAccessRecordingFor(){},StopGetAccessRecording(){}}
 };
 const {owner:listOwner}=createReaderBuilderProbe(text,['bookshelfList','shelfPageHandler','shelfScrollHandler',
  'isShelfPresentationCurrent','shelfFirstItemPadding','shelfViewportMotionId','scrollLayout','pageGeometry',
  'contentGeometry','shelfViewportScrollHandler'],deps,
  {...sdk.hooks,childSources:{...sdk.hooks.childSources,BookshelfSectionHeader:section}});
 const returned=page(),scroller=returned.shelfScroller;
 Object.assign(listOwner,{appThemeScheme:'day',readerWindowMetricsRevision:0,mounted:true,navigationGeneration:1,
  shelfScroller:scroller,continueReading:undefined,filterRowVisible:false,viewModeError:'',visibleBookCount:1,
  headerBottom:headerSpec.frameHeight,viewMode:'list',viewSwitchHeaderOpacity:1,hasActiveFilters:()=>false,
  filterPanel(){},effectiveViewportWidth:()=>390,shelfContentEndValue:()=>0,shelfContentWidth:()=>352,
  rowDataSource:{totalCount:()=>0},isWideViewport:()=>false,
  saveShelfViewport:returned.saveShelfViewport.bind(returned),restoreShelfViewport:returned.restoreShelfViewport.bind(returned)});
 const style=sdk.deps.readerFrameStyle({backgroundColor:'#FFFAF8F4',headerBackground:'#FFFAF8F4',footerBackground:'#FFFAF8F4'});
 const frame=sdk.create('ReaderPageScaffold',{frameStyle:style,geometry:listOwner.pageGeometry(),
  headerVisible:false,content:()=>listOwner.bookshelfList(false)});
 frame.initialRender();
 const list=sdk.nodes(listOwner).find(node=>node.type==='List'),items=sdk.nodes(listOwner).filter(node=>node.type==='ListItem');
 assert.equal(items.length,1,'header remains outside the List and does not add an index-shifting item');
 assert.equal(typeof items[0].create?.[0],'function','the SDK gives native List the actual lazy item body');
 items[0].create[0](items[0].id,true);
 const firstContent=sdk.nodes(listOwner).find(node=>node.type==='Column'&&node.padding?.top===headerSpec.contentGap+headerSpec.contentUnderlap);
 assert.ok(firstContent,'the first item compensates for the approved header underlap');
 assert.equal(list.create.scroller,scroller,'actual shelf retains its viewport Scroller');
 assert.equal(list.contentStartOffset,headerSpec.frameHeight-headerSpec.contentUnderlap);
 assert.equal(list.contentStartOffset+firstContent.padding.top,headerSpec.contentClearance);
 assert.equal(list.maintainVisibleContentPosition,true);
 assert.ok(sdk.nodes(frame).some(node=>node.type==='Stack'&&node.backgroundColor),'actual Scaffold paints the page root');
 const surfaceFile=new URL('../entry/src/main/ets/features/search/ReaderLibrarySearchSurface.ets',import.meta.url);
 const SearchHeader=selectedProductionMethods(surfaceFile,'ReaderLibrarySearchSurface',['captureHeader'],{
  readerPresentedHeaderBottom:sdk.deps.readerPresentedHeaderBottom,bookshelfHeaderSpec:headerSpecs.bookshelfHeaderSpec,
 });
 const accepted=[];
 const search=Object.assign(new SearchHeader(),{mounted:true,measurementKey:7,identity:11,navigationGeneration:1,mounting:3,
  headerBottom:headerSpec.frameHeight,onHeaderBottom(bottom,...identity){
   accepted.push([bottom,...identity]);listOwner.headerBottom=bottom;listOwner.replay();
  }});
 const header=sdk.create('ReaderFixedHeaderHost',{style:new sdk.deps.ReaderHeaderFrameStyle(true,''),measurementKey:7,
  onHeightChange:(height,key)=>search.captureHeader(height,key)});
 header.initialRender();
 const measured=sdk.nodes(header).find(node=>node.type==='Column'&&node.onAreaChange);
 assert.ok(measured,'the public fixed header publishes a native measurement');
 const oldMeasurement=measured.onAreaChange;
 oldMeasurement({}, {height:'96vp'});
 const bottom=96+headerSpec.topInset;
 assert.deepEqual(accepted,[[bottom,11,7,1,3]],'actual search surface publishes the measured bottom with the shelf identity');
 assert.equal(list.contentStartOffset,bottom-headerSpec.contentUnderlap);
 assert.equal(list.contentStartOffset+firstContent.padding.top,bottom+headerSpec.contentGap,'actual measured header and content gap reach the same List');
 assert.equal(sdk.nodes(listOwner).find(node=>node.type==='List'),list,'changed header clearance keeps the native List actor');
 assert.equal(list.create.scroller,scroller);assert.deepEqual(sdk.nodes(listOwner).filter(node=>node.type==='ListItem'),items);
 search.measurementKey=8;
 oldMeasurement({}, {height:'300vp'});
 assert.equal(accepted.length,1,'a retired header measurement cannot change the list');
 assert.equal(list.contentStartOffset,bottom-headerSpec.contentUnderlap);
}

if(selectedCase==='route-anchor-capture')routeAnchorCapture();
else await headerScrollerIdentity();
}
