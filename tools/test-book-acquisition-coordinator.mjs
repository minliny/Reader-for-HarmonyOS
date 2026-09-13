import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
registerHooks({ resolve(specifier, context, nextResolve) {
  try { return nextResolve(specifier, context); }
  catch (error) {
    if (specifier.startsWith('.') && !specifier.endsWith('.ts')) return nextResolve(`${specifier}.ts`, context);
    throw error;
  }
} });
const { BookAcquisitionCoordinator } = await import('../entry/src/main/ets/app/BookAcquisitionCoordinator.ts');
const { BookRequestScheduler } = await import('../entry/src/main/ets/app/BookRequestScheduler.ts');
const { RemoteReadingFlowGateway } = await import('../entry/src/main/ets/features/reading/RemoteReadingFlowGateway.ts');
const deferred = () => { let resolve; let reject; const promise = new Promise((a,b) => { resolve=a; reject=b; }); return { promise, resolve, reject }; };
const tick = () => new Promise(resolve => setTimeout(resolve, 0));
async function until(predicate) { for (let i=0;i<150;i++) { if (predicate()) return; await tick(); } assert.fail('fixture did not settle'); }
const seed = (bookId, sourceId='s1') => ({ sourceId, bookId, detailUrl:bookId, title:'书', author:'作者', sourceVersion:'v1' });

function fixture() {
  const calls=[]; const gates=new Map(); const rows=new Map(); let version='v1';
  const key=(s,b)=>JSON.stringify([s,b]);
  const runtime = new BookAcquisitionCoordinator(async (method, params, options) => {
    calls.push({method,params,options});
    const bookId=params.bookId ?? params.book?.bookId ?? params.bookUrl;
    const id=key(params.sourceId ?? params.origin,bookId);
    const gate=gates.get(`${method}:${id}`); if(gate) await gate.promise;
    if (options.shouldCancel?.()) throw new Error('fixture cancelled');
    if(method==='source.list') return {data:{sources:['s1','s2'].map(sourceId=>({sourceId,name:sourceId,enabled:true,sourceVersion:version}))}};
    if(method==='search-book.get') return {data:{book:rows.get(id) ?? null}};
    if(method==='reading.progress.get') return {data:{found:false,progress:null}};
    if(method==='book.detail') {
      const book={bookId,title:'书的详情',author:'作者',intro:'详情简介'};
      rows.set(id,{origin:params.sourceId,bookUrl:bookId,name:book.title,author:book.author,variable:'{}',time:Date.now(),
        acquisition:{schemaVersion:1,sourceVersion:version,detailAt:Date.now()}});
      return {data:{sourceId:params.sourceId,book,sourceVersion:version,tocUrl:`${bookId}/toc`,variables:{token:'detail'}}};
    }
    if(method==='book.toc') {
      const row=rows.get(id); row.acquisition.catalogAt=Date.now(); row.acquisition.catalogCount=1;
      return {data:{sourceId:params.sourceId,bookId,toc:[{index:0,title:'第一章',url:`${bookId}/1`,variables:{chapter:'one'}}]}};
    }
    if(method==='chapter.content') return {data:{sourceId:params.sourceId,bookId,chapterTitle:'第一章',via:'rule',content:'清晨的阳光照进房间，书中的故事从这里开始。'.repeat(12)}};
    if(method==='search-book.put') {
      const row=rows.get(id); assert.ok(row,'verdict refers to a canonical candidate');
      assert.equal(params.acquisition.sourceVersion,version);
      row.acquisition={...row.acquisition,...params.acquisition};
      return {data:{book:row}};
    }
    if(method==='cache.book.status') return {data:{sourceId:params.sourceId,bookId:params.bookId,tocAvailable:false,chapters:[]}};
    throw new Error(`unhandled ${method}`);
  });
  return {runtime,calls,gates,rows,key,setVersion:v=>{version=v;}};
}

