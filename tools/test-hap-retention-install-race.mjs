import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {spawn,spawnSync} from 'node:child_process';
import {once} from 'node:events';
import {existsSync,mkdirSync,mkdtempSync,readFileSync,realpathSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {applyHapRetention,planHapRetention,withHapRunLock} from '../scripts/hap-pipeline.mjs';

const root=mkdtempSync(join(tmpdir(),'reader-hap-install-race-'));
const pipeline=new URL('../scripts/hap-pipeline.mjs',import.meta.url).href;
const children=[];
const staleLocks=[];
const json=(p,j)=>writeFileSync(p,JSON.stringify(j));
function fixture(id,day){
 const d=join(root,id);mkdirSync(d);const bytes=Buffer.from(id);
 writeFileSync(join(d,'entry-default-signed.hap'),bytes);
 json(join(d,'manifest.json'),{schemaVersion:2,name:'reader-harmonyos-hap-run',runId:id,
  finishedAt:`2026-09-${day}T00:00:00Z`,artifacts:[{path:'entry-default-signed.hap',sha256:createHash('sha256').update(bytes).digest('hex')}]});
 return d;
}
async function holder(directory,marker=false){
 const ready=join(root,'.ready-'+children.length);
 const child=spawn(process.execPath,['--input-type=module','-e',
  `import {withHapRunLock} from ${JSON.stringify(pipeline)};
   import {writeFileSync} from 'node:fs';
   withHapRunLock(${JSON.stringify(directory)},()=>{
     ${marker?`writeFileSync(${JSON.stringify(join(directory,'retention-install-vm-fixture.json'))},JSON.stringify({name:'reader-hap-install-protection',runId:'old'}));`:''}
     writeFileSync(${JSON.stringify(ready)},'held');
     Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,500);
   });`],{stdio:['ignore','pipe','pipe']});
 children.push(child);const completed=once(child,'close');let output='';child.stderr.on('data',x=>output+=x);
 const until=Date.now()+3000;
 while(!existsSync(ready)){assert.ok(Date.now()<until,'holder must acquire actual production lock');await new Promise(r=>setTimeout(r,10));}
 return async()=>{const [code]=await completed;assert.equal(code,0,output);};
}
try{
 const old=fixture('old','01'),latest=fixture('latest','02');
 const plan=planHapRetention(root,1);
 const release=await holder(old,true);
 assert.deepEqual(planHapRetention(root,2).protected.map(row=>row.runId),['old']);
 assert.throws(()=>applyHapRetention(plan),/lock is busy/,'installing run cannot be pruned, including a previously planned deletion');
 assert.ok(existsSync(join(old,'entry-default-signed.hap')));
 let verified=false;
 assert.throws(()=>withHapRunLock(old,()=>{verified=true;}),/lock is busy/,'second operation cannot verify/use an installing run');
 assert.equal(verified,false,'run lock is acquired before package verification');
 assert.doesNotThrow(()=>withHapRunLock(latest,()=>{}),'unrelated immutable run does not serialize');
 await release();
 assert.throws(()=>applyHapRetention(plan),/inventory changed/,'a new orphan marker requires a fresh reviewed plan');
 const revised=planHapRetention(root,1);
 assert.equal(revised.protected.length,0);
 assert.equal(revised.staleInstallMarkers.length,1);
 applyHapRetention(planHapRetention(root,2));
 const pruning=await holder(old);
 assert.throws(()=>withHapRunLock(old,()=>{verified=true;}),/lock is busy/,'prune-first ownership prevents installation from entering verification');
 assert.equal(verified,false);
 await pruning();
 assert.deepEqual(applyHapRetention(plan).removedRuns,['old']);
 assert.equal(existsSync(join(old,'entry-default-signed.hap')),false);
 assert.ok(existsSync(join(old,'manifest.json')),'immutable manifest survives pruning');
 const ended=spawnSync(process.execPath,['-e','process.exit(0)']);assert.equal(ended.status,0);
 const staleLock=join(process.env.READER_LOCK_DIR || tmpdir(),
  'reader-harmony-hap-run-'+createHash('sha256').update(realpathSync(latest)).digest('hex')+'.lock');
 mkdirSync(staleLock);staleLocks.push(staleLock);json(join(staleLock,'owner.json'),{pid:ended.pid,token:'dead-owner-fixture'});
 const critical=join(root,'.critical');
 const contenders=Array.from({length:2},(_,i)=>spawn(process.execPath,['--input-type=module','-e',
  `import {withHapRunLock} from ${JSON.stringify(pipeline)};
   import {mkdirSync,rmSync,writeFileSync} from 'node:fs';
   try { withHapRunLock(${JSON.stringify(latest)},()=>{
     mkdirSync(${JSON.stringify(critical)});
     writeFileSync(${JSON.stringify(join(root,'.entered-'+i))},'safe');
     Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,300);
     rmSync(${JSON.stringify(critical)},{recursive:true});
   }); } catch(error) { if(!/lock is busy|lock exists without a readable owner/.test(error.message)) throw error; }`],{stdio:'pipe'}));
 children.push(...contenders);
 const errors=['',''];contenders.forEach((child,i)=>child.stderr.on('data',data=>errors[i]+=data));
 assert.deepEqual(await Promise.all(contenders.map(async child=>(await once(child,'close'))[0])),[0,0],errors.join('\n'));
 assert.ok([0,1].some(i=>existsSync(join(root,'.entered-'+i))),'dead run owner recovered under root lock');
 assert.ok(!existsSync(critical)); assert.ok(!existsSync(staleLock));
 const source=readFileSync(new URL('../scripts/hap-pipeline.mjs',import.meta.url),'utf8');
 assert.match(source,/command === 'install'\) withHapRunLock/,'CLI install uses exact same proven lock primitive before resolution');
 assert.doesNotMatch(source,/command === '(?:install|prune)'\) withArtifactLock/,'delivery and cleanup do not wait for unrelated cold builds');
 console.log('PASS actual cross-process run locks: install-first/prune-first exclusion, orphan marker resolution, unrelated-run progress, manifest preservation, serialized dead-owner recovery');
}finally{
 for(const child of children)if(child.exitCode===null)child.kill();
 for(const lock of staleLocks)rmSync(lock,{recursive:true,force:true});
 rmSync(root,{recursive:true,force:true});
}
