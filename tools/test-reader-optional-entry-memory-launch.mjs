import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire, registerHooks, stripTypeScriptTypes } from 'node:module';
import { productionMotionMethods } from './lib/reader-motion-method-probe.mjs';
import { ReaderStartupTrace } from '../entry/src/main/ets/app/ReaderStartupTrace.ts';
import { readerControlVerificationColdStartPage, readerDisableOptionalEntryMemory } from '../entry/src/main/ets/app/ReaderControlVerificationLaunch.ts';
import { ReadingEntryHandoff, estimateRetainedRemoteSessionBytes, registerReadingEntryMemoryRelease, releaseReadingEntryMemory } from '../entry/src/main/ets/features/reading/ReadingEntryHandoff.ts';
import { ReadingPaginationPrefix } from '../entry/src/main/ets/features/reading/ReadingPaginationIndex.ts';
registerHooks({resolve(s,c,next){try{return next(s,c);}catch(e){if(s.startsWith('.')&&!s.endsWith('.ts'))return next(s+'.ts',c);throw e;}}});
const { ReadingEntryPreparation } = await import('../entry/src/main/ets/features/reading/ReadingEntryPreparation.ts');
const { ReadingSessionFlowGateway } = await import('../entry/src/main/ets/features/reading/ReadingSessionFlowGateway.ts');
const { readingChapterLayoutMap } = await import('../entry/src/main/ets/features/reading/ReadingSurfaceLayoutMap.ts');
const require=createRequire(import.meta.url), sdk=process.env.READER_ETS_LOADER_ROOT??
  '/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/ets/build-tools/ets-loader';
const ts=require(`${sdk}/node_modules/typescript`), options=require(`${sdk}/lib/ets_checker.js`).compilerOptions;
const runtimeFile=new URL('../entry/src/main/ets/app/ReaderRuntimeOwner.ts',import.meta.url);
const abilityFile=new URL('../entry/src/main/ets/entryability/EntryAbility.ets',import.meta.url);
const runtimeSource=readFileSync(runtimeFile,'utf8'), abilitySource=readFileSync(abilityFile,'utf8');
const tree=ts.createSourceFile('/tmp/ReaderOptionalEntryOwner.ts',runtimeSource,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS,options);
const ownerClass=tree.statements.find(n=>ts.isClassDeclaration(n)&&n.name?.getText(tree)==='ReaderRuntimeOwner');
const selected=new Set(['instance','state','abilityLeases','coreCapabilities','entryPreparations','optionalEntryMemoryEnabled',
  'install','current','readingEntryPreparations','optionalReadingEntryMemoryEnabled','releaseOptionalReadingEntryMemory','captureReadingContentValidity']);
const members=ownerClass.members.filter(n=>ts.isConstructorDeclaration(n)||selected.has(n.name?.getText(tree))).map(n=>n.getText(tree)).join('\n');
function runtimeType() {
  class PlatformHost {}
  const dependencies={ReadingEntryPreparation,releaseReadingEntryMemory,
    ReaderHostRegistry:PlatformHost,HarmonyTtsHostRouter:PlatformHost,HarmonySystemTtsHost:PlatformHost,HarmonyHttpTtsHost:PlatformHost,
    HarmonyTtsMediaSession:PlatformHost,HarmonyTtsBackgroundSession:PlatformHost,LocalEpubResourceHost:PlatformHost,
    ReadingImageDiskCache:PlatformHost,ReadingBodyImageHost:{setDisplayCacheDir(){}}};
  return new Function(...Object.keys(dependencies),stripTypeScriptTypes(`class ReaderRuntimeOwner { ${members} }`)+ '; return ReaderRuntimeOwner;')(...Object.values(dependencies));
}
const tick=()=>new Promise(resolve=>setImmediate(resolve));
async function until(predicate) { for(let i=0;i<40;i++){if(predicate())return;await tick();}assert.fail('optional preparation did not settle'); }
const context={cacheDir:'/unused-native-context',config:{colorMode:0}};

