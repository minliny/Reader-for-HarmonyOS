import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';

export const CONTRACT_CASES = {
  "strict-debug-flag": {
    "description": "Pure strict diagnostic admission matrix; does not construct SDK/runtime",
    "resources": []
  },
  "cold-diagnostic-admission": {
    "description": "Actual EntryAbility.onCreate and runtime constructor, controlled platform ports; native allocation not measured",
    "resources": []
  },
  "optional-preparation": {
    "description": "Actual runtime optional preparation, pause/close/mutation fences, independent durable neighbour and RAM-only release; fake Core",
    "resources": []
  },
  "retained-presentation": {
    "description": "Actual public retained lookup, producer/consumer and recency guards; fake native measurement",
    "resources": []
  }
};

async function case_strict_debug_flag() {
const { default: assert } = await import('node:assert/strict');
const { readerControlVerificationColdStartPage, readerDisableOptionalEntryMemory, readerMangaOfflineProbeScope, readerMangaReadingProbeScope, readerMangaProbeSelectionMode } = await import('../entry/src/main/ets/app/ReaderControlVerificationLaunch.ts');
for(const debug of [true,false,1,'true',new Boolean(true)])for(const mode of ['debug','release','DEBUG','debug ',''])
  for(const value of [true,false,undefined,null,1,'true','1',{},[true],new Boolean(true)]) {
    assert.equal(readerDisableOptionalEntryMemory(debug,mode,value),debug===true&&mode==='debug'&&value===true);
    assert.equal(readerControlVerificationColdStartPage(debug,mode,undefined,undefined),'pages/Index',
      'the memory diagnostic is independent of route admission');
  }

}

async function optionalRuntimeFixture() {
  const { default: assert } = await import('node:assert/strict');
  const { readFileSync } = await import('node:fs');
  const { virtualFilePath } = await import('./lib/tool-environment.mjs');
  const { installedEtsCompiler } = await import('./lib/ets-compiler-runtime.mjs');
  const { pureModuleProbe } = await import('./lib/ets-pure-module-probe.mjs');
  const { ReadingEntryPreparation } = await import('../entry/src/main/ets/features/reading/ReadingEntryPreparation.ts');
  const { releaseReadingEntryMemory } = await import('../entry/src/main/ets/features/reading/ReadingEntryHandoff.ts');
  const { MangaOfflineNetworkProbe } = await import('../entry/src/main/ets/app/MangaOfflineNetworkProbe.ts');
  const { ts, options } = installedEtsCompiler();
  const file = new URL('../entry/src/main/ets/app/ReaderRuntimeOwner.ts', import.meta.url);
  const tree = ts.createSourceFile(virtualFilePath('ReaderOptionalEntryOwner.ts'), readFileSync(file, 'utf8'),
    ts.ScriptTarget.Latest, true, ts.ScriptKind.TS, options);
  assert.deepEqual(tree.parseDiagnostics, []);
  const owner = tree.statements.find(node => ts.isClassDeclaration(node) && node.name?.text === 'ReaderRuntimeOwner');
  assert.ok(owner);
  const selected = new Set(['instance', 'state', 'abilityLeases', 'coreCapabilities', 'entryPreparations',
    'optionalEntryMemoryEnabled', 'install', 'current', 'readingEntryPreparations', 'optionalReadingEntryMemoryEnabled',
    'releaseOptionalReadingEntryMemory', 'captureReadingContentValidity']);
  const members = owner.members.filter(node => ts.isConstructorDeclaration(node) || selected.has(node.name?.text))
    .map(node => node.getText(tree)).join('\n');

  function runtimeType(ports = {}) {
    class PlatformHost {}
    const dependencies = {
      ReadingEntryPreparation, releaseReadingEntryMemory, MangaOfflineNetworkProbe, LOG_DOMAIN: 0x5244,
      hilog: { info() {} }, ReaderHostRegistry: PlatformHost, HarmonyTtsHostRouter: PlatformHost,
      HarmonySystemTtsHost: PlatformHost, HarmonyHttpTtsHost: PlatformHost, HarmonyTtsMediaSession: PlatformHost,
      HarmonyTtsBackgroundSession: PlatformHost, LocalEpubResourceHost: PlatformHost, ReadingImageDiskCache: PlatformHost,
      ReadingBodyImageHost: { setDisplayCacheDir() {} },
    };
    const { ReaderRuntimeOwner } = pureModuleProbe('class ReaderRuntimeOwner {\n' + members + '\n}',
      'ReaderOptionalEntryOwner.ts', dependencies, ['ReaderRuntimeOwner']);
    Object.assign(ReaderRuntimeOwner.prototype, ports);
    return ReaderRuntimeOwner;
  }

  return { runtimeType, context: { cacheDir: '/unused-native-context', config: { colorMode: 0 } } };
}

