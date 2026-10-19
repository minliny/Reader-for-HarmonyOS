import assert from 'node:assert/strict';
// Controlled port for production setTimeout(0) yields. No elapsed-time or UI
// frame claim: each queued callback is an explicit observable event-loop turn.
export async function withCooperativeTurns(run) {
 const nativeSet=globalThis.setTimeout,nativeClear=globalThis.clearTimeout,queue=new Map();let sequence=0;
 const clock={turns:0};globalThis.setTimeout=(callback,delay=0)=>{assert.equal(delay,0,'only cooperative zero-delay work belongs to this fixture');const id=++sequence;queue.set(id,callback);return id;};globalThis.clearTimeout=id=>queue.delete(id);
 let settled=false,result,failure;
 try {
  Promise.resolve().then(()=>run(clock)).then(v=>{result=v;settled=true;},e=>{failure=e;settled=true;});
  let idle=0;
  for(let work=0;!settled&&work<10000;work++){
   await new Promise(setImmediate);
   if(settled)break;
   const next=queue.entries().next();
   if(!next.done){idle=0;queue.delete(next.value[0]);clock.turns++;next.value[1]();}
   else assert.ok(++idle<100,'controlled task is waiting outside the declared cooperative queue');
  }
  assert.equal(settled,true,'cooperative work must terminate within the explicit fixture turn bound');if(failure)throw failure;return result;
 } finally {globalThis.setTimeout=nativeSet;globalThis.clearTimeout=nativeClear;}
}
