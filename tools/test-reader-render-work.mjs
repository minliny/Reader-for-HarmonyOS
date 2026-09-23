import assert from 'node:assert/strict';
import { productionMotionMethods } from './lib/reader-motion-method-probe.mjs';
import * as marks from '../entry/src/main/ets/features/reading/ReaderDynamicHighlight.ts';
import * as paint from '../entry/src/main/ets/features/reading/ReaderControlMotionPresentation.ts';
import * as geometry from '../entry/src/main/ets/features/reading/ReaderControlSettingsGeometry.ts';
import * as actors from '../entry/src/main/ets/features/reading/ReaderControlActorGeometry.ts';
const source = name => new URL(`../entry/src/main/ets/features/reading/${name}.ets`, import.meta.url);
class Frame { constructor(action) { this.action = action; } }

// Unicode output oracle is independent of the cache's UTF16 scan.
const cache = new marks.ReaderHighlightTextCache();
for (const text of ['汉'.repeat(1000), '甲𠮷🙂乙\r\n尾', '', 'A\ud800B']) {
  const scalars = Array.from(text);
  for (const [start, end] of [[0, 0], [0, 2], [1, 4], [2.2, 4.2], [500, 700], [-3, 9999]]) {
    const actual = cache.sample(text, 10, 10 + scalars.length, 10 + start, 10 + end);
    const active = end > start && end > 0 && start < scalars.length;
    const a = active ? Math.ceil(Math.max(0, start)) : 0;
    const b = active ? Math.ceil(Math.min(scalars.length, end)) : 0;
    assert.equal(actual.prefix, scalars.slice(0, a).join(''));
    assert.equal(actual.body, scalars.slice(a, b).join(''));
    assert.equal(actual.suffix, scalars.slice(b).join(''));
    assert.equal(cache.sample(text, 10, 10 + scalars.length, 10 + start, 10 + end), actual);
  }
}
const Fragment = productionMotionMethods(source('ReadingSurface'), ['scheduleHighlightGeometry', 'measureHighlightGeometry',
  'highlightRange', 'highlightPrefix', 'highlightBody', 'highlightSuffix', 'usesTtsHighlight', 'indentPrefix', 'themeStyle'],
  { ...marks, ReaderHighlightFrame: Frame, graphicsText: { RectWidthStyle: { TIGHT: 1 }, RectHeightStyle: { TIGHT: 1 } },
    readerAppearanceParagraphIndentPrefix: () => '　　', readerAppearanceThemeStyle: () => ({ ink: '#101010' }) });
let scans = 0;
const originalCodePointAt = String.prototype.codePointAt;
const text = '汉'.repeat(1000);
const fragment = Object.assign(new Fragment(), { text, startScalar: 0, endScalar: 1000,
  autoPageHighlightStart: 500, autoPageHighlightEnd: 700, highlightTextCache: new marks.ReaderHighlightTextCache() });
try {
  String.prototype.codePointAt = function (index) { if (String(this) === text) scans++; return originalCodePointAt.call(this, index); };
  let result = '';
  for (const name of ['highlightPrefix', 'highlightBody', 'highlightSuffix']) if (fragment[name]().length) result += fragment[name]();
  assert.equal(result, text); assert.equal(scans, 700, 'all Span evaluations share one bounded Unicode scan');
} finally { String.prototype.codePointAt = originalCodePointAt; }
fragment.ttsHighlightStart = 600; fragment.ttsHighlightEnd = 610;
assert.equal(fragment.highlightBody().length, 10, 'TTS retains priority over auto page');

const Surface = productionMotionMethods(source('ReadingSurface'), ['enqueueHighlightMeasurement', 'acceptHighlightGeometry',
  'usesHighlightCanvas', 'scheduleDynamicHighlights', 'drawDynamicHighlights', 'renderFragments', 'onHighlightContentChanged', 'aboutToDisappear'],
  { ...marks, ReaderHighlightFrame: Frame });