const optionalMemoryPorts = {
  bindMangaStorage() {},
  bindMangaReadingProbe() { this.readingProbeBindingRequested = true; },
};

async function case_cold_diagnostic_admission() {
const { default: assert } = await import('node:assert/strict');
const { readFileSync } = await import('node:fs');
const { productionMotionMethods } = await import('./lib/reader-motion-method-probe.mjs');
const { createMangaAtomicPayloadInstallerFixture } = await import('./lib/manga-atomic-payload-probe.mjs');
const { productionEntryDiagnostics } = await import('./lib/reader-entry-diagnostics-probe.mjs');
const feedback = await import('../entry/src/main/ets/features/common/ReaderTransientFeedback.ts');
const { pureModuleProbe } = await import('./lib/ets-pure-module-probe.mjs');
const { READER_REDUCE_MOTION_STORAGE_KEY } = pureModuleProbe(readFileSync(new URL('../entry/src/main/ets/features/common/ReaderMotionPolicy.ets',import.meta.url),'utf8'),'ReaderMotionPolicy.ets',{},['READER_REDUCE_MOTION_STORAGE_KEY']);
const { ReaderStartupTrace } = await import('../entry/src/main/ets/app/ReaderStartupTrace.ts');
const { errorMessageOf, localReadFailureSummary } = await import('../entry/src/main/ets/app/ErrorMessage.ts');
const { readerControlVerificationColdStartPage, readerDisableOptionalEntryMemory, readerMangaOfflineProbeScope, readerMangaReadingProbeScope, readerMangaProbeSelectionMode } = await import('../entry/src/main/ets/app/ReaderControlVerificationLaunch.ts');
const { runtimeType, context } = await optionalRuntimeFixture();
const abilityFile = new URL('../entry/src/main/ets/entryability/EntryAbility.ets', import.meta.url);
const installMangaAtomicPayloadReader = createMangaAtomicPayloadInstallerFixture({});
// Execute the real onCreate body with controlled platform startup boundaries.
// It alone decodes the Want, and passes the flag before optional producers exist.
for(const [debug,mode,value,disabled,selectionFlag,expectedSelection] of [[true,'debug',true,true],[true,'release',true,false],
  [false,'debug',true,false],[true,'debug','true',false],[true,'debug',1,false],[true,'debug',undefined,false],
  [true,'debug',undefined,false,'readerMangaReadingProbeSelectManga','reading'],
  [true,'debug',undefined,false,'readerMangaOfflineProbeSelectManga','offline'],
  [true,'release',undefined,false,'readerMangaOfflineProbeSelectManga'],
  [false,'debug',undefined,false,'readerMangaReadingProbeSelectManga'],
  [true,'debug',true,true,'readerMangaReadingProbeSelectManga']]) {
  const Runtime=runtimeType(), writes=[];let recoveries=0;
  Runtime.prototype.start=async()=>{};
  const ReaderEntryDiagnostics=productionEntryDiagnostics({ReaderMangaPlatformDiagnostic:{install:()=>undefined},hilog:{info(){},error(){}}});
  const Ability=productionMotionMethods(abilityFile,['onCreate'],{
    ReaderEntryDiagnostics,ReaderCrashEvidence:{install:()=>undefined},...feedback,READER_REDUCE_MOTION_STORAGE_KEY,
    ReaderStartupTrace:{install(clock,record,enabled){
      assert.equal(enabled,debug===true&&mode==='debug','only debug builds enable startup diagnostics');
      return ReaderStartupTrace.install(clock,record,enabled);
    }},readerMotionNowMs:()=>performance.now(),
    DEBUG:debug,BUILD_MODE_NAME:mode,readerControlVerificationColdStartPage,readerDisableOptionalEntryMemory,readerMangaOfflineProbeScope,readerMangaReadingProbeScope,readerMangaProbeSelectionMode,
    errorMessageOf,localReadFailureSummary,
    installMangaAtomicPayloadReader,
    ReaderMangaPlatformDiagnostic:{install:()=>undefined}, // Separate focused production-module probe owns SDK diagnostics.
    readerEventLoopProbeEnabled:()=>false,ReaderRuntimeOwner:Runtime,
    ReaderSystemFileOpenHost:{install(){},receive(){}},
    AppStorage:{setOrCreate:(...args)=>writes.push(args)},WebDavCredentialStore:{instance:{attachContext(){},loadBookshelfViewMode:async()=>null}},
    prepareReaderShelfFonts:async()=>{},prepareReaderFontFamily:async()=>{},readerAppearanceSnapshotFontFamily:()=> 'serif',
    ReaderThemeHost:{install:async()=>{},setRecoveryBarrier(){}},ConfigurationConstant:{ColorMode:{COLOR_MODE_DARK:1}},
    SyncGateway:class{async recoverInterruptedRestore(){recoveries++;}},LocalConfigurationReset:{recover:async()=>{}},
    DOMAIN:0x5244,hilog:{error(){}}});
  Runtime.prototype.getAppearanceStore=()=>({current:()=>({font:'serif'})});
  const ability=Object.assign(new Ability(),{context});
  const parameters={readerDisableOptionalEntryMemory:value,readerMangaOfflineProbe:value,
    readerMangaOfflineSourceId:'source',readerMangaOfflineBookId:'book'};
  if(selectionFlag!==undefined)parameters[selectionFlag]=true;
  ability.onCreate({parameters},{});
  await ability.recoveryReady;
  assert.equal(recoveries,1,'normal/release/diagnostic entry still recovers the original sync transaction independently of new sync UI admission');
  assert.equal(ability.coldStartPage,'pages/Index','cold diagnostic does not divert normal Index/reader route');
  assert.equal(ability.runtimeOwner.optionalReadingEntryMemoryEnabled(),!disabled);
  const exactEnabled=disabled&&selectionFlag===undefined;
  assert.equal(ability.runtimeOwner.mangaOfflineProbe!==undefined,exactEnabled||expectedSelection!==undefined,'actual cold Want strict flags control scoped probe construction');
  if(exactEnabled)assert.equal(ability.runtimeOwner.mangaOfflineProbe.ownsCommand('book.toc',{sourceId:'source',bookId:'book'}),true,'cold Want is armed before a shelf click');
  if(expectedSelection!==undefined) {
    const probe=ability.runtimeOwner.mangaOfflineProbe,armed=JSON.parse(probe.snapshot());
    assert.equal(probe.mode,expectedSelection);assert.equal(armed.identityBound,false);
    assert.equal(armed.beforeSelectionBookCoverage,'not-covered');
    assert.equal(probe.ownsCommand('book.toc',{sourceId:'source',bookId:'book'}),false,'exact Want identity fields do not arm a selection scope');
    probe.select('native-source','native-book',true);
    assert.equal(probe.ownsCommand('manga.resource.prepare',{chapter:{sourceId:'native-source',bookId:'native-book'}}),true);
    assert.equal(probe.ownsCommand('manga.resource.prepare',{chapter:{sourceId:'source',bookId:'book'}}),false);
    assert.equal(Runtime.install(context,false,undefined,undefined,expectedSelection),ability.runtimeOwner);
    assert.equal(JSON.parse(probe.snapshot()).reason,'ability-reinstalled','warm owner reuse releases diagnostics instead of rearming');
    probe.select('another-native-source','another-native-book',true);
    assert.equal(probe.ownsCommand('manga.resource.prepare',{chapter:{sourceId:'another-native-source',bookId:'another-native-book'}}),false);
  }
  assert.deepEqual(writes,[['readerAppForeground',true],[READER_REDUCE_MOTION_STORAGE_KEY,false],
    [feedback.READER_TRANSIENT_TOAST_STORAGE_KEY,feedback.createReaderTransientToastState()],
    [feedback.READER_TRANSIENT_HOST_STORAGE_KEY,0]],'normal app/feedback defaults remain the only startup publications; diagnostic flags never persist');
}
for(const mode of ['offline','reading']) {
 const Runtime=runtimeType(),owner=Runtime.install(context,false,{sourceId:'source',bookId:'book'},undefined,mode);
 assert.equal(owner.mangaOfflineProbe,undefined,'constructor rejects a selection mode combined with an exact-ID scope');
}

}

