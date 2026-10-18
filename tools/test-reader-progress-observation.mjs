import { withReaderProgressProducerFixture } from './lib/reader-progress-producer-fixture.mjs';
import assert from 'node:assert/strict';
import { productionMotionMethods } from './lib/reader-motion-method-probe.mjs';
import { observeReaderProgressOperation, reconcileReaderControlSelectionProgress } from '../entry/src/main/ets/features/reading/ReaderControlSelectionTransaction.ts';
import { readerPageRecoveryDependencies, readerPageRecoveryPorts } from './lib/reader-page-recovery-fixture.mjs';
const observe = operation => observeReaderProgressOperation(operation, 5);
let release;
const pending = new Promise(resolve => { release = resolve; });
assert.equal(await observe(pending), 'unknown', 'a never-returning operation cannot make UI await forever');
let reads = 0;
const unavailable = await reconcileReaderControlSelectionProgress({ isCurrent: () => true,
  runSerial: async action => { await pending; await action(); }, readProgress: async () => { reads++; }, observationTimeoutMs: 5 });
assert.equal(unavailable.errorCode, 'READING_PROGRESS_RECONCILIATION_UNKNOWN');
release(); await new Promise(r => setImmediate(r));
assert.equal(reads, 0, 'an expired queued query is inert without releasing or overtaking the actual write');

const file = new URL('../entry/src/main/ets/features/reading/LocalReadingExperience.ets', import.meta.url);
class Anchor { constructor(chapterIndex, chapterOffset, chapterProgress) { Object.assign(this, { chapterIndex, chapterOffset, chapterProgress }); } }
const Page = productionMotionMethods(file, ['beginPreparedPageTurnPersistence', 'admitPageTurnPersistenceOutcome',
  'canPresentOrdinaryPage', 'persistPreparedPageTurn', 'isPreparedPageTurnCommitCurrent', 'invalidatePageTurnRuntime'],
  { ...readerPageRecoveryDependencies, CoreReadingAnchor: Anchor, observeReaderProgressOperation: observe, hilog: {warn(){},error(){}} });
let completeWrite, completed = 0, dialogs = 0, handoffs = 0;
const write = new Promise(resolve => { completeWrite = resolve; });
const prepared={context:{chapter:{chapterIndex:2,chapterTitle:'two'},layoutMap:{scalarCount:()=>100}},page:{startScalar:40}};
const origin={startScalar:10};
const retainedNotice=Object.freeze({message:'用户主动操作尚未完成',visible:true,canRetry:true,generation:8});
const page = readerPageRecoveryPorts(Object.assign(new Page(), { readerRecoveryView:retainedNotice,mounted:true,lifecycleToken:1,chapterSelectionToken:1,pageTurnSettlementGeneration: 7, pageTurnCommitStarted: false,
  bookTurnSurfaceGeneration:7,pageTurnRenderRevision:1,pageTurnSettlingPrepared:prepared,pageTurnInputOwned:true,
  pageTurnSettlementActive:true,visiblePage:origin,phase:'ready',bookId:'b',coreLayout:()=>({}),isPreparedPageTurnFresh:()=>true,
  activeGateway:()=>({canPersistPresentedProgress:()=>false,hasPendingSourceSwitch:()=>false,
    handoffPendingProgress(){handoffs++;},persistPresentedProgress:()=>write}),
  cancelPageTurnSettlementDeadline() {}, getUIContext: () => ({ showAlertDialog: () => dialogs++ }),
  finishPreparedPageTurnSettlement() { completed++; } }));
page.beginPreparedPageTurnPersistence(prepared, 1, 7);
await new Promise(r => setTimeout(r, 12));
assert.equal(page.pageTurnPersistenceState, 'idle'); assert.equal(dialogs, 0); assert.equal(completed, 0);
assert.equal(handoffs,1);assert.equal(page.pageTurnInputOwned,false);assert.equal(page.visiblePage,origin);
assert.equal(page.readerRecoveryView,retainedNotice,'background receipt observation preserves user-operation feedback');
page.commitInFlight=true;page.progressCommitGeneration++;
completeWrite({bookId:'b',chapterIndex:2,chapterOffset:40}); await new Promise(r => setImmediate(r));
assert.equal(completed, 0,'the actual late write cannot promote its retired candidate');
assert.equal(page.commitInFlight,true,'the old production finally cannot release a newer progress owner');
assert.equal(page.pageTurnPersistenceState, 'idle');
page.admitPageTurnPersistenceOutcome(prepared, 1, 7, true); assert.equal(completed, 0);

