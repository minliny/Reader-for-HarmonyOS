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
  const { installedEtsCompiler } = await import('./lib/ets-compiler-runtime.mjs');
  const { virtualFilePath } = await import('./lib/tool-environment.mjs');
  const { createReaderComponentProbe } = await import('./lib/reader-component-probe.mjs');
  const { builderComponentMembers } = await import('./lib/ets-builder-probe.mjs');
  const { pureModuleProbe } = await import('./lib/ets-pure-module-probe.mjs');
  const { ts, options, require, root } = installedEtsCompiler();
  const componentMap = require(root + '/lib/component_map.js');
  const parse = source => ts.createSourceFile(virtualFilePath('SearchSurfaceBindingProbe.ets'), source,
    ts.ScriptTarget.Latest, true, ts.ScriptKind.ETS, options);
  function sdkProbe(source, names, dependencies, hooks = {}) {
    const saved = new Map(componentMap.ID_ATTRS); componentMap.ID_ATTRS.clear();
    try { return createReaderComponentProbe(source, names, dependencies, hooks); }
    finally { componentMap.ID_ATTRS.clear(); for (const [key,value] of saved) componentMap.ID_ATTRS.set(key,value); }
  }
  function editSource(source, select) {
    const tree = parse(source); assert.equal(tree.parseDiagnostics.length, 0);
    const edits = select(tree); assert.ok(edits.length > 0, 'counterexample changes actual selected source');
    let result = source, end = source.length;
    for (const edit of edits.sort((a,b) => b.start-a.start)) { assert.ok(edit.end <= end, 'non-overlapping AST edits'); result = result.slice(0,edit.start)+edit.text+result.slice(edit.end); end=edit.start; }
    return result;
  }
  function editMembers(body, select) {
    const prefix = '@Component struct BindingEdits {\n', suffix = '\nbuild() { Column() {} }\n}';
    const result = editSource(prefix+body+suffix, select);
    assert.ok(result.startsWith(prefix)&&result.endsWith(suffix)); return result.slice(prefix.length,-suffix.length);
  }
  function calls(tree, name, predicate = () => true) {
    const nodes = []; const visit = node => { if (ts.isCallExpression(node)&&ts.isPropertyAccessExpression(node.expression)&&node.expression.name.text===name&&predicate(node)) nodes.push(node); ts.forEachChild(node,visit); }; visit(tree); return nodes;
  }
  if (id === 'measured-shadow') {
    const surfaceTree = parse(readFileSync(new URL('../entry/src/main/ets/features/search/ReaderLibrarySearchSurface.ets', import.meta.url), 'utf8'));
    const surface = surfaceTree.statements.find(node => node.name?.text === 'ReaderLibrarySearchSurface');
    const method = name => surface.members.find(node => node.name?.getText(surfaceTree) === name).getText(surfaceTree);
    const header = method('header');
    const headerChildSources = {
      ReaderRaisedSurface: readFileSync(new URL('../entry/src/main/ets/features/common/ReaderRaisedSurface.ets', import.meta.url), 'utf8'),
      ReaderSearchHistoryPanel: readFileSync(new URL('../entry/src/main/ets/features/search/ReaderSearchHistoryPanel.ets', import.meta.url), 'utf8'),
    };
    const areaTree = parse(readFileSync(new URL('../entry/src/main/ets/features/common/ReaderPageShell.ts', import.meta.url), 'utf8'));
    const areaNode = areaTree.statements.find(node => node.name?.text === 'readerPageAreaLength');
    const { readerPageAreaLength: areaLength } = pureModuleProbe(areaNode.getText(areaTree), 'ReaderPageAreaLength.ts', {}, ['readerPageAreaLength']);
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
      const { Component: Owner } = sdkProbe(fixture.text, builderComponentMembers(fixture.text), {
        ViewPU: ProbeView, ReaderRaisedSurface: Shadow, Stack: empty, Column, If: empty, __Common__: empty,
        Alignment: { TopStart: 0 }, HitTestMode: { Default: 0 }, Color: { Transparent: 0 },
        readerSurfaceElevation: () => ({}), readerHeaderVeilMaterial: () => ({}), readerHeaderVeilBorder: () => '',
        readerAppColor: () => '', readerPageAreaLength: areaLength, ReaderWindowCoordinator: { metrics: () => metrics },
      }, { childSources: headerChildSources, createGlobals: () => ({}) });
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
    const equivalentHeader = editMembers(header, tree => {
      const edits=[]; const visit=node=>{ if(ts.isPropertyAssignment(node)&&['surfaceWidth','surfaceHeight'].includes(node.name.getText(tree))) edits.push({start:node.initializer.getStart(tree),end:node.initializer.end,text:'('+node.initializer.getText(tree)+')'}); ts.forEachChild(node,visit); };visit(tree);return edits;
    });
    checkMeasured(equivalentHeader);
    const missing = editMembers(header, tree => calls(tree,'onAreaChange',node=>node.arguments.some(arg=>ts.isCallExpression(arg)&&ts.isPropertyAccessExpression(arg.expression)&&arg.expression.name.text==='headerSurfaceAreaChange')).map(node=>({start:node.expression.expression.end,end:node.end,text:''})));
    assert.throws(() => checkMeasured(missing), /painted panel must expose/, 'missing measurement is rejected');
    const formula = editMembers(header, tree => {
      const edits=[]; const visit=node=>{if(ts.isPropertyAssignment(node)&&['surfaceWidth','surfaceHeight'].includes(node.name.getText(tree)))edits.push({start:node.initializer.getStart(tree),end:node.initializer.end,text:node.name.getText(tree)==='surfaceWidth'?'this.cardContentWidth() + 2 * this.spec.borderWidth':'this.barHeight() + 2 * this.spec.borderWidth'});ts.forEachChild(node,visit);};visit(tree);return edits;
    });
    assert.throws(() => checkMeasured(formula), /actual fractional-density/, 'the installed one-pixel mismatch is rejected');
    recordContractCasePass(id);
    continue;
  }
  const source = readFileSync(new URL('../entry/src/main/ets/pages/Index.ets', import.meta.url), 'utf8');
  const tree = parse(source);
  const index = tree.statements.find(node => node.name?.text === 'Index');
  const names = ['librarySearchSurface', 'isCurrentSearchPresentation', 'isCurrentBookshelfPresentation'];
  const methods = names.map(name => index.members.find(node => node.name?.getText(tree) === name).getText(tree)).join('\n');
  const childSource = readFileSync(new URL('../entry/src/main/ets/features/search/ReaderLibrarySearchSurface.ets', import.meta.url), 'utf8');
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
    const source = '@Component struct SearchSurfaceBindingProbe { ' + body + '\n@Builder private librarySearchResults() {}\nbuild() { Column() {} } }';
    const commonCalls=[];
    const { Component: Owner } = sdkProbe(source, builderComponentMembers(source), {
      ViewPU: View, ReaderLibrarySearchSurface: Surface,
      __Common__: { create() { commonCalls.push({}); }, enabled(value) { commonCalls.at(-1).enabled=value; },
        hitTestBehavior(value) { commonCalls.at(-1).hitTestBehavior=value; }, pop() {} },
      HitTestMode: { Transparent: 'HitTestMode.Transparent' },
    }, { childSources: { ReaderLibrarySearchSurface: childSource }, createGlobals: () => ({}) });
    Owner.commonCalls=commonCalls;return Owner;
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
    const withoutHitTest=editMembers(methods,tree=>calls(tree,'hitTestBehavior',node=>node.arguments.some(arg=>ts.isPropertyAccessExpression(arg)&&arg.name.text==='Transparent')).map(node=>({start:node.expression.expression.end,end:node.end,text:''})));
    assert.notEqual(withoutHitTest,methods,'negative control removes only the explicit Common hit-test policy');
    assert.throws(()=>checkCommon(compile(withoutHitTest)),/generated enabled Common host/,
      'the installed regression has an implicit Default Common host and is rejected');
    // Actual Surface SDK build and completeTransition. The local branch port
    // models native removal by retiring only observers/nodes created by that If.
    const surfaceSource=readFileSync(new URL('../entry/src/main/ets/features/search/ReaderLibrarySearchSurface.ets',import.meta.url),'utf8');
    function checkResultsLifetime(definition) {
      class HeaderPort { constructor(parent,params,_storage,id){this.owner=parent;this.params=params;this.id=id;} initialRender(){} }
      const childSources = { ReaderFixedHeaderHost: readFileSync(new URL('../entry/src/main/ets/features/common/ReaderFixedHeaderHost.ets', import.meta.url),'utf8') };
      const probe=sdkProbe(definition,['results','build','resultsInteractive','inputInteractive','completeTransition'],
        {ReaderFixedHeaderHost:HeaderPort,ReaderHeaderFrameStyle:class{},bookshelfHeaderSpec:()=>({topInset:0}),readerAppColor:()=>''},
        {childSources});
      const o=probe.owner,branches=new Map();let activeObserver=-1,slotBuilds=0;
      o.replay=()=>{for(let id=0;id<o.observers.length;id++)o.runObserver(id,false);};
      const nativeObserve=o.observeComponentCreation2.bind(o);
      o.observeComponentCreation2=(callback,component)=>nativeObserve((id,initial)=>{activeObserver=id;callback(id,initial);},component);
      o.ifElseBranchUpdateFunction=(branch,generator)=>{
        const key=activeObserver,old=branches.get(key);if(old?.branch===branch)return;
        if(old)for(const id of old.ids){o.nodes.delete(id);o.observers[id]=()=>{};}
        const first=o.observers.length;generator();branches.set(key,{branch,ids:Array.from({length:o.observers.length-first},(_,i)=>first+i)});
      };
      Object.assign(o,{mode:'results',searchMounted:true,model:{interactive:true,sourceRecoveryVisible:false},
        generation:1,transitionKind:'none',activeIdentity:-1,identity:1,activeNavigation:1,navigationGeneration:1,activeMounting:1,mounting:1,
        resultsProgress:()=>1,surfaceProgress:()=>1,historyProgress:()=>1,surfaceHeight:()=>700,contentHeight:()=>640,headerBottom:60,
        resultClip:()=>undefined,scrimProgress:()=>0,backAction:()=>()=>{},horizontalInset:()=>0,
        captureHeader(){},header(){},surfaceAreaChanged(){},results(){slotBuilds++;},scheduleInputFocus(){},onSettled(){}});
      o.initialRender();assert.equal(slotBuilds,1,'mounted results slot constructed');
      const enabledNodes=()=>[...o.nodes.values()].filter(n=>Object.hasOwn(n,'enabled'));
      assert.equal(enabledNodes().length,2,'content and host both own hard admission');
      assert.ok(enabledNodes().every(n=>n.enabled===true));
      o.mode='input';o.replay();assert.ok(enabledNodes().every(n=>n.enabled===false),'history input cannot interact with retained results');
      o.model.sourceRecoveryVisible=true;o.replay();assert.ok(enabledNodes().every(n=>n.enabled===true),'input recovery retains its established interactive path');
      o.model.interactive=false;o.replay();assert.ok(enabledNodes().every(n=>n.enabled===false));
      o.model.interactive=true;o.model.sourceRecoveryVisible=false;o.mode='idle';o.transitionKind='close';o.replay();
      assert.equal(slotBuilds,1,'closing animation retains original result slot and scroll owner');
      assert.ok(enabledNodes().every(n=>n.enabled===false),'closing idle cannot receive hits');
      o.completeTransition();o.replay();
      assert.equal(o.searchMounted,false);assert.equal(enabledNodes().length,1,'settled idle removes native result content branch');
      const builds=slotBuilds;o.replay();assert.equal(slotBuilds,builds,'settled idle does not reconstruct results');
      o.mode='results';o.searchMounted=true;o.replay();assert.equal(slotBuilds,builds+1,'reopening reconstructs result slot');
      assert.ok(enabledNodes().every(n=>n.enabled===true),'reopened results recover interaction');
    }
    checkResultsLifetime(surfaceSource);
    const oldContent=editSource(surfaceSource,tree=>{
      const edits=[];const visit=node=>{if(ts.isIfStatement(node)&&ts.isPropertyAccessExpression(node.expression)&&node.expression.expression.kind===ts.SyntaxKind.ThisKeyword&&node.expression.name.text==='searchMounted'&&ts.isBlock(node.thenStatement))edits.push({start:node.getStart(tree),end:node.end,text:node.thenStatement.statements.map(statement=>statement.getText(tree)).join('\n')});ts.forEachChild(node,visit);};const component=tree.statements.find(node=>node.name?.text==='ReaderLibrarySearchSurface');const build=component.members.find(node=>node.name?.getText(tree)==='build');assert.ok(build);visit(build);return edits;
    });
    assert.notEqual(oldContent,surfaceSource);
    assert.throws(()=>checkResultsLifetime(oldContent),/settled idle removes native result content branch/,'old unconditional slot fails retirement');
    const noAdmission=editSource(surfaceSource,tree=>calls(tree,'enabled',node=>node.arguments.some(arg=>ts.isCallExpression(arg)&&ts.isPropertyAccessExpression(arg.expression)&&arg.expression.name.text==='resultsInteractive')).map(node=>({start:node.expression.expression.end,end:node.end,text:''})));
    assert.throws(()=>checkResultsLifetime(noAdmission),/content and host both own hard admission/,'missing hard enabled guards rejected');
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

  const previous = editMembers(methods,tree=>{
    const component=tree.statements.find(node=>node.members),method=component.members.find(node=>node.name?.getText(tree)==='librarySearchSurface');
    assert.equal(method.parameters.length,2);
    const edits=[{start:method.parameters[0].getStart(tree),end:method.parameters.at(-1).end,text:'generation: number, '+method.parameters[0].getText(tree)+', mounting: number, '+method.parameters[1].getText(tree)+', identity: number, moreIdentity: string'}];
    const replacements={identity:'identity',navigationGeneration:'generation',mounting:'mounting',moreIdentity:'moreIdentity'};
    const visit=node=>{if((ts.isCallExpression(node)||ts.isEtsComponentExpression?.(node))&&node.expression?.getText(tree)==='ReaderLibrarySearchSurface')for(const property of node.arguments[0].properties){const key=property.name?.getText(tree);if(Object.hasOwn(replacements,key))edits.push({start:property.initializer.getStart(tree),end:property.initializer.end,text:replacements[key]});}ts.forEachChild(node,visit);};visit(method);assert.equal(edits.length,5);return edits;
  });
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
