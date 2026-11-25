import {selectContractCases, recordContractCasePass} from './lib/contract-case-selection.mjs';
const definitions = {"readable-catalog-near-end": {"description": "实际阅读回执 Presentation 和 Prefetch Host 的 canonical near-end 准入", "resources": []}};
for (const id of selectContractCases(definitions)) {
  await runSelectedCase(id);
  recordContractCasePass(id);
}
async function runSelectedCase(selectedCase) {
const {default: assert} = await import('node:assert/strict');
const {readingPrefetchOwnerProbe} = await import('./lib/reading-prefetch-owner-probe.mjs');
const {bookshelfOperationClass} = await import('./lib/bookshelf-operation-owner-probe.mjs');
const {sameRemoteSessionEvidence} = await import('../entry/src/main/ets/features/reading/application/RemoteReadingEvidence.ts');

const boundaryRuntime={};
const {ReadingPrefetchHost}=readingPrefetchOwnerProbe(()=>boundaryRuntime);
const ReadingCommitPresentation=bookshelfOperationClass('features/reading/presentation/ReadingCommitPresentation.ets',
  'ReadingCommitPresentation',{Observed:value=>value,ReadingPrefetchHost,sameRemoteSessionEvidence});
const identity = {sourceId:'source',bookId:'book'};
const sparseCatalog = { identity, entries: [10, 20, 30, 40, 50, 60, 70].map((chapterIndex, position) =>
  ({ index: chapterIndex, url: position < 5 ? `https://source.invalid/${chapterIndex}` : '' })) };
let currentRuntime = boundaryRuntime;
const prefetch = ReadingPrefetchHost.forRuntime(boundaryRuntime);
const admitted = [];
prefetch.refreshNearEnd = (session,lease) => {
  assert.equal(session,sparseCatalog);
  assert.equal(lease.isCurrent(),true);
  admitted.push(session);
};
const commits = new ReadingCommitPresentation({entry:()=>({book:identity,session:sparseCatalog}),
  scene:()=>({owner:boundaryRuntime,retired:false,active:true,navigation:1,mounting:1}),
  ownsRuntime:owner=>owner===currentRuntime});
const nearEndAdmitted = chapterIndex => {
  const count = admitted.length;
  commits.refreshNearEnd(sparseCatalog,chapterIndex);
  return admitted.length === count + 1;
};
assert.equal(nearEndAdmitted(10), false,
  'four remaining readable chapters are outside the refresh boundary regardless of ordinal gaps');
for (const chapterIndex of [20, 30, 40, 50]) {
  assert.equal(nearEndAdmitted(chapterIndex), true,
    'the last three readable successors ignore trailing volume headings');
}
for (const chapterIndex of [60, 99]) assert.equal(nearEndAdmitted(chapterIndex), false);
currentRuntime=undefined;
assert.equal(nearEndAdmitted(40),false,'retired Runtime cannot admit refresh');

}
