import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { MANGA_DIRECTORY_VISUAL as visual } from '../entry/src/main/ets/features/manga/MangaDirectoryVisual.ts';

const read = (relative) => readFileSync(new URL(`../${relative}`, import.meta.url), 'utf8');
const tokens = read('entry/src/main/ets/features/common/ReaderTokens.ets');
const shelf = read('entry/src/main/ets/features/bookshelf/BookshelfPage.ets');
const detail = read('entry/src/main/ets/features/bookshelf/LocalBookDetail.ets');

assert.match(tokens, /TOK_SCREEN_INSET = 19;/,
  'Figma phone content must retain the measured 19vp screen inset');
assert.match(tokens, /TOK_CONTENT_MAX_W_PHONE = 352;/,
  'Figma 390vp phone content must retain its 352vp maximum width');

assert.match(shelf, /@State private viewportWidth: number = 0;/,
  'bookshelf must observe the width of its real viewport');
assert.match(shelf, /const width = this\.numericAreaLength\(newValue\.width\);/,
  'bookshelf must use the live viewport width');
assert.match(shelf, /private numericAreaLength\(value: Length\): number \{[\s\S]*typeof value === 'string'[\s\S]*Number\.parseFloat\(value\)/,
  'bookshelf must accept the vp string form returned by physical-device Area');
assert.match(shelf,
  /private phoneContentFrame\(\): SurfaceHorizontalFrame \{[\s\S]*new SurfaceWidthSpec\(TOK_CONTENT_MAX_W_PHONE, TOK_SCREEN_INSET, TOK_SCREEN_INSET\)/,
  'bookshelf content must resolve the 352vp cap and 19vp design gaps through shared geometry');
assert.match(shelf, /private bookshelfList\(isTablet: boolean\)[\s\S]*List\(\{ space: TOK_SPACE_CONTROL_INLINE, scroller: this\.shelfScroller \}\)[\s\S]*\.height\('100%'\)/,
  'the lazy shelf list must occupy the viewport and stay top-aligned');
assert.equal((shelf.match(/LazyForEach\(this\.rowDataSource/g) ?? []).length, 1,
  'both projections must share one lazily materialized stable row tree');
assert.match(shelf,
  /private phoneContent\(\)[\s\S]*\.padding\(\{ left: this\.phoneContentFrame\(\)\.left, right: this\.phoneContentFrame\(\)\.right \}\)/,
  'phone books must preserve the Figma gaps while honoring asymmetric safe edges');
const continueCardStart = shelf.indexOf('private continueReadingCard(');
assert.ok(continueCardStart >= 0, 'the production continue-reading Builder must exist');
const continueCard = shelf.slice(continueCardStart, shelf.indexOf('\n  @Builder', continueCardStart));
assert.match(continueCard, /bookProvider: \(\) => ShelfBook \| undefined, isTablet: boolean/,
  'the retained continue-reading card must consume the live book provider');
assert.match(continueCard, /\.width\(this\.shelfContentWidth\(isTablet\)\)/,
  'the continue-reading card must consume the reactive shelf width instead of a frozen Builder argument');
assert.match(shelf,
  /private projectionBookTranslateX[\s\S]*this\.bookRowSpace\(this\.shelfContentWidth\(isTablet\), isTablet\)/,
  'the persistent three-column projection must consume the reactive measured content width');
assert.match(shelf,
  /private projectionBookCard[\s\S]*\.width\(this\.projectionBookWidth\(isTablet, index\)\)/,
  'persistent book actors must not retain the 352vp first-layout fallback after a physical Area update');
assert.match(shelf, /return Math\.min\(30,[\s\S]*Math\.max\(TOK_SPACE_XS,/,
  'the adaptive shelf grid must retain the Figma 30vp gap as its maximum');

assert.match(detail, /@State private viewportWidth: number = 0;/,
  'book detail must observe its physical viewport');
function checkDetailBranches(candidate) {
  const content = candidate.slice(candidate.indexOf('private contentFrame('), candidate.indexOf('private dockFrame('));
  const dock = candidate.slice(candidate.indexOf('private dockFrame('), candidate.indexOf('private liveWidth('));
  assert.match(content,
    /new SurfaceWidthSpec\(this\.book\.contentKind === 'manga' \? visual\.contentWidthMax : 720, 20, 20, 'center'\)/,
    'novel detail preserves its 720vp Figma cap while only manga consumes the generated demo cap');
  assert.match(dock,
    /new SurfaceWidthSpec\(this\.book\.contentKind === 'manga' \? visual\.contentWidthMax - 2 \* \(visual\.detailDockInset - visual\.contentPaddingX\) : 680,\s*this\.book\.contentKind === 'manga' \? visual\.detailDockInset : 30, this\.book\.contentKind === 'manga' \? visual\.detailDockInset : 30, 'center'\)/,
    'novel dock preserves its 680vp cap and independent 30vp safe gaps; manga alone follows its demo dock geometry');
  assert.match(candidate, /Text\(this\.shelfActionLabel\(\)\)\.width\(this\.book\.contentKind === 'manga' \? visual\.detailSecondaryWidth : 94\)/,
    'the novel secondary action retains 94vp independently of manga shared visual values');
}
checkDetailBranches(detail);
assert.equal(visual.contentWidthMax, 540, 'the manga branch is bound to its own 540px demo, not the novel Figma cap');
assert.equal(visual.detailDockInset, 30);
assert.equal(visual.detailSecondaryWidth, 94);
for (const [label, candidate] of [
  ['manga cap leaks into novel', detail.replace('visual.contentWidthMax : 720', 'visual.contentWidthMax : 540')],
  ['novel dock cap is changed', detail.replace('visual.contentPaddingX) : 680', 'visual.contentPaddingX) : 520')],
  ['novel secondary width is changed', detail.replace('visual.detailSecondaryWidth : 94', 'visual.detailSecondaryWidth : 95')],
]) {
  assert.notEqual(candidate, detail, label);
  assert.throws(() => checkDetailBranches(candidate), assert.AssertionError, `reject ${label}`);
}
assert.match(detail, /onAreaChange\([\s\S]*const width = Number\(area\.width\)/,
  'book detail must consume the live physical Area width');

console.log('physical phone Figma layout regressions: PASS');
