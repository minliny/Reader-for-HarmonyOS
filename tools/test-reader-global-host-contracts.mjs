import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';
import { pureModuleProbe } from './lib/ets-pure-module-probe.mjs';
import { createReaderBuilderProbe } from './lib/reader-control-builder-probe.mjs';
import { boundedSurfaceSdk, boundedMembers } from './lib/bounded-surface-sdk-probe.mjs';
import { readerTypographyRoles } from './lib/reader-typography-probe.mjs';
import { readerFoundationTokens } from './lib/reader-tokens-probe.mjs';
import { readerAppColor } from '../entry/src/main/ets/ui/foundation/ReaderThemeRegistry.ts';
import { READER_FONT_NOTO_SANS_SC_UI_REGULAR } from '../entry/src/main/ets/ui/foundation/ReaderFontFamilies.ts';
import * as geometry from '../entry/src/main/ets/features/reading/ui/ReaderLayoutGeometry.ts';
import * as controls from '../entry/src/main/ets/features/reading/ui/ReaderControlGeometry.ts';
import { readerControlAppearanceEndpoint } from '../entry/src/main/ets/features/reading/ui/ReaderControlAppearanceGeometry.ts';
import { createDefaultReaderWindowMetrics } from '../entry/src/main/ets/ui/foundation/ReaderWindowMetrics.ts';

registerHooks({ resolve(specifier, context, next) {
  try { return next(specifier, context); }
  catch (error) {
    if (error.code === 'ERR_MODULE_NOT_FOUND' && specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier))
      return next(specifier + '.ts', context);
    throw error;
  }
} });

const { readerControlReplaceEndpoint } = await import('../entry/src/main/ets/features/reading/ui/ReaderControlReplaceGeometry.ts');

const selected = selectContractCases({
  'recovery-floating': { description: 'Actual reader body/control layout and floating notice anchors across widths/scales, with old measured-obstruction negative', resources: [] },
  'module-live-input': { description: 'All seven retained reading-module input owners reject a stale parent receipt while their native Prop remains enabled', resources: [] },
  'watch-parent-notifications': { description: 'Actual directory-tree, TTS selection and rules recovery child notifications cannot synchronously mutate rendering parents', resources: [] },
  'capsule-budget': { description: 'Actual native text extents grow static/launch capsule paint inside a 44vp carrier and paid footer', resources: [] },
  'standalone-prefix-sdk': { description: 'Actual full-directory short prefix lowers and emits its real header, tabs, query and footer builders', resources: [] },
  'standalone-short': { description: 'Full directory short windows keep chrome and tree/flat/bookmark content in one reachable native List', resources: [] },
  'standalone-bookmark': { description: 'Standalone directory bookmark natural row and virtual List extent share the current typography budget', resources: [] },
  'compact-roles': { description: 'Quick back and replacement header retain compact paint inside their native hit carriers', resources: [] },
  'render-followups': { description: 'Actual page-turn readiness, temporary-layer and pointer Watch parent notifications run after render', resources: [] },
  'manga-retry': { description: 'Actual manga download failure retry pays both target axes and rejects obsolete failure callbacks', resources: [] },
});
const read = file => readFileSync(new URL('../entry/src/main/ets/' + file, import.meta.url), 'utf8');
const ui = name => read('features/reading/ui/' + name + '.ets');
const pageChrome = await import('../entry/src/main/ets/features/reading/ui/ReaderPageChromeLayout.ts');
const { READER_SESSION_CAPSULE_MIN_TARGET_HEIGHT } = pageChrome;
const capsuleSource = ui('ReaderSessionCapsule');
const capsuleMeasureSource = capsuleSource.slice(0, capsuleSource.indexOf('/** The static capsule'));
const textMeasurement = pureModuleProbe(ui('ReaderControlTextMeasurement'), 'ReaderControlTextMeasurement.ets', {
  WordBreak: { BREAK_WORD: 'break-word' },
}, ['measureReaderControlText']);
const capsuleMeasurement = pureModuleProbe(capsuleMeasureSource, 'ReaderSessionCapsuleMeasure.ets', {
  ...readerTypographyRoles, ...textMeasurement, READER_SESSION_CAPSULE_MIN_TARGET_HEIGHT,
}, ['measureReaderSessionCapsule', 'readerSessionCapsuleMinimumWidth']);
const { buildReaderSessionLaunchGeometry, sampleReaderSessionLaunch } = await import('../entry/src/main/ets/features/reading/ui/ReaderSessionLaunchPresentation.ts');
const { READER_SESSION_LAUNCH_DURATION_MS } = await import('../entry/src/main/ets/features/reading/ui/ReaderSessionLaunchTimeline.ts');
const { ReaderSessionMorphSourceMeasurement } = await import('../entry/src/main/ets/features/reading/ui/ReaderSessionMorphState.ts');
const { readerFullDirectoryHeights } = await import('../entry/src/main/ets/features/reading/presentation/ReaderFullDirectoryBudget.ts');
const listPositioning = await import('../entry/src/main/ets/features/reading/ui/ReaderControlListPositioning.ts');
const { READER_BOOKMARK_RIBBON_HEIGHT } = await import('../entry/src/main/ets/features/reading/presentation/ReaderPageBookmarkModel.ts');
const deps = { ...readerTypographyRoles, ...readerFoundationTokens, ...geometry, ...controls,
  readerAppColor, ...capsuleMeasurement, READER_FONT_NOTO_SANS_SC_UI_REGULAR, readerControlAppearanceEndpoint, readerControlReplaceEndpoint };