function makePage(number) {
  const queue = [], stats = { scheduled: 0, measured: 0, clears: 0, fills: 0, providerReads: 0, idReads: 0, outputs: [] };
  const context = { postFrameCallback: frame => { stats.scheduled++; queue.push(frame); }, px2vp: n => n };
  const rows = Array.from({ length: number }, (_, i) => ({ get id() { stats.idReads++; return `row-${i}`; } }));
  const page = Object.assign(new Surface(), {
    highlightMounted: true, highlightLifecycle: 1, highlightCanvasReady: true, highlightDrawQueued: false, highlightDraining: false,
    highlightMeasurements: [], highlightRects: new Map(), highlightPainted: [], highlightPaintWidth: -1, highlightPaintHeight: -1,
    highlightPublishedIdentity: '', highlightPublished: [], highlightPublishWidth: -1, highlightPublishHeight: -1,
    highlightLiveRevision: -1, highlightLiveIds: new Set(), highlightRootX: 0, highlightRootY: 0,
    staticSnapshotId: 'snapshot-a', highlightTextureIdentity: 'texture-a', contentRevision: 1,
    layout: { viewportWidth: 400, viewportHeight: 800 }, getUIContext: () => context,
    highlightCanvas: { clearRect: () => stats.clears++, fillRect: () => stats.fills++ },
    fragmentsProvider: () => { stats.providerReads++; return rows; },
    onDynamicHighlights: (identity, rects) => stats.outputs.push({ identity, rects }),
  });
  const children = Array.from({ length: number }, (_, i) => Object.assign(new Fragment(), {
    text: '正文片段', startScalar: i * 4, endScalar: i * 4 + 4, highlightTextCache: new marks.ReaderHighlightTextCache(),
    highlightMounted: true, highlightLifecycle: 1, highlightQueued: false, highlightHadGeometry: false,
    separateHighlight: true, isParagraphStart: false, appearance: { activeTheme: 'paper' },
    highlightGlobalX: 0, highlightGlobalY: i * 20, getUIContext: () => context,
    queueHighlightMeasurement: action => page.enqueueHighlightMeasurement(action),
    onHighlightGeometry: (_key, rects) => page.acceptHighlightGeometry(`row-${i}`, rects),
    textController: { getLayoutManager: () => ({ getRectsForRange: () => {
      stats.measured++; return [{ rect: { left: 0, top: 0, right: 8, bottom: 12 } }];
    } }) },
  }));
  const drain = () => { const pending = queue.splice(0); for (const item of pending) item.action(); assert.equal(queue.length, 0, 'no second paint frame'); };
  return { page, children, stats, queue, drain };
}
const pageCase = makePage(24);
pageCase.page.scheduleDynamicHighlights(); // Canvas ready / content invalidation
for (const child of pageCase.children) { child.scheduleHighlightGeometry(); child.scheduleHighlightGeometry(); }
pageCase.drain();
assert.equal(pageCase.stats.scheduled, 1); assert.equal(pageCase.stats.clears, 1);
assert.equal(pageCase.stats.idReads, 0); assert.equal(pageCase.stats.measured, 0); assert.equal(pageCase.stats.outputs.length, 1);
for (const child of pageCase.children) { child.autoPageHighlightStart = 0; child.autoPageHighlightEnd = 96; child.scheduleHighlightGeometry(); }
assert.equal(pageCase.queue.length, 1); pageCase.drain();
assert.equal(pageCase.stats.measured, 24); assert.equal(pageCase.stats.clears, 2); assert.equal(pageCase.stats.idReads, 24);
assert.equal(pageCase.stats.outputs.at(-1).rects.length, 24);
for (const child of pageCase.children) child.scheduleHighlightGeometry();
pageCase.drain();
assert.equal(pageCase.stats.clears, 2, 'unchanged geometry does not repaint');
assert.equal(pageCase.stats.idReads, 24, 'live fragment identities reused within revision');
assert.equal(pageCase.stats.outputs.length, 2, 'unchanged geometry is not republished');
for (const child of pageCase.children) { child.autoPageHighlightStart = undefined; child.autoPageHighlightEnd = undefined; child.scheduleHighlightGeometry(); }
pageCase.drain();
assert.equal(pageCase.stats.clears, 3); assert.equal(pageCase.stats.outputs.at(-1).rects.length, 0);
for (const child of pageCase.children) child.scheduleHighlightGeometry();
assert.equal(pageCase.queue.length, 0, 'already empty fragments schedule nothing');
pageCase.page.highlightTextureIdentity = 'texture-b'; pageCase.page.onHighlightContentChanged(); pageCase.drain();
assert.equal(pageCase.stats.outputs.at(-1).identity, 'texture-b');
assert.equal(pageCase.stats.clears, 3, 'new identity republishes without erasing identical pixels');
pageCase.page.layout = { viewportWidth: 800, viewportHeight: 400 }; pageCase.page.onHighlightContentChanged(); pageCase.drain();
assert.equal(pageCase.stats.clears, 4, 'resize clears/resubmits at the new normalization');
pageCase.page.scheduleDynamicHighlights(); const beforeDisappear = pageCase.stats.outputs.length;
pageCase.page.aboutToDisappear(); pageCase.drain();
assert.equal(pageCase.stats.outputs.length, beforeDisappear, 'queued work cannot survive owner teardown');

