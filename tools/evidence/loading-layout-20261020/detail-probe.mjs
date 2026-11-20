// Explicit issue-local SDK evidence. Native glyph layout and device pixels
// remain outside this probe; MeasureUtils results are supplied at its port.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {localBookDetailSdk, localBookDetailSource} from '../../lib/local-book-detail-sdk-probe.mjs';
import {ReaderWindowMetricsSnapshot, ReaderRectVp} from '../../../entry/src/main/ets/features/common/ReaderWindowMetrics.ts';

const tick = () => new Promise(done => setImmediate(done));
const root = new URL('../../../', import.meta.url);
const previous = execFileSync('git', ['show',
  '33f7c7b21474a76a042ebda911c5f0ff2d73cf54:entry/src/main/ets/features/bookshelf/LocalBookDetail.ets'],
{cwd: root, encoding: 'utf8'});
const introMethod = source => source.slice(source.indexOf('  private measureIntro(): void {'),
  source.indexOf('\n  private lastShelfFeedback:'));
const queuedSource = localBookDetailSource.replace(introMethod(localBookDetailSource), introMethod(previous));
assert.notEqual(queuedSource, localBookDetailSource, 'negative control restores only the pre-fix queued method');

function fixture({kind = 'text', width = 390, scale = 1, text = '平台报告超过三行的完整简介',
  full = 120, folded = 72, error = false, source = localBookDetailSource} = {}) {
  const metrics = new ReaderWindowMetricsSnapshot(new ReaderRectVp(0, 0, width, 900));
  metrics.systemFontScale = scale;
  const receipt = {full, folded, error}, calls = [], warnings = [];
  let hook;
  const context = {getFont: () => ({}), px2vp: value => value / 3,
    fp2px: value => value * 3 * metrics.systemFontScale,
    getMeasureUtils: () => ({measureTextSize(options) {
      calls.push({...options});
      if (hook) { const callback = hook; hook = undefined; callback(); }
      if (receipt.error) throw new Error('explicit native port failure');
      return {width: width * 3, height: options.maxLines === 3 ? receipt.folded : receipt.full};
    }})};
  const sdk = localBookDetailSdk({ReaderWindowCoordinator: {metrics: () => metrics},
    uiContext: context, hilog: {warn: (...args) => warnings.push(args)},
    // No message is emitted in these layout inputs. Keep the current message
    // owner's reset boundary explicit instead of changing the shared helper.
    ReaderTransientFeedback: class { reset() {} show() { throw new Error('unexpected message'); } }}, {source});
  const owner = sdk.owner;
  Object.assign(owner, {
    book: {sourceId: 'source', bookId: 'book', title: '原有书名', author: '作者', sourceName: '来源', contentKind: kind, intro: text},
    readerWindowMetricsRevision: 1, viewportWidth: width, appThemeScheme: 'day',
    toc: [{index: 0, title: '原有章节', navigable: true}],
    removalEnabled: true, removing: false, inBookshelf: true, shelfMessage: '', loadingMessage: '',
    onContinue() {}, onBack() {}});
  Object.assign(owner, {mounted: true, mangaFontsReady: true, mangaFontGeneration: 3,
    mangaFontIdentity: `source\0book\0${kind}`});
  return {sdk, owner, metrics, receipt, calls, warnings, setHook: callback => { hook = callback; }};
}
const body = value => [...value.owner.nodes.values()].find(node =>
  node.type === 'Text' && node.create === value.owner.displayIntro());
const toggle = value => [...value.owner.nodes.values()].find(node => node.onClick &&
  (value.owner.book.contentKind === 'manga' ? node.type === 'Row' && node.margin?.top === 4 :
    node.type === 'Text' && (node.create === '展开' || node.create === '收起')));

function firstFrame(source = localBookDetailSource) {
  const value = fixture({source});
  value.owner.onBookChanged();
  value.owner.initialRender();
  assert.equal(body(value).maxLines, 3, 'first detail frame uses the completed folded receipt');
  assert.ok([...value.owner.nodes.values()].some(node => node.create === '展开'),
    'the existing expansion action is present on that same first frame');
  return value;
}
firstFrame();
assert.throws(() => firstFrame(queuedSource), /first detail frame uses the completed folded receipt/,
  'the actual old Promise method is rejected before its queued result arrives');
await tick();

