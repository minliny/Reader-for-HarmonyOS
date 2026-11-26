import {selectContractCases, recordContractCasePass} from './lib/contract-case-selection.mjs';
const definitions = {"intro-measurement-receipts": {"description": "实际简介测量凭据/宽度字体失效和旧book卸载拒绝", "resources": []}};
for (const id of selectContractCases(definitions)) {
  await runSelectedCase(id);
  recordContractCasePass(id);
}
async function runSelectedCase(selectedCase) {
const {default: assert} = await import('node:assert/strict');
const {localBookDetailSdk} = await import('./lib/local-book-detail-sdk-probe.mjs');
const {ReaderWindowMetricsSnapshot, ReaderRectVp} = await import('../entry/src/main/ets/ui/foundation/ReaderWindowMetrics.ts');


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
      return {width: 500, height: options.maxLines === 10000 ? receipt.full : receipt.folded};
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
  const foldedLines = kind === 'manga' ? 3 : 4;
  const cardInset = 26;
  const expandLabel = kind === 'manga' ? '展开' : '展开全部';
  const short = fixture(kind); await measure(short);
  assert.equal(short.owner.introMeasured, true);
  assert.equal(short.owner.introOverflow, false);
  assert.equal(short.calls.length, 2);
  const [full, folded] = short.calls;
  assert.equal(full.constraintWidth,(short.owner.contentFrame().width - cardInset)+'vp');


  assert.equal(full.fontWeight, 400); assert.equal(full.wordBreak, 'WordBreak.BREAK_WORD');
  assert.deepEqual({...full, maxLines: foldedLines}, folded, 'only the actual line limit differs between the two platform layouts');
  assert.equal(full.maxLines, 10000);
  short.owner.initialRender();
  const nodes = [...short.owner.nodes.values()];
  const synopsis = nodes.find(node => node.type === 'Text' && node.create === short.owner.book.intro);
  assert.equal(synopsis.maxLines,foldedLines);assert.equal(parseFloat(full.fontSize),synopsis.fontSize,'measurement uses actual native text font size');assert.equal(full.fontFamily,synopsis.fontFamily);
  assert.equal(parseFloat(full.lineHeight),parseFloat(synopsis.lineHeight),'measurement and actual native line box agree');
  assert.equal(synopsis.wordBreak, full.wordBreak);
  assert.ok(!nodes.some(node => node.create === expandLabel || node.create === '收起'),
    'a complete short synopsis has no action that cannot change its contents');
  assert.ok(!nodes.some(node => node.linearGradient && node.height === 20), 'short text does not fade');
  short.owner.measureIntro(); await tick(); assert.equal(short.calls.length, 2,
    'identical publications reuse the same finite measurement receipt');

  const long = fixture(kind, '平台报告实际超过折叠行数的简介', {full: 144, folded: foldedLines * 24});
  await measure(long); long.owner.initialRender();
  assert.equal(long.owner.introOverflow, true);
  const longNodes = [...long.owner.nodes.values()];
  assert.ok(longNodes.some(node => node.create === expandLabel));
  const toggleTarget = longNodes.find(node => node.type === 'Button' && node.onClick &&
    (kind === 'manga' ? node.margin?.top === 4 : node.id === 'reader-detail-summary-toggle'));
  assert.ok(longNodes.some(node => node.type === 'Column' && node.borderRadius === 14 && node.padding === 12 && node.border?.width === 1));
  if (kind === 'text') {
    assert.ok(longNodes.some(node => node.linearGradient && node.height === 20 && node.hitTestBehavior === 'HitTestMode.None'));
    const fade = longNodes.find(node => node.type === 'Column' && node.linearGradient && node.position?.y < 0);
    assert.equal(fade.width, long.owner.liveWidth(), 'the dock backing fades across the whole page width');
    assert.equal(fade.position.x, -long.owner.geometry.footer.insetLeft);
    assert.equal(fade.hitTestBehavior, 'HitTestMode.None');
  }
  assert.ok(toggleTarget); toggleTarget.onClick(); long.sdk.properties.flush();
  assert.equal(long.owner.introExpanded, true);
  const body = [...long.owner.nodes.values()].find(node => node.create === long.owner.book.intro);
  assert.equal(body.maxLines, 10000, 'the actual Text actor receives the expanded line limit');
  toggleTarget.onClick(); long.sdk.properties.flush(); assert.equal(body.maxLines, foldedLines);

  long.owner.introExpanded = true;
  long.receipt.full = 72; long.receipt.folded = 72;
  long.owner.book = {...long.owner.book, intro: '替换后完整可见的简介'};
  await measure(long);
  assert.equal(long.owner.introExpanded, false); assert.equal(long.owner.introOverflow, false,
    'same-book synopsis replacement invalidates the old overflow fact');

  const empty = fixture(kind, '   '); await measure(empty); empty.owner.initialRender();
  assert.equal(empty.calls.length, 0); assert.equal(empty.owner.introOverflow, false);
  assert.ok([...empty.owner.nodes.values()].some(node => node.create === '暂无简介'));
  assert.ok(![...empty.owner.nodes.values()].some(node => node.create === expandLabel));

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
  assert.ok(value.calls.at(-1).fontSize.endsWith('fp'),'font scale remains platform-owned fp');
  value.owner.viewportWidth = 320; value.owner.onMangaGeometryChanged(); await tick();
  assert.equal(value.calls.at(-1).constraintWidth,(value.owner.contentFrame().width-26)+'vp');
}
{
  const value = fixture('manga'); value.owner.mangaFontsReady = false;
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
  value.owner.measureIntro(); value.owner.initialRender();
  const oldText = [...value.owner.nodes.values()].find(node => node.create === value.owner.book.intro);
  const oldSize = oldText.onAreaChange;
  const replacement = {...value.owner.book, bookId: 'replacement', intro: '新的短简介'};
  value.receipt.full = 48; value.receipt.folded = 48;
  value.owner.book = replacement; await tick();
  const callsAfterReplacement = value.calls.length;
  oldSize({}, {width: 123}); await tick();
  assert.equal(value.calls.length, callsAfterReplacement, 'a retired area of the old native body cannot replace the measured width');
  assert.equal(value.owner.introOverflow, false);
  assert.equal(value.calls.at(-1).textContent, '新的短简介');
}
{
  const value = fixture('manga', '卸载后不应发布的简介', {full: 120, folded: 72});
  value.owner.measureIntro(); value.owner.initialRender();
  const body = [...value.owner.nodes.values()].find(node => node.create === value.owner.book.intro);
  const callsBeforeDetach = value.calls.length;
  value.owner.aboutToDisappear();
  body.onAreaChange({}, {width: 123}); await tick();
  assert.equal(value.calls.length, callsBeforeDetach, 'a stale native Area cannot measure after detach');
}

}
