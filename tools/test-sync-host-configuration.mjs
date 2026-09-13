import { restoreReaderThemeSelection, migrateLegacyReaderThemeSelection } from '../entry/src/main/ets/features/common/ReaderThemeSelection.ts';
import assert from 'node:assert/strict';
import { productionMotionMethods } from './lib/reader-motion-method-probe.mjs';
const path=f=>new URL(`../entry/src/main/ets/${f}`,import.meta.url);
const copy=x=>JSON.parse(JSON.stringify(x));
const selected={version:1,appMode:'day',reader:{id:'day',scheme:'day'},defaultDayReaderId:'day',defaultNightReaderId:'night'};
let theme=copy(selected),mode='cover',failTheme=false,durableReads=0;
const store={loadBookshelfViewMode:async()=>mode,saveBookshelfViewMode:async x=>{mode=x;}};
const Host=productionMotionMethods(path('features/sync/SyncHostConfiguration.ts'),['capture','encode','decode','apply'],{
 restoreReaderThemeSelection, migrateLegacyReaderThemeSelection, WebDavCredentialStore:{instance:store},ReaderThemeHost:{durableBackup:async()=>{durableReads++;return copy(theme);},restore:async x=>{if(failTheme){failTheme=false;throw Error('flush');}theme=copy(x);return ''; }},AppStorage:{get:key=>key==='readerSystemScheme'?'night':'day',setOrCreate(){}}
});
const host=new Host(),prior=await host.capture(),next={version:1,bookshelfViewMode:'list',themeSelection:{...copy(selected),appMode:'night',reader:{id:'night',scheme:'night'}}};
assert.deepEqual(host.decode(host.encode(next)),next);assert.ok(durableReads>0);
const legacySelection={appThemeMode:'system',readerThemeId:'deleted-theme',defaultDayReaderThemeId:'warm',defaultNightReaderThemeId:'greenNight'};
const migratedHost=host.decode({version:1,bookshelfViewMode:'list',themeSelection:legacySelection});
assert.equal(migratedHost.themeSelection.reader.scheme,'night','Host legacy fallback uses actual system observation before effective app');
assert.equal(migratedHost.themeSelection.appMode,'system');
assert.ok(!JSON.stringify(host.encode(migratedHost)).includes('appThemeMode'),'writes use only canonical envelope');
const extra={...next,password:'secret',themeDefinitions:{ink:'#000'}};assert.equal(JSON.stringify(host.encode(extra)).includes('secret'),false);assert.equal(JSON.stringify(host.encode(extra)).includes('#000'),false);
await host.apply(next);assert.equal(mode,'list');assert.equal(theme.appMode,'night');
failTheme=true;await assert.rejects(host.apply(prior),/恢复失败/);assert.equal(mode,'list','theme flush failure compensates only acknowledged mode');assert.equal(theme.appMode,'night');

