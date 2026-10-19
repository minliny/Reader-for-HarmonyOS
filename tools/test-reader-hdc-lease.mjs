#!/usr/bin/env node
import {selectContractCases,recordContractCasePass} from './lib/contract-case-selection.mjs';
const selected=selectContractCases({serialization:{description:'Offline actual CLI shared-server lock across two targets and exact event order',resources:[]},'wait-barrier':{description:'Actual acquire promise reaches contention before releasing first owner',resources:[]},'stale-token':{description:'Actual stale reclaim and token-safe release without devices',resources:[]},signal:{description:'Offline CLI SIGTERM forwards to owned Node child then releases lease',resources:[]}});
async function run(id){
 const {default:assert}=await import('node:assert/strict');
 const {spawn}=await import('node:child_process');
 const {mkdtempSync,readFileSync,writeFileSync,existsSync,rmSync}=await import('node:fs');
 const {tmpdir}=await import('node:os');const {resolve}=await import('node:path');const {fileURLToPath}=await import('node:url');
 const {canonicalServerKey,acquireLease,releaseLease,targetRef}=await import('./reader-hdc-lease.mjs');
 const root=mkdtempSync(resolve(tmpdir(),'reader-hdc-lease-test-'));
 const events=()=>existsSync(resolve(root,'events.jsonl'))?readFileSync(resolve(root,'events.jsonl'),'utf8').trim().split('\n').filter(Boolean).map(JSON.parse):[];
 const wait=async predicate=>{const deadline=Date.now()+3000;while(!predicate()){assert.ok(Date.now()<deadline,'owned worker handshake timeout');await new Promise(r=>setTimeout(r,5));}};
 const cli=(agent,target,code,waitMs='2000')=>{
  const child=spawn(process.execPath,[fileURLToPath(new URL('./reader-hdc-lease.mjs',import.meta.url)),'--target',target,'--hdc',process.execPath,'--lock-root',root,'--agent-id',agent,'--wait-ms',waitMs,'--','-e',code],{stdio:['ignore','pipe','pipe']});
  let stdout='',stderr='';child.stdout.on('data',v=>stdout+=v);child.stderr.on('data',v=>stderr+=v);
  return{child,done:new Promise((yes,no)=>{child.on('error',no);child.on('close',exit=>yes({exit,stdout,stderr}));})};
 };
 const heldCode=()=>`const fs=require('node:fs');fs.writeFileSync(${JSON.stringify(resolve(root,'ready'))},'ready');const timer=setInterval(()=>{if(fs.existsSync(${JSON.stringify(resolve(root,'release'))})){clearInterval(timer);}},5);`;
 const options=(agent,target='device-a')=>({root,target,targetRefValue:targetRef(target),lockRefValue:targetRef('127.0.0.1:8710'),waitMs:2000,owner:{pid:process.pid,token:agent,agentId:agent,target}});
 try{
  assert.equal(canonicalServerKey('::ffff:127.0.0.1:8710'),'127.0.0.1:8710');
  if(id==='serialization'){
   const a=cli('a','device-a:5555',heldCode());
   try{
    await wait(()=>existsSync(resolve(root,'ready')));
    const rejected=await cli('b','device-b:5555','process.exit(0)','0').done;
    assert.equal(rejected.exit,2,'different target still waits on same live HDC server');
    assert.match(rejected.stderr,/lease wait timed out/);assert.deepEqual(events().filter(e=>e.type==='acquire').map(e=>e.agentId),['a']);
   }finally{writeFileSync(resolve(root,'release'),'release');}
   assert.equal((await a.done).exit,0);
   const b=await cli('b','device-b:5555','process.exit(0)').done;assert.equal(b.exit,0,b.stderr);
   assert.deepEqual(events().filter(e=>['acquire','release'].includes(e.type)).map(e=>[e.type,e.agentId]),[['acquire','a'],['release','a'],['acquire','b'],['release','b']]);
  }else if(id==='wait-barrier'){
   const a=options('a'),b=options('b','device-b');const leaseA=await acquireLease(a);
   // Async acquire executes its first contended attempt synchronously before yielding at sleep.
   let bAcquired=false;const pending=acquireLease(b).then(value=>{bAcquired=true;return value;});
   assert.equal(bAcquired,false);assert.deepEqual(events().map(e=>[e.type,e.agentId]),[['acquire','a']]);
   releaseLease(root,leaseA.lockDir,a.owner);const leaseB=await pending;releaseLease(root,leaseB.lockDir,b.owner);
   assert.deepEqual(events().map(e=>[e.type,e.agentId]),[['acquire','a'],['release','a'],['acquire','b'],['release','b']]);
  }else if(id==='stale-token'){
   const a=options('a'),old=await acquireLease(a);
   const ownerPath=resolve(old.lockDir,'owner.json');writeFileSync(ownerPath,JSON.stringify({...a.owner,pid:2147483647}));
   const b=options('b'),current=await acquireLease(b);
   assert.equal(events().filter(e=>e.type==='reclaim-stale').length,1);
   releaseLease(root,current.lockDir,a.owner);assert.equal(existsSync(current.lockDir),true,'stale token cannot release successor');
   assert.equal(events().at(-1).type,'release-skipped');releaseLease(root,current.lockDir,b.owner);assert.equal(existsSync(current.lockDir),false);
  }else{
   const a=cli('signal','device-a:5555',heldCode());await wait(()=>existsSync(resolve(root,'ready')));
   a.child.kill('SIGTERM');const result=await a.done;assert.equal(result.exit,1,'forwarded signal yields unsuccessful child, never a PASS child exit');
   assert.deepEqual(events().filter(e=>['acquire','release'].includes(e.type)).map(e=>[e.type,e.agentId]),[['acquire','signal'],['release','signal']]);
  }
 }finally{rmSync(root,{recursive:true,force:true});}
}
for(const id of selected){await run(id);recordContractCasePass(id);}
