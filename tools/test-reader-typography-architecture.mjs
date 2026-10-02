import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (relative) => readFileSync(new URL(`../${relative}`, import.meta.url), 'utf8');

const families = read('entry/src/main/ets/features/common/ReaderFontFamilies.ts');
const fonts = read('entry/src/main/ets/features/common/ReaderFonts.ets');
const typography = read('entry/src/main/ets/features/common/ReaderTypography.ets');
const searchField = read('entry/src/main/ets/features/common/ReaderSearchField.ets');
const searchPage = read('entry/src/main/ets/features/search/SearchPage.ets');
const sourcePage = read('entry/src/main/ets/features/source/SourceManagementPage.ets');
const directory = read('entry/src/main/ets/features/reading/FullDirectoryPanel.ets');
const quickSearch = read('entry/src/main/ets/features/reading/ReaderQuickSearchPanel.ets');
const rss = read('entry/src/main/ets/features/rss/RssPage.ets');
const appTopBar = read('entry/src/main/ets/features/common/AppTopBar.ets');
const pageBackBar = read('entry/src/main/ets/features/common/PageBackBar.ets');
const sectionHeading = read('entry/src/main/ets/features/common/ReaderSectionHeading.ets');
const mainTabBar = read('entry/src/main/ets/features/shell/MainTabBar.ets');
const readingSurface = read('entry/src/main/ets/features/reading/ReadingSurface.ets');
const readerControlPanel = read('entry/src/main/ets/features/reading/ReaderControlPanel.ets');
const readerSessionCapsule = read('entry/src/main/ets/features/reading/ReaderSessionCapsule.ets');
const readerSessionLaunchStage = read('entry/src/main/ets/features/reading/ReaderSessionLaunchStage.ets');
const shelfBookListDetails = read('entry/src/main/ets/features/bookshelf/ShelfBookListDetails.ets');
const bookshelfPage = read('entry/src/main/ets/features/bookshelf/BookshelfPage.ets');
const entryAbility = read('entry/src/main/ets/entryability/EntryAbility.ets');
const windowCoordinator = read('entry/src/main/ets/app/ReaderWindowCoordinator.ts');

for (const family of [
  'READER_FONT_INTER',
  'READER_FONT_NOTO_SERIF_SC_BOLD',
  'READER_FONT_NOTO_SERIF_SC_REGULAR',
  'READER_FONT_NOTO_SANS_SC',
  'READER_FONT_NOTO_SANS_SC_UI_REGULAR',
  'READER_FONT_LXGW_WENKAI_LITE',
  'READER_FONT_LXGW_WENKAI_GB_LITE',
  'READER_FONT_ZHUQUE_FANGSONG',
  'READER_FONT_SARASA_MONO_SC',
  'READER_FONT_SOURCE_HAN_SERIF',
  'READER_FONT_HARMONYOS_SANS',
]) {
  assert.match(families, new RegExp(`export const ${family}`));
}
assert.match(fonts, /from '\.\/ReaderFontFamilies\.ts'/,
  'font registration and runtime render helpers must share a TS-safe physical-family layer');
for (const rawfile of [
  'LXGWWenKaiGBLite-Regular.ttf',
  'ZhuqueFangsong-Regular.ttf',
  'SarasaMonoSC-Regular.ttf',
]) {
  assert.match(fonts, new RegExp(`\\$rawfile\\('${rawfile.replace('.', '\\.')}'\\)`),
    `${rawfile} must be registered before a Figma font slot is enabled`);
}

assert.match(typography,
  /export class ReaderTextStyle[\s\S]*lineHeightFp: number \| undefined[\s\S]*letterSpacingFp: number \| undefined[\s\S]*scalePolicy: ReaderFontScalePolicy[\s\S]*source: ReaderTypographySource/,
  'a text role must describe the complete typography contract and its evidence');
