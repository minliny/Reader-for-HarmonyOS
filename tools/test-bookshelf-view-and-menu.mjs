import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../entry/src/main/ets/features/', import.meta.url);
const shelf = await readFile(new URL('bookshelf/BookshelfPage.ets', root), 'utf8');
const emptyShelf = await readFile(new URL('bookshelf/BookshelfEmptyPage.ets', root), 'utf8');
const actionSheet = await readFile(new URL('bookshelf/BookshelfBookActionSheet.ets', root), 'utf8');
const importDialog = await readFile(new URL('bookshelf/LocalImportDialog.ets', root), 'utf8');
const moreMenu = await readFile(new URL('bookshelf/BookshelfMoreMenu.ets', root), 'utf8');
const multiSelect = await readFile(new URL('bookshelf/BookshelfMultiSelectPage.ets', root), 'utf8');
const shelfGateway = await readFile(new URL('bookshelf/BookshelfFlowGateway.ts', root), 'utf8');
const directory = await readFile(new URL('reading/FullDirectoryPanel.ets', root), 'utf8');
const index = await readFile(new URL('../pages/Index.ets', root), 'utf8');
const motionSpec = await readFile(new URL('common/MotionSpec.ets', root), 'utf8');
const mediaRoot = new URL('../entry/src/main/resources/base/media/', import.meta.url);
const moreIcon = await readFile(new URL('bookshelf_more.svg', mediaRoot), 'utf8');
const moreSurface = await readFile(new URL('bookshelf_more_menu_surface.svg', mediaRoot), 'utf8');

assert.match(shelf, /type BookshelfViewMode = 'cover' \| 'list'/);
assert.match(shelf, /@State private viewMode: BookshelfViewMode = 'cover'/);
assert.match(shelf, /@StorageLink\('readerBookshelfViewMode'\) private storedViewMode: string = 'cover'/,
  'the selected bookshelf projection must survive route recreation');
assert.match(shelf, /const restoredMode: BookshelfViewMode = this\.storedViewMode === 'list' \? 'list' : 'cover'/,
  'bookshelf entry must restore the persisted projection before rebuilding rows');
