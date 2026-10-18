import { resolveEtsLoaderRoot } from './lib/tool-environment.mjs';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire, registerHooks } from 'node:module';
import { createReaderBuilderProbe } from './lib/reader-control-builder-probe.mjs';
import { productionMotionMethods } from './lib/reader-motion-method-probe.mjs';
import * as chromeLayout from '../entry/src/main/ets/features/reading/ReaderPageChromeLayout.ts';
import { measureReaderPageChromeText, readerPageChromeTextMeasurements, readerPageChromeTopTextStyle } from './lib/reader-page-chrome-measurement-probe.mjs';
import { loadReaderTypographyRoles } from './lib/reader-typography-probe.mjs';
import * as gesture from '../entry/src/main/ets/features/reading/ReaderPageGestureState.ts';
import * as rapid from '../entry/src/main/ets/features/reading/ReaderRapidPageTurnState.ts';
import { mergeReaderControlBookmarkProjection } from '../entry/src/main/ets/features/reading/ReaderControlBookmarkLoad.ts';
registerHooks({ resolve(s, c, next) { try { return next(s, c); } catch (e) {
  if (s.startsWith('.') && !s.endsWith('.ts')) return next(`${s}.ts`, c); throw e;
} } });
const { ReaderRectVp: Rect, ReaderDisplayCornerVp: Corner, ReaderWindowMetricsSnapshot: Metrics } =
  await import('../entry/src/main/ets/features/common/ReaderWindowMetrics.ts');
const { resolveReaderReadingLayout, READER_PAGE_CHROME_TOP_ROW_PADDING_VP } =
  await import('../entry/src/main/ets/features/reading/ReaderLayoutGeometry.ts');
const { readerAppearanceThemeStyle } = await import('../entry/src/main/ets/features/reading/ReaderAppearanceRenderStyle.ts');
const { findReaderTheme } = await import('../entry/src/main/ets/features/common/ReaderThemeRegistry.ts');
const file = name => new URL(`../entry/src/main/ets/features/reading/${name}`, import.meta.url);
const typography = readFileSync(new URL('../entry/src/main/ets/features/common/ReaderTypography.ets', import.meta.url), 'utf8');
const { TYPE_READER_IMMERSIVE_TIME, TYPE_READER_IMMERSIVE_PROGRESS, TYPE_READER_IMMERSIVE_PAGE_ORDINAL } =
  loadReaderTypographyRoles(typography);
const roles = { TYPE_READER_IMMERSIVE_TIME, TYPE_READER_IMMERSIVE_PROGRESS, TYPE_READER_IMMERSIVE_PAGE_ORDINAL };
const dependencies = { ...chromeLayout, ...roles, measureReaderPageChromeText, readerPageChromeTopTextStyle };
const lreSource = readFileSync(file('LocalReadingExperience.ets'), 'utf8');
const chromeSource = readFileSync(file('ReaderPageChrome.ets'), 'utf8');
const statusPaperSource = readFileSync(file('ReaderStatusBarPaper.ets'), 'utf8');
const paperBackgroundSource = readFileSync(file('ReaderPaperBackground.ets'), 'utf8');
const ActualLayout = productionMotionMethods(file('LocalReadingExperience.ets'),
  ['readingLayout', 'bookmarkFeedbackTopBoundary'], {
    ...dependencies, resolveReaderReadingLayout, READER_PAGE_CHROME_TOP_ROW_PADDING_VP,
    ReaderWindowCoordinator: { metrics: () => actualLayoutMetrics },
  });
let actualLayoutMetrics;
function windowLayout(width, cutout, extended, scale = 1, barHeight = 48, safeSide = 0) {
  const metrics = new Metrics();
  Object.assign(metrics, { ready: true, revision: 1, windowRect: new Rect(0, 0, width, 844),
    statusBarRect: new Rect(0, 0, width, barHeight), statusBarHeight: barHeight,
    statusBarCutoutRect: cutout, topLeftCorner: new Corner(42, 42, 42),
    topRightCorner: new Corner(width - 42, 42, 42), systemFontScale: scale });
  metrics.systemInsets.left = safeSide; metrics.systemInsets.right = safeSide;
  const layout = resolveReaderReadingLayout(width, 844, false, metrics, extended);
  layout.systemFontScale = scale;
  layout.pageChromeVisualSafeLeft = safeSide; layout.pageChromeVisualSafeRight = safeSide;
  layout.fixtureExtended = extended;
  return layout;
}
function context(scale) {
  return { px2vp: v => v / 3, fp2px: v => v * 3 * scale, px2fp: v => v / (3 * scale),
    getHostContext: () => ({resourceManager: {getNumber: () => 16 * 3 * scale}}),
    getMeasureUtils: () => ({ measureText: ({ textContent }) => textContent.length * 7.2 * 3 * scale,
      measureTextSize: ({textContent}) => ({width: textContent.length * 7.2 * 3 * scale, height: 20 * 3 * scale}) }) };
}
const chromeMembers = ['build', 'chromeLayout', 'textMeasure', 'topTextStyle', 'footerExitX', 'footerExitY', 'metaColor'];
const bookmarkMembers = ['bookmarkCornerFeedback', 'bookmarkCornerLayout', 'bookmarkFeedbackLabel',
  'pageBookmarkFeedbackFilled', 'pageBookmarkFeedbackMode', 'pageBookmarkFeedbackAnchor', 'bookmarkFeedbackOwnerKey',
  'bookmarkFeedbackHintFits', 'bookmarkFeedbackHintLabel', 'bookmarkFeedbackTopBoundary'];
