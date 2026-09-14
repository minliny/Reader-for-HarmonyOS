import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire, registerHooks, stripTypeScriptTypes } from 'node:module';
import { createReaderBuilderProbe } from './lib/reader-control-builder-probe.mjs';
import { productionMotionMethods } from './lib/reader-motion-method-probe.mjs';
import * as chromeLayout from '../entry/src/main/ets/features/reading/ReaderPageChromeLayout.ts';
// This exact platform module contains only type imports; execute its real body.
const { measureReaderPageChromeText, readerPageChromeTextMeasurements } = await import('data:text/javascript,' + encodeURIComponent(stripTypeScriptTypes(
  readFileSync(new URL('../entry/src/main/ets/features/reading/ReaderPageChromeTextMeasurement.ets', import.meta.url), 'utf8'))));
import * as fonts from '../entry/src/main/ets/features/common/ReaderFontFamilies.ts';
import * as gesture from '../entry/src/main/ets/features/reading/ReaderPageGestureState.ts';
registerHooks({ resolve(s, c, next) { try { return next(s, c); } catch (e) {
  if (s.startsWith('.') && !s.endsWith('.ts')) return next(`${s}.ts`, c); throw e;
} } });
const { ReaderRectVp: Rect, ReaderDisplayCornerVp: Corner, ReaderWindowMetricsSnapshot: Metrics } =
  await import('../entry/src/main/ets/features/common/ReaderWindowMetrics.ts');
const { resolveReaderReadingLayout } = await import('../entry/src/main/ets/features/reading/ReaderLayoutGeometry.ts');
const file = name => new URL(`../entry/src/main/ets/features/reading/${name}`, import.meta.url);
const typography = readFileSync(new URL('../entry/src/main/ets/features/common/ReaderTypography.ets', import.meta.url), 'utf8');
const roles = new Function(...Object.keys(fonts), stripTypeScriptTypes(typography.replace(/import\s*\{[\s\S]*?\}\s*from[^;]*;/g, '')).replace(/\bexport /g, '') +
  ';return {TYPE_READER_IMMERSIVE_TIME,TYPE_READER_IMMERSIVE_PROGRESS,TYPE_READER_IMMERSIVE_PAGE_ORDINAL};')(...Object.values(fonts));
const dependencies = { ...chromeLayout, ...roles, measureReaderPageChromeText };
const lreSource = readFileSync(file('LocalReadingExperience.ets'), 'utf8');
const chromeSource = readFileSync(file('ReaderPageChrome.ets'), 'utf8');
function windowLayout(width, cutout, extended, scale = 1, barHeight = 48, safeSide = 0) {
  const metrics = new Metrics();
  Object.assign(metrics, { ready: true, revision: 1, windowRect: new Rect(0, 0, width, 844),
    statusBarRect: new Rect(0, 0, width, barHeight), statusBarHeight: barHeight,
    statusBarCutoutRect: cutout, topLeftCorner: new Corner(42, 42, 42),
    topRightCorner: new Corner(width - 42, 42, 42) });
  const layout = resolveReaderReadingLayout(width, 844, false, metrics, extended);
  layout.systemFontScale = scale;
  layout.pageChromeVisualSafeLeft = safeSide; layout.pageChromeVisualSafeRight = safeSide;
  return layout;
}
function context(scale) {
  return { px2vp: v => v / 3, fp2px: v => v * 3 * scale,
    getMeasureUtils: () => ({ measureText: ({ textContent }) => textContent.length * 7.2 * 3 * scale }) };
}
const chromeMembers = ['build', 'chromeLayout', 'textMeasure', 'footerExitX', 'footerExitY', 'metaColor'];
const bookmarkMembers = ['bookmarkCornerFeedback', 'bookmarkCornerLayout', 'bookmarkFeedbackLabel',
  'pageBookmarkFeedbackFilled', 'pageBookmarkFeedbackAnchor'];
