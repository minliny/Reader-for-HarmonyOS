import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createRequire, registerHooks } from 'node:module';
import { fileURLToPath } from 'node:url';
import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';

const selected = selectContractCases({
  'initializer-safety': 'Actual SDK SourceToolsPage initializer, exact debug/parent checked-font gate and typed memory rows, JSON/check controls.',
  'no-runtime': 'Non-Entry fixture imports no runtime business owner/services, performs no platform save/login calls and never replaces fonts/sets scale.',
  'editor-busy': 'Actual memory fixture editor accepts one save intent, publishes pending busy without save/readback ACK, rejects duplicate and old editor callback.',
  'callback-retire': 'Actual initializer callbacks only log/mutate memory, reject foreign entities and stale scenes; JSON is retained without pretending save ACK; scene Back only.',
});
if (selected.length) {
  registerHooks({ resolve(specifier, context, next) {
    if (specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier)) {
      const url = new URL(specifier + '.ts', context.parentURL);
      if (existsSync(fileURLToPath(url))) return next(url.href, context);
    }
    return next(specifier, context);
  } });
  const { installedEtsCompiler } = await import('./lib/ets-compiler-runtime.mjs');
  const { resolveEtsLoaderRoot } = await import('./lib/tool-environment.mjs');
  const { createReaderBuilderProbe } = await import('./lib/reader-control-builder-probe.mjs');
  const { boundedSurfaceSdk, boundedMembers } = await import('./lib/bounded-surface-sdk-probe.mjs');
  const { selectedProductionValues } = await import('./lib/selected-production-methods.mjs');
  const { readerPageAreaLength } = await import('../entry/src/main/ets/ui/layout/ReaderPageShell.ts');
  const file = new URL('../entry/src/main/ets/pages/ReaderSourceToolsStructureFixture.ets', import.meta.url);
  const source = readFileSync(file, 'utf8');
  const actor = readFileSync(new URL('../entry/src/main/ets/features/source/ui/SourceToolsPage.ets', import.meta.url), 'utf8');
  const stateActor = readFileSync(new URL('../entry/src/main/ets/ui/feedback/ReaderPageState.ets', import.meta.url), 'utf8');
  const { emptyToolsFixtureSnapshot } = selectedProductionValues(file, ['emptyToolsFixtureSnapshot']);
  const require = createRequire(import.meta.url), componentMap = require(resolveEtsLoaderRoot() + '/lib/component_map.js');
  function compile(body) {
    const ids = componentMap.ID_ATTRS, saved = new Map(ids); ids.clear();
    try { return body(); } finally { ids.clear(); for (const [key, value] of saved) ids.set(key, value); }
  }
  function fixture({ debug = true, mode = 'debug', parentFonts = true } = {}) {
    const sdk = boundedSurfaceSdk(), children = [], actions = [], events = [], bridges = []; let backs = 0;
    class Child { constructor(owner, params, _storage, id) { this.owner = owner; this.params = params; this.id = id; children.push(this); } updateStateVars(params) { Object.assign(this.params, params); } }
    class StateChild { constructor(owner, params, _storage, id) { this.owner = owner; this.params = params; this.id = id; } updateStateVars(params) { Object.assign(this.params, params); } }
    const { owner: page } = compile(() => createReaderBuilderProbe(source, boundedMembers(source), {
      ...sdk.deps, DEBUG: debug, BUILD_MODE_NAME: mode, SourceToolsPage: Child, ReaderPageState: StateChild,
      emptyToolsFixtureSnapshot, readerPageAreaLength,
      readerWindowMetrics: () => ({ systemFontScale: 2 }),
      hilog: { info(_domain, _tag, _format, payload) { events.push(JSON.parse(payload)); } },
    }, { ...sdk.hooks, childSources: { ...sdk.childSources, SourceToolsPage: actor, ReaderPageState: stateActor } }));
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
      assert.equal(typeof p.onTemporaryBackBridge,'function','current actor keyboard Back is forwarded');assert.equal(p.isOpeningCurrent(),true);assert.equal(p.isInputAllowed(),true);
      for(const callback of ['onReconcile','onContinueOriginal','onBack','onExportAll','onExportSelected','onCheckSelected','onStopCheck','onCheckSelectionChanged','onSetSelectedEnabled','onDeleteSelected','onOpenEditor','onEditorDraftChanged','onSaveEditor','onReconcileEditor','onCancelEditor','onDebugKeyChanged','onDebugSource','onSelectAll','onClearSelection','onToggleSelection'])assert.equal(typeof p[callback],'function',callback);
      assert.equal(Object.keys(p).length,24,'snapshot, twenty business intent callbacks and three current lifecycle ports');
    }
    const denied=fixture({parentFonts:false});denied.page.aboutToAppear();denied.page.initialRender();assert.equal(denied.children.length,0);
    denied.page.fontsReady=true;denied.page.onParentFontsChanged();denied.page.initialRender();assert.equal(denied.children.length,1);
  }
  async function noRuntime() {
    const {ts,options}=installedEtsCompiler();const tree=ts.createSourceFile('ReaderSourceToolsStructureFixture.ets',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.ETS,options);
    const imports=tree.statements.filter(ts.isImportDeclaration).filter(node=>node.importClause?.isTypeOnly!==true).map(node=>node.moduleSpecifier.text);
    const spreads=[];const visit=node=>{if(ts.isSpreadAssignment(node))spreads.push(node.getText(tree));ts.forEachChild(node,visit);};visit(tree);
    assert.deepEqual(spreads,[],'full ArkTS compiler forbids object spread in the actual fixture; SDK lowering alone does not enforce this rule');
    assert(!imports.some(path=>/Gateway|Orchestrator|HostRegistry|RuntimeOwner|ArkWeb|Network|HTTP|File/.test(path)),imports.join(','));
    assert(!source.includes('@Entry'));assert(!source.includes('AppStorage.set'));assert(!source.includes('registerFont('));
    assert(!source.includes('saveBookSourceJson'));assert(!source.includes('openInteractive'));assert(!source.includes('showAlertDialog'));
    assert(actor.includes('this.nativeAlertOwner.present('),'actual actor retains its approved native confirmation owner');
    assert(actor.includes('onExportAll: () => void'));assert(actor.includes('this.onExportAll()'));
    const f=fixture();f.page.aboutToAppear();f.page.initialRender();const p=f.props(),id=p.snapshot.sources[0].sourceId;
    p.onOpenEditor(id);const json=JSON.parse(f.page.snapshot.editorText);assert.equal(json.bookSourceUrl,id);assert.equal(json.bookSourceName,p.snapshot.sources[0].name);
    p.onEditorDraftChanged('{ memory-only unsaved draft',f.page.snapshot.editorRevision);p.onSaveEditor(f.page.snapshot.editorRevision);assert.equal(f.page.snapshot.editorText,'{ memory-only unsaved draft');
    assert.equal(f.page.snapshot.editorOperation,undefined);assert.equal(f.page.snapshot.editorReadback,undefined);assert.equal(f.page.snapshot.statusMessage,'','no fake save ACK/message');
    p.onClearSelection();p.onToggleSelection(id);p.onExportAll();p.onExportSelected({sourceIds:[id],sourceListRevision:f.page.snapshot.sourceListRevision,selectionRevision:f.page.snapshot.selectionRevision});assert(f.actions.includes('source-tools-fixture:export-all-memory'));assert(f.actions.includes('source-tools-fixture:export-selected-memory'));
    assert.equal(f.bridges.length,0,'fixture invents no Back handler before the actual child supplies one');
  }
  async function callbackRetire() {
    const f=fixture();f.page.aboutToAppear();f.page.initialRender();
    const old=f.props(),id=old.snapshot.sources[0].sourceId,second=old.snapshot.sources[1].sourceId;
    const selection=()=>({sourceIds:f.page.snapshot.selectedSourceIds.slice(),sourceListRevision:f.page.snapshot.sourceListRevision,selectionRevision:f.page.snapshot.selectionRevision});
    old.onClearSelection();assert.equal(f.page.snapshot.selectedSourceCount,0);
    old.onToggleSelection(id);assert.deepEqual(f.page.snapshot.selectedSourceIds,[id]);
    old.onSelectAll();assert.equal(f.page.snapshot.selectedSourceCount,12);
    const staleSelection=selection();old.onSetSelectedEnabled(selection(),true);assert.equal(f.page.snapshot.sources[0].enabled,true);
    const beforeStale=f.actions.length;old.onDeleteSelected(staleSelection);assert.equal(f.actions.length,beforeStale,'changed source revision retires old selection callback');
    old.onCheckSelectionChanged('explore',5);assert.equal(f.page.snapshot.checkMode,'explore');assert.equal(f.page.snapshot.checkDepth,5);
    old.onDebugKeyChanged('fixture keyword');assert.equal(f.page.snapshot.debugKey,'fixture keyword');
    old.onDebugSource(second);assert.equal(f.page.snapshot.debugSourceId,second);
    old.onClearSelection();old.onToggleSelection(id);old.onToggleSelection(second);
    old.onCheckSelected(selection());assert.equal(f.page.snapshot.batchCheck.total,2);assert.equal(f.page.snapshot.busy,false);
    old.onOpenEditor(id);const revision=f.page.snapshot.editorRevision;
    old.onEditorDraftChanged('retained draft',revision);old.onSaveEditor(revision);assert.equal(f.page.snapshot.editorText,'retained draft');
    const beforeEditor=f.actions.length;old.onEditorDraftChanged('wrong editor',revision-1);old.onSaveEditor(revision-1);
    assert.equal(f.actions.length,beforeEditor);assert.equal(f.page.snapshot.editorText,'retained draft');
    old.onDeleteSelected(selection());assert(f.page.snapshot.sources.some(row=>row.sourceId===id),'delete records intent without real deletion or ACK');
    const count=f.actions.length,snapshot=f.page.snapshot;
    old.onOpenEditor('foreign');old.onToggleSelection('foreign');
    const foreign={...selection(),sourceIds:['foreign']};old.onSetSelectedEnabled(foreign,false);old.onCheckSelected(foreign);old.onExportSelected(foreign);
    assert.equal(f.actions.length,count);assert.equal(f.page.snapshot,snapshot);
    f.page.observeArea(f.page.fixtureGeneration,{width:'320vp',height:'700vp'});
    const area=f.events.findLast(event=>event.kind==='actual-area');assert.equal(area.actualWidthVp,320);assert.equal(area.systemFontScale,2);
    let keyboardBack=0;old.onTemporaryBackBridge(()=>{keyboardBack++;return true;},'actual-child-keyboard');
    const nativeBack=f.bridges.at(-1).handler;assert.equal(nativeBack(),true);assert.equal(keyboardBack,1);
    old.onBack();assert.equal(f.backs(),1);f.page.aboutToDisappear();const retiredCount=f.actions.length;
    assert.equal(f.bridges.at(-1).identity,'actual-child-keyboard');assert.equal(f.bridges.at(-1).handler,undefined);
    assert.equal(nativeBack(),false);assert.equal(keyboardBack,1,'retired scene rejects its actual child handler');
    old.onExportAll();old.onEditorDraftChanged('late',revision);old.onBack();old.onClearSelection();
    assert.equal(f.actions.length,retiredCount);assert.equal(f.backs(),1);
    f.page.aboutToAppear();f.page.initialRender();const next=f.props();next.onOpenEditor(second);
    old.onEditorDraftChanged('old owner',f.page.snapshot.editorRevision);assert.notEqual(f.page.snapshot.editorText,'old owner');
    f.page.fontsReady=false;f.page.onParentFontsChanged();const before=f.actions.length;next.onExportAll();next.onBack();
    assert.equal(f.actions.length,before);assert.equal(f.backs(),1);
  }

  function editorBusy() {
    const f = fixture(); f.page.aboutToAppear(); f.page.initialRender();
    const ports = f.props(), id = ports.snapshot.sources[0].sourceId;
    ports.onOpenEditor(id);
    const revision = f.page.snapshot.editorRevision, draft = f.page.snapshot.editorText;
    ports.onSaveEditor(revision);
    assert.equal(f.page.snapshot.busy, true);
    assert.equal(f.page.snapshot.editorText, draft);
    assert.equal(f.page.snapshot.editorReadback, undefined);
    assert.equal(f.page.snapshot.editorOperation, undefined);
    assert.equal(f.page.snapshot.statusMessage, '');
    const saves = () => f.actions.filter(kind => kind === 'source-tools-fixture:save-editor-memory').length;
    assert.equal(saves(), 1);
    assert.equal(f.events.findLast(event => event.kind === 'save-editor-memory').busy, true);
    assert.equal(f.events.findLast(event => event.kind === 'save-editor-memory').editorRevision, revision);
    ports.onSaveEditor(revision); ports.onSaveEditor(revision - 1);
    assert.equal(saves(), 1);
    f.page.aboutToDisappear(); ports.onSaveEditor(revision); assert.equal(saves(), 1);
  }

  const cases={'initializer-safety':initializerSafety,'no-runtime':noRuntime,'callback-retire':callbackRetire,'editor-busy':editorBusy};
  for(const id of selected){await cases[id]();recordContractCasePass(id);}
}
