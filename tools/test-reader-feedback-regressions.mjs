import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (relative) => readFileSync(new URL(`../${relative}`, import.meta.url), 'utf8');
const tabs = read('entry/src/main/ets/features/shell/MainTabBar.ets');
const shelf = read('entry/src/main/ets/features/bookshelf/BookshelfPage.ets');
const search = read('entry/src/main/ets/features/search/SearchPage.ets');
const searchField = read('entry/src/main/ets/features/common/ReaderSearchField.ets');
const detail = read('entry/src/main/ets/features/bookshelf/LocalBookDetail.ets');
const switchWindow = read('entry/src/main/ets/features/source/SourceSwitchWindow.ets');
const discover = read('entry/src/main/ets/features/discover/DiscoverPage.ets');
const rss = read('entry/src/main/ets/features/rss/RssPage.ets');

assert.match(tabs,
  /private bottomBarFrame\(\): SurfaceHorizontalFrame[\s\S]*new SurfaceWidthSpec\(360, 15, 15, 'center'\)/,
  'Phone main tabs must preserve the canonical 360vp cap and 15vp edge gaps');
assert.match(tabs, /private verticalRail\(\)[\s\S]*Column\(\{ space: 6 \}\)[\s\S]*\.height\(332\)/,
  'Tablet main tabs must keep the canonical 82x332 geometry');
assert.match(tabs, /private railTabItem[\s\S]*\.width\(66\)[\s\S]*\.height\(58\)/,
  'Tablet tab items must keep the canonical 66x58 geometry');
assert.equal((tabs.match(/\.fontFamily\(TYPE_MAIN_TAB_LABEL\.fontFamily\)/g) ?? []).length, 2,
  'both shared tab labels must consume one semantic role');
assert.match(shelf, /private tabletNavigation\(\)[\s\S]*\.width\(82\)\s*\.height\(332\)/,
  'Bookshelf tablet rail must match the shared Figma height');

assert.match(search, /ReaderSearchField\(\{[\s\S]*variant: 'bookPage'[\s\S]*mode: 'submit'/,
  'book search must use the shared field with its explicit page variant');
assert.match(searchField, /private fixedLineHeightField\(\)[\s\S]*?\.height\(this\.inputHeight\(\)\)\s*\.padding\(0\)[\s\S]*?\.lineHeight\(TYPE_SEARCH_BOOK_INPUT\.lineHeightFp as number\)/,
  'search text must use the full field height without ArkUI internal clipping');
assert.match(searchField, /\.enterKeyType\(EnterKeyType\.Search\)\s*\.onSubmit\(\(_enterKey: EnterKeyType\): void => this\.submit\(\)\)/,
  'the IME search action must use the same search submission path as the button');
assert.match(search,
  /private canSubmit\(\): boolean \{[\s\S]*return scope === undefined \|\| scope\.length > 0;/,
  'the default all-source scope must keep the search action enabled before the first search');
assert.match(search,
  /\.backgroundColor\(TOK_GREEN\)\s*\.opacity\(this\.canSubmit\(\) \? 1 : 0\.4\)[\s\S]*?if \(this\.isSweeping\(\)\)[\s\S]*this\.onStop\(\);[\s\S]*this\.submitSearch\(\);/,
  'the search action must stay dark and switch from submit to stop during a live sweep');
assert.doesNotMatch(search, /SEARCH_BTN_BG/,
  'the initial search action must not fall back to the misleading pale disabled treatment');
assert.equal((search.match(/LoadingProgress\(\)/g) ?? []).length, 2,
  'search loading affordances must share one mounted indicator per active surface without duplicate loading nodes');
assert.doesNotMatch(search, /importing_spinner_(track|arc)/,
  'search must not present a static spinner as active work');

assert.match(detail, /private readingActionLabel\(\): string \{[\s\S]*return this\.inBookshelf \? '继续阅读' : '开始阅读';/,
  'a search preview must say start reading until it joins the shelf');
assert.equal((detail.match(/this\.readingActionLabel\(\)/g) ?? []).length, 2,
  'visible and accessibility labels must share one shelf-aware action label');

assert.match(shelf, /return \/\^\(https\?:\\\/\\\/\|data:image/,
  'bookshelf cards must admit the same remote cover URLs as detail');
assert.equal((shelf.match(/\.padding\(\{ top: TOK_SPACE_XS, bottom: TOK_SPACE_MD \}\)/g) ?? []).length, 1,
  'the shared lazy Phone and Tablet shelf must end at the last book plus one bounded spacing token');
assert.doesNotMatch(shelf, /bottom: (628|744)/,
  'bookshelf scrolling must not include fixed-canvas blank space below the last book');
assert.equal((shelf.match(/this\.bookshelfList\((false|true)\)/g) ?? []).length, 2,
  'Phone and Tablet must both use the same top-origin lazy shelf viewport');
assert.match(shelf,
  /private phoneContentFrame\(\): SurfaceHorizontalFrame[\s\S]*new SurfaceWidthSpec\(TOK_CONTENT_MAX_W_PHONE, TOK_SCREEN_INSET, TOK_SCREEN_INSET\)/,
  'phone shelf width must be derived from the shared live safe frame');
assert.match(shelf,
  /private projectionBookTranslateX[\s\S]*this\.bookRowSpace\(this\.shelfContentWidth\(isTablet\), isTablet\)/,
  'the persistent three-column shelf projection must shrink its gap or cards on a narrow physical screen');
assert.match(discover, /private discoverContent\(\)[\s\S]*\.width\('100%'\)\s*\.constraintSize\(\{ maxWidth: this\.contentFrame\(\)\.width \}\)/,
  'Discover content must fill a narrow viewport and only cap its width on larger screens');
assert.match(rss,
  /private contentFrame\(\): SurfaceHorizontalFrame[\s\S]*readerVisualSafeLeft\(metrics\) - railWidth[\s\S]*new SurfaceWidthSpec\(TOK_CONTENT_RAIL_W_TABLET, TOK_SCREEN_INSET, TOK_SCREEN_INSET\)/,
  'RSS content width must be bounded by the live viewport after horizontal insets');

assert.match(switchWindow, /private loadingBody[\s\S]*LoadingProgress\(\)[\s\S]*enableLoading\(true\)/,
  'source-switch loading must render one animated indicator');
assert.doesNotMatch(switchWindow, /importing_spinner_(track|arc)/,
  'source-switch loading must not stack two spinner circles');

// The quick directory's List frame moved into the shared ReaderDirectoryList;
// the no-recycle policy is asserted there.
const directoryList = read('entry/src/main/ets/features/reading/ReaderDirectoryList.ets');
assert.match(directoryList,
  /LazyForEach\(this\.dataSource/,
  'the quick directory must not recycle a small visible row pool across a long TOC');
assert.doesNotMatch(directoryList, /virtualScroll\(\{ reusable: true \}\)/,
  'the phone runtime regression must not be reintroduced');

console.log('reader reported feedback regressions: PASS');
