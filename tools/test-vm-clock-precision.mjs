import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {targetReadiness} from '../scripts/lib/hap-delivery-evidence.mjs';
import {selectContractCases,recordContractCasePass} from './lib/contract-case-selection.mjs';

const selected=selectContractCases({'vm-clock-precision':{description:'Actual VM readiness fractional epoch precision; old floor false rejection, real skew/jumps/freeze/slow batch and boot/log/PID guards stay rejecting.',resources:[]}});
for(const id of selected){
 const directory=mkdtempSync(join(tmpdir(),'reader-vm-clock-'));
 try{
  const boot=Date.UTC(2026,9,26,10,0,0),start=boot+155209;
  const local=value=>{const d=new Date(value),pad=(n,w=2)=>String(n).padStart(w,'0');return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(),3)}`;};
  const utc=value=>new Date(value).toISOString().slice(0,19).replace('T',' ');
  const log=join(directory,'emulator.log');
  const text=`${local(boot-500)} 1 [Info] [TraceTool.cpp(InitPipe:27)][TraceTool] trace pipe name is: "fixture"\n${local(boot+21000)} 1 [Info] [QemuManager.cpp(EmitGuestOSBootComplete:131)]Guest OS Boot Completed!!\n`;
  writeFileSync(log,text);
  let count=0;
  function fixture({offset=-450,guestDate,secondOffset=0,hostJump=0,queryMs=30,waitMs=2000,changedPid=false,changedMilestone=false,changedLog=false,uuid=false}={}){
   let elapsed=0,second=false;const commands=[];const samples=[];
   const path=join(directory,`case-${++count}.log`);writeFileSync(path,text);
   const run=()=>targetReadiness({targetKind:'vm',vmLog:path,now:()=>start+elapsed+(second?hostJump:0),monotonicNow:()=>elapsed,
    wait(){elapsed+=waitMs;second=true;if(changedLog)writeFileSync(path,`${text}${local(boot+22000)} 1 System is reset\n`);},
    query(command){
     commands.push(command);elapsed+=queryMs;
     if(command==='param get bootevent.boot.completed')return 'true';
     if(command==='cat /proc/sys/kernel/random/boot_id')return uuid?'12345678-1234-1234-1234-123456789abc':'/bin/sh: cat: /proc/sys/kernel/random/boot_id: Permission denied';
     if(command==='cat /proc/uptime')return uuid?'155 155':'/bin/sh: cat: /proc/uptime: Permission denied';
     if(command==='pidof com.ohos.sceneboard')return changedPid&&second?'124':'123';
     if(command==='date -u +%s.%N'){
      const value=guestDate??((start+elapsed+offset+(second?secondOffset:0))/1000).toFixed(9);
      samples.push(Number(value)*1000);return value;
     }
     if(command==='TZ=UTC uptime -s')return utc(boot);
     const milestones={kernel:'881433',init:'7026507','samgr.ready':'7156994','appspawn.started':'7288482','wms.ready':'10000000','boot.completed':'20000000'};
     const name=command.replace('param get ohos.boot.time.','');
     if(Object.hasOwn(milestones,name))return changedMilestone&&second&&name==='init'?'7026508':milestones[name];
     throw new Error(`Unexpected query: ${command}`);
    }});
   return{run,commands,samples};
  }
  const good=fixture();assert.equal(good.run().status,'PASS');
  // Four pre-sample read-only queries precede VM hostStart; date costs one more.
  const actualHostStart=start+4*30,actualGuest=start+5*30-450;
  assert(actualGuest>=actualHostStart-1000);
  assert(Math.floor(actualGuest/1000)*1000<actualHostStart-1000,'same true -450ms clock becomes a false >1s rejection under the old integer floor');
  assert.equal(good.samples[0],actualGuest);
  assert.equal(fixture({offset:450}).run().status,'PASS');
  for(const offset of[-5000,5000])assert.throws(()=>fixture({offset}).run(),/clock or observation is inconsistent/);
  assert.throws(()=>fixture({secondOffset:5000}).run(),/clock or observation is inconsistent/);
  assert.throws(()=>fixture({hostJump:5000}).run(),/observation interval or clock/);
  assert.throws(()=>fixture({guestDate:((start-450)/1000).toFixed(9)}).run(),/clock or observation|changed during readiness/);
  assert.throws(()=>fixture({queryMs:1200}).run(),/clock or observation is inconsistent/,'whole nine-query sample still rejects >10s');
  for(const guestDate of['1793021200.%N','1793021200','NaN','Infinity','9007199254740992.0'])assert.throws(()=>fixture({guestDate}).run(),/VM guest clock is unavailable/);
  assert.throws(()=>fixture({changedPid:true}).run(),/boot\/SceneBoard changed/);
  assert.throws(()=>fixture({changedMilestone:true}).run(),/changed during readiness/);
  assert.throws(()=>fixture({changedLog:true}).run(),/system became unstable/);
  const direct=fixture({uuid:true});assert.equal(direct.run().bootIdentitySource,'kernel-boot-id');assert(!direct.commands.includes('date -u +%s.%N'),'unrestricted default identity path stays unchanged');
  assert(!good.commands.some(command=>/\bbm\b|\baa\b|install|\bsu\b|chmod|param set/.test(command)),'fixture executes only production read-only query strings');
  recordContractCasePass(id);
 }finally{rmSync(directory,{recursive:true,force:true});}
}
