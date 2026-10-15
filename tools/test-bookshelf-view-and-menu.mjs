import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { createReaderBuilderProbe } from './lib/reader-control-builder-probe.mjs';
import { ShelfBookPresentation } from '../entry/src/main/ets/features/bookshelf/ShelfBookPresentation.ts';
import { loadReaderTypographyRoles } from './lib/reader-typography-probe.mjs';
import { boundedSurfaceSdk, boundedMembers } from './lib/bounded-surface-sdk-probe.mjs';
import * as metricsApi from '../entry/src/main/ets/features/common/ReaderWindowMetrics.ts';
import { readerFloatingTabContentInset } from './lib/reader-floating-bar-metrics-probe.mjs';
import { SOURCE_SWITCH_VISUAL } from '../entry/src/main/ets/features/source/SourceSwitchVisual.ts';
import './test-surface-repair.mjs';
const read=f=>readFileSync(new URL(`../entry/src/main/ets/${f}`,import.meta.url),'utf8');
const shelf=read('features/bookshelf/BookshelfPage.ets');
const batch=read('features/bookshelf/BookshelfMultiSelectPage.ets');
const list=read('features/bookshelf/ShelfBookListDetails.ets');
const menu=read('features/bookshelf/BookshelfMoreMenu.ets');
const popupSpecs=read('features/common/ReaderSurfaceSpecs.ets');
const { resolveSheetSpec } = new Function('TextAlign', 'SOURCE_SWITCH_VISUAL', stripTypeScriptTypes(popupSpecs)
  .replace(/^import[^;]+;\s*/gm,'').replace(/^export /gm,'') + '; return { resolveSheetSpec };')({ Start: 'TextAlign.Start', Center: 'TextAlign.Center' }, SOURCE_SWITCH_VISUAL);
const bookActionSpec=resolveSheetSpec('bookshelf-book-action');
const action=read('features/bookshelf/BookshelfBookActionSheet.ets');
const actionRows=read('features/common/ReaderSheetActionList.ets');
const boundedFrame=read('features/common/ReaderBoundedSurface.ets');
const dialog=read('features/bookshelf/LocalImportDialog.ets');
const index=read('pages/Index.ets');
const typographySource=readFileSync(new URL('../entry/src/main/ets/features/common/ReaderTypography.ets',import.meta.url),'utf8');
const { TYPE_SHELF_LIST_TITLE, TYPE_SHELF_LIST_AUTHOR, TYPE_SHELF_LIST_CHAPTER, TYPE_SHELF_LIST_STATUS } =
  loadReaderTypographyRoles(typographySource);
