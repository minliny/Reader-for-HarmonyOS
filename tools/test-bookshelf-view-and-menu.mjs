import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createReaderBuilderProbe } from './lib/reader-control-builder-probe.mjs';
import { ShelfBookPresentation } from '../entry/src/main/ets/features/bookshelf/ShelfBookPresentation.ts';
import './test-surface-repair.mjs';
const read=f=>readFileSync(new URL(`../entry/src/main/ets/${f}`,import.meta.url),'utf8');
const shelf=read('features/bookshelf/BookshelfPage.ets');
const batch=read('features/bookshelf/BookshelfMultiSelectPage.ets');
const list=read('features/bookshelf/ShelfBookListDetails.ets');
const menu=read('features/bookshelf/BookshelfMoreMenu.ets');
const action=read('features/bookshelf/BookshelfBookActionSheet.ets');
const dialog=read('features/bookshelf/LocalImportDialog.ets');
const index=read('pages/Index.ets');
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
 assert.equal(author.fontFamily,'ReaderNotoSansSC');
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
assert.match(shelf,/\.contentStartOffset\(74\)/,
  'bookshelf header clearance belongs to native List content, preserving the viewport for the floating tab bar');
assert.match(shelf,/\.contentEndOffset\(this\.isWideViewport\(\) \? 24 : readerFloatingTabContentInset\(ReaderWindowCoordinator\.metrics\(\)\)\)/,
  'bookshelf bottom clearance includes floating tab geometry without shrinking the List frame');
assert.match(shelf,/\.bindSheet\(this.actionBook !== undefined[\s\S]*?width: this.bookActionWidth\(\)/);
assert.match(shelf,/return this.shelfContentWidth\(this.isWideViewport\(\)\)/,'single-book sheet uses the same frame as the cover outside edges');
assert.match(action,/BOOK_ACTION_SHEET_HEIGHT = 270/);assert.match(action,/'编辑分组'.*onEditGroup/);
assert.match(action,/borderRadius\(\{ topLeft: 24, topRight: 24, bottomLeft: 0, bottomRight: 0 \}\)/);assert.match(action,/TOK_CARD_BG_HI/);
for(const [name,value] of [['MENU_WIDTH',176],['POINTER_HEIGHT',12],['ACTION_HEIGHT',50],['ACTION_COUNT',4],['MENU_TRAILING_EXTENSION',11],['MENU_ANCHOR_OVERLAP',5]])assert.match(menu,new RegExp(`const ${name} = ${value}`));
assert.equal((menu.match(/this.action\(/g)??[]).length,4);
assert.doesNotMatch(menu,/'分组管理'/);for(const label of ['批量管理','本地导入','检查更新','书架设置'])assert.ok(menu.includes(label));
assert.match(menu,/Polygon\(/);assert.match(menu,/Polyline\(/);assert.match(menu,/borderRadius\(16\)/);
assert.match(menu,/if \(this.reduceMotion\)[\s\S]*?this.panelHeight = MENU_HEIGHT/);
assert.match(index,/onBookshelfSettingsRequested: \(\): void => this.openBookshelfSettings\(\)/);
assert.match(index,/BookshelfSettingsPage\(/);assert.match(index,/onOpenBookshelfSettings: \(\): void => this.openBookshelfSettings\(\)/);
assert.match(dialog,/this.panelFrame\(\).width - 32/,'Figma 2657:906 full inner width');
assert.match(dialog,/resultItemsNatural\(/);assert.match(dialog,/onAreaChange/);assert.doesNotMatch(dialog,/count \* 61|Math.min\(410|Math.min\(636/);
assert.match(dialog,/localImportResultLayout\(/);assert.match(dialog,/summaryIcon\(/);
assert.match(dialog,/duration: 1000, curve: Curve.Linear, iterations: -1/);
assert.match(dialog,/duration: 220/);assert.match(dialog,/delay: 80, duration: 140/);
assert.match(index,/presentation.state !== 'fileSelection' \|\| this.importBusyAttempt !== 0/);
console.log('PASS bookshelf/import current approved surfaces: shared compact metadata and retained blank author, separate menus, cover-aligned sheet, measured results and bounded animation');