assert.match(shelf, /private setViewMode\(mode: BookshelfViewMode\): void \{[\s\S]*?this\.storedViewMode = mode;/,
  'projection changes must be committed to app storage before the motion track');
assert.match(shelf,
  /this\.sectionAction\('bookshelf_grid', \(\): void => \{[\s\S]*?this\.setViewMode\('cover'\)/,
  'the grid action must go through the single animated view-switch entry');
assert.match(shelf,
  /this\.sectionAction\('bookshelf_list', \(\): void => \{[\s\S]*?this\.setViewMode\('list'\)/,
  'the list action must go through the single animated view-switch entry');
assert.match(shelf,
  /this\.viewMode === 'cover'/);
assert.match(shelf,
  /this\.viewMode === 'list'/);
assert.match(shelf, /private setViewMode\(mode: BookshelfViewMode\): void \{/);
const setViewModeBody = shelf.match(
  /private setViewMode\(mode: BookshelfViewMode\): void \{([\s\S]*?)\n  \}/);
assert.ok(setViewModeBody, 'the setViewMode entry must exist');
assert.match(setViewModeBody[1],
  /if \(this\.reduceMotion\) \{\s*this\.resetViewSwitchMotion\(\);\s*this\.viewMode = mode;\s*this\.setRestingProjectionOpacity\(mode\);\s*return;/,
  'reduceMotion must commit the switch directly with no animation');
assert.match(setViewModeBody[1],
  /this\.startViewSwitch\(mode\)/,
  'the animated switch must enter the Figma keyframe coordinator');
// One reversible clock samples the same authored local tracks. There must
// not be residual implicit animations overriding sampled geometry in reduced mode.
assert.match(shelf, /new ReversibleMotionTimeline\(this\.viewMotion\.totalMs\)/);
assert.match(shelf, /this\.viewTimeline\.retarget\(mode === this\.viewSwitchDestinationMode/);
assert.doesNotMatch(shelf, /\.animation\(|\.keyframeAnimateTo\(|\.geometryTransition\(/);
assert.match(shelf, /LazyForEach\(this\.rowDataSource[\s\S]*?this\.projectionRow\(row, isTablet, rowIndex\)/);
assert.doesNotMatch(shelf, /if \(this\.viewMode === 'list'\) \{[\s\S]{0,500}?LazyForEach/);
assert.match(shelf, /projectionBookTranslateX\(columnIndex, isTablet, index\)/);
assert.match(shelf, /projectionCoverScale\(isTablet, index\)/);
assert.equal((shelf.match(/this\.projectionBookCover\(book, isTablet, index\)/g) ?? []).length, 1);
assert.match(shelf, /\.opacity\(this\.viewSwitchHeaderOpacity\)/);
assert.match(shelf, /\.opacity\(this\.viewSwitchGridContentOpacity\)[\s\S]*?\.opacity\(this\.viewSwitchListContentOpacity\)/);
assert.match(shelf, /this\.projectionBookCoverLayer\(book, isTablet, false, index\)[\s\S]*?this\.projectionBookCoverLayer\(book, isTablet, true, index\)/);
const coverActorBody = shelf.match(/private projectionBookCover\([^\n]*\) \{([\s\S]*?)\n  \}/)?.[1];
assert.ok(coverActorBody, 'the two cover images must have one visual-only wrapper');
assert.match(coverActorBody, /\.enabled\(false\)\s*\.hitTestBehavior\(HitTestMode\.None\)/,
  'cover descendants must not intercept the enclosing card click or long press');
assert.doesNotMatch(coverActorBody, /\.gesture\(|\.onClick\(/,
  'cover copies must not introduce duplicate business gesture owners');
assert.match(shelf, /motionSegment\(t, m\.layoutCommitMs, m\.outgoingDurationMs, content\)/);
assert.match(shelf, /this\.viewMode = t < m\.layoutCommitMs \? this\.viewSwitchSourceMode : this\.viewSwitchDestinationMode/);
assert.match(shelf, /viewSwitchToken \+= 1/);
assert.match(motionSpec, /totalMs: 1000/);
assert.match(motionSpec, /layoutCommitMs: 150/);
assert.match(motionSpec, /outgoingDurationMs: 120/);
assert.match(motionSpec, /headerIncomingStartMs: 500/);
assert.match(motionSpec, /contentIncomingStartMs: 600/);
assert.match(motionSpec, /contentIncomingDurationMs: 220/);
assert.match(motionSpec, /morphCoverIncomingStartMs: 150/);
assert.match(motionSpec, /morphCoverIncomingDurationMs: 30/);
assert.match(motionSpec, /movingCoverFadeStartMs: 690/);
assert.match(motionSpec, /coverMoveDurationMs: 420/);
assert.match(motionSpec, /coverScaleDurationMs: 250/);
assert.match(motionSpec, /coverStaggerMs: 30/);
assert.match(shelf,
  /projectionCoverCompensationX[\s\S]*?return -\(this\.shelfBookCardWidth\(isTablet\) - this\.listCoverWidth\(isTablet\)\) \/ 2/,
  'the cover x endpoint must derive from the card/list width pair, not a screen-space hardcode');
assert.match(shelf,
  /projectionCoverCompensationY[\s\S]*?return -\(\s*this\.bookCardHeight\(this\.shelfBookCardWidth\(isTablet\), isTablet\) -\s*this\.listCoverHeight\(isTablet\)\s*\) \/ 2/,
  'the cover y endpoint must derive from the card/list height pair; Figma authors the morph dy in screen space, not card-local space');
assert.doesNotMatch(shelf, /return -21\.727/,
  'the Figma screen-space morph dy must never be hardcoded as card-local compensation (VM-verified 15.36vp list-thumbnail regression)');
assert.match(shelf, /: \.495/,
  'the phone cover scale endpoint must match the Figma shared-cover track');
assert.match(motionSpec, /cubicBezierCurve\(0\.2, 0, 0, 1\)/,
  'cover translation must preserve the Figma curve');
assert.match(motionSpec, /cubicBezierCurve\(0\.25, 0\.1, 0, 1\)/,
  'cover scale must preserve the separate Figma curve');
assert.match(motionSpec,
  /const rowBand = Math\.min\(1, Math\.floor\(safeIndex \/ 3\)\)[\s\S]*BOOKSHELF_VIEW_MOTION\.coverStaggerMs/,
  'the per-book cadence must match both shared and extra-cover rows');
// The current product decision supersedes the stale five-action SectionHeader
// instance: search has one global AppTopBar entry, never a duplicate shelf-row
// entry. Both populated and empty shelf surfaces must obey the same contract.
assert.doesNotMatch(shelf, /this\.sectionAction\('bookshelf_search'/,
  'the populated shelf section must not duplicate the global search entry');
assert.doesNotMatch(emptyShelf, /this\.headerAction\('bookshelf_search'\)/,
  'the empty shelf section must not duplicate the global search entry');
assert.equal((shelf.match(/icon: \$r\('app\.media\.bookshelf_search'\)/g) ?? []).length, 1,
  'the populated shelf must keep exactly one AppTopBar search entry');
assert.equal((emptyShelf.match(/Image\(\$r\('app\.media\.bookshelf_search'\)\)/g) ?? []).length, 1,
  'the empty shelf must keep exactly one AppTopBar search entry');
assert.match(shelf,
  /this\.sectionAction\('bookshelf_settings', \(\): void => this\.onManageRequested\(\)\)/,
  'the shelf gear opens shelf management per the 2026-08-30 product decision');
assert.match(shelf, /private sectionAction\(assetName: string, action: \(\) => void\)/,
  'the action active state must be read from view state, not from a value parameter');
assert.doesNotMatch(shelf, /sectionAction\([^)]*, active: boolean\)/,
  '@Builder value parameters are not observed; an active flag parameter never re-renders');
assert.match(shelf, /Image\(this\.sectionActionAsset\(assetName\)\)/,
  'each action must be one unconditional Image whose src a plain method picks');
const sectionActionBody = shelf.match(
  /private sectionAction\(assetName: string, action: \(\) => void\) \{([\s\S]*?)\n  \}/);
assert.ok(sectionActionBody, 'the sectionAction builder must exist');
assert.doesNotMatch(sectionActionBody[1], /\bif \(/,
  'conditional if/else nodes inside the multi-instance sectionAction builder get mis-diffed and vanish (observed: search)');
const headerActionBody = emptyShelf.match(/private headerAction\(asset: string\) \{([\s\S]*?)\n  \}/);
assert.ok(headerActionBody, 'the empty-shelf headerAction builder must exist');
assert.doesNotMatch(headerActionBody[1], /\bif \(/,
  'the empty-shelf headerAction must also stay free of conditional nodes');
assert.match(emptyShelf, /Image\(this\.headerActionAsset\(asset\)\)/,
  'the empty-shelf actions must be one unconditional Image per action');
assert.match(shelf, /private projectionListDetails\(book: ShelfBook, isTablet: boolean\)/,
  'the stable book actor must retain the real list-row content projection');
assert.match(shelf, /const PHONE_LIST_COVER_WIDTH = 48/);
assert.match(shelf, /const PHONE_LIST_COVER_HEIGHT = 80/);
assert.match(shelf, /const TABLET_LIST_COVER_WIDTH = 64/);
assert.match(shelf, /const TABLET_LIST_COVER_HEIGHT = 104/);
assert.match(shelf, /private projectionBookCard\([\s\S]*?book: ShelfBook,[\s\S]*?index: number/);
assert.match(shelf, /this\.onBookSelected\(book\)/);
assert.match(shelf,
  /private sectionAction[\s\S]*?\.width\(34\)[\s\S]*?\.height\(34\)[\s\S]*?\.responseRegion\(\{ x: -5, y: -5, width: 44, height: 44 \}\)/,
  'the 34vp header actors must retain the Figma 44vp transparent hit target');
assert.match(shelf,
  /Text\(book\.author\)[\s\S]*?Text\(this\.listChapter\(book\)\)[\s\S]*?private listSourceLabel\(book: ShelfBook\)/,
  'list projection must keep author, latest chapter, and source roles as separate rows');
assert.match(shelf, /private listStatusPill[\s\S]*?\.width\(64\)[\s\S]*?\.height\(18\)/,
  'list status pills must keep the Figma 64×18 geometry');
assert.match(shelf,
  /private bookRowRenderKey[\s\S]*?book\.currentChapterTitle[\s\S]*?book\.lastChapter/,
  'the shared mutable row identity must include fields rendered by either projection');
assert.match(shelf,
  /private tabletNavigation\(\)[\s\S]*?Alignment\.Start[\s\S]*?\.width\(82\)[\s\S]*?\.height\(332\)[\s\S]*?\.padding\(\{ left: this\.tabletRailLeft\(\) \}\)/,
  'the private Tablet rail must use the Final 82×332 actor and clear the live left safe edge');
assert.doesNotMatch(shelf, /Blank\(\)\.height\(238\)/,
  'the old fixed Tablet rail top spacer must not survive');

assert.match(shelf, /@State private actionBook: ShelfBook \| undefined = undefined/);
assert.match(shelf,
  /\.bindSheet\(this\.actionBook !== undefined, this\.bookActionSheetContent,[\s\S]*?height: 224,[\s\S]*?width: '75%',[\s\S]*?preferType: SheetType\.CENTER,[\s\S]*?backgroundColor: '#FFFCF8'/,
  'per-book actions must use the requested opaque 75% floating panel');
assert.equal((shelf.match(/LongPressGesture\(\{ fingers: 1, repeat: false, duration: 500 \}\)/g) ?? []).length, 1,
  'the persistent book actor must expose one long-press entry shared by both projections');
assert.match(shelf,
  /accessibilityText\(`\$\{book\.title\}更多操作`\)[\s\S]*?\.onClick\(\(\): void => this\.presentBookActionSheet\(book\)\)/,
  'the per-book More actor must open the same Figma action sheet');

assert.match(actionSheet, /Per-book action surface\./);
assert.match(actionSheet,
  /Blank\(\)[\s\S]*?\.width\(42\)[\s\S]*?\.height\(4\)[\s\S]*?\.position\(\{ x: 0, y: 9 \}\)/,
  'the sheet grabber must preserve the Figma 42×4 at y=9 geometry');
assert.match(actionSheet,
  /Text\('书籍操作'\)[\s\S]*?\.fontFamily\('ReaderNotoSansSC'\)[\s\S]*?\.fontWeight\(FontWeight\.Bold\)[\s\S]*?\.fontSize\(17\)[\s\S]*?y: 34/);
assert.match(actionSheet, /this\.actionSlot\('多选', false, 70/);
assert.match(actionSheet, /this\.actionSlot\('书籍信息', false, 116/);
assert.match(actionSheet, /this\.actionSlot\('移除书架', true, 162/);
assert.match(actionSheet,
  /\.height\(BOOK_ACTION_SHEET_HEIGHT\)[\s\S]*?\.backgroundColor\(TOK_CARD_BG_HI\)[\s\S]*?\.border\(\{ width: 1, color: TOK_BORDER \}\)[\s\S]*?\.borderRadius\(24\)[\s\S]*?radius: 46/,
  'the floating action surface must preserve height, opaque host fill, radius, border and elevation');
assert.match(actionSheet,
  /\.height\(BOOK_ACTION_HEIGHT\)[\s\S]*?\.padding\(\{ left: 12 \}\)[\s\S]*?\.borderRadius\(12\)[\s\S]*?\.padding\(\{ left: BOOK_ACTION_INSET, right: BOOK_ACTION_INSET \}\)/,
  'each action must be 40vp high with 14vp sheet inset and 12vp text inset/radius');
assert.match(index,
  /onBookMultiSelectRequested: \(book: ShelfBook\): void => this\.openBookshelfMultiSelect\(book\)/);
assert.match(multiSelect, /@StorageLink\('readerBookshelfViewMode'\)/,
  'batch management must inherit the persisted bookshelf projection');
assert.match(multiSelect, /@StorageLink\('readerBookshelfSelectedGroup'\)/,
  'batch management must inherit the active bookshelf filter');
assert.match(multiSelect, /private selectionListCard\(book: ShelfBook\)/,
  'batch management must render list rows when the bookshelf is in list mode');
assert.match(multiSelect, /const columnCount = this\.isListMode\(\) \? 1 : 3/,
  'batch rows must preserve the active projection ordering');
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
assert.match(moreMenu, /style reference `4572:1796`/);
assert.match(moreMenu, /const MENU_WIDTH = 176/);
assert.match(moreMenu, /const POINTER_HEIGHT = 12/);
assert.match(moreMenu, /const ACTION_HEIGHT = 50/);
assert.match(moreMenu, /const MENU_TRAILING_EXTENSION = 11/);
assert.match(moreMenu, /const MENU_ANCHOR_OVERLAP = 5/);
// SHF-02 supersedes the three-action frame: the approved extension adds the
// group-management row so the shelf filter chips have a reachable source of
// groups (the previously dead onManageRequested intent is now wired).
assert.equal((moreMenu.match(/this\.action\(\$r/g) ?? []).length, 4,
  'the three Figma actions plus the SHF-02 group management row belong in the menu');
assert.match(moreMenu, /'app\.media\.bookshelf_more_batch'\), '批量管理'/);
assert.match(moreMenu, /'app\.media\.bookshelf_more_group'\), '分组管理'/);
assert.match(moreMenu, /'app\.media\.bookshelf_more_import'\), '本地导入'/);
assert.match(moreMenu, /'app\.media\.bookshelf_more_settings'\), '书架设置'/);
assert.doesNotMatch(moreMenu, /this\.action\([^\n]*'关闭更多'/,
  'close-more is an outside-dismiss semantic, never a menu row');
assert.match(moreMenu,
  /if \(this\.reduceMotion\) \{[\s\S]*?Image\(\$r\('app\.media\.bookshelf_more_menu_surface'\)\)/,
  'reduce-motion must retain the exact approved static Figma surface');
assert.match(moreMenu,
  /Row\(\)[\s\S]*?\.height\(this\.panelHeight - POINTER_HEIGHT\)[\s\S]*?\.backgroundColor\('#FFFCF8'\)[\s\S]*?\.border\(\{ width: 1, color: '#E3DED6' \}\)[\s\S]*?\.borderRadius\(16\)[\s\S]*?\.shadow\(\{ radius: 28, color: '#292E261F', offsetX: 0, offsetY: 10 \}\)/,
  'the full surface body must grow with the animated height, including fill, border, corners, and shadow');
assert.match(moreMenu,
  /const POINTER_POINTS: Array<Array<number>> = \[\[0, 12\], \[12, 0\], \[24, 12\]\]/,
  'the fixed pointer must preserve the approved Figma coordinates');
assert.match(moreMenu,
  /Polygon\(\{ width: 24, height: POINTER_HEIGHT \+ 1 \}\)[\s\S]*?\.position\(\{ x: 131, y: 0\.5 \}\)[\s\S]*?\.position\(\{ x: 131, y: 11\.5 \}\)[\s\S]*?Polyline\(\{ width: 24, height: POINTER_HEIGHT \+ 1 \}\)/,
  'the body seam must be covered before the pointer outline is drawn');
assert.match(moreMenu,
  /const MENU_COLLAPSED_HEIGHT = POINTER_HEIGHT \+ ACTION_HEIGHT/,
  'the fixed top anchor must retain one stable row at the collapsed endpoint');
assert.match(moreMenu,
  /\.height\(Math\.max\(0, this\.panelHeight - POINTER_HEIGHT\)\)[\s\S]*?\.clip\(true\)/,
  'the content viewport must grow and contract with the complete surface');
assert.match(moreMenu,
  /this\.anchorRight \+ MENU_TRAILING_EXTENSION - MENU_WIDTH[\s\S]*?this\.anchorBottom - MENU_ANCHOR_OVERLAP/,
  'the pointer must remain centered under the More actor while the surface clears the right edge');
assert.match(moreMenu,
  /\.fontWeight\(FontWeight\.Medium\)[\s\S]*?\.fontSize\(15\)[\s\S]*?\.lineHeight\(22\)/,
  'menu labels must match the approved Noto Sans SC Medium 15/22 role');
assert.match(moreMenu, /\.width\(144\)[\s\S]*?\.color\('#E8E2DA'\)/,
  'menu rows must use the approved inset divider');
assert.equal((moreIcon.match(/<circle/g) ?? []).length, 4,
  'the More asset must be the approved vertical-dots override, including its cover circle');
assert.match(moreIcon, /cx="22" cy="15"[\s\S]*cx="22" cy="22"[\s\S]*cx="22" cy="29"/,
  'the top-bar More icon must be vertical, not a rotated or legacy horizontal asset');
assert.match(moreSurface, /L171 18\.5L183 30\.5/,
  'the popover pointer must be integrated into the surface silhouette');
assert.match(moreMenu,
  /motionAnimateParam\('dropdown\.menu\.expand'\)[\s\S]*motionAnimateParam\('dropdown\.menu\.collapse'/,
  'the menu must use the interaction-registry motion pair');
assert.doesNotMatch(moreMenu, /@State private expandedHeight: number = ACTION_HEIGHT/,
  'the old content-only animation must not return');

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
  /async removeMany\(targets: BookshelfRemovalTarget\[\]\)[\s\S]*this\.bookshelf\.removeBooks\(targets\)[\s\S]*receipt\.removedTargets\.length[\s\S]*shelf: await this\.load\(\)/,
  'batch removal must use one atomic Core batch then perform one coherent shelf reload');

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

assert.match(shelf, /this\.filterRowVisible\s*\?\s*this\.canonicalFilterActiveAsset\(\)/,
  'active filter must switch to the canonical active resource');
const listProgressBody = shelf.match(/private listProgressLabel\(book: ShelfBook\): string \{([\s\S]*?)\n  \}/);
assert.ok(listProgressBody);
assert.doesNotMatch(listProgressBody[1], /unreadCount/,
  'list reading progress must not be replaced by unread chapter count');
assert.match(importDialog, /\.height\(this\.resultPanelHeight\(\)\)/,
  'import result panel must size from its actual batch');
assert.match(importDialog, /private resultItemsPanelHeight\(\): number/,
  'long import results must use a bounded scroll region');
assert.match(importDialog, /\.borderRadius\(14\)[\s\S]*?\.onClick\(\(\): void => this\.onSelectFiles\(\)\)/,
  'the illustrated file drop zone must open the system picker');
assert.match(index, /async beginImport\(\): Promise<void>/);
assert.match(index, /const selections = await gateway\.selectLocalBookInputs\(\);[\s\S]*?writeImportPresentation\(new LocalImportPresentation\('importing'\)\)/,
  'importing must begin only after the picker returns selected inputs');
assert.match(index, /this\.route = 'bookshelfManagement';[\s\S]*?getBookshelfManagementOrchestrator\(\)\.open\(\)/,
  'bookshelf management must be a reachable route');

console.log('bookshelf view and directory footer contracts: PASS');

assert.doesNotMatch(actionSheet, /编辑分组|onEditGroup/, 'group editing is deferred and must not be exposed');
assert.match(actionSheet, /const BOOK_ACTION_SHEET_HEIGHT = 224;/);
