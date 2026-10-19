import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';

export const CONTRACT_CASES = {
  "late-identity": {
    "description": "Actual Index onReadingFailure ignores stale source/book and retains owned reader/session",
    "resources": []
  },
  "retained-failure-owner": {
    "description": "Actual LRE.fail revokes asynchronous selection while retaining mount and recovery ownership; fake platform ports",
    "resources": []
  },
  "probe-chapter-context": {
    "description": "Actual Index and real session-evidence predicate forward exact chapter/context to current Host scope; body admission is separate coverage",
    "resources": []
  },
  "source-switch-route": {
    "description": "Actual Index source switch chooses mounted-reader owner or explicit detail fallback",
    "resources": []
  }
};

async function case_late_identity() {
const { default: assert } = await import('node:assert/strict');
const {productionMotionMethods} = await import('./lib/reader-motion-method-probe.mjs');
const indexFile=new URL('../entry/src/main/ets/pages/Index.ets',import.meta.url);
const Index=productionMotionMethods(indexFile,['onReadingFailure'],{hilog:{warn(){}},DOMAIN:0});
for(const active of [false,true])for(const sourceId of ['s','other'])for(const bookId of ['b','other']){
 const page=Object.assign(new Index(),{readingSessionActive:active,detailBook:{sourceId:'s',bookId:'b'},detailLoadingMessage:'old',detailCatalogBusy:true,route:'reading',remoteReadingSession:{kept:true}});
 const before=page.remoteReadingSession;page.onReadingFailure(sourceId,bookId,'target failed','SOURCE_HTTP_FAILED');
 const accepted=active&&sourceId==='s'&&bookId==='b';assert.equal(page.detailLoadingMessage,accepted?'target failed':'old');assert.equal(page.detailCatalogBusy,!accepted);
 assert.equal(page.readingSessionActive,active);assert.equal(page.route,'reading');assert.equal(page.remoteReadingSession,before,'failure retains mount/session, never compensates source switch');
}

}

async function case_retained_failure_owner() {
const { default: assert } = await import('node:assert/strict');
const {productionMotionMethods} = await import('./lib/reader-motion-method-probe.mjs');
const indexFile=new URL('../entry/src/main/ets/pages/Index.ets',import.meta.url);
const file=new URL('../entry/src/main/ets/features/reading/LocalReadingExperience.ets',import.meta.url);
const Reader=productionMotionMethods(file,['fail']);
for(const active of [false,true]){
 const events=[];const page=Object.assign(new Reader(),{isSessionActive:()=>active,pageTurnPreparation:undefined,previousChapterMeasurement:undefined,recoverControlSelectionFailure:()=>false,errorMessage:e=>e.message,chapterSelectionToken:4,mounted:true,exitRequested:false,sourceId:'s',bookId:'b',phase:'ready',autoPageCoordinator:{stop:why=>events.push(['stop',why])},nativeAlertOwner:{retire:()=>events.push('retire')},physicalPagination:{index:{invalidateMeasurement:()=>events.push('invalidate')}},onReadingFailure:(...args)=>events.push(['failure',...args]),beginExit:()=>assert.fail('failure cannot dispose recovery owner')});
 for(const name of ['finishPageTurnPerf','captureReadingRecordElapsed','clearReadingRecordTimer','clearAutoPageTimer','clearAutoPageSessionTimer','cancelMeasurementDeadline','cancelFirstPageReadyDeadline','cancelFirstPageCompletionDeadline','cancelPageTurnPreparationRetry','resetPaginationDraft'])page[name]=()=>events.push(name);
 page.fail(Error('BODY_FAILED'),1);assert.equal(page.phase,active?'failed':'ready');assert.equal(page.chapterSelectionToken,active?5:4);assert.equal(page.mounted,true);assert.equal(page.exitRequested,false);
 if(active){assert.equal(events.filter(e=>Array.isArray(e)&&e[0]==='failure').length,1);assert.ok(events.includes('invalidate'));}else assert.deepEqual(events,[]);
}

}