// Reuse only the SDK-compiled classes. Every combination gets fresh owners,
// node maps and geometry caches; no mounted actor or fixture state is shared.
const ChromeComponent = createReaderBuilderProbe(chromeSource, chromeMembers, dependencies).Component;
const BookmarkComponent = createReaderBuilderProbe(lreSource, bookmarkMembers, dependencies).Component;
class StatusPaper { constructor(owner, params, _storage, id) { Object.assign(this, { owner, params, id }); } }
const UnderlayComponent = createReaderBuilderProbe(lreSource, ['readerStatusBarUnderlay', 'readerStatusBarMetrics'], {
  ReaderStatusBarPaper: StatusPaper, readerAppearanceThemeStyle,
  ReaderWindowCoordinator: { metrics: () => actualLayoutMetrics },
}, { childSources: { ReaderStatusBarPaper: statusPaperSource } }).Component;
const StatusPaperComponent = createReaderBuilderProbe(statusPaperSource, ['build'], {
  ReaderPaperBackground: StatusPaper, findReaderTheme,
}, { childSources: { ReaderPaperBackground: paperBackgroundSource } }).Component;
function render(layout, state = {}, time = '12:30') {
  const ui = context(layout.systemFontScale);
  const chrome = new ChromeComponent(undefined, {});
  Object.assign(chrome, { layout, textMeasureCache: readerPageChromeTextMeasurements,
    topInfoSuppressed: state.readerSettingsSnapshot?.hideStatusBar === false || state.controlVisible?.() === true,
    topStartText: 'A very long book title that must not overlap', topEndText: time,
    bottomStartText: '10%', bottomEndText: '第 2 页', sessionVisible: false,
    sessionWidth: 0, sessionHeight: 0, sessionExitProgress: 0, isSessionOverlay: false,
    sessionOverlayActive: false, topTranslateY: -(state.bookmarkPageOffsetY ?? 0), incomingOpacity: 1, footerOpacity: 1, footerTranslateX: 0,
    appearance: { activeTheme: 'paper' }, getUIContext: () => ui });
  chrome.initialRender();
  const bookmark = new BookmarkComponent(undefined, {});
  Object.assign(bookmark, { sourceId: 'local', bookId: 'b', visiblePage: { startScalar: 0, endScalar: 50 },
    currentChapterIndex: () => 0, currentPageBookmarkStatus: () => 'bookmarked', bookmarkPendingTarget: '',
    bookmarkPreviewStatus: state.currentPageBookmarkStatus?.() ?? 'bookmarked', bookmarkPreviewCancelled: false,
    lifecycleToken: 1, chapterSelectionToken: 1, bookmarkUnavailableMessage: '',
    controlVisible: () => false, controlObscured: false, bookmarkPageOffsetY: 0, bookmarkPreviewChanged: false,
    readerSettingsSnapshot: { hideStatusBar: true, navigationMode: 'paged' }, windowChromeActive: true, windowControlsPresented: false,
    readerAppScheme: 'day', bookTitle: chrome.topStartText, pageChromeClockText: time, readingLayout: () => layout, getUIContext: () => ui, ...state });
  bookmark.visibleReadingAppearance = () => ({ activeTheme: 'paper' });
  bookmark.bookmarkPreviewOwner = bookmark.bookmarkFeedbackOwnerKey();
  bookmark.bookmarkCornerFeedback();
  const nodes = [...chrome.nodes.values()];
  const marker = [...bookmark.nodes.values()].find(n => n.type === 'Image');
  return { chrome, bookmark, clock: nodes.find(n => n.type === 'Text' && n.create === time),
    title: nodes.find(n => n.type === 'Text' && n.create.startsWith('A very')),
    marker, icon: marker?.visibility === 'Visibility.Hidden' || marker?.opacity === 0 ? undefined : marker,
    hint: [...bookmark.nodes.values()].find(n => n.type === 'Text') };
}
function noOverlap(a, b) { return a.x + a.width <= b.x + 1e-8 || b.x + b.width <= a.x + 1e-8; }
function disjoint(a, b) {
  return noOverlap(a, b) || a.y + a.height <= b.y + 1e-8 || b.y + b.height <= a.y + 1e-8;
}
function renderStatusComposition(layout, state) {
  state = { ...state, readerSettingsSnapshot: { navigationMode: 'paged', ...state.readerSettingsSnapshot } };
  actualLayoutMetrics = layout.pageChromeStatusMetrics;
  const geometry = Object.assign(new ActualLayout(), {
    effectiveViewportWidth: () => layout.viewportWidth, effectiveViewportHeight: () => layout.viewportHeight,
    isTablet: false, readerSettingsSnapshot: { extendIntoCutout: layout.fixtureExtended, ...state.readerSettingsSnapshot },
    bookTitle: 'A very long book title that must not overlap', pageChromeClockText: '12:30',
    getUIContext: () => context(layout.systemFontScale),
  });
  layout = geometry.readingLayout();
  const drawn = render(layout, state);
  drawn.layout = layout;
  const underlay = new UnderlayComponent(undefined, {});
  Object.assign(underlay, { windowChromeActive: true, windowControlsPresented: state.controlVisible?.() === true,
    readerSettingsSnapshot: state.readerSettingsSnapshot, appearanceSnapshot: { activeTheme: 'paper' },
    readerWindowMetricsRevision: 1, readingLayout: () => layout });
  underlay.readerStatusBarUnderlay();
  const paper = [...underlay.children.values()][0];
  if (paper !== undefined) {
    const crop = new StatusPaperComponent(undefined, {});
    Object.assign(crop, paper.params); crop.initialRender();
    const root = [...crop.nodes.values()].find(node => node.clip === true && node.position);
    assert.ok(root, 'actual status-paper Builder publishes its clipped native rectangle');
    drawn.paper = { ...root.position, width: root.width, height: root.height };
    drawn.paperOrder = [...underlay.nodes.values()].find(node => node.zIndex === 10)?.zIndex;
  }
  return drawn;
}
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
  assert.equal(clock.fontFamily, 'HarmonyOS Sans', 'both Builders use the platform top text role');
  assert.equal(clock.fontSize, 16, 'resolved resource pixels are converted back to fp exactly once');
  assert.equal(clock.lineHeight, undefined, 'native AUTO line height remains authoritative');
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
// Include the actual sibling status-paper Builder: a marker can have correct
// own visibility/alpha yet be completely covered by this higher opaque crop.
let statusCompositions = 0;
for (const fixture of cases) for (const hideStatusBar of [false, true]) {
  for (const [status, pull, changed] of [['bookmarked', 0, false], ['empty', 8, false], ['empty', 32, true]]) {
    const state = { readerSettingsSnapshot: { hideStatusBar }, currentPageBookmarkStatus: () => status,
      bookmarkPageOffsetY: pull, bookmarkPreviewChanged: changed };
    const { icon, hint, paper, paperOrder, layout, bookmark, clock } = renderStatusComposition(fixture, state);
    assert.ok(icon, 'idle saved marker and both admitted preview states have a complete icon');
    const expectedSize = hideStatusBar ? Math.min(chromeLayout.READER_PAGE_CHROME_BOOKMARK_SIZE,
      fixture.pageChromeStatusMetrics.statusBarRect.height) : chromeLayout.READER_PAGE_CHROME_BOOKMARK_SIZE;
    assert.equal(icon.width, expectedSize);
    assert.equal(icon.height, expectedSize);
    const bounds = { ...icon.position, width: icon.width, height: icon.height };
    assert.ok(bounds.y + bounds.height <= layout.contentTop, 'idle/drag icon never covers the chapter heading or body');
    assert.equal(icon.create.includes('page_bookmark_filled'), status === 'bookmarked' || changed);
    if (!hideStatusBar) {
      assert.ok(paper && paperOrder > icon.zIndex, 'keep the actual system paper above reader content');
      assert.ok(disjoint(bounds, paper), `bookmark must not be covered by system status paper: ${JSON.stringify({bounds,paper,contentTop:layout.contentTop})}`);
      assert.ok(bounds.y >= bookmark.bookmarkFeedbackTopBoundary(layout));
      assert.equal(clock, undefined, 'native status owns its original clock band');
    } else assert.equal(paper, undefined, 'explicit immersion keeps the original unobscured top slot');
    if (hint) {
      const hintBounds = { ...hint.position, width: hint.width, height: hint.height };
      assert.ok(disjoint(bounds, hintBounds), 'preview label never overlaps its bookmark icon');
      if (paper) assert.ok(disjoint(hintBounds, paper), 'preview label remains below the opaque system band');
      assert.ok(hintBounds.y + hintBounds.height <= layout.contentTop + pull, 'large-scale hint only uses real blank/pulled space');
    }
    statusCompositions++;
  }
  for (const controls of [true, false]) {
    const result = renderStatusComposition(fixture, { readerSettingsSnapshot: { hideStatusBar },
      controlVisible: () => controls, currentPageBookmarkStatus: () => 'bookmarked', bookmarkPageOffsetY: 32 });
    assert.equal(Boolean(result.icon), !controls, 'control presentation hides the bookmark without changing its stacking order');
    if (controls) { assert.ok(result.paper); assert.equal(result.hint, undefined); }
  }
}
console.log(`PASS bookmark/status composition: ${statusCompositions} actual LRE layouts and SDK marker/status-paper trees; full-size idle/outline/filled, cutout/scale and controls`);
const layout = cases[1];
for (const [status, drag, preview, visible, filled, label] of [
  ['empty', 0, false, false, false, ''],
  ['empty', 8, false, true, false, '下拉添加书签'],
  ['empty', 32, true, true, true, '松手添加书签'],
  ['bookmarked', 0, false, true, true, '本页已添加书签'],
  ['bookmarked', 8, false, true, true, '下拉移除书签'],
  ['bookmarked', 32, true, true, false, '松手移除书签'],
  ['unknown', 0, false, false, false, ''],
]) {
  const { icon, clock, marker } = render(layout, { currentPageBookmarkStatus: () => status,
    bookmarkPageOffsetY: drag, bookmarkPreviewChanged: preview });
  assert.equal(Boolean(icon), visible);
  assert.equal(marker.visibility, visible ? 'Visibility.Visible' : 'Visibility.Hidden');
  if (!visible) assert.equal(marker.opacity, 0, 'hidden pages explicitly clear the native image alpha');
  assert.equal(clock.translate.y + drag, 0, 'top-info clock cancels page pull at every gesture sample');
  if (icon) { assert.equal(icon.create.includes('page_bookmark_filled'), filled); assert.equal(icon.accessibilityText, label); }
}
for (const state of [{ controlVisible: () => true }, { controlObscured: true }]) assert.equal(render(layout, state).icon, undefined);
for (const layout of cases) {
  const { hint, bookmark } = render(layout, { currentPageBookmarkStatus: () => 'empty', bookmarkPageOffsetY: 32 });
  assert.ok(hint, 'the drag exposes a visible continue-pulling hint');
  assert.equal(hint.create, '下拉添加书签');
  assert.equal(hint.hitTestBehavior, 'HitTestMode.None');
  assert.ok(hint.position.y >= layout.pageChromeVisualSafeTop + layout.pageChromeTopRegionHeight);
  assert.ok(hint.position.y + hint.height <= layout.contentTop + 32, 'hint stays within the empty pulled area');
  assert.equal(hint.fontFamily, TYPE_READER_IMMERSIVE_PROGRESS.fontFamily);
  const cached = bookmark.bookmarkCornerLayout();
  assert.equal(bookmark.bookmarkCornerLayout(), cached, 'MOVE reuses resolved chrome/hint geometry');
}
assert.equal(render(layout, { currentPageBookmarkStatus: () => 'empty', bookmarkPageOffsetY: 32,
  bookmarkPreviewCancelled: true }).hint.create, '松手取消');