for(const debug of [true,false,1,'true',new Boolean(true)])for(const mode of ['debug','release','DEBUG','debug ',''])
  for(const value of [true,false,undefined,null,1,'true','1',{},[true],new Boolean(true)]) {
    assert.equal(readerDisableOptionalEntryMemory(debug,mode,value),debug===true&&mode==='debug'&&value===true);
    assert.equal(readerControlVerificationColdStartPage(debug,mode,undefined,undefined),'pages/Index',
      'the memory diagnostic is independent of route admission');
  }

// Execute the real onCreate body with controlled platform startup boundaries.
// It alone decodes the Want, and passes the flag before optional producers exist.
for(const [debug,mode,value,disabled] of [[true,'debug',true,true],[true,'release',true,false],
  [false,'debug',true,false],[true,'debug','true',false],[true,'debug',1,false],[true,'debug',undefined,false]]) {
  const Runtime=runtimeType(), writes=[];
  Runtime.prototype.start=async()=>{};
  const Ability=productionMotionMethods(abilityFile,['onCreate'],{
    ReaderStartupTrace:{install(clock,record,enabled){
      assert.equal(enabled,debug===true&&mode==='debug','only debug builds enable startup diagnostics');
      return ReaderStartupTrace.install(clock,record,enabled);
    }},readerMotionNowMs:()=>performance.now(),
    DEBUG:debug,BUILD_MODE_NAME:mode,readerControlVerificationColdStartPage,readerDisableOptionalEntryMemory,
    readerEventLoopProbeEnabled:()=>false,ReaderRuntimeOwner:Runtime,
    ReaderSystemFileOpenHost:{install(){},receive(){}},
    AppStorage:{setOrCreate:(...args)=>writes.push(args)},WebDavCredentialStore:{instance:{attachContext(){},loadBookshelfViewMode:async()=>null}},
    prepareReaderFonts:async()=>{},prepareReaderFontFamily:async()=>{},readerAppearanceSnapshotFontFamily:()=> 'serif',
    ReaderThemeHost:{install:async()=>{},setRecoveryBarrier(){}},ConfigurationConstant:{ColorMode:{COLOR_MODE_DARK:1}},
    SyncGateway:class{async recoverInterruptedRestore(){}},LocalConfigurationReset:{recover:async()=>{}},
    DOMAIN:0x5244,hilog:{error(){}}});
  Runtime.prototype.getAppearanceStore=()=>({current:()=>({font:'serif'})});
  const ability=Object.assign(new Ability(),{context});
  ability.onCreate({parameters:{readerDisableOptionalEntryMemory:value}},{});
  await ability.recoveryReady;
  assert.equal(ability.coldStartPage,'pages/Index','cold diagnostic does not divert normal Index/reader route');
  assert.equal(ability.runtimeOwner.optionalReadingEntryMemoryEnabled(),!disabled);
  assert.deepEqual(writes,[['readerAppForeground',true]],'diagnostic flag is not stored in settings or AppStorage');
}
const warmWantBody=abilitySource.slice(abilitySource.indexOf('  onNewWant('),abilitySource.indexOf('  private async prepareSelectedReadingFont'));
assert.match(warmWantBody,/ReaderSystemFileOpenHost\.receive\(want\)/);
assert.doesNotMatch(warmWantBody,/coldStartPage|readerDisableOptionalEntryMemory|loadContent|ReaderRuntimeOwner\.install/,
  'a warm Want cannot activate the cold diagnostic or reset the active reader');
assert.match(runtimeSource,/private readonly optionalEntryMemoryEnabled: boolean/);

