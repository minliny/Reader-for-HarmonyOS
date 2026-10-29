import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';

const selected = selectContractCases({
  'measured-shadow': {
    description: 'Actual SDK header binds its painted panel measurement to shadow geometry without guessing fractional-density border extents; stale and missing bindings are rejected',
    resources: [],
  },
  'common-hit-test': {
    description: 'The actual SDK enabled Common host stays Transparent in shelf/search and disabled routes, so a full-window search actor does not block lower content; missing modifier is rejected',
    resources: [],
  },
  'retained-inputs': {
    description: 'Actual SDK child-update closures refresh persistent search identities while retained callbacks reject stale runtime, host and event identities',
    resources: [],
  },
});

for (const id of selected) {
  const { default: assert } = await import('node:assert/strict');
  const { readFileSync } = await import('node:fs');
  const { stripTypeScriptTypes } = await import('node:module');
  const { installedEtsCompiler } = await import('./lib/ets-compiler-runtime.mjs');
  const { virtualFilePath } = await import('./lib/tool-environment.mjs');
  const { ts, options, require, root } = installedEtsCompiler();
  const compiler = require(`${root}/lib/process_component_class.js`);
  const utils = require(`${root}/lib/utils.js`);
  const main = require(`${root}/main.js`);
  const syntax = require(`${root}/lib/validate_ui_syntax.js`);
  const ui = require(`${root}/lib/process_ui_syntax.js`);
  const componentMap = require(`${root}/lib/component_map.js`);
  const parse = source => ts.createSourceFile(virtualFilePath('SearchSurfaceBindingProbe.ets'), source,
    ts.ScriptTarget.Latest, true, ts.ScriptKind.ETS, options);
  if (id === 'measured-shadow') {
    const surfaceTree = parse(readFileSync(new URL('../entry/src/main/ets/features/search/ReaderLibrarySearchSurface.ets', import.meta.url), 'utf8'));
    const surface = surfaceTree.statements.find(node => node.name?.text === 'ReaderLibrarySearchSurface');
    const method = name => surface.members.find(node => node.name?.getText(surfaceTree) === name).getText(surfaceTree);
    const header = method('header');
    const raisedTree = parse(readFileSync(new URL('../entry/src/main/ets/features/common/ReaderRaisedSurface.ets', import.meta.url), 'utf8'));
    const raised = raisedTree.statements.find(node => node.name?.text === 'ReaderRaisedSurface');
    const raisedFields = raised.members.filter(ts.isPropertyDeclaration);
    syntax.componentCollection.customComponents.add('ReaderRaisedSurface');
    syntax.propertyCollection.set('ReaderRaisedSurface', new Set(raisedFields.map(node => node.name.getText(raisedTree))));
    syntax.regularCollection.set('ReaderRaisedSurface', new Set(raisedFields.filter(node => ts.getAllDecorators(node).length === 0)
      .map(node => node.name.getText(raisedTree))));
    syntax.propCollection.set('ReaderRaisedSurface', new Set(raisedFields.filter(node => ts.getAllDecorators(node).some(tag =>
      tag.expression.getText(raisedTree) === 'Prop')).map(node => node.name.getText(raisedTree))));
    const historyTree = parse(readFileSync(new URL('../entry/src/main/ets/features/search/ReaderSearchHistoryPanel.ets', import.meta.url), 'utf8'));
    const history = historyTree.statements.find(node => node.name?.text === 'ReaderSearchHistoryPanel');
    const historyFields = history.members.filter(ts.isPropertyDeclaration);
    syntax.componentCollection.customComponents.add('ReaderSearchHistoryPanel');
    syntax.propertyCollection.set('ReaderSearchHistoryPanel', new Set(historyFields.map(node => node.name.getText(historyTree))));
    syntax.propCollection.set('ReaderSearchHistoryPanel', new Set(historyFields.filter(node => ts.getAllDecorators(node).some(tag =>
      tag.expression.getText(historyTree) === 'Prop')).map(node => node.name.getText(historyTree))));
    syntax.regularCollection.set('ReaderSearchHistoryPanel', new Set(historyFields.filter(node => ts.getAllDecorators(node).length === 0)
      .map(node => node.name.getText(historyTree))));
    componentMap.CUSTOM_BUILDER_METHOD.add('header');
    componentMap.CUSTOM_BUILDER_METHOD.add('bar');
    main.partialUpdateConfig.partialUpdateMode = true;
    const areaTree = parse(readFileSync(new URL('../entry/src/main/ets/features/common/ReaderPageShell.ts', import.meta.url), 'utf8'));
    const areaNode = areaTree.statements.find(node => node.name?.text === 'readerPageAreaLength');
    const areaLength = new Function(`${stripTypeScriptTypes(areaNode.getText(areaTree).replace(/^export\s+/, ''))}; return readerPageAreaLength;`)();
    function compileHeader(builder) {
      const fixture = parse(`@Component struct MeasuredHeaderProbe {
        ${builder}
        ${method('headerSurfaceAreaChange')}
        ${method('headerSurfaceGeometryKey')}
        ${method('headerSurfaceCollapsed')}
        ${method('hasHeaderSurfaceMeasurement')}
        ${method('aboutToAppear')}
        ${method('aboutToDisappear')}
        @Builder private bar() {}
        build() { Stack() { this.header(); } }
      }`);
      utils.storedFileInfo.setCurrentArkTsFile();
      ui.transformLog.sourceFile = fixture;
      const diagnostics = [];
      let emittedNode;
      const transformed = ts.transform(fixture, [context => file => {
        ui.contextGlobal = context;
        emittedNode = compiler.processComponentClass(file.statements[0], context, diagnostics, false);
        return file;
      }]);
      transformed.dispose();
      assert.deepEqual(diagnostics, [], 'measured production header lowers with the actual SDK');
      const emitted = ts.createPrinter().printNode(ts.EmitHint.Unspecified, emittedNode, fixture);
      const panels = [];
      class ProbeView {
        constructor() { this.observers = []; this.children = new Map(); }
        finalizeConstruction() {}
        observeComponentCreation2(callback) {
          const element = this.observers.length + 1;
          this.observers.push([element, callback]); callback(element, true);
        }
        ifElseBranchUpdateFunction(_branch, callback) { callback(); }
        updateStateVarsOfChildByElmtId(element, params) { Object.assign(this.children.get(element).params, params); }
        static create() {}
      }
      class Shadow {
        constructor(parent, params, _storage, element) { this.params = params; parent.children.set(element, this); }
      }
      const attributes = extra => new Proxy(extra, { get(target, property) { return target[property] ?? (() => {}); } });
      const Column = attributes({ create() { panels.push({}); }, onAreaChange(callback) { panels.at(-1).onAreaChange = callback; } });
      const empty = attributes({});
      const metrics = { windowRect: { width: 1280 / 3.5 }, densityPixels: 3.5 };
      const Owner = new Function('ViewPU', 'ReaderRaisedSurface', 'Stack', 'Column', 'If', '__Common__',
        'Alignment', 'HitTestMode', 'Color', 'readerSurfaceElevation', 'readerHeaderVeilMaterial',
        'readerHeaderVeilBorder', 'readerAppColor', 'readerPageAreaLength', 'ReaderWindowCoordinator',
        `${stripTypeScriptTypes(emitted)}; return MeasuredHeaderProbe;`)(ProbeView, Shadow, empty, Column, empty, empty,
        { TopStart: 0 }, { Default: 0 }, { Transparent: 0 }, () => ({}), () => ({}), () => '', () => '', areaLength,
        { metrics: () => metrics });
      return { Owner, panels, metrics };
    }
    function checkMeasured(builder) {
      const { Owner, panels, metrics } = compileHeader(builder);
      const owner = Object.assign(new Owner(undefined, {}), {
        mounted: false, measurementKey: 8, mode: 'idle', animateOnAppear: false, searchMounted: false,
        headerSurfaceWidth: 111, headerSurfaceHeight: 222, headerSurfaceInputKey: 'old-mount',
        scheme: 'night', spec: { panelRadius: 18, borderWidth: 1 },
        headerVeil: () => true, historyFraction: 0, historyProgress() { return this.historyFraction; },
        historyViewportHeight: () => 100, horizontalInset: () => 16,
        cardContentWidth: () => 1168 / 3.5 - 2, barHeight: () => 52,
        retargetHistoryViewport() {}, historyLimitTrack: { set() {} }, historyLimit: () => 1, snapToMode() {},
      });
      const render = () => {
        panels.length = 0; owner.observers.length = 0; owner.children.clear(); owner.header();
        return { shadow: [...owner.children.values()][0]?.params, measure: panels.at(-1)?.onAreaChange };
      };
      owner.aboutToAppear();
      assert.deepEqual([owner.headerSurfaceWidth, owner.headerSurfaceHeight], [0, 0], 'mount clears prior measured geometry');
      const first = render();
      assert.equal(first.shadow, undefined, 'first layout must not guess a shadow border box');
      assert.equal(typeof first.measure, 'function', 'painted panel must expose its measurement callback');
      first.measure({}, { width: 1168 / 3.5, height: 188 / 3.5 });
      const measured = render();
      assert.deepEqual([measured.shadow?.surfaceWidth, measured.shadow?.surfaceHeight], [1168 / 3.5, 188 / 3.5],
        'shadow receives the actual fractional-density native border box, including snapped borders');
      assert.notEqual(measured.shadow.surfaceHeight, owner.barHeight() + 2 * owner.spec.borderWidth,
        'native 188px must not be replaced with the 189px logical-border estimate');
      owner.searchMounted = true; owner.historyFraction = .5;
      const expandedMeasure = owner.headerSurfaceAreaChange();
      expandedMeasure({}, { width: 1168 / 3.5, height: 300 });
      assert.deepEqual([owner.headerSurfaceWidth, owner.headerSurfaceHeight], [1168 / 3.5, 188 / 3.5],
        'expanded history cannot replace the confirmed collapsed border box');
      assert.equal(owner.hasHeaderSurfaceMeasurement(), false, 'expanded history cannot mount a collapsed shadow');
      owner.historyFraction = .005;
      assert.equal(owner.hasHeaderSurfaceMeasurement(), false, 'veil threshold does not mount a shadow while any history height remains');
      owner.historyFraction = 0;
      assert.equal(owner.hasHeaderSurfaceMeasurement(), true, 'strictly collapsed history reuses the confirmed border box');
      expandedMeasure({}, { width: 1168 / 3.5, height: 300 });
      assert.equal(owner.headerSurfaceHeight, 188 / 3.5, 'queued expanded receipt remains rejected after collapse');
      owner.searchMounted = false;
      assert.equal(render().shadow?.surfaceHeight, 188 / 3.5, 'retained panel returns to shelf without a changed-size event');
      metrics.windowRect.width = 600;
      assert.equal(render().shadow, undefined, 'real available-width change invalidates the cached box');
      measured.measure({}, { width: 568, height: 188 / 3.5 });
      assert.equal(render().shadow, undefined, 'old geometry input callback cannot validate the new width');
      render().measure({}, { width: 568, height: 188 / 3.5 });
      assert.equal(render().shadow?.surfaceWidth, 568, 'fresh width measurement restores the shadow');
      owner.barHeight = () => 70;
      assert.equal(render().shadow, undefined, 'real bar-height change invalidates the cached box');
      render().measure({}, { width: 568, height: 72 });
      assert.equal(render().shadow?.surfaceHeight, 72, 'fresh height measurement restores the shadow');
      metrics.densityPixels = 2;
      assert.equal(render().shadow, undefined, 'density change invalidates native border snapping');
      render().measure({}, { width: 568, height: 72 });
      owner.measurementKey++;
      const oldKeyMeasure = render().measure;
      owner.measurementKey++;
      oldKeyMeasure({}, { width: 600, height: 300 });
      assert.deepEqual([owner.headerSurfaceWidth, owner.headerSurfaceHeight], [568, 72], 'old layout callback is rejected');
      const current = render();
      current.measure({}, { width: '568vp', height: '71vp' });
      assert.deepEqual([render().shadow?.surfaceWidth, render().shadow?.surfaceHeight], [568, 71], 'current layout measurement updates both axes');
      current.measure({}, { width: NaN, height: 71 });
      assert.equal(render().shadow, undefined, 'invalid collapsed geometry clears the shadow');
      current.measure({}, { width: 568, height: 71 });
      owner.aboutToDisappear();
      current.measure({}, { width: 20, height: 20 });
      assert.deepEqual([owner.headerSurfaceWidth, owner.headerSurfaceHeight], [568, 71], 'unmounted callback cannot mutate geometry');
    }
    checkMeasured(header);
    const missing = header.replace(/\s*\.onAreaChange\(this\.headerSurfaceAreaChange\(\)\)/, '');
    assert.notEqual(missing, header, 'negative control removes the painted panel binding');
    assert.throws(() => checkMeasured(missing), /painted panel must expose/, 'missing measurement is rejected');
    const formula = header.replace('surfaceWidth: this.headerSurfaceWidth', 'surfaceWidth: this.cardContentWidth() + 2 * this.spec.borderWidth')
      .replace('surfaceHeight: this.headerSurfaceHeight', 'surfaceHeight: this.barHeight() + 2 * this.spec.borderWidth');
    assert.notEqual(formula, header, 'negative control reinstates the approximate geometry');
    assert.throws(() => checkMeasured(formula), /actual fractional-density/, 'the installed one-pixel mismatch is rejected');
    recordContractCasePass(id);
    continue;
  }
  const source = readFileSync(new URL('../entry/src/main/ets/pages/Index.ets', import.meta.url), 'utf8');
  const tree = parse(source);
  const index = tree.statements.find(node => node.name?.text === 'Index');
  const names = ['librarySearchSurface', 'isCurrentSearchPresentation', 'isCurrentBookshelfPresentation'];
  const methods = names.map(name => index.members.find(node => node.name?.getText(tree) === name).getText(tree)).join('\n');
  const childTree = parse(readFileSync(new URL('../entry/src/main/ets/features/search/ReaderLibrarySearchSurface.ets', import.meta.url), 'utf8'));
  const child = childTree.statements.find(node => node.name?.text === 'ReaderLibrarySearchSurface');
  const fields = child.members.filter(ts.isPropertyDeclaration);
  const childName = child.name.text;
  syntax.componentCollection.customComponents.add(childName);
  syntax.propertyCollection.set(childName, new Set(fields.map(node => node.name.getText(childTree))));
  syntax.regularCollection.set(childName, new Set(fields.filter(node => ts.getAllDecorators(node).length === 0)
    .map(node => node.name.getText(childTree))));
  for (const [decorator, collection] of [['BuilderParam', syntax.builderParamObjectCollection],
    ['Prop', syntax.propCollection], ['ObjectLink', syntax.objectLinkCollection]]) {
    collection.set(childName, new Set(fields.filter(node => ts.getAllDecorators(node).some(tag =>
      tag.expression.getText(childTree) === decorator)).map(node => node.name.getText(childTree))));
  }
  componentMap.CUSTOM_BUILDER_METHOD.add('librarySearchSurface');
  componentMap.CUSTOM_BUILDER_METHOD.add('librarySearchResults');
  main.partialUpdateConfig.partialUpdateMode = true;

  class View {
    constructor() { this.observers = []; this.children = new Map(); }
    finalizeConstruction() {}
    observeComponentCreation2(callback) {
      const element = this.observers.length + 1;
      this.observers.push([element, callback]); callback(element, true);
    }
    updateStateVarsOfChildByElmtId(element, params) { Object.assign(this.children.get(element).params, params); }
    replay() { for (const [element, callback] of [...this.observers]) callback(element, false); }
    static create() {}
  }
  class Surface {
    constructor(parent, params, storage, element) { this.params = params; parent.children.set(element, this); }
  }
  function compile(body) {
    const fixture = parse(`@Component struct SearchSurfaceBindingProbe { ${body}\nbuild() { Column() {} } }`);
    utils.storedFileInfo.setCurrentArkTsFile();
    ui.transformLog.sourceFile = fixture;
    const diagnostics = [];
    let emittedNode;
    const transformed = ts.transform(fixture, [context => file => {
      ui.contextGlobal = context;
      emittedNode = compiler.processComponentClass(file.statements[0], context, diagnostics, false);
      return file;
    }]);
    transformed.dispose();
    assert.deepEqual(diagnostics, [], 'actual persistent surface Builder lowers without diagnostics');
    const emitted = ts.createPrinter().printNode(ts.EmitHint.Unspecified, emittedNode, fixture);
    const commonCalls = [];
    const Owner = new Function('ViewPU', 'ReaderLibrarySearchSurface', '__Common__', 'HitTestMode',
      `${stripTypeScriptTypes(emitted)}; return SearchSurfaceBindingProbe;`)(View, Surface,
      { create() { commonCalls.push({}); }, enabled(value) { commonCalls.at(-1).enabled=value; },
        hitTestBehavior(value) { commonCalls.at(-1).hitTestBehavior=value; }, pop() {} },
      { Transparent: 'HitTestMode.Transparent' });
    Owner.commonCalls = commonCalls;
    return Owner;
  }
  function fixture(Owner, oldParameters = false) {
    const runtime = {}, host = {};
    const owner = Object.assign(new Owner(undefined, {}), {
      route: 'bookshelf', mountedRuntimeOwner: runtime, searchHost: host,
      navigationGeneration: 8, detailShelfAdmissionMount: 4, librarySearchIdentity: 5,
      shelfMoreIdentity: 'more-a', librarySearchMode: 'idle', librarySearchModel: { currentOwner: () => 1 },
      shelfReceiptRetired: false, settingsSnapshot: { reduceMotion: false },
      isCurrentRuntime: candidate => candidate === runtime, expandedLayout: () => false,
      backCount: 0, backLibrarySearch() { this.backCount++; }, librarySearchResults() {},
    });
    if (oldParameters) owner.librarySearchSurface(8, runtime, 4, host, 5, 'more-a');
    else owner.librarySearchSurface(runtime, host);
    const child = [...owner.children.values()][0];
    return { owner, child, runtime, host };
  }
  if (id === 'common-hit-test') {
    function checkCommon(Owner) {
      const value = fixture(Owner);
      assert.equal(Owner.commonCalls.at(-1).enabled, true);
      for (const route of ['bookshelf','search','settings']) {
        value.owner.route=route; value.owner.replay();
        assert.equal(Owner.commonCalls.at(-1).enabled, route==='bookshelf'||route==='search');
        assert.equal(Owner.commonCalls.at(-1).hitTestBehavior, 'HitTestMode.Transparent',
          'the generated enabled Common host must not turn the transparent full-window actor into a blocking sibling');
      }
      assert.equal(value.owner.children.size, 1, 'route updates retain the same search actor');
    }
    checkCommon(compile(methods));
    const withoutHitTest=methods.replace(/\s*\.hitTestBehavior\(HitTestMode\.Transparent\)/, '');
    assert.notEqual(withoutHitTest,methods,'negative control removes only the explicit Common hit-test policy');
    assert.throws(()=>checkCommon(compile(withoutHitTest)),/generated enabled Common host/,
      'the installed regression has an implicit Default Common host and is rejected');
    recordContractCasePass(id);
    continue;
  }
  const live = fixture(compile(methods));
  const callbacks = live.child.params;
  Object.assign(live.owner, { route: 'search', navigationGeneration: 9, detailShelfAdmissionMount: 5,
    librarySearchIdentity: 6, shelfMoreIdentity: 'more-b', librarySearchMode: 'input' });
  live.owner.replay();
  assert.deepEqual([callbacks.identity, callbacks.navigationGeneration, callbacks.mounting, callbacks.moreIdentity],
    [6, 9, 5, 'more-b'], 'one mounted child receives the current primitive identities');
  callbacks.onBack(5, 8, 4);
  assert.equal(live.owner.backCount, 0, 'old presented event cannot act');
  callbacks.onBack(6, 9, 5);
  assert.equal(live.owner.backCount, 1, 'retained callback accepts current event with original runtime/host');
  live.owner.mountedRuntimeOwner = {};
  callbacks.onBack(6, 9, 5);
  assert.equal(live.owner.backCount, 1, 'old callback cannot switch to a replacement runtime');
  live.owner.mountedRuntimeOwner = live.runtime;
  live.owner.searchHost = {};
  callbacks.onBack(6, 9, 5);
  assert.equal(live.owner.backCount, 1, 'old callback cannot switch to a replacement search host');

  const previous = methods
    .replace('librarySearchSurface(owner: ReaderRuntimeOwner | undefined, host: SearchHost)',
      'librarySearchSurface(generation: number, owner: ReaderRuntimeOwner | undefined, mounting: number, host: SearchHost, identity: number, moreIdentity: string)')
    .replace('identity: this.librarySearchIdentity,', 'identity,')
    .replace('navigationGeneration: this.navigationGeneration, mounting: this.detailShelfAdmissionMount,',
      'navigationGeneration: generation, mounting,')
    .replace('moreIdentity: this.shelfMoreIdentity,', 'moreIdentity,');
  assert.notEqual(previous, methods, 'negative control reinstates the old captured parameters');
  const old = fixture(compile(previous), true);
  Object.assign(old.owner, { navigationGeneration: 9, detailShelfAdmissionMount: 5,
    librarySearchIdentity: 6, shelfMoreIdentity: 'more-b' });
  old.owner.replay();
  assert.deepEqual([old.child.params.identity, old.child.params.navigationGeneration,
    old.child.params.mounting, old.child.params.moreIdentity], [5, 8, 4, 'more-a'],
    'actual old SDK update closure reproduces frozen identities');
  recordContractCasePass(id);
}
