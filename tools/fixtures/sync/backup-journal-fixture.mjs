import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,writeFileSync,existsSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {syncIndexFixture as f} from '../../lib/sync-index-real-fixture.mjs';
export function createBackupJournalFixture(){
const directory=mkdtempSync(join(tmpdir(),'reader-backup-journal-'));
const disk=join(directory,'preferences.json');
const tick=async predicate=>{for(let i=0;i<2000;i++){if(predicate())return;await new Promise(setImmediate);}throw Error('actual backup IO boundary absent');};
const operation=x=>x.snapshot().facts.operation;
const open=async x=>{x.owner.open();await x.settle();};
const retry=async x=>{const p=x.page();assert.ok(p.action,'real SDK shared recovery native handler');p.action.onClick();p.action.onClick();await x.settle();};
// Preferences performs staged in-memory mutation followed by actual file IO.
// Cold instances reload that file; production journal methods are unmodified.
function preferences(){let data=existsSync(disk)?JSON.parse(readFileSync(disk,'utf8')):{};return {
 failFlush:false, async get(k,fallback){return data[k]??fallback;},async has(k){return k in data;},async put(k,v){data[k]=v;},async delete(k){delete data[k];},
 async flush(){if(this.failFlush){this.failFlush=false;throw Error('injected native flush rejection');}writeFileSync(disk,JSON.stringify(data));}
};}
function fixture({cold=false,createOwner}={}){
 if(!cold)rmSync(disk,{force:true});const x=f.fixture({preserveAsset:cold,createOwner});const prefs=preferences();f.setPreferences(prefs);
 const requests=[],original=x.runtime.request.bind(x.runtime);let state='prepared',uploaded=false,retention=false,remoteQualified=false,skipped=false,skipLostAck=false,skipGate;
 const exactId=()=>x.runtime.backupOperationId;
 // Typed Core result injection here is independent of the paired Rust tests,
 // which exercise actual durable Core/hash/SQLite methods. No hash algorithm
 // or publisher state machine is reproduced in this Host/SDK probe.
 x.runtime.request=async(method,params,options)=>{
  if(method==='sync.webdav.backup.receipt.query'){
   x.runtime.calls.push([method,structuredClone(params)]);
   return {data:{transactionId:params.transactionId,receiptState:state,retentionSkipped:skipped,uploadQualified:uploaded||params.response!==undefined&&remoteQualified,
    retentionCompleted:retention,durable:true,remotePath:'/backup/package',contentBytes:100,
    request:!uploaded&&params.response===undefined&&state!=='undispatched'?{method:'GET',url:'https://example.test/backup/package'}:undefined}};
  }
  if(method==='sync.webdav.backup.retention.skip'){
   x.runtime.calls.push([method,structuredClone(params)]);
   if(skipGate)await skipGate.promise;
   if(!uploaded&&!(params.response!==undefined&&remoteQualified))throw Error('typed Core exact upload qualification refused');
   state='retentionSkipped';uploaded=true;skipped=true;
   if(skipLostAck){skipLostAck=false;throw Error('lost local terminal command ACK');}
   return {data:{transactionId:params.transactionId,receiptState:state,uploadQualified:true,retentionCompleted:false,retentionSkipped:true,durable:true}};
  }
  return original(method,params,options);
 };
 f.setTransport(async request=>{requests.push(structuredClone(request));return {status:request.method==='GET'?200:201,body:'opaque-core-ciphertext',finalUrl:request.url};});
 return {...x,prefs,requests,qualifyRemote:()=>{remoteQualified=true;},removeRemote:()=>{remoteQualified=false;},settleCore:(s,u,r)=>{state=s;uploaded=u;retention=r;skipped=s==='retentionSkipped';},loseSkipAck:()=>{skipLostAck=true;},pauseSkip:gate=>{skipGate=gate;},exactId};
}
return {fixture,directory,disk,operation,open,retry,tick,cleanup(){rmSync(directory,{recursive:true,force:true});f.cleanup();}};
}