let uploads = 0, accepted = true;
const Session = productionMotionMethods(source('BookTurnPresentationSession'), ['setDynamicHighlights', 'configure', 'onNativeEvent'],
  { ...marks, bookTurnNative: { setDynamicHighlights: () => { uploads++; return accepted; }, configure: () => true },
    BOOK_TURN_EVENT_SURFACE_READY: 1, BOOK_TURN_EVENT_SURFACE_LOST: 5, BOOK_TURN_EVENT_RENDER_FAILURE: 6, BOOK_TURN_EVENT_SLOTS_COMMITTED: 7,
    BookTurnNativeEvent: class { constructor(event) { this.event = event; } } });
const session = Object.assign(new Session(), { componentId: 'surface', highlightIdentity: '', highlightValues: [], eventListener: () => {} });
session.setDynamicHighlights('a', []); session.setDynamicHighlights('a', []); assert.equal(uploads, 1);
for (const event of [1, 5, 6]) { session.onNativeEvent(event, 1, 0); session.setDynamicHighlights('a', []); }
assert.equal(uploads, 4, 'lifecycle events invalidate dedupe');
session.configure(400, 800); session.setDynamicHighlights('a', []); assert.equal(uploads, 5);
accepted = false; session.setDynamicHighlights('b', []); session.setDynamicHighlights('b', []); assert.equal(uploads, 7, 'rejected publication must retry');

let paths = 0, rectangles = 0;
const clipCache = new paint.ReaderControlMotionClipCache(path => { paths++; return { path }; }, () => { rectangles++; return { rect: true }; });
const Settings = productionMotionMethods(source('ReaderControlSettingsContent'), ['p', 'geometry', 'sharedRect', 'sharedClip'], { ...geometry, ...actors, ...paint });
const setting = Object.assign(new Settings(), { motionProgress: 0, availableWidth: 286, fullViewportHeight: 666,
  scrollMotion: { fullScrollOffset: 0 }, clipCache, clipEndpointWidth: -1, clipFullRects: [], clipQuickRects: [], getUIContext: () => ({ vp2px: n => n * 3 }) });
