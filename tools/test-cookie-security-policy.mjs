import {selectContractCases, recordContractCasePass} from './lib/contract-case-selection.mjs';
const definitions = {"cookie-policy-and-journal": {"description": "实际exact-host/HttpOnly与损坏journal归属恢复", "resources": []}};
for (const id of selectContractCases(definitions)) {
  await runSelectedCase(id);
  recordContractCasePass(id);
}
async function runSelectedCase(selectedCase) {
const {default: assert} = await import('node:assert/strict');

const { readFileSync } = await import('node:fs');
const {
  isCookieVisibleToScript,
  isExactCookieDomainScope,
} = await import('../entry/src/main/ets/app/CookieSecurityPolicy.ts');
assert.equal(isExactCookieDomainScope('login.example.com', 'login.example.com'), true);
for (const scope of ['example.com', 'com', 'co.uk', 'other.example']) {
  assert.equal(isExactCookieDomainScope('login.example.com', scope), false,
    `source cookies must not expand from login.example.com to ${scope}`);
}
assert.equal(isCookieVisibleToScript(false), true);
assert.equal(isCookieVisibleToScript(true), false);


const {selectedProductionMethods,selectedProductionValues}=await import('./lib/selected-production-methods.mjs');
const file=new URL('../entry/src/main/ets/app/CookieSessionStore.ts',import.meta.url),constants=selectedProductionValues(file,['LOG_DOMAIN','LOG_TAG','ASSET_ALIAS','ASSET_PENDING_ALIAS','ASSET_CHUNK_ALIAS_PREFIX','ASSET_SECRET_CHUNK_BYTES','MAX_PERSISTED_BYTES','MAX_PERSISTED_CHUNKS']);
const util={TextDecoder:{create:(_encoding,options)=>({decodeToString:bytes=>new TextDecoder('utf-8',options).decode(bytes)})},TextEncoder:class{encode(value){return new TextEncoder().encode(value);}}};
const Host=selectedProductionMethods(file,'CookieSessionStore',['recoverPendingWrite','parseChunkHeader','chunkAlias','utf8','readChunkedPayload'],{...constants,util,hilog:{warn(){}}});
const encode=value=>new TextEncoder().encode(typeof value==='string'?value:JSON.stringify(value));
const header=generation=>({formatVersion:2,chunkCount:2,generation});
for(const journal of ['{',null,{next:null,previous:null},{next:[],previous:null},{next:{},previous:null}]) {
 const removed=[],owner=Object.assign(new Host(),{readRecordSecret:async()=>encode(journal),removeRecord:async alias=>removed.push(alias)});
 await owner.recoverPendingWrite();assert.deepEqual(removed,[constants.ASSET_PENDING_ALIAS],'malformed journal cannot claim any chunk ownership');
}
for(const committed of [false,true]) {
 const old=header('old-generation'),next=header('new-generation'),removed=[];
 const owner=Object.assign(new Host(),{readRecordSecret:async alias=>encode(alias===constants.ASSET_PENDING_ALIAS?{next,previous:old}:committed?next:old),removeRecord:async alias=>removed.push(alias)});
 await owner.recoverPendingWrite();const garbage=committed?'old-generation':'new-generation';
 assert.deepEqual(removed,[owner.chunkAlias(0,garbage),owner.chunkAlias(1,garbage),constants.ASSET_PENDING_ALIAS]);
}
const bounded=new Host();let reads=0;bounded.readRecordSecret=async()=>{reads++;return new Uint8Array(constants.ASSET_SECRET_CHUNK_BYTES+1);};
assert.equal(await bounded.readChunkedPayload(3,'new-generation'),null);assert.equal(reads,1,'oversized part rejected before aggregate allocation/remaining reads');

}
