import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';

const cases = {
  'top-scroll': { description: 'Expanded history scroll starts at the top within the available viewport', resources: [] },
  'all-history': { description: '35 records fold into two complete rows and the final record is reachable after expansion', resources: [] },
  'late-history': { description: 'Late history and a new window width reproject ordered rows without losing records', resources: [] },
  'status-actions': { description: 'Source recovery and local history dispatch through their separate current owners', resources: [] },
  'focus-state': { description: 'SearchViewState consumes fresh focus once and retires it on reset', resources: [] },
  'history-feedback': { description: 'History loading and errors retain the records and gate clear and retry', resources: [] },
  'native-focus': { description: 'ReaderSearchField focuses after layout and retires the pending callback on unmount', resources: [] },
};
const base = new URL('../entry/src/main/ets/', import.meta.url);
const source = path => readFileSync(new URL(path, base), 'utf8');
const historyPath = 'features/search/ui/ReaderSearchHistoryPanel.ets';
const historyGeometryPath = 'features/search/ui/SearchHistoryGeometry.ts';

for (const id of selectContractCases(cases)) {
  if (id === 'focus-state') {
    const { SearchViewState } = await import('../entry/src/main/ets/features/search/presentation/SearchViewState.ts');
    const state = new SearchViewState();
    assert.equal(state.consumeInputFocusRequest(), false);
    state.requestInputFocus();
    assert.equal(state.consumeInputFocusRequest(), true);
    assert.equal(state.consumeInputFocusRequest(), false);
    state.requestInputFocus();
    state.reset('新查询');
    assert.equal(state.consumeInputFocusRequest(), false);
  } else if (id === 'native-focus') {
    await fieldFocus();
  } else {
    await panelCase(id);
  }
  recordContractCasePass(id);
}

async function fieldFocus() {
  const { pureModuleProbe } = await import('./lib/ets-pure-module-probe.mjs');
  const { selectedProductionMethods } = await import('./lib/selected-production-methods.mjs');
  const field = 'ui/controls/ReaderSearchField.ets';
  const fieldSource = source(field);
  const frameSource = fieldSource.slice(fieldSource.indexOf('class ReaderSearchFocusFrame'), fieldSource.indexOf('@Component'));
  const { ReaderSearchFocusFrame } = pureModuleProbe(frameSource, 'ReaderSearchFocusFrame.ets',
    { FrameCallback: class {} }, ['ReaderSearchFocusFrame']);
  const Field = selectedProductionMethods(new URL(field, base), 'ReaderSearchField',
    ['aboutToAppear', 'aboutToDisappear', 'isBookField', 'bindEditingTarget', 'editingNativeId'],
    { DEBUG: false, ReaderSearchFocusFrame });
  const frames = [], focus = [];
  const owner = Object.assign(new Field(), {
    mounted: false, focusGeneration: 0, variant: 'bookPanel', mode: 'submit', focusOnAppear: true,
    editingTarget: {
      mount(_context, _host, _controller, current, _height, id) {
        assert.equal(current(), true);
        assert.equal(id, 'reader-book-search-input');
      },
      unmount() {},
    },
    getUIContext: () => ({ postFrameCallback: frame => frames.push(frame),
      getFocusController: () => ({ requestFocus: id => focus.push(id) }) }),
  });
  owner.aboutToAppear();
  assert.deepEqual(focus, []);
  frames.shift().onFrame();
  assert.deepEqual(focus, ['reader-book-search-input']);
  owner.aboutToAppear();
  owner.aboutToDisappear();
  frames.shift().onFrame();
  assert.equal(focus.length, 1);
  owner.focusOnAppear = false;
  owner.aboutToAppear();
  assert.equal(frames.length, 0);
}

