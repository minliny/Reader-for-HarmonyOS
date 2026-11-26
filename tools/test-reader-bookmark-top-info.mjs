import assert from 'node:assert/strict';
import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';

async function runCase(selectedCase) {
const geometryCase = selectedCase === 'geometry';
const { resolveEtsLoaderRoot } = await import('./lib/tool-environment.mjs');
const { readFileSync } = await import('node:fs');
const { createRequire, registerHooks } = await import('node:module');
const { createReaderBuilderProbe, productionReaderMotionSdk } = await import('./lib/reader-control-builder-probe.mjs');
const { createArkUIPropertyRuntimeProbe } = await import('./lib/arkui-property-runtime-probe.mjs');
const { productionMotionMethods } = await import('./lib/reader-motion-method-probe.mjs');
const chromeLayout = await import('../entry/src/main/ets/features/reading/ui/ReaderPageChromeLayout.ts');
const { measureReaderPageChromeText, readerPageChromeTextMeasurements, readerPageChromeTopTextStyle } = await import('./lib/reader-page-chrome-measurement-probe.mjs');
const { loadReaderTypographyRoles, readerMessageStyles } = await import('./lib/reader-typography-probe.mjs');
const gesture = await import('../entry/src/main/ets/features/reading/ui/ReaderPageGestureState.ts');
const rapid = await import('../entry/src/main/ets/features/reading/ui/ReaderRapidPageTurnState.ts');
const { mergeReaderControlBookmarkProjection } = await import('../entry/src/main/ets/features/reading/presentation/ReaderControlBookmarkLoad.ts');
const resolution = registerHooks({ resolve(s, c, next) { try { return next(s, c); } catch (e) {
  if (s.startsWith('.') && !s.endsWith('.ts')) return next(`${s}.ts`, c); throw e;
} } });
try {
const { ReaderRectVp: Rect, ReaderDisplayCornerVp: Corner, ReaderWindowMetricsSnapshot: Metrics } =
  await import('../entry/src/main/ets/ui/foundation/ReaderWindowMetrics.ts');
const { resolveReaderReadingLayout, READER_PAGE_CHROME_TOP_ROW_PADDING_VP } =
  await import('../entry/src/main/ets/features/reading/ui/ReaderLayoutGeometry.ts');
const { readerAppearanceThemeStyle, readerAppearanceChromeTone } = await import('../entry/src/main/ets/features/reading/ui/ReaderAppearanceRenderStyle.ts');
const { findReaderTheme, readerAppColor, readerThemeDefinition, READER_THEME_DEFINITIONS } =
  await import('../entry/src/main/ets/ui/foundation/ReaderThemeRegistry.ts');
const bookmarkModel = await import('../entry/src/main/ets/features/reading/presentation/ReaderPageBookmarkModel.ts');
const { ReaderPageBookmarkSnapshot, readerBookmarkRibbonPull, readerBookmarkHintAlpha } = bookmarkModel;
const motion = productionReaderMotionSdk();
const { readerRenderStageKind } = await import('../entry/src/main/ets/features/reading/ui/ReaderRenderStageSpec.ts');
const file = name => new URL(`../entry/src/main/ets/features/reading/ui/${name}`, import.meta.url);
const typography = readFileSync(new URL('../entry/src/main/ets/ui/foundation/ReaderTypography.ets', import.meta.url), 'utf8');
const { TYPE_READER_IMMERSIVE_TIME, TYPE_READER_IMMERSIVE_PROGRESS, TYPE_READER_IMMERSIVE_PAGE_ORDINAL } =
  loadReaderTypographyRoles(typography);
const roles = { TYPE_READER_IMMERSIVE_TIME, TYPE_READER_IMMERSIVE_PROGRESS, TYPE_READER_IMMERSIVE_PAGE_ORDINAL };
const dependencies = { ...chromeLayout, ...roles, ...bookmarkModel, ...readerMessageStyles, readerAppColor, readerThemeDefinition,
  measureReaderPageChromeText, readerPageChromeTopTextStyle, readerAppearanceChromeTone, readerRenderStageKind };
const lreSource = readFileSync(file('LocalReadingExperience.ets'), 'utf8');
const chromeSource = geometryCase ? readFileSync(file('ReaderPageChrome.ets'), 'utf8') : undefined;
const statusPaperSource = geometryCase ? readFileSync(file('ReaderStatusBarPaper.ets'), 'utf8') : undefined;
const paperBackgroundSource = geometryCase ? readFileSync(file('ReaderPaperBackground.ets'), 'utf8') : undefined;
const ActualLayout = geometryCase ? productionMotionMethods(file('LocalReadingExperience.ets'),
  ['readingLayout', 'bookmarkFeedbackTopBoundary', 'bookmarkRibbonPaperTop'], {
    ...dependencies, resolveReaderReadingLayout, READER_PAGE_CHROME_TOP_ROW_PADDING_VP,
    ReaderWindowCoordinator: { metrics: () => actualLayoutMetrics },
  }) : undefined;
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
const bookmarkViewportMembers = ['currentBookmarkViewport', 'currentReadingViewportStart'];
const bookmarkMembers = ['bookmarkCornerFeedback', 'bookmarkCornerLayout', 'bookmarkFeedbackLabel',
  'pageBookmarkFeedbackFilled', 'pageBookmarkFeedbackMode', 'pageBookmarkFeedbackAnchor', 'bookmarkFeedbackOwnerKey',
  'bookmarkUnavailableHintFits', 'bookmarkUnavailableHintCurrent', 'bookmarkHintVisibleAlpha', 'bookmarkFeedbackTopBoundary',
  'bookmarkRibbonPaperTop', 'bookmarkRibbonX', 'continuousBookmarkRibbonFrame', 'currentBookmarkRibbonFrame',
  'bookmarkPullOffset', 'bookmarkPullPaperTop', 'bookmarkPaperWell', 'bookmarkPullFeedbackColor',
  ...bookmarkViewportMembers];
const RibbonSource = readFileSync(file('ReaderPageBookmarkRibbon.ets'), 'utf8');
const ribbonDependencies = { ...dependencies, uiContext: { vp2px: value => value * 3.5 }, GradientDirection: { Bottom: 'bottom' } };
const ribbonProperties = createArkUIPropertyRuntimeProbe();
const GlyphComponent = createReaderBuilderProbe(RibbonSource,
  ['build', 'widthVp', 'pathCommands', 'metricsRevision', 'color', 'filled', 'heightVp'],
  { ...ribbonDependencies, ...ribbonProperties.sdk },
  { ...ribbonProperties.hooks, componentName: 'ReaderPageBookmarkGlyph' }).Component;
ribbonDependencies.ReaderPageBookmarkGlyph = GlyphComponent;
const RibbonComponent = createReaderBuilderProbe(RibbonSource,
  ['build', 'ink', 'x', 'paperTop', 'paperScale', 'offsetY', 'fillHeight', 'alpha', 'night', 'bookmarked'],
  { ...ribbonDependencies, ...ribbonProperties.sdk }, { ...ribbonProperties.hooks,
    componentName: 'ReaderPageBookmarkRibbon', childSources: { ReaderPageBookmarkGlyph: RibbonSource }, mountChildren: true }).Component;
ribbonDependencies.ReaderPageBookmarkRibbon = class extends RibbonComponent {
  constructor(owner, params, storage, id, ...rest) {
    super(owner, params, storage, id, ...rest);
    this.params = { ...params };
  }
  updateStateVars(params) {
    super.updateStateVars(params);
    Object.assign(this.params, params);
  }
};
const ribbonHooks = { childSources: { ReaderPageBookmarkRibbon: RibbonSource }, mountChildren: true };
const ribbonParams = owner => [...owner.children.values()].find(child => 'fillHeight' in child.params)?.params;
const ribbonActor = owner => [...owner.children.values()].find(child => 'fillHeight' in child.params);
// Reuse only the SDK-compiled classes. Every combination gets fresh owners,
// node maps and geometry caches; no mounted actor or fixture state is shared.
const ChromeComponent = geometryCase ? createReaderBuilderProbe(chromeSource, chromeMembers, dependencies).Component : undefined;
const BookmarkComponent = geometryCase ? createReaderBuilderProbe(lreSource, bookmarkMembers, ribbonDependencies, ribbonHooks).Component : undefined;
class StatusPaper { constructor(owner, params, _storage, id) { Object.assign(this, { owner, params, id }); } }
const UnderlayComponent = geometryCase ? createReaderBuilderProbe(lreSource, ['readerStatusBarUnderlay', 'readerStatusBarMetrics'], {
  ReaderStatusBarPaper: StatusPaper, readerAppearanceThemeStyle,
  ReaderWindowCoordinator: { metrics: () => actualLayoutMetrics },
}, { childSources: { ReaderStatusBarPaper: statusPaperSource } }).Component : undefined;
const StatusPaperComponent = geometryCase ? createReaderBuilderProbe(statusPaperSource, ['build'], {
  ReaderPaperBackground: StatusPaper, findReaderTheme,
}, { childSources: { ReaderPaperBackground: paperBackgroundSource } }).Component : undefined;
function publishContinuousViewport(owner, startScalar, endScalar) {
  Object.assign(owner, { continuousVisibleScalar: startScalar,
    continuousVisibleEndFragmentIndex: 0, continuousFragments: [{ endScalar }] });
}
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
    currentChapterIndex: () => 0, currentPageBookmarkStatus: () => 'bookmarked', bookmarkPendingTarget: '', bookmarkGestureAnchor: '',
    bookmarkPreviewStatus: state.currentPageBookmarkStatus?.() ?? 'bookmarked',
    lifecycleToken: 1, chapterSelectionToken: 1, bookmarkUnavailableMessage: '',
    controlVisible: () => false, controlObscured: false, bookmarkPageOffsetY: 0, bookmarkPreviewChanged: false,
    windowChromeActive: true, windowControlsPresented: false, pageTurnRenderRevision: 1, pageTurnOffsetX: 0,
    hasContinuousRenderContent: () => true, readerAppScheme: 'day', bookTitle: chrome.topStartText, pageChromeClockText: time,
    readingLayout: () => layout, getUIContext: () => ui, ...state });
  bookmark.readerSettingsSnapshot = { hideStatusBar: true, navigationMode: 'continuous', ...state.readerSettingsSnapshot };
  bookmark.hasCurrentMaterializedChapter = () => true;
  publishContinuousViewport(bookmark, 0, 50);
  bookmark.visibleReadingAppearance = () => ({ activeTheme: state.activeTheme ?? (state.night ? 'night' : 'paper') });
  bookmark.bookmarkPreviewOwner = bookmark.bookmarkFeedbackOwnerKey();
  if (bookmark.bookmarkUnavailableMessage.length > 0) bookmark.bookmarkUnavailableOwner = bookmark.bookmarkPreviewOwner;
  bookmark.bookmarkCornerLayout();
  if (bookmark.bookmarkPageOffsetY > 0) {
    bookmark.bookmarkRibbonFrame = readerBookmarkRibbonPull(bookmark.bookmarkPageOffsetY,
      bookmark.bookmarkPreviewStatus === 'bookmarked', bookmark.reduceMotion === true);
    bookmark.bookmarkPullHintOpacity = readerBookmarkHintAlpha(bookmark.bookmarkPageOffsetY);
  }
  if (readerRenderStageKind(bookmark.readerSettingsSnapshot.navigationMode, true) === 'paged' && bookmark.bookmarkPullOffset() > 0) {
    bookmark.bookmarkPaperWell();
    bookmark.bookmarkCornerFeedback(true);
  }
  bookmark.bookmarkCornerFeedback();
  const nodes = [...chrome.nodes.values()];
  const actor = ribbonActor(bookmark);
  const actorRoot = actor && [...actor.nodes.values()].find(node => node.type === 'Stack' && node.clip === true && node.position);
  const marker = actor && { ...actor.params, ...actorRoot,
    paths: [...actor.children.values()].flatMap(glyph => [...glyph.nodes.values()].filter(node => node.type === 'Path')) };
  return { chrome, bookmark, paint: [...bookmark.nodes.values()], clock: nodes.find(n => n.type === 'Text' && n.create === time),
    title: nodes.find(n => n.type === 'Text' && n.create.startsWith('A very')),
    marker, icon: marker?.alpha > 0 ? marker : undefined,
    hint: (() => {
      const nodes = [...bookmark.nodes.values()];
      const label = nodes.find(n => n.type === 'Text');
      const group = nodes.find(n => n.type === 'Row' && n.position !== undefined);
      return label === undefined || !group?.opacity ? undefined : { ...label, position: group.position,
        width: group.width, height: group.height, hitTestBehavior: group.hitTestBehavior, opacity: group.opacity };
    })() };
}
function noOverlap(a, b) { return a.x + a.width <= b.x + 1e-8 || b.x + b.width <= a.x + 1e-8; }
function disjoint(a, b) {
  return noOverlap(a, b) || a.y + a.height <= b.y + 1e-8 || b.y + b.height <= a.y + 1e-8;
}
function renderStatusComposition(layout, state) {
  state = { ...state, readerSettingsSnapshot: { navigationMode: 'continuous', ...state.readerSettingsSnapshot } };
  actualLayoutMetrics = layout.pageChromeStatusMetrics;
  const geometry = Object.assign(new ActualLayout(), {
    effectiveViewportWidth: () => layout.viewportWidth, effectiveViewportHeight: () => layout.viewportHeight,
    expandedLayout: false, sessionCapsuleMetrics: () => ({ targetHeight: 0 }), readerSettingsSnapshot: { extendIntoCutout: layout.fixtureExtended, ...state.readerSettingsSnapshot },
    appearanceSnapshot: { activeTheme: state.activeTheme ?? 'paper' },
    bookTitle: 'A very long book title that must not overlap', pageChromeClockText: '12:30',
    getUIContext: () => context(layout.systemFontScale),
  });
  layout = geometry.readingLayout();
  const drawn = render(layout, state);
  drawn.layout = layout;
  const underlay = new UnderlayComponent(undefined, {});
  Object.assign(underlay, { windowChromeActive: true, windowControlsPresented: state.controlVisible?.() === true,
    readerSettingsSnapshot: state.readerSettingsSnapshot, appearanceSnapshot: { activeTheme: state.activeTheme ?? 'paper' },
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
if (geometryCase) {

for (const width of [320, 390, 760]) for (const extended of [false, true]) for (const scale of [1, 1.5, 2]) {
  cases.push(windowLayout(width, new Rect(width / 2 - 41, 0, 82, 32), extended, scale));
}
cases.push(windowLayout(390, new Rect(154, 0, 154, 32), true)); // Right lane fits the clock, not both items.
cases.push(windowLayout(390, new Rect(0, 0, 0, 0), true, 1, 20, 40)); // Small top lane + safe side.
}
if (selectedCase === 'transaction') {
  const one = windowLayout(390, new Rect(154, 0, 82, 32), false); cases.push(one, one);
}
const layout = cases[1];
if (geometryCase) {
const buttonGlyph = new GlyphComponent(undefined, {});
buttonGlyph.initialRender();
const glyphPath = [...buttonGlyph.nodes.values()].find(node => node.type === 'Path');
assert.equal(glyphPath.create.width / glyphPath.create.height, 16 / 34, 'button glyph preserves the ribbon silhouette aspect');
const pathNumbers = commands => [...commands.matchAll(/\d+(?:\.\d+)?/g)].map(match => Number(match[0]));
const originalCoordinates = [1.5, 0.5, 14.5, 33, 8, 27.5, 1.5, 33];
const buttonFactor = 3.5 * glyphPath.create.height / 34;
assert.deepEqual(pathNumbers(glyphPath.create.commands), originalCoordinates.map(value => value * buttonFactor));
let leftFallbacks = 0;
for (const layout of cases) {
  const { clock, title, icon, chrome, bookmark } = render(layout);
  assert.ok(clock && icon, 'immediate chrome and the retained bookmark both project');
  assert.equal(clock.opacity, 1, 'clock is never hidden to make room');
  assert.equal(clock.fontFamily, 'HarmonyOS Sans', 'the chrome uses the platform top text role');
  assert.equal(clock.fontSize, 16, 'resolved resource pixels are converted back to fp exactly once');
  assert.equal(clock.lineHeight, undefined, 'native AUTO line height remains authoritative');
  const clockWidth = Math.min(36 * layout.systemFontScale, clock.constraintSize.maxWidth);
  const a = { ...icon.position, width: icon.width }, b = { ...clock.position, width: clockWidth };
  assert.ok(noOverlap(a, b), `clock and bookmark intersect: ${JSON.stringify({ a, b })}`);
  assert.ok(noOverlap(a, { ...title.position, width: title.constraintSize.maxWidth }), 'title has its own bounded lane');
  assert.equal(icon.position.x, bookmark.bookmarkRibbonX(chrome.chromeLayout()));
  assert.equal(icon.position.y, layout.pageChromeVisualSafeTop, 'immersive ribbon clamps to the visible paper top');
  assert.equal(icon.width, 16);
  assert.equal(icon.height, 34);
  assert.equal(icon.offsetY, -13);
  assert.equal(icon.fillHeight, 34);
  assert.equal(icon.accessibilityText, '本页已添加书签');
  assert.equal(icon.hitTestBehavior, 'HitTestMode.None');
  assert.equal(icon.paths.length, 2, 'one silhouette is painted as stroke plus a clipped fill');
  assert.equal(icon.paths[0].create.commands, icon.paths[1].create.commands);
  assert.deepEqual(pathNumbers(icon.paths[0].create.commands), originalCoordinates.map(value => value * 3.5),
    'the fully sized paper silhouette converts VP coordinates to device pixels exactly once');
  assert.equal(icon.paths[1].fill, readerAppColor('TOK_READ_PRIMARY', 'day'));
  if (a.x < b.x) leftFallbacks++;
  const cutout = layout.pageChromeStatusMetrics.statusBarCutoutRect;
  if (icon.position.y < cutout.top + cutout.height && icon.position.y + icon.height > cutout.top) {
    assert.ok(noOverlap(a, { x: cutout.left, width: cutout.width }), 'bookmark avoids physical cutout');
    assert.ok(noOverlap(b, { x: cutout.left, width: cutout.width }), 'clock avoids physical cutout');
  }
}
assert.ok(leftFallbacks > 0, 'narrow right cutout lane exercises left title-lane fallback');
let statusCompositions = 0;
for (const fixture of cases) for (const hideStatusBar of [false, true]) {
  for (const [status, pull, changed] of [['bookmarked', 0, false], ['empty', 22, false], ['empty', 46, true]]) {
    const state = { readerSettingsSnapshot: { hideStatusBar }, currentPageBookmarkStatus: () => status,
      bookmarkPageOffsetY: pull, bookmarkPreviewChanged: changed };
    const { icon, hint, paper, paperOrder, layout, bookmark, clock } = renderStatusComposition(fixture, state);
    assert.ok(icon, 'saved and both visible drag frames project the retained ribbon');
    const bounds = { ...icon.position, width: icon.width, height: icon.height };
    assert.ok(bounds.y + bounds.height <= layout.contentTop, 'ribbon never covers chapter heading or body');
    assert.equal(icon.fillHeight, status === 'bookmarked' ? 34 : 34 * pull / 46);
    if (!hideStatusBar) {
      assert.ok(paper && paperOrder === 10, 'system status paper retains its original band');
      assert.ok(disjoint(bounds, paper), 'ribbon stays outside the system status crop');
      assert.ok(bounds.y >= bookmark.bookmarkFeedbackTopBoundary(layout));
      assert.equal(clock, undefined, 'native status owns its original clock band');
    } else assert.equal(paper, undefined, 'immersion has no system crop');
    if (hint) {
      const hintBounds = { ...hint.position, width: hint.width, height: hint.height };
      if (paper) assert.ok(disjoint(hintBounds, paper), 'hint remains below the opaque system band');
      assert.ok(hintBounds.y + hintBounds.height <= layout.contentTop + pull, `hint fits the exposed pull area: ${JSON.stringify({hintBounds,contentTop:layout.contentTop,pull,hideStatusBar,safeTop:layout.pageChromeVisualSafeTop,trackHeight:layout.pageChromeTopRegionHeight})}`);
      assert.equal(hint.hitTestBehavior, 'HitTestMode.None');
    }
    statusCompositions++;
  }
  for (const controls of [true, false]) {
    const result = renderStatusComposition(fixture, { readerSettingsSnapshot: { hideStatusBar },
      controlVisible: () => controls, currentPageBookmarkStatus: () => 'bookmarked', bookmarkPageOffsetY: 32 });
    assert.equal(Boolean(result.icon), !controls, 'visible controls give way to their own layers');
    if (controls) { assert.ok(result.paper); assert.equal(result.hint, undefined); }
  }
}
const paperLayout = cases[1];
const night = render(paperLayout, { night: true });
assert.equal(night.icon.paths[1].fill, readerAppColor('TOK_READ_PRIMARY', 'night'));
const empty = render(paperLayout, { currentPageBookmarkStatus: () => 'empty' });
assert.equal(empty.marker.alpha, 0);
assert.equal(empty.marker.offsetY, -34);
assert.equal(empty.hint, undefined);
const reduced = render(paperLayout, { readerSettingsSnapshot: { navigationMode: 'paged' },
  currentPageBookmarkStatus: () => 'empty', reduceMotion: true, bookmarkPullHintOpacity: 0.5 });
assert.equal(reduced.hint.create, '下拉添加书签', 'the reduced hint remains in the quiet slot');
assert.equal(reduced.hint.opacity, 0.5);
assert.ok(!reduced.paint.some(node => node.id === 'reader-bookmark-pull-feedback' || node.id === 'reader-bookmark-paper-well'));
const unavailable = render(paperLayout, { readerSettingsSnapshot: { navigationMode: 'paged' },
  bookmarkUnavailableMessage: '页面切换中，请稍后下拉' });
assert.equal(unavailable.hint.create, '页面切换中，请稍后下拉');
assert.equal(unavailable.hint.hitTestBehavior, 'HitTestMode.None');
assert.equal(unavailable.hint.opacity, 1);
for (const state of [{ controlVisible: () => true }, { controlObscured: true }]) assert.equal(render(paperLayout, state).icon, undefined);
console.log(`PASS ribbon/status composition: ${statusCompositions} actual layouts and SDK paint trees; fixed 16×34 geometry, chrome, cutout, scale and controls`);

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
registerChild('ReaderFacingChapterColumn', readFileSync(file('ReaderFacingChapter.ets'), 'utf8'));
class Child { constructor(owner, params, _storage, id) { Object.assign(this, { owner, params, id }); } }
const stageSourceDefinition = stageSource.slice(stageSource.lastIndexOf('@Component', stageSource.indexOf('export struct ReaderPageTurnStage')));
const StageComponent = createReaderBuilderProbe(stageSourceDefinition, ['build', 'bookmarkEdgeFactor', 'bookmarkClipTop'],
  { ReaderPageTurnSurface: Child }).Component;
function renderStage(pull, layout, paperTop, settings = {}) {
  const frame = readerBookmarkRibbonPull(pull, false, false);
  const stage = new StageComponent(undefined, {});
  Object.assign(stage, { translateY: pull, topInfoMovesWithPage: true, bookmarkRibbon: frame, currentPageSlot: 'a',
    bookmarkPaperTop: paperTop, offsetX: 0, layout, appearance: { activeTheme: 'paper' },
    slotPage: () => ({ fragments: [], bookmark: new ReaderPageBookmarkSnapshot('hidden', 0, 10, 0, 16, 34), chromeTopStartText: 'Book', chromeTopEndText: '12:30' }),
    slotIdentity: slot => slot, slotSnapshotId: () => '', slotX: () => 0,
    slotVisible: slot => slot === 'a', slotLayer: () => 0, slotShadow: () => 0, hasActiveTurn: () => false, ...settings });
  stage.initialRender();
  return stage;
}
function paintNode(nodes, name) { return nodes.find(node => node.id === `reader-bookmark-${name}`); }
const paintByScheme = {
  day: { well: '#172B241D', shadow: [['#002B241D', 0], ['#1F2B241D', 1]], track: '#242B241D', edge: '#2E2B241D' },
  night: { well: '#57000000', shadow: [['#00000000', 0], ['#6B000000', 1]], track: '#29ECE8E0', edge: '#33ECE8E0' },
};
let pullCompositions = 0;
assert.equal(READER_THEME_DEFINITIONS.length, 8);
const pullFixture = cases[0];
for (const theme of READER_THEME_DEFINITIONS) for (const hideStatusBar of [false, true]) {
  // Fixture has a 32vp notch inside a 48vp status bar.
  const paperTop = hideStatusBar ? 32 : 48;
  for (const [pull, labelAlpha, wellAlpha, edgeAlpha, fillWidth, changed, removing] of [
    [0, 0, 0, 0, 0, false, false], [0.5, 0, 0, 0, 0, false, false], [5, 0, 0.5, 5 / 18, 120 / 23, false, false],
    [22, 0.5, 1, 1, 528 / 23, false, false], [46, 0.92, 1, 1, 48, true, false],
    [46, 0.92, 1, 1, 48, false, false], [86, 0.92, 1, 1, 48, true, true], [0, 0, 0, 0, 0, false, false],
  ]) {
    const { bookmark, paint, paper, layout } = renderStatusComposition(pullFixture, {
      readerSettingsSnapshot: { navigationMode: 'paged', hideStatusBar }, activeTheme: theme.id,
      currentPageBookmarkStatus: () => removing ? 'bookmarked' : 'empty',
      bookmarkPageOffsetY: pull, bookmarkPreviewChanged: changed,
    });
    const visualOffset = bookmark.bookmarkPullOffset();
    const stage = renderStage(visualOffset, layout, visualOffset > 0 ? bookmark.bookmarkPullPaperTop(layout) : undefined,
      { appearance: { activeTheme: theme.id } });
    const stagePaint = [...stage.nodes.values()];
    const root = stagePaint.find(node => node.translate?.y !== undefined);
    assert.equal(root.width, '100%');
    assert.equal(root.height, '100%');
    assert.equal(root.clip, true);
    assert.equal(visualOffset, pull <= 0.5 ? 0 : pull);
    assert.equal(root.translate.y, visualOffset > 0 ? paperTop + pull : 0);
    assert.deepEqual(root.borderRadius, { topLeft: 14 * edgeAlpha, topRight: 14 * edgeAlpha, bottomLeft: 0, bottomRight: 0 });
    const edge = paintNode(stagePaint, 'paper-edge');
    if (pull <= 0.5) {
      assert.ok(paint.every(node => typeof node.id !== 'string' || !node.id.startsWith('reader-bookmark-')));
      assert.equal(edge, undefined);
      continue;
    }
    const palette = paintByScheme[theme.scheme];
    const base = paintNode(paint, 'paper-base');
    const well = paintNode(paint, 'paper-well');
    const shadow = paintNode(paint, 'paper-shadow');
    const feedback = paintNode(paint, 'pull-feedback');
    const track = paintNode(paint, 'pull-track');
    const fill = paintNode(paint, 'pull-fill');
    const label = paint.find(node => node.type === 'Text');
    for (const node of [base, well, shadow, edge]) {
      assert.equal(node.width, '100%');
      assert.equal(node.hitTestBehavior, 'HitTestMode.None');
      assert.equal(node.accessibilityLevel, 'no');
    }
    assert.deepEqual(base.position, { x: 0, y: 0 });
    assert.equal(base.backgroundColor, theme.paperStart);
    assert.equal(base.height, paperTop + pull + 18);
    assert.deepEqual(well.position, { x: 0, y: paperTop });
    assert.equal(well.height, pull + 18);
    assert.equal(well.backgroundColor, palette.well);
    assert.equal(well.opacity, wellAlpha);
    assert.ok(paint.indexOf(base) < paint.indexOf(well) && paint.indexOf(well) < paint.indexOf(shadow) &&
      paint.indexOf(shadow) < paint.indexOf(feedback), 'paper base, well and shadow paint under the guidance');
    assert.deepEqual(shadow.linearGradient.colors, palette.shadow);
    assert.equal(shadow.height, pull < 12 ? pull : 12);
    assert.ok(shadow.position.y >= paperTop);
    assert.equal(shadow.position.y + shadow.height, paperTop + pull);
    assert.equal(shadow.opacity, edgeAlpha);
    assert.deepEqual(feedback.position, { x: 0, y: paperTop });
    assert.equal(feedback.height, pull);
    assert.equal(feedback.clip, true);
    assert.equal(feedback.justifyContent, 'FlexAlign.Center');
    assert.equal(feedback.hitTestBehavior, 'HitTestMode.None');
    if (paper) assert.equal(well.position.y, paper.y + paper.height, 'well touches the crop below visible system chrome');
    assert.equal(track.width, 48);
    assert.equal(track.height, 2.5);
    assert.equal(track.clip, true);
    assert.equal(track.backgroundColor, palette.track);
    assert.ok(Math.abs(fill.width - fillWidth) < 1e-10);
    const ink = changed ? readerAppColor(removing ? 'TOK_ACCENT' : 'TOK_READ_PRIMARY', theme.scheme) : theme.chromeMeta;
    assert.equal(fill.backgroundColor, ink);
    if (labelAlpha > 0) {
      assert.equal(label.create, removing ? '松手移除本页书签' : changed ? '松手添加书签' : '下拉添加书签');
      assert.equal(label.fontColor, ink);
      assert.equal(label.fontFamily, readerMessageStyles.MESSAGE_META.fontFamily);
      assert.ok(Math.abs(label.opacity - labelAlpha) < 1e-10);
    } else assert.equal(label, undefined, 'early shallow pulls retain room for the depth indicator');
    assert.equal(edge.height, 1);
    assert.equal(edge.backgroundColor, palette.edge);
    assert.equal(edge.opacity, edgeAlpha);
    assert.equal(edge.position.y + root.translate.y, paperTop + pull, 'rim and page clip use the same moving edge');
    pullCompositions++;
  }
}
console.log(`PASS paper well: ${pullCompositions} active SDK paint trees over 8 themes and both status modes; idle, 0.5vp and rollback endpoints carry no new paint`);
for (const style of ['simulation', 'cover', 'slide', 'none']) {
  for (const blockers of [{}, { reduceMotion: true }, { pageTurnOffsetX: 24 }, { pageTurnDirection: 'next' }]) {
    const { bookmark, paint } = render(layout, { readerSettingsSnapshot: { navigationMode: 'paged' },
      currentPageBookmarkStatus: () => 'empty', bookmarkPageOffsetY: 46, ...blockers });
    const offset = bookmark.bookmarkPullOffset();
    const stage = renderStage(offset, layout, offset > 0 ? bookmark.bookmarkPullPaperTop(layout) : undefined,
      { pageTurnStyle: style, offsetX: blockers.pageTurnOffsetX ?? 0, turnDirection: blockers.pageTurnDirection });
    const active = Object.keys(blockers).length === 0;
    assert.equal(offset, active ? 46 : 0);
    assert.equal(paintNode(paint, 'paper-well') !== undefined, active);
    assert.equal(paintNode([...stage.nodes.values()], 'paper-edge') !== undefined, active);
  }
}
const continuous = render(layout, { bookmarkPageOffsetY: 46 });
assert.ok(continuous.icon && paintNode(continuous.paint, 'paper-well') === undefined,
  'continuous reading retains its host marker and does not mount the paged well');
assert.match(lreSource, /this\.continuousPageChromeContent\(\);\s*}\s*else\s*{\s*if\s*\(this\.bookmarkPullOffset\(\) > 0\)\s*{\s*this\.bookmarkPaperWell\(\);\s*this\.bookmarkCornerFeedback\(true\);\s*}\s*ReaderPageTurnStage\(/,
  'the live reading host mounts pull paint only behind the paged stage');
for (const pull of [0, 8, 46, 18, 0]) {
  const paperTop = pull > 0 ? 32 : undefined;
  const ribbonLayout = { ...layout, contentTop: 56 };
  const stage = renderStage(pull, ribbonLayout, paperTop);
  const root = [...stage.nodes.values()].find(n => n.translate?.y !== undefined);
  assert.ok(root); assert.equal(root.clip, true, 'the physical paper clips the ribbon to its own bounds');
  for (const page of stage.children.values()) {
    assert.equal(page.params.chromeTopTranslateY, 0);
    assert.equal(page.params.bookmarkPaperTop, page.params.slotIdentity === 'a' ? paperTop : undefined);
    const slot = createReaderBuilderProbe(stageSource, ['build'], { ReadingSurface: Child,
      COVER_OCCLUSION_RADIUS_VP: 1, COVER_OCCLUSION_OFFSET_X_VP: 1 }, {componentName:'ReaderPageTurnSurface'}).owner;
    Object.assign(slot, page.params, { staticSnapshotId: '', slotIdentity: 'a', shadowColor: () => '#00000000' });
    slot.initialRender();
    const slotRoot = [...slot.nodes.values()].find(node => node.translate?.x !== undefined);
    if (page.params.slotIdentity === 'a') {
      assert.equal(root.translate.y + (slotRoot.translate.y ?? 0), pull, 'the body moves by the gesture offset alone');
      assert.equal(slotRoot.width, '100%');
      assert.equal(slotRoot.height, '100%');
    }
    const readingParams = [...slot.children.values()][0].params;
    assert.equal(readingParams.chromeTopTranslateY, 0);
    assert.equal(readingParams.bookmarkPaperTop, page.params.bookmarkPaperTop);
    const reading = createReaderBuilderProbe(readingSource.slice(readingSource.lastIndexOf('@Component', readingSource.indexOf('export struct ReadingSurface'))), ['build', 'usesHighlightCanvas', 'pageBookmarkMode', 'pageBookmarkRibbonFrame', 'pageBookmarkRibbonScale'], { ...ribbonDependencies,
      ReaderPageChrome: Child, ReaderNativeParagraphView: Child, ReaderReadingTextFragment: Child,
      ReaderPaperBackground: Child, ReaderFacingChapterColumn: Child,
      GradientDirection: { Bottom: 'bottom' } }, ribbonHooks).owner;
    Object.assign(reading, readingParams, { themeStyle: () => ({ sourcePaperLighting: false, paperTexture: false,
      paperStart: '#FFFFFF', paperEnd: '#FFFFFF' }), renderFragments: () => [], pageParagraphs: [],
      showChapterTitle: false, staticSnapshotId: '', contentInsets: () => ({}), layout: ribbonLayout, dynamicHighlightBlend: () => 0 });
    reading.initialRender();
    const finalParams = [...reading.children.values()].find(child => 'topTranslateY' in child.params).params;
    assert.equal(finalParams.topTranslateY, 0, 'the chrome travels with its physical paper');
    assert.equal(ribbonParams(reading).offsetY, page.params.bookmarkRibbon?.y ?? -34);
    assert.equal(ribbonParams(reading).fillHeight, page.params.bookmarkRibbon?.fillHeight ?? 0);
    assert.equal(ribbonParams(reading).paperTop, page.params.bookmarkPaperTop ?? 0,
      'the ribbon docks to the moved edge and returns to its existing anchor at rest');
    const ribbonRoot = [...ribbonActor(reading).nodes.values()].find(node => node.clip === true && node.position);
    if (page.params.slotIdentity === 'a' && paperTop !== undefined) {
      assert.equal(root.translate.y + (slotRoot.translate.y ?? 0) + ribbonParams(reading).paperTop, paperTop + pull);
      assert.deepEqual(ribbonRoot.scale, { x: 24 / 34, y: 24 / 34, centerX: 0, centerY: 0 },
        'the active ribbon fits under the hidden cutout without covering the first line or moving its anchor');
    } else {
      assert.equal(ribbonRoot.scale, undefined, 'the resting ribbon keeps its original size');
    }
  }
}
assert.match(lreSource, /\.clip\(true\)\s*\.onTouch/, 'reading viewport retains outer clipping');
console.log('PASS PH86 actual SDK Stage/slot/ReadingSurface/Chrome Prop chain across drag and rebound; outer viewport clip retained');
}
if (selectedCase === 'subscription') {
// Replay actual child update closures against visiblePage's nonreactive publication.
function retainedMarker(initial = 'bookmarked') {
  const active = [], subscriptions = new Map();
  const names = [...bookmarkMembers, 'currentPageBookmarkStatus', 'bookmarkMatchesCurrentChapter'];
  const { owner } = createReaderBuilderProbe(lreSource, names, { ...ribbonDependencies, LOCAL_READING_SOURCE_ID: 'local' }, {
    ...ribbonHooks, onObserverEnter(_owner, id) { active.push(id); subscriptions.set(id, new Set()); },
    onObserverExit(_owner, id) { assert.equal(active.pop(), id); },
  });
  const state = { pageTurnRenderRevision: 1, bookmarkRibbonFrame: undefined, bookmarkPendingTarget: '',
    bookmarkPreviewChanged: false, bookmarkUnavailableMessage: '', bookmarkPullHintOpacity: 0, controlObscured: false,
    directoryEntries: [{ index: 0, title: 'C', bookmarks: initial === 'bookmarked' ? [{ time: 1, chapterOffset: 0 }] : [] }] };
  Object.assign(owner, { sourceId: 'local', bookId: 'b', chapter: { chapterIndex: 0 }, bookmarkGestureAnchor: '',
    visiblePage: { startScalar: 0, endScalar: 50 }, lifecycleToken: 1, chapterSelectionToken: 1,
    currentChapterIndex: () => owner.chapter.chapterIndex, controlDirectoryEntries: () => owner.directoryEntries,
    controlVisible: () => false, visibleReadingAppearance: () => ({ activeTheme: 'paper' }),
    readerSettingsSnapshot: { navigationMode: 'continuous', hideStatusBar: true }, hasContinuousRenderContent: () => true,
    hasCurrentMaterializedChapter: () => true,
    readingLayout: () => ({ pageChromeVisualSafeTop: 0 }),
    bookmarkCornerLayout: () => ({ topAccessoryWidth: 16, topAccessoryHeight: 16, topAccessoryX: 0, topAccessoryY: 0 }),
  });
  publishContinuousViewport(owner, 0, 50);
  for (const key of Object.keys(state)) Object.defineProperty(owner, key, {
    get() { const id = active.at(-1); if (id !== undefined) subscriptions.get(id).add(key); return state[key]; },
  });
  owner.bookmarkCornerFeedback();
  const actor = ribbonActor(owner);
  const observerCount = owner.observers.length;
  return { owner, actor,
    marker: () => ribbonParams(owner),
    update(key, value) {
      state[key] = value;
      const ids = [...subscriptions].filter(([, keys]) => keys.has(key)).map(([id]) => id);
      owner.replayOnly(ids);
      assert.equal(owner.observers.length, observerCount, 'page updates retain the original ribbon');
      assert.equal(ribbonActor(owner), actor);
      return ids;
    },
    page(startScalar, endScalar) {
      publishContinuousViewport(owner, startScalar, endScalar);
      return this.update('pageTurnRenderRevision', state.pageTurnRenderRevision + 1);
    },
  };
}
const retained = retainedMarker();
assert.equal(retained.marker().alpha, 1, 'bookmarked page initially paints its marker');
assert.ok(retained.page(50, 100).includes(retained.actor.id), 'ribbon update subscribes to the page revision');
assert.equal(retained.marker().alpha, 0);
retained.page(0, 50);
assert.equal(retained.marker().alpha, 1);
assert.equal(retained.marker().fillHeight, 34);
for (let page = 1; page <= 4; page++) {
  retained.page(page * 50, (page + 1) * 50);
  assert.equal(retained.marker().alpha, 0);
}
const pulling = retainedMarker('empty');
pulling.owner.bookmarkPreviewOwner = pulling.owner.bookmarkFeedbackOwnerKey();
pulling.update('bookmarkRibbonFrame', readerBookmarkRibbonPull(24, false, false));
assert.ok(pulling.marker().alpha > 0, 'active page paints the admitted pull');
pulling.page(50, 100);
assert.equal(pulling.marker().alpha, 0, 'the old pull cannot paint another page');
console.log('PASS retained SDK bookmark ribbon: A/B/A, four unmarked pages and stale pull isolations');
}
if (selectedCase === 'transaction') {
// Production gesture state and real Host ACK bridge: threshold preview,
// rebound, late write/projection, page/book changes and failed deletion.
assert.deepEqual(motion.motionAnimateParam('reader.bookmark.rollback'), { duration: 300, curve: [0.2, 0, 0, 1] });
assert.equal(motion.readerMotionReducedFadeParam().duration, 120);
const vibrationRequests = [];
const bookmarkMotionDeps = { ...gesture, ...bookmarkModel, ...motion, LOCAL_READING_SOURCE_ID: 'local',
  readerMotionStandardCurve: () => ({ interpolate: fraction => fraction }),
  vibrator: { startVibration: (effect, options) => { vibrationRequests.push({ effect, options }); return Promise.resolve(); } } };
const H = productionMotionMethods(file('LocalReadingExperience.ets'), ['onReaderBookmarkGestureStateChanged',
  'onReaderBookmarkGestureReleased', 'animateBookmarkRollback', 'finishBookmarkRollback', 'bookmarkMatchesCurrentChapter', 'toggleCurrentPageBookmark', 'currentPageBookmarkStatus',
  'pageBookmarkFeedbackAnchor', 'pageBookmarkFeedbackFilled', 'reconcilePageBookmarkFeedback',
  'canStartReaderBookmarkGesture', 'isReaderBookmarkGestureCurrent', 'bookmarkFeedbackOwnerKey', ...bookmarkViewportMembers], bookmarkMotionDeps);
let entries = [{ index: 0, title: 'C', bookmarks: [] }], pending = [];
const host = Object.assign(new H(), { mounted: true, sourceId: 'local', bookId: 'b', visiblePage: { startScalar: 0, endScalar: 50 },
  readerSettingsSnapshot: { navigationMode: 'paged' },
  currentChapterIndex: () => 0, currentPageBookmarkText: () => 'body', controlDirectoryEntries: () => entries,
  bookmarkPendingTarget: '', bookmarkPreviewChanged: false, bookmarkRollbackGeneration: 0, bookmarkMutationGeneration: 0,
  bookmarkGestureAnchor: '', lifecycleToken: 1, chapterSelectionToken: 1, pagePointerEpoch: 1, pageTurnInputRevision: 1,
  canTurnPage: () => true, isReaderPageInteractionEnabled: () => true, pageTurnTapOnlyInput: () => false,
  reduceMotion: true, appForeground: false, flushDeferredPageChromeState() {}, usesBookTurnSimulation: () => false,
  bookmarkWriteEnabled: () => true, getUIContext: () => ({ animateTo: (options, closure) => { closure(); options.onFinish(); } }),
  onTogglePageBookmark: r => pending.push(r) });
assert.equal(host.canStartReaderBookmarkGesture(), true);
let drag = gesture.beginReaderPageGesture(390, 200, 400, 0, 844);
drag = gesture.moveReaderPageGesture(drag, 0, 24); host.onReaderBookmarkGestureStateChanged(drag);
assert.equal(host.pageBookmarkFeedbackFilled(), false);
drag = gesture.moveReaderPageGesture(drag, 0, 96); host.onReaderBookmarkGestureStateChanged(drag);
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

// Normal-motion rebound holds the released target until both the animation
// and canonical projection are complete. ACK/projection are controlled inputs;
// the production methods, marker cache and merge remain unmodified.
const pointerReleaseTicks = [];
const Normal = productionMotionMethods(file('LocalReadingExperience.ets'), [
  'onReaderBookmarkGestureStateChanged', 'onReaderBookmarkGestureReleased', 'animateBookmarkRollback', 'finishBookmarkRollback',
  'bookmarkMatchesCurrentChapter', 'toggleCurrentPageBookmark', 'currentPageBookmarkStatus', 'pageBookmarkFeedbackAnchor',
  'pageBookmarkFeedbackFilled', 'reconcilePageBookmarkFeedback', 'canStartReaderBookmarkGesture',
  'isReaderBookmarkGestureCurrent', 'bookmarkFeedbackOwnerKey', 'bookmarkPullFeedbackColor',
  'onReaderPageGestureStateChanged',
  'acquirePagePointer', 'releasePagePointer', 'pageTurnTapOnlyInput', 'regrabPageTurn',
  'controlDirectorySourceEntries', 'controlDirectoryEntries', 'invalidatePageTurnRuntime', ...bookmarkViewportMembers,
], { ...bookmarkMotionDeps, ...rapid,
  setTimeout: callback => { pointerReleaseTicks.push(callback); return pointerReleaseTicks.length; } });
function normalHost(bookmarked = false) {
  const requests = [], animations = [], reboundFrames = [];
  const h = Object.assign(new Normal(), { mounted: true, sourceId: 'local', bookId: 'b', chapter: undefined,
    readerSettingsSnapshot: { navigationMode: 'paged' },
    visiblePage: { startScalar: 50, endScalar: 100 },
    directoryEntries: [{ index: 16, title: 'chapter17', bookmarks: bookmarked ? [{ time: 10, chapterOffset: 50 }] : [] }],
    tocEntries: [], currentChapterIndex: () => 16, currentPageBookmarkText: () => 'text', canTurnPage: () => true,
    bookmarkPendingTarget: '', bookmarkPreviewChanged: false, bookmarkRollbackGeneration: 0, bookmarkMutationGeneration: 0,
    bookmarkGestureAnchor: '', lifecycleToken: 1, chapterSelectionToken: 1, pagePointerEpoch: 1, pageTurnInputRevision: 1,
    pageTurnGestureState: gesture.createReaderPageGestureState(), pageTurnInputOwned: false,
    isReaderPageInteractionEnabled: () => true, bookmarkWriteEnabled: () => true, usesBookTurnSimulation: () => false,
    reduceMotion: false, appForeground: false, flushDeferredPageChromeState() {},
    autoPageCoordinator: { cancelPendingTurn() {} },
    onTogglePageBookmark: r => requests.push(r),
    getUIContext: () => ({
      animateTo: (options, closure) => { animations.push(options.onFinish); closure(); },
      createAnimator: options => ({
        play() {
          assert.equal(options.duration, 300);
          assert.equal(options.begin, 0);
          assert.equal(options.end, 1);
          reboundFrames.push(fraction => this.onFrame(fraction));
          animations.push(() => this.onFinish());
        },
        cancel() { this.onCancel(); },
      }),
    }),
    rapidPageTurnState: rapid.createReaderRapidPageTurnState(),
    autoPageCoordinator: { cancelPendingTurn() {} },
    clearPageTurnProjection() {}, finishPageTurnPerf() {}, cancelPageTurnSettlementDeadline() {},
    clearBookTurnCapturedIdentities() {}, releaseBookTurnTextureContent() {}, releaseBookTurnPendingSnapshot() {},
    releaseUnretainedReadingImages() {},
  });
  return { h, requests, animations, reboundFrames };
}
for (const reduceMotion of [false, true]) {
  const { h } = normalHost();
  Object.assign(h, { reduceMotion, visibleReadingAppearance: () => ({ activeTheme: 'paper' }) });
  assert.equal(h.canStartReaderBookmarkGesture(), true);
  let state = gesture.beginReaderPageGesture(390, 200, 300, 0, 844);
  const startingPulses = vibrationRequests.length;
  for (const [dx, dy, armed, pulses] of [
    [0, 24, false, 0], [0, 96, true, 1], [0, 110, true, 1],
    [150, 96, false, 1], [0, 96, true, 2], [0, 24, false, 2],
  ]) {
    state = gesture.moveReaderPageGesture(state, dx, dy);
    h.onReaderBookmarkGestureStateChanged(state);
    assert.equal(h.bookmarkPullFeedbackColor(), armed ? readerAppColor('TOK_READ_PRIMARY', 'day') :
      readerThemeDefinition('paper').chromeMeta);
    assert.equal(vibrationRequests.length - startingPulses, reduceMotion ? 0 : pulses,
      'the same armed state switches the feedback ink and requests a single new haptic per crossing');
  }
  if (!reduceMotion) assert.deepEqual(vibrationRequests.at(-1), {
    effect: { type: 'time', duration: 10 }, options: { usage: 'touch' },
  });
}
function normalRelease(h, cancelled = false) {
  assert.equal(h.canStartReaderBookmarkGesture(), true);
  let state = gesture.beginReaderPageGesture(390, 200, 300, 0, 844);
  state = gesture.moveReaderPageGesture(state, 0, 96);
  const decision = gesture.settleReaderPageGesture(state, 0, cancelled ? 10 : 96);
  h.pageTurnGestureState = decision.state;
  h.onReaderBookmarkGestureStateChanged(decision.state);
  h.onReaderBookmarkGestureReleased(decision.bookmarkChanged);
}
// Exercise the real Layer -> Host release order. The Host already receives
// bookmark settling before raw pointer release and the business UP callback;
// blocking new DOWN must not change the predicate that admits this same UP.
const ReboundInput = productionMotionMethods(file('ReaderPageInteractionLayer.ets'),
  ['acceptCurrentInput', 'startRawPointer', 'handleTouch', 'cancelPan', 'resetRawPointer'],
  { ...gesture, TouchType: { Down: 'down', Up: 'up', Move: 'move', Cancel: 'cancel' } });
for (const reduced of [false, true]) for (const cancelled of [false, true]) {
  const { h, requests, animations, reboundFrames } = normalHost();
  Object.assign(h, { activePagePointerId: -1, reduceMotion: reduced,
    pageTurnFrozenRevision: 0, pageTurnRenderRevision: 0, pageTurnSessionCapsuleFrozen: true });
  assert.equal(h.acquirePagePointer(11), true);
  assert.equal(h.canStartReaderBookmarkGesture(), true);
  const drag = gesture.moveReaderPageGesture(gesture.beginReaderPageGesture(390, 200, 300, 0, 844), 0, 96);
  h.onReaderPageGestureStateChanged(drag); h.onReaderBookmarkGestureStateChanged(drag);
  const decision = gesture.settleReaderPageGesture(drag, 0, cancelled ? 10 : 96);
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
    const releasedOffset = h.bookmarkPageOffsetY;
    assert.ok(releasedOffset > 0, 'releasing a visible drag retains the moving paper and well for rebound');
    reboundFrames[0](0.5);
    assert.equal(h.bookmarkPageOffsetY, releasedOffset / 2, 'normal rebound delivers intermediate paper offsets');
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
    assert.equal(animations.length, 1, 'reduced motion retains a 120ms alpha settlement');
    assert.equal(reboundFrames.length, 0, 'reduced motion never starts the paper animator');
    assert.equal(h.bookmarkPageOffsetY, 0);
    assert.equal(h.bookmarkRibbonFrame.y, -13);
    animations[0]();
  }
  assert.equal(h.pageTurnGestureState.phase, 'idle');
  assert.equal(h.pageTurnInputOwned, false);
  assert.equal(h.bookmarkPageOffsetY, 0);
  assert.equal(h.bookmarkRibbonFrame, undefined);
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
  const drag = gesture.moveReaderPageGesture(gesture.beginReaderPageGesture(390, 200, 300, 0, 844), 0, 96);
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
  systemCancelPreviews.push({ bookmarked, changed: h.bookmarkPreviewChanged, filled: h.pageBookmarkFeedbackFilled() });
  animations[0](); assert.equal(h.pageBookmarkFeedbackFilled(), bookmarked);
}
assert.deepEqual(systemCancelPreviews, [
  { bookmarked: false, changed: false, filled: false },
  { bookmarked: true, changed: false, filled: true },
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
invalidated.reboundFrames[0](0.5);
assert.equal(invalidated.h.bookmarkPageOffsetY, 0, 'a stale rebound frame cannot reopen the well');
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
  h.pageTurnGestureState = gesture.moveReaderPageGesture(gesture.beginReaderPageGesture(390, 200, 300, 0, 844), 0, 96);
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
  gesture.moveReaderPageGesture(gesture.beginReaderPageGesture(390, 200, 300, 0, 844), 0, 96), 0, 10).state;
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
for (const dy of [24, 32, 48, 96, 20]) {
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
  for (const dy of [24, 32, 48, 96]) {
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
  'onReaderBookmarkGestureUnavailable', 'bookmarkUnavailableHintFits', 'bookmarkFeedbackOwnerKey',
  'bookmarkUnavailableHintCurrent', 'bookmarkCornerLayout', 'pageBookmarkFeedbackAnchor', ...bookmarkViewportMembers,
], { ...dependencies, setTimeout: callback => { feedbackTimers.push(callback); return feedbackTimers.length; }, clearTimeout() {} });
const feedbackLayout = { ...cases[1], contentTop: cases[1].contentTop + 80 };
const feedback = Object.assign(new Feedback(), { mounted: true, lifecycleToken: 1, chapterSelectionToken: 1,
  sourceId: 'local', bookId: 'b', visiblePage: { startScalar: 0, endScalar: 50 }, currentChapterIndex: () => 0,
  bookmarkUnavailableMessage: '', bookmarkUnavailableGeneration: 0, bookmarkUnavailableTimer: -1,
  bookmarkPendingTarget: '', bookmarkPageOffsetY: 0, currentPageBookmarkStatus: () => 'unknown',
  readerSettingsSnapshot: { hideStatusBar: true },
  isReaderPageInteractionEnabled: () => true, readingLayout: () => feedbackLayout, bookmarkWriteEnabled: () => true,
  isSessionActive: () => true, appForeground: true, windowChromeActive: true,
  transientFeedback: { show: (_context, options, current) => { if (current()) nativeToasts.push(options.message); } },
  pageChromeClockText: '12:30', bookTitle: 'Book',
  getUIContext: () => ({ ...context(feedbackLayout.systemFontScale),
    getPromptAction: () => ({ showToast: options => nativeToasts.push(options.message) }) }) });
feedback.onReaderBookmarkGestureUnavailable('busy');
assert.equal((feedback.bookmarkUnavailableHintCurrent() ? feedback.bookmarkUnavailableMessage : ''), '页面切换中，请稍后下拉');
const oldFeedbackTimer = feedbackTimers.at(-1);
feedback.onReaderBookmarkGestureUnavailable('unavailable');
assert.equal((feedback.bookmarkUnavailableHintCurrent() ? feedback.bookmarkUnavailableMessage : ''), '书签尚未加载，请稍后下拉');
oldFeedbackTimer(); assert.equal((feedback.bookmarkUnavailableHintCurrent() ? feedback.bookmarkUnavailableMessage : ''), '书签尚未加载，请稍后下拉', 'retired feedback timer cannot clear newer feedback');
feedback.bookmarkPendingTarget = 'bookmarked'; feedback.bookmarkPendingAnchor = feedback.pageBookmarkFeedbackAnchor();
feedback.onReaderBookmarkGestureUnavailable('unavailable');
assert.equal((feedback.bookmarkUnavailableHintCurrent() ? feedback.bookmarkUnavailableMessage : ''), '书签正在保存，请稍后再试');
feedbackTimers.at(-1)(); assert.equal((feedback.bookmarkUnavailableHintCurrent() ? feedback.bookmarkUnavailableMessage : ''), '', 'local feedback retires without changing persistence');
feedback.onReaderBookmarkGestureUnavailable('busy');
const awayFeedbackTimer = feedbackTimers.at(-1);
feedback.visiblePage = { startScalar: 50, endScalar: 100 };
assert.equal((feedback.bookmarkUnavailableHintCurrent() ? feedback.bookmarkUnavailableMessage : ''), '', 'old-page feedback is hidden on another page');
awayFeedbackTimer();
feedback.visiblePage = { startScalar: 0, endScalar: 50 };
assert.equal((feedback.bookmarkUnavailableHintCurrent() ? feedback.bookmarkUnavailableMessage : ''), '', 'returning to the old page cannot revive expired feedback');
assert.equal(feedback.bookmarkUnavailableTimer, -1, 'off-page expiry releases its own timer handle');
feedback.onReaderBookmarkGestureUnavailable('busy');
feedback.lifecycleToken++; assert.equal((feedback.bookmarkUnavailableHintCurrent() ? feedback.bookmarkUnavailableMessage : ''), '', 'feedback never moves into a new lifecycle');
feedbackTimers.at(-1)();
feedback.readingLayout = () => ({ ...feedbackLayout,
  contentTop: feedbackLayout.pageChromeVisualSafeTop + feedbackLayout.pageChromeTopRegionHeight });
feedback.onReaderBookmarkGestureUnavailable('busy');
assert.deepEqual(nativeToasts, ['页面切换中，请稍后下拉'], 'zero whitespace uses one existing native short notice per arena callback');
console.log('PASS bookmark admission: 17 identity/readiness invalidations, pointer-release-before-UP, duplicate UP, retired ACK and zero MOVE scans');
console.log('PASS bookmark feedback: visible pull/cancel labels, transient busy/unknown/pending, stale timer/lifecycle isolation and constrained-space fallback');
console.log('PASS PH86 normal motion: 6 completion orders/12 lifecycles without intermediate inversion; cancelled/failed/page-invalidated/duplicate/old ACK cases');

}

} finally { resolution.deregister(); }
}
for (const id of selectContractCases({
  'geometry': { description: 'Actual chrome/bookmark/status-paper SDK geometry and Stage-to-Chrome Prop chain', resources: [] },
  'subscription': { description: 'Retained SDK marker subscriptions and A/B/A page/revision delivery', resources: [] },
  'transaction': { description: 'Production bookmark gesture, pointer/rebound and ACK/projection completion orders', resources: [] },
})) { await runCase(id); recordContractCasePass(id); }
