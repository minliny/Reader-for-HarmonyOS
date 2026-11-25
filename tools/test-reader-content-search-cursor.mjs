import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { ReaderContentSearchPublication } from './lib/reader-content-search-owner-probe.mjs';
import { decodeRemotePositionScope } from '../entry/src/main/ets/features/reading/application/RemoteReadingPositionMigration.ts';
import { classifyRemoteReadingCommandFailure } from '../entry/src/main/ets/features/reading/application/RemoteReadingContract.ts';

const source = readFileSync(new URL('../entry/src/main/ets/features/reading/application/ReadingSessionFlowGateway.ts', import.meta.url), 'utf8');
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

receipt = {sourceId:'s',bookId:'b',tocAvailable:true,chapterCount:4,chapters:[
  {chapterIndex:0,navigable:true,state:'paused',cachedBytes:120},
  {chapterIndex:1,navigable:false,state:'cached',cachedBytes:80},
  {chapterIndex:2,navigable:true,state:'completed',cachedBytes:0},
  {chapterIndex:3,navigable:true,state:'cached',cachedBytes:67},
]};
assert.deepEqual(await gateway.readContentSearchCacheScope('b',()=>true),{cachedChapters:2,totalChapters:3});
assert.equal(calls.at(-1).method,'cache.book.status');
assert.equal(calls.at(-1).params.includeGlobalStats,false);
const currentReceipt = receipt;
receipt = {...currentReceipt,readableChapterCount:4};
assert.equal(await gateway.readContentSearchCacheScope('b',()=>true),undefined);
receipt = {...currentReceipt,tocAvailable:false};
assert.equal(await gateway.readContentSearchCacheScope('b',()=>true),undefined);
receipt = {...receipt,sourceId:'another-source'};
assert.equal(await gateway.readContentSearchCacheScope('b',()=>true),undefined);
assert.equal(await gateway.readContentSearchCacheScope('b',()=>false),undefined);
const beforeLocal=calls.length;
gateway.sourceId='local';
assert.equal(await gateway.readContentSearchCacheScope('b',()=>true),undefined);
assert.equal(calls.length,beforeLocal,'local search needs no cache-scope request');
gateway.sourceId='s';

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
owner.more('b',2,()=>active,()=>changes++);pending[4].reject(Object.assign(new Error('快照已失效'),{code:'positionContextStale'}));await settle();
assert.equal(owner.stateAt(0).results[0].chapterOffset,4);assert.equal(owner.stateAt(0).hasMore,true,'preserve the last Core continuation fact');
assert.equal(owner.stateAt(0).continuationRetryable,false);
assert.equal(owner.stateAt(0).loadMoreError,'快照已失效');assert.ok(closed.includes('failed:1'));
run('重试');pending[5].resolve({results:[row(5)],hasMore:true,nextCursor:'retry:1'});await settle();
owner.more('b',2,()=>active,()=>changes++);pending[6].reject(new Error('响应未收到'));await settle();
assert.equal(owner.stateAt(0).hasMore,true);assert.equal(owner.stateAt(0).results[0].chapterOffset,5);
assert.ok(!closed.includes('retry:1'),'a retryable exact cursor must remain owned');
owner.needMore('b',2,()=>active,()=>changes++);
assert.equal(pending.length,7,'automatic layout/scroll demand cannot retry a failed cursor');
owner.more('b',2,()=>active,()=>changes++);
assert.equal(pending[7].args[5],'retry:1','replay the same cursor, never restart through offset');
pending[7].resolve({results:[row(5),row(6)],hasMore:false});await settle();
assert.deepEqual(owner.stateAt(0).results.map(row=>row.chapterOffset),[5,6]);
assert.ok(closed.includes('retry:1'));
run('离页');active=false;pending[8].resolve({results:[row(7)],hasMore:true,nextCursor:'late:1'});await settle();
assert.ok(closed.includes('late:1'));assert.equal(owner.stateAt(0).kind,'loading');owner.cancel();
assert.ok(changes>0);
active=true;
const continuous=new ReaderContentSearchPublication(),continuousCalls=[],continuousClosed=[];
const sequence={async searchContentPage(_book,_keyword,limit,offset,_active,cursor){
  continuousCalls.push({offset,cursor});
  return {results:Array.from({length:Math.min(limit,251-offset)},(_,i)=>row(offset+i)),hasMore:offset+limit<251,
    nextCursor:offset+limit<251?`continuous:${offset+limit}`:undefined};},async closeContentSearch(c){continuousClosed.push(c);}};
