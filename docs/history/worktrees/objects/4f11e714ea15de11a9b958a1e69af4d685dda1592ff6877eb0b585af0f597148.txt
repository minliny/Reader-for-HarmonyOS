import assert from 'node:assert/strict';
import {localBookDetailSdk} from './lib/local-book-detail-sdk-probe.mjs';
import {ReaderWindowMetricsSnapshot, ReaderRectVp} from '../entry/src/main/ets/features/common/ReaderWindowMetrics.ts';

const tick = () => new Promise(done => setImmediate(done));
// These are explicit platform-result seams, not an approximation of glyphs,
// wrapping or native pixels. Native MeasureUtils remains the layout authority.
function fixture(contentKind = 'text', intro = '完整短简介', receipt = {full: 48, folded: 48}) {
  const metrics = new ReaderWindowMetricsSnapshot(new ReaderRectVp(0, 0, 390, 900));
  const calls = [], warnings = [];
  const context = {getFont: () => ({}), px2vp: value => value / 3,
    fp2px: value => value * 3 * metrics.systemFontScale,
    getMeasureUtils: () => ({measureTextSize(options) {
      calls.push({...options});
      if (receipt.error) throw new Error('platform unavailable');
      return {width: 500, height: options.maxLines === 3 ? receipt.folded : receipt.full};
    }})};
  const sdk = localBookDetailSdk({ReaderWindowCoordinator: {metrics: () => metrics},
    uiContext: context, hilog: {warn: (...args) => warnings.push(args)}});
  const owner = sdk.owner;
  Object.assign(owner, {
    book: {sourceId: 'source', bookId: 'book', title: '真实书名', author: '作者', sourceName: '来源', contentKind, intro},
    readerWindowMetricsRevision: 1, viewportWidth: 390, appThemeScheme: 'day',
    toc: [], removalEnabled: true, removing: false, inBookshelf: false, shelfMessage: '',
    loadingMessage: '', onContinue() {}, onBack() {}});
  // Parent Props precede the mounted/checked-font receipt, as in ArkUI.
  Object.assign(owner, {mounted: true, mangaFontsReady: true, mangaFontGeneration: 3,
    mangaFontIdentity: `source\0book\0${contentKind}`});
  return {sdk, owner, metrics, calls, warnings, receipt};
}
async function measure(value) {
  value.owner.measureIntro(); await tick(); value.sdk.properties.flush();
}

for (const kind of ['text', 'manga']) {
  const short = fixture(kind); await measure(short);
  assert.equal(short.owner.introMeasured, true);
  assert.equal(short.owner.introOverflow, false);
  assert.equal(short.calls.length, 2);
  const [full, folded] = short.calls;
  assert.equal(full.constraintWidth, '350vp');
  assert.equal(full.fontSize, '13fp'); assert.equal(full.lineHeight, '24fp');
  assert.equal(full.fontFamily, 'ReaderNotoSansSCUIRegular');
  assert.equal(full.fontWeight, 400); assert.equal(full.wordBreak, 'break-word');
  assert.deepEqual({...full, maxLines: 3}, folded, 'only the actual line limit differs between the two platform layouts');
  assert.equal(full.maxLines, 10000);
  short.owner.initialRender();
  const nodes = [...short.owner.nodes.values()];
  const synopsis = nodes.find(node => node.type === 'Text' && node.create === short.owner.book.intro);
  assert.equal(synopsis.maxLines, 3); assert.equal(synopsis.fontSize, 13);
  assert.equal(synopsis.lineHeight, 24); assert.equal(synopsis.halfLeading, false);
  assert.equal(synopsis.wordBreak, full.wordBreak);
  assert.ok(!nodes.some(node => node.create === '展开' || node.create === '收起'),
    'a complete short synopsis has no action that cannot change its contents');
  const placeholder = nodes.find(node => node.type === 'Stack' && node.width === 112 && node.height === 112 * 122 / 84);
  assert.ok(placeholder, 'both missing-cover branches retain the same proportional hero slot');
  assert.ok(nodes.some(node => node.create === (kind === 'manga' ? 'MANGA / READER' : 'BOOK / READER')));
  if (kind === 'text') assert.ok(!nodes.some(node => node.create === '漫画' || node.create === '上次读到'),
    'the novel placeholder and shared skin cannot acquire manga metadata');
  short.owner.measureIntro(); await tick(); assert.equal(short.calls.length, 2,
    'identical publications reuse the same finite measurement receipt');

  const long = fixture(kind, '平台报告实际超过三行的简介', {full: 120, folded: 72});
  await measure(long); long.owner.initialRender();
  assert.equal(long.owner.introOverflow, true);
  const toggle = [...long.owner.nodes.values()].find(node => node.type === 'Row' && node.onClick && node.constraintSize?.minHeight === 36 && node.flexShrink === 0);
  assert.ok([...long.owner.nodes.values()].some(node => node.create === '展开'));
  const toggleTarget = [...long.owner.nodes.values()].find(node => node.type === 'Row' && node.onClick && node.margin?.top === 4);
  assert.ok(toggleTarget); toggleTarget.onClick(); long.sdk.properties.flush();
  assert.equal(long.owner.introExpanded, true);
  const body = [...long.owner.nodes.values()].find(node => node.create === long.owner.book.intro);
  assert.equal(body.maxLines, 10000, 'the actual Text actor receives the expanded line limit');
  toggleTarget.onClick(); long.sdk.properties.flush(); assert.equal(body.maxLines, 3);
  assert.ok(toggle, 'the existing complete-directory action remains independent of synopsis folding');

  long.owner.introExpanded = true;
  long.receipt.full = 72; long.receipt.folded = 72;
  long.owner.book = {...long.owner.book, intro: '替换后完整可见的简介'};
  await measure(long);
  assert.equal(long.owner.introExpanded, false); assert.equal(long.owner.introOverflow, false,
    'same-book synopsis replacement invalidates the old overflow fact');

  const empty = fixture(kind, '   '); await measure(empty); empty.owner.initialRender();
  assert.equal(empty.calls.length, 0); assert.equal(empty.owner.introOverflow, false);
  assert.ok([...empty.owner.nodes.values()].some(node => node.create === '暂无简介'));
  assert.ok(![...empty.owner.nodes.values()].some(node => node.create === '展开'));

  const failed = fixture(kind, '测量不可用时仍能完整阅读', {error: true});
  await measure(failed); failed.owner.initialRender();
  const fallback = [...failed.owner.nodes.values()].find(node => node.create === failed.owner.book.intro);
  assert.equal(fallback.maxLines, 10000, 'measurement failure keeps the complete synopsis readable');
  assert.equal(failed.owner.introOverflow, false); assert.equal(failed.warnings.length, 1);
}

