import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';

const cases = { 'book-caret-follow': {
  description: 'Actual persistent search surface/model/Page to native book input callbacks reveal the latest native caret after layout, retaining selection/IME and owner lifecycle',
  resources: [],
} };

for (const id of selectContractCases(cases)) {
  const productionRoot = new URL('../entry/src/main/ets/', import.meta.url).href;
  const resolver = registerHooks({ resolve(specifier, context, next) {
    if (context.parentURL?.startsWith(productionRoot) && specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier))
      return next(specifier + '.ts', context);
    return next(specifier, context);
  } });
  try {
  const { createReaderComponentProbe } = await import('./lib/reader-component-probe.mjs');
  const { createArkUIPropertyRuntimeProbe } = await import('./lib/arkui-property-runtime-probe.mjs');
  const { builderComponentMembers } = await import('./lib/ets-builder-probe.mjs');
  const { installedEtsCompiler } = await import('./lib/ets-compiler-runtime.mjs');
  const { pureModuleProbe } = await import('./lib/ets-pure-module-probe.mjs');
  const { selectedProductionMethods, selectedProductionClasses } = await import('./lib/selected-production-methods.mjs');
  const { readerFoundationTokens, foundationSpecs } = await import('./lib/reader-foundation-control-probe.mjs');
  const { readerTypographyRoles } = await import('./lib/reader-typography-probe.mjs');
  const { readerAppColor } = await import('../entry/src/main/ets/features/common/ReaderThemeRegistry.ts');
  const { SearchViewState } = await import('../entry/src/main/ets/features/search/SearchViewState.ts');
  const { ReaderLibrarySearchModel } = selectedProductionClasses(new URL('../entry/src/main/ets/features/search/ReaderLibrarySearchModel.ets', import.meta.url), ['ReaderLibrarySearchModel']);
  const read = name => readFileSync(new URL(`../entry/src/main/ets/${name}`, import.meta.url), 'utf8');
  const fieldSource = read('features/common/ReaderSearchField.ets');
  const surfaceFile = new URL('../entry/src/main/ets/features/search/ReaderLibrarySearchSurface.ets', import.meta.url);
  const surfaceSource = readFileSync(surfaceFile, 'utf8');
  const { ts, options, require, root } = installedEtsCompiler();
  const parse = (source, name) => {
    const tree = ts.createSourceFile(name, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.ETS, options);
    assert.equal(tree.parseDiagnostics.length, 0, 'complete current source parses'); return tree;
  };
  // Actual ordinary declarations, selected by SDK AST; FrameCallback remains a
  // finite scheduling port. Component/marker spelling never delimits the input.
  const fieldTree = parse(fieldSource, 'ReaderSearchField.ets');
  const declarations = fieldTree.statements.filter(ts.isClassDeclaration);
  const fieldClasses = pureModuleProbe(declarations.map(node => node.getText(fieldTree)).join('\n'),
    'SearchFieldDeclarations.ets', { FrameCallback: class {} }, declarations.map(node => node.name.text));
  const surfaceTree = parse(surfaceSource, 'ReaderLibrarySearchSurface.ets');
  const surfaceOwner = surfaceTree.statements.find(node => node.name?.text === 'ReaderLibrarySearchSurface');
  let fieldCall;
  const visit = node => {
    if (node.expression?.getText(surfaceTree) === 'ReaderSearchField' && node.arguments?.length) {
      assert.equal(fieldCall, undefined, 'one current retained native search input'); fieldCall = node;
    }
    ts.forEachChild(node, visit);
  };
  visit(surfaceOwner); assert.ok(fieldCall);
  const wrapper = `@Component struct CurrentSearchInputProbe {
    @ObjectLink model: ReaderLibrarySearchModel;
    @Builder private input(key: string = this.fieldIdentity()) { ${fieldCall.getText(surfaceTree)}; }
    build() { Column() {} }
  }`;
  const Surface = selectedProductionMethods(surfaceFile, 'ReaderLibrarySearchSurface',
    ['fieldIdentity', 'acceptsField', 'textAction', 'submitAction', 'focusAction']);
  const Page = selectedProductionMethods(new URL('../entry/src/main/ets/features/search/SearchPage.ets', import.meta.url), 'SearchPage',
    ['ownsSurface', 'ownsPageQuery', 'bindSurface', 'publishSurface'], { nextSearchSurfaceOwner: 0 });
  const modelTree = parse(read('features/search/ReaderLibrarySearchModel.ets'), 'ReaderLibrarySearchModel.ets');
  const observedNames = modelTree.statements.filter(node => ts.isClassDeclaration(node) &&
    ts.getAllDecorators(node).some(decorator => decorator.getText(modelTree) === '@Observed')).map(node => node.name.text);
  assert.ok(observedNames.includes('ReaderLibrarySearchModel'));
  const idMap = require(root + '/lib/component_map.js').ID_ATTRS;
  const observed = require(root + '/lib/validate_ui_syntax.js').observedClassCollection;
  const compile = make => { const saved = new Map(idMap), priorObserved = new Set(observed); idMap.clear();
    for (const name of observedNames) observed.add(name);
    try { return make(); }
    finally { idMap.clear(); for (const [key,value] of saved) idMap.set(key,value);
      observed.clear(); for (const name of priorObserved) observed.add(name); } };
  function fixture(variant = 'bookPanel') {
    const properties = createArkUIPropertyRuntimeProbe(), frames = [], controllers = [], calls = [];
    class Controller {
      constructor() { controllers.push(this); this.caret = { index: 0, x: 0, y: 0 }; }
      getCaretOffset() { calls.push(['get-caret']); if (this.fail) throw new Error('detached'); return this.caret; }
      scrollToVisible(range) { calls.push(['scroll', { ...range }]); }
      caretPosition() { throw new Error('caret must stay native-owned'); }
      setTextSelection() { throw new Error('selection must stay native-owned'); }
      clearPreviewText() { throw new Error('IME preview must stay native-owned'); }
      addText() { throw new Error('text must stay native-owned'); }
    }
    const uiContext = { postFrameCallback: frame => frames.push(frame),
      getFocusController: () => ({ requestFocus: () => {} }) };
    // This installed frontend emits the SDK's legacy misspelled ObjectLink
    // alias. Execute its actual empty compatibility subclass, not a copied
    // property implementation, against this fixture's actual SDK superclass.
    const runtimeAlias = readFileSync(properties.source.path).toString('utf8')
      .match(/class SynchedPropertyNesedObjectPU extends SynchedPropertyNestedObjectPU\s*\{\s*\}/)?.[0];
    assert.ok(runtimeAlias, 'installed SDK ObjectLink compatibility declaration');
    const SynchedPropertyNesedObjectPU = new Function('SynchedPropertyNestedObjectPU',
      runtimeAlias + ';return SynchedPropertyNesedObjectPU;')(properties.sdk.SynchedPropertyNestedObjectPU);
    const dependencies = { ...properties.sdk, SynchedPropertyNesedObjectPU, uiContext, TextInputController: Controller,
      ...readerFoundationTokens, ...foundationSpecs(), ...readerTypographyRoles, ...fieldClasses, readerAppColor,
      ReaderWindowCoordinator: { metrics: () => ({ systemFontScale: 1 }) } };
    const actualField = compile(() => createReaderComponentProbe(fieldSource,
      builderComponentMembers(fieldSource, 'ReaderSearchField'), dependencies,
      { ...properties.hooks, mountChildren: true }));
    // Execute the current ordinary model through the SDK observed-object proxy.
    // Dependency delivery is instrumented; no native render/layout is modeled.
    const model = properties.sdk.ObservedObject.createNew(new ReaderLibrarySearchModel(), undefined);
    const page = Object.assign(new Page(), { keyword: '旧关键词', pageMounted: true, pageEpoch: 1, queryAtMount: 0,
      viewState: new SearchViewState(), surfaceModel: model, isPresentationCurrent: () => true,
      presentation: { kind: 'initial', history: [] }, hasSearchSession: () => false,
      isSweeping: () => false, canSubmit: () => true, searchProgressText: () => '', groupNames: () => [],
      focusInputOnAppear: false, selectedGroupName: '全部', selectedContentType: '全部类型', filtersExpanded: false });
    page.viewState.pageRevision = 1; page.viewState.keywordDraft = page.keyword; page.bindSurface();
    const { owner: surface } = compile(() => createReaderComponentProbe(wrapper, ['model', 'input'],
      { ...dependencies, ReaderSearchField: actualField.Component },
      { ...properties.hooks, childSources: { ReaderSearchField: fieldSource }, mountChildren: true, lifecycleChildren: true,
        initialParams: { model } }));
    for (const name of ['fieldIdentity', 'acceptsField', 'textAction', 'submitAction', 'focusAction']) surface[name] = Surface.prototype[name];
    Object.assign(surface, { mounted: true, identity: 5, navigationGeneration: 3, mounting: 2, transitionKind: 'none',
      mode: 'input', expandedLayout: false, resultsProgress: () => 0, onInputRequested: () => {} });
    surface.input();
    const field = [...surface.children.values()].find(child => child instanceof actualField.Component);
    assert.ok(field);
    // bookPanel is the actual current parent branch; bookPage exercises the
    // same shared input's compatibility variant, not a second product mount.
    field.variant = variant; properties.flush();
    const input = [...field.nodes.values()].find(node => node.type === 'TextInput');
    assert.ok(input);
    assert.equal(input.create.controller, field.bookInputController,
      'the production-created controller is bound to the actual native TextInput');
    const controller = field.bookInputController;
    const scrolls = () => calls.filter(call => call[0] === 'scroll');
    const flushFrames = () => { while (frames.length) frames.shift().onIdle(); };
    return { page, surface, model, field, input, controller, calls, frames, properties, scrolls, flushFrames };
  }

  for (const variant of ['bookPanel', 'bookPage']) {
    const f = fixture(variant);
    const text = '还不起学贷的我只好兼职猎魔🌙'.repeat(20);
    f.input.onFocus();
    f.input.onChange(text); f.input.onTextSelectionChange(text.length, text.length);
    f.input.onAreaChange({ width: 240 }, { width: 196 });
    f.controller.caret = { index: text.length, x: 1500, y: 0 };
    f.properties.flush();
    assert.equal(f.page.keyword, text); assert.equal(f.page.viewState.keywordDraft, text);
    assert.equal(f.frames.length, 1, 'typing, parent echo, selection and width change share one frame');
    assert.equal(f.calls.length, 0, 'no native caret is read before layout');
    f.flushFrames();
    assert.deepEqual(f.scrolls().at(-1), ['scroll', { start: text.length, end: text.length }]);

    // Read the latest native active edge after layout, not the callback's old
    // selection or the committed draft's end. This includes surrogate pairs.
    f.input.onTextSelectionChange(4, 10);
    f.input.onChange(text.slice(0, 7) + '新' + text.slice(7));
    f.controller.caret = { index: 8, x: -30, y: 0 };
    f.properties.flush(); f.flushFrames();
    assert.deepEqual(f.scrolls().at(-1), ['scroll', { start: 8, end: 8 }]);
    assert.notEqual(f.scrolls().at(-1)[1].start, f.page.keyword.length);

    // A composing index can be beyond the committed value. Never clamp it or
    // finish preview text; only forward the native index to native scrolling.
    f.input.onChange('已提交', { offset: 3, value: 'pinyin' });
    f.controller.caret = { index: 9, x: 400, y: 0 };
    f.properties.flush(); f.flushFrames();
    assert.equal(f.page.keyword, '已提交');
    assert.deepEqual(f.scrolls().at(-1), ['scroll', { start: 9, end: 9 }]);

    // An external update/publication replay retains the same native controller.
    const retained = f.input.create.controller;
    f.page.presentation = { kind: 'results', keyword: '旧查询', results: [] };
    f.page.publishSurface(); f.properties.flush();
    assert.equal(f.page.keyword, '已提交'); assert.equal(f.input.create.controller, retained);
    f.page.keyword = text; f.page.publishSurface(); f.properties.flush();
    f.controller.caret = { index: 12, x: 500, y: 0 }; f.flushFrames();
    assert.deepEqual(f.scrolls().at(-1), ['scroll', { start: 12, end: 12 }]);

    const clear = [...f.field.nodes.values()].find(node => node.accessibilityText === '清空搜索内容' && node.onClick);
    assert.ok(clear); clear.onClick(); f.properties.flush();
    f.controller.caret = { index: 0, x: 0, y: 0 }; f.flushFrames();
    assert.equal(f.page.keyword, ''); assert.equal(f.page.viewState.keywordDraft, '');
    assert.deepEqual(f.scrolls().at(-1), ['scroll', { start: 0, end: 0 }]);

    for (const invalid of [undefined, null, { index: NaN }, { index: Infinity }, { index: -1 }, { index: 1.5 }]) {
      const before = f.scrolls().length; f.controller.caret = invalid;
      f.input.onTextSelectionChange(0, 0); f.flushFrames();
      assert.equal(f.scrolls().length, before, 'unbound/invalid native caret does not escape into range API');
    }
    f.controller.fail = true; f.input.onTextSelectionChange(0, 0);
    assert.doesNotThrow(f.flushFrames, 'detached binding is a cancelled visual request');
    f.controller.fail = false; f.controller.caret = { index: 0, x: 0, y: 0 };
    const beforeRefocus = f.scrolls().length;
    f.input.onAreaChange({ width: 196 }, { width: 160 });
    f.input.onBlur(); f.input.onFocus();
    f.controller.caret = { index: 2, x: 300, y: 0 }; f.flushFrames();
    assert.equal(f.scrolls().length, beforeRefocus + 1, 'an old blurred frame cannot cancel the replacement focus request');
    assert.deepEqual(f.scrolls().at(-1), ['scroll', { start: 2, end: 2 }]);
    const beforeBlur = f.scrolls().length;
    f.input.onAreaChange({ width: 196 }, { width: 100 }); f.input.onBlur();
    f.flushFrames(); assert.equal(f.scrolls().length, beforeBlur);
    // Keep the field mounted while retiring each parent identity. Testing this
    // after field disappearance would let its local mounted guard mask a lost
    // Page/Surface/model guard and give a vacuous parent-lifecycle result.
    const owner = f.model.currentOwner();
    for (const [change, restore] of [
      [() => { f.page.pageMounted = false; }, () => { f.page.pageMounted = true; }],
      [() => { f.page.isPresentationCurrent = () => false; }, () => { f.page.isPresentationCurrent = () => true; }],
      [() => { f.page.pageEpoch++; }, () => { f.page.pageEpoch--; }],
      [() => { f.page.queryAtMount--; }, () => { f.page.queryAtMount++; }],
      [() => { f.surface.identity++; }, () => { f.surface.identity--; }],
      [() => { f.surface.navigationGeneration++; }, () => { f.surface.navigationGeneration--; }],
      [() => { f.surface.mounting++; }, () => { f.surface.mounting--; }],
      [() => { f.surface.transitionKind = 'back'; }, () => { f.surface.transitionKind = 'none'; }],
      [() => { f.model.suspend(); }, () => { f.model.activate(owner); }],
      [() => { f.model.claim(owner + 1); f.model.activate(owner + 1); }, () => { f.model.claim(owner); f.model.activate(owner); }],
    ]) {
      const priorDraft = f.page.keyword; change();
      f.input.onChange('旧宿主回调'); assert.equal(f.page.keyword, priorDraft); assert.equal(f.page.viewState.keywordDraft, priorDraft);
      restore();
    }
    f.input.onChange('当前合法输入'); f.properties.flush();
    assert.equal(f.page.keyword, '当前合法输入'); assert.equal(f.model.keyword, '当前合法输入');
    f.input.onFocus(); f.field.aboutToDisappear(); f.flushFrames();
    assert.equal(f.scrolls().length, beforeBlur, 'unmount retires the queued native visual request');
    const priorDraft = f.page.keyword;
    f.input.onChange('卸载后回调'); assert.equal(f.page.keyword, priorDraft);
  }
  console.log('actual SDK book TextInput controller binding, layout-coalesced native caret range and IME/selection/lifecycle boundaries: PASS; native pixels NOT_RUN');
  recordContractCasePass(id);
  } finally { resolver.deregister(); }
}