// Production gesture state and real Host ACK bridge: threshold preview,
// rebound, late write/projection, page/book changes and failed deletion.
const H = productionMotionMethods(file('LocalReadingExperience.ets'), ['onReaderBookmarkGestureStateChanged',
  'onReaderBookmarkGestureReleased', 'finishBookmarkRollback', 'bookmarkMatchesCurrentChapter', 'toggleCurrentPageBookmark', 'currentPageBookmarkStatus',
  'pageBookmarkFeedbackAnchor', 'pageBookmarkFeedbackFilled', 'reconcilePageBookmarkFeedback',
  'canStartReaderBookmarkGesture', 'isReaderBookmarkGestureCurrent', 'bookmarkFeedbackOwnerKey'], {...gesture,LOCAL_READING_SOURCE_ID:'local'});
let entries = [{ index: 0, title: 'C', bookmarks: [] }], pending = [];
const host = Object.assign(new H(), { mounted: true, sourceId: 'local', bookId: 'b', visiblePage: { startScalar: 0, endScalar: 50 },
  currentChapterIndex: () => 0, currentPageBookmarkText: () => 'body', controlDirectoryEntries: () => entries,
  bookmarkPendingTarget: '', bookmarkPreviewChanged: false, bookmarkRollbackGeneration: 0, bookmarkMutationGeneration: 0,
  bookmarkGestureAnchor: '', lifecycleToken: 1, chapterSelectionToken: 1, pagePointerEpoch: 1, pageTurnInputRevision: 1,
  canTurnPage: () => true, isReaderPageInteractionEnabled: () => true, pageTurnTapOnlyInput: () => false,
  reduceMotion: true, appForeground: false, flushDeferredPageChromeState() {}, onTogglePageBookmark: r => pending.push(r) });
assert.equal(host.canStartReaderBookmarkGesture(), true);
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

