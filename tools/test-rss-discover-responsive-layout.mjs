import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (relative) => readFileSync(new URL(`../${relative}`, import.meta.url), 'utf8');
const discover = read('entry/src/main/ets/features/discover/DiscoverPage.ets');
const rss = read('entry/src/main/ets/features/rss/RssPage.ets');
const sourceFeed = read('entry/src/main/ets/features/rss/RssSourceFeedPage.ets');
const entryDetail = read('entry/src/main/ets/features/rss/RssEntryDetailPage.ets');
const management = read('entry/src/main/ets/features/rss/RssSubscriptionManagementPage.ets');

assert.match(discover, /\.width\('100%'\)\s*\.constraintSize\(\{ maxWidth: this\.contentFrame\(\)\.width \}\)/,
  'Discover must fill the narrow available width and only cap at the Figma maximum');
assert.match(discover,
  /new SurfaceWidthSpec\(TOK_CONTENT_RAIL_W_TABLET, TOK_SCREEN_INSET, TOK_SCREEN_INSET\)/,
  'Discover must preserve the 19vp design gap as a shared role spec');
assert.match(discover,
  /\.padding\(\{ left: this\.contentFrame\(\)\.left, right: this\.contentFrame\(\)\.right \}\)/,
  'Discover must apply asymmetric visual-safe edges from the resolved frame');
assert.doesNotMatch(discover, /\.padding\(\{ left: 18\.99, right: 20\.11 \}\)/,
  'Discover must not retain asymmetric fixed edges on physical phones');
assert.match(discover, /private categoryChips\(\)[\s\S]*Scroll\(\)[\s\S]*\.scrollable\(ScrollDirection\.Horizontal\)/,
  'Discover categories must remain internally scrollable instead of widening the page');

for (const [name, page] of [['RSS', rss], ['RSS source feed', sourceFeed], ['RSS entry detail', entryDetail]]) {
  assert.match(page, /private numericAreaLength\(value: Length\): number \{[\s\S]*typeof value === 'string'[\s\S]*Number\.parseFloat\(value\)/,
    `${name} must accept the vp string form returned by physical-device Area`);
}

assert.match(rss,
  /new SurfaceWidthSpec\(TOK_CONTENT_RAIL_W_TABLET, TOK_SCREEN_INSET, TOK_SCREEN_INSET\)/,
  'RSS main content must shrink inside both the phone viewport and the tablet rail gutter');
assert.match(rss, /readerVisualSafeLeft\(metrics\) - railWidth/,
  'RSS main content must translate the left safe edge into the rail-owned host');
assert.match(rss, /return this\.effectiveViewportWidth\(\) >= RSS_WIDE_BREAKPOINT/,
  'RSS rail selection must use the live width instead of physical isTablet');
assert.match(rss, /\.width\(132\.5625\)\s*\.constraintSize\(\{ maxWidth: this\.refreshMarqueeWidth\(\) \}\)/,
  'RSS top-bar status slot must contract before the control cluster can overflow');
assert.match(rss, /Text\(body\)[\s\S]*\.width\('100%'\)\s*\.constraintSize\(\{ maxWidth: 314 \}\)/,
  'RSS state copy must fit its card before applying the Figma maximum');

for (const [name, page] of [['RSS source feed', sourceFeed], ['RSS entry detail', entryDetail]]) {
  assert.match(page,
    /new SurfaceWidthSpec\(TOK_CONTENT_MAX_W_TABLET, TOK_SCREEN_INSET, TOK_SCREEN_INSET\)/,
    `${name} must use one continuous 720vp role cap`);
  assert.match(page,
    /\.padding\(\{ left: this\.contentFrame\(\)\.left, right: this\.contentFrame\(\)\.right \}\)/,
    `${name} must apply the resolved asymmetric visual-safe edges`);
  assert.doesNotMatch(page, /RSS_CHILD_WIDE_BREAKPOINT/,
    `${name} must not select its width from a physical-device breakpoint`);
}

assert.match(management,
  /\.width\('100%'\)\s*\.constraintSize\(\{ maxWidth: this\.contentFrame\(\)\.width \}\)/,
  'RSS management content must shrink inside its max-width cap');
assert.match(management,
  /new SurfaceWidthSpec\(TOK_CONTENT_MAX_W_TABLET, TOK_SCREEN_INSET, TOK_SCREEN_INSET\)/,
  'RSS management must use one continuous 720vp role cap');
assert.match(management,
  /\.padding\(\{ left: this\.contentFrame\(\)\.left, right: this\.contentFrame\(\)\.right \}\)/,
  'RSS management must apply resolved visual-safe edges');

console.log('RSS and Discover responsive layout regressions: PASS');
