// Explicit, bounded production geometry, event admission and SDK mounting only.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';
const definitions = {
  capacity: { description: 'Actual native-width newest-prefix wrapping, complete-row bounds, card coverage and short-window fallback across widths/font sizes/status budgets', resources: [] },
  measurement: { description: 'Actual history native measurement uses shared label/chrome, fp scaling once, cache invalidation and no character-count fallback', resources: [] },
  'field-owners': { description: 'Actual surface and field methods reject retired owner/field/unmounted events and stale focus callbacks', resources: [] },
  'control-frames': { description: 'Actual shared action modifier keeps width without a leading slot and matches history row height', resources: [] },
  'surface-coordinates': { description: 'Actual surface methods convert window card/IME boundaries into one local viewport with nonzero root inset', resources: [] },
  'history-render': { description: 'Actual SDK history Builder mounts only latest admitted terms without scrolling or partial rows', resources: [] },
};
const selection = selectContractCases(definitions);
if (selection.length) {
const productionRoot = new URL('../entry/src/main/ets/', import.meta.url).href;
const resolver = registerHooks({ resolve(specifier, context, next) {
  if (context.parentURL?.startsWith(productionRoot) && specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier)) return next(specifier + '.ts', context);
  return next(specifier, context);
} });
try {
const root = new URL('../entry/src/main/ets/', import.meta.url);
const { SearchHistoryGeometry, SearchHistoryViewport, SearchHistoryRow, SearchHistoryChip, projectSearchHistoryRows } = await import('../entry/src/main/ets/features/search/SearchHistoryGeometry.ts');
const { readerSearchHistoryControlHeight } = await import('../entry/src/main/ets/features/common/ReaderSearchControlGeometry.ts');
for (const selected of selection) {
  if (selected === 'capacity') {
    for (const width of [160, 326, 358, 760]) for (const height of [0, 20, 67, 100, 220, 420])
      for (const font of [1, 1.5, 2, 3.2]) for (const status of ['', 'loading', 'clearFailed']) {
        const g = new SearchHistoryGeometry(width, height, font, false, status);
        assert.equal(g.buttonHeight, readerSearchHistoryControlHeight(font));
        assert.ok(g.rows >= 0 && Number.isInteger(g.rows));
        if (g.rows > 0) assert.ok(g.rows * g.buttonHeight + (g.rows - 1) * g.gap <= g.bodyHeight + .001);
        const terms = ['短', '中等书名', '一部确实比较长的作品名称', '旧', '旧词', '再旧'];
        const natural = [31, 68, 350, 27, 41, 46].map(value => value * font);
        const projected = projectSearchHistoryRows(terms, g, word => natural[terms.indexOf(word)]);
        assert.ok(projected.length <= g.rows);
        const admitted = projected.flatMap(row => row.chips);
        assert.deepEqual(admitted.map(chip => chip.keyword), terms.slice(0, admitted.length));
        for (const row of projected) {
          assert.ok(row.width <= g.contentWidth + .001);
          assert.equal(row.width, row.chips.reduce((sum, chip) => sum + chip.width, 0) + (row.chips.length - 1) * g.gap);
          for (const chip of row.chips) assert.equal(chip.width, Math.min(g.contentWidth, Math.ceil(natural[terms.indexOf(chip.keyword)])));
        }
        if (!g.headingVisible) assert.equal(admitted.length, 0);
        if (g.emptyVisible) assert.ok(g.bodyHeight >= 18 * font);
      }
    const normal = new SearchHistoryViewport(358, 60, 700, 240);
    assert.ok(60 + normal.height >= 240 + 16); assert.equal(normal.suppressContinueCard, false);
    const short = new SearchHistoryViewport(358, 60, 190, 240);
    assert.equal(short.height, 130); assert.equal(short.suppressContinueCard, true);
    const measured = new SearchHistoryGeometry(326, 240, 1.5, false, 'clearFailed', 170);
    assert.equal(measured.feedbackHeight, 0); assert.equal(measured.recordsVisible, false);
    const oneRow = new SearchHistoryGeometry(226, 100, 1, false);
    assert.equal(oneRow.rows, 1);
    const requested = [];
    const ordered = projectSearchHistoryRows(['new-short', 'new-long', 'old-short'], oneRow, word => {
      requested.push(word); return word === 'new-long' ? 160 : 60;
    });
    assert.deepEqual(ordered.flatMap(row => row.chips.map(chip => chip.keyword)), ['new-short']);
    assert.deepEqual(requested, ['new-short', 'new-long'], 'older short record cannot jump ahead or trigger needless measurement');
    const fullRow = projectSearchHistoryRows(['too-long', 'old'], oneRow, () => 900);
    assert.equal(fullRow[0].chips[0].width, oneRow.contentWidth);
    assert.deepEqual(fullRow[0].chips.map(chip => chip.keyword), ['too-long']);
    assert.deepEqual(projectSearchHistoryRows(['unknown', 'old'], oneRow, () => Number.NaN), []);
  } else if (selected === 'measurement') {
    const { selectedProductionMethods, selectedProductionClasses } = await import('./lib/selected-production-methods.mjs');
    const { readerTypographyRoles } = await import('./lib/reader-typography-probe.mjs');
    const { foundationSpecs, readerFoundationTokens } = await import('./lib/reader-foundation-control-probe.mjs');
    const { ReaderTextStyle } = selectedProductionClasses(new URL('features/common/ReaderTypography.ets', root), ['ReaderTextStyle']);
    const specs = foundationSpecs({ ...readerTypographyRoles, ReaderTextStyle });
    let systemScale = 2;
    const Panel = selectedProductionMethods(new URL('features/search/ReaderSearchHistoryPanel.ets', root), 'ReaderSearchHistoryPanel',
      ['measuredControlWidth'], { ...specs, ...readerFoundationTokens,
        ReaderWindowCoordinator: { metrics: () => ({ systemFontScale: systemScale }) } });
    const panel = new Panel(), calls = [];
    Object.assign(panel, { metricsRevision: 4, measuredRevision: -1, measuredWidths: new Map(), getUIContext: () => ({
      px2vp: value => value / 2, getMeasureUtils: () => ({ measureText: options => { calls.push(options); return 101.2; } }),
    }) });
    const spec = specs.resolveReaderButtonSpec('search-history-keyword');
    assert.equal(panel.measuredControlWidth('长书名'), 51 + spec.horizontalPadding * 2 + readerFoundationTokens.TOK_BORDER_W * 2);
    assert.equal(calls[0].fontSize, `${spec.text.fontSizeFp}fp`);
    assert.equal(calls[0].fontFamily, spec.text.fontFamily); assert.equal(calls[0].fontWeight, spec.text.fontWeight);
    assert.equal(calls[0].textContent, '长书名');
    panel.measuredControlWidth('长书名'); assert.equal(calls.length, 1, 'same metrics reuse exact title measure');
    systemScale = .85; panel.metricsRevision += 1; panel.measuredControlWidth('长书名');
    assert.equal(calls.length, 2); assert.equal(calls[1].fontSize, `${spec.text.fontSizeFp}vp`, 'match button minimum readable scale');
    panel.getUIContext = () => ({ px2vp: value => value, getMeasureUtils: () => ({ measureText: () => Number.NaN }) });
    assert.ok(Number.isNaN(panel.measuredControlWidth('unresolved')));
    assert.equal(panel.measuredWidths.has('unresolved'), false);
  } else if (selected === 'field-owners') {
    const { selectedProductionMethods, selectedProductionClasses } = await import('./lib/selected-production-methods.mjs');
    const { ReaderLibrarySearchModel: Model } = selectedProductionClasses(new URL('features/search/ReaderLibrarySearchModel.ets', root), ['ReaderLibrarySearchModel']);
    const Surface = selectedProductionMethods(new URL('features/search/ReaderLibrarySearchSurface.ets', root), 'ReaderLibrarySearchSurface',
      ['fieldIdentity', 'acceptsField', 'textAction', 'submitAction', 'searchAction']);
    const surface = new Surface(), model = new Model(), events = [];
    Object.assign(surface, { mounted: true, identity: 4, navigationGeneration: 8, mounting: 2, transitionKind: 'none', model,
      actionInteractive: () => true });
    model.claim(1); model.activate(1); model.onText = value => events.push(value); model.onSubmit = () => events.push('submit');
    const old = surface.textAction(1, surface.fieldIdentity()); old('current');
    model.claim(2); model.activate(2); old('retired');
    const fresh = surface.textAction(2, surface.fieldIdentity()); fresh('fresh');
    const submit = surface.submitAction(2, surface.fieldIdentity()); surface.navigationGeneration += 1; submit();
    surface.mounted = false; fresh('unmounted'); assert.deepEqual(events, ['current', 'fresh']);
    class FocusFrame { constructor(action) { this.action = action; } }
    const Field = selectedProductionMethods(new URL('features/common/ReaderSearchField.ets', root), 'ReaderSearchField',
      ['changeText', 'clearBookInput', 'focusBookInput', 'submit'], { ReaderSearchFocusFrame: FocusFrame });
    const field = new Field(), frames = [], focused = [];
    Object.assign(field, { mounted: true, mode: 'submit', submitEnabled: true, focusGeneration: 1, isBookField: () => true,
      onTextChange: value => events.push(value), revealBookInputCaret() {}, onSubmit: () => events.push('submit'),
      getUIContext: () => ({ postFrameCallback: frame => frames.push(frame), getFocusController: () => ({ requestFocus: id => focused.push(id) }) }) });
    field.clearBookInput(); field.mounted = false; field.focusGeneration += 1; frames[0].action(); field.submit(); field.changeText('late');
    assert.equal(events.at(-1), ''); assert.deepEqual(focused, []);
  } else if (selected === 'surface-coordinates') {
    const { selectedProductionMethods } = await import('./lib/selected-production-methods.mjs');
    const { pureModuleProbe } = await import('./lib/ets-pure-module-probe.mjs');
    const headerMetrics = await import('../entry/src/main/ets/features/common/ReaderHeaderMetrics.ts');
    const { readerFoundationTokens } = await import('./lib/reader-foundation-control-probe.mjs');
    const { ReaderWindowMetricsSnapshot, ReaderRectVp, readerVisualSafeBottom } = await import('../entry/src/main/ets/features/common/ReaderWindowMetrics.ts');
    const { readerPresentedHeaderBottom } = await import('../entry/src/main/ets/features/common/ReaderPageShell.ts');
    const { bookshelfHeaderSpec } = pureModuleProbe(readFileSync(new URL('features/common/ReaderHeaderSpecs.ets', root), 'utf8'),
      'ReaderHeaderSpecs.ets', { ...headerMetrics, ...readerFoundationTokens }, ['bookshelfHeaderSpec']);
    const metrics = new ReaderWindowMetricsSnapshot(new ReaderRectVp(0, 0, 358, 800));
    metrics.systemInsets.bottom = 24; metrics.keyboardInsets.bottom = 200;
    const Surface = selectedProductionMethods(new URL('features/search/ReaderLibrarySearchSurface.ets', root), 'ReaderLibrarySearchSurface',
      ['surfaceHeight', 'availableBottom', 'contentHeight', 'historyLimit', 'resolvedHistoryViewport'], {
        ReaderWindowCoordinator: { metrics: () => metrics },
        readerVisualSafeBottom, bookshelfHeaderSpec, readerPresentedHeaderBottom, SearchHistoryViewport,
      });
    const surface = new Surface();
    Object.assign(surface, { surfaceWindowY: 40, headerBottom: 60, spec: { borderWidth: 1 },
      barHeight: () => 50, cardContentWidth: () => 358, continueCardRect: { y: 490, height: 100 } });
    assert.equal(surface.surfaceHeight(), 760); assert.equal(surface.availableBottom(), 560);
    assert.equal(surface.contentHeight(), 700); assert.equal(surface.historyLimit(), 500);
    const viewport = surface.resolvedHistoryViewport();
    assert.equal(viewport.height, 500); assert.equal(viewport.suppressContinueCard, true);
  } else if (selected === 'control-frames') {
    const { selectedProductionMethods, selectedProductionClasses } = await import('./lib/selected-production-methods.mjs');
    const { readerTypographyRoles } = await import('./lib/reader-typography-probe.mjs');
    const { foundationSpecs, readerFoundationTokens } = await import('./lib/reader-foundation-control-probe.mjs');
    const { pureModuleProbe } = await import('./lib/ets-pure-module-probe.mjs');
    const { readerAppColor } = await import('../entry/src/main/ets/features/common/ReaderThemeRegistry.ts');
    const { ReaderTextStyle } = selectedProductionClasses(new URL('features/common/ReaderTypography.ets', root), ['ReaderTextStyle']);
    const specs = foundationSpecs({ ...readerTypographyRoles, ReaderTextStyle });
    const scaling = pureModuleProbe(readFileSync(new URL('features/common/ReaderSurfaceResolvers.ts', root), 'utf8'),
      'ReaderSurfaceResolvers.ts', {}, ['readerScaledControlHeight']);
    const Frame = selectedProductionMethods(new URL('features/common/ReaderButton.ets', root), 'ReaderButtonFrameModifier',
      ['applyNormalAttribute'], { ...specs, ...readerFoundationTokens, ...scaling, readerAppColor });
    for (const id of ['search-field-phone', 'search-field-wide', 'search-history-keyword']) for (const scale of [1, 2, 3.2]) {
      const frame = new Frame(), calls = {};
      const instance = new Proxy({}, { get: (_target, name) => (...args) => { calls[name] = args; return instance; } });
      Object.assign(frame, { id, layout: 'intrinsic', primary: false, enabled: true, scheme: 'day', fontScale: scale,
        busy: false, availableWidth: 160, feedback: () => ({ applyNormalAttribute() {} }) });
      frame.applyNormalAttribute(instance);
      if (id.startsWith('search-field')) {
        assert.equal(specs.resolveReaderButtonSpec(id).leadingSlot, false);
        assert.equal(calls.width[0], specs.readerSearchActionWidth(id === 'search-field-wide', scale));
        assert.equal(calls.height[0], specs.readerSearchControlHeight(scale));
      } else assert.equal(calls.height[0], new SearchHistoryGeometry(358, 220, scale, false).buttonHeight);
    }
  } else if (selected === 'history-render') {
    const { createReaderComponentProbe } = await import('./lib/reader-component-probe.mjs');
    const { builderComponentMembers } = await import('./lib/ets-builder-probe.mjs');
    const { readerTypographyRoles } = await import('./lib/reader-typography-probe.mjs');
    const { readerAppColor } = await import('../entry/src/main/ets/features/common/ReaderThemeRegistry.ts');
    const { readerPageAreaLength } = await import('../entry/src/main/ets/features/common/ReaderPageShell.ts');
    const { createArkUIPropertyRuntimeProbe } = await import('./lib/arkui-property-runtime-probe.mjs');
    const source = readFileSync(new URL('features/search/ReaderSearchHistoryPanel.ets', root), 'utf8');
    const properties = createArkUIPropertyRuntimeProbe();
    class ButtonPort { constructor(owner, params, _storage, id) { Object.assign(this, { owner, params, id }); } }
    class StatePort extends ButtonPort {}
    const fixture = createReaderComponentProbe(source, builderComponentMembers(source), {
      ...properties.sdk, ReaderButton: ButtonPort, ReaderPageState: StatePort, SearchHistoryGeometry,
      SearchHistoryRow, SearchHistoryChip, projectSearchHistoryRows,
      TYPE_SEARCH_HISTORY_HEADING: readerTypographyRoles.TYPE_SEARCH_HISTORY_HEADING,
      readerAppColor, readerPageAreaLength,
    }, { ...properties.hooks, childSources: {
      ReaderButton: readFileSync(new URL('features/common/ReaderButton.ets', root), 'utf8'),
      ReaderPageState: readFileSync(new URL('features/common/ReaderPageState.ets', root), 'utf8'),
    } });
    const panel = fixture.owner, terms = Array.from({ length: 30 }, (_, index) => `keyword-${index}`), actions = [];
    const geometry = new SearchHistoryGeometry(358, 220, 1, false);
    Object.assign(panel, { history: terms, geometry, status: undefined, appThemeScheme: 'day',
      measuredControlWidth: word => 40 + Number(word.split('-')[1]) * 13, onSelect: word => actions.push(word), onClear() {} });
    panel.initialRender();
    const buttons = [...panel.children.values()].filter(child => child instanceof ButtonPort && !(child instanceof StatePort));
    const admitted = projectSearchHistoryRows(terms, geometry, word => panel.measuredControlWidth(word)).flatMap(row => row.chips);
    assert.deepEqual(buttons.map(button => button.params.label), admitted.map(chip => chip.keyword));
    assert.ok(buttons.every(button => button.params.layout === 'intrinsic'));
    const actualWidths = [...panel.nodes.values()].filter(node => node.type === '__Common__' && node.width !== undefined).map(node => node.width);
    assert.deepEqual(actualWidths, admitted.map(chip => chip.width));
    assert.ok(new Set(actualWidths).size > 1, 'native Builder preserves differing title widths');
    assert.ok(![...panel.nodes.values()].some(node => node.type === 'Scroll'));
    buttons.at(-1).params.onAction(); assert.deepEqual(actions, [admitted.at(-1).keyword]);
  }
  recordContractCasePass(selected);
}
} finally { resolver.deregister(); }
}
