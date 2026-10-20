// Explicit timer port for selected coalescing/cancellation contracts. Advancing
// this queue is scheduling evidence only, never elapsed-time/device latency.
export function controlledTimers(){
 const savedSet=globalThis.setTimeout,savedClear=globalThis.clearTimeout,queue=new Map();let now=0,sequence=0;
 globalThis.setTimeout=(callback,delay=0)=>{const id=++sequence;queue.set(id,{callback,at:now+delay});return id;};
 globalThis.clearTimeout=id=>queue.delete(id);
 return{get now(){return now;},async advance(ms){const target=now+ms;await new Promise(setImmediate);for(let turn=0;turn<2000;turn++){
  const next=[...queue].filter(([,t])=>t.at<=target).sort((a,b)=>a[1].at-b[1].at)[0];if(!next){now=target;return;}
  now=next[1].at;queue.delete(next[0]);next[1].callback();await new Promise(setImmediate);
 }throw Error('controlled timer work bound exceeded');},restore(){globalThis.setTimeout=savedSet;globalThis.clearTimeout=savedClear;queue.clear();}};
}