const typographyRoles = { TYPE_SHELF_LIST_TITLE, TYPE_SHELF_LIST_AUTHOR, TYPE_SHELF_LIST_CHAPTER, TYPE_SHELF_LIST_STATUS };
// The section gear is removed; the four semantic More actions remain.
assert.doesNotMatch(shelf,/sectionAction\('bookshelf_settings'/);
assert.doesNotMatch(shelf,/BookshelfGroupSelector\(/);
assert.doesNotMatch(shelf,/sectionAction\('bookshelf_search'/);
assert.match(shelf,/sectionAction\([\s\S]*?\.width\(34\)[\s\S]*?\.height\(34\)/);
assert.match(shelf,/responseRegion\(\{ x: -5, y: -5, width: 44, height: 44 \}/);
for(const source of [shelf,batch]) {
 assert.match(source,/ShelfBookListDetails\(\{ book \}\)/);
 assert.match(source,/ShelfBookPresentation.visible\(/,'ordinary/batch share exact order and filter');
}
// Inspect the real SDK-emitted details: two metadata tags, independent manga
// position, compact same-colour facts and the thin whole-book progress track.
const probeSource=list.replace('  build() {', '  build() { Column() {} }\n  @Builder\n  shelfDetails() {');
const Blank=new Proxy({name:'Blank'},{get:(target,key)=>key==='name'?target.name:()=>{}});
const {owner:details}=createReaderBuilderProbe(probeSource,['shelfDetails','metadataTag','positionLabel'],{ShelfBookPresentation,Blank});
details.appThemeScheme='day'; details.mangaRevision=0;
details.book={sourceId:'local',bookId:'empty-author',title:'书名',author:'',lastChapter:'最新章节',readProgress:0};
details.shelfDetails();
const textNodes=()=>[...details.nodes.values()].filter(n=>n.type==='Text');
const verifyAuthor=expected=>{
 const texts=textNodes();
 const author=texts.find(n=>n.create===expected && n.fontSize===11 && n.lineHeight===14);
 assert.ok(author,'the actual author field stays empty without invented metadata');
 assert.equal(author.constraintSize?.minHeight,14,'empty authors reserve the approved 14vp second row');
 assert.equal(author.fontFamily,'ReaderNotoSansSCUIRegular');
 const latest=texts.find(n=>n.create==='最新：最新章节');
 assert.equal(latest.fontSize,11);assert.equal(latest.lineHeight,14);
 const position=texts.find(n=>n.create==='尚未阅读');
 assert.equal(position.fontColor,latest.fontColor,'secondary facts share one muted colour');
 const title=texts.find(n=>n.create==='书名');
 assert.equal(title.fontSize,15);assert.equal(title.lineHeight,18);
 const tags=texts.filter(n=>n.height===16);
 assert.deepEqual(tags.map(n=>n.create),['小说','本地'],'only content type and origin are metadata tags');
 assert.ok(tags.every(n=>n.borderRadius===4));
 const track=[...details.nodes.values()].find(n=>n.type==='Progress');
 assert.equal(track.height,3);assert.equal(track.style.strokeWidth,3);
};
verifyAuthor('');
details.book={...details.book,author:'Reader test'};details.replay();verifyAuthor('Reader test');
details.book={...details.book,author:''};details.replay();verifyAuthor('');
assert.match(shelf,/PHONE_LIST_COVER_WIDTH = 48/);assert.match(shelf,/PHONE_LIST_COVER_HEIGHT = 72/);
assert.match(shelf,/TABLET_LIST_COVER_WIDTH = 64/);assert.match(shelf,/TABLET_LIST_COVER_HEIGHT = 104/);
assert.match(shelf,/\.contentStartOffset\(this\.headerClearance\)/,
  'bookshelf measured header clearance belongs to native List content, preserving the viewport for the floating tab bar');
assert.match(index,/headerClearance: this\.shelfHeaderHeight \+ 14/);
{
 const sdk=boundedSurfaceSdk(),main=read('features/shell/MainTabShell.ets');
 const deps={...sdk.deps,...metricsApi,readerFloatingTabContentInset,
  ReaderWindowCoordinator:{metrics:metricsApi.createDefaultReaderWindowMetrics},
  LazyForEach:{create(){},pop(){}},ViewStackProcessor:{StartGetAccessRecordingFor(){},StopGetAccessRecording(){}}};
 const bar=read('features/shell/MainTabBar.ets');sdk.childSources.MainTabBar=bar;
 deps.MainTabBar=createReaderBuilderProbe(bar,boundedMembers(bar),deps,sdk.hooks).Component;
 const page=createReaderBuilderProbe(shelf,['headerClearance','bookshelfList','shelfPageHandler','shelfScrollHandler','isShelfPresentationCurrent'],deps,sdk.hooks).owner;
 const scroller={};
 Object.assign(page,{appThemeScheme:'day',readerWindowMetricsRevision:0,mounted:true,navigationGeneration:1,
  shelfScroller:scroller,continueReading:undefined,filterRowVisible:false,viewModeError:'',visibleBookCount:1,
  shelfContentWidth:()=>352,rowDataSource:{totalCount:()=>0},isWideViewport:()=>false,sectionAction(){},saveShelfViewport(){},restoreShelfViewport(){}});
 assert.equal(page.headerClearance,74,'actual shared 60vp header fallback retains the approved 14vp list gap');
 const frame=createReaderBuilderProbe(main,boundedMembers(main),deps,sdk.hooks).owner;
 Object.assign(frame,{showBottomNav:false,showTabletRail:false,headerKind:'floating',headerTop:8,
  content:()=>page.bookshelfList(false),onHeaderHeightChange:height=>{page.headerClearance=height+14;sdk.properties.flush();}});
 frame.initialRender();
 const nativeList=sdk.nodes(page).find(node=>node.type==='List'),items=sdk.nodes(page).filter(node=>node.type==='ListItem');
 assert.equal(nativeList.contentStartOffset,74);assert.equal(nativeList.create.scroller,scroller);
 assert.equal(nativeList.height,'100%');assert.equal(nativeList.padding,undefined);assert.equal(nativeList.maintainVisibleContentPosition,true);
 assert.equal(items.length,1,'fixed header adds no spacer item that would change stored row indices');
 const header=sdk.walk(frame).find(actor=>actor.kind==='floating'&&typeof actor.onHeightChange==='function');
 const measured=[...header.nodes.values()].find(node=>node.type==='Column'&&node.onAreaChange);
 measured.onAreaChange({}, {height:'96vp'});sdk.properties.flush();
 assert.equal(nativeList.contentStartOffset,118,'actual public header height, top offset and list gap propagate exactly once');
 assert.equal(sdk.nodes(page).find(node=>node.type==='List'),nativeList);assert.equal(nativeList.create.scroller,scroller);
 assert.deepEqual(sdk.nodes(page).filter(node=>node.type==='ListItem'),items,'measurement retains List, Scroller and item actors');
}
assert.match(shelf,/\.contentEndOffset\(this\.isWideViewport\(\) \? 24 : readerFloatingTabContentInset\(ReaderWindowCoordinator\.metrics\(\)\)\)/,
  'bookshelf bottom clearance includes floating tab geometry without shrinking the List frame');
assert.match(shelf,/\.bindSheet\(this.actionBook !== undefined[\s\S]*?width: this.bookActionWidth\(\)/);
assert.match(shelf,/return this.shelfContentWidth\(this.isWideViewport\(\)\)/,'single-book sheet uses the same frame as the cover outside edges');
assert.match(shelf,/bookActionSheetSpec\(\)\.hostBackgroundRole/);
assert.match(shelf,/bookActionSheetSpec\(\)\.hostMaskRole/);
assert.doesNotMatch(shelf,/backgroundColor: readerAppColor\('app\.BookshelfPage\.bookshelfTabContent\.bindSheet\./,
  'sheet host colors are owned by the shared sheet contract');
assert.match(popupSpecs,/'bookshelf-book-action': new SheetSurfaceSpec\(\{[\s\S]*?height: 270/);
assert.match(popupSpecs,/'bookshelf-book-action': new SheetSurfaceSpec\(\{[\s\S]*?horizontalInset: 14/);
assert.match(popupSpecs,/'bookshelf-book-action': new SheetSurfaceSpec\(\{[\s\S]*?actionStart: 70, actionStep: 46, actionCount: 4, actionHeight: 40/);
assert.match(popupSpecs,/'bookshelf-book-action': new SheetSurfaceSpec\(\{[\s\S]*?hostBackgroundRole: 'app\.BookshelfPage\.bookshelfTabContent\.bindSheet\.FFFFFCF8'/);
assert.deepEqual([bookActionSpec.actionY(0), bookActionSpec.actionY(1), bookActionSpec.actionY(2), bookActionSpec.actionY(3)], [70, 116, 162, 208],
  'sheet action row positions retain the current four-row visual contract');
assert.match(action,/ReaderBoundedSurface\(\{ specId: 'bookshelf-book-action'/);
assert.match(actionRows,/resolveSheetSpec\('bookshelf-book-action'\)/);
// The action DTO now holds the label and captured token independently of
// dispatchToken. Reuse the actual SDK composition/physical-click regression
// to prove each label still reaches its exclusive business callback.
await import('./test-bookshelf-sheet-shared-composition.mjs');
assert.match(boundedFrame,/borderRadius\(\{ topLeft: spec\.borderRadius/);
assert.doesNotMatch(action,/const BOOK_ACTION_(SHEET_HEIGHT|INSET|HEIGHT)\s*=/,'sheet geometry is owned by the shared sheet contract');
assert.match(popupSpecs,/'bookshelf-more-menu': new PopupSurfaceSpec\(\{[\s\S]*?width: 176/);
assert.match(popupSpecs,/'bookshelf-more-menu': new PopupSurfaceSpec\(\{[\s\S]*?pointerHeight: 12/);
assert.match(popupSpecs,/'bookshelf-more-menu': new PopupSurfaceSpec\(\{[\s\S]*?actionHeight: 50, actionCount: 4/);
assert.match(popupSpecs,/'bookshelf-more-menu': new PopupSurfaceSpec\(\{[\s\S]*?trailingExtension: 11, anchorOverlap: 5/);
assert.match(menu,/ReaderActionMenuSurface\(\{/);
assert.match(menu,/\['batch', 'import', 'update', 'settings'\]/);
assert.doesNotMatch(menu,/'分组管理'/);for(const label of ['批量管理','本地导入','检查更新','书架设置'])assert.ok(menu.includes(label));
assert.match(menu,/Polygon\(/);assert.match(menu,/Polyline\(/);assert.match(menu,/this\.surfaceSpec\(\)\.borderRadius/);
assert.match(menu,/if \(this.reduceMotion\)[\s\S]*?this.panelHeight = this\.surfaceSpec\(\)\.expandedHeight/);
assert.match(index,/onBookshelfSettingsRequested: \(\): void => this.openBookshelfSettings\(\)/);
assert.match(index,/BookshelfSettingsPage\(/);assert.match(index,/onOpenBookshelfSettings: \(\): void => \{ if \(this\.isCurrentSettingsPresentation\(generation, owner, mounting, host, 'settings', identity\)\) this\.openBookshelfSettings\(\); \}/);
assert.match(dialog,/this.panelFrame\(\).width - 32/,'Figma 2657:906 full inner width');
assert.match(dialog,/resultItemsNatural\(/);assert.match(dialog,/onAreaChange/);assert.doesNotMatch(dialog,/count \* 61|Math.min\(410|Math.min\(636/);
assert.match(dialog,/localImportResultLayout\(/);assert.match(dialog,/summaryIcon\(/);
assert.match(dialog,/duration: 1000, curve: Curve.Linear, iterations: -1/);
assert.match(dialog,/duration: 220/);assert.match(dialog,/delay: 80, duration: 140/);
const operationOwner=read('features/bookshelf/BookshelfOperationOwner.ts');
assert.match(operationOwner,/!this\.canMutate\(\)[\s\S]*this\.presentation\.current\(\)\?\.state !== 'fileSelection'/,'domain owner holds the real mutex and picker-opening admission');
assert.match(index,/this\.bookshelfHost\.operations\(owner\)\.importFiles\(this\.shelfFilter\(\), current\)/,'page forwards its exact opening/navigation lease to the actual owner');
assert.match(operationOwner,/!this\.canMutate\(\) \|\| !this\.admitted\(admitted\) \|\| this\.presentation\.current\(\)\?\.state !== 'fileSelection'/);
assert.match(operationOwner,/busy: true[\s\S]*this\.publish\(\); return generation/,'actual finite owner admits one picker/import before synchronous callbacks');
console.log('PASS bookshelf/import current approved surfaces: shared four-row typography, separate menus, cover-aligned sheet, measured results and bounded animation');
