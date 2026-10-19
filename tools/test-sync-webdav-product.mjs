import assert from 'node:assert/strict';
import {selectContractCases,recordContractCasePass} from './lib/contract-case-selection.mjs';
async function run(id){
 const {productionMotionMethods}=await import('./lib/reader-motion-method-probe.mjs');
 const path=new URL('../entry/src/main/ets/features/sync/SyncGateway.ts',import.meta.url);
 if(id==='closed-transaction'){
  const C=productionMotionMethods(path,['isAlreadyClosedTransactionError','abortBestEffort']);
  for(const [fault,expected] of [[{event:{error:{code:'INVALID_PARAMS',message:'unknown or completed WebDAV transaction'}}},true],[{event:{error:{code:'INVALID_PARAMS',message:'transaction id is invalid'}}},false],[new Error('network timeout'),false]]){
   const calls=[],c=Object.assign(new C(),{runtimeOwner:{request:async(m,p)=>{calls.push([m,p]);throw fault;}}});assert.equal(await c.abortBestEffort('original'),expected);assert.deepEqual(calls,[['sync.webdav.transaction.abort',{transactionId:'original'}]]);
  }
 }
 if(id==='restore-order'){
  const C=productionMotionMethods(path,['restoreLatest']);
  for(const acknowledged of [false,true]){const calls=[],c=Object.assign(new C(),{pendingRestoreTransactionId:'old',assertAdmission(){},requireRestoreSettled:async()=>{},abortBestEffort:async id=>{calls.push(['abort',id]);return acknowledged;},requireStoredConfig:async()=>({}),startTransaction:async()=>{calls.push(['start']);return{transactionId:'new'};},driveTransaction:async()=>({status:'conflict',transactionId:'new'}),decodeConflict:()=>({remotePath:'/backup'}),errorMessage:String});const result=await c.restoreLatest();assert.equal(result.ok,false);assert.deepEqual(calls,acknowledged?[['abort','old'],['start']]:[['abort','old']]);assert.equal(c.pendingRestoreTransactionId,acknowledged?'new':'old');}
 }
 if(id==='transport-directory'){
  const calls=[],C=productionMotionMethods(path,['driveTransaction','assertTransactionIdentity','requireDirectory'],{MAX_TRANSACTION_STEPS:30,MAX_WEBDAV_DIRECTORY_LENGTH:1024,HttpExecuteHost:{instance:{execute:async r=>{calls.push(r);return{status:200};}}}});
  const c=Object.assign(new C(),{assertOwner(){},decodeTransaction:x=>x,runtimeOwner:{request:async()=>({data:{transactionId:'same',status:'completed'}})}});
  await c.driveTransaction({transactionId:'same',status:'hostRequired',requests:[{method:'GET',url:'https://configured.test/backup'}]});assert.equal(calls.length,1);assert.equal(calls[0].httpsOnly,true);assert.equal(calls[0].sameOriginRedirectsOnly,true);
  c.runtimeOwner.request=async()=>({data:{transactionId:'other',status:'completed'}});await assert.rejects(c.driveTransaction({transactionId:'same',status:'hostRequired',requests:[{method:'GET',url:'https://configured.test/backup'}]}),/事务/);
  assert.equal(c.requireDirectory(' /backup '),'/backup');for(const value of ['/a/../b','/%2e%2e/x','/a\u0000b','x'.repeat(1025)])assert.throws(()=>c.requireDirectory(value));
 }
}
for(const id of selectContractCases({'closed-transaction':'Actual structured abort classifier','restore-order':'Actual stale conflict abort before new restore','transport-directory':'Actual HTTPS request options/transaction identity/directory rejection'})){await run(id);recordContractCasePass(id);}