function render(layout, state = {}, time = '12:30') {
  const ui = context(layout.systemFontScale);
  const chrome = createReaderBuilderProbe(chromeSource, chromeMembers, dependencies).owner;
  Object.assign(chrome, { layout, textMeasureCache: readerPageChromeTextMeasurements, topInfoSuppressed: false,
    topStartText: 'A very long book title that must not overlap', topEndText: time,
    bottomStartText: '10%', bottomEndText: '第 2 页', sessionVisible: false,
    sessionWidth: 0, sessionHeight: 0, sessionExitProgress: 0, isSessionOverlay: false,
    sessionOverlayActive: false, topTranslateY: -(state.bookmarkPageOffsetY ?? 0), incomingOpacity: 1, footerOpacity: 1, footerTranslateX: 0,
    appearance: { activeTheme: 'paper' }, getUIContext: () => ui });
  chrome.initialRender();
  const bookmark = createReaderBuilderProbe(lreSource, bookmarkMembers, dependencies).owner;
  Object.assign(bookmark, { sourceId: 's', bookId: 'b', visiblePage: { startScalar: 0, endScalar: 50 },
    currentChapterIndex: () => 0, currentPageBookmarkStatus: () => 'bookmarked', bookmarkPendingTarget: '',
    controlVisible: () => false, controlObscured: false, bookmarkPageOffsetY: 0, bookmarkPreviewChanged: false,
    readerAppScheme: 'day', bookTitle: chrome.topStartText, pageChromeClockText: time, readingLayout: () => layout, getUIContext: () => ui, ...state });
  bookmark.bookmarkCornerFeedback();
  const nodes = [...chrome.nodes.values()];
  return { chrome, bookmark, clock: nodes.find(n => n.type === 'Text' && n.create === time),
    title: nodes.find(n => n.type === 'Text' && n.create.startsWith('A very')),
    icon: [...bookmark.nodes.values()].find(n => n.type === 'Image') };
}
function noOverlap(a, b) { return a.x + a.width <= b.x + 1e-8 || b.x + b.width <= a.x + 1e-8; }
const cases = [];
for (const width of [320, 390, 760]) for (const extended of [false, true]) for (const scale of [1, 1.5, 2]) {
  cases.push(windowLayout(width, new Rect(width / 2 - 41, 0, 82, 32), extended, scale));
}
cases.push(windowLayout(390, new Rect(154, 0, 154, 32), true)); // Right lane fits the clock, not both items.
cases.push(windowLayout(390, new Rect(0, 0, 0, 0), true, 1, 20, 40)); // Small top lane + safe side.
let leftFallbacks = 0;
for (const layout of cases) {
  const { clock, title, icon, chrome, bookmark } = render(layout);
  assert.ok(clock && icon, 'both native Text clock and native Image bookmark exist');
  assert.equal(clock.opacity, 1, 'clock is never hidden to make room');
  const clockWidth = Math.min(36 * layout.systemFontScale, clock.constraintSize.maxWidth);
  const a = { ...icon.position, width: icon.width }, b = { ...clock.position, width: clockWidth };
  assert.ok(noOverlap(a, b), `clock and bookmark intersect: ${JSON.stringify({ a, b })}`);
  assert.ok(noOverlap(a, { ...title.position, width: title.constraintSize.maxWidth }), 'title has its own bounded lane');
  assert.equal(icon.position.x, chrome.chromeLayout().topAccessoryX);
  assert.equal(Math.abs(clock.translate.y), 0);
  assert.equal(icon.position.y, chrome.chromeLayout().topAccessoryY);
  assert.equal(icon.position.x, bookmark.bookmarkCornerLayout().topAccessoryX);
  assert.ok(icon.position.y >= layout.pageChromeVisualSafeTop);
  assert.ok(icon.position.y + icon.height <= layout.pageChromeVisualSafeTop + layout.pageChromeTopRegionHeight + 1e-8,
    'bookmark stays inside top information band, above reading body');
  assert.equal(icon.translate, undefined, 'drag does not translate the icon into the reading body');
  assert.equal(icon.accessibilityText, '本页已添加书签');
  if (a.x < b.x) leftFallbacks++;
  const cutout = layout.pageChromeStatusMetrics.statusBarCutoutRect;
  if (icon.position.y < cutout.top + cutout.height && icon.position.y + icon.height > cutout.top) {
    assert.ok(noOverlap(a, { x: cutout.left, width: cutout.width }), 'bookmark avoids physical cutout');
    assert.ok(noOverlap(b, { x: cutout.left, width: cutout.width }), 'clock avoids physical cutout');
  }
}
assert.ok(leftFallbacks > 0, 'narrow right cutout lane exercises left title-lane fallback');
const layout = cases[1];
for (const [status, drag, preview, visible, filled, label] of [
  ['empty', 0, false, false, false, ''],
  ['empty', 20, false, true, false, '取消书签操作'],
  ['empty', 32, true, true, true, '松手添加书签'],
  ['bookmarked', 0, false, true, true, '本页已添加书签'],
  ['bookmarked', 32, true, true, false, '松手移除书签'],
  ['unknown', 0, false, false, false, ''],
]) {
  const { icon, clock } = render(layout, { currentPageBookmarkStatus: () => status,
    bookmarkPageOffsetY: drag, bookmarkPreviewChanged: preview });
  assert.equal(Boolean(icon), visible);
  assert.equal(clock.translate.y + drag, 0, 'top-info clock cancels page pull at every gesture sample');
  if (icon) { assert.equal(icon.create.includes('page_bookmark_filled'), filled); assert.equal(icon.accessibilityText, label); }
}
for (const state of [{ controlVisible: () => true }, { controlObscured: true }]) assert.equal(render(layout, state).icon, undefined);