// Retain the SDK-emitted If/Image observers instead of mounting the Builder
// again for every page. visiblePage is deliberately non-reactive in production;
// only the published page revision may invalidate these visual decisions.
function retainedMarker(initial = 'bookmarked') {
  const active = [], subscriptions = new Map();
  const names = ['bookmarkCornerFeedback', 'bookmarkFeedbackLabel', 'pageBookmarkFeedbackFilled', 'pageBookmarkFeedbackMode',
    'pageBookmarkFeedbackAnchor', 'bookmarkFeedbackOwnerKey', 'bookmarkFeedbackHintLabel',
    'currentPageBookmarkStatus', 'bookmarkMatchesCurrentChapter'];
  const { owner } = createReaderBuilderProbe(lreSource, names, { LOCAL_READING_SOURCE_ID: 'local' }, {
    onObserverEnter(_owner, id) { active.push(id); subscriptions.set(id, new Set()); },
    onObserverExit(_owner, id) { assert.equal(active.pop(), id); },
  });
  const state = { pageTurnRenderRevision: 1, bookmarkPageOffsetY: 0, bookmarkPendingTarget: '',
    bookmarkPreviewChanged: false, bookmarkPreviewCancelled: false, bookmarkUnavailableMessage: '',
    controlObscured: false, readerAppScheme: 'day',
    directoryEntries: [{ index: 0, title: 'C', bookmarks: initial === 'bookmarked' ? [{ time: 1, chapterOffset: 0 }] : [] }] };
  Object.assign(owner, { sourceId: 'local', bookId: 'b', chapter: { chapterIndex: 0 },
    visiblePage: { startScalar: 0, endScalar: 50 }, lifecycleToken: 1, chapterSelectionToken: 1,
    currentChapterIndex: () => owner.chapter.chapterIndex, controlDirectoryEntries: () => owner.directoryEntries,
    controlVisible: () => false, bookmarkFeedbackHintFits: () => false,
    bookmarkCornerLayout: () => ({ topAccessoryWidth: 16, topAccessoryHeight: 16, topAccessoryX: 0, topAccessoryY: 0 }),
  });
  for (const key of Object.keys(state)) Object.defineProperty(owner, key, {
    get() { const id = active.at(-1); if (id !== undefined) subscriptions.get(id).add(key); return state[key]; },
  });
  owner.bookmarkCornerFeedback();
  const markerImage = [...owner.nodes].find(([, node]) => node.type === 'Image')[0];
  const observerCount = owner.observers.length;
  return { owner, markerImage,
    marker: () => owner.nodes.get(markerImage),
    update(key, value) {
      state[key] = value;
      const ids = [...subscriptions].filter(([, keys]) => keys.has(key)).map(([id]) => id);
      owner.replayOnly(ids);
      assert.equal(owner.observers.length, observerCount, 'page updates retain one native marker actor');
      return ids;
    },
    page(startScalar, endScalar) {
      owner.visiblePage = { startScalar, endScalar };
      return this.update('pageTurnRenderRevision', state.pageTurnRenderRevision + 1);
    },
  };
}
const retained = retainedMarker();
assert.equal(retained.marker().visibility, 'Visibility.Visible', 'bookmarked page initially paints its marker');
const pageObservers = retained.page(50, 100);
assert.ok(pageObservers.includes(retained.markerImage), 'the retained Image resource must also subscribe to the page revision');
assert.equal(retained.marker().visibility, 'Visibility.Hidden', 'an unbookmarked page hides the existing image explicitly');
assert.equal(retained.marker().opacity, 0, 'an unbookmarked page clears the existing image alpha explicitly');
retained.page(0, 50);
assert.equal(retained.marker().visibility, 'Visibility.Visible', 'returning restores the same marker actor');
assert.equal(retained.marker().opacity, 1);
assert.match(retained.marker().create, /page_bookmark_filled/, 'returning restores its filled resource');
for (let page = 1; page <= 4; page++) {
  retained.page(page * 50, (page + 1) * 50);
  assert.equal(retained.marker().visibility, 'Visibility.Hidden', 'every other unbookmarked page stays marker-free');
  assert.equal(retained.marker().opacity, 0);
}
const pulling = retainedMarker('empty');
pulling.owner.bookmarkPreviewStatus = 'empty';
pulling.owner.bookmarkPreviewOwner = pulling.owner.bookmarkFeedbackOwnerKey();
pulling.update('bookmarkPageOffsetY', 24);
assert.equal(pulling.marker().visibility, 'Visibility.Visible', 'hollow marker belongs to the active page pull');
pulling.page(50, 100);
assert.equal(pulling.marker().visibility, 'Visibility.Hidden', 'a stale pull cannot leave a hollow marker on another page');
assert.equal(pulling.marker().opacity, 0);
console.log('PASS retained bookmark SDK Image: A/B/A, four unmarked pages, explicit visibility/alpha delivery and stale hollow-preview isolation without branch deletion');
// Normal-motion rebound holds the released target until both the animation
// and canonical projection are complete. ACK/projection are controlled inputs;
// the production methods, marker cache and merge remain unmodified.
const pointerReleaseTicks = [];
const Normal = productionMotionMethods(file('LocalReadingExperience.ets'), [
  'onReaderBookmarkGestureStateChanged', 'onReaderBookmarkGestureReleased', 'finishBookmarkRollback',
  'bookmarkMatchesCurrentChapter', 'toggleCurrentPageBookmark', 'currentPageBookmarkStatus', 'pageBookmarkFeedbackAnchor',
  'pageBookmarkFeedbackFilled', 'reconcilePageBookmarkFeedback', 'canStartReaderBookmarkGesture',
  'isReaderBookmarkGestureCurrent', 'bookmarkFeedbackOwnerKey',
  'onReaderPageGestureStateChanged',
  'acquirePagePointer', 'releasePagePointer', 'pageTurnTapOnlyInput', 'regrabPageTurn',
  'controlDirectorySourceEntries', 'controlDirectoryEntries', 'invalidatePageTurnRuntime',
], { ...gesture, ...rapid, LOCAL_READING_SOURCE_ID:'local', motionAnimateParam: (_key, onFinish) => ({ onFinish }),
  setTimeout: callback => { pointerReleaseTicks.push(callback); return pointerReleaseTicks.length; } });
function normalHost(bookmarked = false) {
  const requests = [], animations = [];
  const h = Object.assign(new Normal(), { mounted: true, sourceId: 'local', bookId: 'b', chapter: undefined,
    visiblePage: { startScalar: 50, endScalar: 100 },
    directoryEntries: [{ index: 16, title: 'chapter17', bookmarks: bookmarked ? [{ time: 10, chapterOffset: 50 }] : [] }],
    tocEntries: [], currentChapterIndex: () => 16, currentPageBookmarkText: () => 'text', canTurnPage: () => true,
    bookmarkPendingTarget: '', bookmarkPreviewChanged: false, bookmarkRollbackGeneration: 0, bookmarkMutationGeneration: 0,
    bookmarkGestureAnchor: '', lifecycleToken: 1, chapterSelectionToken: 1, pagePointerEpoch: 1, pageTurnInputRevision: 1,
    pageTurnGestureState: gesture.createReaderPageGestureState(), pageTurnInputOwned: false,
    isReaderPageInteractionEnabled: () => true,
    reduceMotion: false, appForeground: false, flushDeferredPageChromeState() {},
    autoPageCoordinator: { cancelPendingTurn() {} },
    onTogglePageBookmark: r => requests.push(r),
    getUIContext: () => ({ animateTo: (options, closure) => { animations.push(options.onFinish); closure(); } }),
    rapidPageTurnState: rapid.createReaderRapidPageTurnState(),
    autoPageCoordinator: { cancelPendingTurn() {} },
    clearPageTurnProjection() {}, finishPageTurnPerf() {}, cancelPageTurnSettlementDeadline() {},
    clearBookTurnCapturedIdentities() {}, releaseBookTurnTextureContent() {}, releaseBookTurnPendingSnapshot() {},
    releaseUnretainedReadingImages() {},
  });
  return { h, requests, animations };
}
function normalRelease(h, cancelled = false) {
  assert.equal(h.canStartReaderBookmarkGesture(), true);
  let state = gesture.beginReaderPageGesture(390, 200, 300, 0, 844);
  state = gesture.moveReaderPageGesture(state, 0, 80);
  const decision = gesture.settleReaderPageGesture(state, 0, cancelled ? 10 : 80);
  h.pageTurnGestureState = decision.state;
  h.onReaderBookmarkGestureStateChanged(decision.state);
  h.onReaderBookmarkGestureReleased(decision.bookmarkChanged);
}
// Exercise the real Layer -> Host release order. The Host already receives
// bookmark settling before raw pointer release and the business UP callback;
// blocking new DOWN must not change the predicate that admits this same UP.
const ReboundInput = productionMotionMethods(file('ReaderPageInteractionLayer.ets'),
  ['startRawPointer', 'handleTouch', 'cancelPan', 'resetRawPointer'],
  { ...gesture, TouchType: { Down: 'down', Up: 'up', Move: 'move', Cancel: 'cancel' } });