const Store=productionMotionMethods(path('features/sync/WebDavCredentialStore.ts'),['loadRestoreJournal','saveRestoreJournal','clearRestoreJournal','validateRestoreJournal'],{LOCAL_RESTORE_JOURNAL_KEY:'journal'});
const values=new Map();let failFlush=false;
const prefs={get:async(k,d)=>values.get(k)??d,put:async(k,v)=>values.set(k,v),delete:async k=>values.delete(k),flush:async()=>{if(failFlush){failFlush=false;throw Error('flush');}}};
const credentials=Object.assign(new Store(),{localModeWriteTail:Promise.resolve(),ensureLocalPreferences:async()=>prefs});
const journal={version:1,operationId:'operation-1',checksum:'a'.repeat(64)};
failFlush=true;await assert.rejects(credentials.saveRestoreJournal(journal),/flush/);assert.equal(await credentials.loadRestoreJournal(),undefined);
await credentials.saveRestoreJournal(journal);assert.deepEqual(await credentials.loadRestoreJournal(),journal);
await assert.rejects(credentials.saveRestoreJournal({...journal,operationId:'operation-2'}),/上一次恢复/);
await assert.rejects(credentials.clearRestoreJournal('wrong'),/替换/);
failFlush=true;await assert.rejects(credentials.clearRestoreJournal(journal.operationId),/flush/);assert.deepEqual(await credentials.loadRestoreJournal(),journal);
await credentials.clearRestoreJournal(journal.operationId);assert.equal(await credentials.loadRestoreJournal(),undefined);
const Gateway=productionMotionMethods(path('features/sync/SyncGateway.ts'),['recoverInterruptedRestore','recoverRestoreJournal','driveTransaction','assertTransactionIdentity'],{MAX_TRANSACTION_STEPS:30,SyncGateway:{restoreRecoveries:new Map()}});
function gatewayFixture({receipt=false,hostConfig=true,failApplyResponse=false,failCommitResponse=false,failHost=false}={}){
 let applied=receipt,coreApplications=0,themeApplications=0,commits=0,queries=0,record;
 let pending=copy(journal);let hostFailed=failHost,commitFailed=failCommitResponse;
 const g=Object.assign(new Gateway(),{credentials:{loadRestoreJournal:async()=>pending,saveRestoreJournal:async x=>{pending=x;},clearRestoreJournal:async id=>{assert.equal(pending?.operationId,id);pending=undefined;}},
 hostConfiguration:{decode:x=>x,apply:async x=>{themeApplications++;if(hostFailed){hostFailed=false;throw Error('host flush');}assert.deepEqual(x,next);}},
 requireObject:x=>x,decodeTransaction:x=>x,abortBestEffort:async()=>true,
 runtimeOwner:{request:async(name,params)=>{
   if(name==='runtime.storage.apply'){assert.ok(pending,'durable Host journal precedes Core mutation');coreApplications++;applied=true;record=copy(next);if(failApplyResponse)throw Error('lost apply response');return{data:{manifest:{checksum:'b'.repeat(64)}}};}
   if(name==='runtime.storage.flush')return{data:{stored:true}};
   assert.equal(name,'sync.webdav.transaction.commit');
   if(params.queryOnly){queries++;return{data:{transactionId:journal.operationId,status:'completed',phase:applied?'restoreReceiptPresent':'restoreReceiptMissing',hostConfig:applied&&hostConfig?copy(next):undefined}};}
   commits++;assert.ok(applied);assert.equal(params.hostConfigApplied,hostConfig);if(commitFailed){commitFailed=false;throw Error('lost commit response');}
   return{data:{transactionId:journal.operationId,status:'completed',phase:'restoreCompleted'}};
 }}});
 return {g,stats:()=>({applied,coreApplications,themeApplications,commits,queries,pending,record})};
}
{
 const t=gatewayFixture();assert.equal(await t.g.recoverInterruptedRestore(),false);assert.equal(t.stats().pending,undefined);assert.equal(t.stats().themeApplications,0,'no receipt proves no Core apply and causes no Host mutation');
}
{
 const t=gatewayFixture({receipt:true});assert.equal(await t.g.recoverInterruptedRestore(),true);assert.equal(t.stats().coreApplications,0,'restart finishes only Host portion and never overwrites progress');assert.equal(t.stats().themeApplications,1);assert.equal(t.stats().pending,undefined);
}
{
 const t=gatewayFixture({receipt:true,hostConfig:false});assert.equal(await t.g.recoverInterruptedRestore(),true);assert.equal(t.stats().themeApplications,0,'old backup leaves existing theme and mode intact');
}
{
 const t=gatewayFixture({receipt:true,failHost:true});await assert.rejects(t.g.recoverInterruptedRestore(),/host flush/);assert.ok(t.stats().pending,'failure preserves recovery ownership');assert.equal(await t.g.recoverInterruptedRestore(),true);assert.equal(t.stats().pending,undefined);
}
for(const failure of [{},{failApplyResponse:true},{failCommitResponse:true},{failHost:true}]){
 const t=gatewayFixture(failure);
 const initial={transactionId:journal.operationId,status:'applyRequired',phase:'restoreApply',requests:[],storageApply:{manifest:{checksum:journal.checksum},payload:'opaque-Core-snapshot'},hostConfig:copy(next)};
 const done=await t.g.driveTransaction(initial);assert.equal(done.status,'completed');assert.equal(t.stats().coreApplications,1,'lost replies recover by receipt, never replay storage apply');assert.equal(t.stats().pending,undefined);
}
console.log('PASS WebDAV Host production recovery: durable choices, allow-list, compensated flush, journal ownership, crash boundary, old backup, lost apply/commit response and idempotent completion');
{
 const t=gatewayFixture({receipt:true});const other=Object.assign(new Gateway(),t.g);
 const startup=t.g.recoverInterruptedRestore(),page=other.recoverInterruptedRestore();
 assert.equal(startup,page,'separate gateways for the same runtime join one recovery');
 await Promise.all([startup,page]);assert.equal(t.stats().queries,1);assert.equal(t.stats().themeApplications,1);
}

{
 const forged=copy(next);forged.themeSelection.reader={id:'day',scheme:'night'};
 assert.throws(()=>host.decode(host.encode(forged)),/SCHEME_MISMATCH/);
 const unknown=copy(next);unknown.themeSelection.reader={id:'theme-no-longer-installed',scheme:'night'};
 assert.doesNotThrow(()=>host.decode(host.encode(unknown)));
 const t=gatewayFixture();t.g.hostConfiguration.decode=()=>{throw Error('SCHEME_MISMATCH');};
 await assert.rejects(t.g.driveTransaction({transactionId:journal.operationId,status:'applyRequired',requests:[],
   storageApply:{manifest:{checksum:journal.checksum},payload:'opaque'},hostConfig:forged}),/SCHEME_MISMATCH/);
 assert.equal(t.stats().coreApplications,0,'catalog/declared scheme must validate before Core apply');
 assert.equal(t.stats().themeApplications,0);
}
{
 const diagnostics=new Map();let params,barrier=0;
 const Start=productionMotionMethods(path('features/sync/SyncGateway.ts'),['startTransaction','decodeTransaction'],{
   MAX_TRANSACTION_REQUESTS:100,ReaderThemeHost:{prepareUserChange:async()=>{barrier++;},observedSystemScheme:()=> 'night'},
   AppStorage:{setOrCreate:(k,v)=>diagnostics.set(k,v)},
 });
 const start=Object.assign(new Start(),{recoverInterruptedRestore:async()=>false,authorization:()=>undefined,
   hostConfiguration:{capture:async()=>prior,encode:x=>host.encode(x)},runtimeOwner:{request:async(_name,p)=>{params=p;return{data:{transactionId:'migrate-1',status:'conflict',phase:'restoreConflict',requests:[],themeMigrationReason:'legacy-unknown-reader:system:night'}};}}});
 await start.startTransaction('restore',{url:'https://example.invalid',directory:'/backup',backupPassword:'not-a-real-secret'},true);
 assert.equal(barrier,1);assert.equal(params.systemScheme,'night');assert.equal(params.hostConfig.themeSelection.reader.scheme,'day','system observation is independent from selected reading scheme');
 assert.ok(!('systemScheme' in params.hostConfig));assert.ok(!('themeMigrationReason' in params.hostConfig));
 assert.equal(diagnostics.get('readerThemeRestoreFallback'),'legacy-unknown-reader:system:night');
}