continuous.run(sequence,'b','词',50,()=>active,()=>{});await settle();
const firstArray=continuous.stateAt(0).results;
for(let i=0;i<8;i++){continuous.needMore('b',50,()=>active,()=>{});continuous.needMore('b',50,()=>active,()=>{});await settle();}
assert.equal(continuousCalls.length,6);assert.equal(continuous.stateAt(0).results.length,251);
assert.equal(continuous.stateAt(0).results,firstArray,'normal append retains the one admitted result array');
assert.deepEqual(firstArray.map(r=>r.chapterOffset),Array.from({length:251},(_,i)=>i));
assert.equal(continuous.stateAt(0).hasMore,false);
let noProgressCalls=0;
const repeat={async searchContentPage(){noProgressCalls++;return{results:[row(1)],hasMore:true,nextCursor:'repeat'};},async closeContentSearch(){}};
continuous.run(repeat,'b','重复',50,()=>active,()=>{});await settle();
continuous.needMore('b',50,()=>active,()=>{});await settle();
for(let i=0;i<5;i++)continuous.needMore('b',50,()=>active,()=>{});
assert.equal(noProgressCalls,2);assert.equal(continuous.stateAt(0).paginationRetired,true);

const scoped=new ReaderContentSearchPublication();
let cached=2,scopeReads=0,scopedChanges=0,cacheChangedDuringQuery=false;
const cacheSearch={
  async readContentSearchCacheScope(){scopeReads++;return {cachedChapters:cached,totalChapters:20};},
  async searchContentPage(_book,_keyword,_limit,offset){
    if(offset>0&&cacheChangedDuringQuery)throw Object.assign(new Error('快照已失效'),{code:'positionContextStale'});
    return {results:[row(offset)],hasMore:offset===0,nextCursor:offset===0?'scope:1':undefined};
  },
  async closeContentSearch(){},
};
const searchChanged=()=>scopedChanges++;
scoped.run(cacheSearch,'b','词',1,()=>true,searchChanged);await settle();
const initialScopeRows=scoped.stateAt(0).results;
const resultScope=scoped.resultScrollScopeFor(scoped.stateAt(0));
const visit=scoped.attachResultScroll();
scoped.rememberResultScroll(visit,resultScope,1.25);
assert.deepEqual(scoped.stateAt(0).cacheScope,{cachedChapters:2,totalChapters:20});
cached=15;
await settle();
assert.equal(scopedChanges,2,'cache writes alone do not publish a search revision');
scoped.more('b',1,()=>true,searchChanged);await settle();
assert.equal(scoped.stateAt(0).results,initialScopeRows);
assert.equal(scoped.resultScrollAnchor(visit,resultScope),1.25);
assert.deepEqual(scoped.stateAt(0).cacheScope,{cachedChapters:2,totalChapters:20});
assert.equal(scopeReads,1,'continuation uses the original count');
scoped.run(cacheSearch,'b','词',1,()=>true,searchChanged);await settle();
assert.equal(scopeReads,2);
assert.deepEqual(scoped.stateAt(0).cacheScope,{cachedChapters:15,totalChapters:20});
const previousScope = scoped.resultScrollScopeFor(scoped.stateAt(0));
const previousRows = scoped.stateAt(0).results;
scoped.rememberResultScroll(visit,previousScope,2.25);
cacheChangedDuringQuery=true;
scoped.more('b',1,()=>true,searchChanged);await settle();
assert.equal(scoped.stateAt(0).results,previousRows);
assert.equal(scoped.resultScrollAnchor(visit,previousScope),2.25);
assert.equal(scoped.stateAt(0).paginationRetired,true);
assert.equal(scopeReads,2,'a Core stale cursor retires continuation without refreshing the results or the count');
console.log('PASS negotiated cursor wire, legacy fallback, one-shot close, stale/late cleanup, stable cache scope, dedup and visible failure');
