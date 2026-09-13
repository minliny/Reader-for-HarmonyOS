import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import './test-surface-repair.mjs';
const read=f=>readFileSync(new URL(`../entry/src/main/ets/${f}`,import.meta.url),'utf8');
const shelf=read('features/bookshelf/BookshelfPage.ets');
const batch=read('features/bookshelf/BookshelfMultiSelectPage.ets');
const list=read('features/bookshelf/ShelfBookListDetails.ets');
const menu=read('features/bookshelf/BookshelfMoreMenu.ets');
const action=read('features/bookshelf/BookshelfBookActionSheet.ets');
const dialog=read('features/bookshelf/LocalImportDialog.ets');
const index=read('pages/Index.ets');
// Latest authorization supersedes the old tests' CRUD/four-More/201vp assumptions.
assert.match(shelf,/sectionAction\('bookshelf_settings'[\s\S]*?groupSelectorVisible = !this.groupSelectorVisible/);
assert.match(shelf,/BookshelfGroupSelector\(/);
assert.doesNotMatch(shelf,/sectionAction\('bookshelf_search'/);
assert.match(shelf,/sectionAction\([\s\S]*?\.width\(34\)[\s\S]*?\.height\(34\)/);
assert.match(shelf,/responseRegion\(\{ x: -5, y: -5, width: 44, height: 44 \}/);
for(const source of [shelf,batch]) {
 assert.match(source,/ShelfBookListDetails\(\{ book \}\)/);
 assert.match(source,/ShelfBookPresentation.visible\(/,'ordinary/batch share exact order and filter');
}
for(const [size,lineHeight] of [[15,18.3],[12,15],[11,13.75],[10,12]]) {
 assert.match(list,new RegExp(`fontSize\\(${size}\\)[\\s\\S]*?lineHeight\\(${lineHeight}\\)`));
}
assert.match(list,/textAlign\(primary \? TextAlign.Center : TextAlign.Start\)/);
assert.match(list,/Blank\(\).layoutWeight\(1\)/,'right third balances source, progress stays centered');
assert.match(list,/maxLines\(1\).textOverflow\(\{ overflow: TextOverflow.Ellipsis \}\)/);
assert.match(shelf,/PHONE_LIST_COVER_WIDTH = 48/);assert.match(shelf,/PHONE_LIST_COVER_HEIGHT = 80/);
assert.match(shelf,/TABLET_LIST_COVER_WIDTH = 64/);assert.match(shelf,/TABLET_LIST_COVER_HEIGHT = 104/);
assert.match(shelf,/\.bindSheet\(this.actionBook !== undefined[\s\S]*?width: this.bookActionWidth\(\)/);
assert.match(shelf,/available \* .75/);assert.match(shelf,/readerVisualSafeLeft\(metrics\).*readerVisualSafeRight\(metrics\)/);
assert.match(action,/BOOK_ACTION_SHEET_HEIGHT = 270/);assert.match(action,/'编辑分组'.*onEditGroup/);
assert.match(action,/borderRadius\(24\)/);assert.match(action,/TOK_CARD_BG_HI/);
for(const [name,value] of [['MENU_WIDTH',176],['POINTER_HEIGHT',12],['ACTION_HEIGHT',50],['ACTION_COUNT',3],['MENU_TRAILING_EXTENSION',11],['MENU_ANCHOR_OVERLAP',5]])assert.match(menu,new RegExp(`const ${name} = ${value}`));
assert.equal((menu.match(/this.action\(/g)??[]).length,3);
assert.doesNotMatch(menu,/'分组管理'/);for(const label of ['批量管理','本地导入','书架设置'])assert.ok(menu.includes(label));
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
console.log('PASS bookshelf/import current approved surfaces: shared four-row typography, separate menus, safe 75%, measured results and bounded animation');
