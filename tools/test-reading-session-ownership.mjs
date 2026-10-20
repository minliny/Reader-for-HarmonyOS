import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
import {selectContractCases,recordContractCasePass} from './lib/contract-case-selection.mjs';
registerHooks({resolve(s,c,n){try{return n(s,c);}catch(e){if(s.startsWith('.')&&!s.endsWith('.ts'))return n(s+'.ts',c);throw e;}}});
async function run(id){
 const {ReadingSessionFlowGateway}=id==='measurement-token'?{}:await import('../entry/src/main/ets/features/reading/ReadingSessionFlowGateway.ts');
 const {ReadingPaginationIndex}=id==='measurement-token'?await import('../entry/src/main/ets/features/reading/ReadingPaginationIndex.ts'):{};
 const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return{resolve,promise};};
 const remote={identity:{sourceId:'source',bookId:'book'},acquisitionMode:'offline'},seed={sourceId:'source',bookId:'book',detailUrl:'/book'};
 const cases={
'late-transaction':async()=>{
  const events = [], admission = deferred(), transaction = deferred(); let current = true;
  const runtime = { request() { throw Error('open must not read body or progress'); },
    bookAcquisitions: () => ({ acquireBookWithBackgroundRefresh(actual, options) {
      assert.equal(actual, seed); assert.equal(options.isCurrent(), true); events.push('acquire'); return admission.promise;
    } }) };
  const open = ReadingSessionFlowGateway.open({ sourceId: 'source', bookId: 'book', remoteBookSeed: seed,
    isCurrent: () => current, onRemoteSessionReady: session => { assert.equal(session, remote); events.push('admitted'); },
    resolveSourceSwitchTransactionId: () => { events.push('transaction'); return transaction.promise; } }, runtime);
  assert.deepEqual(events, ['acquire']); admission.resolve({ session: remote });
  await Promise.resolve(); await Promise.resolve(); assert.deepEqual(events, ['acquire', 'admitted', 'transaction']);
  current = false; transaction.resolve('switch-id'); assert.equal(await open, undefined, 'late transaction cannot install an obsolete session');
},
'late-acquisition':async()=>{
  const admission = deferred(); let current = true, publications = 0;
  const task = ReadingSessionFlowGateway.open({ sourceId: 'source', bookId: 'book', remoteBookSeed: seed,
    isCurrent: () => current, onRemoteSessionReady: () => publications++,
    resolveSourceSwitchTransactionId: async () => { throw Error('cancelled acquisition cannot resolve transaction'); } },
  { bookAcquisitions: () => ({ acquireBookWithBackgroundRefresh: () => admission.promise }) });
  current = false; admission.resolve({ session: remote });
  assert.equal(await task, undefined); assert.equal(publications, 0);
},
'prepared-local-identity':async()=>{
  const runtime = { request() { throw Error('prepared admission requires no Core preflight'); },
    bookAcquisitions() { throw Error('prepared admission requires no second acquisition'); } };
  const flow = await ReadingSessionFlowGateway.open({ sourceId: 'source', bookId: 'book', remoteSession: remote,
    sourceSwitchTransactionId: 'switch', isCurrent: () => true, onRemoteSessionReady() {},
    resolveSourceSwitchTransactionId: async () => { throw Error('explicit transaction already owns the switch'); } }, runtime);
  assert.equal(flow.remoteSession(), remote); assert.equal(flow.supportsExactContentMetrics(), false);
  const local = await ReadingSessionFlowGateway.open({ sourceId: 'local', bookId: 'local-book', isCurrent: () => true,
    onRemoteSessionReady() { throw Error('local has no remote publication'); },
    resolveSourceSwitchTransactionId: async () => { throw Error('local never resolves remote transactions'); } }, runtime);
  assert.equal(local.remoteSession(), undefined); assert.equal(local.supportsExactContentMetrics(), true);
  await assert.rejects(ReadingSessionFlowGateway.open({ sourceId: 'wrong', bookId: 'book', remoteSession: remote,
    isCurrent: () => true, onRemoteSessionReady() { throw Error('wrong identity must not publish'); } }, runtime), /IDENTITY_MISMATCH/);
},
'measurement-token':async()=>{
  const index = new ReadingPaginationIndex();
  const oldFont = index.beginMeasurement(3); assert.equal(index.isMeasurementCurrent(oldFont, 3), true);
  const newFont = index.beginMeasurement(3); assert.equal(index.isMeasurementCurrent(oldFont, 3), false);
  assert.equal(index.isMeasurementCurrent(newFont, 3), true);
  index.invalidateMeasurement(); assert.equal(index.measurementSelection(), -1);
  assert.equal(index.isMeasurementCurrent(newFont, 3), false);
  const otherChapter = index.beginMeasurement(4);
  assert.equal(index.isMeasurementCurrent(otherChapter, 3), false);
  index.finishMeasurement(); assert.equal(index.isMeasurementCurrent(otherChapter, 4), false);
},
};await cases[id]();}
for(const id of selectContractCases({'late-transaction':'Actual post-transaction current intent guard','late-acquisition':'Actual acquisition retirement prevents publication','prepared-local-identity':'Prepared/local exact identity no second acquisition','measurement-token':'Pure pagination measurement generation/font/chapter retirement'})){await run(id);recordContractCasePass(id);}