for (const kind of ['ordinary','unchanged-migration','source-switch','control','migrated','legacy']) {
  const calls=[];
  const chapter={chapterIndex:2,...(kind==='migrated'?{positionMigration:{status:'migrated'}}:
    kind==='unchanged-migration'?{positionMigration:{status:'unchanged'}}:{})};
  const owner=Object.assign(new Page(),{mounted:true,lifecycleToken:1,chapterSelectionToken:1,pageTurnSettlementGeneration:8,pageTurnCommitStarted:false,
    sourceSwitchTransactionId:kind==='source-switch'?'transaction':undefined,
    pendingControlSelection:kind==='control'?{selectionToken:1}:undefined,
    activeGateway:()=>({canPersistPresentedProgress:()=>kind!=='legacy'}),isPreparedPageTurnCommitCurrent:()=>true,
    persistPresentedPageTurn(){calls.push('ordinary-save');return new Promise(()=>{});},
    persistPreparedPageTurn(){calls.push('strong-save');return Promise.resolve(true);},
    finishPreparedPageTurnSettlement(_generation,presented=false){calls.push(presented?'presented':'durable');},
    cancelPageTurnSettlementDeadline(){},getUIContext:()=>({showAlertDialog(){calls.push('dialog');}})});
  owner.beginPreparedPageTurnPersistence({context:{chapter}},1,8);
  await new Promise(r=>setImmediate(r));
  assert.deepEqual(calls,['ordinary','unchanged-migration'].includes(kind)?['ordinary-save','presented']:['strong-save','durable'],kind);
  if(kind==='ordinary')assert.equal(owner.pageTurnPersistenceState,'queued','pending CAS save is not mislabeled durable');
}

const Continuous = withReaderProgressProducerFixture(productionMotionMethods(file, ['commitContinuousProgress'],
  { CoreReadingAnchor: Anchor, hilog: { error() {} }, observeReaderProgressOperation: observe, reconcileReaderControlSelectionProgress }));
function continuous(gateway) {
  const subject = Object.assign(new Continuous(), { phase: 'ready', chapter: { chapterIndex: 2, chapterTitle: 'two' },
    chapterLayoutMap: { scalarCount: () => 100 }, chapterSelectionToken: 1, materializedChapterSelectionToken: 1,
    sourceId: 's', bookId: 'b', readerSettingsSnapshot: { navigationMode: 'continuous' }, continuousFragments: [{}],
    continuousVisibleScalar: 10, continuousProgressRevision: 1, continuousCommitPending: false,
    isMountedToken: () => true, coreLayout: () => ({}), onAutoPagePageCommitted() {}, drainRapidPageTurn() {},
    admitCommittedProgress(value) { this.lastCommittedProgress = value; }, errorMessage: e => e.message,
    activeGateway: () => gateway });
  const capture = subject.continuousProgressDependencies.bind(subject);
  subject.continuousProgressDependencies = lifecycle => ({ ...capture(lifecycle), observationTimeoutMs: 5 });
  return subject;
}
{
  let releaseWrite, writes = 0;
  const realWrite = new Promise(resolve => { releaseWrite = resolve; });
  const c = continuous({ runProgressCommitSerial: op => op(), resolveAndUpdateProgress: async (_b, _t, anchor) => {
    writes++; await realWrite; return { ...anchor, sourceId: 's', bookId: 'b' };
  } });
  await assert.rejects(c.commitContinuousProgress(1), /UNKNOWN/);
  assert.equal(c.continuousCommitInFlight, true, 'deadline retains the actual single drain');
  c.continuousVisibleScalar = 60; c.continuousProgressRevision++;
  await assert.rejects(c.commitContinuousProgress(1), /UNKNOWN/); assert.equal(writes, 1);
  releaseWrite(); await new Promise(r => setImmediate(r));
  assert.equal(writes, 2); assert.equal(c.lastCommittedProgress.chapterOffset, 60);
  assert.equal(c.continuousCommitInFlight, false);
}
for (const mode of ['unavailable', 'foreign']) {
  let writes = 0, reads = 0;
  const c = continuous({ runProgressCommitSerial: op => op(), resolveAndUpdateProgress: async () => { writes++; throw Error('reply lost'); },
    loadProgress: async () => { reads++; if (reads === 1) return {kind:'missing'};
      if (mode === 'unavailable') throw Error('read failed');
      return { kind: 'restored', progressRevision: 'foreign-operation:2',
        progress: { bookId: 'b', chapterIndex: 8, chapterOffset: 90, updatedAt: 2 } }; } });
  await assert.rejects(c.commitContinuousProgress(1), /UNKNOWN|FOREIGN/);
  await assert.rejects(c.commitContinuousProgress(1), /UNKNOWN|FOREIGN/);
  assert.equal(writes, 1, 'retry reads authority instead of repeating the unknown write');
  assert.ok(reads >= 3, 'the real owner reads a baseline and retries unknown authority without dispatching');
}
console.log('production finite unknown observation, queued query expiry, late durable and continuous single drain: PASS');