async function case_optional_preparation() {
const { default: assert } = await import('node:assert/strict');
const { registerReadingEntryMemoryRelease } = await import('../entry/src/main/ets/features/reading/ReadingEntryHandoff.ts');
const { runtimeType, context } = await optionalRuntimeFixture();
const tick=()=>new Promise(resolve=>setImmediate(resolve));
async function until(predicate) { for(let i=0;i<40;i++){if(predicate())return;await tick();}assert.fail('optional preparation did not settle'); }
{
  const Runtime=runtimeType(optionalMemoryPorts), owner=Runtime.install(context,true);
  let rpc=0,seedLoads=0,dropped=0;
  const requests=[];
  owner.request=async(method,params)=>{
    rpc++;requests.push({method,params});
    assert.equal(method,'reading.entry.prepare','RAM-off must never request an optional body snapshot');
    return {data:{kind:'ready',reason:'alreadyPrepared',sourceId:params.sourceId,
      bookId:params.bookId,chapterIndex:3+params.neighborOffset}};
  };
  owner.retainedLocalBookSourcePath=async(_book,current)=>current()?'/private/retained/book.source':undefined;
  owner.supportsCoreCapability=()=>true;
  owner.bookAcquisitions=()=>({request:owner.request});
  const preparation=owner.readingEntryPreparations();
  preparation.setVisibleBooks([{sourceId:'local',bookId:'b'}]);
  preparation.setPaused(true);
  await preparation.preparePersistedShelf('paused',async()=>{seedLoads++;return[];},()=>true);
  assert.equal(seedLoads,0,'background work still respects foreground pause with RAM disabled');
  preparation.setPaused(false);
  await preparation.preparePersistedShelf('shelf',async()=>{seedLoads++;return[{sourceId:'local',bookId:'b'}];},()=>true);
  preparation.finishRequest('reading.progress.update',{sourceId:'local',bookId:'b'});
  assert.equal(preparation.take('local','b'),undefined);
  assert.equal(preparation.visible.size,0);assert.equal(rpc,7);assert.equal(seedLoads,1);
  assert.deepEqual(requests.map(r=>r.params.neighborOffset),[0,1,-1,2,-2,3,-3]);
  assert.equal(requests[0].params.localSourcePath,'/private/retained/book.source',
    'legacy image metadata repair remains enabled independently of optional RAM');
  assert.equal(requests.slice(1).some(r=>r.params.localSourcePath!==undefined),false);
  const live=owner.captureReadingContentValidity('local','b');
  assert.equal(live(),true,'foreground content validity remains available while optional preparation is disabled');
  preparation.beginRequest('replace.persist',{sourceId:'local',bookId:'b'});
  assert.equal(live(),false,'disabling optional work does not remove mutation fences');
  preparation.finishRequest('replace.persist',{sourceId:'local',bookId:'b'});
  registerReadingEntryMemoryRelease(owner,()=>{dropped++;});
  owner.releaseOptionalReadingEntryMemory();
  assert.equal(dropped,1);assert.equal(rpc,7,'release itself makes no Core request or durable mutation');
  assert.equal(Runtime.install(context,false),owner);
  assert.equal(owner.optionalReadingEntryMemoryEnabled(),false,'later Ability leases cannot turn preparation back on');
  preparation.close();
  await preparation.preparePersistedShelf('closed',async()=>{seedLoads++;return[];},()=>true);
  assert.equal(seedLoads,1,'owner close still stops durable work with RAM disabled');
}
{
  const Runtime=runtimeType(optionalMemoryPorts), owner=Runtime.install(context), calls=[];
  assert.equal(owner.optionalReadingEntryMemoryEnabled(),true,'ordinary startup keeps preparation enabled');
  assert.equal(Runtime.install(context,true),owner);
  assert.equal(owner.optionalReadingEntryMemoryEnabled(),true,'a warm owner cannot enable the cold diagnostic');
  const request=async(method,params)=>{
    calls.push(method);
    if(method==='reading.entry.prepare')return{data:{kind:'ready',reason:'prepared',
      sourceId:params.sourceId,bookId:params.bookId,chapterIndex:3+params.neighborOffset}};
    assert.equal(method,'reading.entry.snapshot');
    return{data:{kind:'ready',sourceId:'local',bookId:'b',chapterIndex:0,chapterTitle:'正文',content:'完整正文',baseUrl:'',
      blocks:[{kind:'text',text:'完整正文',startScalar:0,endScalar:4}],contentRefreshRequired:false,progress:null,navigation:null,
      positionScope:{sourceId:'local',bookId:'b',chapterIndex:0,bodyVersion:'body',processingVersion:'process'}}};
  };
  owner.request=request;owner.supportsCoreCapability=()=>true;owner.bookAcquisitions=()=>({request});
  const preparation=owner.readingEntryPreparations();
  preparation.setVisibleBooks([{sourceId:'local',bookId:'b'}]);
  let ready;
  await until(()=>{ready=preparation.take('local','b');return ready!==undefined;});
  assert.equal(ready.chapter.content,'完整正文');
  await until(()=>preparation.active===0);
  await preparation.preparePersistedShelf('shelf',async()=>[{sourceId:'local',bookId:'b'}],()=>true);
  assert.equal(calls.filter(name=>name==='reading.entry.snapshot').length,1);
  assert.equal(calls.filter(name=>name==='reading.entry.prepare').length,7,'ordinary persisted current/neighbour preparation remains unchanged');
  assert.equal(calls.some(name=>/clear|restore|update|put|delete/.test(name)),false);
  preparation.close();
}

}