// Production gesture state and real Host ACK bridge: threshold preview,
// rebound, late write/projection, page/book changes and failed deletion.
const H = productionMotionMethods(file('LocalReadingExperience.ets'), ['onReaderBookmarkGestureStateChanged',
  'onReaderBookmarkGestureReleased', 'finishBookmarkRollback', 'toggleCurrentPageBookmark', 'currentPageBookmarkStatus',
  'pageBookmarkFeedbackAnchor', 'pageBookmarkFeedbackFilled', 'reconcilePageBookmarkFeedback'], gesture);
let entries = [{ index: 0, title: 'C', bookmarks: [] }], pending = [];
const host = Object.assign(new H(), { mounted: true, sourceId: 's', bookId: 'b', visiblePage: { startScalar: 0, endScalar: 50 },
  currentChapterIndex: () => 0, currentPageBookmarkText: () => 'body', controlDirectoryEntries: () => entries,
  bookmarkPendingTarget: '', bookmarkPreviewChanged: false, bookmarkRollbackGeneration: 0, bookmarkMutationGeneration: 0,
  reduceMotion: true, appForeground: false, flushDeferredPageChromeState() {}, onTogglePageBookmark: r => pending.push(r) });
let drag = gesture.beginReaderPageGesture(390, 200, 400, 0, 844);
drag = gesture.moveReaderPageGesture(drag, 0, 24); host.onReaderBookmarkGestureStateChanged(drag);
assert.equal(host.pageBookmarkFeedbackFilled(), false);
drag = gesture.moveReaderPageGesture(drag, 0, 80); host.onReaderBookmarkGestureStateChanged(drag);
assert.equal(host.pageBookmarkFeedbackFilled(), true);
host.pageTurnGestureState = drag; host.onReaderBookmarkGestureReleased(true);
assert.equal(host.bookmarkPageOffsetY, 0); assert.equal(host.pageBookmarkFeedbackFilled(), true);
pending[0].onSettled(true); assert.equal(host.pageBookmarkFeedbackFilled(), true, 'ACK-before-projection retains fill');
host.visiblePage = { startScalar: 50, endScalar: 100 }; host.reconcilePageBookmarkFeedback();
assert.equal(host.pageBookmarkFeedbackFilled(), false, 'old page pending ACK cannot mark next page');
entries = [{ index: 0, title: 'C', bookmarks: [{ time: 1, chapterOffset: 0 }] }];
host.visiblePage = { startScalar: 0, endScalar: 50 }; assert.equal(host.pageBookmarkFeedbackFilled(), true);
host.toggleCurrentPageBookmark(); assert.equal(host.pageBookmarkFeedbackFilled(), false);
pending[1].onSettled(false); assert.equal(host.pageBookmarkFeedbackFilled(), true, 'failed deletion preserves canonical fill');
host.visiblePage = { startScalar: 50, endScalar: 100 }; host.toggleCurrentPageBookmark();
host.bookId = 'other'; entries = [{ index: 0, title: 'C', bookmarks: [] }]; pending[2].onSettled(true);
assert.equal(host.pageBookmarkFeedbackFilled(), false, 'old book completion does not publish into new book');
assert.equal(render(layout, { currentPageBookmarkStatus: () => 'empty' }).icon, undefined,
  'another mounted book has no shared bookmark visual state');
