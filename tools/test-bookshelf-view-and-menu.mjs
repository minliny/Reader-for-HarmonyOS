import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../entry/src/main/ets/features/', import.meta.url);
const shelf = await readFile(new URL('bookshelf/BookshelfPage.ets', root), 'utf8');
const emptyShelf = await readFile(new URL('bookshelf/BookshelfEmptyPage.ets', root), 'utf8');
const actionSheet = await readFile(new URL('bookshelf/BookshelfBookActionSheet.ets', root), 'utf8');
const moreMenu = await readFile(new URL('bookshelf/BookshelfMoreMenu.ets', root), 'utf8');
const multiSelect = await readFile(new URL('bookshelf/BookshelfMultiSelectPage.ets', root), 'utf8');
const shelfGateway = await readFile(new URL('bookshelf/BookshelfFlowGateway.ts', root), 'utf8');
const directory = await readFile(new URL('reading/FullDirectoryPanel.ets', root), 'utf8');
const index = await readFile(new URL('../pages/Index.ets', root), 'utf8');

assert.match(shelf, /type BookshelfViewMode = 'cover' \| 'list'/);
assert.match(shelf, /@State private viewMode: BookshelfViewMode = 'cover'/);
assert.match(shelf,
  /this\.sectionAction\('bookshelf_grid',[\s\S]*this\.viewMode = 'cover'[\s\S]*this\.viewMode === 'cover'/);
assert.match(shelf,
  /this\.sectionAction\('bookshelf_list',[\s\S]*this\.viewMode = 'list'[\s\S]*this\.viewMode === 'list'/);
assert.match(shelf, /if \(this\.viewMode === 'list'\) \{[\s\S]*this\.listBookCard\(book, isTablet\)/,
  'the list action must render a real book-row projection');
assert.match(shelf, /const PHONE_LIST_COVER_WIDTH = 48/);
assert.match(shelf, /const PHONE_LIST_COVER_HEIGHT = 72/);
assert.match(shelf, /const TABLET_LIST_COVER_WIDTH = 64/);
assert.match(shelf, /const TABLET_LIST_COVER_HEIGHT = 96/);
assert.match(shelf, /private listBookCard\(book: ShelfBook, isTablet: boolean\)/);
assert.match(shelf, /this\.onBookSelected\(book\)/);
assert.match(shelf,
  /private sectionAction[\s\S]*?\.width\(34\)[\s\S]*?\.height\(34\)[\s\S]*?\.responseRegion\(\{ x: -5, y: -5, width: 44, height: 44 \}\)/,
  'the 34vp header actors must retain the Figma 44vp transparent hit target');
assert.match(shelf,
  /Row\(\{ space: 4 \}\)[\s\S]*?Text\(book\.author\)[\s\S]*?\.fontSize\(12\)[\s\S]*?Text\('·'\)[\s\S]*?\.fontSize\(11\)[\s\S]*?Text\(this\.listChapter\(book\)\)[\s\S]*?\.fontSize\(11\)/,
  'list author, separator, and chapter must preserve their distinct Figma text roles');
assert.match(shelf, /private listStatusPill[\s\S]*?\.width\(64\)[\s\S]*?\.height\(18\)/,
  'list status pills must keep the Figma 64×18 geometry');
assert.match(shelf, /private bookListRenderKey\(book: ShelfBook, index: number\)/,
  'mutable list rows must not reuse a stale cover-mode identity');
assert.match(shelf,
  /private tabletNavigation\(\)[\s\S]*?Alignment\.Start[\s\S]*?\.width\(82\)[\s\S]*?\.height\(332\)[\s\S]*?\.padding\(\{ left: this\.tabletRailLeft\(\) \}\)/,
  'the private Tablet rail must use the Final 82×332 actor and clear the live left safe edge');
assert.doesNotMatch(shelf, /Blank\(\)\.height\(238\)/,
  'the old fixed Tablet rail top spacer must not survive');

assert.match(shelf, /@State private actionBook: ShelfBook \| undefined = undefined/);
assert.match(shelf,
  /\.bindSheet\(this\.actionBook !== undefined, this\.bookActionSheetContent,[\s\S]*?height: 224,[\s\S]*?preferType: SheetType\.BOTTOM,[\s\S]*?dragBar: false/,
  'per-book actions must use the canonical bottom sheet instead of an invented popup menu');
assert.equal((shelf.match(/LongPressGesture\(\{ fingers: 1, repeat: false, duration: 500 \}\)/g) ?? []).length, 2,
  'both list and cover shelf items must expose the documented long-press entry');
assert.match(shelf,
  /accessibilityText\(`\$\{book\.title\}更多操作`\)[\s\S]*?\.onClick\(\(\): void => this\.presentBookActionSheet\(book\)\)/,
  'the per-book More actor must open the same Figma action sheet');

assert.match(actionSheet, /Figma: `Library\/BookActionSheet` \(`2903:1737`\)/);
assert.match(actionSheet,
  /Blank\(\)[\s\S]*?\.width\(42\)[\s\S]*?\.height\(4\)[\s\S]*?\.position\(\{ x: 0, y: 9 \}\)/,
  'the sheet grabber must preserve the Figma 42×4 at y=9 geometry');
assert.match(actionSheet,
  /Text\('书籍操作'\)[\s\S]*?\.fontFamily\('ReaderNotoSansSC'\)[\s\S]*?\.fontWeight\(FontWeight\.Bold\)[\s\S]*?\.fontSize\(17\)[\s\S]*?y: 34/);
assert.match(actionSheet, /this\.actionSlot\('多选', false, 70/);
assert.match(actionSheet, /this\.actionSlot\('书籍信息', false, 116/);
assert.match(actionSheet, /this\.actionSlot\('移除书架', true, 162/);
assert.match(actionSheet,
  /\.height\(BOOK_ACTION_SHEET_HEIGHT\)[\s\S]*?\.backgroundColor\(TOK_CARD_BG_HI\)[\s\S]*?\.border\(\{ width: 1, color: TOK_BORDER \}\)[\s\S]*?topLeft: 24[\s\S]*?radius: 46/,
  'the sheet surface must preserve the Figma 224 height, 24 top radius, border, fill, and elevation');
assert.match(actionSheet,
  /\.height\(BOOK_ACTION_HEIGHT\)[\s\S]*?\.padding\(\{ left: 12 \}\)[\s\S]*?\.borderRadius\(12\)[\s\S]*?\.padding\(\{ left: BOOK_ACTION_INSET, right: BOOK_ACTION_INSET \}\)/,
  'each action must be 40vp high with 14vp sheet inset and 12vp text inset/radius');
assert.match(index,
  /onBookMultiSelectRequested: \(book: ShelfBook\): void => this\.openBookshelfMultiSelect\(book\)/);
assert.match(index, /onBookInfoRequested: \(book: ShelfBook\): void => this\.openShelfBookInfo\(book\)/);
assert.match(index, /onBookRemoveRequested: \(book: ShelfBook\): void => this\.requestRemoveShelfBook\(book\)/);
assert.match(index,
  /private openShelfBookInfo\(selection: ShelfBook\): void \{[\s\S]*?openLocalBookDetail\(selection, false\)[\s\S]*?openRemoteBookDetail\([\s\S]*?selection, false\)/,
  'Book Info must open Detail without immediately resuming reading');
assert.match(index,
  /private requestRemoveShelfBook\(book: ShelfBook\): void[\s\S]*?private removeShelfBook\(book: ShelfBook\): void[\s\S]*?gateway\.remove\(book\.sourceId, book\.bookId\)/,
  'Remove From Bookshelf must use the existing Core-backed removal gateway');

const topBar = shelf.match(/private topBar\(\) \{([\s\S]*?)\n  \}\n\n  @Builder\n  private phoneContent/);
assert.ok(topBar, 'bookshelf top bar must remain immediately before the phone content');
assert.doesNotMatch(topBar[1], /onImportRequested/,
  'the top-right More button must not import directly');
assert.match(topBar[1],
  /icon: \$r\('app\.media\.bookshelf_more'\)[\s\S]*onTap: \(\): void => \{[\s\S]*this\.moreMenuVisible = true/,
  'the top-right More actor must open its Figma menu overlay');
assert.match(shelf, /BookshelfMoreMenu\(\{[\s\S]*onBatchManage[\s\S]*onLocalImport[\s\S]*onBookshelfSettings/);
assert.match(shelf,
  /onBookshelfSettings: \(\): void => \{[\s\S]*?this\.onBookshelfSettingsRequested\(\)/,
  'the visible settings action must stop at its dedicated evidence boundary');
assert.doesNotMatch(shelf,
  /onBookshelfSettings: \(\): void => \{\s*this\.moreMenuVisible = false;\s*this\.onSettingsRequested\(\)/,
  'an unproven destination must not be inferred as the general Settings home');
assert.doesNotMatch(emptyShelf,
  /bookshelf_more[\s\S]{0,300}onClick\(\(\): void => this\.onImportRequested\(\)\)/,
  'the empty-shelf More actor must not bypass the same menu contract');

assert.match(moreMenu, /interaction registry `1982:313`/);
assert.match(moreMenu, /`2236:545`, `2236:551`, `2236:553`/);
assert.match(moreMenu, /const MENU_WIDTH = 176/);
assert.equal((moreMenu.match(/this\.action\('/g) ?? []).length, 3,
  'only the three visible actions belong in the menu');
assert.match(moreMenu, /this\.action\('批量管理'/);
assert.match(moreMenu, /this\.action\('本地导入'/);
assert.match(moreMenu, /this\.action\('书架设置'/);
assert.doesNotMatch(moreMenu, /this\.action\('关闭更多'/,
  'close-more is an outside-dismiss semantic, never a fourth row');
assert.match(moreMenu,
  /motionAnimateParam\('dropdown\.menu\.expand'\)[\s\S]*motionAnimateParam\('dropdown\.menu\.collapse'/,
  'the menu must use the interaction-registry motion pair');

assert.match(multiSelect, /Figma `Bookshelf\/MultiSelect` \(`2956:1266`\)/);
assert.match(multiSelect, /initialSelectedKey/);
assert.match(multiSelect, /this\.selectedKeys = \[this\.initialSelectedKey\]/,
  'long-press entry must preselect exactly the source book');
assert.match(multiSelect, /Text\(`已选择 \$\{this\.selectedKeys\.length\} 本`\)/);
assert.match(multiSelect, /this\.allSelected\(\) \? '取消全选' : '全选'/);
assert.match(multiSelect, /Text\(this\.busy \? '正在移除' : '移除书架'\)/);
assert.doesNotMatch(multiSelect, /新建分组|编辑分组|应用到所选书籍|Core 分组/,
  'Figma V1 multiselect must not absorb the unrelated Core group manager');
assert.match(index, /onBatchManageRequested: \(\): void => this\.openBookshelfMultiSelect\(\)/);
assert.match(index, /initialSelectedKey: this\.bookshelfMultiSelectInitialKey/);
assert.match(index, /onRemoveSelected: \(keys: string\[\]\): void => this\.requestRemoveShelfBooks\(keys\)/);
assert.match(shelfGateway,
  /async removeMany\(targets: BookshelfRemovalTarget\[\]\)[\s\S]*for \(const target of targets\)[\s\S]*shelf: await this\.load\(\)/,
  'batch removal must commit each Core key then perform one coherent shelf reload');

assert.doesNotMatch(directory, /Text\('当前章节'\)/,
  'the footer no longer repeats the current-chapter label');
assert.doesNotMatch(directory, /\.width\(20\.08\)/,
  'the position counter must size to its actual digit count');
assert.match(directory,
  /Text\(this\.currentTitle\(\)\)[\s\S]*\.layoutWeight\(1\)[\s\S]*\.constraintSize\(\{ minWidth: 0 \}\)[\s\S]*TextOverflow\.Ellipsis/,
  'the full chapter title must own the remaining width and ellipsize once');
assert.match(directory,
  /Text\(this\.currentTitle\(\)\)[\s\S]*?\.fontFamily\('ReaderNotoSansSC'\)[\s\S]*?\.fontWeight\(FontWeight\.Bold\)[\s\S]*?\.fontSize\(11\)/,
  'the directory chapter title must use the Figma Noto Sans SC Bold 11 role');
assert.match(directory,
  /Text\(this\.currentPosition\(\)\)[\s\S]*\.flexShrink\(0\)[\s\S]*\.maxLines\(1\)/,
  'the current/total counter must keep one intrinsic-width line');

console.log('bookshelf view and directory footer contracts: PASS');
