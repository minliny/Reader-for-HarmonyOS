import assert from 'node:assert/strict';
import {selectContractCases,recordContractCasePass} from './lib/contract-case-selection.mjs';
async function run(id){
 if(id==='loopback-transport'||id==='loopback-core'){
  const {verifyWebdavLoopback}=await import('./fixtures/sync/webdav-loopback-fixture.mjs');
  await verifyWebdavLoopback(id==='loopback-core');
  return;
 }
 if(['publication-readback','provider-switch','connection-retirement','stale-consent','readback-auth','unknown-retention'].includes(id)){
  const {createSyncOwnerFixture}=await import('./fixtures/sync/receipt-owner-fixture.mjs');
  const f=createSyncOwnerFixture();
  try {
   const x=f.fixture();
   const gateway=new f.Gateway(x.runtime,x.store);
   const requests=[];
   if(id==='publication-readback'){
    for(const exactReadback of [false,true]){
     const item=f.fixture();
     const publisher=new f.Gateway(item.runtime,item.store);
     const calls=[];const request=item.runtime.request.bind(item.runtime);
     item.runtime.request=async (method,params)=>{
      calls.push(method);
      const result=await request(method,params);
      if(method==='sync.webdav.backup.receipt.query'&&params.response!==undefined){
       result.data.uploadQualified=exactReadback;
      }
      return result;
     };
     f.setTransport(async value=>{
      calls.push(value.method);requests.push(value);
      return {status:value.method==='GET'?200:201,finalUrl:value.url,body:'ciphertext'};
     });
     const outcome=await publisher.triggerBackup();
     assert.equal(outcome.ok,exactReadback);
     assert.equal(requests.find(value=>value.method==='PUT').headers['If-None-Match'],'*');
     assert.ok(calls.indexOf('GET')>calls.indexOf('PUT'));
     if(exactReadback){
      assert.ok(calls.indexOf('sync.webdav.transaction.advance')>calls.indexOf('GET'));
      assert.equal(await item.store.loadBackupJournal(),undefined);
     }else{
      assert.equal(item.runtime.count('sync.webdav.transaction.advance'),0);
      assert.equal((await item.store.loadBackupJournal()).phase,'mayDispatch');
      assert.equal(item.runtime.calls.find(([m])=>m==='sync.webdav.transaction.abort')[1].publisherUndispatched,undefined);
     }
    }
   }
   if(id==='provider-switch'){
    const selection=await gateway.restoreLatest();
    assert.ok(selection.conflict);
    f.asset.record=new TextEncoder().encode(JSON.stringify({formatVersion:2,config:{...f.config,directory:'/different-provider'}}));
    const outcome=await gateway.resolveRestore(true,selection.conflict.transactionId);
    assert.equal(outcome.ok,false);
    assert.equal(x.runtime.count('sync.webdav.transaction.resolve'),0);
    assert.equal(x.runtime.count('runtime.storage.apply'),0);
   }
   if(id==='connection-retirement'){
    let admitted=true;
    const request=x.runtime.request.bind(x.runtime);
    x.runtime.request=async (method,params)=>{
     if(method==='sync.webdav.transaction.start'){
      admitted=false;
      return {data:{transactionId:'retired',status:'hostRequired',phase:'connectionList',requests:[{method:'PROPFIND',url:f.config.url}]}};
     }
     return request(method,params);
    };
    f.setTransport(async value=>{requests.push(value);return {status:207};});
    const outcome=await gateway.testConnection(f.config.url,f.config.user,'',f.config.directory,()=>admitted);
    assert.equal(outcome.ok,false);
    assert.equal(requests.length,0,'a retired page cannot initiate a new WebDAV request');
   }
   if(id==='stale-consent'){
    const {fullSyncIndexPage,syncPageActors}=await import('./lib/sync-index-real-fixture.mjs');
    let sequence=0;
    const request=x.runtime.request.bind(x.runtime);
    x.runtime.request=async (method,params)=>{
     const result=await request(method,params);
     if(method==='sync.webdav.transaction.start'&&params.operation==='restore'){
      result.data.transactionId='restore-'+(++sequence);
     }
     if(method==='sync.webdav.transaction.resolve')result.data.transactionId=params.transactionId;
     return result;
    };
    const confirm=()=>{
     const page=fullSyncIndexPage({snapshot:x.snapshot(),onResolveRestore:(...args)=>x.owner.resolveRestore(...args)});
     return syncPageActors(page).flatMap(actor=>[...(actor.nodes?.values()??[])])
       .find(node=>node.type==='Button'&&node.accessibilityText==='恢复本机配置').onClick;
    };
    x.owner.open();await x.settle();
    x.owner.restoreLatest();await x.settle();const old=confirm();
    x.owner.restoreLatest();await x.settle();
    assert.equal(x.snapshot().restoreConflict.transactionId,'restore-2');
    old();await x.settle();
    assert.equal(x.runtime.count('sync.webdav.transaction.resolve'),0,'old visible consent cannot approve its same-route successor');
    confirm()();await x.settle();
    assert.equal(x.runtime.count('sync.webdav.transaction.resolve'),1);
    assert.equal(x.runtime.count('runtime.storage.apply'),1);
   }
   if(id==='readback-auth'){
    f.setTransport(async request=>({status:request.method==='GET'?401:201,finalUrl:request.url,body:''}));
    const outcome=await gateway.triggerBackup();
    assert.equal(outcome.error,'WebDAV 认证失败或已过期，请更新账号与密码');
    assert.equal((await x.store.loadBackupJournal()).phase,'mayDispatch');
    assert.equal(x.runtime.count('sync.webdav.transaction.advance'),0);
    await assert.rejects(()=>gateway.reconcileBackupReceipt(),/WebDAV 认证失败或已过期/);
   }
   if(id==='unknown-retention'){
    const unowned='https://example.test/backup/reader-storage-1700000000000-aabbccddeeff.reader-backup.json';
    let planned=false;
    const request=x.runtime.request.bind(x.runtime);
    x.runtime.request=async (method,params)=>{
     if(method==='sync.webdav.backup.retention.skip'){
      x.runtime.calls.push([method,params]);
      return {data:{transactionId:params.transactionId,receiptState:'retentionSkipped',uploadQualified:true,
        durable:true,retentionSkipped:true,retentionCompleted:false}};
     }
     const result=await request(method,params);
     if(method==='sync.webdav.transaction.advance'&&!planned){
      planned=true;
      return {data:{transactionId:params.transactionId,status:'hostRequired',phase:'backupRetentionDelete',
        requests:[{method:'DELETE',url:unowned}]}};
     }
     if(method==='sync.webdav.backup.receipt.query'&&planned){
      result.data.uploadQualified=true;
      result.data.receiptState='uploadAcknowledged';
     }
     return result;
    };
    f.setTransport(async value=>{
     requests.push(value);
     return {status:value.method==='GET'?200:201,finalUrl:value.url,body:'ciphertext'};
    });
    x.owner.open();await x.settle();x.owner.triggerBackup();await x.settle();
    assert.deepEqual(requests.map(value=>value.method),['PUT','GET']);
    assert.equal(x.snapshot().facts.operation.uploadQualified,true);
    assert.equal(x.runtime.count('sync.webdav.backup.retention.skip'),0,'only explicit retention action settles');
    x.page().skipAction.onClick();await x.settle();
    assert.equal(x.runtime.count('sync.webdav.backup.retention.skip'),1);
    assert.equal(x.snapshot().facts.operation.retentionSkipped,true);
    assert.equal(x.snapshot().facts.canMutate,true);
   }
  }finally{f.cleanup();}
 }
 const {productionMotionMethods}=await import('./lib/reader-motion-method-probe.mjs');
 const path=new URL('../entry/src/main/ets/features/sync/application/SyncGateway.ts',import.meta.url);
 if(id==='closed-transaction'){
  const C=productionMotionMethods(path,['isAlreadyClosedTransactionError','abortBestEffort']);
  for(const [fault,expected] of [[{event:{error:{code:'INVALID_PARAMS',message:'unknown or completed WebDAV transaction'}}},true],[{event:{error:{code:'INVALID_PARAMS',message:'transaction id is invalid'}}},false],[new Error('network timeout'),false]]){
   const calls=[],c=Object.assign(new C(),{runtimeOwner:{request:async(m,p)=>{calls.push([m,p]);throw fault;}}});assert.equal(await c.abortBestEffort('original'),expected);assert.deepEqual(calls,[['sync.webdav.transaction.abort',{transactionId:'original'}]]);
  }
 }
 if(id==='restore-order'){
  const C=productionMotionMethods(path,['restoreLatest','clearPendingRestore']);
  for(const acknowledged of [false,true]){const calls=[],c=Object.assign(new C(),{pendingRestoreTransactionId:'old',assertAdmission(){},requireRestoreSettled:async()=>{},credentials:{loadSerializedState:async()=>({config:{}})},abortBestEffort:async id=>{calls.push(['abort',id]);return acknowledged;},requireStoredConfig:async()=>({}),startTransaction:async()=>{calls.push(['start']);return{transactionId:'new'};},driveTransaction:async()=>({status:'conflict',transactionId:'new'}),decodeConflict:()=>({remotePath:'/backup'}),errorMessage:String});const result=await c.restoreLatest();assert.equal(result.ok,false);assert.deepEqual(calls,acknowledged?[['abort','old'],['start']]:[['abort','old']]);assert.equal(c.pendingRestoreTransactionId,acknowledged?'new':'old');}
 }
 if(id==='transport-directory'){
  const calls=[],C=productionMotionMethods(path,['driveTransaction','assertTransactionIdentity','assertAdmission','requireObject','requireDirectory'],{MAX_TRANSACTION_STEPS:30,MAX_WEBDAV_DIRECTORY_LENGTH:1024,HttpExecuteHost:{instance:{execute:async r=>{calls.push(r);return{status:200};}}}});
  const c=Object.assign(new C(),{assertOwner(){},decodeTransaction:x=>x,runtimeOwner:{request:async()=>({data:{transactionId:'same',status:'completed'}})}});
  await c.driveTransaction({transactionId:'same',status:'hostRequired',requests:[{method:'GET',url:'https://configured.test/backup'}]});assert.equal(calls.length,1);assert.equal(calls[0].httpsOnly,true);assert.equal(calls[0].sameOriginRedirectsOnly,true);
  c.runtimeOwner.request=async()=>({data:{transactionId:'other',status:'completed'}});await assert.rejects(c.driveTransaction({transactionId:'same',status:'hostRequired',requests:[{method:'GET',url:'https://configured.test/backup'}]}),/事务/);
  assert.equal(c.requireDirectory(' /backup '),'/backup');for(const value of ['/a/../b','/%2e%2e/x','/a\u0000b','x'.repeat(1025)])assert.throws(()=>c.requireDirectory(value));
 }
}
for(const id of selectContractCases({'closed-transaction':'Actual structured abort classifier','restore-order':'Actual stale conflict abort before new restore','transport-directory':'Actual HTTPS request options/transaction identity/directory rejection','publication-readback':'Conditional new object and exact readback before retention','provider-switch':'Saved provider change invalidates outstanding restore consent','connection-retirement':'Retired connection test issues no HTTP request','stale-consent':'Old physical action cannot approve a new same-route restore candidate','readback-auth':'Readback auth expiry retains original publication journal','unknown-retention':'Never delete filename-matching unowned WebDAV backup objects','loopback-transport':'Loopback TLS and product Host with controlled Core','loopback-core':'Loopback TLS, product Host, and local desktop Core NAPI'})){await run(id);recordContractCasePass(id);}