for (const role of [
  'TYPE_APP_HOME_TITLE',
  'TYPE_PAGE_TITLE',
  'TYPE_SECTION_HEADING',
  'TYPE_MAIN_TAB_LABEL',
  'TYPE_SEARCH_BOOK_INPUT',
  'TYPE_SEARCH_SOURCE_INPUT',
  'TYPE_SEARCH_DIRECTORY_INPUT',
  'TYPE_SEARCH_READER_QUICK_INPUT',
  'TYPE_SEARCH_RSS_HINT',
  'TYPE_READER_CHAPTER_TITLE',
]) {
  assert.match(typography, new RegExp(`export const ${role}`));
}

assert.match(searchField,
  /export type ReaderSearchFieldVariant =[\s\S]*'bookPage'[\s\S]*'sourceManagement'[\s\S]*'readerDirectory'[\s\S]*'readerQuick'[\s\S]*'rssPassive'/);
assert.match(searchField, /export type ReaderSearchFieldMode = 'submit' \| 'live' \| 'passive'/);
assert.match(searchField, /enterKeyType\(EnterKeyType\.Search\)/,
  'all editable variants must inherit the same IME search behavior');
assert.match(searchField, /this\.clearable && this\.text\.length > 0/);

for (const [surface, variant] of [
  [searchPage, 'bookPage'],
  [sourcePage, 'sourceManagement'],
  [directory, 'readerDirectory'],
  [quickSearch, 'readerQuick'],
  [rss, 'rssPassive'],
]) {
  assert.match(surface, new RegExp(`ReaderSearchField\\(\\{[\\s\\S]*variant: '${variant}'`),
    `${variant} must route through the shared search primitive`);
}
assert.match(sourcePage, /variant: 'sourceManagement'[\s\S]*mode: 'live'/);
assert.match(rss, /variant: 'rssPassive'[\s\S]*mode: 'passive'/);
assert.doesNotMatch(directory, /DIRECTORY_SEARCH_(FONT_SIZE|LINE_HEIGHT)/);

assert.match(appTopBar, /TYPE_APP_HOME_TITLE\.fontFamily/);
assert.match(pageBackBar, /TYPE_PAGE_TITLE\.fontFamily/);
assert.match(sectionHeading, /TYPE_SECTION_HEADING\.fontFamily/);
assert.equal((mainTabBar.match(/TYPE_MAIN_TAB_LABEL\.fontFamily/g) ?? []).length, 2);
assert.match(readingSurface, /TYPE_READER_CHAPTER_TITLE\.fontFamily/);
assert.match(readingSurface, /\.fontSize\(this\.appearance\.fontSize\)/,
  'body text must remain driven by Reader Appearance instead of a global UI role');
assert.match(readingSurface, /\.lineHeight\(readerAppearanceLineHeight\(this\.appearance\)\)/);

// Phase 3 typography/theme contracts: compact reading metadata must use an
// explicit shared line box, while retained motion ancestors remain free to
// translate the control tree. Overlay defaults must resolve from the active
// scheme when a parent does not provide an explicit color.
assert.match(typography,
  /TYPE_READER_CONTROL_BOOK_TITLE[\s\S]*READER_FONT_NOTO_SERIF_SC_BOLD, 700, 16, 19\.2, 0/);
assert.match(typography,
  /TYPE_READER_CONTROL_CHAPTER_SOURCE[\s\S]*READER_FONT_NOTO_SERIF_SC_REGULAR, 400, 12, 14\.4, 0/);
assert.match(typography,
  /TYPE_READER_CONTROL_CHAPTER_TITLE[\s\S]*READER_FONT_INTER, 700, 13, 16\.25, 0/);
for (const role of [
  'TYPE_READER_CONTROL_BOOK_TITLE',
  'TYPE_READER_CONTROL_CHAPTER_SOURCE',
  'TYPE_READER_CONTROL_SOURCE_ACTION',
  'TYPE_READER_CONTROL_CHAPTER_TITLE',
]) {
  assert.match(readerControlPanel,
    new RegExp(`${role}\\.lineHeightFp[\\s\\S]*${role}\\.letterSpacingFp`),
    `${role} must carry line-height and letter-spacing through ReaderControlPanel`);
}
assert.match(readerControlPanel, /TYPE_READER_CONTROL_CHAPTER_TITLE\.fontFamily/);

