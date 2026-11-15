import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createRequire, registerHooks } from 'node:module';
import { fileURLToPath } from 'node:url';
import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';

const selected = selectContractCases({
  'safe-area': 'Actual SDK fixture root consumes App top exactly once, reader/manga/control own edges, live metrics revision/320/366/explicit122/168/190 child viewports/default release; no native pixel claim.',
  'native-font-observation': 'Actual same-instance SDK Root record and metrics callback reread readonly UIContext font policy/conversions after dynamic change; unavailable observations drop prior values and retired metrics emit nothing. No font or AppStorage write.',
  'menu-safe-area': 'Actual SDK menu Scroll viewport subtracts current interactive system/cutout/gesture/navigation bottom, clips buttons at its safe edge, updates on metrics revision and leaves actor stages intact; exact before-source100% negative. No Native hit claim.',
  admission: 'Exact debug-only internal fixture/launcher routing, unique registration, no new cold Want or runtime Core/Host import.',
  'font-gate': 'Actual fixture lifecycle and SDK Source initializer: pending/failed/retired font preparation cannot mount; only current checked completion permits Source.',
  'source-callbacks': 'Actual Source initializer callbacks: memory-only intents, scene generations, temporary Back before menu and real-area vs requested width. No native rendering or business receipt evidence.',
  'source-states': 'Actual memory-only Source read/original/unknown recovery initializers, full long-message path through real projections, accurate generations and retired callbacks; no Host/RPC, native clipping or hit claim.',
  'fixture-scenes': 'Actual Directory/Download/Tools child initializers, checked admission, outer width vs actual Area, current-scene intent/Back and same-identity old bridge cleanup retirement. No native child subtree execution.',
  'tools-state-scenes': 'Actual Tools scenario menu callbacks forward the selected state, retain default content and reject denied or old menu callbacks. Frozen-state negative is rejected.',
  'downloads-short': 'New typed DEBUG 168vp Download wrapper through actual SDK initializer/safe top and real child/actor Area callbacks; full Download initializer and canonical recovery remain unchanged. Native geometry/inflow not asserted.',
  'group-recovery': 'Actual SDK DEBUG group fixture initializer, checked fonts, current-scene temporary Back and retired bridge rejection.',
  'framework-geometry': 'Actual SDK DEBUG geometry/removal fixture initializer, checked fonts and current-scene temporary Back ownership.',
  'legacy-recovery': 'Actual SDK DEBUG legacy-original fixture initializer, checked admission, current-scene Back and retired bridge rejection.',
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
  const { selectedProductionMethods } = await import('./lib/selected-production-methods.mjs');
  const { selectedProductionValues } = await import('./lib/selected-production-methods.mjs');
  const { createReaderBuilderProbe } = await import('./lib/reader-control-builder-probe.mjs');
  const { boundedSurfaceSdk, boundedMembers } = await import('./lib/bounded-surface-sdk-probe.mjs');
  const { pureModuleProbe } = await import('./lib/ets-pure-module-probe.mjs');
  const { projectPersistedReceipt } = await import('../entry/src/main/ets/app/ReaderPersistedReceiptProjection.ts');
  const { projectCommitReadback, projectOperationFacts } = await import('../entry/src/main/ets/app/ReaderOperationFacts.ts');
  const { readerRecoveryView } = await import('../entry/src/main/ets/app/ReaderRecoveryProjection.ts');
  const { readerPageAreaLength } = await import('../entry/src/main/ets/ui/layout/ReaderPageShell.ts');
  const file = new URL('../entry/src/main/ets/pages/ReaderPageStructureVerification.ets',import.meta.url);
  const source = readFileSync(file,'utf8');
  const {defaultSourceManagementFilters} = pureModuleProbe(source.slice(0,source.indexOf('@Entry')), 'ReaderPageStructureVerification.ets', {}, ['defaultSourceManagementFilters']);
  const rendererFile = new URL('../entry/src/main/ets/pages/ReaderRendererPilot.ets',import.meta.url);
  const sourceActor = readFileSync(new URL('../entry/src/main/ets/features/source/ui/SourceManagementPage.ets',import.meta.url),'utf8');
  const stateActor = readFileSync(new URL('../entry/src/main/ets/ui/feedback/ReaderPageState.ets',import.meta.url),'utf8');
  const directoryFixture = readFileSync(new URL('../entry/src/main/ets/pages/ReaderDirectoryStructureFixture.ets',import.meta.url),'utf8');
  const downloadFixture = readFileSync(new URL('../entry/src/main/ets/pages/ReaderDownloadStructureFixture.ets',import.meta.url),'utf8');
  const toolsFixture = readFileSync(new URL('../entry/src/main/ets/pages/ReaderSourceToolsStructureFixture.ets',import.meta.url),'utf8');
  const { SOURCE_TOOLS_FIXTURE_SCENARIOS } = selectedProductionValues(
    new URL('../entry/src/main/ets/pages/ReaderSourceToolsStructureFixture.ets', import.meta.url), ['SOURCE_TOOLS_FIXTURE_SCENARIOS']);
  const groupFixture = readFileSync(new URL('../entry/src/main/ets/pages/ReaderGroupRecoveryStructureFixture.ets',import.meta.url),'utf8');
  const geometryFixture = readFileSync(new URL('../entry/src/main/ets/pages/ReaderFrameworkGeometryStructureFixture.ets',import.meta.url),'utf8');
  const legacyFixture = readFileSync(new URL('../entry/src/main/ets/pages/ReaderLegacyBookmarkRecoveryStructureFixture.ets',import.meta.url),'utf8');
  const {createDefaultReaderWindowMetrics,readerContentSafeTop,readerInteractiveSafeBottom}=await import('../entry/src/main/ets/ui/foundation/ReaderWindowMetrics.ts');
  const tick=()=>new Promise(resolve=>setImmediate(resolve));
  const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return{promise,resolve,reject};};
  // Same compile-only ID scoping used by other SDK fixture composers. Preserve
  // within-component duplicate diagnostics; independent test owners do not
  // inherit another compilation's global ID_ATTRS table.
  const require=createRequire(import.meta.url),componentMap=require(resolveEtsLoaderRoot()+'/lib/component_map.js');
  function compile(body) {
    const ids=componentMap.ID_ATTRS,saved=new Map(ids);
    ids.clear();
    try{return body();}finally{ids.clear();for(const [key,value]of saved)ids.set(key,value);}
  }
  function fixture({debug=true,mode='debug',fonts=()=>Promise.resolve(),metrics,nativeContext,sourceText=source}={}) {
    const sdk=boundedSurfaceSdk(),children=[],states=[],routes=[],events=[];let fontCalls=0;
    const liveMetrics=metrics??createDefaultReaderWindowMetrics();if(metrics===undefined)liveMetrics.systemFontScale=1.6;
    const child = kind => class {constructor(owner,params,_storage,id){this.owner=owner;this.params=params;this.id=id;this.kind=kind;this.hostAtCreation={...[...owner.nodes.values()].filter(n=>n.type==='Stack').at(-1)};children.push(this);}updateStateVars(params){Object.assign(this.params,params);}};
    const SourceChild=child('source'), DirectoryChild=child('directory'), DownloadChild=child('downloads'), ToolsChild=child('tools'), GroupChild=child('group'), GeometryChild=child('geometry'), LegacyChild=child('legacy');
    class StateChild {constructor(owner,params,_storage,id){this.owner=owner;this.params=params;this.id=id;states.push(this);}updateStateVars(params){Object.assign(this.params,params);}}
    const {owner:page}=compile(()=>createReaderBuilderProbe(sourceText,boundedMembers(sourceText),{
      ...sdk.deps,DEBUG:debug,BUILD_MODE_NAME:mode,SourceManagementPage:SourceChild,ReaderPageState:StateChild,
      ReaderDirectoryStructureFixture:DirectoryChild,ReaderDownloadStructureFixture:DownloadChild,ReaderSourceToolsStructureFixture:ToolsChild,ReaderGroupRecoveryStructureFixture:GroupChild,ReaderFrameworkGeometryStructureFixture:GeometryChild,ReaderLegacyBookmarkRecoveryStructureFixture:LegacyChild,
      defaultSourceManagementFilters,SOURCE_TOOLS_FIXTURE_SCENARIOS,projectPersistedReceipt,projectCommitReadback,projectOperationFacts,readerPageAreaLength,
      readerContentSafeTop,readerInteractiveSafeBottom,readerWindowMetrics:()=>liveMetrics,ReaderWindowCoordinator:{metrics:()=>liveMetrics},
      prepareReaderFonts:()=>{fontCalls++;return fonts();},
      hilog:{info(_domain,_tag,_format,payload){events.push(JSON.parse(payload));},error(){}},
    },{...sdk.hooks,childSources:{...sdk.childSources,SourceManagementPage:sourceActor,ReaderPageState:stateActor,
      ReaderDirectoryStructureFixture:directoryFixture,ReaderDownloadStructureFixture:downloadFixture,ReaderSourceToolsStructureFixture:toolsFixture,ReaderGroupRecoveryStructureFixture:groupFixture,ReaderFrameworkGeometryStructureFixture:geometryFixture,ReaderLegacyBookmarkRecoveryStructureFixture:legacyFixture}}));
    page.getUIContext=()=>({...nativeContext?.(),getRouter:()=>({replaceUrl:route=>routes.push({kind:'replace',...route}),back:()=>routes.push({kind:'back'})})});
    return{page,children,states,routes,events,sdk,fontCalls:()=>fontCalls,props:()=>children.at(-1)?.params};
  }
  async function admission() {
    for(const [debug,mode,allowed]of[[true,'debug',true],[false,'debug',false],[true,'release',false],[false,'release',false]]) {
      const routes=[];
      const Pilot=selectedProductionMethods(rendererFile,'ReaderRendererPilot',['openPageStructureVerification'],{
        DEBUG:debug,BUILD_MODE_NAME:mode});
      Object.assign(new Pilot(), {getUIContext:()=>({getRouter:()=>({pushUrl:route=>routes.push(route)})})}).openPageStructureVerification();assert.equal(routes.length,allowed?1:0);
      if(allowed)assert.equal(routes[0].url,'pages/ReaderPageStructureVerification');
      const f=fixture({debug,mode});f.page.aboutToAppear();await tick();
      assert.equal(f.page.admitted,allowed);assert.equal(f.fontCalls(),allowed?1:0);
      if(!allowed){assert.equal(f.routes[0].url,'pages/Index');f.page.launchSource('default', f.page.presentation);assert.equal(f.children.length,0);}
    }
    const pages=JSON.parse(readFileSync(new URL('../entry/src/main/resources/base/profile/main_pages.json',import.meta.url),'utf8'));
    assert.equal(pages.src.filter(value=>value==='pages/ReaderPageStructureVerification').length,1);
    const {ts,options}=installedEtsCompiler();const tree=ts.createSourceFile('ReaderPageStructureVerification.ets',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.ETS,options);
    const runtimeImports=tree.statements.filter(ts.isImportDeclaration).filter(node=>node.importClause?.isTypeOnly!==true).map(node=>node.moduleSpecifier.text);
    assert(!runtimeImports.some(value=>/SourceGateway|SourceHost|RuntimeOwner|ArkWeb|FilePicker|Network|HTTP/.test(value)),runtimeImports.join(','));
    assert(!source.includes('AppStorage.set'));assert(!source.includes('registerFont('));
  }
  async function fontGate() {
    const gate=deferred(),f=fixture({fonts:()=>gate.promise});f.page.aboutToAppear();
    f.page.launchSource('default', f.page.presentation);assert.equal(f.page.scene,'menu');
    // A corrupted/premature scene value still cannot bypass the actual build gate.
    f.page.scene='default';f.page.initialRender();assert.equal(f.children.length,0);
    gate.resolve();await tick();await tick();assert.equal(f.page.fontState,'ready');
    f.page.scene='menu';f.page.launchSource('default', f.page.presentation);f.page.initialRender();assert.equal(f.children.length,1);
    assert.equal(f.props().sources.length,24);assert(f.events.some(event=>event.kind==='fonts-checked'));
    const first=deferred(),second=deferred();let calls=0;
    const retired=fixture({fonts:()=>++calls===1?first.promise:second.promise});retired.page.aboutToAppear();retired.page.aboutToDisappear();retired.page.aboutToAppear();
    first.resolve();await tick();assert.equal(retired.page.fontState,'loading','old checked completion does not own the new lifecycle');
    second.resolve();await tick();assert.equal(retired.page.fontState,'ready');
    const failure=deferred(),failed=fixture({fonts:()=>failure.promise});failed.page.aboutToAppear();failure.reject(Error('checked font failure'));await tick();
    assert.equal(failed.page.fontState,'failed');failed.page.launchSource('default', failed.page.presentation);assert.equal(failed.page.scene,'menu');assert.equal(failed.children.length,0);
    const retryFailure=deferred(),retrySuccess=deferred();let retries=0;
    const retry=fixture({fonts:()=>++retries===1?retryFailure.promise:retrySuccess.promise});retry.page.aboutToAppear();retryFailure.reject(Error('font load fails once'));await tick();retry.page.menu();
    const oldRetry=retry.states.at(-1).params.onAction;assert.equal(typeof oldRetry,'function');oldRetry();assert.equal(retry.fontCalls(),2);oldRetry();assert.equal(retry.fontCalls(),2,'the same failure closure cannot restart a pending retry');
    retrySuccess.resolve();await tick();retry.page.launchFixture('downloads',retry.page.presentation);oldRetry();assert.equal(retry.fontCalls(),2,'old font action cannot interrupt an active scene');
    retry.page.onBackPress();assert.equal(retry.page.scene,'menu');oldRetry();assert.equal(retry.fontCalls(),2,'retired failure does not own a successor menu');
  }
  async function sourceCallbacks() {
    const f=fixture();f.page.aboutToAppear();await tick();f.page.selectWidth(320, f.page.presentation);f.page.launchSource('default', f.page.presentation);f.page.sourceStage();
    const old=f.props(),id=old.sources[0].sourceId;assert(id.endsWith('.example.invalid'));
    const before=f.page.intentCount, originalVersion=f.page.sources[0].sourceVersion;
    old.onToggleSource(id,false);assert.equal(f.page.sources[0].enabled,false);
    assert.notEqual(f.page.sources[0].sourceVersion,originalVersion,'memory accepted toggle also changes the opaque source version');
    assert.equal(f.events.at(-1).sourceVersion,f.page.sources[0].sourceVersion,'native diagnostic records the actual accepted memory version');
    old.onDetectSource(id);assert.equal(f.page.sources[0].checkState,'checking');
    old.onLoginSource(id);assert.match(f.page.sources[0].checkMessage,/无平台登录/);old.onAddSource();old.onOpenTools(old.initialViewState);
    f.page.returnToPilot(f.page.presentation);
    assert.equal(f.page.intentCount,before+5);assert.equal(f.routes.length,0,'side-effect intents do not navigate to real picker/Tools/Web');
    let temporary=0;old.onTemporaryBackBridge(()=>{temporary++;return true;},'old-bridge');old.onBack();
    assert.equal(temporary,1);assert.equal(f.page.scene,'default');old.onTemporaryBackBridge(undefined,'old-bridge');old.onBack();assert.equal(f.page.scene,'menu');
    const count=f.page.intentCount;old.onToggleSource(id,true);old.onAddSource();assert.equal(f.page.intentCount,count,'retired callbacks cannot alter a menu or later scene');
    f.page.launchSource('recovery', f.page.presentation);f.page.sourceStage();const recovery=f.props(),revision=recovery.operation.receipt.facts.generation;
    assert.equal(recovery.operation.receipt.receipt.confirmation,'unknown');recovery.onReconcile(revision);assert.equal(f.page.operation.receipt.receipt.confirmation,'confirmed');
    const reconciles=f.page.intentCount;recovery.onReconcile(revision);assert.equal(f.page.intentCount,reconciles,'old fixture receipt generation cannot be replayed');
    recovery.onTemporaryBackBridge(()=>true,'new-bridge');old.onTemporaryBackBridge(undefined,'old-bridge');assert.equal(f.page.temporaryBackIdentity,'new-bridge');
    recovery.onTemporaryBackBridge(undefined,'new-bridge');recovery.onBack();f.page.launchSource('busy', f.page.presentation);f.page.sourceStage();assert.equal(f.props().sources[0].checkState,'checking');
    f.page.observeArea(f.page.presentation,{width:'300vp',height:'700vp'});assert.equal(f.page.actualWidth,300);
    const area=f.events.findLast(event=>event.kind==='actual-area');assert.equal(area.requestedWidthVp,320);assert.equal(area.actualWidthVp,300);assert.equal(area.systemFontScale,1.6);
    f.page.leaveScene(f.page.presentation);f.page.launchSource('empty', f.page.presentation);f.page.sourceStage();assert.equal(f.props().sources.length,0);
    assert(f.events.every(event=>event.sourceId===''||event.sourceId.endsWith('.example.invalid')));
    f.page.leaveScene(f.page.presentation);f.page.returnToPilot(f.page.presentation);assert.equal(f.routes.at(-1).kind,'back','diagnostic navigation is only admitted from the menu');
  }
  async function sourceStates() {
    const f=fixture();f.page.aboutToAppear();await tick();
    f.page.launchSource('recovery',f.page.presentation);f.page.sourceStage();
    const recoveryProps=f.props(),receipt=recoveryProps.operation.receipt;
    assert.equal(receipt.receipt.confirmation,'unknown');assert.equal(receipt.receipt.readback,'failed');
    assert.equal(receipt.facts.canRetry,true);assert.equal(receipt.facts.generation,f.page.operationRevision);
    assert.equal(receipt.hasValue,true);assert.equal(receipt.value.length,24);
    const SourceRecovery=selectedProductionMethods(new URL('../entry/src/main/ets/features/source/ui/SourceManagementPage.ets',import.meta.url),
      'SourceManagementPage',['recovery'],{readerRecoveryView});
    const sourceRecovery=new SourceRecovery();sourceRecovery.operation=recoveryProps.operation;
    const longView=sourceRecovery.recovery();
    assert.equal(longView.visible,true);assert.equal(longView.canRetry,true);assert.equal(longView.generation,receipt.facts.generation);
    assert.equal(longView.message,receipt.facts.message,'actual Source recovery passes the full owner message through the real shared projection');
    assert(longView.message.includes(receipt.receipt.message));assert(longView.message.length>200,'long payload reaches the notice; native clipping still requires actual measure/paint');
    const legacy=projectPersistedReceipt({confirmation:'unknown',readback:'failed',value:recoveryProps.sources,canRetry:true,
      generation:receipt.facts.generation,message:'内存夹具：回执待核对，不会操作用户数据。'.repeat(12)});
    const legacyView=readerRecoveryView(legacy);
    assert.equal(legacyView.message,legacy.receipt.message);assert(legacyView.message.length<20,'old noncanonical long input really collapses to standard short message');
    assert.equal(longView.message.startsWith(projectCommitReadback('unknown','failed').message),true);
    f.page.leaveScene(f.page.presentation);
    for(const scene of ['read-error','read-empty-error','original-unknown','original-cleanup']) {
      f.page.menu();const launch=f.sdk.nodes(f.page).findLast(n=>n.id===`reader-page-structure-source-${scene}`)?.onClick;
      assert.equal(typeof launch,'function');launch();assert.equal(f.page.scene,scene);f.page.sourceStage();
      const props=f.props(),original=props.operation.original;
      assert.equal(props.sources.length,scene==='read-empty-error'?0:24);
      if(original){
        assert.equal(original.blocked,true);assert.equal(original.canRetryOriginal,true);assert.equal(original.busy,false);
        assert.equal(original.confirmation,scene==='original-cleanup'?'confirmed':'unknown');
        assert.equal(original.writeStage,scene==='original-cleanup'?'cleanup':'core');assert(original.message.length>200);
        const count=f.page.intentCount;props.onContinueOriginal(original.generation-1);assert.equal(f.page.intentCount,count);
        props.onContinueOriginal(original.generation);assert.equal(f.page.intentCount,count+1);
        assert.equal(f.events.at(-1).kind,scene==='original-cleanup'?'intent-continue-cleanup':'intent-continue-original');
        props.onContinueOriginal(original.generation);props.onReconcile(original.generation);assert.equal(f.page.intentCount,count+1,'retired original cannot replay after successor facts');
      }else{
        const read=props.operation.readFacts,view=readerRecoveryView(undefined,read);
        assert.equal(read.fact,scene==='read-error'?'refreshFailed':'failed');assert.equal(read.hasValue,scene==='read-error');
        assert.equal(view.canRetry,true);assert.equal(view.generation,read.generation);
        assert.equal(props.statusActionLabel,scene==='read-error'?'夹具状态动作':'');
        const count=f.page.intentCount;props.onStatusAction(read.generation-1);assert.equal(f.page.intentCount,count);
        props.onStatusAction(read.generation);assert.equal(f.page.intentCount,count+(scene==='read-error'?1:0));
        props.onReconcile(read.generation);assert.equal(f.page.operation.receipt.receipt.confirmation,'confirmed');
        const after=f.page.intentCount;props.onReconcile(read.generation);assert.equal(f.page.intentCount,after);
      }
      const count=f.page.intentCount;f.page.leaveScene(f.page.presentation);props.onStatusAction(0);props.onContinueOriginal(original?.generation??0);props.onReconcile(original?.generation??0);launch();
      assert.equal(f.page.intentCount,count);assert.equal(f.page.scene,'menu','retired source menu launch cannot replace successor menu');
    }
    f.page.launchSource('busy',f.page.presentation);f.page.sourceStage();
    assert.equal(f.props().statusKind,'loading','retained busy fixture reaches the real loading producer');
    assert.equal(f.props().operation.receipt.receipt.readback,'reading');
    assert.equal(f.props().sources.length,24);
    f.page.leaveScene(f.page.presentation);
    f.page.launchSource('default',f.page.presentation);f.page.sourceStage();f.props().onOpenTools({searchQuery:'fixture',status:'启用',category:'novel',group:'科幻样本',anchorSourceId:''});
    assert.deepEqual(Object.fromEntries(['queryLength','statusFilter','categoryFilter','groupFilter'].map(k=>[k,f.events.at(-1)[k]])),{queryLength:7,statusFilter:'启用',categoryFilter:'novel',groupFilter:'科幻样本'});
    assert.equal(f.events.at(-1).kind,'intent-tools');
    assert.equal(f.events.at(-1).filterObservation,'initial-or-tools-capture');assert.equal(f.routes.length,0);
    assert(!source.includes('new SourceHost'));assert(!source.includes('new SourceGateway'));
  }
  async function downloadsShort() {
    const {createDownloadBookView,projectDownloadBookAvailability,downloadChapterStateLabel}=await import('../entry/src/main/ets/features/downloads/presentation/SharedDownloadProjection.ts');
    const {readerAvailableWindowHeight}=await import('../entry/src/main/ets/ui/foundation/ReaderSurfaceResolvers.ts');
    const actorFile=new URL('../entry/src/main/ets/features/downloads/ui/SharedDownloadPage.ets',import.meta.url),actorSource=readFileSync(actorFile,'utf8');
    const {ts,options}=installedEtsCompiler();
    const actorTree=ts.createSourceFile(String(actorFile),actorSource,ts.ScriptTarget.Latest,true,ts.ScriptKind.ETS,options);
    const actorDeclaration=actorTree.statements.find(n=>n.name?.text==='SharedDownloadPage'&&n.members);
    const build=actorDeclaration.members.find(n=>n.name?.getText(actorTree)==='build'),areaCalls=[];
    function findArea(n){if(ts.isCallExpression(n)&&ts.isPropertyAccessExpression(n.expression)&&n.expression.name.text==='onAreaChange')areaCalls.push(n);ts.forEachChild(n,findArea);}findArea(build);
    assert.equal(areaCalls.length,1,'one actual Scaffold Area callback owns page viewport');
    assert.match(areaCalls[0].expression.expression.getText(actorTree),/^ReaderPageScaffold/);
    const emitted=ts.transpileModule(`function bindArea(){return ${areaCalls[0].arguments[0].getText(actorTree)};}`,{compilerOptions:{target:ts.ScriptTarget.ES2021}}).outputText;
    const bindArea=new Function('readerPageAreaLength',emitted+'\nreturn bindArea;')(readerPageAreaLength);
    const metrics=createDefaultReaderWindowMetrics();metrics.windowRect={left:0,top:0,width:366,height:844};metrics.systemInsets.top=39;metrics.cutoutInsets.top=43;metrics.systemFontScale=1.45;
    const originalMetrics=JSON.stringify(metrics);
    for(const width of[320,366]){
      const f=fixture({metrics});f.page.aboutToAppear();await tick();f.page.selectWidth(width,f.page.presentation);f.page.menu();
      const launch=f.sdk.nodes(f.page).findLast(n=>n.id==='reader-page-structure-downloads-short')?.onClick;assert.equal(typeof launch,'function');launch();assert.equal(f.page.scene,'downloads-short');
      f.page.initialRender();const root=[...f.page.nodes.values()].find(n=>n.type==='Stack'&&n.expandSafeArea);assert.equal(root.padding.top,43);assert.equal([...f.page.nodes.values()].filter(n=>n.padding?.top===43).length,1);
      const child=f.children.at(-1);assert.equal(child.kind,'downloads');assert.equal(child.hostAtCreation.id,'reader-download-short-viewport');assert.equal(child.hostAtCreation.height,168);assert.equal(child.hostAtCreation.width,'100%');assert.equal(child.hostAtCreation.clip,true);assert.equal(child.hostAtCreation.align,'Alignment.Top');
      assert.deepEqual(Object.keys(child.params).sort(),['fontsReady','onAction','onBack','onTemporaryBackBridge'].sort());
      for(const key of['pageHeight','viewportHeight','metrics','initialViewState','managing'])assert(!Object.hasOwn(child.params,key),'no synthetic viewport or state prop');
      const full=fixture({metrics});full.page.aboutToAppear();await tick();full.page.launchFixture('downloads',full.page.presentation);full.page.fixtureStage();assert.equal(full.children.at(-1).hostAtCreation.height,'100%');assert.deepEqual(Object.keys(full.props()).sort(),Object.keys(child.params).sort());
      const sdk=boundedSurfaceSdk(),children=[],events=[];
      class DownloadChild{constructor(owner,params,_storage,id){this.owner=owner;this.params=params;this.id=id;children.push(this);}updateStateVars(params){Object.assign(this.params,params);}}
      const {owner:download}=compile(()=>createReaderBuilderProbe(downloadFixture,boundedMembers(downloadFixture),{...sdk.deps,DEBUG:true,BUILD_MODE_NAME:'debug',SharedDownloadPage:DownloadChild,
        createDownloadBookView,projectDownloadBookAvailability,downloadChapterStateLabel,readerPageAreaLength,readerWindowMetrics:()=>metrics,prepareSharedDownloadFonts:()=>Promise.resolve(true),
        hilog:{info(_d,_t,_f,payload){events.push(JSON.parse(payload));}}},{...sdk.hooks,childSources:{...sdk.childSources,SharedDownloadPage:actorSource}}));
      Object.assign(download,child.params);download.aboutToAppear();await tick();download.initialRender();
      const childArea=sdk.nodes(download).find(n=>n.id==='reader-download-structure-fixture'&&n.onAreaChange);assert(childArea);assert.equal(childArea.height,'100%','actual child fills real168 wrapper, it does not replace it with a fake metric');
      const area=width===320?{width:320,height:168}:{width:'366vp',height:'168vp'};childArea.onAreaChange({},area);assert.equal(events.at(-1).kind,'actual-area');assert.equal(events.at(-1).actualHeightVp,168);assert.equal(events.at(-1).actualWidthVp,width);
      const actorSdk=boundedSurfaceSdk();const {owner:actor}=compile(()=>createReaderBuilderProbe(actorSource,['pageWidth','pageHeight','readerWindowMetricsRevision','availableHeight','currentMetrics','build'],{...actorSdk.deps,readerPageAreaLength,readerAvailableWindowHeight,readerWindowMetrics:()=>metrics},{...actorSdk.hooks}));
      assert.equal(actor.pageHeight,0,'actual SDK property initializer before any Area receipt');const actualArea=bindArea.call(actor);actualArea({},area);assert.equal(actor.pageHeight,168);assert.equal(actor.availableHeight(),168);assert.equal(JSON.stringify(metrics),originalMetrics,'never mutate window/scale to manufacture short height');
      actualArea({}, {width:'bad',height:'bad'});assert.equal(actor.pageHeight,168,'invalid Area does not invent another viewport');
      const before=f.page.intentCount;child.params.onAction('short-memory');assert.equal(f.page.intentCount,before+1);child.params.onBack();assert.equal(f.page.scene,'menu');child.params.onAction('retired');assert.equal(f.page.intentCount,before+1);download.aboutToDisappear();
    }
    const pending=deferred(),blocked=fixture({fonts:()=>pending.promise});blocked.page.aboutToAppear();blocked.page.launchFixture('downloads-short',blocked.page.presentation);assert.equal(blocked.page.scene,'menu');assert.equal(blocked.children.length,0);pending.resolve();await tick();
    const denied=fixture({debug:false});denied.page.aboutToAppear();await tick();denied.page.launchFixture('downloads-short',denied.page.presentation);assert.equal(denied.children.length,0);assert.equal(denied.routes[0].url,'pages/Index');
  }
  async function toolsStateScenes(sourceText = source) {
    for (const { value } of SOURCE_TOOLS_FIXTURE_SCENARIOS) {
      const f = fixture({ sourceText }); f.page.aboutToAppear(); await tick(); f.page.menu();
      const action = f.sdk.nodes(f.page).findLast(node => node.id === `reader-page-structure-tools-${value}`)?.onClick;
      assert.equal(typeof action, 'function'); action();
      assert.equal(f.page.scene, 'source-tools'); assert.equal(f.page.toolsScenario, value);
      f.page.fixtureStage(); assert.equal(f.props().scenario, value, 'current selected Tools scenario reaches the actual child');
      assert.equal(f.props().fontsReady, true);
      const active = f.page.presentation;
      f.page.launchToolsFixture('empty', active);
      assert.equal(f.page.presentation, active); assert.equal(f.page.toolsScenario, value);
      f.props().onBack(); assert.equal(f.page.scene, 'menu');
      action(); assert.equal(f.page.scene, 'menu', 'old menu callback is retired');
      f.page.launchFixture('source-tools', f.page.presentation); f.page.fixtureStage();
      assert.equal(f.props().scenario, 'content', 'existing default entry resets the previous scenario');
    }
    const pending = deferred(), p = fixture({ fonts: () => pending.promise, sourceText });
    p.page.aboutToAppear(); p.page.launchToolsFixture('unknown', p.page.presentation);
    assert.equal(p.page.scene, 'menu'); assert.equal(p.page.toolsScenario, 'content');
    pending.resolve(); await tick();
    const denied = fixture({ debug: false, sourceText }); denied.page.aboutToAppear(); await tick();
    denied.page.launchToolsFixture('empty', denied.page.presentation); assert.equal(denied.children.length, 0);
    if (sourceText === source) {
      const frozen = source.replace('scenario: this.toolsScenario', "scenario: 'content'");
      assert.notEqual(frozen, source);
      await assert.rejects(() => toolsStateScenes(frozen), /current selected Tools scenario reaches the actual child/);
    }
  }

  async function fixtureScenes() {
    const scenes=[
      ['directory-detail','directory','text','detail',undefined],
      ['directory-reader','directory','text','reader',undefined],
      ['directory-manga','directory','manga','detail',undefined],
      ['directory-control-expanded','directory','control','reader',true],
      ['directory-control-compact','directory','control','reader',false],
      ['directory-control-flat-expanded','directory','control','reader',true,undefined,true],
      ['directory-control-flat-compact','directory','control','reader',false,undefined,true],
      ['directory-control-short-122','directory','control','reader',true,122],
      ['directory-control-short-168','directory','control','reader',true,168],
      ['directory-control-short-190','directory','control','reader',true,190],
      ['downloads','downloads'],['source-tools','tools'],
    ];
    for(const width of [320,366])for(const [scene,kind,mode,context,expanded,height,flat]of scenes){
      const f=fixture();f.page.aboutToAppear();await tick();f.page.selectWidth(width, f.page.presentation);f.page.launchFixture(scene, f.page.presentation);f.page.initialRender();
      assert.equal(f.children.length,1);assert.equal(f.children[0].kind,kind);const p=f.props();assert.equal(p.fontsReady,true);
      if(kind==='directory'){assert.equal(p.mode,mode);assert.equal(p.catalogContext,context);if(expanded!==undefined)assert.equal(p.controlExpanded,expanded);if(height!==undefined)assert.equal(p.controlViewportHeight,height);if(mode==='control')assert.equal(p.flatCatalog,flat===true);assert(!Object.hasOwn(p,'onTemporaryBackBridge'));}
      else assert.equal(typeof p.onTemporaryBackBridge,'function');
      const nodes=f.sdk.nodes(f.page),host=nodes.find(node=>node.type==='Stack'&&node.id==='reader-page-structure-fixture-stage');
      assert(host);assert.equal(host.width,width);assert.equal(host.constraintSize.maxWidth,'100%');
      assert(!nodes.some(node=>node.type==='Button'),'no second diagnostic menu/header is mounted above the actor');
      const presentation=f.page.presentation;f.page.launchFixture('downloads', f.page.presentation);f.page.launchSource('default', f.page.presentation);assert.equal(f.page.presentation,presentation,'retired menu callbacks cannot replace an active fixture');assert.equal(f.page.scene,scene);
      const count=f.page.intentCount;p.onAction('memory-intent',kind==='directory'?21:undefined);assert.equal(f.page.intentCount,count+1);assert.equal(f.routes.length,0);
      f.page.observeArea(presentation,{width:'300vp',height:'700vp'});const area=f.events.findLast(event=>event.kind==='actual-area');assert.equal(area.requestedWidthVp,width);assert.equal(area.actualWidthVp,300);assert.equal(area.systemFontScale,1.6);
      p.onBack();assert.equal(f.page.scene,'menu');const retired=f.page.intentCount;p.onAction('retired',21);p.onBack();assert.equal(f.page.intentCount,retired);assert.equal(f.page.scene,'menu');
    }
    const pending=deferred(),g=fixture({fonts:()=>pending.promise});g.page.aboutToAppear();g.page.launchFixture('downloads', g.page.presentation);assert.equal(g.page.scene,'menu');g.page.scene='downloads';g.page.initialRender();assert.equal(g.children.length,0);pending.resolve();await tick();
    g.page.scene='menu';g.page.launchFixture('downloads', g.page.presentation);g.page.initialRender();const old=g.props();old.onTemporaryBackBridge(()=>true,'same-child-identity');old.onBack();assert.equal(g.page.scene,'downloads');
    old.onTemporaryBackBridge(undefined,'same-child-identity');old.onBack();assert.equal(g.page.scene,'menu');
    g.page.launchFixture('downloads', g.page.presentation);g.page.initialRender();const current=g.props();let consumed=0;current.onTemporaryBackBridge(()=>{consumed++;return true;},'same-child-identity');
    old.onTemporaryBackBridge(undefined,'same-child-identity');assert.equal(g.page.temporaryBackIdentity,'same-child-identity','old presentation cannot clear a reused child identity');
    const count=g.page.intentCount;old.onAction('old-download');old.onBack();assert.equal(g.page.intentCount,count);assert.equal(g.page.scene,'downloads');
    assert.equal(g.page.onBackPress(),true);assert.equal(consumed,1);assert.equal(g.page.scene,'downloads');
    current.onTemporaryBackBridge(undefined,'same-child-identity');assert.equal(g.page.onBackPress(),true);assert.equal(g.page.scene,'menu');
    assert.equal(g.page.onBackPress(),false);g.page.launchFixture('directory-detail', g.page.presentation);g.page.initialRender();assert.equal(g.page.onBackPress(),true);assert.equal(g.page.scene,'menu','Directory has no temporary bridge; current scene Back exits');
    g.page.aboutToDisappear();const last=g.page.intentCount;current.onAction('after-unmount');assert.equal(g.page.intentCount,last);
    // Capture actual SDK menu Button closures, then replay them in another
    // actor and the successor menu. This is deliberately not a direct call to
    // launchSource/launchFixture with a freshly supplied generation.
    const menu=fixture();menu.page.aboutToAppear();await tick();menu.page.initialRender();
    const button=id=>menu.sdk.nodes(menu.page).findLast(node=>node.type==='Button'&&node.id===id)?.onClick;
    const oldSource=button('reader-page-structure-source-default'),oldFixture=button('reader-page-structure-downloads'),
      oldWidth=button('reader-page-structure-width-320'),oldExit=button('reader-page-structure-back-pilot');
    for(const action of [oldSource,oldFixture,oldWidth,oldExit])assert.equal(typeof action,'function');
    oldFixture();assert.equal(menu.page.scene,'downloads');const activePresentation=menu.page.presentation;
    oldSource();oldFixture();oldWidth();oldExit();assert.equal(menu.page.scene,'downloads');assert.equal(menu.page.presentation,activePresentation);assert.equal(menu.page.requestedWidth,366);assert.equal(menu.routes.length,0);
    menu.page.onBackPress();assert.equal(menu.page.scene,'menu');
    oldSource();oldFixture();oldWidth();oldExit();assert.equal(menu.page.scene,'menu');assert.equal(menu.page.presentation,activePresentation);assert.equal(menu.page.requestedWidth,366);assert.equal(menu.routes.length,0,'old menu exit must not pop the new menu');
    menu.page.menu();const currentSource=button('reader-page-structure-source-default');assert.notEqual(currentSource,oldSource);currentSource();assert.equal(menu.page.scene,'default','the current menu Source button is admitted');
  }

  async function safeArea(){
    const sourceScenes=['default','empty','recovery','busy','read-error','read-empty-error','original-unknown','original-cleanup'];
    const appScenes=['menu',...sourceScenes,'directory-detail','downloads','downloads-short','source-tools'];
    const ownedScenes=['directory-reader','directory-manga','directory-control-expanded','directory-control-compact','directory-control-flat-expanded','directory-control-flat-compact','directory-control-short-122','directory-control-short-168','directory-control-short-190'];
    for(const width of[320,366])for(const scene of[...appScenes,...ownedScenes]){
      const metrics=createDefaultReaderWindowMetrics();metrics.systemInsets.top=39;metrics.cutoutInsets.top=43;metrics.systemFontScale=1;
      const f=fixture({metrics});f.page.aboutToAppear();await tick();f.page.selectWidth(width,f.page.presentation);
      if(scene!=='menu'){if(sourceScenes.includes(scene))f.page.launchSource(scene,f.page.presentation);else f.page.launchFixture(scene,f.page.presentation);}
      f.page.initialRender();const root=[...f.page.nodes.values()].find(n=>n.type==='Stack'&&n.expandSafeArea!==undefined);assert(root);
      const top=appScenes.includes(scene)?43:0;assert.equal(root.padding.top,top);assert.equal(f.page.appContentTopInset(),top);
      const expectedEdges=scene==='directory-manga'?['SafeAreaEdge.TOP','SafeAreaEdge.BOTTOM','SafeAreaEdge.START','SafeAreaEdge.END']:ownedScenes.includes(scene)?['SafeAreaEdge.TOP','SafeAreaEdge.BOTTOM']:['SafeAreaEdge.BOTTOM'];
      assert.deepEqual(root.expandSafeArea[1],expectedEdges);assert.equal([...f.page.nodes.values()].filter(n=>n.padding?.top===43).length,top>0?1:0,'one App host pays the top, owned actors pay it themselves');
      if(scene==='menu')assert(f.sdk.nodes(f.page).some(n=>n.id==='reader-page-structure-source-default'&&n.onClick),'safe menu still exposes current launch controls');
      else{const child=f.children.at(-1);assert(child);const stage=[...f.page.nodes.values()].find(n=>n.id==='reader-page-structure-source-stage'||n.id==='reader-page-structure-fixture-stage');assert.equal(stage.width,width);assert.equal(stage.height,'100%');
        if(scene.startsWith('directory-control-short-'))assert.equal(child.params.controlViewportHeight,Number(scene.split('-').at(-1)),'explicit component viewport is never reduced by host top padding');
        if(scene==='downloads-short')assert.equal(f.sdk.nodes(f.page).find(n=>n.id==='reader-download-short-viewport').height,168,'actual short component height retains its own viewport');}
      metrics.systemInsets.top=51;metrics.cutoutInsets.top=47;f.page.windowMetricsRevision=2;f.page.onMetricsChanged();f.page.replayOnly([root.id]);assert.equal(root.padding.top,top>0?51:0,'same real metrics revision updates actual SDK root padding');assert.equal(f.events.at(-1).contentTopInsetVp,top>0?51:0);
    }
    const denied=fixture({debug:false});denied.page.aboutToAppear();await tick();denied.page.initialRender();assert.equal(denied.children.length,0);assert.equal(denied.routes[0].url,'pages/Index');
    const neutral=fixture();neutral.page.aboutToAppear();await tick();assert.equal(neutral.page.appContentTopInset(),0,'default zero metrics introduce no invented top inset');
  }
  async function nativeFontObservation() {
    const metrics=createDefaultReaderWindowMetrics();metrics.systemFontScale=1;
    const reads=[],writes=[];
    let unavailable=false;
    let sample={following:true,max:2147483648,vp:3.5,fp:3.5};
    const readonlyContext=()=>({
      isFollowingSystemFontScale:()=>{reads.push('following');return sample.following;},
      getMaxFontScale:()=>{reads.push('max');return sample.max;},
      vp2px:value=>{assert.equal(value,1);reads.push('vp');return sample.vp;},
      fp2px:value=>{assert.equal(value,1);reads.push('fp');return sample.fp;},
      setFontScale:()=>{writes.push('scale');assert.fail('diagnostic must not set scale');},
      setMaxFontScale:()=>{writes.push('max');assert.fail('diagnostic must not set max');},
    });
    let context=readonlyContext();
    const f=fixture({metrics,nativeContext:()=>{
      if(unavailable)throw Error('current native context unavailable');
      return context;
    }});
    f.page.aboutToAppear();await tick();
    assert.equal(f.page.fontState,'ready');
    let observation=f.events.at(-1);
    assert.equal(observation.kind,'fonts-checked');assert.equal(observation.nativeFontScaleVp,1);
    assert.deepEqual(reads,['following','max','vp','fp']);

    // Same actor, same current context object, fresh native conversion values.
    metrics.systemFontScale=1.45;sample.fp=5.075;
    f.page.windowMetricsRevision=2;
    observation=f.events.at(-1);
    assert.equal(observation.kind,'window-metrics');assert.equal(observation.systemFontScale,1.45);
    assert.equal(observation.nativeFontObservationStatus,'ready');assert.equal(observation.nativeFontScaleVp,1.45);
    assert.deepEqual(reads.slice(4),['following','max','vp','fp'],'metric callback reacquires all readonly facts');

    // A subsequent record must use the replacement context and report a
    // genuine policy/conversion discrepancy without copying Coordinator facts.
    sample={following:false,max:1.6,vp:4,fp:8};context=readonlyContext();
    f.page.record('current-native-context');observation=f.events.at(-1);
    assert.equal(observation.nativeFontFollowing,false);assert.equal(observation.nativeFontMaxScale,1.6);
    assert.equal(observation.nativeFontScaleVp,2);assert.equal(observation.systemFontScale,1.45);
    assert.equal(reads.length,12,'every record performs four current readonly reads');

    unavailable=true;f.page.windowMetricsRevision=3;
    observation=f.events.at(-1);assert.equal(observation.nativeFontObservationStatus,'unavailable');
    for(const key of['nativeFontFollowing','nativeFontMaxScale','nativeFontScaleVp'])
      assert.equal(Object.hasOwn(observation,key),false,'unavailable record must not retain earlier native values');
    unavailable=false;sample.fp=NaN;f.page.record('invalid-native-context');observation=f.events.at(-1);
    assert.equal(observation.nativeFontObservationStatus,'unavailable');assert.equal(Object.hasOwn(observation,'nativeFontScaleVp'),false);
    assert.equal(f.page.fontState,'ready','diagnostic availability does not replace font loading state');
    assert.equal(metrics.systemFontScale,1.45);assert.deepEqual(writes,[]);
    const count=f.events.length;f.page.aboutToDisappear();f.page.windowMetricsRevision=4;
    assert.equal(f.events.length,count,'retired metric callback does not produce a fresh-looking observation');
    console.log(JSON.stringify({kind:'root-native-font-observation',sameActorDynamicRefresh:true,
      contextReplacement:true,readonlyPolicy:true,unavailableClearsPrevious:true,retiredCallbackRejected:true,
      boundary:'Actual SDK Root methods and finite readonly UIContext ports. Native system propagation remains target evidence.'}));
  }
  async function menuSafeArea() {
    const before=readFileSync(new URL('./fixtures/design/directory-confluence-before/root-menu-bottom.ets.txt',import.meta.url),'utf8');
    const metrics=createDefaultReaderWindowMetrics();metrics.windowRect.width=366;metrics.windowRect.height=844;
    metrics.systemInsets.top=39;metrics.systemInsets.bottom=8;metrics.cutoutInsets.bottom=11;
    metrics.gestureInsets.bottom=40;metrics.navigationInsets.bottom=24;
    const old=fixture({metrics,sourceText:before});old.page.aboutToAppear();await tick();old.page.initialRender();
    const oldScroll=old.sdk.nodes(old.page).find(node=>node.type==='Scroll');
    assert.equal(oldScroll.height,'100%','exact before-source menu consumes the gesture-owned bottom');
    assert.equal(oldScroll.clip,undefined,'old source declares no menu safe viewport clipping');
    for(const width of[320,366])for(const scale of[1,1.45,2]) {
      metrics.systemFontScale=scale;metrics.windowRect.width=width;metrics.gestureInsets.bottom=40;
      const f=fixture({metrics});f.page.aboutToAppear();await tick();f.page.selectWidth(width,f.page.presentation);f.page.initialRender();
      const scroll=f.sdk.nodes(f.page).find(node=>node.id==='reader-page-structure-menu-scroll');assert(scroll);
      assert.equal(scroll.type,'Scroll');assert.equal(scroll.height,'calc(100% - 40vp)');assert.equal(scroll.clip,true);
      assert.equal(f.page.menuBottomInset(),40,'current shared helper owns inset selection');
      const root=f.sdk.nodes(f.page).find(node=>node.type==='Stack'&&node.expandSafeArea!==undefined);
      assert.equal(root.padding.top,39);assert.deepEqual(root.expandSafeArea[1],['SafeAreaEdge.BOTTOM']);
      metrics.navigationInsets.bottom=52;f.page.windowMetricsRevision+=1;f.sdk.properties.flush();
      assert.equal(scroll.height,'calc(100% - 52vp)','actual SDK dependency delivery updates same Scroll viewport');
      assert.equal(f.page.requestedWidth,width);assert.equal(metrics.systemFontScale,scale,'menu never changes scale');
      metrics.navigationInsets.bottom=24;
    }
    const neutral=createDefaultReaderWindowMetrics();
    neutral.systemInsets.bottom=NaN;neutral.cutoutInsets.bottom=-1;
    neutral.gestureInsets.bottom=Infinity;neutral.navigationInsets.bottom=-5;
    const zero=fixture({metrics:neutral});zero.page.aboutToAppear();await tick();zero.page.initialRender();
    assert.equal(zero.sdk.nodes(zero.page).find(node=>node.id==='reader-page-structure-menu-scroll').height,'calc(100% - 0vp)');
    // The subtraction exists only inside the diagnostic menu branch.
    for(const scene of['default','directory-manga','directory-control-short-122','source-tools']) {
      const f=fixture({metrics});f.page.aboutToAppear();await tick();
      if(scene==='default')f.page.launchSource(scene,f.page.presentation);else f.page.launchFixture(scene,f.page.presentation);
      f.page.initialRender();assert.equal(f.sdk.nodes(f.page).some(node=>node.id==='reader-page-structure-menu-scroll'),false);
      const stage=f.sdk.nodes(f.page).find(node=>node.id==='reader-page-structure-source-stage'||node.id==='reader-page-structure-fixture-stage');
      assert.equal(stage.height,'100%');if(scene==='directory-control-short-122')assert.equal(f.props().controlViewportHeight,122);
    }
    console.log(JSON.stringify({kind:'qa-menu-safe-scroll-viewport',beforeSourceFullViewport:true,
      widths:[320,366],scales:[1,1.45,2],liveBottomInsets:[40,52],sameScrollDependencyUpdate:true,
      actorStagesRetained:true,boundary:'Actual SDK viewport/clip declarations and real inset helper. Native gesture routing/hit testing remains Root target verification.'}));
  }
  async function componentFixtureBack(scene, kind, entryId) {
    const pending = deferred(), page = fixture({ fonts: () => pending.promise });
    page.page.aboutToAppear(); page.page.launchFixture(scene, page.page.presentation);
    assert.equal(page.page.scene, 'menu');
    pending.resolve(); await tick(); page.page.menu();
    const launch = page.sdk.nodes(page.page).find(node => node.id === entryId).onClick;
    launch(); page.page.initialRender(); assert.equal(page.children.at(-1).kind, kind);
    const old = page.props(); assert.equal(old.fontsReady, true);
    let backs = 0;
    old.onTemporaryBackBridge(() => { backs++; return true; }, 'group-fixture');
    page.page.onBackPress(); assert.equal(backs, 1); assert.equal(page.page.scene, scene);
    old.onTemporaryBackBridge(undefined, 'group-fixture');
    page.page.onBackPress(); assert.equal(page.page.scene, 'menu');
    old.onTemporaryBackBridge(() => true, 'retired'); assert.equal(page.page.temporaryBackIdentity, '');
  }
  const cases={'safe-area':safeArea,'native-font-observation':nativeFontObservation,'menu-safe-area':menuSafeArea,admission,'font-gate':fontGate,'source-callbacks':sourceCallbacks,'source-states':sourceStates,'downloads-short':downloadsShort,'fixture-scenes':fixtureScenes,'tools-state-scenes':toolsStateScenes,
    'group-recovery': () => componentFixtureBack('group-recovery', 'group', 'reader-page-structure-group-recovery'),
    'framework-geometry': () => componentFixtureBack('framework-geometry', 'geometry', 'reader-page-structure-framework-geometry'),
    'legacy-recovery': () => componentFixtureBack('legacy-recovery', 'legacy', 'reader-page-structure-legacy-recovery')};
  for(const id of selected){await cases[id]();recordContractCasePass(id);}
}
