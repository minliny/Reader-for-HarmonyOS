import {selectContractCases,recordContractCasePass} from './lib/contract-case-selection.mjs';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
registerHooks({resolve(s,c,next){try{return next(s,c);}catch(e){if(s.startsWith('.')&&!s.endsWith('.ts'))return next(s+'.ts',c);throw e;}}});
async function heightPolicy() {
 const {ReaderStatusBarMeasurement}=await import('../entry/src/main/ets/app/ReaderStatusBarMeasurement.ts');
 const measured=new ReaderStatusBarMeasurement();
 for(const [key,landscape,height,hidden,expected] of [
  ['portrait-full',false,48,false,48],['portrait-full',false,0,true,48],
  ['landscape-full',true,0,true,0],['portrait-full',false,0,true,48],
  ['portrait-split',false,0,true,0],['portrait-split',false,0,false,0],
  ['portrait-split',false,0,true,0],['portrait-full',false,42,false,42],
  ['landscape-full',true,24,false,24],['landscape-full',true,0,true,24],
  ['portrait-full',false,0,true,42],['portrait-full',false,0,false,0],
 ]) assert.equal(measured.observe(key,landscape,height,hidden),expected);
 assert.equal(new ReaderStatusBarMeasurement().observe('portrait-full',false,0,true),0);
}
async function rectPolicy() {
 const {ReaderStatusBarMeasurement}=await import('../entry/src/main/ets/app/ReaderStatusBarMeasurement.ts');
 const {ReaderRectVp}=await import('../entry/src/main/ets/features/common/ReaderWindowMetrics.ts');
 const measured=new ReaderStatusBarMeasurement();
 const rect=(left,top,width,height)=>Object.assign(new ReaderRectVp(),{left,top,width,height});
 const portrait=rect(7,11,390,48),landscape=rect(13,17,800,24),zero=rect(19,23,320,0);
 assert.equal(measured.observeRect('portrait',false,portrait,false),portrait);
 assert.equal(measured.observeRect('landscape',true,landscape,false),landscape);
 assert.deepEqual(measured.observeRect('portrait',false,rect(0,0,0,0),true),portrait,'hidden preserves all four exact-window coordinates');
 assert.deepEqual(measured.observeRect('landscape',true,rect(0,0,0,0),true),landscape,'orientation owns its own rect');
 for(const key of ['portrait-split','portrait-width-320','portrait-left-8','portrait-top-12'])
  assert.deepEqual(measured.observeRect(key,false,rect(0,0,0,0),true),new ReaderRectVp(),'a different geometry key cannot borrow a rect');
 assert.equal(measured.observeRect('portrait',false,zero,false),zero,'visible zero is authoritative, including its position and width');
 assert.deepEqual(measured.observeRect('portrait',false,rect(0,0,0,0),true),zero);
 assert.deepEqual(new ReaderStatusBarMeasurement().observeRect('portrait',false,rect(0,0,0,0),true),new ReaderRectVp(),'replacement starts without measurements');
}
const cases={height:heightPolicy,rect:rectPolicy};
for(const id of selectContractCases({height:'Exact geometry height cache',rect:'Actual observeRect coordinates, key/orientation isolation and visible zero'})){await cases[id]();recordContractCasePass(id);}
