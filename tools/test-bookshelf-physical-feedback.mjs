import {selectContractCases, recordContractCasePass} from './lib/contract-case-selection.mjs';
const definitions = {"projection": {"description": "实际format/default-group纯业务投影", "resources": []}};
for (const id of selectContractCases(definitions)) {
  await runSelectedCase(id);
  recordContractCasePass(id);
}
async function runSelectedCase(selectedCase) {

const {default:assert}=await import('node:assert/strict');
const {ShelfBookPresentation:Projection}=await import('../entry/src/main/ets/features/bookshelf/ShelfBookPresentation.ts');
for(const kind of ['local','txt','TXT']) {const book=Object.freeze({sourceId:'local',kind});assert.equal(Projection.source(book),'本地 TXT');assert.equal(book.kind,kind);}
assert.equal(Projection.source({sourceId:'local',kind:'EPUB'}),'本地 EPUB');assert.equal(Projection.source({sourceId:'local'}),'本地书');
const rows=[undefined,'','默认','历史分组'].map((group,i)=>Object.freeze({sourceId:'local',bookId:`b${i}`,group}));
assert.deepEqual(Projection.visible(rows,'默认'),rows.slice(0,3));assert.deepEqual(Projection.visible(rows,'历史分组'),rows.slice(3));assert.deepEqual(Projection.visible(rows,''),rows);assert.equal(rows[3].group,'历史分组');

}