for (const reduced of [false, true]) for (const cancelled of [false, true]) {
  const { h, requests, animations } = normalHost();
  Object.assign(h, { activePagePointerId: -1, reduceMotion: reduced,
    pageTurnFrozenRevision: 0, pageTurnRenderRevision: 0, pageTurnSessionCapsuleFrozen: true });
  assert.equal(h.acquirePagePointer(11), true);
  assert.equal(h.canStartReaderBookmarkGesture(), true);
  const drag = gesture.moveReaderPageGesture(gesture.beginReaderPageGesture(390, 200, 300, 0, 844), 0, 80);
  h.onReaderPageGestureStateChanged(drag); h.onReaderBookmarkGestureStateChanged(drag);
  const decision = gesture.settleReaderPageGesture(drag, 0, cancelled ? 10 : 80);
  h.onReaderPageGestureStateChanged(decision.state); h.onReaderBookmarkGestureStateChanged(decision.state);
  h.releasePagePointer(11);
  assert.equal(h.pageTurnGestureState.phase, 'settling');
  assert.equal(h.isReaderBookmarkGestureCurrent(), true, 'publishing bookmark settling cannot reject its own legal UP');
  h.onReaderBookmarkGestureReleased(decision.bookmarkChanged);
  assert.equal(requests.length, cancelled ? 0 : 1, 'legal UP preserves add/cancel intent');
  const epoch = h.pagePointerEpoch, state = h.pageTurnGestureState;
  if (!reduced) {
    assert.equal(animations.length, 1);
    assert.equal(h.pageTurnInputOwned, true, 'the released bookmark owns its rebound');
    const input = Object.assign(new ReboundInput(), { interactionEnabled: true, activePointerId: -1,
      gestureState: decision.state, deferredSegmentReserved: false, systemOwnsPointer: () => false,
      onPointerStart: pointerId => h.acquirePagePointer(pointerId),
      freezePointerGeometry() { throw new Error('rebound DOWN must be rejected before freezing geometry'); },
      onDeferredSegmentStart() { throw new Error('rebound DOWN must not reserve deferred input'); },
      onGestureStateChange() { throw new Error('rebound DOWN must not replace the settling owner'); },
    });
    const touch = { changedTouches: [{ id: 12 }], touches: [{ id: 12 }] };
    input.handleTouch({ ...touch, type: 'down' });
    assert.equal(input.activePointerId, -1, 'rebound does not accept a second physical pointer');
    assert.equal(input.deferredSegmentReserved, false, 'rebound never queues the rejected segment');
    assert.equal(h.activePagePointerId, -1); assert.equal(h.pagePointerEpoch, epoch);
    assert.equal(h.pageTurnGestureState, state, 'rejected DOWN preserves the exact settling owner');
    animations[0]();
    input.handleTouch({ ...touch, type: 'move' }); input.handleTouch({ ...touch, type: 'up' });
    assert.equal(input.activePointerId, -1, 'a segment rejected during rebound cannot replay after it finishes');
  } else {
    assert.equal(animations.length, 0, 'reduceMotion completes the rebound in the UP callback');
  }
  assert.equal(h.pageTurnGestureState.phase, 'idle');
  assert.equal(h.pageTurnInputOwned, false);
  assert.equal(h.acquirePagePointer(13), true, 'a genuinely new DOWN is admitted after rebound finishes');
  assert.equal(h.pagePointerEpoch, epoch + 1);
}
for (const owner of ['horizontalPage', 'verticalPrevious']) {
  const { h } = normalHost();
  Object.assign(h, { activePagePointerId: -1, pageTurnGestureState: { ...gesture.createReaderPageGestureState(), owner, phase: 'settling' },
    pageTurnSettlementActive: true, pageTurnDirection: 'next', pageTurnOffsetX: -40,
    pageTurnSettlementGeneration: 10, pageTurnSlideTimeline: {}, usesBookTurnSimulation: () => false,
    completeRapidPageTurnTransaction() {} });
  assert.equal(h.acquirePagePointer(14), true, 'ordinary page settlement preserves its existing pointer/regrab admission');
  const resumed = h.regrabPageTurn(390, 844, 200, 300, 32);
  assert.equal(resumed.owner, 'horizontalPage'); assert.equal(resumed.currentOffsetX, -40);
  assert.equal(h.pageTurnSettlementActive, false, 'ordinary page regrab retains its existing settlement handoff');
}
console.log('PASS bookmark rebound input: legal UP, rejected new DOWN without epoch/defer/replay, finish/reduceMotion recovery and ordinary page regrab');
const systemCancelPreviews = [];
for (const bookmarked of [false, true]) {
  const { h, requests, animations } = normalHost(bookmarked);
  Object.assign(h, { activePagePointerId: -1, pageTurnFrozenRevision: 0,
    pageTurnRenderRevision: 0, pageTurnSessionCapsuleFrozen: true });
  assert.equal(h.acquirePagePointer(21), true);
  assert.equal(h.canStartReaderBookmarkGesture(), true);
  const drag = gesture.moveReaderPageGesture(gesture.beginReaderPageGesture(390, 200, 300, 0, 844), 0, 80);
  h.onReaderPageGestureStateChanged(drag); h.onReaderBookmarkGestureStateChanged(drag);
  assert.equal(h.pageBookmarkFeedbackFilled(), !bookmarked, 'threshold crossing previews the opposite state before CANCEL');
  const input = Object.assign(new ReboundInput(), { interactionEnabled: true, activePointerId: 21,
    gestureState: drag, tapOnlyPointer: false, pointerRejected: false,
    onGestureStateChange: state => h.onReaderPageGestureStateChanged(state),
    onBookmarkStateChange: state => h.onReaderBookmarkGestureStateChanged(state),
    onBookmarkRelease: changed => h.onReaderBookmarkGestureReleased(changed),
    onPointerEnd: pointerId => h.releasePagePointer(pointerId),
    resolveDeferredSegment() {}, clearPointerWatchdog() {}, clearLongPressTimer() {},
  });
  input.handleTouch({ type: 'cancel' });
  assert.equal(requests.length, 0, 'system CANCEL after the threshold never writes');
  assert.equal(animations.length, 1, 'system CANCEL still uses the existing rebound');
  assert.equal(h.activePagePointerId, -1); assert.equal(input.activePointerId, -1);
  systemCancelPreviews.push({ bookmarked, changed: h.bookmarkPreviewChanged,
    cancelled: h.bookmarkPreviewCancelled, filled: h.pageBookmarkFeedbackFilled() });
  animations[0](); assert.equal(h.pageBookmarkFeedbackFilled(), bookmarked);
}
assert.deepEqual(systemCancelPreviews, [
  { bookmarked: false, changed: false, cancelled: false, filled: false },
  { bookmarked: true, changed: false, cancelled: false, filled: true },
], 'system CANCEL clears a threshold preview before rebound begins for both original states');
console.log('PASS system bookmark CANCEL: threshold preview restores canonical empty/bookmarked before the existing rebound, with no write');
function publishBookmark(h, bookmarked) {
  h.directoryEntries = mergeReaderControlBookmarkProjection(h.directoryEntries,
    [{ index: 16, title: 'chapter17', bookmarks: bookmarked ? [{ time: 10, chapterOffset: 50 }] : [] }]);
  h.reconcilePageBookmarkFeedback();
}
const completionOrders = [ ['ack', 'projection', 'rollback'], ['ack', 'rollback', 'projection'],
  ['projection', 'ack', 'rollback'], ['projection', 'rollback', 'ack'],
  ['rollback', 'ack', 'projection'], ['rollback', 'projection', 'ack'] ];