console.log(`PASS PH86: ${cases.length} real chrome/bookmark Builder geometries, clock/title/cutout separation, native visibility, gesture threshold/rebound/ACK and page/book ownership`);

// Execute the actual three component-call boundaries. Only native font/layout
// leaves are stubbed; a missing primitive Prop connection fails this chain.
const require = createRequire(import.meta.url);
const sdkRoot = process.env.READER_ETS_LOADER_ROOT ?? '/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/ets/build-tools/ets-loader';
const syntax = require(`${sdkRoot}/lib/validate_ui_syntax.js`);
const stageSource = readFileSync(file('ReaderPageTurnStage.ets'), 'utf8');
const readingSource = readFileSync(file('ReadingSurface.ets'), 'utf8');
function registerChild(name, source) {
  syntax.componentCollection.customComponents.add(name);
  syntax.propCollection.set(name, new Set([...source.matchAll(/@Prop\s+(\w+)\s*:/g)].map(m => m[1])));
}
registerChild('ReaderPageTurnSurface', stageSource); registerChild('ReadingSurface', readingSource);
registerChild('ReaderPageChrome', chromeSource); registerChild('ReaderReadingTextFragment', readingSource);
class Child { constructor(owner, params, _storage, id) { Object.assign(this, { owner, params, id }); } }
for (const pull of [0, 8, 32, 18, 0]) {
  const source = stageSource.slice(stageSource.lastIndexOf('@Component', stageSource.indexOf('export struct ReaderPageTurnStage')));
  const stage = createReaderBuilderProbe(source, ['build'], { ReaderPageTurnSurface: Child }).owner;
  Object.assign(stage, { translateY: pull, currentPageSlot: 'a', layout, appearance: { activeTheme: 'paper' },
    slotPage: () => ({ fragments: [], chromeTopStartText: 'Book', chromeTopEndText: '12:30' }),
    slotIdentity: slot => slot, slotSnapshotId: () => '', slotX: () => 0,
    slotVisible: slot => slot === 'a', slotLayer: () => 0, slotShadow: () => 0, hasActiveTurn: () => false });
  stage.initialRender();
  const root = [...stage.nodes.values()].find(n => n.translate?.y === pull);
  assert.ok(root); assert.equal(root.clip, pull <= 0, 'counter-translated top row is not clipped at moving stage edge');
  for (const page of stage.children.values()) {
    assert.equal(page.params.chromeTopTranslateY + pull, 0);
    const slot = createReaderBuilderProbe(stageSource, ['build'], { ReadingSurface: Child,
      COVER_OCCLUSION_RADIUS_VP: 1, COVER_OCCLUSION_OFFSET_X_VP: 1 }).owner;
    Object.assign(slot, page.params, { staticSnapshotId: '', slotIdentity: 'a', shadowColor: () => '#00000000' });
    slot.initialRender();
    const readingParams = [...slot.children.values()][0].params;
    assert.equal(readingParams.chromeTopTranslateY + pull, 0);
    const reading = createReaderBuilderProbe(readingSource.slice(readingSource.lastIndexOf('@Component', readingSource.indexOf('export struct ReadingSurface'))), ['build'], { ReaderPageChrome: Child,
      ReaderReadingTextFragment: Child, GradientDirection: { Bottom: 'bottom' } }).owner;
    Object.assign(reading, readingParams, { themeStyle: () => ({ sourcePaperLighting: false, paperTexture: false,
      paperStart: '#FFFFFF', paperEnd: '#FFFFFF' }), renderFragments: () => [], pageParagraphs: [],
      showChapterTitle: false, staticSnapshotId: '', contentInsets: () => ({}), layout });
    reading.initialRender();
    const finalParams = [...reading.children.values()][0].params;
    assert.equal(finalParams.topTranslateY + pull, 0, 'actual Stage → slot → surface → Chrome forwards primitive cancellation');
  }
}
assert.match(lreSource, /\.clip\(true\)\s*\.onTouch/, 'reading viewport retains outer clipping');
console.log('PASS PH86 actual SDK Stage/slot/ReadingSurface/Chrome Prop chain across drag and rebound; outer viewport clip retained');