for (let i = 0; i < 120; i++) {
  setting.motionProgress = i / 119; setting.availableWidth = 286 + 52 * setting.motionProgress;
  for (let row = 0; row < 3; row++) for (const bar of [false, true]) assert.deepEqual(setting.sharedClip(row, bar), { rect: true });
}
assert.equal(paths, 0); assert.equal(rectangles, 1, 'all full coverage actors reuse one relative rectangle');
setting.scrollMotion.fullScrollOffset = 170; setting.motionProgress = .5;
const partial = setting.sharedClip(1, false), beforePaths = paths;
for (let i = 0; i < 120; i++) assert.equal(setting.sharedClip(1, false), partial);
assert.equal(paths, beforePaths, 'unchanged partial clip reuses its shape');
setting.getUIContext = () => ({ vp2px: n => n * 2 });
assert.notEqual(setting.sharedClip(1, false), partial, 'density invalidates pixel path');
for (const height of [190, 666]) for (const offset of [0, 100, 250, 666]) for (const p of [0, .2, .5, 1, .5, 0]) {
  setting.fullViewportHeight = height; setting.scrollMotion.fullScrollOffset = offset; setting.motionProgress = p;
  for (let row = 0; row < 3; row++) for (const bar of [false, true]) {
    const f = setting.sharedRect(row, bar, 1), c = setting.sharedRect(row, bar, p), q = setting.sharedRect(row, bar, 0);
    const expected = paint.readerControlMotionClipRects(p, f, c, q, height, offset), actual = setting.sharedClip(row, bar);
    if (actual.rect) assert.deepEqual(expected[0], { x: 0, y: 0, width: c.width, height: c.height });
    else assert.equal(actual.path, paint.readerControlMotionClipPath(expected, 2));
  }
}

const Directory = productionMotionMethods(source('ReaderControlDirectoryContent'), ['onProgressChanged', 'queueLeadingCorrection', 'captureLeadingRow', 'rowHeight', 'value', 'leadingAnchorIsAligned'],
  { ControlDirectoryFrame: Frame, ScrollAlign: { START: 1 }, LengthMetrics: { vp: n => n } });
for (const atTop of [true, false]) for (const nativeAnchored of [true, false]) {
  const queue = []; let corrections = 0;
  const directory = Object.assign(new Directory(), { mounted: true, lifecycle: 1, tab: 'directory', progress: 0,
    previousRowHeight: 32, availableWidth: 286, correctionQueued: false, interactionEnabled: false,
    snapshot: { rows: Array.from({ length: 100 }, (_, i) => ({ key: `r-${i}` })) },
    getUIContext: () => ({ postFrameCallback: cb => queue.push(cb), vp2px: n => 3 * n }),
    scroller: { getItemIndex: () => atTop ? 0 : 42, getItemRect: () => {
      const height = nativeAnchored ? directory.rowHeight() : 32;
      return { y: atTop ? 0 : -height * .5, height };
    }, scrollToIndex: (index, animation, align, offset) => {
      assert.equal(index, 42); assert.equal(offset.extraOffset, directory.rowHeight() * .5); corrections++;
    } },
  });
  directory.captureLeadingRow();
  for (let i = 1; i <= 120; i++) { directory.progress = i / 120; directory.onProgressChanged(); for (const cb of queue.splice(0)) cb.action(); }
  if (atTop || nativeAnchored) assert.equal(corrections, 0, 'no correction when native layout already preserves the anchor');
  else assert.ok(corrections > 100, 'real deep drift still corrected through motion');
  directory.leadingRow = 42.5; directory.leadingFraction = .5;
  directory.scroller.getItemRect = () => { throw Error('item temporarily unmeasured'); };
  directory.progress = .9; directory.onProgressChanged(); const beforeUnreadable = corrections;
  for (const cb of queue.splice(0)) cb.action();
  assert.equal(corrections, beforeUnreadable + 1, 'unreadable geometry retains necessary correction');
  directory.progress = .8; directory.onProgressChanged();
  directory.mounted = false; directory.lifecycle++; const before = corrections;
  for (const cb of queue.splice(0)) cb.action(); assert.equal(corrections, before, 'no stale lifecycle scroll');
}
console.log('PASS rendering work: empty 24-fragment page 1 clear/0 id scans; active marks 1 frame; duplicate/lifecycle/resize guards; Unicode 700 scan steps; 120 settings poses 0 paths; directory no-op correction 0');