for (const order of completionOrders) {
  const { h, requests, animations } = normalHost();
  for (const target of [true, false]) {
    assert.equal(h.canStartReaderBookmarkGesture(), true);
    normalRelease(h);
    const request = requests.at(-1), done = animations.at(-1), requestCount = requests.length;
    assert.equal(h.canStartReaderBookmarkGesture(), false, 'same-page mutation owns the gesture until reconciled');
    h.toggleCurrentPageBookmark();
    assert.equal(requests.length, requestCount, 'duplicate release cannot enqueue a second write');
    for (const step of order) {
      if (step === 'ack') request.onSettled(true);
      if (step === 'projection') publishBookmark(h, target);
      if (step === 'rollback') done();
      assert.equal(h.pageBookmarkFeedbackFilled(), target, `${target ? 'add' : 'remove'} cannot invert at ${order}/${step}`);
    }
    assert.equal(h.bookmarkPendingTarget, '', 'matching projection and finished rebound release pending state');
    assert.equal(h.canStartReaderBookmarkGesture(), true);
  }
}
for (const bookmarked of [false, true]) {
  const rejected = normalHost(bookmarked);
  normalRelease(rejected.h); rejected.requests[0].onSettled(false);
  assert.equal(rejected.h.pageBookmarkFeedbackFilled(), bookmarked, 'failed write restores canonical state');
  rejected.animations[0]();
  assert.equal(rejected.h.bookmarkPendingTarget, '');
  assert.equal(rejected.h.pageBookmarkFeedbackFilled(), bookmarked);
  const cancelled = normalHost(bookmarked);
  normalRelease(cancelled.h, true);
  assert.equal(cancelled.requests.length, 0, 'pull back before release cancels without writing');
  cancelled.animations[0](); assert.equal(cancelled.h.pageBookmarkFeedbackFilled(), bookmarked);
}
const invalidated = normalHost();
normalRelease(invalidated.h); publishBookmark(invalidated.h, true); invalidated.requests[0].onSettled(true);
assert.equal(invalidated.h.bookmarkPendingTarget, 'bookmarked', 'early ACK holds target through rebound');
invalidated.h.invalidatePageTurnRuntime();
assert.equal(invalidated.h.bookmarkPendingTarget, '', 'runtime cancellation also reconciles confirmed projection');
invalidated.h.visiblePage = { startScalar: 100, endScalar: 150 };
invalidated.animations[0]();
assert.equal(invalidated.h.pageBookmarkFeedbackFilled(), false, 'late old animation cannot mark the new page');
const late = normalHost();
normalRelease(late.h); late.animations[0](); publishBookmark(late.h, true); late.requests[0].onSettled(true);
normalRelease(late.h); late.requests[0].onSettled(false);
assert.equal(late.h.bookmarkPendingTarget, 'empty', 'old ACK cannot erase a newer remove intent');
late.animations[1](); publishBookmark(late.h, false); late.requests[1].onSettled(true);
assert.equal(late.h.pageBookmarkFeedbackFilled(), false);
assert.equal(late.h.bookmarkPendingTarget, '');
for (const mutate of [
  h => { h.sourceId = 'other'; }, h => { h.bookId = 'other'; },
  h => { h.chapter.chapterIndex++; h.currentChapterIndex = () => 17; },
  h => { h.chapter.contentVersion = 'v2'; }, h => { h.chapter.bodyVersion = 'b2'; },
  h => { h.chapter.processingVersion = 'p2'; }, h => { h.visiblePage = { startScalar: 100, endScalar: 150 }; },
  h => { h.visiblePage.endScalar++; }, h => { h.lifecycleToken++; }, h => { h.chapterSelectionToken++; },
  h => { h.pagePointerEpoch++; }, h => { h.pageTurnInputRevision++; }, h => { h.mounted = false; },
  h => { h.exitRequested = true; }, h => { h.isReaderPageInteractionEnabled = () => false; },
  h => { h.pageTurnTapOnlyInput = () => true; }, h => { h.canTurnPage = () => false; },
]) {
  const { h, requests, animations } = normalHost();
  h.chapter = { chapterIndex: 16, contentVersion: 'v1', bodyVersion: 'b1', processingVersion: 'p1' };
  assert.equal(h.canStartReaderBookmarkGesture(), true);
  h.pageTurnGestureState = gesture.moveReaderPageGesture(gesture.beginReaderPageGesture(390, 200, 300, 0, 844), 0, 80);
  h.pageTurnInputOwned = true;
  const epoch = h.pagePointerEpoch;
  const inputRevision = h.pageTurnInputRevision;
  mutate(h); h.onReaderBookmarkGestureReleased(true);
  assert.equal(requests.length, 0, 'a superseded admission never writes into the current context');
  assert.equal(animations.length, 0, 'retired admission never starts another animation');
  if (h.mounted && h.pagePointerEpoch === epoch && h.pageTurnInputRevision === inputRevision) {
    assert.equal(h.pageTurnInputOwned, false, 'retired same-segment bookmark releases input ownership');
    assert.equal(h.pageTurnGestureState.phase, 'idle');
  } else if (h.pagePointerEpoch !== epoch) {
    assert.equal(h.pageTurnInputOwned, true, 'old-epoch release cannot clear newer input ownership');
  }
}
const cancelNative = normalHost();
const cancelledBookmark = gesture.settleReaderPageGesture(
  gesture.moveReaderPageGesture(gesture.beginReaderPageGesture(390, 200, 300, 0, 844), 0, 80), 0, 10).state;
