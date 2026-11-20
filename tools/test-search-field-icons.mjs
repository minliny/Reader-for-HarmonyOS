// Explicit shared-library field content and leading-action state regression.
// SDK Builder lowering and unchanged production methods only; no HDC/build/network.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';
const root = new URL('../entry/src/main/ets/', import.meta.url);
const read = path => readFileSync(new URL(path, root), 'utf8');
const definitions = {
  'book-panel-content': { description: 'Actual SDK field Builder retires only the bookPanel search icon and gap while preserving native input, clear and bookPage icon', resources: [] },
  'native-search-action': { description: 'Actual SDK native search/stop control, current owner/field/phase admission and stale callback counterexample; no real search/network or native hit proof', resources: [] },
  'shelf-leading-state': { description: 'Actual SDK bar uses search for idle including closing and back for active search, retaining original action admission', resources: [] },
};
const selectedCases = selectContractCases(definitions);
for (const selected of selectedCases) {
  const { createReaderComponentProbe: createReaderBuilderProbe } = await import('./lib/reader-component-probe.mjs');
  const { createArkUIPropertyRuntimeProbe } = await import('./lib/arkui-property-runtime-probe.mjs');
  const { selectedProductionClasses } = await import('./lib/selected-production-methods.mjs');
  const { readerAppColor } = await import('../entry/src/main/ets/features/common/ReaderThemeRegistry.ts');
  if (selected === 'book-panel-content') {
    const { ReaderActionAccessibility } = selectedProductionClasses(new URL('features/common/ReaderActionAccessibility.ets', root),
      ['ReaderActionAccessibility'], { AccessibilityRoleType: { BUTTON: 'BUTTON' } });
    for (const variant of ['bookPanel', 'bookPage']) for (const clearable of [false, true]) {
      const properties = createArkUIPropertyRuntimeProbe();
      const fixture = createReaderBuilderProbe(read('features/common/ReaderSearchField.ets'),
        ['fixedLineHeightField', 'nativeInputBackground', 'nativeFieldBackground', 'iconGap', 'iconSize', 'horizontalPadding'],
        { ...properties.sdk, ReaderActionAccessibility }, properties.hooks);
      const field = fixture.owner;
      let cleared = 0;
      Object.assign(field, { variant, clearable, text: '书名', placeholder: '搜索书名', appThemeScheme: 'day',
        inputHeight: () => 36, fieldHeight: () => 36, bookInputController: {},
        bookTextStyle: () => ({ fontFamily: 'ReaderNotoSansSCUIRegular', fontWeight: 400, fontSizeFp: 14, lineHeightFp: 24 }),
        bookFontScale: () => 1, fieldBackgroundColor: () => '#FFEFEDE7', fieldBorderWidth: () => 0,
        fieldBorderColor: () => '#DDD', cornerRadius: () => 18, resolvedAccessibilityLabel: () => '搜索书名',
        searchIcon: () => 'search-marker', clearBookInput: () => { cleared++; },
      });
      field.fixedLineHeightField();
      const nodes = [...field.nodes.values()], row = nodes.find(node => node.type === 'Row');
      const images = nodes.filter(node => node.type === 'Image');
      assert.deepEqual(row.padding, { left: variant === 'bookPanel' ? 9 : 12, right: variant === 'bookPanel' ? 9 : 12 });
      assert.equal(row.create.space, variant === 'bookPanel' ? 0 : 8);
      assert.equal(images.filter(node => node.create === 'search-marker').length, variant === 'bookPanel' ? 0 : 1,
        'only the library-bar field loses the search actor');
      const input = nodes.find(node => node.type === 'TextInput');
      assert.equal(input.layoutWeight, 1); assert.equal(input.padding, 0);
      assert.equal(input.borderRadius, 0, 'reclaimed leading space retains native caret clipping fix');
      assert.equal(images.length, (variant === 'bookPanel' ? 0 : 1) + (clearable ? 1 : 0));
      if (clearable) {
        nodes.find(node => node.type === 'Stack' && node.width === (variant === 'bookPanel' ? 32 : 44)).onClick();
        assert.equal(cleared, 1, 'clear action survives removing the leading actor');
      }
    }
  } else if (selected === 'shelf-leading-state') {
    const source = read('features/search/ReaderLibrarySearchSurface.ets');
    class FieldPort {}
    for (const scheme of ['day', 'night']) for (const [mode, transitionKind] of
      [['idle', 'none'], ['idle', 'back'], ['input', 'open'], ['input', 'none'], ['results', 'none']]) {
      const properties = createArkUIPropertyRuntimeProbe();
      const fixture = createReaderBuilderProbe(source, ['bar', 'presentedSearch', 'leadingAction'],
        { ...properties.sdk, readerAppColor, ReaderSearchField: FieldPort, READER_FONT_NOTO_SANS_SC_UI_BOLD: 'ReaderNotoSansSCUIBold',
          bookshelfHeaderSpec: () => ({ titleFontSize: 19, titleLineHeight: 28 }) },
        { ...properties.hooks, childSources: { ReaderSearchField: read('features/common/ReaderSearchField.ets') } });
      const surface = fixture.owner, events = [];
      Object.assign(surface, { mounted: true, mode, transitionKind, scheme, searchMounted: false,
        identity: 4, navigationGeneration: 6, mounting: 8, moreIdentity: 'more',
        titleOpacity: () => mode === 'idle' ? 1 : 0, surfaceValue: () => mode === 'idle' ? 0 : 1,
        cardContentWidth: () => 358, barHeight: () => 52, moreAction: () => () => {},
        onOpen: (...args) => events.push(['open', ...args]), onBack: (...args) => events.push(['back', ...args]),
      });
      surface.bar();
      const nodes = [...surface.nodes.values()];
      const icon = nodes.filter(node => node.type === 'Image').at(-1);
      const label = mode === 'idle' ? '搜索书籍' : '返回';
      assert.equal(icon.create, `app.media.${mode === 'idle' ? 'bookshelf_search' : 'book_detail_back'}${scheme === 'night' ? '_theme_night' : ''}`);
      const action = nodes.find(node => node.type === 'Stack' && node.accessibilityText === label);
      assert.ok(action, 'visible leading icon and accessibility use the same current mode');
      action.onClick();
      assert.deepEqual(events, transitionKind === 'back' ? [] : [[mode === 'idle' ? 'open' : 'back', 4, 6, 8]],
        'closing still blocks repeated input; active search back behavior stays intact');
    }
  } else if (selected === 'native-search-action') {
    const source = read('features/search/ReaderLibrarySearchSurface.ets');
    const { installedEtsCompiler } = await import('./lib/ets-compiler-runtime.mjs');
    const { ts, options } = installedEtsCompiler();
    class FieldPort { constructor(owner, params) { Object.assign(this, { owner, params }); } }
    function fixture(definition = source, { scheme = 'day', sweeping = false, canSubmit = true, phase = 1 } = {}) {
      const properties = createArkUIPropertyRuntimeProbe(), actions = [];
      const tree = ts.createSourceFile('NativeSearchAction.ets', definition, ts.ScriptTarget.Latest, true, ts.ScriptKind.ETS, options);
      assert.deepEqual(tree.parseDiagnostics, []);
      // Follow the public click binding to its actual private callback factory.
      const bar = tree.statements.find(node => node.name?.text === 'ReaderLibrarySearchSurface').members.find(node => node.name?.text === 'bar');
      const factories = [];
      const visit = node => {
        if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === 'onClick') {
          const call = node.arguments[0];
          if (call && ts.isCallExpression(call) && call.arguments.length === 2 &&
            ts.isPropertyAccessExpression(call.expression) && call.expression.expression.kind === ts.SyntaxKind.ThisKeyword)
            factories.push(call.expression.name.text);
        }
        ts.forEachChild(node, visit);
      };
      visit(bar); assert.equal(factories.length, 1, 'one actual owner/field native action binding');
      const probe = createReaderBuilderProbe(definition,
        ['bar', 'presentedSearch', 'leadingAction', 'fieldIdentity', 'acceptsField', 'actionInteractive', 'inputInteractive', factories[0]],
        { ...properties.sdk, readerAppColor, ReaderSearchField: FieldPort, READER_FONT_NOTO_SANS_SC_UI_BOLD: 'ReaderNotoSansSCUIBold',
          bookshelfHeaderSpec: () => ({ titleFontSize: 19, titleLineHeight: 28 }) },
        { ...properties.hooks, childSources: { ReaderSearchField: read('features/common/ReaderSearchField.ets') } });
      const owner = probe.owner;
      const model = { owner: 7, interactive: true, sweeping, canSubmit, keyword: '书名', fieldSubmitEnabled: true,
        currentOwner() { return this.owner; }, owns(value) { return value === this.owner; }, dispatchAction(value) { actions.push(value); } };
      Object.assign(owner, { model, mounted: true, scheme, mode: 'input', transitionKind: 'none', searchMounted: true,
        identity: 4, navigationGeneration: 6, mounting: 8, moreIdentity: 'more', expandedLayout: false,
        surfaceProgress: () => phase, historyProgress: () => phase, resultsProgress: () => phase,
        titleOpacity: () => 0, surfaceValue: () => 1, cardContentWidth: () => 358, barHeight: () => 52,
        fieldWidth: () => 240, controlHeight: () => 36, actionWidth: () => 64, searchLaneWidth: () => 309,
        searchLaneLeft: () => 49, laneTop: () => 8, moreAction: () => () => {}, textAction: () => () => {},
        submitAction: () => () => {}, focusAction: () => () => {}, onOpen() {}, onBack() {},
      });
      owner.bar();
      const nodes = [...owner.nodes.values()], action = nodes.find(node => node.type === 'Stack' &&
        node.accessibilityText === (sweeping ? '停止搜索' : '搜索'));
      assert.ok(action, 'current native action and label are recorded');
      assert.equal(nodes.find(node => node.type === 'Text' && node.create === (sweeping ? '停止' : '搜索')).fontColor,
        readerAppColor('TOK_ON_PRIMARY', scheme));
      return { owner, model, actions, action };
    }
    for (const scheme of ['day', 'night']) for (const sweeping of [false, true]) for (const canSubmit of [false, true]) {
      const f = fixture(source, { scheme, sweeping, canSubmit });
      assert.equal(f.action.enabled, sweeping || canSubmit);
      f.action.onClick(); assert.deepEqual(f.actions, sweeping || canSubmit ? [7] : []);
    }
    const assertStale = definition => {
      for (const retire of [f => { f.owner.mounted = false; }, f => { f.owner.identity++; },
        f => { f.owner.navigationGeneration++; }, f => { f.owner.mounting++; }, f => { f.model.owner++; },
        f => { f.model.interactive = false; }, f => { f.owner.transitionKind = 'back'; }]) {
        const f = fixture(definition); retire(f); f.action.onClick(); assert.deepEqual(f.actions, [], 'captured old native callback is fenced');
      }
    };
    assertStale(source);
    assertStale(source.replaceAll('searchAction', 'dispatchNativeControl'));
    for (const phase of [0, .5, .99]) {
      const f = fixture(source, { phase }); assert.equal(f.action.enabled, false); f.action.onClick(); assert.deepEqual(f.actions, []);
    }
    const tree = ts.createSourceFile('NativeSearchGuard.ets', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.ETS, options);
    const method = tree.statements.find(node => node.name?.text === 'ReaderLibrarySearchSurface').members.find(node => node.name?.text === 'searchAction');
    const guards = []; const findGuard = node => { if (ts.isIfStatement(node)) guards.push(node.expression); ts.forEachChild(node, findGuard); };
    findGuard(method); assert.equal(guards.length, 1);
    const guard = guards[0], unsafe = source.slice(0, guard.getStart(tree)) + 'true' + source.slice(guard.end);
    assert.throws(() => assertStale(unsafe), /captured old native callback is fenced/, 'removing the actual callback guard is an independent failing counterexample');
  }
  recordContractCasePass(selected);
}