async function case_retained_presentation() {
const { default: assert } = await import('node:assert/strict');
const { readFileSync } = await import('node:fs');
const { virtualFilePath } = await import('./lib/tool-environment.mjs');
const { installedEtsCompiler } = await import('./lib/ets-compiler-runtime.mjs');
const { pureModuleProbe } = await import('./lib/ets-pure-module-probe.mjs');
const { productionMotionMethods } = await import('./lib/reader-motion-method-probe.mjs');
const { ReadingEntryHandoff, estimateRetainedRemoteSessionBytes } = await import('../entry/src/main/ets/features/reading/ReadingEntryHandoff.ts');
const { ReadingPaginationPrefix } = await import('../entry/src/main/ets/features/reading/ReadingPaginationIndex.ts');
const { ReadingSessionFlowGateway } = await import('../entry/src/main/ets/features/reading/ReadingSessionFlowGateway.ts');
const { readingChapterLayoutMap } = await import('../entry/src/main/ets/features/reading/ReadingSurfaceLayoutMap.ts');
const { runtimeType, context } = await optionalRuntimeFixture();
const { ts, options } = installedEtsCompiler();
// The retained-page entrance and producer are independent of shelf preparation.
// Execute all three production guards; the disabled reader cannot even query a
// provider, and its producer must discard an old RAM handoff before returning.
const readingFile=new URL('../entry/src/main/ets/features/reading/LocalReadingExperience.ets',import.meta.url);
const readingTree=ts.createSourceFile(virtualFilePath('ReaderOptionalRetained.ets'),readFileSync(readingFile,'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.ETS,options);
const dto=Object.fromEntries(['ReaderRetainedPresentation','ReaderMaterializedChapterContext'].map(name=>{
  const node=readingTree.statements.find(n=>ts.isClassDeclaration(n)&&n.name?.getText(readingTree)===name);
  assert.ok(node,name);
  return [name, pureModuleProbe(node.getText(readingTree), name + '.ts', {}, [name])[name]];
}));
const entryFunction=readingTree.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.getText(readingTree)==='readerEntryPresentation');
assert.ok(entryFunction);
for(const disabled of [true,false]) {
  const Runtime=runtimeType(optionalMemoryPorts), runtime=Runtime.install(context,disabled), retained=new ReadingEntryHandoff(), events=[];
  const originalPublish=retained.publish.bind(retained), originalClear=retained.clear.bind(retained);
  retained.publish=(...args)=>{events.push('publish');return originalPublish(...args);};
  retained.clear=()=>{events.push('clear');originalClear();};
  const dependencies={...dto,ReadingSessionFlowGateway,estimateRetainedRemoteSessionBytes,ReadingPaginationPrefix,
    ReaderRuntimeOwner:Runtime,ReaderWindowCoordinator:{metrics:()=>({densityPixels:3})},
    readingEntryHandoff:owner=>{assert.equal(owner,runtime);events.push('handoff');return retained;}};
  const { readerEntryPresentation } = pureModuleProbe(entryFunction.getText(readingTree), 'ReaderEntryPresentation.ts',
    { ReaderRuntimeOwner: Runtime, readingEntryHandoff: dependencies.readingEntryHandoff }, ['readerEntryPresentation']);
  const Reader=productionMotionMethods(readingFile,['restoreRetainedReadingPresentation','retainConfirmedEntryPresentation','samePaginationKey',
    'admitRetainedReadingRecency','isVisiblePageCurrent','isSelectionCurrent','isMountedToken'],dependencies);
  if(disabled) {
    originalPublish('local','book',{old:true},1,()=>true);
    events.length=0;
    assert.equal(readerEntryPresentation('local','book'),undefined);
    assert.deepEqual(events,[],'disabled public lookup never opens the handoff owner');
    const reader=Object.assign(new Reader(),{entryPresentationProvider(){throw Error('disabled reader must not query retained provider');}});
    assert.equal(reader.restoreRetainedReadingPresentation(1),false);
    Object.defineProperty(reader,'visiblePage',{get(){throw Error('disabled retention cannot inspect/copy the visible body');}});
    reader.retainConfirmedEntryPresentation();
    assert.deepEqual(events,['handoff','clear'],'old handoff is cleared before disabled retention returns, without publication');
    assert.equal(retained.current('local','book'),undefined);
  } else {
    const appearance={fontSize:20}, settings={navigationMode:'paged'},chapter={sourceId:'local',bookId:'book',
      chapterIndex:4,chapterTitle:'正文',content:'实际可读的正文',images:[],contentVersion:'version'};
    const key={sourceId:'local',bookId:'book',chapterIndex:4,contentVersion:'version',layoutSignature:'layout'};
    const page={startScalar:2,endScalar:7,fragments:[{text:'可读的正文'}],measuredAppearance:appearance,
      paginationKey:key,paginationObservation:{requestScalar:2,startScalar:2,endScalarExclusive:7}};
    const materialized={chapter,layoutMap:readingChapterLayoutMap(chapter),contentVersion:chapter.contentVersion,
      paragraphRanges:[{startScalar:0,endScalar:7}]};
    const gateway=new ReadingSessionFlowGateway('local','book',{kind:'local'},runtime);
    const producer=Object.assign(new Reader(),{sourceId:'local',bookId:'book',phase:'ready',chapter,visiblePage:page,
      lastCommittedProgress:{sourceId:'local',bookId:'book',chapterIndex:4,chapterOffset:2,chapterProgress:2/7},sessionGateway:gateway,
      hasMeasuredViewport:()=>true,readerSettingsSnapshot:settings,appearanceSnapshot:appearance,
      paragraphRanges:materialized.paragraphRanges,tocEntries:[{index:4,title:'正文'}],
      captureMaterializedChapterContext:()=>materialized,paginationLayoutSignature:()=> 'layout',currentPaginationKey:()=>key});
    producer.retainConfirmedEntryPresentation();
    assert.deepEqual(events.slice(0,3),['handoff','clear','publish']);
    const snapshot=readerEntryPresentation('local','book');
    assert.equal(snapshot.page,page);assert.equal(snapshot.context.chapter.content,'实际可读的正文');
    let providers=0,presentations=0;
    const reader=Object.assign(new Reader(),{sourceId:'local',bookId:'book',phase:'loading',readerSettingsLoaded:true,
      mounted:true,lifecycleToken:1,appForeground:true,windowChromeActive:true,
      retainedReadingRecencyReceipt:undefined,retainedReadingRecencyVisible:false,
      chapterSelectionToken:1,readerSettingsSnapshot:settings,appearanceSnapshot:appearance,
      entryPresentationProvider(){providers++;return snapshot;},hasMeasuredViewport:()=>true,paginationLayoutSignature:()=> 'layout',
      isSelectionActive:(life,selection)=>life===1&&selection===1,
      admitTocEntries(items){this.tocEntries=items;},readingTocEntries(){return this.tocEntries;},
      chapterWindow:{configure(){},setCurrent(){}},restoreMaterializedChapterContext(value){this.chapter=value.chapter;},
      rebuildChapterImageIndexes(){},publishMeasuredFirstPage(value,_chapter,selection){this.visiblePage=value;this.visibleFragments=value.fragments;this.visiblePageSelectionToken=selection;presentations++;},
      admitCommittedProgress(progress){this.lastCommittedProgress=progress;},configureReaderScreenAwakeLease(){},applyReaderSystemEventPolicy(){},beginReadingRecordClock(){},
      onDirectoryProjectionChanged(){},schedulePageTurnPreparation(){},notifyControlSelectionReadingReady(){}});
    assert.equal(reader.restoreRetainedReadingPresentation(1),true);
    assert.equal(providers,1);assert.equal(presentations,1);assert.equal(reader.phase,'ready');
    assert.equal(reader.visibleFragments[0].text,'可读的正文','ordinary launch still restores the actual retained body');
    assert.equal(reader.retainedReadingRecencyVisible,true,'only the actual restored foreground page admits retained reading');
    assert.equal(reader.retainedReadingRecencyReceipt,snapshot.progress);
    reader.retainedReadingRecencyVisible=false;reader.appForeground=false;
    reader.admitRetainedReadingRecency();assert.equal(reader.retainedReadingRecencyVisible,false,'background presentation does not count as reading');
    reader.appForeground=true;reader.windowChromeActive=false;
    reader.admitRetainedReadingRecency();assert.equal(reader.retainedReadingRecencyVisible,false,'an inactive reader window does not count as reading');
    reader.windowChromeActive=true;reader.chapterSelectionToken++;
    reader.admitRetainedReadingRecency();assert.equal(reader.retainedReadingRecencyVisible,false,'a stale chapter selection cannot admit retained reading');
    reader.chapterSelectionToken--;reader.lastCommittedProgress={...snapshot.progress};
    reader.admitRetainedReadingRecency();assert.equal(reader.retainedReadingRecencyVisible,false,'a replaced durable receipt cannot admit the old retained reading');
    reader.lastCommittedProgress=snapshot.progress;reader.admitRetainedReadingRecency();
    assert.equal(reader.retainedReadingRecencyVisible,true);
    assert.equal(providers,1);assert.equal(presentations,1,'recency guards do not query, publish or reload a second body');
    producer.retainedReadingRecencySkipped=true;
    producer.retainConfirmedEntryPresentation();
    assert.equal(retained.current('local','book'),undefined,'a skipped optional renewal cannot re-publish its old RAM receipt for another visit');
  }
}

}

const implementations = {'strict-debug-flag':case_strict_debug_flag,'cold-diagnostic-admission':case_cold_diagnostic_admission,'optional-preparation':case_optional_preparation,'retained-presentation':case_retained_presentation};
for (const id of selectContractCases(CONTRACT_CASES)) {
  const { registerReaderTypeScriptImports } = await import('./lib/reader-typescript-imports.mjs');
  const imports = id === 'strict-debug-flag' ? undefined : registerReaderTypeScriptImports();
  try {
    await implementations[id]();
    recordContractCasePass(id);
  } finally {
    imports?.deregister();
  }
}
