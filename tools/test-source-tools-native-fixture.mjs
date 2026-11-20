import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createRequire, registerHooks } from 'node:module';
import { fileURLToPath } from 'node:url';
import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';

const selected = selectContractCases({
  'initializer-safety': 'Actual SDK SourceToolsPage initializer, exact debug/parent checked-font gate and typed memory rows, JSON/check controls.',
  'no-runtime': 'Non-Entry fixture imports no runtime business owner/services, performs no platform save/login calls and never replaces fonts/sets scale.',
  'callback-retire': 'Actual initializer callbacks only log/mutate memory, reject foreign entities and stale scenes; JSON is retained without pretending save ACK; scene Back only.',
});
if (selected.length) {
  const productionRoot = new URL('../entry/src/main/ets/', import.meta.url).href;
  const resolver = registerHooks({ resolve(specifier, context, next) {
    if (context.parentURL?.startsWith(productionRoot) && specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier)) {
      const url = new URL(specifier + '.ts', context.parentURL);
      if (existsSync(fileURLToPath(url))) return next(url.href, context);
    }
    return next(specifier, context);
  } });
  try {
  const { installedEtsCompiler } = await import('./lib/ets-compiler-runtime.mjs');
  const { resolveEtsLoaderRoot } = await import('./lib/tool-environment.mjs');
  const { createReaderComponentProbe } = await import('./lib/reader-component-probe.mjs');
  const { builderComponentMembers } = await import('./lib/ets-builder-probe.mjs');
  const { createArkUIPropertyRuntimeProbe } = await import('./lib/arkui-property-runtime-probe.mjs');
  const { selectedProductionValues } = await import('./lib/selected-production-methods.mjs');
  const { readerPageAreaLength } = await import('../entry/src/main/ets/features/common/ReaderPageShell.ts');
  const file = new URL('../entry/src/main/ets/pages/ReaderSourceToolsStructureFixture.ets', import.meta.url);
  const source = readFileSync(file, 'utf8');
  const actor = readFileSync(new URL('../entry/src/main/ets/features/source/SourceToolsPage.ets', import.meta.url), 'utf8');
  const stateActor = readFileSync(new URL('../entry/src/main/ets/features/common/ReaderPageState.ets', import.meta.url), 'utf8');
  const { emptyToolsFixtureSnapshot } = selectedProductionValues(file, ['emptyToolsFixtureSnapshot']);
  const require = createRequire(import.meta.url), componentMap = require(resolveEtsLoaderRoot() + '/lib/component_map.js');
  function compile(body) {
    const ids = componentMap.ID_ATTRS, saved = new Map(ids); ids.clear();
    try { return body(); } finally { ids.clear(); for (const [key, value] of saved) ids.set(key, value); }
  }
  function fixture({ debug = true, mode = 'debug', parentFonts = true } = {}) {
    const sdk = createArkUIPropertyRuntimeProbe(), children = [], actions = [], events = [], bridges = []; let backs = 0;
    class Child { constructor(owner, params, _storage, id) { this.owner = owner; this.params = params; this.id = id; children.push(this); } updateStateVars(params) { Object.assign(this.params, params); } }
    class StateChild { constructor(owner, params, _storage, id) { this.owner = owner; this.params = params; this.id = id; } updateStateVars(params) { Object.assign(this.params, params); } }
    const { owner: page } = compile(() => createReaderComponentProbe(source, builderComponentMembers(source), {
      ...sdk.sdk, DEBUG: debug, BUILD_MODE_NAME: mode, SourceToolsPage: Child, ReaderPageState: StateChild,
      emptyToolsFixtureSnapshot, readerPageAreaLength,
      ReaderWindowCoordinator: { metrics: () => ({ systemFontScale: 2 }) },
      hilog: { info(_domain, _tag, _format, payload) { events.push(JSON.parse(payload)); } },
    }, { ...sdk.hooks, childSources: { SourceToolsPage: actor, ReaderPageState: stateActor } }));
    Object.assign(page, { fontsReady: parentFonts, onAction: kind => actions.push(kind), onBack: () => backs++,
      onTemporaryBackBridge: (handler, identity) => bridges.push({ handler, identity }) });
    return { page, children, actions, events, bridges, sdk, backs: () => backs, props: () => children.at(-1)?.params };
  }
  async function initializerSafety() {
    for (const [debug, mode, parentFonts, allowed] of [[true,'debug',true,true],[false,'debug',true,false],[true,'release',true,false],[true,'debug',false,false]]) {
      const f = fixture({debug, mode, parentFonts}); f.page.aboutToAppear(); f.page.initialRender(); assert.equal(f.children.length,allowed?1:0);
      if (!allowed) continue;
      const p=f.props(),s=p.snapshot; assert.equal(s.sources.length,12);assert.equal(s.selectedSourceCount,3);assert.equal(s.editorSourceId,'');
      assert.deepEqual(new Set(s.batchCheck.results.map(result=>result.state)),new Set(['passed','failed','error']));
      assert.equal(s.debugLogs.length,3);assert.equal(s.checkMode,'search');assert.equal(s.checkDepth,2);assert.equal(s.statusMessage,'');assert.equal(s.statusEvent,'state');
      assert.equal(s.receipt,undefined);assert.equal(s.original,undefined);assert.equal(s.editorOperation,undefined);assert.equal(s.editorReadback,undefined);
      for(const row of s.sources){assert(row.sourceId.endsWith('.example.invalid'));assert(row.name.length>20);assert(row.name.includes('Fixture'));}
      assert(!Object.hasOwn(p,'onTemporaryBackBridge'),'actor has no temporary Back port');
      for(const callback of ['onReconcile','onContinueOriginal','onBack','onExportAll','onExportSelected','onCheckSelected','onStopCheck','onCheckSelectionChanged','onSetSelectedEnabled','onDeleteSelected','onOpenEditor','onEditorDraftChanged','onSaveEditor','onReconcileEditor','onCancelEditor','onDebugKeyChanged','onDebugSource','onSelectAll','onClearSelection','onToggleSelection'])assert.equal(typeof p[callback],'function',callback);
      assert.equal(Object.keys(p).length,21,'only snapshot and the actual 20 callback ports are passed');
    }
    const denied=fixture({parentFonts:false});denied.page.aboutToAppear();denied.page.initialRender();assert.equal(denied.children.length,0);
    denied.page.fontsReady=true;denied.page.onParentFontsChanged();denied.page.initialRender();assert.equal(denied.children.length,1);
  }
  async function noRuntime() {
    const {ts,options}=installedEtsCompiler();const tree=ts.createSourceFile('ReaderSourceToolsStructureFixture.ets',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.ETS,options);
    assert.equal(tree.parseDiagnostics.length, 0, 'whole fixture parses');
    const allowedImports = new Set(["../../../../build/default/generated/profile/default/BuildProfile","@kit.PerformanceAnalysisKit","../features/source/SourceToolsPage","../features/common/ReaderPageState","../features/common/ReaderPageShell","../app/ReaderWindowCoordinator"]);
    const imports = tree.statements.filter(ts.isImportDeclaration).filter(node => node.importClause?.isTypeOnly !== true).map(node => node.moduleSpecifier.text);
    assert.deepEqual(imports.filter(value => !allowedImports.has(value)), [], 'only explicit fixture UI/log/geometry/font imports');
    const forbidden = [];
    const visit = node => {
      if (ts.isSpreadAssignment(node)) forbidden.push('object-spread');
      if (ts.getAllDecorators(node).some(decorator => { const expression = decorator.expression; return (ts.isCallExpression(expression) ? expression.expression : expression).getText(tree) === 'Entry'; })) forbidden.push('Entry');
      if (ts.isCallExpression(node)) {
        const callee = node.expression;
        const name = ts.isPropertyAccessExpression(callee) ? callee.name.text : ts.isIdentifier(callee) ? callee.text : '';
        if (['registerFont','saveBookSourceJson','openInteractive','showAlertDialog'].includes(name) || (ts.isPropertyAccessExpression(callee) && ts.isIdentifier(callee.expression) && callee.expression.text === 'AppStorage' && ['set','setOrCreate','delete','clear'].includes(name))) forbidden.push(name);
      }
      ts.forEachChild(node, visit);
    };
    visit(tree);
    assert.deepEqual(forbidden, [], 'no Entry, direct writes/login/alert, font replacement or ArkTS object spread');
    const f=fixture();f.page.aboutToAppear();f.page.initialRender();const p=f.props(),id=p.snapshot.sources[0].sourceId;
    p.onOpenEditor(id);const json=JSON.parse(f.page.snapshot.editorText);assert.equal(json.bookSourceUrl,id);assert.equal(json.bookSourceName,p.snapshot.sources[0].name);
    p.onEditorDraftChanged('{ memory-only unsaved draft');p.onSaveEditor();assert.equal(f.page.snapshot.editorText,'{ memory-only unsaved draft');
    assert.equal(f.page.snapshot.editorOperation,undefined);assert.equal(f.page.snapshot.editorReadback,undefined);assert.equal(f.page.snapshot.statusMessage,'','no fake save ACK/message');
    p.onExportAll();p.onExportSelected([id]);assert(f.actions.includes('source-tools-fixture:export-all-memory'));assert(f.actions.includes('source-tools-fixture:export-selected-memory'));
    assert(f.bridges.every(event=>event.handler===undefined),'no invented editor/native-dialog Back handler');
  }
  async function callbackRetire() {
    const f=fixture();f.page.aboutToAppear();f.page.initialRender();const old=f.props(),id=old.snapshot.sources[0].sourceId,second=old.snapshot.sources[1].sourceId;
    old.onClearSelection();assert.equal(f.page.snapshot.selectedSourceCount,0);old.onToggleSelection(id);assert.deepEqual(f.page.snapshot.selectedSourceIds,[id]);
    old.onSelectAll();assert.equal(f.page.snapshot.selectedSourceCount,12);old.onSetSelectedEnabled([id],true);assert.equal(f.page.snapshot.sources[0].enabled,true);
    old.onCheckSelectionChanged('explore',5);assert.equal(f.page.snapshot.checkMode,'explore');assert.equal(f.page.snapshot.checkDepth,5);
    old.onDebugKeyChanged('fixture keyword');assert.equal(f.page.snapshot.debugKey,'fixture keyword');old.onDebugSource(second);assert.equal(f.page.snapshot.debugSourceId,second);
    old.onCheckSelected([id,second]);assert.equal(f.page.snapshot.batchCheck.total,2);assert.equal(f.page.snapshot.busy,false);
    old.onOpenEditor(id);old.onEditorDraftChanged('retained draft');old.onSaveEditor();assert.equal(f.page.snapshot.editorText,'retained draft');
    old.onDeleteSelected([id]);assert(f.page.snapshot.sources.some(row=>row.sourceId===id),'delete is a logged intent, no real deletion/ACK');
    const count=f.actions.length,snapshot=f.page.snapshot;old.onOpenEditor('foreign');old.onToggleSelection('foreign');old.onSetSelectedEnabled(['foreign'],false);old.onCheckSelected(['foreign']);old.onExportSelected(['foreign']);
    assert.equal(f.actions.length,count);assert.equal(f.page.snapshot,snapshot);
    f.page.observeArea(f.page.fixtureGeneration,{width:'320vp',height:'700vp'});const area=f.events.findLast(event=>event.kind==='actual-area');assert.equal(area.actualWidthVp,320);assert.equal(area.systemFontScale,2);
    old.onBack();assert.equal(f.backs(),1);f.page.aboutToDisappear();const retiredCount=f.actions.length;assert.equal(f.bridges.at(-1).handler,undefined);
    old.onExportAll();old.onEditorDraftChanged('late');old.onBack();old.onClearSelection();assert.equal(f.actions.length,retiredCount);assert.equal(f.backs(),1);
    f.page.aboutToAppear();f.page.initialRender();const next=f.props();next.onOpenEditor(second);old.onEditorDraftChanged('old owner');assert.notEqual(f.page.snapshot.editorText,'old owner');
    f.page.fontsReady=false;f.page.onParentFontsChanged();const before=f.actions.length;next.onExportAll();next.onBack();assert.equal(f.actions.length,before);assert.equal(f.backs(),1);
    assert(f.bridges.every(event=>event.handler===undefined),'all temporary Back events are retire-only');
  }
  const cases={'initializer-safety':initializerSafety,'no-runtime':noRuntime,'callback-retire':callbackRetire};
  for(const id of selected){await cases[id]();recordContractCasePass(id);}
  } finally { resolver.deregister(); }
}