{
  const Runtime=runtimeType(), owner=Runtime.install(context,true);
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
  const Runtime=runtimeType(), owner=Runtime.install(context), calls=[];
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

// The retained-page entrance and producer are independent of shelf preparation.
// Execute all three production guards; the disabled reader cannot even query a
// provider, and its producer must discard an old RAM handoff before returning.
const readingFile=new URL('../entry/src/main/ets/features/reading/LocalReadingExperience.ets',import.meta.url);
const readingTree=ts.createSourceFile('/tmp/ReaderOptionalRetained.ets',readFileSync(readingFile,'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.ETS,options);
const dto=Object.fromEntries(['ReaderRetainedPresentation','ReaderMaterializedChapterContext'].map(name=>{
  const node=readingTree.statements.find(n=>ts.isClassDeclaration(n)&&n.name?.getText(readingTree)===name);
  assert.ok(node,name);
  return[name,new Function(stripTypeScriptTypes(node.getText(readingTree)).replace(/^export /,'')+`; return ${name};`)()];
}));
const entryFunction=readingTree.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.getText(readingTree)==='readerEntryPresentation');
assert.ok(entryFunction);
for(const disabled of [true,false]) {
  const Runtime=runtimeType(), runtime=Runtime.install(context,disabled), retained=new ReadingEntryHandoff(), events=[];
  const originalPublish=retained.publish.bind(retained), originalClear=retained.clear.bind(retained);
  retained.publish=(...args)=>{events.push('publish');return originalPublish(...args);};
  retained.clear=()=>{events.push('clear');originalClear();};
  const dependencies={...dto,ReadingSessionFlowGateway,estimateRetainedRemoteSessionBytes,ReadingPaginationPrefix,
    ReaderRuntimeOwner:Runtime,ReaderWindowCoordinator:{metrics:()=>({densityPixels:3})},
    readingEntryHandoff:owner=>{assert.equal(owner,runtime);events.push('handoff');return retained;}};
  const readerEntryPresentation=new Function('ReaderRuntimeOwner','readingEntryHandoff',
    stripTypeScriptTypes(entryFunction.getText(readingTree)).replace(/^export /,'')+'; return readerEntryPresentation;')
    (Runtime,dependencies.readingEntryHandoff);
  const Reader=productionMotionMethods(readingFile,['restoreRetainedReadingPresentation','retainConfirmedEntryPresentation','samePaginationKey'],dependencies);
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
      lastCommittedProgress:{bookId:'book',chapterIndex:4,chapterOffset:2,chapterProgress:2/7},sessionGateway:gateway,
      hasMeasuredViewport:()=>true,readerSettingsSnapshot:settings,appearanceSnapshot:appearance,
      paragraphRanges:materialized.paragraphRanges,tocEntries:[{index:4,title:'正文'}],
      captureMaterializedChapterContext:()=>materialized,paginationLayoutSignature:()=> 'layout',currentPaginationKey:()=>key});
    producer.retainConfirmedEntryPresentation();
    assert.deepEqual(events.slice(0,3),['handoff','clear','publish']);
    const snapshot=readerEntryPresentation('local','book');
    assert.equal(snapshot.page,page);assert.equal(snapshot.context.chapter.content,'实际可读的正文');
    let providers=0,presentations=0;
    const reader=Object.assign(new Reader(),{sourceId:'local',bookId:'book',phase:'loading',readerSettingsLoaded:true,
      chapterSelectionToken:1,readerSettingsSnapshot:settings,appearanceSnapshot:appearance,
      entryPresentationProvider(){providers++;return snapshot;},hasMeasuredViewport:()=>true,paginationLayoutSignature:()=> 'layout',
      isSelectionActive:(life,selection)=>life===1&&selection===1,
      admitTocEntries(items){this.tocEntries=items;},readingTocEntries(){return this.tocEntries;},
      chapterWindow:{configure(){},setCurrent(){}},restoreMaterializedChapterContext(value){this.chapter=value.chapter;},
      rebuildChapterImageIndexes(){},publishMeasuredFirstPage(value){this.visiblePage=value;this.visibleFragments=value.fragments;presentations++;},
      admitCommittedProgress(){},configureReaderScreenAwakeLease(){},applyReaderSystemEventPolicy(){},beginReadingRecordClock(){},
      onDirectoryProjectionChanged(){},schedulePageTurnPreparation(){},notifyControlSelectionReadingReady(){}});
    assert.equal(reader.restoreRetainedReadingPresentation(1),true);
    assert.equal(providers,1);assert.equal(presentations,1);assert.equal(reader.phase,'ready');
    assert.equal(reader.visibleFragments[0].text,'可读的正文','ordinary launch still restores the actual retained body');
  }
}
console.log('PASS optional entry-memory diagnostic: strict cold Want, no RAM snapshots, independent durable current/neighbour and legacy image repair, pause/close fences, RAM-only release, guarded retained pages and unchanged ordinary preparation');
