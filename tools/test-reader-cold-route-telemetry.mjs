import assert from 'node:assert/strict';
import {selectContractCases,recordContractCasePass} from './lib/contract-case-selection.mjs';
const selected=selectContractCases({'on-create-telemetry':{description:'Actual EntryAbility/cold composition: strict safe telemetry, privacy, warm Want and logger failure; pending ports only',resources:[]}});
if(selected.length){
 const {selectedProductionMethods}=await import('./lib/selected-production-methods.mjs');
 const {productionEntryDiagnostics,entryStartupPublicationInputs}=await import('./lib/reader-entry-diagnostics-probe.mjs');
 const launch=await import('../entry/src/main/ets/app/ReaderControlVerificationLaunch.ts');
 const file=new URL('../entry/src/main/ets/entryability/EntryAbility.ets',import.meta.url);
 const pending=new Promise(()=>{}),fields=['coldStartPage','windowStageGeneration','startupContent','runtimeOwner','themeReady','recoveryReady','bookshelfModeReady','shelfFontsReady','diagnostics','onCreate','onNewWant'];
 function create({debug=true,mode='debug',params={},throwLog=false}={}){
  const logs=[],wants=[];let runtimeInstall=0;
  const trace={mark(){},measure:(_stage,task)=>task()};
  const deps={...launch,DEBUG:debug,BUILD_MODE_NAME:mode,DOMAIN:0x5244,
   ReaderCrashEvidence:{install:()=>undefined},installMangaAtomicPayloadReader(){},
   ReaderStartupTrace:{install:()=>trace},readerMotionNowMs:()=>123,
   hilog:{info(...args){logs.push(args);if(throwLog&&args[2]?.startsWith('READER_COLD_ROUTE'))throw Error('finite log delivery failure');},error(){},warn(){}},
   readerEventLoopProbeEnabled:()=>false,AppStorage:{setOrCreate(){}},READER_REDUCE_MOTION_STORAGE_KEY:'reduce',READER_TRANSIENT_TOAST_STORAGE_KEY:'toast',READER_TRANSIENT_HOST_STORAGE_KEY:'host',createReaderTransientToastState:()=>({}),
   WebDavCredentialStore:{instance:{attachContext(){},loadBookshelfViewMode:()=>pending}},prepareReaderShelfFonts:()=>pending,
   ReaderMangaPlatformDiagnostic:{install:()=>undefined},ReaderRuntimeOwner:{install(){runtimeInstall++;return{start:()=>pending};}},
   ReaderThemeHost:{install:()=>pending,setRecoveryBarrier(){}},ConfigurationConstant:{ColorMode:{COLOR_MODE_DARK:1}},
   SyncGateway:class{},LocalConfigurationReset:{recover:()=>pending},ReaderSystemFileOpenHost:{install(){},receive:want=>wants.push(want)},
  };
  deps.ReaderEntryDiagnostics=productionEntryDiagnostics({hilog:deps.hilog,ReaderMangaPlatformDiagnostic:deps.ReaderMangaPlatformDiagnostic});
  Object.assign(deps,entryStartupPublicationInputs());
  const Ability=selectedProductionMethods(file,'EntryAbility',fields,deps),ability=new Ability();ability.context={filesDir:'unused-fixture',config:{colorMode:0}};
  const want={uri:'secret://URI_MUST_NOT_LEAK',parameters:{privateToken:'TOKEN_MUST_NOT_LEAK',sourceId:'ENTITY_MUST_NOT_LEAK',...params}};
  ability.onCreate(want,{});
  return{ability,want,wants,logs,runtimeInstall,records:logs.filter(x=>x[2]==='READER_COLD_ROUTE %{public}s').map(x=>JSON.parse(x[3]))};
 }
 const keys=['generatedDebug','generatedBuildMode','selectedPage','motionType','motionExactTrue','rendererType','rendererExactTrue','mainLoadFailureType','mainLoadFailureExactTrue'].sort();
 const cases=[
  [{},'pages/Index'],[{readerOpenSourcePilot:true},'pages/ReaderRendererPilot'],[{readerOpenSourcePilot:'true'},'pages/Index'],[{readerOpenSourcePilot:new Boolean(true)},'pages/Index'],[{readerOpenSourcePilot:{secret:'OBJECT_MUST_NOT_LEAK'}},'pages/Index'],
  [{readerControlMotionVerification:true},'pages/ReaderControlMotionVerification'],[{readerStartupMainLoadFailure:true},'pages/__ReaderStartupMainLoadFailure'],[{readerOpenSourcePilot:true,readerControlMotionVerification:true},'pages/Index'],[{readerOpenSourcePilot:true,readerStartupMainLoadFailure:true},'pages/Index'],
 ];
 for(const[params,page]of cases){const f=create({params});assert.equal(f.ability.coldStartPage,page);assert.equal(f.records.length,1);const r=f.records[0];assert.deepEqual(Object.keys(r).sort(),keys);assert.equal(r.generatedDebug,true);assert.equal(r.generatedBuildMode,'debug');assert.equal(r.selectedPage,page);
  for(const[name,key]of[['motion','readerControlMotionVerification'],['renderer','readerOpenSourcePilot'],['mainLoadFailure','readerStartupMainLoadFailure']]){assert.equal(r[name+'Type'],typeof params[key]);assert.equal(r[name+'ExactTrue'],params[key]===true);}
  const serialized=JSON.stringify(f.logs);for(const secret of['URI_MUST_NOT_LEAK','TOKEN_MUST_NOT_LEAK','ENTITY_MUST_NOT_LEAK','OBJECT_MUST_NOT_LEAK'])assert.equal(serialized.includes(secret),false);
  f.ability.onNewWant({parameters:{readerOpenSourcePilot:true}},{});assert.equal(f.records.length,1);assert.equal(f.logs.filter(x=>x[2]==='READER_COLD_ROUTE %{public}s').length,1,'warm Want emits no cold telemetry/reload');assert.equal(f.ability.coldStartPage,page);assert.equal(f.runtimeInstall,1);
 }
 for(const[debug,mode]of[[false,'debug'],[true,'release'],[true,'preview'],[1,'debug'],[true,'debug ']]){const f=create({debug,mode,params:{readerOpenSourcePilot:true}});assert.equal(f.records.length,0);assert.equal(f.ability.coldStartPage,'pages/Index');assert.equal(f.runtimeInstall,1);}
 const failedLog=create({params:{readerOpenSourcePilot:true},throwLog:true});assert.equal(failedLog.ability.coldStartPage,'pages/ReaderRendererPilot');assert.equal(failedLog.runtimeInstall,1,'log delivery failure cannot stop or change actual startup');
 recordContractCasePass('on-create-telemetry');
}