const owner = (source, methods, extra = {}, hooks = {}) => createReaderBuilderProbe(source, methods, { ...deps, ...extra }, hooks).owner;

for (const id of selected) {
  if (id === 'recovery-floating') {
    const metrics = createDefaultReaderWindowMetrics();
    metrics.systemInsets.top = 24; metrics.navigationInsets.bottom = 24;
    const source = ui('LocalReadingExperience');
    const model = owner(source, ['readingLayout', 'controlLayout', 'sessionCapsuleMetrics', 'readerRecoveryBaseLayout', 'readerRecoveryTop', 'readerRecoveryViewportHeight',
      'bookmarkRibbonPaperTop', 'bookmarkFeedbackTopBoundary'], {
      READER_BOOKMARK_RIBBON_HEIGHT, ReaderWindowCoordinator: { metrics: () => metrics }, readerReadingTopBarFontsReady: () => true,
    });
    Object.assign(model, { sourceId: 'local', bookId: 'current', viewportWidth: 366, viewportHeight: 844,
      effectiveViewportWidth() { return this.viewportWidth; }, effectiveViewportHeight() { return this.viewportHeight; },
      readerSettingsSnapshot: { navigationMode: 'paged', extendIntoCutout: false }, appearanceSnapshot: {}, recoveryTopBarRevision: -1,
      getUIContext: () => ({}), controlVisible: () => false, readerRecoveryTopBarHeight: () => 54, controlMinimumRevision: 0,
    });
    for (const [width, height] of [[320, 568], [366, 844], [568, 320], [760, 960]]) for (const scale of [1, 1.3, 1.6, 2]) {
      Object.assign(model, { viewportWidth: width, viewportHeight: height, expandedLayout: width >= 600 });
      metrics.revision++; metrics.systemFontScale = scale;
      model.readerRecoveryBottom = 0;
      model.sessionLaunch = undefined; model.ttsState = { status: 'idle' };
      model.autoPageState = { status: 'stopped' };
      const body = model.readingLayout(), control = model.controlLayout(metrics.revision);
      model.readerRecoveryView = { visible: true, canRetry: true, generation: 11 };
      model.readerRecoveryBottom = 180;
      model.readingLayoutCache = undefined; model.controlLayoutCache = undefined;
      model.ttsState = { status: 'playing' };
      model.sessionLaunch = { geometry: { type: 'tts' } };
      const floatingBody = model.readingLayout(), floatingControl = model.controlLayout(metrics.revision);
      assert.equal(floatingBody.contentTop, body.contentTop, 'floating notice cannot move the pagination origin');
      assert.equal(floatingBody.bodyHeight(false), body.bodyHeight(false));
      assert.equal(floatingControl.fullPanelTop, control.fullPanelTop, 'notice cannot reduce full-control expansion');
      assert.equal(floatingControl.fullPanelHeight, control.fullPanelHeight);
      assert.ok(model.readerRecoveryViewportHeight() <= height / 3);
      const stableBottom = floatingBody.contentBottom;
      metrics.keyboardInsets.bottom = 300; metrics.revision++;
      const withKeyboard = model.readingLayout();
      assert.equal(withKeyboard.contentBottom, stableBottom, 'temporary IME cannot inflate the stable reading footer budget');
      metrics.keyboardInsets.bottom = 0; metrics.revision++;
      model.sessionLaunch = undefined; model.ttsState = { status: 'idle' };
      assert.equal(model.readingLayout().contentBottom, stableBottom, 'inactive and launch share the same paid lane');
      assert.ok(Number.isFinite(stableBottom));
      metrics.keyboardInsets.bottom = 300;
      const resizedBody = geometry.resolveReaderReadingLayout(width, Math.max(220, height - 300), width >= 600, metrics,
        false, undefined, 0, 0, undefined, 0, floatingBody.pageChromeFooterHeight);
      assert.equal(resizedBody.contentBottom, stableBottom, 'RESIZE changes the viewport without charging keyboard a second time');
      metrics.keyboardInsets.bottom = 0;
      const oldBody = geometry.resolveReaderReadingLayout(width, height, width >= 600, metrics, false, undefined, 0, 180);
      if (width < height && width < 600) assert.notEqual(oldBody.contentTop, body.contentTop, 'old notice obstruction changes the body');
    }
  }
  if (id === 'module-live-input') {
    const samples = [
      ['Appearance', ['fullInput'], 'fullInput'], ['AutoPage', ['fullInput'], 'fullInput'],
      ['Replace', ['fullInput'], 'fullInput'], ['Settings', ['fullInput'], 'fullInput'],
      ['Tts', ['fullInput'], 'fullInput'], ['Search', ['canSearch'], 'canSearch'],
      ['Directory', ['toolbarInteractive'], 'toolbarInteractive'],
    ];
    for (const [name, methods, guard] of samples) {
      const source = ui('ReaderControl' + name + 'Content');
      const model = owner(source, ['currentInputEnabled', ...methods]);
      let live = true;
      Object.assign(model, { interactionEnabled: true, inputCurrent: () => live, mounted: true, queryInputMounted: true,
        query: '章节', state: { kind: 'idle' }, motionProgress: 1, progress: 1, shortContent: true, p: () => 1 });
      assert.equal(model[guard](), true, name + ' current input is admitted');
      const retained = () => model[guard]();
      live = false;
      assert.equal(model.interactionEnabled, true, 'native Prop deliberately remains the old enabled snapshot');
      assert.equal(retained(), false, name + ' retained owner rejects the invalidated parent receipt');
      live = true;
      assert.equal(retained(), true, name + ' resumes only after parent admission');
      const unguarded = source.replace('this.interactionEnabled && (this.inputCurrent?.() ?? true)', 'this.interactionEnabled');
      assert.notEqual(unguarded, source);
      const old = owner(unguarded, ['currentInputEnabled', ...methods]);
      Object.assign(old, model, { inputCurrent: () => false });
      assert.equal(old[guard](), true, name + ' old enabled snapshot would admit this stale input');
    }
    // Execute each actual parent Builder as well as the leaf guard. This
    // catches a missing/wrong module binding even when all leaf helpers pass.
    class ModuleChild {
      constructor(parent, params, _storage, id) { Object.assign(this, { owner: parent, params, id }); }
    }
    const names = ['Appearance', 'AutoPage', 'Directory', 'Replace', 'Search', 'Settings', 'Tts'];
    const children = Object.fromEntries(names.map(name => ['ReaderControl' + name + 'Content', ModuleChild]));
    const childSources = Object.fromEntries(names.map(name => ['ReaderControl' + name + 'Content', ui('ReaderControl' + name + 'Content')]));
    const panel = owner(ui('ReaderControlPanel'), ['controlContent', 'appearanceContent', 'appearanceModuleContent',
      'searchModuleContent', 'settingsModuleContent', 'ttsModuleContent', 'autoPageModuleContent', 'replaceModuleContent'], {
      ...children, readerPageTurnStyle: () => 'slide', DEBUG: false,
    }, { childSources });
    let active = '', live = true;
    Object.assign(panel, { contentLocation: () => ({ level: 'secondary', module: active, form: 'full' }),
      contentInputEnabled: () => live, secondaryModuleInputEnabled: module => live && active === module,
      frame: () => ({ content: { width: 300, height: 600 }, visibility: 1 }),
      contentEndpointHeight: () => 600, isExpanded: () => false, canStepChapter: () => true,
      listSessionKey: () => 'current', settingsSnapshot: {}, appearanceSnapshot: {}, launchSample: undefined,
    });
    for (const [module, builder] of [['directory', 'controlContent'], ['appearance', 'appearanceContent'],
      ['search', 'searchModuleContent'], ['settings', 'settingsModuleContent'], ['tts', 'ttsModuleContent'],
      ['autoPage', 'autoPageModuleContent'], ['replace', 'replaceModuleContent']]) {
      active = module; live = true;
      const before = new Set(panel.children.keys()); panel[builder]();
      const child = [...panel.children].find(([key]) => !before.has(key))?.[1];
      assert.ok(child, module + ' parent emits its actual module child');
      assert.equal(child.params.interactionEnabled, true);
      assert.equal(typeof child.params.inputCurrent, 'function', module + ' parent binds the live predicate');
      const retained = child.params.inputCurrent;
      live = false; assert.equal(retained(), false);
      live = true; active = 'successor'; assert.equal(retained(), false, module + ' cannot acquire a different module lease');
    }
  }
  if (id === 'watch-parent-notifications') {
    const frames = [], notifications = [];
    let rendering = true;
    const model = owner(ui('ReaderDirectoryNavigationSurface'), ['onIdentityChanged'], {
      ReaderDirectoryTraceFrame: class { constructor(callback) { this.onFrame = callback; } },
      readerDirectoryScopeKey: () => 'scope', readerDirectoryObserveScrollIntent: () => () => {},
    });
    Object.assign(model, { mounted: true, generation: 2, sourceId: 'local', bookId: 'current', query: '', ascending: true,
      feedback: { reset() {} }, cancelQueryTimer() {}, openTree() { this.generation++; },
      getUIContext: () => ({ postFrameCallback: frame => frames.push(frame) }),
      onTreeStateChange: active => { assert.equal(rendering, false, 'tree notification cannot mutate a rendering parent'); notifications.push(active); },
    });
    model.onIdentityChanged();
    assert.deepEqual(notifications, []);
    rendering = false; frames.shift().onFrame();
    assert.deepEqual(notifications, [false]);
    rendering = true; model.onIdentityChanged(); model.bookId = 'successor'; model.onIdentityChanged();
    rendering = false; frames.shift().onFrame();
    assert.deepEqual(notifications, [false]);
    model.view = { viewId: 'current-ready' }; frames.shift().onFrame();
    assert.deepEqual(notifications, [false], 'late reset cannot overwrite a ready tree');
    const busy = owner(ui('ReaderTtsConfigOverlay'), ['onIdentityChanged']);
    Object.assign(busy, { mounted: true, generation: 1, selectionId: 'current', stopPreview() {},
      onBusyChange: value => { assert.equal(rendering, false, 'busy reset cannot mutate a rendering parent'); notifications.push(value); } });
    rendering = true; busy.onIdentityChanged(); rendering = false;
    await Promise.resolve(); assert.deepEqual(notifications, [false, false]);
    rendering = true; busy.onIdentityChanged(); busy.selectionId = 'successor'; rendering = false;
    await Promise.resolve(); assert.deepEqual(notifications, [false, false], 'old TTS selection cannot clear successor busy');
    const rules = owner(ui('ReaderFullDirectory'), ['admitDirectoryRulesRecovery']);
    Object.assign(rules, { directoryRulesRecoveryPublication: 0, directoryRulesCurrent: (identity, book) => identity === 'opening' && book === 'current', onHeaderRecoveryChanged() {} });
    Object.defineProperty(rules, 'directoryRulesRecovery', { set() { assert.equal(rendering, false, 'rules projection cannot mutate a rendering parent'); } });
    rendering = true; rules.admitDirectoryRulesRecovery('opening', 'current', undefined); rendering = false;
    await Promise.resolve();
  }
  if (id === 'manga-retry') {
    const { EMPTY_READING_DIRECTORY_RECOVERY } = await import('../entry/src/main/ets/features/reading/presentation/ReadingDirectoryRecovery.ts');
    const sdk = boundedSurfaceSdk();
    const recoverySource = read('features/reading/ui/ReaderDirectoryRecoverySurface.ets');
    sdk.hooks.childSources.ReaderDirectoryRecoverySurface = recoverySource;
    sdk.deps.ReaderDirectoryRecoverySurface = createReaderBuilderProbe(recoverySource, boundedMembers(recoverySource),
      { ...sdk.deps, EMPTY_READING_DIRECTORY_RECOVERY }, sdk.hooks).Component;
    const model = sdk.consumer(read('features/manga/ui/MangaDownloadOperationsPanel.ets'), ['build', 'effectiveScheme']);
    let retries = 0;
    Object.assign(model, { directoryRecovery: EMPTY_READING_DIRECTORY_RECOVERY, appThemeScheme: 'day', panelScheme: 'auto', loading: false, failureMessage: '读取失败', onRetry: () => retries++ });
    model.initialRender();
    assert.ok(sdk.walk(model).some(child => child instanceof sdk.deps.ReaderPageState),
      'local failure uses the actual common content-state component');
    const retry = sdk.nodes(model).find(node => node.type === 'Button' && typeof node.onClick === 'function');
    assert.ok(retry, 'actual common state emits its native retry button');
    assert.equal(retry.constraintSize.minWidth, 44);
    assert.equal(retry.constraintSize.minHeight, 44);
    assert.equal(retry.height, undefined, 'native label may grow vertically');
    retry.onClick(); assert.equal(retries, 1);
    model.failureMessage = ''; retry.onClick(); assert.equal(retries, 1);
    model.failureMessage = '新失败'; model.loading = true; retry.onClick(); assert.equal(retries, 1);
  }

  if (id === 'capsule-budget') {
    let scale = 1;
    const advance = text => [...text].reduce((sum, character) => sum + (/\p{Script=Han}/u.test(character) ? 1 : .55), 0);
    const context = { px2vp: n => n, getMeasureUtils: () => ({
      measureText: options => advance(options.textContent) * Number.parseFloat(options.fontSize) * scale,
      measureTextSize: options => ({ width: advance(options.textContent) * Number.parseFloat(options.fontSize) * scale,
        height: Number.parseFloat(options.lineHeight ?? options.fontSize) * scale }),
    }) };
    class CapsuleChild { constructor(parent, params, _storage, id) { Object.assign(this, { owner: parent, params, id }); } }
    const frameStart = capsuleSource.indexOf('export class ReaderSessionCapsuleFrame');
    const frameEnd = capsuleSource.indexOf('/** Shared fixed leading actor');
    const frames = pureModuleProbe(capsuleSource.slice(frameStart, frameEnd), 'CapsuleFrame.ets', {
      readerAppColor, READER_SESSION_CAPSULE_RADIUS: 12,
      READER_SESSION_CAPSULE_SHADOW: { radius: 8, color: '#00000000', offsetX: 0, offsetY: 3 },
    }, ['ReaderSessionCapsuleFrame']);
    const nativeDeps = { ...capsuleMeasurement, ...frames, READER_SESSION_CAPSULE_RADIUS: 12, ReaderSessionCapsuleLeading: CapsuleChild,
      ReaderSessionCapsulePause: CapsuleChild, READER_SESSION_CAPSULE_MIN_TARGET_HEIGHT,
      readerSessionCapsuleAccessibility: () => '会话', uiContext: context };
    const childSources = { ReaderSessionCapsuleLeading: capsuleSource, ReaderSessionCapsulePause: capsuleSource };
    for (scale of [1, 1.3, 1.6, 2]) for (const type of ['autoPage', 'tts']) {
      const metrics = capsuleMeasurement.measureReaderSessionCapsule(context, type, scale);
      if (scale === 1) { assert.equal(metrics.paintHeight, 24); assert.equal(metrics.width, type === 'tts' ? 94 : 96); }
      const capsule = owner(capsuleSource, ['build', 'finalWidth', 'metrics', 'effectiveTextColor',
        'effectivePrimaryColor', 'effectiveOnPrimaryColor', 'numericLength', 'measurementHandler'], nativeDeps,
        { componentName: 'ReaderSessionCapsule', childSources });
      Object.assign(capsule, { type, fontScale: scale, capsuleWidth: 0, themeScheme: 'day', surfaceColor: '', surfaceBorderColor: '',
        textColor: '', primaryColor: '', onPrimaryColor: '', shadowColor: '#00000000', interactionEnabled: true }); capsule.initialRender();
      const target = [...capsule.nodes.values()].find(node => node.type === 'Button');
      const paint = [...capsule.nodes.values()].find(node => node.type === 'Stack');
      assert.equal(target.height, Math.max(44, metrics.paintHeight));
      assert.equal(target.responseRegion, undefined, 'hit area is paid by the native carrier');
      assert.equal(paint.height, metrics.paintHeight);
      const leading = [...capsule.children.values()].find(child => child.params.labelHeight !== undefined);
      assert.ok(leading.params.labelHeight >= 12.5 * scale);
      assert.ok(leading.params.labelWidth >= (type === 'autoPage' ? 40 : 20) * scale);
      const source = new ReaderSessionMorphSourceMeasurement(type === 'tts' ? 'quickTts' : 'quickAutoPage', 'source', 12, 200, 286, 196, 1);
      const launch = buildReaderSessionLaunchGeometry({ source, targetLeft: 200, targetTop: 700,
        capsuleWidth: metrics.width, capsuleHeight: metrics.paintHeight, topBarExitDistance: 60, dockExitDistance: 330 });
      const curves = { flight: p => p, expand: p => p, easeIn: p => p, easeOut: p => p, easeInOut: p => p };
      const initial = sampleReaderSessionLaunch(0, launch, curves);
      assert.equal(initial.proxyHeight, source.height);
      const final = sampleReaderSessionLaunch(READER_SESSION_LAUNCH_DURATION_MS, launch, curves);
      assert.equal(final.proxyHeight, metrics.paintHeight);
      assert.equal(final.proxyTop, launch.targetTop);
      const stage = owner(ui('ReaderSessionLaunchStage'), ['build', 'metrics', 'sourceSharpContent', 'effectiveSourceSurfaceColor',
        'effectiveSourceBorderColor', 'effectiveTextColor', 'effectivePrimaryColor', 'effectiveOnPrimaryColor'], nativeDeps, { childSources });
      Object.assign(stage, { sample: final, fontScale: scale, sourceClip: () => ({}), sourceSharpContent() {},
        themeScheme: 'day', surfaceColor: '', surfaceBorderColor: '', sourceSurfaceColor: '', sourceBorderColor: '',
        sourceSurfaceTopInset: 0, sourceGradientStart: '', sourceGradientEnd: '', sourceBorderWidth: 1,
        sourceShadowRadius: 0, sourceShadowOffsetY: 0, sourceShadowColor: '#00000000', sourceHighlightColor: '#00000000',
        textColor: '', primaryColor: '', onPrimaryColor: '', shadowColor: '#00000000', interactionEnabled: true });
      stage.initialRender();
      const launchTarget = [...stage.nodes.values()].find(node => node.type === 'Button');
      assert.equal(launchTarget.height, metrics.targetHeight);
      assert.equal(launchTarget.position.y + launchTarget.height / 2, final.proxyTop + final.proxyHeight / 2);
      const revealed = [...stage.children.values()].find(child => child.params.labelHeight !== undefined);
      assert.equal(revealed.params.labelHeight, metrics.labelHeight);
      for (const [width, height] of [[320, 568], [366, 844], [844, 366], [760, 960]]) for (const safeBottom of [0, 24, 48]) {
        const window = createDefaultReaderWindowMetrics(); window.navigationInsets.bottom = safeBottom;
        const layout = geometry.resolveReaderReadingLayout(width, height, width >= 600, window,
          false, undefined, 0, 0, undefined, 0, metrics.paintHeight);
        const chrome = pageChrome.resolveReaderPageChromeLayout(layout, new pageChrome.ReaderPageChromeMeasurements(
          0, 0, 0, 0, 0, 0, 0, 0, true, metrics.width, metrics.targetHeight));
        const bodyBottom = height - layout.contentBottom;
        assert.ok(bodyBottom <= chrome.sessionY, 'static target begins at or below the body end');
        assert.ok(bodyBottom <= chrome.footerTop + layout.pageChromeFooterHeight / 2 - launchTarget.height / 2,
          'settled launch target begins at or below the body end');
        assert.equal(chrome.sessionY + metrics.targetHeight / 2, chrome.footerTop + layout.pageChromeFooterHeight / 2,
          'capsule paint and footer share the same center');
      }
    }
    assert.ok(16 < 12.5 * 2, 'the old fixed label box clips 2x native line extent');
  }
  if (id === 'standalone-prefix-sdk') {
    class Toolbar { constructor(parent, params, _storage, id) { Object.assign(this, { owner: parent, params, id }); } }
    const source = ui('FullDirectoryPanel');
    for (const tab of ['directory', 'bookmarks']) {
      const model = owner(source, ['standalonePrefix', 'panelHeader', 'collapseLabel', 'tabs',
        'directoryTab', 'directoryTabContent', 'bookmarkTab', 'bookmarkTabContent', 'searchControls', 'statusFooter'], {
        ReaderDirectoryToolbar: Toolbar,
      }, { childSources: { ReaderDirectoryToolbar: ui('ReaderDirectoryToolbar') } });
      Object.assign(model, { activeTab: tab, embeddedInControl: false, expandedLayout: false, appThemeScheme: 'day',
        standaloneShort: () => true, panelHeaderHeight: () => 64, innerWidth: () => 294,
        tabHeight: () => 66, tabStripHeight: () => 72, queryHeight: () => 68, searchControlsHeight: () => 75,
        searchPlaceholder: () => '搜索', activeTabLineWidth: () => 30, standaloneFooterHeight: () => 64,
        currentTitle: () => '章节', currentPosition: () => '1/10', searchDraft: '', ascending: true,
      });
      model.standalonePrefix();
      assert.equal([...model.nodes.values()].filter(node => node.type === 'Button').length, 3);
      const toolbar = [...model.children.values()][0];
      assert.equal(toolbar.params.naturalFieldHeightVp, 68);
      assert.equal(toolbar.params.naturalToolbarHeightVp, 74);
      if (tab === 'directory') assert.ok([...model.nodes.values()].some(node => node.height === 64 && node.type === 'Column'));
      assert.equal([...model.nodes.values()].filter(node => node.type === 'Scroll' || node.type === 'List').length, 0,
        'the actual chrome prefix adds no second scrolling owner');
    }
  }
  if (id === 'standalone-short') {
    const source = ui('FullDirectoryPanel');
    class Child { constructor(parent, params, _storage, id) { Object.assign(this, { owner: parent, params, id }); } }
    const extra = { readerFullDirectoryHeights, ViewStackProcessor: { StartGetAccessRecordingFor() {}, StopGetAccessRecording() {} },
      readerScaledControlHeight: (base, line, scale) => base + line * (scale - 1),
      ReaderDirectoryNavigationSurface: Child, ReaderDirectoryList: Child, ReaderBookmarkList: Child,
      ReaderBookmarkErrorState: Child, ReaderBookmarkLoadingState: Child, ReaderBookmarkEmptyState: Child,
      ReaderPageState: Child,
    };
    const childSources = Object.fromEntries(['ReaderDirectoryNavigationSurface', 'ReaderDirectoryList',
      'ReaderBookmarkList', 'ReaderBookmarkErrorState', 'ReaderBookmarkLoadingState', 'ReaderBookmarkEmptyState'].map(name => [name, ui(name)]));
    childSources.ReaderPageState = read('ui/feedback/ReaderPageState.ets');
    const emptyState = owner(source, ['catalogEmptyMessage']);
    Object.assign(emptyState, { entries: [], catalogMessage: '', allowUnanchoredBrowse: true });
    assert.equal(emptyState.catalogEmptyMessage(), '暂无可用章节，可返回书籍详情重试或更换书源',
      'detail directory names its actual return destination');
    emptyState.allowUnanchoredBrowse = false;
    assert.equal(emptyState.catalogEmptyMessage(), '暂无可用章节，可返回阅读页重试或更换书源',
      'reader directory retains its actual return destination');
    for (const detailContext of [true, false]) {
      emptyState.allowUnanchoredBrowse = detailContext;
      emptyState.catalogMessage = '当前书源需要登录';
      assert.equal(emptyState.catalogEmptyMessage(), '当前书源需要登录', 'the current owner failure remains authoritative');
      emptyState.entries = [{ index: 0, title: '第一章' }];
      assert.equal(emptyState.catalogEmptyMessage(), '没有匹配的章节', 'a filtered catalog retains its existing empty result');
      emptyState.entries = [];
    }
    for (const scale of [1, 1.3, 1.6, 2]) for (const tab of ['directory', 'bookmarks']) {
      const model = owner(source, ['standaloneShort', 'standalonePrefixHeight', 'standaloneFooterHeight', 'heights',
        'chapterListHeight', 'bookmarkListHeight', 'bookmarkBodyViewportHeight'], extra);
      Object.assign(model, { embeddedInControl: false, activeTab: tab, panelHeight: () => 160,
        panelHeaderHeight: () => 44 + 20 * (scale - 1), searchControlsHeight: () => 51 + 24 * (scale - 1),
        tabStripHeight: () => 50 + 22 * (scale - 1), fontScale: () => scale,
        directoryRowHeight: () => 44 + 20 * (scale - 1), listRowHeight: () => 74 + 40 * (scale - 1) });
      assert.equal(model.standaloneShort(), true);
      assert.ok(model.chapterListHeight() >= 44 && model.bookmarkListHeight() >= 44);
      const originalAllocation = source.replaceAll(
        '    if (this.standaloneShort()) return Math.max(0, this.panelHeight() - 24);\n', '');
      const withoutShort = owner(originalAllocation, ['chapterListHeight', 'bookmarkListHeight']);
      Object.assign(withoutShort, model, { heights: () => model.heights() });
      assert.equal(withoutShort.chapterListHeight(), 0);
      assert.equal(withoutShort.bookmarkListHeight(), 0, 'restoring the old split allocation loses the native viewport');
      const height = tab === 'directory' ? model.heights().chapterList : model.heights().bookmarkList;
      assert.equal(height, 0, 'the old split-chrome variant exhausts this short viewport');
      assert.ok(model.standalonePrefixHeight() > 0);
      const parent = owner(source, ['chapterList', 'flatChapterList', 'bookmarkBody'], extra, { childSources });
      Object.assign(parent, { ...model, appThemeScheme: 'day', projectedEntries: [], projectedBookmarks: [],
        bookmarkIdentity: { sourceId: 'local', bookId: 'current' }, admittedEntries: [], chapterActionsEnabled: true,
        initialListPositionReady: false, navigationActive: false, bookmarkLoadFailed: false, bookmarkTabLoading: false,
        listSessionKey: 'current', innerWidth: () => 294, directoryListRowHeight: () => 44,
        directoryListPaddingX: () => 0, directoryListWidth: () => 294, directoryListViewportHeight: () => 136,
        standaloneShort: () => true, standalonePrefixHeight: () => model.standalonePrefixHeight(),
        chapterListHeight: () => 136, bookmarkBodyViewportHeight: () => 136,
        controlProgress: () => 1, standalonePrefix() {}, standaloneCatalogState() {},
      });
      parent.chapterList();
      const tree = [...parent.children.values()].find(child => child.params.headerCount === 1);
      assert.ok(tree, 'tree path receives the existing prefix protocol');
      assert.equal(tree.params.prefixHeight, model.standalonePrefixHeight());
      parent.flatChapterList();
      const flat = [...parent.children.values()].find(child => child.params.emptyBuilder !== undefined);
      assert.equal(flat.params.prefixHeight, model.standalonePrefixHeight());
      parent.bookmarkBody();
      const lists = [...parent.nodes.values()].filter(node => node.type === 'List');
      assert.equal(lists.length, 1, 'short empty/error bookmark state shares the native prefix List');
      assert.equal([...parent.nodes.values()].filter(node => node.type === 'Scroll').length, 0);
      // ArkUI defers ListItem bodies. Invoke only the recorded production
      // deep-render closures at the finite lazy-materialization seam.
      for (const item of [...parent.nodes.values()].filter(node => node.type === 'ListItem')) {
        const deepRender = Array.isArray(item.create) ? item.create[0] : undefined;
        if (typeof deepRender === 'function') deepRender(item.id, true);
      }
      const state = [...parent.children.values()].find(child => child.params.title === '暂无书签');
      assert.ok(state, JSON.stringify([...parent.children.values()].map(child => child.params))); assert.equal(state.params.actionLabel, '返回目录');
    }
      for (const tab of ['directory', 'bookmarks']) {
      const frames = [], restored = [];
      let short = false, scale = 1, nativeOffset = 0;
      const transfer = owner(source, ['currentStandaloneLayoutKey', 'admitStandaloneLayout',
        'onStandaloneLayoutChanged', 'restoreStandaloneLayout', 'onListUserScroll'], {
        ...listPositioning, Curve: { Linear: 'linear' }, setTimeout: callback => frames.push(callback),
      });
      const rowHeight = () => (tab === 'bookmarks' ? 74 : 44) + (scale - 1) * (tab === 'bookmarks' ? 40 : 20);
      Object.assign(transfer, { activeTab: tab, embeddedInControl: false, positioningMounted: true,
        deferredLifecycleGeneration: 1, standaloneRestoreGeneration: 0, projectionScrollGeneration: 0,
        motionLayoutRevision: 0, standaloneLayoutKey: '', standaloneRestoreAnchor: undefined,
        listPositioning: { status: 'positioned', listOpenRevision: 2 },
        standaloneShort: () => short, panelWidth: () => 366, panelHeight: () => short ? 160 : 736,
        fontScale: () => scale, standalonePrefixHeight: () => short ? 240 : 0,
        listRowHeight: rowHeight, readListOffset: () => nativeOffset,
        listScroller: { scrollTo: options => { nativeOffset = options.yOffset; restored.push(nativeOffset); } },
      });
      transfer.admitStandaloneLayout(); nativeOffset = rowHeight() * 5.5;
      short = true; scale = 2; transfer.onStandaloneLayoutChanged();
      nativeOffset = 0; transfer.restoreStandaloneLayout(); frames.shift()();
      assert.equal(nativeOffset, 240 + rowHeight() * 5.5, tab + ' leading row survives the new short List binding');
      short = false; scale = 1; transfer.onStandaloneLayoutChanged();
      nativeOffset = 0; transfer.restoreStandaloneLayout(); frames.shift()();
      assert.equal(nativeOffset, rowHeight() * 5.5, tab + ' returns to its original normal leading row');
      short = true; transfer.onStandaloneLayoutChanged(); transfer.restoreStandaloneLayout();
      const before = restored.length; transfer.onListUserScroll(); frames.shift()();
      assert.equal(restored.length, before, 'actual user scroll cancels a queued geometry restore');
      transfer.listPositioning.status = 'pending'; transfer.onStandaloneLayoutChanged();
      assert.equal(transfer.standaloneRestoreAnchor, undefined, 'a new current-chapter positioning request remains authoritative');
    }
  }
  if (id === 'standalone-bookmark') {
    const rowSource = ui('ReaderBookmarkRow');
    const measureSource = rowSource.slice(0, rowSource.indexOf('/**\n * One bookmark row'));
    const measure = pureModuleProbe(measureSource, 'StandaloneBookmarkMeasure.ets', {
      ...readerTypographyRoles, ...textMeasurement,
    }, ['measureReaderStandaloneBookmark']);
    for (const scale of [1, 1.3, 1.6, 2]) {
      const context = { px2vp: value => value, getMeasureUtils: () => ({
        measureText: options => [...options.textContent].length * Number.parseFloat(options.fontSize) * scale,
        measureTextSize: options => ({ width: 10 * scale,
          height: Number.parseFloat(options.lineHeight ?? options.fontSize) * scale * (options.lineHeight ? 1 : 1.5) }),
      }) };
      const natural = measure.measureReaderStandaloneBookmark(context, 280, scale);
      assert.ok(natural.titleHeight >= 16);
      assert.ok(natural.excerptHeight >= 28);
      assert.ok(natural.rowHeight >= 8 + natural.titleHeight + 7 + natural.excerptHeight + 14);
      const row = owner(rowSource, ['legacyBody'], { BOOKMARK_ROW_HEIGHT: 74, BOOKMARK_PENDING_LABEL: '待确认' });
      Object.assign(row, { standaloneSize: natural, appThemeScheme: 'day', row: { chapterTitle: '章节',
        positionLabel: '100%', timeLabel: '11/13 12:34', excerpt: '正文', identityStatus: 'pendingConfirmation' } });
      row.legacyBody();
      const columns = [...row.nodes.values()].filter(node => node.type === 'Column');
      assert.equal(columns[0].height, natural.rowHeight);
      const rows = [...row.nodes.values()].filter(node => node.type === 'Row');
      assert.equal(rows[0].height, natural.titleHeight); assert.equal(rows[1].height, natural.excerptHeight);
      const list = owner(ui('ReaderBookmarkList'), ['rowHeight', 'stableLayoutEnabled', 'layoutRowHeightValue'], { BOOKMARK_ROW_HEIGHT: 74 });
      Object.assign(list, { embeddedInControl: false, standaloneSize: natural });
      assert.equal(list.layoutRowHeightValue(), natural.rowHeight, 'offscreen extent equals the actual materialized row');
      const full = owner(ui('FullDirectoryPanel'), ['standaloneBookmarkSize', 'listRowHeight'], measure);
      Object.assign(full, { embeddedInControl: false, readerWindowMetricsRevision: 2,
        getUIContext: () => context, bookmarkRowWidth: () => 280, fontScale: () => scale });
      assert.equal(full.listRowHeight('bookmarks'), natural.rowHeight, 'positioning uses the same uniform row extent');
      if (scale === 2) {
        assert.ok(16 < natural.titleHeight && 28 < natural.excerptHeight && 74 < natural.rowHeight,
          'all three old fixed boxes fail the current 2x extent');
      }
    }
  }
  if (id === 'compact-roles') {
    for (const variant of ['search', 'auto-page', 'replace']) {
      const back = owner(ui('ReaderControlQuickBack'), ['build', 'icon', 'labelStyle']);
      Object.assign(back, { variant, scheme: 'day', actionWidth: 68, actionHeight: 44, actionEnabled: true, actionVisible: true });
      back.initialRender();
      const button = [...back.nodes.values()].find(node => node.type === 'Button');
      const paint = [...back.nodes.values()].find(node => node.type === 'Row');
      assert.equal(button.height, 44); assert.equal(paint.constraintSize.minHeight, 24);
      assert.equal(button.backgroundColor, 'Color.Transparent');
      assert.ok(paint.backgroundColor !== 'Color.Transparent');
    }
  }
  if (id === 'render-followups') {
    let rendering = true;
    const frames = [];
    const temporary = owner(ui('LocalReadingExperience'), ['onControlTemporaryLayerChanged'], {
      ReaderUIFrameCallback: class { constructor(callback) { this.onFrame = callback; } },
    });
    Object.assign(temporary, { lifecycleToken: 4, controlTemporaryLayer: true,
      getUIContext: () => ({ postFrameCallback: frame => frames.push(frame) }), isSessionActive: n => n === 4,
      invalidateControlBackdrop() { assert.equal(rendering, false); },
    });
    let presented = true;
    Object.defineProperty(temporary, 'controlTemporaryLayerPresented', {
      get: () => presented, set(value) { assert.equal(rendering, false); presented = value; },
    });
    temporary.onControlTemporaryLayerChanged(false);
    assert.equal(temporary.controlTemporaryLayer, false, 'domain dismissal is immediate');
    rendering = false; frames.shift().onFrame();
    assert.equal(temporary.controlTemporaryLayerPresented, false, 'the Panel Prop has its own reactive frame publication');
    const ready = owner(ui('LocalReadingExperience'), ['onBookTurnArkUIContentReady']);
    let releases = 0;
    Object.assign(ready, { mounted: true, exitRequested: false, lifecycleToken: 4, pageTurnRenderRevision: 8,
      settleReaderRecovery() { assert.equal(rendering, false); releases++; }, bookTurn2DFallbackPending: false });
    rendering = true; ready.onBookTurnArkUIContentReady(8);
    assert.equal(ready.bookTurnArkUIReadyRevision, 8); assert.equal(releases, 0);
    rendering = false; await Promise.resolve(); assert.equal(releases, 1);
    ready.onBookTurnArkUIContentReady(8); ready.pageTurnRenderRevision++; await Promise.resolve();
    assert.equal(releases, 1, 'old content-ready cannot release a successor');
    const pull = owner(read('features/manga/vendor/pulltorefresh/PullToRefresh.ets'),
      ['handleEnabledChange', 'handleAdmissionChange', 'handleResetToken', 'cancelPull', 'resetPull', 'setActive', 'pullDirection'],
      { IS_FREE: 0, IS_PULL_DOWN_1: 11, IS_PULL_DOWN_2: 12, IS_REFRESHING: 2, IS_PULL_UP_1: 41, IS_PULL_UP_2: 42, IS_LOADING: 5 });
    let pullNotices = 0;
    Object.assign(pull, { alive: true, requestGeneration: 3, active: true, state: 41,
      rawDistance: 150, pullEnabled: false, animationDuration: 0,
      getUIContext: () => ({ animateTo: (_options, callback) => callback() }),
      onPull() { assert.equal(rendering, false); pullNotices++; },
      onActivity() { assert.equal(rendering, false); pullNotices++; },
    });
    rendering = true; pull.handleEnabledChange();
    assert.equal(pull.active, false); assert.equal(pull.rawDistance, 0); assert.equal(pullNotices, 0);
    rendering = false; await Promise.resolve(); assert.equal(pullNotices, 2);
    pull.active = true; pull.handleResetToken(); pull.requestGeneration++;
    await Promise.resolve(); assert.equal(pullNotices, 2, 'old pull reset cannot clear a successor request');
    const pointer = owner(ui('ReaderPageInteractionLayer'), ['deferPointerWatch',
      'onInteractionEnabledInputsChanged', 'onInteractionModeInputsChanged', 'onReadinessInputsChanged',
      'onInputRevisionInputsChanged', 'onPointerGeometryInputsChanged']);
    Object.assign(pointer, { activePointerId: 7, inputClock: {}, inputRevision: 1 });
    for (const name of ['InteractionEnabled', 'InteractionMode', 'Readiness', 'InputRevision', 'PointerGeometry']) {
      let notices = 0;
      pointer['on' + name + 'Changed'] = () => { assert.equal(rendering, false); notices++; };
      rendering = true; pointer['on' + name + 'InputsChanged'](); assert.equal(notices, 0);
      rendering = false; await Promise.resolve(); assert.equal(notices, 1);
      pointer['on' + name + 'InputsChanged'](); pointer.inputClock = {};
      await Promise.resolve(); assert.equal(notices, 1, 'queued reconciliation cannot mutate a successor pointer');
    }
  }
  recordContractCasePass(id);
}