{
  const value = fixture(); value.owner.initialRender();
  const body = [...value.owner.nodes.values()].find(node => node.create === value.owner.book.intro);
  body.onAreaChange({}, {width: 220}); await tick();
  assert.equal(value.calls.at(-1).constraintWidth, '220vp', 'the measured native body width overrides the planned content frame');
  value.metrics.systemFontScale = 3.2; value.owner.onMangaGeometryChanged(); await tick();
  assert.equal(value.calls.length, 4, 'font/metrics revision invalidates the actual measurement');
  assert.equal(value.calls.at(-1).fontSize, '13fp', 'system font scaling is applied once by the platform');
  value.owner.viewportWidth = 320; value.owner.onMangaGeometryChanged(); await tick();
  assert.equal(value.calls.at(-1).constraintWidth, '280vp');
}
{
  const value = fixture(); value.owner.mangaFontsReady = false;
  value.owner.measureIntro(); await tick(); assert.equal(value.calls.length, 0,
    'a submitted font without its checked receipt must not measure fallback glyphs');
  value.owner.mangaFontsReady = true; await measure(value); assert.equal(value.calls.length, 2);
}
{
  const value = fixture(), early = new value.sdk.Component(undefined, {});
  Object.assign(early, {mounted: true, mangaFontsReady: true});
  early.readerWindowMetricsRevision = 2;
  await tick(); assert.equal(value.calls.length, 0,
    'the actual StorageLink geometry Watch cannot measure before its book Prop exists');
  early.book = value.owner.book;
  await tick(); assert.equal(value.calls.length, 2,
    'the same component can measure normally after the real book and checked fonts arrive');
}
{
  const value = fixture('manga', '即将被替换的长简介', {full: 120, folded: 72});
  value.owner.measureIntro();
  value.owner.book = {...value.owner.book, bookId: 'replacement', intro: '新的短简介'};
  value.receipt.full = 48; value.receipt.folded = 48;
  value.owner.onBookChanged(); await tick();
  assert.equal(value.calls.length, 2, 'a prior queued layout cannot measure or publish for a replacement book');
  assert.equal(value.owner.introOverflow, false);
  assert.equal(value.calls[0].textContent, '新的短简介');
}
{
  const value = fixture('manga', '卸载后不应发布的简介', {full: 120, folded: 72});
  value.owner.measureIntro(); value.owner.aboutToDisappear(); await tick();
  assert.equal(value.calls.length, 0); assert.equal(value.owner.introOverflow, false);
}
{
  const value = fixture();
  value.owner.book = {...value.owner.book, displayCoverUrl: 'https://', coverUrl: 'https://example.invalid/canonical.png'};
  assert.equal(value.owner.displayCover(), 'https://example.invalid/canonical.png');
  value.owner.book = {...value.owner.book, displayCoverUrl: ' https://example.invalid/visible.png '};
  assert.equal(value.owner.displayCover(), 'https://example.invalid/visible.png');
  value.owner.book = {...value.owner.book, displayCoverUrl: 'file://', coverUrl: 'data:image/png;base64,'};
  assert.equal(value.owner.hasCover(), false, 'the shared Host/UI admission rejects empty image locations');
}
console.log('PASS actual detail methods and SDK Text/action bindings with explicit platform measurement seams. Native wrapping and pixels are not simulated.');