// Search preparation, detail click, and source switch join one book task.
{
  const f=fixture(); const gate=deferred(); f.gates.set(`book.detail:${f.key('s1','/same')}`,gate);
  f.runtime.beginSearch(); f.runtime.prepare([seed('/same')]);
  await until(()=>f.calls.some(c=>c.method==='book.detail'));
  let visible=true;
  const detail=f.runtime.acquireBook(seed('/same'),{isCurrent:()=>visible});
  const picker=f.runtime.acquireBook(seed('/same'));
  visible=false; f.runtime.endSearch(); gate.resolve();
  const [a,b]=await Promise.all([detail,picker]);
  assert.equal(a,b); assert.equal(a.sourceVersion,'v1');
  await until(()=>f.calls.some(c=>c.method==='search-book.put'));
  assert.equal(f.calls.filter(c=>c.method==='book.detail').length,1);
  assert.equal(f.calls.filter(c=>c.method==='book.toc').length,1);
  assert.equal(f.calls.filter(c=>c.method==='chapter.content').length,1);
  assert.equal(f.rows.get(f.key('s1','/same')).acquisition.stage,'readable');
  await f.runtime.acquireBook(seed('/same'));
  assert.equal(f.calls.filter(c=>c.method==='book.detail').length,1,'re-entry reuses the completed session');
  await f.runtime.request('book.toc', { sourceId: 's1', bookId: '/same', tocUrl: '/same/toc' });
  const renewed = await f.runtime.acquireBook(seed('/same'));
  assert.notEqual(renewed, a, 'a catalog refreshed elsewhere invalidates the old prepared projection');
  f.runtime.close();
}

// All candidates are queued; logical search exit releases only waiting work.
{
  const f=fixture(); const gates=[deferred(),deferred()];
  gates.forEach((gate,i)=>f.gates.set(`book.detail:${f.key('s1',`/b${i}`)}`,gate));
  f.runtime.prepare(Array.from({length:12},(_,i)=>seed(`/b${i}`)));
  await until(()=>f.calls.filter(c=>c.method==='book.detail').length===2);
  f.runtime.endSearch(); gates.forEach(g=>g.resolve());
  await until(()=>f.calls.filter(c=>c.method==='search-book.put').length===2);
  await tick();
  assert.equal(f.calls.filter(c=>c.method==='book.detail').length,2,'unadmitted preparation was released');
  f.runtime.close();
}

// Source-relative URLs are not global identities; real rule edits invalidate sessions.
{
  const f=fixture();
  const a=await f.runtime.acquireBook(seed('/same','s1'));
  const b=await f.runtime.acquireBook(seed('/same','s2'));
  assert.notEqual(a,b); assert.equal(f.rows.size,2);
  f.setVersion('v2'); await f.runtime.request('source.list');
  const updated=await f.runtime.acquireBook(seed('/same','s1'));
  assert.equal(updated.sourceVersion,'v2');
  assert.equal(f.calls.filter(c=>c.method==='book.detail'&&c.params.sourceId==='s1').length,2);
  f.runtime.close();
}

// A corrupt legacy continuation must fall back to fresh detail even when its
// catalog timestamp would otherwise qualify for the 24-hour cache path.
{
  const f = fixture();
  f.rows.set(f.key('s1', '/corrupt-variable'), {
    origin: 's1',
    bookUrl: '/corrupt-variable',
    name: '旧标题',
    author: '旧作者',
    variable: '{not-json',
    time: Date.now(),
    acquisition: {
      schemaVersion: 1,
      sourceVersion: 'v1',
      catalogAt: Date.now(),
    },
  });
  const session = await f.runtime.acquireBook(seed('/corrupt-variable'));
  assert.equal(session.identity.bookId, '/corrupt-variable');
  assert.equal(f.calls.filter(call => call.method === 'book.detail').length, 1,
    'corrupt variables must force one fresh acquisition instead of failing forever');
  f.runtime.close();
}

// A fresh prepared session is returned immediately while one process-owned
// refresh is started; the refresh must not inherit the page cancellation guard.
{
  const f = fixture();
  const first = await f.runtime.acquireBook(seed('/background'));
  let visible = true;
  const admission = await f.runtime.acquireBookWithBackgroundRefresh(seed('/background'), {
    isCurrent: () => visible,
  });
  assert.equal(admission.session, first, 'fresh cache remains the fast admission');
  assert.ok(admission.backgroundRefresh instanceof Promise, 'fresh cache starts one refresh');
  visible = false;
  await admission.backgroundRefresh;
  assert.equal(f.calls.filter(call => call.method === 'book.detail').length, 2,
    'background refresh performs one forced detail acquisition');
  f.runtime.close();
}

