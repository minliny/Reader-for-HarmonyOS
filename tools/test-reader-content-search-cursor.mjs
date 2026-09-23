import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { ReaderContentSearchPublication } from './lib/reader-content-search-owner-probe.mjs';
import { decodeRemotePositionScope } from '../entry/src/main/ets/features/reading/RemoteReadingPositionMigration.ts';
import { classifyRemoteReadingCommandFailure } from '../entry/src/main/ets/features/reading/RemoteReadingContract.ts';

const source = readFileSync(new URL('../entry/src/main/ets/features/reading/ReadingSessionFlowGateway.ts', import.meta.url), 'utf8');
const Gateway = new Function('decodeRemotePositionScope', 'classifyRemoteReadingCommandFailure',
  stripTypeScriptTypes(source.replace(/^import[\s\S]*?;\n/gm, '')).replace(/^export /gm, '') + ';return ReadingSessionFlowGateway;')(
  decodeRemotePositionScope, classifyRemoteReadingCommandFailure);
const calls = [], gateway = Object.create(Gateway.prototype);
Object.assign(gateway, {sourceId:'s',bookId:'b'});
let capability = false, receipt = {results:[],hasMore:false};
gateway.runtimeOwner = {supportsCoreCapability: () => capability, async request(method, params, options) {
  calls.push({method,params,options});return {data:receipt};
}};
await gateway.searchContentPage('b','词',50);
assert.deepEqual(calls.at(-1).params,{keyword:'词',sourceId:'s',bookId:'b',maxResults:50});
await gateway.searchContentPage('b','词',50,50);
assert.equal(calls.at(-1).params.offset,50);
const count=calls.length;
await gateway.closeContentSearch('token:1');assert.equal(calls.length,count);
capability=true;receipt={results:[],hasMore:true,nextCursor:'token:1'};
assert.equal((await gateway.searchContentPage('b','词',50)).nextCursor,'token:1');
assert.equal(calls.at(-1).params.useCursor,true);
await gateway.searchContentPage('b','词',50,50,()=>true,'token:1');
assert.equal(calls.at(-1).params.cursor,'token:1');assert.equal(calls.at(-1).params.offset,undefined);
await gateway.searchContent('b','词',50);await Promise.resolve();
assert.equal(calls.at(-1).params.closeCursor,true,'one-shot convenience consumer must close its retained continuation');
await gateway.closeContentSearch('token:1');assert.equal(calls.at(-1).options.timeoutMs,5000);

const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return{promise,resolve,reject};};
const settle=async()=>{for(let i=0;i<6;i++)await Promise.resolve();};
const owner=new ReaderContentSearchPublication(),pending=[],closed=[];
const fake={searchContentPage(...args){const next=deferred();pending.push({args,...next});return next.promise;},
  async closeContentSearch(token){closed.push(token);}};
let active=true,changes=0;
const run=keyword=>owner.run(fake,'b',keyword,2,()=>active,()=>changes++);
const row=n=>({sourceId:'s',bookId:'b',chapterIndex:0,chapterOffset:n,chapterTitle:'章',bookName:'书',matchLength:1,snippetStart:0,snippet:'词'});
run('旧');run('新');pending[0].resolve({results:[row(1)],hasMore:true,nextCursor:'old:1'});await settle();
assert.ok(closed.includes('old:1'));assert.equal(owner.stateAt(0).kind,'loading');
pending[1].resolve({results:[row(2)],hasMore:true,nextCursor:'new:1'});await settle();
owner.more('b',2,()=>active,()=>changes++);owner.more('b',2,()=>active,()=>changes++);
assert.equal(pending.length,3,'only one continuation can be in flight');
assert.equal(pending[2].args[5],'new:1');
pending[2].resolve({results:[row(2),row(3)],hasMore:false});await settle();
assert.deepEqual(owner.stateAt(0).results.map(row=>row.chapterOffset),[2,3]);assert.ok(closed.includes('new:1'));
run('失败');pending[3].resolve({results:[row(4)],hasMore:true,nextCursor:'failed:1'});await settle();
owner.more('b',2,()=>active,()=>changes++);pending[4].reject(new Error('快照已失效'));await settle();
assert.equal(owner.stateAt(0).results[0].chapterOffset,4);assert.equal(owner.stateAt(0).hasMore,false);
assert.equal(owner.stateAt(0).loadMoreError,'快照已失效');assert.ok(closed.includes('failed:1'));
run('离页');active=false;pending[5].resolve({results:[row(5)],hasMore:true,nextCursor:'late:1'});await settle();
assert.ok(closed.includes('late:1'));assert.equal(owner.stateAt(0).kind,'loading');owner.cancel();
assert.ok(changes>0);
console.log('PASS negotiated cursor wire, legacy fallback, one-shot close, stale/late cleanup, single continuation, stable dedup and visible failure');