cancelNative.h.usesBookTurnSimulation = () => { throw new Error('bookmark must not enter native page presentation'); };
cancelNative.h.onReaderPageGestureStateChanged(cancelledBookmark);
assert.equal(cancelNative.h.pageTurnGestureState.owner, 'bookmark');
assert.equal(cancelNative.h.pageTurnInputOwned, true, 'bookmark release owns the dedicated rebound');
const disabledCancel = normalHost();
assert.equal(disabledCancel.h.canStartReaderBookmarkGesture(), true);
disabledCancel.h.isReaderPageInteractionEnabled = () => false;
disabledCancel.h.onReaderPageGestureStateChanged(cancelledBookmark);
disabledCancel.h.onReaderBookmarkGestureStateChanged(cancelledBookmark);
disabledCancel.h.onReaderBookmarkGestureReleased(false);
assert.equal(disabledCancel.requests.length, 0, 'disabled raw CANCEL never writes a bookmark');
assert.equal(disabledCancel.animations.length, 0, 'disabled raw CANCEL never starts another animation');
assert.equal(disabledCancel.h.pageTurnInputOwned, false, 'disabled raw CANCEL releases its same-segment host input');
assert.equal(disabledCancel.h.pageTurnGestureState.phase, 'idle');
const releasedPointer = normalHost();
releasedPointer.h.activePagePointerId = 7;
assert.equal(releasedPointer.h.canStartReaderBookmarkGesture(), true);
releasedPointer.h.activePagePointerId = -1;
releasedPointer.h.onReaderBookmarkGestureReleased(true);
releasedPointer.h.onReaderBookmarkGestureReleased(true);
assert.equal(releasedPointer.requests.length, 1, 'UP consumes admission once after the raw pointer has been released');
const oldContext = normalHost();
normalRelease(oldContext.h); oldContext.h.chapterSelectionToken++;
oldContext.h.bookmarkPreviewChanged = true;
oldContext.requests[0].onSettled(false);
assert.equal(oldContext.h.bookmarkPreviewChanged, true, 'old-context ACK cannot clear the new context preview');
assert.equal(oldContext.h.pageBookmarkFeedbackFilled(), false, 'old preview and pending intent stay scoped to their context');
assert.equal(oldContext.h.canStartReaderBookmarkGesture(), true, 'a retired context does not leave the new context locked');
const awayAck = normalHost();
normalRelease(awayAck.h);
awayAck.h.visiblePage = { startScalar: 100, endScalar: 150 };
awayAck.requests[0].onSettled(true);
assert.equal(awayAck.h.bookmarkPendingTarget, '', 'off-page ACK retires its own request bookkeeping');
awayAck.h.visiblePage = { startScalar: 50, endScalar: 100 };
assert.equal(awayAck.h.canStartReaderBookmarkGesture(), true, 'returning to the origin after off-page ACK permits a new gesture');
const noMoveScans = normalHost();
let scans = 0;
const realEntries = noMoveScans.h.controlDirectoryEntries.bind(noMoveScans.h);
noMoveScans.h.controlDirectoryEntries = () => { scans++; return realEntries(); };
assert.equal(noMoveScans.h.canStartReaderBookmarkGesture(), true);
const admittedScans = scans;
let preview = gesture.beginReaderPageGesture(390, 200, 300, 0, 844);
for (const dy of [24, 32, 48, 80, 20]) {
  preview = gesture.moveReaderPageGesture(preview, 0, dy);
  noMoveScans.h.onReaderBookmarkGestureStateChanged(preview);
  noMoveScans.h.pageBookmarkFeedbackFilled();
}
assert.equal(scans, admittedScans, 'MOVE preview never scans the directory/bookmark projection');
for (const [initial, next] of [ ['empty', 'bookmarked'], ['bookmarked', 'empty'], ['empty', 'unknown'] ]) {
  const { h, requests, animations } = normalHost(initial === 'bookmarked');
  let projectionScans = 0;
  const actualEntries = h.controlDirectoryEntries.bind(h);
  h.controlDirectoryEntries = () => { projectionScans++; return actualEntries(); };
  assert.equal(h.canStartReaderBookmarkGesture(), true);
  const admissionScans = projectionScans;
  let state = gesture.beginReaderPageGesture(390, 200, 300, 0, 844);
  for (const dy of [24, 32, 48, 80]) {
    state = gesture.moveReaderPageGesture(state, 0, dy);
    h.onReaderBookmarkGestureStateChanged(state);
    h.pageBookmarkFeedbackFilled();
  }
  assert.equal(projectionScans, admissionScans, `${initial}->${next}: MOVE never rescans the projection`);
  const previewFilled = h.pageBookmarkFeedbackFilled();
  h.directoryEntries = [{ index: 16, title: 'chapter17', bookmarks: next === 'unknown' ? undefined :
    next === 'bookmarked' ? [{ time: 20, chapterOffset: 50 }] : [] }];
  assert.equal(h.pageBookmarkFeedbackFilled(), previewFilled, 'incoming projection cannot reverse the live preview');
  h.pageTurnGestureState = gesture.settleReaderPageGesture(state, 0, 80).state;
  h.pageTurnInputOwned = true;
  const beforeUpScans = projectionScans;
  h.onReaderBookmarkGestureReleased(true);
  assert.equal(projectionScans, beforeUpScans + 1, `${initial}->${next}: UP revalidates canonical status once`);
  assert.equal(requests.length, 0, `${initial}->${next}: a changed projection never writes the opposite target`);
  assert.equal(animations.length, 0, 'superseded preview retires without another animation');
  assert.equal(h.pageTurnInputOwned, false, 'superseded preview releases same-segment input');
  assert.equal(h.pageTurnGestureState.phase, 'idle');
  assert.equal(h.bookmarkPendingTarget, '');
}
const feedbackTimers = [], nativeToasts = [];
const Feedback = productionMotionMethods(file('LocalReadingExperience.ets'), [
  'onReaderBookmarkGestureUnavailable', 'bookmarkFeedbackHintFits', 'bookmarkFeedbackOwnerKey',
  'bookmarkFeedbackHintLabel', 'bookmarkCornerLayout', 'pageBookmarkFeedbackAnchor', 'bookmarkFeedbackTopBoundary',
], { ...dependencies, setTimeout: callback => { feedbackTimers.push(callback); return feedbackTimers.length; }, clearTimeout() {} });
const feedbackLayout = { ...cases[1], contentTop: cases[1].contentTop + 80 };
const feedback = Object.assign(new Feedback(), { mounted: true, lifecycleToken: 1, chapterSelectionToken: 1,
  sourceId: 'local', bookId: 'b', visiblePage: { startScalar: 0, endScalar: 50 }, currentChapterIndex: () => 0,
  bookmarkUnavailableMessage: '', bookmarkUnavailableGeneration: 0, bookmarkUnavailableTimer: -1,
  bookmarkPendingTarget: '', bookmarkPageOffsetY: 0, currentPageBookmarkStatus: () => 'unknown',
  readerSettingsSnapshot: { hideStatusBar: true },
  isReaderPageInteractionEnabled: () => true, readingLayout: () => feedbackLayout,
  pageChromeClockText: '12:30', bookTitle: 'Book',
  getUIContext: () => ({ ...context(feedbackLayout.systemFontScale),
    getPromptAction: () => ({ showToast: options => nativeToasts.push(options.message) }) }) });