async function case_probe_chapter_context() {
const { default: assert } = await import('node:assert/strict');
const {productionMotionMethods} = await import('./lib/reader-motion-method-probe.mjs');
const indexFile=new URL('../entry/src/main/ets/pages/Index.ets',import.meta.url);
const {readFileSync}=await import('node:fs');
const {stripTypeScriptTypes}=await import('node:module');
const raw=readFileSync(new URL('../entry/src/main/ets/features/reading/RemoteReadingEvidence.ts',import.meta.url),'utf8');
const start=raw.indexOf('export function sameRemoteSessionEvidence('),end=raw.indexOf('/** A full refreshed catalog',start);
assert.ok(start>=0&&end>start);const sameRemoteSessionEvidence=new Function(stripTypeScriptTypes(raw.slice(start,end)).replace(/^export /,'')+';return sameRemoteSessionEvidence;')();
const Index=productionMotionMethods(indexFile,['probeRemoteContentVerdict'],{sameRemoteSessionEvidence});
const session={identity:{sourceId:'s',bookId:'b'},sourceVersion:'v1',catalogVersion:'c1',contextVersion:'x1',acquisitionMode:'online'};const context={bodyVersion:'body',processingVersion:'p',anchors:[{id:'a',offset:17}]};
for(const active of [false,true])for(const matching of [false,true])for(const scope of [8,9]){
 const calls=[];const page=Object.assign(new Index(),{readingEntryScopeId:8,remoteReadingSession:matching?session:{...session,identity:{sourceId:'other',bookId:'b'}},getReadingEntryHost:()=>({snapshot:()=>({scopeId:scope}),probe:(...args)=>{calls.push(args);return 324;}})});
 const result=await page.probeRemoteContentVerdict({},session,()=>active,324,context);const accepted=active&&matching&&scope===8;assert.equal(result,accepted?324:undefined);assert.deepEqual(calls,accepted?[[8,324,context]]:[],'actual Index forwards exact chapter/context only to current entry scope');
}

}

async function case_source_switch_route() {
const { default: assert } = await import('node:assert/strict');
const {productionMotionMethods} = await import('./lib/reader-motion-method-probe.mjs');
const indexFile=new URL('../entry/src/main/ets/pages/Index.ets',import.meta.url);
const Index=productionMotionMethods(indexFile,['openSourceSwitch'],{LOCAL_SOURCE_ID:'local'});
for(const reading of [false,true]){
 const calls=[];const host={open:(context,lease)=>calls.push(['open',context,lease])};const page=Object.assign(new Index(),{detailBook:{sourceId:'s',bookId:'b'},sourceSwitchVisible:false,readingSessionActive:reading,route:reading?'reading':'detail',getSourceSwitchHost:()=>host,nextNavigationGeneration:()=>calls.push('navigation'),bindReadingEntryReader:()=>calls.push('bind'),sourceSwitchContext:()=>({book:'b'}),sourceSwitchLease:()=>({scope:8}),returnToReadingOrigin:()=>calls.push('origin'),openDetailSourceSwitch:()=>calls.push('detail')});
 page.openSourceSwitch();assert.deepEqual(calls,reading?['navigation','bind',['open',{book:'b'},{scope:8}]]:['origin','detail']);if(reading)assert.equal(page.route,'reading');
}

}

const implementations = {'late-identity':case_late_identity,'retained-failure-owner':case_retained_failure_owner,'probe-chapter-context':case_probe_chapter_context,'source-switch-route':case_source_switch_route};
for (const id of selectContractCases(CONTRACT_CASES)) {
  await implementations[id]();
  recordContractCasePass(id);
}

export const coverageAdoption = [{target:'H-reader-recoverable-entry#failure-actions-input',protects:'Actual SDK retry/settings/source action callbacks and retained input arena'}];
