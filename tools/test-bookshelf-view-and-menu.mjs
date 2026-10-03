import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { createReaderBuilderProbe } from './lib/reader-control-builder-probe.mjs';
import { ShelfBookPresentation } from '../entry/src/main/ets/features/bookshelf/ShelfBookPresentation.ts';
import * as fontFamilies from '../entry/src/main/ets/features/common/ReaderFontFamilies.ts';
import './test-surface-repair.mjs';
const read=f=>readFileSync(new URL(`../entry/src/main/ets/${f}`,import.meta.url),'utf8');
const shelf=read('features/bookshelf/BookshelfPage.ets');
const batch=read('features/bookshelf/BookshelfMultiSelectPage.ets');
const list=read('features/bookshelf/ShelfBookListDetails.ets');
const menu=read('features/bookshelf/BookshelfMoreMenu.ets');
const popupSpecs=read('features/common/ReaderSurfaceSpecs.ets');
const { resolveSheetSpec } = new Function('TextAlign', stripTypeScriptTypes(popupSpecs)
  .replace(/^export /gm,'') + '; return { resolveSheetSpec };')({ Start: 'TextAlign.Start', Center: 'TextAlign.Center' });
const bookActionSpec=resolveSheetSpec('bookshelf-book-action');
const action=read('features/bookshelf/BookshelfBookActionSheet.ets');
const actionRows=read('features/common/ReaderSheetActionList.ets');
const boundedFrame=read('features/common/ReaderBoundedSurface.ets');
const dialog=read('features/bookshelf/LocalImportDialog.ets');
const index=read('pages/Index.ets');
const typographySource=readFileSync(new URL('../entry/src/main/ets/features/common/ReaderTypography.ets',import.meta.url),'utf8');
const typographyRoles=new Function(...Object.keys(fontFamilies),
 `${stripTypeScriptTypes(typographySource.replace(/import[\s\S]*?from '[^']+';/g,'').replace(/\bexport /g,''))}; return {TYPE_SHELF_LIST_TITLE,TYPE_SHELF_LIST_AUTHOR,TYPE_SHELF_LIST_CHAPTER,TYPE_SHELF_LIST_STATUS};`)(...Object.values(fontFamilies));
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
for(const role of ['TYPE_SHELF_LIST_TITLE', 'TYPE_SHELF_LIST_AUTHOR', 'TYPE_SHELF_LIST_CHAPTER', 'TYPE_SHELF_LIST_STATUS']) {
 assert.match(list,new RegExp(`${role}\\.fontSizeFp[\\s\\S]*?${role}\\.lineHeightFp`));
}
assert.match(list,/textAlign\(TextAlign.Start\)/);
assert.match(list,/this.statusPill\(true\);\s*this.statusPill\(false\)/,'progress left and source right');
assert.match(list,/layoutWeight\(1\).constraintSize\(\{ minWidth: 0 \}\)/,'both slots divide available width independent of content');
assert.match(list,/maxLines\(1\).textOverflow\(\{ overflow: TextOverflow.Ellipsis \}\)/);
// Compile the exact production body with the SDK, then inspect its native
// layout attributes. Empty Text does not acquire a glyph line from lineHeight.
// Rename only the entry method so the existing Builder probe can invoke it.
const probeSource=list.replace('  build() {', '  build() { Column() {} }\n  @Builder\n  shelfDetails() {');
const Blank=new Proxy({name:'Blank'},{get:(target,key)=>key==='name'?target.name:()=>{}});
const {owner:details}=createReaderBuilderProbe(probeSource,['shelfDetails','statusPill'],{
 ShelfBookPresentation,Blank,...typographyRoles,
});
details.appThemeScheme='day';
details.book={sourceId:'local',bookId:'empty-author',title:'书名',author:'',lastChapter:'最新章节',readProgress:0};
details.shelfDetails();
const textNodes=()=>[...details.nodes.values()].filter(n=>n.type==='Text');
const verifyAuthor=expected=>{
 const texts=textNodes();
 assert.equal(texts[1].create,expected,'the actual author field stays empty without invented metadata');
 assert.equal(texts[1].constraintSize?.minHeight,15,'empty authors must reserve the original 15vp second row');
 assert.equal(texts[1].fontSize,12);assert.equal(texts[1].lineHeight,15);
 for(const text of texts.slice(1)) assert.equal(text.fontFamily,'ReaderNotoSansSCUIRegular',
  'author, chapter and both status labels use the fixed 400 face');
 assert.equal(texts[2].create,'最新章节');
 assert.equal(texts[2].lineHeight,13.75);
};
verifyAuthor('');
details.book={...details.book,author:'Reader test'};details.replay();verifyAuthor('Reader test');
details.book={...details.book,author:''};details.replay();verifyAuthor('');
assert.match(shelf,/PHONE_LIST_COVER_WIDTH = 48/);assert.match(shelf,/PHONE_LIST_COVER_HEIGHT = 80/);
assert.match(shelf,/TABLET_LIST_COVER_WIDTH = 64/);assert.match(shelf,/TABLET_LIST_COVER_HEIGHT = 104/);
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
assert.match(actionRows,/'编辑分组'.*onEditGroup/);
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
assert.match(index,/BookshelfSettingsPage\(/);assert.match(index,/onOpenBookshelfSettings: \(\): void => this.openBookshelfSettings\(\)/);
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
