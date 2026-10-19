import {selectContractCases, recordContractCasePass} from './lib/contract-case-selection.mjs';
const definitions = {"registration-identity": {"description": "有限producer登记唯一性/定义存在", "resources": []}};
for (const id of selectContractCases(definitions)) {
  await runSelectedCase(id);
  recordContractCasePass(id);
}
async function runSelectedCase(selectedCase) {
const {default: assert} = await import('node:assert/strict');
const {readFileSync,existsSync} = await import('node:fs');

const contract=JSON.parse(readFileSync(new URL('./fixtures/architecture-shared-producers.json',import.meta.url),'utf8'));
for(const field of ['id','component','file']) assert.equal(new Set(contract.producers.map(p=>p[field])).size,contract.producers.length,'duplicate registration '+field);
for(const producer of contract.producers) {
 assert.ok(existsSync(new URL('../'+producer.file,import.meta.url)),'registered producer definition exists');
 assert.ok(producer.component && producer.id && producer.specPolicy,'registration names its finite responsibility');
}
const duplicate=structuredClone(contract);duplicate.producers.push(duplicate.producers[0]);
assert.throws(()=>assert.equal(new Set(duplicate.producers.map(p=>p.id)).size,duplicate.producers.length),'duplicate ID is rejected independent of historical counts');

}
