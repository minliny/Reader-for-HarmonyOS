import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (relative) => readFileSync(new URL(`../${relative}`, import.meta.url), 'utf8');
const tabs = read('entry/src/main/ets/features/shell/MainTabBar.ets');
const shelf = read('entry/src/main/ets/features/bookshelf/BookshelfPage.ets');
const search = read('entry/src/main/ets/features/search/SearchPage.ets');
const detail = read('entry/src/main/ets/features/bookshelf/LocalBookDetail.ets');
const switchWindow = read('entry/src/main/ets/features/source/SourceSwitchWindow.ets');
const quickDirectory = read('entry/src/main/ets/features/reading/ReaderDirectoryModulePanel.ets');

assert.match(tabs, /constraintSize\(\{ maxWidth: 362 \}\)/,
  'Phone main tabs must keep the canonical 362vp width');
assert.match(tabs, /private verticalRail\(\)[\s\S]*Column\(\{ space: 6 \}\)[\s\S]*\.height\(266\)/,
  'Tablet main tabs must keep the canonical 82x266 geometry');
assert.match(tabs, /private railTabItem[\s\S]*\.width\(66\)[\s\S]*\.height\(58\)/,
  'Tablet tab items must keep the canonical 66x58 geometry');
assert.equal((tabs.match(/\.fontFamily\('ReaderNotoSansSC'\)/g) ?? []).length, 2,
  'both shared tab labels must use the Figma Noto Sans SC role');
assert.match(shelf, /private tabletNavigation\(\)[\s\S]*\.width\(82\)\s*\.height\(266\)/,
  'Bookshelf tablet rail must match the shared Figma height');

assert.match(search, /TextInput\([\s\S]*?\.height\(this\.isTablet \? 40 : 36\)\s*\.padding\(0\)[\s\S]*?\.lineHeight\(21\)/,
  'search text must use the full field height without ArkUI internal clipping');
assert.equal((search.match(/LoadingProgress\(\)/g) ?? []).length, 2,
  'both search loading affordances must be animated progress indicators');
assert.doesNotMatch(search, /importing_spinner_(track|arc)/,
  'search must not present a static spinner as active work');

assert.match(detail, /private readingActionLabel\(\): string \{[\s\S]*return this\.inBookshelf \? '继续阅读' : '开始阅读';/,
  'a search preview must say start reading until it joins the shelf');
assert.equal((detail.match(/this\.readingActionLabel\(\)/g) ?? []).length, 2,
  'visible and accessibility labels must share one shelf-aware action label');

assert.match(shelf, /return \/\^\(https\?:\\\/\\\/\|data:image/,
  'bookshelf cards must admit the same remote cover URLs as detail');

assert.match(switchWindow, /private loadingBody[\s\S]*LoadingProgress\(\)[\s\S]*enableLoading\(true\)/,
  'source-switch loading must render one animated indicator');
assert.doesNotMatch(switchWindow, /importing_spinner_(track|arc)/,
  'source-switch loading must not stack two spinner circles');

assert.match(quickDirectory,
  /virtualScroll\(\{ totalCount: this\.projectedEntries\.length, reusable: false \}\)/,
  'the quick directory must not recycle a small visible row pool across a long TOC');
assert.doesNotMatch(quickDirectory, /virtualScroll\(\{ reusable: true \}\)/,
  'the phone runtime regression must not be reintroduced');

console.log('reader reported feedback regressions: PASS');
