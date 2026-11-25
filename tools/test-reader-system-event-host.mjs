import {selectContractCases,recordContractCasePass} from './lib/contract-case-selection.mjs';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return{promise,resolve,reject};};
const tick=async()=>{await Promise.resolve();await Promise.resolve();await Promise.resolve();};
function fixture({failDown=false, readScreenLock, subscribeFailure}={}) {
 const source=readFileSync(new URL('../entry/src/main/ets/app/ReaderReadingSystemEventHost.ts',import.meta.url),'utf8');

 const listeners=new Map(),on=[],off=[],creates=[],unsubscribed=[],callbacks=new Map();
 const inputConsumer={on(type,options,callback){on.push({type,options,callback});if(failDown&&options.key==='DOWN')throw Error('DOWN unavailable');listeners.set(options.key,callback);},off(type,callback){off.push({type,callback});for(const[key,value]of listeners)if(value===callback)listeners.delete(key);}};
 const screenState=deferred();
 const commonEventManager={Support:{COMMON_EVENT_SCREEN_OFF:'SCREEN_OFF',COMMON_EVENT_SCREEN_ON:'SCREEN_ON',
   COMMON_EVENT_SCREEN_LOCKED:'SCREEN_LOCKED',COMMON_EVENT_SCREEN_UNLOCKED:'SCREEN_UNLOCKED'},
   createSubscriber(options){const gate=deferred();creates.push({options,gate});return gate.promise;},
   async subscribeToEvent(subscriber,callback){callbacks.set(subscriber,callback);if(subscribeFailure?.(subscriber))throw Error('subscribe rejected');},
   unsubscribe(subscriber){unsubscribed.push(subscriber);callbacks.delete(subscriber);}};
 const body=source.replace(/^import[\s\S]*?;\n/gm,'').replace(/^export /gm,'');
 const Host=new Function('inputConsumer','KeyCode','commonEventManager','screenLock',stripTypeScriptTypes(body)+';return ReaderReadingSystemEventHost;')(
   inputConsumer,{KEYCODE_VOLUME_UP:'UP',KEYCODE_VOLUME_DOWN:'DOWN'},commonEventManager,{isScreenLocked:readScreenLock??(()=>screenState.promise)});
 return{host:new Host(),listeners,on,off,creates,unsubscribed,callbacks,screenState};
}
function volume() {
 const f=fixture(),directions=[];f.host.setVolumeKeyHandler(value=>directions.push(value));
 assert.deepEqual(f.on.map(x=>[x.type,x.options]),[['keyPressed',{key:'UP',action:1,isRepeat:false}],['keyPressed',{key:'DOWN',action:1,isRepeat:false}]]);
 f.listeners.get('UP')({});f.listeners.get('DOWN')({});assert.deepEqual(directions,['previous','next']);
 f.host.setVolumeKeyHandler(value=>directions.push('new:'+value));assert.equal(f.on.length,2,'handler replacement does not register twice');f.listeners.get('DOWN')({});assert.equal(directions.at(-1),'new:next');
 f.host.setVolumeKeyHandler(undefined);assert.equal(f.listeners.size,0);assert.equal(f.off.length,2);
 const broken=fixture({failDown:true});broken.host.setVolumeKeyHandler(()=>{});assert.equal(broken.listeners.size,0,'DOWN registration failure releases the already-owned UP');assert.equal(broken.off.length,2);
 f.host.dispose();f.host.setVolumeKeyHandler(()=>{});assert.equal(f.on.length,2,'disposed host cannot register again');
}
async function screenOff() {
 const f=fixture(),events=[];f.host.setScreenOffHandler(()=>events.push('old'));f.host.setScreenOffHandler(()=>events.push('current'));
 const systemEvents={events:['SCREEN_OFF','SCREEN_ON','SCREEN_LOCKED','SCREEN_UNLOCKED']};
 assert.deepEqual(f.creates.map(x=>x.options),[systemEvents,systemEvents]);
 const stale={},current={};f.creates[0].gate.resolve(stale);await tick();assert.deepEqual(f.unsubscribed,[stale]);assert.equal(f.callbacks.has(stale),false);
 f.creates[1].gate.resolve(current);await tick();f.callbacks.get(current)({event:'SCREEN_OFF'});assert.deepEqual(events,['current']);
 f.host.setScreenOffHandler(undefined);f.callbacks.get(current)({event:'SCREEN_OFF'});assert.deepEqual(events,['current'],'cleared handler does not dispatch');
 f.host.dispose();f.host.dispose();assert.deepEqual(f.unsubscribed,[stale,current],'owned subscriber released exactly once');
 const late=fixture();late.host.setScreenOffHandler(()=>assert.fail('retired event'));late.host.dispose();const subscriber={};late.creates[0].gate.resolve(subscriber);await tick();assert.deepEqual(late.unsubscribed,[subscriber]);assert.equal(late.callbacks.size,0);
 const rejected=fixture();rejected.host.setScreenOffHandler(()=>{});rejected.creates[0].gate.reject(Error('unsupported'));await tick();rejected.host.setScreenOffHandler(()=>{});assert.equal(rejected.creates.length,2,'failed creation can be retried by a mounted reader');rejected.host.dispose();rejected.creates[1].gate.resolve({});await tick();

 const lock=fixture(),states=[],lockSubscriber={};
 lock.host.setScreenLockHandler(locked=>states.push(locked));
 lock.creates[0].gate.resolve(lockSubscriber);await tick();
 lock.callbacks.get(lockSubscriber)({event:'SCREEN_LOCKED'});
 lock.screenState.resolve(false);await tick();
 assert.deepEqual(states,[true],'a late initial read cannot reopen a locked screen');
 lock.callbacks.get(lockSubscriber)({event:'SCREEN_UNLOCKED'});
 lock.callbacks.get(lockSubscriber)({event:'SCREEN_OFF'});
 lock.callbacks.get(lockSubscriber)({event:'SCREEN_ON'});await tick();
 assert.deepEqual(states,[true,false,true,false]);
 lock.host.dispose();
}
async function screenLockFallback() {
 const states=[], failed={}; let readCount=0;
 const f=fixture({subscribeFailure: subscriber=>subscriber===failed,
  readScreenLock:()=>{readCount++;throw Error('screen lock query unsupported');}});
 f.host.setScreenOffHandler(()=>{});
 f.creates[0].gate.resolve(failed);await tick();
 assert.deepEqual(f.unsubscribed,[failed],'failed registration releases its exact native subscriber');
 f.host.setScreenLockHandler(locked=>states.push(locked));
 const active={};f.creates[1].gate.resolve(active);await tick();
 const callback=f.callbacks.get(active);
 assert.doesNotThrow(()=>callback({event:'SCREEN_ON'}));
 callback({event:'SCREEN_LOCKED'});callback({event:'SCREEN_UNLOCKED'});
 await tick();
 assert.equal(readCount,2,'initial read and screen-on may both be rejected');
 assert.deepEqual(states,[true,false],'events continue to provide lock state when reads fail');
 f.host.dispose();callback({event:'SCREEN_ON'});
 assert.equal(readCount,2,'a retired subscriber cannot invoke the platform query');
}

const cases={volume,'screen-off':screenOff,'screen-lock-fallback':screenLockFallback};
for(const id of selectContractCases({volume:'Actual Host UP/DOWN, replacement, partial registration and disposal',
 'screen-off':'Actual Host latest subscriber, retirement and retry',
 'screen-lock-fallback':'Actual Host drops a failed subscriber and falls back to events on a synchronous or async screen-lock rejection'})){
 await cases[id]();recordContractCasePass(id);
}
