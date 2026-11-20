import assert from 'node:assert/strict';
import {targetReadiness} from '../scripts/lib/hap-delivery-evidence.mjs';
import {selectContractCases,recordContractCasePass} from './lib/contract-case-selection.mjs';
const cases=selectContractCases({'clock-precision':{description:'Fractional physical device clock avoids second-truncation false failures; real skew, frozen clocks, boot replacement and unavailable precision still stop admission.',resources:[]}});
for(const id of cases){
 const boot=Date.UTC(2026,9,26,10,0,0),start=boot+155309;
 function fixture({offset=-450,guestDate,changedPid=false,jump=0,hostJump=0,changedMilestone=false}={}){
  let elapsed=0,second=false;const commands=[];
  return ()=>targetReadiness({targetKind:'physical',now:()=>start+elapsed+(second?hostJump:0),monotonicNow:()=>elapsed,wait:()=>{elapsed+=2000;second=true;},query:command=>{
   commands.push(command);elapsed+=30;
   if(command==='param get bootevent.boot.completed')return 'true';
   if(command==='cat /proc/sys/kernel/random/boot_id')return '/bin/sh: cat: /proc/sys/kernel/random/boot_id: Permission denied';
   if(command==='pidof com.ohos.sceneboard')return second&&changedPid?'124':'123';
   if(command==='date -u +%s.%N')return guestDate??((start+elapsed+offset+(second?jump:0))/1000).toFixed(9);
   if(command==='TZ=UTC uptime -s')return new Date(boot).toISOString().slice(0,19).replace('T',' ');
   const milestones={kernel:'881433',init:'7026507','samgr.ready':'7156994','appspawn.started':'7288482','wms.ready':'10000000','boot.completed':'20000000'};
   const name=command.replace('param get ohos.boot.time.','');if(name in milestones)return second&&changedMilestone&&name==='init'?'7026508':milestones[name];
   throw new Error(`Unexpected query: ${command}`);
  }});
 }
 // At these fractions, floor(seconds) would report 1.4s skew even though the clock is only 450ms behind.
 assert.ok(Math.floor((start+120-450)/1000)*1000<start+90-1000);
 assert.equal(fixture()().status,'PASS');
 assert.equal(fixture({offset:450})().status,'PASS');
 for(const offset of [-5000,5000])assert.throws(fixture({offset}),/clock or observation/);
 assert.throws(fixture({jump:5000}),/clock or observation/);
 assert.throws(fixture({hostJump:5000}),/observation interval or clock/);
 assert.throws(fixture({guestDate:((start-450)/1000).toFixed(9)}),/changed during readiness|clock or observation/);
 for(const guestDate of ['1793021200.%N','1793021200','NaN','Infinity','9007199254740992.0'])assert.throws(fixture({guestDate}),/clock is unavailable/);
 assert.throws(fixture({changedPid:true}),/boot\/SceneBoard changed/);
 assert.throws(fixture({changedMilestone:true}),/changed during readiness/);
 recordContractCasePass(id);
}
