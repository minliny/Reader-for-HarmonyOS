import {selectContractCases, recordContractCasePass} from './lib/contract-case-selection.mjs';
const definitions = {"explore-wire-admission": {"description": "真实Discover gateway分类/书籍wire解码与准入", "resources": []}};
for (const id of selectContractCases(definitions)) {
  await runSelectedCase(id);
  recordContractCasePass(id);
}
async function runSelectedCase(selectedCase) {
const {default: assert} = await import('node:assert/strict');
const {selectedProductionMethods} = await import('./lib/selected-production-methods.mjs');

const Gateway=selectedProductionMethods(new URL('../entry/src/main/ets/features/discover/DiscoverGateway.ts',import.meta.url),'DiscoverGateway',['loadExploreKinds','loadExplore','string']);
const calls=[];let payload;const gateway=Object.assign(new Gateway(),{runtimeOwner:{async request(...args){calls.push(args);return {data:payload};}}});
const current=()=>true;
payload={kinds:[{title:'分组',url:'  '},{title:'分类',url:'/category'},null]};let malformed;
assert.deepEqual(await gateway.loadExploreKinds('s',n=>malformed=n,current),[{title:'分类',url:'/category'}]);assert.equal(malformed,1);
assert.equal(calls.at(-1)[2].canDispatch,current);assert.equal(calls.at(-1)[2].canContinue,current);
payload={books:[{bookId:'b',title:'有效标题'},{bookId:'b',title:'重复'},{sourceId:'foreign',bookId:'x',title:'错书源'},{bookId:'n',name:'错误wire字段'}]};
assert.deepEqual(await gateway.loadExplore('s','/category',2,'manga',n=>malformed=n,current),[{sourceId:'s',bookId:'b',name:'有效标题',author:'',coverUrl:'',intro:'',category:'manga'}]);assert.equal(malformed,3);
assert.deepEqual(calls.at(-1).slice(0,2),['source.explore',{sourceId:'s',url:'/category',page:2}]);
const count=calls.length;for(const p of [0,-1,NaN,1.5,Number.MAX_SAFE_INTEGER+1])await assert.rejects(()=>gateway.loadExplore('s','/category',p));assert.equal(calls.length,count,'invalid pages never dispatch');
payload={books:{}};await assert.rejects(()=>gateway.loadExplore('s','/category',1));

}
