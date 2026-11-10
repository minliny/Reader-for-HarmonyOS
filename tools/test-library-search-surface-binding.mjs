import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';

const selected = selectContractCases({
  'measured-shadow': {
    description: 'Actual SDK header owns one rounded Native material/shadow and measured fractional-density radius; stale or missing bindings and a second phone painter are rejected',
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
    const surfaceTree = parse(readFileSync(new URL('../entry/src/main/ets/features/search/ui/ReaderLibrarySearchSurface.ets', import.meta.url), 'utf8'));
    const surface = surfaceTree.statements.find(node => node.name?.text === 'ReaderLibrarySearchSurface');
    const method = name => surface.members.find(node => node.name?.getText(surfaceTree) === name).getText(surfaceTree);
    const header = method('header');
    const { resolveReaderRaisedShape } = await import('../entry/src/main/ets/ui/layout/ReaderRaisedShape.ts');
    const { readerSurfaceSpecsForProbe } = await import('./lib/bounded-surface-sdk-probe.mjs');
    assert.equal(surfaceTree.getFullText().includes("from '../../../ui/surfaces/ReaderRaisedSurface'"), false,
      'the real search header does not import a second phone painter');
    const historyTree = parse(readFileSync(new URL('../entry/src/main/ets/features/search/ui/ReaderSearchHistoryPanel.ets', import.meta.url), 'utf8'));
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
    const areaTree = parse(readFileSync(new URL('../entry/src/main/ets/ui/layout/ReaderPageShell.ts', import.meta.url), 'utf8'));
    const areaNode = areaTree.statements.find(node => node.name?.text === 'readerPageAreaLength');
    const areaLength = new Function(`${stripTypeScriptTypes(areaNode.getText(areaTree).replace(/^export\s+/, ''))}; return readerPageAreaLength;`)();
    function compileHeader(builder) {
      const fixture = parse(`@Component struct MeasuredHeaderProbe {
        ${builder}
        ${method('headerSurfaceAreaChange')}
        ${method('headerSurfaceGeometryKey')}
        ${method('headerSurfaceCollapsed')}
        ${method('hasHeaderSurfaceMeasurement')}
        ${method('headerRaisedShapeIdentity')}
        ${method('currentHeaderRaisedShape')}
        ${method('headerMaterialRadius')}
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
      const attributes = extra => new Proxy(extra, { get(target, property) { return target[property] ?? (() => {}); } });
      const Column = attributes({ create() { panels.push({}); },
        onAreaChange(callback) { panels.at(-1).onAreaChange = callback; },
        borderRadius(value) { panels.at(-1).borderRadius=value; }, clip(value) { panels.at(-1).clip=value; },
        shadow(value) { panels.at(-1).shadow=value; } });
      const empty = attributes({});
      const metrics = { windowRect: { width: 1280 / 3.5 }, densityPixels: 3.5 };
      const elevation=readerSurfaceSpecsForProbe(metrics).readerSurfaceElevation;
      const Owner = new Function('ViewPU', 'Stack', 'Column', 'If', '__Common__',
        'Alignment', 'HitTestMode', 'Color', 'readerSurfaceElevation', 'readerHeaderVeilMaterial',
        'readerHeaderVeilBorder', 'readerAppColor', 'readerPageAreaLength', 'ReaderWindowCoordinator', 'resolveReaderRaisedShape',
        `${stripTypeScriptTypes(emitted)}; return MeasuredHeaderProbe;`)(ProbeView, empty, Column, empty, empty,
        { TopStart: 0 }, { Default: 0 }, { Transparent: 0 }, elevation, () => ({}), () => '', () => '', areaLength,
        { metrics: () => metrics }, resolveReaderRaisedShape);
      return { Owner, panels, metrics, elevation };
    }
    function checkMeasured(builder) {
      const { Owner, panels, metrics, elevation } = compileHeader(builder);
      const owner = Object.assign(new Owner(undefined, {}), {
        mounted: false, measurementKey: 8, raisedAppearanceEpoch:0, identity:1, navigationGeneration:2, mounting:3,
        mode: 'idle', animateOnAppear: false, searchMounted: false, headerRaisedShape:undefined,
        model:{bindInputBack:()=>()=>{}},
        scheme: 'night', spec: { panelRadius: 18, borderWidth: 1 },
        headerVeil: () => true, historyFraction: 0, historyProgress() { return this.historyFraction; },
        historyViewportHeight: () => 100, horizontalInset: () => 16,
        cardContentWidth: () => 1168 / 3.5 - 2, barHeight: () => 52,
        retargetHistoryViewport() {}, historyLimitTrack: { set() {} }, historyLimit: () => 1, snapToMode() {},
      });
      const render = () => {
        panels.length = 0; owner.observers.length = 0; owner.children.clear(); owner.header();
        const material=panels.find(panel=>panel.onAreaChange);
        return { material, measure: material?.onAreaChange, children:[...owner.children.values()] };
      };
      owner.aboutToAppear();
      assert.equal(owner.headerRaisedShape,undefined,'mount clears prior measured geometry');
      const first = render();
      assert.equal(typeof first.measure, 'function', 'painted panel must expose its measurement callback');
      assert.equal(first.children.length,0,'header material does not mount an independent phone shadow painter');
      first.measure({}, { width: 1168 / 3.5, height: 188 / 3.5 });
      const measured = render();
      assert.deepEqual([owner.headerRaisedShape.width,owner.headerRaisedShape.height], [1168 / 3.5,188 / 3.5],
        'accepted shape uses the actual fractional-density Native border box');
      assert.notEqual(owner.headerRaisedShape.height,owner.barHeight()+2*owner.spec.borderWidth,'snapped Native border is not guessed from logical border widths');
      assert.equal(measured.material.borderRadius,owner.headerRaisedShape.radius,'Native material uses the measured effective radius');
      assert.equal(measured.material.clip,true,'Native material owns its rounded clip');
      assert.deepEqual(measured.material.shadow,elevation('raised','night'),'Native material owns the shared raised elevation');
      assert.equal(measured.material.shadow.fill,false,'Native shadow does not fill the material interior');
      owner.searchMounted=true;owner.historyFraction=.5;
      const expandedMeasure=owner.headerSurfaceAreaChange();expandedMeasure({}, {width:1168/3.5,height:300});
      assert.equal(owner.headerRaisedShape.height,188/3.5,'expanded history cannot overwrite the accepted collapsed box');
      assert.equal(owner.hasHeaderSurfaceMeasurement(),false,'expanded history cannot claim a collapsed measurement');
      owner.historyFraction=.005;assert.equal(owner.hasHeaderSurfaceMeasurement(),false,'partial history is not strictly collapsed');
      owner.historyFraction=0;assert.equal(owner.hasHeaderSurfaceMeasurement(),true,'strict collapse retains its confirmed box');
      expandedMeasure({}, {width:1168/3.5,height:300});assert.equal(owner.headerRaisedShape.height,188/3.5,'queued expanded sample stays rejected after collapse');
      owner.searchMounted=false;metrics.windowRect.width=390;
      assert.equal(render().material.borderRadius,owner.headerRaisedShape.radius,'same-box input changes retain adopted geometry until a new Native sample');
      measured.measure({}, {width:358,height:20});assert.equal(owner.headerRaisedShape.width,1168/3.5,'old width callback cannot replace adopted geometry');
      render().measure({}, {width:358,height:20});
      assert.deepEqual([owner.headerRaisedShape.width,owner.headerRaisedShape.height],[358,20],'fresh available-width measurement replaces both axes');
      assert.equal(render().material.borderRadius,10,'measured short border-box clamps the actual Native radius');
      owner.barHeight=()=>70;const retained=owner.headerRaisedShape;
      const beforeDensity=render().measure;metrics.densityPixels=2;
      beforeDensity({}, {width:358,height:72});assert.equal(owner.headerRaisedShape,retained,'old density sample cannot overwrite current adopted box');
      render().measure({}, {width:'358vp',height:'71vp'});
      assert.deepEqual([owner.headerRaisedShape.width,owner.headerRaisedShape.height],[358,71],'current numeric/vp sample updates both axes');
      const oldKeyMeasure=render().measure;owner.measurementKey++;oldKeyMeasure({}, {width:300,height:10});
      assert.equal(owner.headerRaisedShape.height,71,'old layout callback is rejected');
      const current=render();current.measure({}, {width:NaN,height:71});assert.equal(owner.headerRaisedShape,undefined,'invalid current geometry clears the accepted shape');
      current.measure({}, {width:358,height:71});const last=owner.headerRaisedShape;owner.aboutToDisappear();
      current.measure({}, {width:20,height:20});assert.equal(owner.headerRaisedShape,last,'unmounted callback cannot mutate geometry');
    }
    checkMeasured(header);
    for(const[name,before,after,expected]of [
      ['missing measurement','.onAreaChange(this.headerSurfaceAreaChange())','',/painted panel must expose/],
      ['unclamped radius','.borderRadius(this.headerMaterialRadius())','.borderRadius(this.spec.panelRadius)',/short border-box clamps/],
      ['disabled clip','.clip(true).hitTestBehavior(HitTestMode.Default)','.clip(false).hitTestBehavior(HitTestMode.Default)',/owns its rounded clip/],
      ['detached Native shadow',".shadow(readerSurfaceElevation(this.headerVeil() ? 'raised' : 'fixed', this.scheme))",'',/owns the shared raised elevation/],
    ]){
      assert.equal(header.split(before).length-1,1,`${name}: exact negative injection`);
      assert.throws(()=>checkMeasured(header.replace(before,after)),expected,`${name} is rejected`);
    }
    const { createReaderBuilderProbe } = await import('./lib/reader-control-builder-probe.mjs');
    const { pureModuleProbe } = await import('./lib/ets-pure-module-probe.mjs');
    const { readerFoundationTokens } = await import('./lib/reader-tokens-probe.mjs');
    const { APP_FLOATING_HEADER_BAR_HEIGHT, APP_FLOATING_HEADER_TOP_GAP } = await import('../entry/src/main/ets/ui/foundation/ReaderHeaderMetrics.ts');
    const headerSpecSource = readFileSync(new URL('../entry/src/main/ets/ui/foundation/ReaderHeaderSpecs.ets', import.meta.url), 'utf8');
    const { bookshelfHeaderSpec } = pureModuleProbe(headerSpecSource, 'ReaderHeaderSpecs.ets', {
      TOK_BORDER_W: readerFoundationTokens.TOK_BORDER_W, APP_FLOATING_HEADER_BAR_HEIGHT, APP_FLOATING_HEADER_TOP_GAP,
    }, ['bookshelfHeaderSpec']);
    const searchModelSource = readFileSync(new URL('../entry/src/main/ets/features/search/presentation/ReaderLibrarySearchModel.ets', import.meta.url), 'utf8');
    const { READER_LIBRARY_SEARCH_BACK_FOCUS_ID } = pureModuleProbe(searchModelSource, 'ReaderLibrarySearchModel.ets',
      { Observed: value => value }, ['READER_LIBRARY_SEARCH_BACK_FOCUS_ID']);
    const searchField = readFileSync(new URL('../entry/src/main/ets/ui/controls/ReaderSearchField.ets', import.meta.url), 'utf8');
    class SearchField {}
    const bar = createReaderBuilderProbe(surfaceTree.getFullText(), ['bar', 'headerActionGlyph', 'headerActionFrame',
      'headerActionTop', 'moreInteractive', 'leadingAction', 'moreAction', 'presentedSearch', 'blend'],
      { bookshelfHeaderSpec, READER_LIBRARY_SEARCH_BACK_FOCUS_ID,
        ReaderSearchField: SearchField, READER_FONT_NOTO_SANS_SC_UI_BOLD: 'ReaderNotoSansSCUIBold' },
      { childSources: { ReaderSearchField: searchField } }).owner;
    const actions = [];
    Object.assign(bar, { mounted: true, mode: 'idle', transitionKind: 'none', scheme: 'day', identity: 7, navigationGeneration: 9, mounting: 11,
      searchMounted: false, model: {panelOwnsInput: false},
      moreIdentity: 'shelf', cardContentWidth: () => 280, barHeight: () => 52, titleOpacity: () => 1,
      surfaceValue() { return this.mode === 'idle' ? 0 : .5; },
      onOpen: (...args) => actions.push(['open', ...args]), onBack: (...args) => actions.push(['back', ...args]),
      onMore: (...args) => actions.push(['more', ...args]) });
    bar.bar();
    const physical = [...bar.nodes.values()];
    const more = physical.find(node => node.accessibilityText === '更多');
    const leading = physical.find(node => node.accessibilityText === '搜索书籍');
    const observerKey = actor => {
      const entries = [...bar.nodes].filter(([, node]) => node === actor);
      assert.equal(entries.length, 1, 'each actual native actor has one physical observer key');
      return entries[0][0];
    };
    const moreElement = observerKey(more);
    const leadingElement = observerKey(leading);
    assert.deepEqual([more.id, leading.id], ['shelf', 'reader-bookshelf-search-entry'],
      'Native focus IDs stay separate from physical observer identity');
    assert.deepEqual([more.type, leading.type], ['Button', 'Button']);
    for (const actor of [more, leading]) {
      assert.deepEqual(actor.createWithChild, {type:'ButtonType.Normal', stateEffect:false},
        'the retained header actor is an explicit Normal Native Button');
      assert.equal(actor.focusable, undefined, 'Native Button keeps its platform focus default without an application override');
      assert.equal(actor.enabled, true, 'admitted header action keeps native enabled semantics');
    }
    assert.deepEqual([more.accessibilityRole, leading.accessibilityRole], Array(2).fill('AccessibilityRoleType.BUTTON'));
    assert.deepEqual([more.width, more.height, more.borderRadius, more.position, more.focusable, more.hitTestBehavior],
      [44, 44, 14, { x: 231, y: 4 }, undefined, 'HitTestMode.Default']);
    assert.deepEqual([leading.width, leading.height, leading.borderRadius, leading.position, leading.focusable],
      [44, 44, 14, { x: 4, y: 4 }, undefined]);
    const icons = physical.filter(node => node.type === 'Image');
    const iconElements = icons.map(observerKey);
    assert.deepEqual(icons.map(node => [node.create, node.width, node.height]),
      [['app.media.rc_dots', 22, 22], ['app.media.bookshelf_search', 22, 22]]);
    more.onClick(); leading.onClick();
    bar.mode = 'input'; bar.scheme = 'night'; bar.identity = 8;
    bar.replayOnly([moreElement, leadingElement, ...iconElements]);
    assert.equal(bar.nodes.get(moreElement), more, 'the original More actor stays mounted through the transition');
    assert.deepEqual(iconElements.map(element => bar.nodes.get(element)), icons,
      'the same physical icon actors receive the retained native attribute updates');
    assert.equal(more.id, 'shelf', 'More keeps the actual production Native focus ID');
    assert.equal(bar.nodes.get(leadingElement), leading, 'Search becomes Back on the same native actor');
    assert.equal(leading.id, READER_LIBRARY_SEARCH_BACK_FOCUS_ID);
    assert.deepEqual([more.enabled, more.focusable, more.hitTestBehavior, more.opacity, more.accessibilityLevel],
      [false, undefined, 'HitTestMode.None', .5, 'no-hide-descendants']);
    assert.deepEqual([leading.accessibilityText, leading.enabled, leading.focusable, icons[1].create],
      ['返回', true, undefined, 'app.media.book_detail_back_theme_night']);
    leading.onClick();
    bar.transitionKind = 'back'; leading.onClick();
    bar.transitionKind = 'none'; bar.model.panelOwnsInput = true;
    bar.replayOnly([leadingElement]);
    assert.deepEqual([leading.enabled, leading.focusable, leading.accessibilityLevel], [false, undefined, 'no-hide-descendants']);
    leading.onClick();
    assert.deepEqual(actions, [['more', 7, 9, 11, 'shelf'], ['open', 7, 9, 11], ['back', 8, 9, 11]]);
    recordContractCasePass(id);
    continue;
  }
  const source = readFileSync(new URL('../entry/src/main/ets/pages/Index.ets', import.meta.url), 'utf8');
  const tree = parse(source);
  const index = tree.statements.find(node => node.name?.text === 'Index');
  const { createLibraryShelfChromeProbe } = await import('./lib/bookshelf-projection-owner-probe.mjs');
  const { bookshelfOperationClass } = await import('./lib/bookshelf-operation-owner-probe.mjs');
  const LibraryJourney = bookshelfOperationClass('app/composition/ReaderLibraryJourney.ts', 'ReaderLibraryJourney');
  const ReaderNavigation = bookshelfOperationClass('app/navigation/ReaderNavigation.ts', 'ReaderNavigation');
  const names = ['librarySearchSurface', 'libraryJourneyPorts', 'bookshelfContentAcceptsInput', 'bookshelfModalVisible'];
  const methods = names.map(name => index.members.find(node => node.name?.getText(tree) === name).getText(tree)).join('\n');
  const childTree = parse(readFileSync(new URL('../entry/src/main/ets/features/search/ui/ReaderLibrarySearchSurface.ets', import.meta.url), 'utf8'));
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
        hitTestBehavior(value) { commonCalls.at(-1).hitTestBehavior=value; }, accessibilityLevel() {}, pop() {} },
      { Transparent: 'HitTestMode.Transparent', None: 'HitTestMode.None' });
    Owner.commonCalls = commonCalls;
    return Owner;
  }
  function fixture(Owner, oldParameters = false) {
    const runtime = {}, librarySearch = createLibraryShelfChromeProbe(), host = librarySearch.host;
    const more = [];
    librarySearch.identity = 5;
    librarySearch.bindShelfMore('more-a', 8, 4, () => more.push('more-a'));
    const owner = Object.assign(new Owner(undefined, {}), {
      navigationOwner: new ReaderNavigation(), route: 'bookshelf', mountedRuntimeOwner: runtime, rssInstanceIdentity: 1,
      navigationGeneration: 8, detailShelfAdmissionMount: 4, librarySearch,
      searchAppForeground: true, readingEntry: { sessionActive: false },
      shelfMutations: { snapshot: {} }, shelfGroupPresentation: { identity: '' },
      shelfReceiptRetired: false, settingsPresentation: { snapshot: { reduceMotion: false } },
      shelfRead: { snapshot: { visualAdmitted: true } },
      isCurrentRuntime: candidate => candidate === runtime, expandedLayout: () => false,
      backCount: 0, onBackPress() { this.backCount++; }, librarySearchResults() {},
    });
    owner.libraryAcquisition = { currentOwner: () => owner.mountedRuntimeOwner };
    owner.libraryJourney = new LibraryJourney(owner.navigationOwner, owner.libraryJourneyPorts());
    move(owner, 'bookshelf', 8, 4);
    if (oldParameters) owner.librarySearchSurface(8, runtime, 4, host, 5, 'more-a');
    else owner.librarySearchSurface(runtime, host);
    const child = [...owner.children.values()][0];
    return { owner, child, runtime, host, more };
  }
  function move(owner, route, generation = owner.navigationGeneration, mounting = owner.detailShelfAdmissionMount) {
    while (owner.navigationOwner.snapshot().generation < generation) owner.navigationOwner.advance();
    const snapshot = owner.navigationOwner.show(route);
    Object.assign(owner, { route: snapshot.route, navigationGeneration: snapshot.generation, detailShelfAdmissionMount: mounting });
  }
  if (id === 'common-hit-test') {
    function checkCommon(Owner) {
      const value = fixture(Owner);
      assert.equal(Owner.commonCalls.at(-1).enabled, true);
      for (const route of ['bookshelf','search','settings']) {
        move(value.owner, route); value.owner.replay();
        assert.equal(Owner.commonCalls.at(-1).enabled, route==='bookshelf'||route==='search');
        assert.equal(Owner.commonCalls.at(-1).hitTestBehavior, route === 'settings' ? 'HitTestMode.None' : 'HitTestMode.Transparent',
          'the generated Common host must stay transparent when active and ignore input when inactive');
      }
      assert.equal(value.owner.children.size, 1, 'route updates retain the same search actor');
    }
    checkCommon(compile(methods));
    const withoutHitTest=methods.replace(/^\s*\.hitTestBehavior\([^\n]+\)/m, '');
    assert.notEqual(withoutHitTest,methods,'negative control removes only the explicit Common hit-test policy');
    assert.throws(()=>checkCommon(compile(withoutHitTest)),/generated Common host/,
      'the installed regression has an implicit Default Common host and is rejected');
    recordContractCasePass(id);
    continue;
  }
  const live = fixture(compile(methods));
  const callbacks = live.child.params;
  callbacks.onMore(5, 8, 4, 'more-a');
  assert.deepEqual(live.more, ['more-a']);
  live.owner.shelfMutations.snapshot.importPresentation = {};
  callbacks.onMore(5, 8, 4, 'more-a');
  assert.deepEqual(live.more, ['more-a'], 'a foreground import rejects the retained shelf trigger');
  live.owner.shelfMutations.snapshot.importPresentation = undefined;
  move(live.owner, 'search', 9, 5);
  Object.assign(live.owner.librarySearch, { identity: 6, mode: 'input' });
  live.owner.librarySearch.bindShelfMore('more-b', 9, 5, () => live.more.push('more-b'));
  live.owner.replay();
  assert.deepEqual([callbacks.identity, callbacks.navigationGeneration, callbacks.mounting, callbacks.moreIdentity],
    [6, 9, 5, 'more-b'], 'one mounted child receives the current primitive identities');
  callbacks.onBack(5, 8, 4);
  assert.equal(live.owner.backCount, 0, 'old presented event cannot act');
  callbacks.onBack(6, 9, 5);
  assert.equal(live.owner.backCount, 1, 'retained callback accepts current event with original runtime/host');
  callbacks.onHistoryCoverageChanged(true, 6, 9, 5);
  assert.equal(live.owner.librarySearch.continueCardSuppressed(9, 5), true);
  assert.equal(live.owner.librarySearch.continueCardSuppressed(10, 5), false);
  assert.equal(live.owner.librarySearch.continueCardSuppressed(9, 6), false);
  live.owner.librarySearch.identity = 7;
  callbacks.onHistoryCoverageChanged(true, 6, 9, 5);
  assert.equal(live.owner.librarySearch.continueCardSuppressed(9, 5), false, 'old search coverage cannot survive a new identity');
  callbacks.onHistoryCoverageChanged(true, 7, 9, 5);
  assert.equal(live.owner.librarySearch.continueCardSuppressed(9, 5), true, 'current coverage can be admitted on the retained actor');
  live.owner.librarySearch.identity = 6;
  live.owner.mountedRuntimeOwner = {};
  callbacks.onBack(6, 9, 5);
  assert.equal(live.owner.backCount, 1, 'old callback cannot switch to a replacement runtime');
  live.owner.mountedRuntimeOwner = live.runtime;
  live.owner.librarySearch.host = {};
  callbacks.onBack(6, 9, 5);
  assert.equal(live.owner.backCount, 1, 'old callback cannot switch to a replacement search host');

  const previous = methods
    .replace('librarySearchSurface(owner: ReaderRuntimeOwner | undefined, host: SearchHost,',
      'librarySearchSurface(generation: number, owner: ReaderRuntimeOwner | undefined, mounting: number, host: SearchHost, identity: number, moreIdentity: string,')
    .replace('identity: this.librarySearch.identity,', 'identity,')
    .replace('navigationGeneration: this.navigationGeneration, mounting: this.detailShelfAdmissionMount,',
      'navigationGeneration: generation, mounting,')
    .replace('moreIdentity: this.librarySearch.shelfMoreIdentity(this.navigationGeneration, this.detailShelfAdmissionMount),', 'moreIdentity,');
  assert.notEqual(previous, methods, 'negative control reinstates the old captured parameters');
  const old = fixture(compile(previous), true);
  move(old.owner, 'bookshelf', 9, 5);
  old.owner.librarySearch.bindShelfMore('more-b', 9, 5, () => old.more.push('more-b'));
  old.owner.librarySearch.identity = 6;
  old.owner.replay();
  assert.deepEqual([old.child.params.identity, old.child.params.navigationGeneration,
    old.child.params.mounting, old.child.params.moreIdentity], [5, 8, 4, 'more-a'],
    'actual old SDK update closure reproduces frozen identities');
  recordContractCasePass(id);
}
