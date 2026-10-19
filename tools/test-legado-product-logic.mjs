import {selectContractCases, recordContractCasePass} from './lib/contract-case-selection.mjs';
const definitions = {"readable-catalog-near-end": {"description": "实际Index→原prefetch owner canonical near-end准入", "resources": []}};
for (const id of selectContractCases(definitions)) {
  await runSelectedCase(id);
  recordContractCasePass(id);
}
async function runSelectedCase(selectedCase) {
const {default: assert} = await import('node:assert/strict');
const {readingPrefetchOwnerProbe} = await import('./lib/reading-prefetch-owner-probe.mjs');
const {selectedProductionMethods} = await import('./lib/selected-production-methods.mjs');

const boundaryRuntime={};
const boundaryProbe=readingPrefetchOwnerProbe(()=>boundaryRuntime);
const CatalogBoundary=selectedProductionMethods(new URL('../entry/src/main/ets/pages/Index.ets',import.meta.url),'Index',['isRemoteCatalogNearEnd'],boundaryProbe);
const catalogBoundary = Object.assign(new CatalogBoundary(),{mountedRuntimeOwner:boundaryRuntime,isCurrentRuntime:o=>o===boundaryRuntime});
const sparseCatalog = { entries: [10, 20, 30, 40, 50, 60, 70].map((chapterIndex, position) =>
  ({ index: chapterIndex, url: position < 5 ? `https://source.invalid/${chapterIndex}` : '' })) };
assert.equal(catalogBoundary.isRemoteCatalogNearEnd(sparseCatalog, 10), false,
  'four remaining readable chapters are outside the refresh boundary regardless of ordinal gaps');
for (const chapterIndex of [20, 30, 40, 50]) {
  assert.equal(catalogBoundary.isRemoteCatalogNearEnd(sparseCatalog, chapterIndex), true,
    'the last three readable successors ignore trailing volume headings');
}
for (const chapterIndex of [60, 99]) assert.equal(catalogBoundary.isRemoteCatalogNearEnd(sparseCatalog, chapterIndex), false);
catalogBoundary.isCurrentRuntime=()=>false;assert.equal(catalogBoundary.isRemoteCatalogNearEnd(sparseCatalog,40),false,'retired Runtime cannot admit refresh');

}
