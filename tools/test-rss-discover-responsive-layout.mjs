import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createReaderBuilderProbe } from './lib/reader-control-builder-probe.mjs';
import { boundedMembers } from './lib/bounded-surface-sdk-probe.mjs';
import { foundationControls } from './lib/reader-foundation-control-probe.mjs';
import { ReaderWindowMetricsSnapshot, ReaderRectVp, ReaderInsetsVp, readerVisualSafeLeft, readerVisualSafeRight } from '../entry/src/main/ets/features/common/ReaderWindowMetrics.ts';
import { SurfaceWidthSpec, resolveHorizontalFrame } from '../entry/src/main/ets/features/common/SurfaceHorizontalGeometry.ts';
import { actualReaderPageShell } from './lib/reader-page-shell-runtime-probe.mjs';

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

assert.match(rss, /private numericAreaLength\(value: Length\): number \{[\s\S]*typeof value === 'string'[\s\S]*Number\.parseFloat\(value\)/,
  'RSS main host must accept the vp string form returned by physical-device Area');
const area = actualReaderPageShell();
assert.equal(area.readerPageAreaLength('365vp'), 365, 'shared secondary host parses physical vp Area lengths');
assert.equal(area.readerPageAreaLength(365), 365);
assert.ok(Number.isNaN(area.readerPageAreaLength('invalid')));

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

for (const [name, page, variant] of [['RSS source feed', sourceFeed, 'rssFeed'], ['RSS entry detail', entryDetail, 'rssDetail'], ['RSS management', management, 'rssManagement']]) {
  assert.match(page, new RegExp(`ReaderStandardPage\\(\\{[\\s\\S]*variant: '${variant}'`), `${name} delegates actual continuous-width geometry`);
  assert.doesNotMatch(page, /RSS_CHILD_WIDE_BREAKPOINT/, `${name} must not select width from physical-device breakpoints`);
}

// Execute the production shared host, not a private-page shape stub. Its
// measured width must replace the larger physical window, including vp strings.
const controls = foundationControls();
let metrics = new ReaderWindowMetricsSnapshot(new ReaderRectVp(0, 0, 1280, 800));
const standard = read('entry/src/main/ets/features/common/ReaderStandardPage.ets');
const { Component } = createReaderBuilderProbe(standard, boundedMembers(standard), {
  ...controls.dependencies, ReaderWindowCoordinator: { metrics: () => metrics },
}, controls.hooks);
const allNodes = owner => [...(owner.nodes?.values() ?? []), ...[...(owner.children?.values() ?? [])].flatMap(allNodes)];
for (const variant of ['rssFeed', 'rssDetail', 'rssManagement']) {
  const owner = new Component(undefined, { variant, content() {}, header() {}, footer() {}, overlay() {} });
  owner.initialRender();
  const viewport = allNodes(owner).find(node => node.type === 'Scroll');
  const body = allNodes(owner).find(node => node.type === 'Column' && node.padding?.top === 66);
  const measuredHost = allNodes(owner).find(node => node.type === '__Common__' && node.onAreaChange);
  assert.ok(viewport && body && measuredHost, `${variant}: actual SDK emits public Scroll/frame measurement`);
  assert.equal(viewport.width, '100%'); assert.equal(viewport.height, '100%');
  assert.equal(viewport.padding?.top, undefined, 'scroll viewport is never narrowed by header clearance');
  for (const [width, left, right] of [[365, 0, 0], [390, 32, 24], [1280, 48, 32]]) {
    metrics = new ReaderWindowMetricsSnapshot(new ReaderRectVp(0, 0, 1280, 800), undefined, new ReaderInsetsVp(left, 0, right, 24));
    measuredHost.onAreaChange({}, { width: `${width}vp` }); owner.replay();
    const expected = resolveHorizontalFrame(width, readerVisualSafeLeft(metrics), readerVisualSafeRight(metrics), new SurfaceWidthSpec(720, 19, 19));
    assert.equal(body.padding.left, expected.left, `${variant}: measured vp width honors asymmetric safe left`);
    assert.equal(body.padding.right, expected.right, `${variant}: measured vp width honors asymmetric safe right`);
    assert.equal(width - body.padding.left - body.padding.right, expected.width, `${variant}: one continuous 720vp maximum`);
    assert.equal(allNodes(owner).find(node => node.type === 'Scroll'), viewport, 'measurement retains native scroll actor');
    measuredHost.onAreaChange({}, { width: 'invalid' }); owner.replay();
    assert.deepEqual([body.padding.left, body.padding.right], [expected.left, expected.right], 'invalid Area cannot replace the last admitted width');
  }
}

console.log('RSS and Discover responsive layout regressions: PASS');