feedback.onReaderBookmarkGestureUnavailable('busy');
assert.equal(feedback.bookmarkFeedbackHintLabel(), '页面切换中，请稍后下拉');
const oldFeedbackTimer = feedbackTimers.at(-1);
feedback.onReaderBookmarkGestureUnavailable('unavailable');
assert.equal(feedback.bookmarkFeedbackHintLabel(), '书签尚未加载，请稍后下拉');
oldFeedbackTimer(); assert.equal(feedback.bookmarkFeedbackHintLabel(), '书签尚未加载，请稍后下拉', 'retired feedback timer cannot clear newer feedback');
feedback.bookmarkPendingTarget = 'bookmarked'; feedback.bookmarkPendingAnchor = feedback.pageBookmarkFeedbackAnchor();
feedback.onReaderBookmarkGestureUnavailable('unavailable');
assert.equal(feedback.bookmarkFeedbackHintLabel(), '书签正在保存，请稍后再试');
feedbackTimers.at(-1)(); assert.equal(feedback.bookmarkFeedbackHintLabel(), '', 'local feedback retires without changing persistence');
feedback.onReaderBookmarkGestureUnavailable('busy');
const awayFeedbackTimer = feedbackTimers.at(-1);
feedback.visiblePage = { startScalar: 50, endScalar: 100 };
assert.equal(feedback.bookmarkFeedbackHintLabel(), '', 'old-page feedback is hidden on another page');
awayFeedbackTimer();
feedback.visiblePage = { startScalar: 0, endScalar: 50 };
assert.equal(feedback.bookmarkFeedbackHintLabel(), '', 'returning to the old page cannot revive expired feedback');
assert.equal(feedback.bookmarkUnavailableTimer, -1, 'off-page expiry releases its own timer handle');
feedback.onReaderBookmarkGestureUnavailable('busy');
feedback.lifecycleToken++; assert.equal(feedback.bookmarkFeedbackHintLabel(), '', 'feedback never moves into a new lifecycle');
feedbackTimers.at(-1)();
feedback.readingLayout = () => ({ ...feedbackLayout,
  contentTop: feedbackLayout.pageChromeVisualSafeTop + feedbackLayout.pageChromeTopRegionHeight });
feedback.onReaderBookmarkGestureUnavailable('busy');
assert.deepEqual(nativeToasts, ['页面切换中，请稍后下拉'], 'zero whitespace uses one existing native short notice per arena callback');
console.log('PASS bookmark admission: 17 identity/readiness invalidations, pointer-release-before-UP, duplicate UP, retired ACK and zero MOVE scans');
console.log('PASS bookmark feedback: visible pull/cancel labels, transient busy/unknown/pending, stale timer/lifecycle isolation and constrained-space fallback');
console.log('PASS PH86 normal motion: 6 completion orders/12 lifecycles without intermediate inversion; cancelled/failed/page-invalidated/duplicate/old ACK cases');
console.log(`PASS PH86: ${cases.length} real chrome/bookmark Builder geometries, clock/title/cutout separation, native visibility, gesture threshold/rebound/ACK and page/book ownership`);

// Execute the actual three component-call boundaries. Only native font/layout
// leaves are stubbed; a missing primitive Prop connection fails this chain.
const require = createRequire(import.meta.url);
const sdkRoot = resolveEtsLoaderRoot();
const syntax = require(`${sdkRoot}/lib/validate_ui_syntax.js`);
const stageSource = readFileSync(file('ReaderPageTurnStage.ets'), 'utf8');
const readingSource = readFileSync(file('ReadingSurface.ets'), 'utf8');
function registerChild(name, source) {
  syntax.componentCollection.customComponents.add(name);
  syntax.propCollection.set(name, new Set([...source.matchAll(/@Prop\s+(\w+)\s*:/g)].map(m => m[1])));
}
registerChild('ReaderPageTurnSurface', stageSource); registerChild('ReadingSurface', readingSource);
registerChild('ReaderNativeParagraphView', readFileSync(file('ReaderNativeParagraphView.ets'), 'utf8'));
registerChild('ReaderPageChrome', chromeSource); registerChild('ReaderReadingTextFragment', readingSource);
registerChild('ReaderPaperBackground', readFileSync(file('ReaderPaperBackground.ets'), 'utf8'));
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
      COVER_OCCLUSION_RADIUS_VP: 1, COVER_OCCLUSION_OFFSET_X_VP: 1 }, {componentName:'ReaderPageTurnSurface'}).owner;
    Object.assign(slot, page.params, { staticSnapshotId: '', slotIdentity: 'a', shadowColor: () => '#00000000' });
    slot.initialRender();
    const readingParams = [...slot.children.values()][0].params;
    assert.equal(readingParams.chromeTopTranslateY + pull, 0);
    const reading = createReaderBuilderProbe(readingSource.slice(readingSource.lastIndexOf('@Component', readingSource.indexOf('export struct ReadingSurface'))), ['build', 'usesHighlightCanvas'], { ReaderPageChrome: Child, ReaderNativeParagraphView: Child,
      ReaderReadingTextFragment: Child, ReaderPaperBackground: Child, GradientDirection: { Bottom: 'bottom' } }).owner;
    Object.assign(reading, readingParams, { themeStyle: () => ({ sourcePaperLighting: false, paperTexture: false,
      paperStart: '#FFFFFF', paperEnd: '#FFFFFF' }), renderFragments: () => [], pageParagraphs: [],
      showChapterTitle: false, staticSnapshotId: '', contentInsets: () => ({}), layout });
    reading.initialRender();
    const finalParams = [...reading.children.values()].find(child => 'topTranslateY' in child.params).params;
    assert.equal(finalParams.topTranslateY + pull, 0, 'actual Stage → slot → surface → Chrome forwards primitive cancellation');
  }
}
assert.match(lreSource, /\.clip\(true\)\s*\.onTouch/, 'reading viewport retains outer clipping');
console.log('PASS PH86 actual SDK Stage/slot/ReadingSurface/Chrome Prop chain across drag and rebound; outer viewport clip retained');
