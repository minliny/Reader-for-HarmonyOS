import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

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
assert.match(detail,
  /private contentFrame\(\): SurfaceHorizontalFrame[\s\S]*new SurfaceWidthSpec\(720, 20, 20, 'center'\)/,
  'book detail must share one continuous Figma cap and per-edge safe-frame rule');
assert.match(detail,
  /private dockFrame\(\): SurfaceHorizontalFrame[\s\S]*new SurfaceWidthSpec\(680, 30, 30, 'center'\)/,
  'detail action dock keeps the approved continuous 680vp cap and 30vp safe-frame gaps');
assert.match(detail, /Text\(this\.shelfActionLabel\(\)\)\.width\(94\)/,
  'detail secondary action keeps the compact approved 94vp control width');
assert.match(detail, /onAreaChange\([\s\S]*const width = Number\(area\.width\)/,
  'book detail must consume the live physical Area width');

console.log('physical phone Figma layout regressions: PASS');