let count = 0;
for (const kind of ['text', 'manga']) for (const width of [320, 390, 800]) for (const scale of [1, 2]) {
  const value = fixture({kind, width, scale});
  value.owner.onBookChanged();
  assert.equal(value.owner.introMeasured, true, 'book watcher returns with a complete platform receipt');
  assert.equal(value.calls.length, 2);
  value.owner.initialRender();
  const initial = body(value), scroll = [...value.owner.nodes.values()].find(node => node.type === 'Scroll');
  assert.equal(initial.maxLines, 3);
  assert.equal(value.calls[0].constraintWidth, value.owner.contentFrame().width + 'vp');
  assert.equal(parseFloat(value.calls[0].fontSize), initial.fontSize);
  assert.equal(parseFloat(value.calls[0].lineHeight), initial.lineHeight);
  assert.equal(value.calls[0].fontFamily, initial.fontFamily);
  toggle(value).onClick(); value.sdk.properties.flush();
  assert.equal(initial.maxLines, 10000, 'only the existing deliberate expand action expands the long synopsis');
  toggle(value).onClick(); value.sdk.properties.flush(); assert.equal(initial.maxLines, 3);

  const before = value.calls.length;
  value.owner.book = {...value.owner.book, coverUrl: 'https://example.test/cover', sourceName: '补全来源'};
  value.sdk.properties.flush();
  assert.equal(value.calls.length, before, 'unrelated metadata reuses the same synopsis receipt');
  assert.equal(body(value).maxLines, 3);
  assert.equal([...value.owner.nodes.values()].find(node => node.type === 'Scroll'), scroll,
    'same-book metadata preserves the existing native Scroll actor');

  initial.onAreaChange({}, {width: width - 88});
  value.sdk.properties.flush();
  assert.equal(value.calls.at(-1).constraintWidth, width - 88 + 'vp');
  assert.equal(body(value).maxLines, 3, 'actual body-width measurement never exposes an intermediate full synopsis');
  value.metrics.systemFontScale = 1.5;
  value.owner.onMangaGeometryChanged(); value.sdk.properties.flush();
  assert.equal(value.owner.introMeasured, true);
  assert.equal(body(value).maxLines, 3);

  value.receipt.full = value.receipt.folded = 48;
  value.owner.book = {...value.owner.book, intro: '补全后的短简介'};
  value.sdk.properties.flush();
  assert.equal(value.owner.introOverflow, false);
  assert.equal(value.owner.introExpanded, false);
  assert.equal(body(value).maxLines, 3);
  // The helper retains historical node records and does not simulate native
  // branch removal. Above we verify the actual false branch fact; below a
  // fresh SDK build verifies that short content emits no expansion action.
  count++;
}

for (const kind of ['text', 'manga']) {
  const short = fixture({kind, full: 48, folded: 48, text: '完整短简介'});
  short.owner.onBookChanged(); short.owner.initialRender();
  assert.equal(body(short).maxLines, 3);
  assert.ok(![...short.owner.nodes.values()].some(node => node.create === '展开' || node.create === '收起'),
    'short content emits no action that would not reveal more text');
  const empty = fixture({kind, text: ''});
  empty.owner.onBookChanged(); empty.owner.initialRender();
  assert.equal(empty.calls.length, 0); assert.equal(empty.owner.introMeasured, true);
  assert.equal(empty.owner.introOverflow, false);
  assert.ok([...empty.owner.nodes.values()].some(node => node.create === '暂无简介'));

  for (const receipt of [{error: true}, {full: NaN}, {folded: 0}]) {
    const value = fixture({kind, ...receipt});
    value.owner.onBookChanged(); value.owner.initialRender();
    assert.equal(body(value).maxLines, 10000, 'native failure preserves the complete readable fallback');
    assert.equal(value.owner.introOverflow, false); assert.equal(value.warnings.length, 1);
  }
}
{
  const value = fixture({kind: 'manga'}); value.owner.mangaFontsReady = false;
  value.owner.measureIntro(); assert.equal(value.calls.length, 0,
    'submitted manga fonts do not authorize measuring fallback glyphs');
  value.owner.mangaFontsReady = true; value.owner.measureIntro(); assert.equal(value.calls.length, 2);
}
{
  const value = fixture(); value.owner.aboutToDisappear(); value.owner.measureIntro();
  assert.equal(value.calls.length, 0, 'an unmounted detail cannot start or publish measurements');
}
for (const invalidation of ['unmount', 'generation', 'signature']) {
  const value = fixture();
  value.setHook(() => {
    if (invalidation === 'unmount') value.owner.aboutToDisappear();
    if (invalidation === 'generation') value.owner.introMeasurementGeneration++;
    if (invalidation === 'signature') value.owner.introMeasurementSignature = 'replacement';
  });
  value.owner.measureIntro();
  assert.equal(value.owner.introMeasured, false, `${invalidation} invalidation still rejects a stale native receipt`);
  assert.equal(value.owner.introOverflow, false);
}
console.log(`PASS detail loading layout: ${count} text/manga width/font input combinations; same-frame receipts, existing actions, metadata/width updates, failure and stale-owner guards; queued-method negative control rejected`);