for (const role of [
  'TYPE_SHELF_LIST_TITLE',
  'TYPE_SHELF_LIST_AUTHOR',
  'TYPE_SHELF_LIST_CHAPTER',
  'TYPE_SHELF_LIST_STATUS',
  'TYPE_SHELF_CONTINUE_TITLE',
  'TYPE_SHELF_CONTINUE_AUTHOR',
  'TYPE_SHELF_ACTION',
]) {
  assert.match(typography, new RegExp(`export const ${role}`), `${role} must be a shared shelf role`);
}
for (const role of ['TYPE_SHELF_LIST_TITLE', 'TYPE_SHELF_LIST_AUTHOR', 'TYPE_SHELF_LIST_CHAPTER', 'TYPE_SHELF_LIST_STATUS']) {
  assert.match(shelfBookListDetails, new RegExp(`${role}\\.lineHeightFp[\\s\\S]*${role}\\.letterSpacingFp`),
    `${role} must drive list metadata geometry`);
}
assert.match(bookshelfPage, /TYPE_SHELF_LIST_AUTHOR\.fontFamily[\s\S]*TYPE_SHELF_LIST_AUTHOR\.lineHeightFp/);
assert.match(bookshelfPage, /TYPE_SHELF_LIST_STATUS\.fontFamily[\s\S]*TYPE_SHELF_LIST_STATUS\.lineHeightFp/);
assert.match(bookshelfPage, /TYPE_SHELF_CONTINUE_AUTHOR\.fontFamily[\s\S]*TYPE_SHELF_CONTINUE_AUTHOR\.letterSpacingFp/);
assert.doesNotMatch(shelfBookListDetails, /fontFamily\('ReaderInter'\)|fontFamily\('ReaderNotoSansSCUIRegular'\)/,
  'list metadata must not bypass the shared fixed-family roles');

for (const [surface, roles] of [
  [readerSessionCapsule, ['TOK_READ_SURFACE', 'TOK_LINE', 'TOK_READ_INK', 'TOK_READ_PRIMARY', 'app.control.onPrimary']],
  [readerSessionLaunchStage, ['TOK_READ_SURFACE', 'TOK_LINE', 'TOK_SURFACE_PANEL', 'TOK_LINE_STRONG', 'TOK_READ_INK', 'TOK_READ_PRIMARY', 'app.control.onPrimary']],
]) {
  for (const role of roles) {
    assert.match(surface, new RegExp(`readerAppColor\\('${role.replace(/\\./g, '\\\\.')}', this\\.themeScheme\\)`),
      `${role} must resolve through the active theme scheme`);
  }
}
assert.doesNotMatch(readerSessionCapsule, /@Prop (?:surfaceColor|textColor|primaryColor|onPrimaryColor|surfaceBorderColor): string = TOK_/,
  'ReaderSessionCapsule must not retain day-only token defaults');
assert.doesNotMatch(readerSessionLaunchStage, /@Prop (?:surfaceColor|textColor|primaryColor|onPrimaryColor|sourceSurfaceColor|sourceBorderColor): string = TOK_/,
  'ReaderSessionLaunchStage must not retain day-only token defaults');

assert.match(entryAbility, /onConfigurationUpdate\(newConfig: Configuration\)[\s\S]*ReaderWindowCoordinator\.refreshConfiguration\(\)/);
assert.match(windowCoordinator,
  /static refreshConfiguration\(\): void \{\s*ReaderWindowCoordinator\.refreshMetrics\(\);\s*\}/,
  'system font-scale changes must advance the same metrics revision consumed by pagination');

console.log('reader typography architecture contract: PASS');