// An admitted chapter finishes after the page disappears. Cached/readable
// publication runs independently; a late UI guard must not abort its transport.
{
  const f=fixture(); const session=await f.runtime.acquireBook(seed('/read'));
  const gate=deferred(); f.gates.set(`chapter.content:${f.key('s1','/read')}`,gate);
  let visible=true;
  const gateway=new RemoteReadingFlowGateway({request:(...args)=>f.runtime.request(...args),bookAcquisitions:()=>f.runtime});
  const body=gateway.loadChapter(session,0,()=>visible);
  await until(()=>f.calls.some(c=>c.method==='chapter.content'));
  visible=false;
  assert.equal(f.calls.find(c=>c.method==='chapter.content').options.shouldCancel(),false);
  gate.resolve(); const chapter = await body;
  assert.ok(chapter.content.length > 100, 'admitted parsing finishes after the caller hides');
  await until(() => f.calls.some(c => c.method === 'search-book.put'));
  assert.equal(f.rows.get(f.key('s1', '/read')).acquisition.stage, 'readable');
  const attemptA = f.runtime.beginAttempt();
  assert.ok(f.runtime.beginAttempt() > attemptA, 'concurrent verdict attempts have ordered initiation stamps');
  f.runtime.close();
}

// A foreground request has reserved capacity while five lower-priority jobs run.
// Shared callers have independent cancellation guards and no durable response cache.
{
  const calls=[];const gates=[];
  const scheduler=new BookRequestScheduler(async (method,params,options)=>{
    const gate=deferred(); gates.push(gate); calls.push({method,params,options});
    await gate.promise;return {data:{sourceId:params.sourceId}};
  });
  const pending=[];
  for(let i=0;i<6;i++) pending.push(scheduler.request('book.search',{sourceId:`s${i}`,keyword:'x'},{},'v1','search'));
  assert.equal(calls.length,5);
  const body=scheduler.request('chapter.content',{sourceId:'reader',bookId:'b'},{},'v1','foreground');
  assert.equal(calls.length,6);assert.equal(calls[5].method,'chapter.content');
  gates[5].resolve();await body; await tick();
  assert.equal(calls.length,6,'the reserved slot does not admit a sixth search');
  gates[0].resolve();await pending[0];await tick();assert.equal(calls.length,7);
  gates.forEach(g=>g.resolve());await Promise.all(pending);
  let firstAlive=true;
  const one=scheduler.request('book.search',{sourceId:'shared',keyword:'x'},{shouldCancel:()=>!firstAlive},'v1','search');
  const two=scheduler.request('book.search',{sourceId:'shared',keyword:'x'},{},'v1','search');
  firstAlive=false;assert.equal(calls.at(-1).options.shouldCancel(),false);
  gates.at(-1).resolve();assert.equal(await one,await two);
  scheduler.close();
}
// Work queued behind the global limit has not been admitted to the network.
// Hiding pauses it as well; admitted work finishes and return dispatches once.
{
  const calls = []; const gates = [];
  const scheduler = new BookRequestScheduler(async (method, params, options) => {
    const gate = deferred(); gates.push(gate); calls.push({ method, params, options });
    await gate.promise; return { data: {} };
  });
  const admitted = Array.from({ length: 5 }, (_, i) => scheduler.request('book.search',
    { sourceId: `occupied-${i}`, keyword: 'original' }, {}, 'v1', 'search'));
  let visible = true; let alive = true;
  const waiting = scheduler.request('book.search', { sourceId: 'waiting', keyword: 'original' },
    { canDispatch: () => visible, shouldCancel: () => !alive }, 'v1', 'search');
  visible = false; scheduler.visibilityChanged();
  gates.forEach(gate => gate.resolve()); await Promise.all(admitted); await tick();
  assert.equal(calls.length, 5, 'free capacity must not dispatch a hidden queued source');
  visible = true; scheduler.visibilityChanged(); scheduler.visibilityChanged();
  assert.equal(calls.length, 6); assert.equal(calls[5].params.sourceId, 'waiting');
  gates[5].resolve(); await waiting;
  visible = false;
  const closed = scheduler.request('book.search', { sourceId: 'closed', keyword: 'original' },
    { canDispatch: () => visible, shouldCancel: () => !alive }, 'v1', 'search');
  const rejected = assert.rejects(closed, /取消/);
  alive = false; scheduler.visibilityChanged(); await rejected;
  visible = true; scheduler.visibilityChanged();
  assert.equal(calls.length, 6, 'logical exit releases hidden queued work without sending it');
  scheduler.close();
}
console.log('shared book acquisition lifecycle, identities, and scheduling: PASS');