async function panelCase(id) {
  const { pureModuleProbe } = await import('./lib/ets-pure-module-probe.mjs');
  const { createReaderBuilderProbe } = await import('./lib/reader-control-builder-probe.mjs');
  const { foundationControls } = await import('./lib/reader-foundation-control-probe.mjs');
  const { boundedMembers, boundedSurfaceSdk } = await import('./lib/bounded-surface-sdk-probe.mjs');
  const controls = foundationControls();
  const shared = boundedSurfaceSdk({ properties: controls.properties });
  const facets = await import('../entry/src/main/ets/ui/foundation/ReaderSearchControlGeometry.ts');
  const { SearchHistoryGeometry, SearchHistoryPanelLayout, SearchHistoryViewport, projectSearchHistoryPanel } =
    pureModuleProbe(source(historyGeometryPath), 'SearchHistoryGeometry.ts', facets,
      ['SearchHistoryGeometry', 'SearchHistoryPanelLayout', 'SearchHistoryViewport', 'projectSearchHistoryPanel']);
  const deps = { ...shared.deps, ...controls.dependencies, SearchHistoryGeometry, SearchHistoryPanelLayout,
    readerPaperActionIcon: () => 'history-trash' };
  const hooks = { ...controls.hooks, childSources: { ...shared.childSources, ...controls.hooks.childSources } };
  const actions = [];
  const keywords = Array.from({ length: 35 }, (_, index) => `关键词${index + 1}`);
  const panelSource = source(historyPath);
  const Panel = createReaderBuilderProbe(panelSource, boundedMembers(panelSource), deps, hooks).Component;
  const measureWidth = keyword => keyword.length > 30 ? 800 : 100;

  function fixture(history, { width = 328, height = 435, status = 'ready', expanded = false } = {}) {
    const geometry = new SearchHistoryGeometry(width, height, 1, width >= 600, status, 0);
    const layout = projectSearchHistoryPanel(history, geometry, expanded, measureWidth);
    const owner = new Panel(undefined, {});
    Object.assign(owner, { appThemeScheme: 'day', history, status, layout,
      onClear: () => actions.push('clear'), onRetry: () => actions.push('retry-history'),
      onSelect: keyword => actions.push(keyword), onToggle: () => actions.push('toggle') });
    owner.initialRender();
    const nodes = controls.nodes(owner);
    return { layout, nodes, button: label => nodes.find(node => node.type === 'Button' && node.accessibilityText === label) };
  }

  async function verifyRetainedPanel() {
    const { installedEtsCompiler } = await import('./lib/ets-compiler-runtime.mjs');
    const compiler = installedEtsCompiler();
    const modelPath = 'features/search/presentation/ReaderLibrarySearchModel.ets';
    const modelSource = source(modelPath);
    assert.match(modelSource, /@Observed\s+export class ReaderLibrarySearchModel/);
    compiler.require(compiler.root + '/lib/validate_ui_syntax.js').observedClassCollection.add('ReaderLibrarySearchModel');
    const { ReaderLibrarySearchModel } = pureModuleProbe(modelSource, modelPath, { Observed: value => value }, ['ReaderLibrarySearchModel']);
    const model = controls.properties.sdk.ObservedObject.createNew(new ReaderLibrarySearchModel(), undefined);
    model.claim(7);
    model.activate(7);
    model.history = keywords;
    let width = 328;
    const surfacePath = 'features/search/ui/ReaderLibrarySearchSurface.ets';
    const { owner: surface } = createReaderBuilderProbe(source(surfacePath), [
      'header', 'historyPanel', 'historyExpanded', 'historyLayout', 'historyGeometry', 'historyFeedbackKey',
      'historyViewportHeight', 'historyChanged', 'metricsChanged', 'metricsRevision', 'model', 'toggleHistoryAction',
      'retargetHistoryViewport', 'resolvedHistoryViewport', 'displayedHistoryViewport', 'displayedHistoryLimit',
      'historyToggleRevision', 'historyResizeRevision', 'historyResizeHoldingCoverage', 'historyProjectionKey',
    ], {
      ...deps, ReaderSearchHistoryPanel: Panel, projectSearchHistoryPanel, SearchHistoryViewport,
      SynchedPropertyNesedObjectPU: controls.properties.sdk.SynchedPropertyNestedObjectPU,
      motionAnimateParam: (_name, onFinish) => ({ onFinish }),
      uiContext: { animateTo(options, update) { update(); options.onFinish?.(); } },
    }, {
      ...hooks, initialParams: { model },
      childSources: { ...hooks.childSources, ReaderSearchHistoryPanel: panelSource },
    });
    const noop = () => {};
    Object.assign(surface, {
      spec: { panelInnerInset: 13, borderWidth: 1 }, mounted: true, searchMounted: true,
      mode: 'input', reduceMotion: false, expandedLayout: false, reducedSearchOpacity: 1, historyResizeOpacity: 1,
      historyMeasurements: { measureControlWidth: (_context, _revision, keyword) => measureWidth(keyword) },
      surfaceWindowY: 0, measuredHistoryFeedback: 0, bar: noop, historyLimit: () => 435,
      historyBarBottom: () => 0, availableBottom: () => 435, fontScale: () => 1, cardContentWidth: () => width,
      publishContinueCardCoverage: noop, observeEntryHistory: noop, historyInteractive: () => true,
      headerVeil: () => false, historyProgress: () => 1, headerMaterialRadius: () => 18,
      historyDividerColor: () => '#000', panelBorderColor: () => '#000', headerStackShadow: () => undefined,
      headerSurfaceAreaChange: () => noop, historyFeedbackAction: () => noop, historyAction: () => noop,
      clearHistoryAction: () => noop, retryHistoryAction: () => noop,
    });
    surface.retargetHistoryViewport(true);
    surface.header();
    const panel = [...surface.children.values()].find(child => child instanceof Panel);
    assert.ok(panel, 'actual SearchSurface mounts one native HistoryPanel');
    const retainedToggle = controls.nodes(panel).find(node => node.type === 'Button' &&
      node.accessibilityText === '展开搜索历史');
    assert.ok(retainedToggle);
    const check = (expanded, records) => {
      // Deliver the real parent observer and child @Prop update. This recorder
      // leaves native If-branch removal to ArkUI, which the direct renders cover.
      controls.properties.flush(owner => owner === surface);
      assert.deepEqual([...surface.children.values()].filter(child => child instanceof Panel), [panel]);
      assert.equal(panel.layout.expanded, expanded);
      assert.deepEqual(panel.layout.rows.flatMap(row => row.chips.map(chip => chip.keyword)), records);
    };
    const foldedKeywords = panel.layout.rows.flatMap(row => row.chips.map(chip => chip.keyword));
    assert.equal(panel.layout.rows.length, 2);
    for (const expanded of [true, false, true]) {
      retainedToggle.onClick();
      check(expanded, expanded ? keywords : foldedKeywords);
    }
    const received = [...keywords, '新收到的历史'];
    model.history = received;
    check(true, received);
    width = 240;
    surface.metricsRevision += 1;
    check(true, received);
    assert.equal(panel.layout.geometry.contentWidth, width - 2 * surface.spec.panelInnerInset);
  }

  if (id === 'top-scroll') {
    const f = fixture(keywords, { expanded: true });
    const scroll = f.nodes.find(node => node.type === 'Scroll');
    assert.equal(scroll.align, 'Alignment.TopStart');
    assert.equal(scroll.height, f.layout.bodyViewport);
    assert.ok(scroll.height > 0 && f.layout.height <= 435);
  } else if (id === 'all-history') {
    const folded = fixture(keywords);
    assert.equal(folded.layout.rows.length, 2);
    assert.equal(folded.button('搜索关键词35'), undefined);
    folded.button('展开搜索历史').onClick();
    assert.deepEqual(actions, ['toggle']);
    const expanded = fixture(keywords, { expanded: true });
    expanded.button('搜索关键词35').onClick();
    expanded.button('收起搜索历史').onClick();
    assert.deepEqual(actions, ['toggle', '关键词35', 'toggle']);
    assert.equal(fixture(['唯一记录']).button('展开搜索历史'), undefined);
    const geometry = folded.layout.geometry;
    for (const count of [1, 2]) {
      const height = geometry.fixedHeight() + count * (geometry.buttonHeight + geometry.gap) - geometry.gap;
      const compact = fixture(keywords, { height });
      const open = fixture(keywords, { height, expanded: true });
      assert.equal(compact.layout.rows.length, count);
      assert.equal(compact.layout.toggleInHeading, true);
      assert.equal(open.layout.toggleInHeading, true);
      assert.equal(open.layout.height, height);
      assert.ok(open.layout.bodyViewport >= geometry.buttonHeight);
      assert.equal(compact.button('展开搜索历史').height, open.button('收起搜索历史').height);
      assert.ok(open.button('搜索关键词35'));
    }
    await verifyRetainedPanel();
  } else if (id === 'late-history') {
    for (const width of [240, 620]) {
      const empty = fixture([], { width, status: 'loading' });
      assert.equal(empty.layout.rows.length, 0);
      const long = '很长'.repeat(80);
      const history = [...keywords, long];
      const loaded = fixture(history, { width, expanded: true });
      assert.deepEqual(loaded.layout.rows.flatMap(row => row.chips.map(chip => chip.keyword)), history);
      assert.ok(loaded.layout.rows.flatMap(row => row.chips).every(chip => chip.width <= loaded.layout.geometry.contentWidth));
      assert.ok(loaded.button(`搜索${long}`));
    }
  } else if (id === 'status-actions') {
    const pageSource = source('features/search/ui/SearchPage.ets');
    const names = ['sourceRequiredReason', 'sourceRequiredContent', 'sourceLoadErrorContent', 'sourceRecoveryActions',
      'primaryPill', 'secondaryPill'];
    const Page = createReaderBuilderProbe(pageSource, names, deps, hooks).Component;
    for (const [kind, expectedAction] of [['sourceRequired', 'manage'], ['sourceLoadError', 'retry']]) {
      const page = new Page(undefined, {});
      Object.assign(page, { presentation: { kind, reason: 'noSources' }, pageInputCurrent: () => true,
        searchStateIllustration() {}, sourceRecoveryVisible: () => true, appThemeScheme: 'day',
        surfaceModel: { verification: { enabled: () => true } },
        onManageSources: () => actions.push('manage'), retryOperation: () => actions.push('retry') });
      page[kind === 'sourceRequired' ? 'sourceRequiredContent' : 'sourceLoadErrorContent']();
      const button = controls.nodes(page).find(node => node.type === 'Button' && node.id === 'reader-search-source-recovery-primary');
      assert.ok(button, 'source recovery has its own primary action');
      button.onClick();
      fixture(['本地书']).button('搜索本地书').onClick();
      assert.deepEqual(actions.splice(0), [expectedAction, '本地书']);
    }
  } else if (id === 'history-feedback') {
    for (const [status, message, retry] of [
      ['loading', '正在读取搜索历史', undefined], ['loadFailed', '搜索历史读取失败', '重试读取'],
      ['clearFailed', '搜索历史清空失败', '重试清空'],
    ]) {
      const f = fixture(['保留记录'], { status });
      assert.ok(f.nodes.some(node => node.type === 'Text' && node.create === message));
      assert.ok(f.button('搜索保留记录'));
      const clear = f.button('清空搜索历史');
      assert.equal(clear.enabled, status !== 'loading');
      clear.onClick();
      if (retry !== undefined) f.button(retry).onClick();
      assert.deepEqual(actions.splice(0), retry === undefined ? [] : ['clear', 'retry-history']);
    }
  }
}
