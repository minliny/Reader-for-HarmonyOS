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
      return {data:{sourceId:params.sourceId,bookId,sourceVersion:version,catalogAt:Date.now(),
        catalogVersion:`catalog:${bookId}`,contextVersion:`context:${bookId}`,catalogInstalled:true,
        continuationVariables:{token:'detail'},toc:[{index:0,title:'第一章',url:`${bookId}/1`,variables:{chapter:'one'}}]}};
    }
    if(method==='chapter.content') return {data:{sourceId:params.sourceId,bookId,chapterTitle:'第一章',via:'rule',
      bodyVersion:'body-v1',processingVersion:'processing-v1',content:'清晨的阳光照进房间，书中的故事从这里开始。'.repeat(12)}};
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
  const [a,b]=await Promise.allSettled([detail,picker]);
  assert.equal(a.status,'rejected'); assert.equal(a.reason.code,'cancelled');
  assert.equal(b.status,'fulfilled'); assert.equal(b.value.sourceVersion,'v1');
  await until(()=>f.runtime.preparationActive===0);
  assert.equal(f.calls.filter(c=>c.method==='book.detail').length,1);
  assert.equal(f.calls.filter(c=>c.method==='book.toc').length,1);
  assert.equal(f.calls.filter(c=>c.method==='chapter.content').length,0,'speculative catalog never fetches body');
  assert.equal(f.calls.filter(c=>c.method==='reading.progress.get').length,0);
  assert.equal(f.rows.get(f.key('s1','/same')).acquisition.stage,undefined);
  await f.runtime.acquireBook(seed('/same'));
  assert.equal(f.calls.filter(c=>c.method==='book.detail').length,1,'re-entry reuses the completed session');
  await f.runtime.request('book.toc', { sourceId: 's1', bookId: '/same', tocUrl: '/same/toc' });
  const renewed = await f.runtime.acquireBook(seed('/same'));
  assert.notEqual(renewed, b.value, 'a catalog refreshed elsewhere invalidates the old prepared projection');
  f.runtime.close();
}

// Only a bounded catalog window is queued; exit cancels unowned active work too.
{
  const f=fixture(); const gates=[deferred(),deferred()];
  gates.forEach((gate,i)=>f.gates.set(`book.detail:${f.key('s1',`/b${i}`)}`,gate));
  f.runtime.prepare(Array.from({length:12},(_,i)=>seed(`/b${i}`)));
  await until(()=>f.calls.filter(c=>c.method==='book.detail').length===2);
  f.runtime.endSearch(); gates.forEach(g=>g.resolve());
  await until(()=>f.runtime.preparationActive===0);
  assert.equal(f.calls.filter(c=>c.method==='book.toc').length,0,'unowned preparation must not continue from detail into TOC');
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

// A freshly prepared catalog is already current; opening it must not refresh again.
{
  const f = fixture();
  const first = await f.runtime.acquireBook(seed('/background'));
  let visible = true;
  const admission = await f.runtime.acquireBookWithBackgroundRefresh(seed('/background'), {
    isCurrent: () => visible,
  });
  assert.equal(admission.session, first, 'fresh cache remains the fast admission');
  assert.equal(admission.backgroundRefresh, undefined, 'fresh catalog must not trigger duplicate HTTP');
  visible = false;
  await admission.backgroundRefresh;
  assert.equal(f.calls.filter(call => call.method === 'book.detail').length, 1,
    'fresh preparation is the single detail acquisition');
  f.runtime.close();
}

// The last chapter consumer leaving must cancel Core work and must not publish
// a late readability proof. Starting transport is not an extra consumer.
{
  const f=fixture(); const session=await f.runtime.acquireBook(seed('/read'));
  const gate=deferred(); f.gates.set(`chapter.content:${f.key('s1','/read')}`,gate);
  let visible=true;
  const gateway=new RemoteReadingFlowGateway({request:(...args)=>f.runtime.request(...args),bookAcquisitions:()=>f.runtime});
  const body=gateway.loadChapter(session,0,()=>visible);
  await until(()=>f.calls.some(c=>c.method==='chapter.content'));
  visible=false;
  assert.equal(f.calls.find(c=>c.method==='chapter.content').options.shouldCancel(),true);
  const cancelled=assert.rejects(body,/cancelled|取消/);gate.resolve();await cancelled;
  assert.equal(f.calls.some(c => c.method === 'search-book.put'),false,'cancellation cannot publish a readability or bad-source proof');
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

// canContinue belongs to each shared consumer. A shorter deadline or lost
// session from the first caller cannot cancel a later still-valid caller.
for (const command of ['book.detail','book.toc','chapter.content']) {
 const calls=[],gates=[];
 const scheduler=new BookRequestScheduler(async(method,params,options)=>{
  const gate=deferred();gates.push(gate);calls.push({method,params,options});await gate.promise;
  if(options.shouldCancel())throw Error('Core operation cancelled');return{data:{sourceId:params.sourceId}};
 });
 let firstAlive=true,secondAlive=true;
 const params={sourceId:'shared',bookId:'b'};
 const first=scheduler.request(command,params,{canContinue:()=>firstAlive},'v1','foreground');
 const second=scheduler.request(command,params,{canContinue:()=>secondAlive},'v1','background');
 firstAlive=false;assert.equal(calls[0].options.shouldCancel(),false);
 secondAlive=false;assert.equal(calls[0].options.shouldCancel(),true);
 const rejected=Promise.all([assert.rejects(first,/cancelled/),assert.rejects(second,/cancelled/)]);
 // A new same-key consumer gets a separate request and cannot undo Core cancel.
 const third=scheduler.request(command,params,{},'v1','foreground');
 assert.equal(calls.length,2);firstAlive=true;assert.equal(calls[0].options.shouldCancel(),true);
 assert.equal(calls[1].options.shouldCancel(),false);gates.forEach(g=>g.resolve());
 await rejected;assert.equal((await third).data.sourceId,'shared');await tick();assert.equal(scheduler.active,0);
 scheduler.close();
}
console.log('shared detail/TOC/body cancellation: each consumer owns its lifetime; Core cancellation cannot be revived PASS');

// PH65: every source-changing entry, including WebDAV storage apply, invalidates both sides.
for (const method of ['source.import', 'source.update', 'source.delete', 'runtime.storage.apply', 'runtime.storage.restore']) {
  for (const fail of [false, true]) {
    const gate = deferred();
    const owner = new BookAcquisitionCoordinator(async command => {
      if (command === method) { await gate.promise; if (fail) throw Error('uncertain mutation'); }
      return { data: {} };
    });
    const before = owner.sourceRegistryRevision();
    const pending = owner.request(method, {});
    assert.ok(owner.sourceRegistryRevision() > before, `${method} invalidates reads admitted before the mutation`);
    const during = owner.sourceRegistryRevision();
    gate.resolve();
    if (fail) await assert.rejects(pending, /uncertain mutation/); else await pending;
    assert.ok(owner.sourceRegistryRevision() > during, `${method} invalidates reads admitted during the mutation`);
    const after = owner.sourceRegistryRevision();
    await owner.request('search-book.list');
    assert.equal(owner.sourceRegistryRevision(), after, 'book metadata reads do not invalidate the source cache');
    owner.close();
  }
}
{
  const list = deferred();
  const owner = new BookAcquisitionCoordinator(async command => {
    if (command === 'source.list') { await list.promise; return { data: { sources: [{ sourceId: 'removed', enabled: true, sourceVersion: 'old' }] } }; }
    return { data: {} };
  });
  const pending = owner.request('source.list');
  await owner.request('source.delete', { sourceIds: ['removed'] });
  list.resolve(); await pending;
  assert.equal(owner.versions.has('removed'), false, 'late registry response cannot resurrect a deleted identity');
  assert.equal(owner.registryReady, false);
  owner.close();
}
console.log('PH65 registry epoch: five mutation entries success/failure and late list deletion race PASS');

// R1/R2: the original engineering failures replay the real coordinator and
// gateway with controlled Core responses, clock and request queue.
function cachedFixture({ catalogAt = Date.now() - 2 * 86400000, cache = true, detailGate, tocGate, searchGate } = {}) {
  const calls = [];
  const runtime = new BookAcquisitionCoordinator(async (method, params, options) => {
    calls.push({ method, params, options });
    if (method === 'book.search') { await searchGate.promise; return { data: { sourceId: params.sourceId, books: [] } }; }
    if (method === 'source.list') return { data: { sources: [{ sourceId: 's1', enabled: true, sourceVersion: 'v1' }] } };
    if (method === 'search-book.get') return { data: { book: { origin: 's1', bookUrl: params.bookUrl,
      name: '缓存目录', author: '作者', variable: '{}', acquisition: { schemaVersion: 2, sourceVersion: 'v1', catalogAt } } } };
    if (method === 'cache.book.status') return { data: { sourceId: 's1', bookId: params.bookId, tocAvailable: cache,
      sourceVersion: 'v1', catalogAt, catalogVersion: 'cached-catalog', contextVersion: 'cached-context',
      continuationVariables: {}, chapters: cache ? [{ chapterIndex: 0, title: '第一章', url: '/1', variables: {} }] : [] } };
    if (method === 'book.detail') {
      if (detailGate) await detailGate.promise;
      return { data: { sourceId: 's1', sourceVersion: 'v1', book: { bookId: params.book.bookId, title: '刷新目录', author: '作者' }, tocUrl: '/toc', variables: {} } };
    }
    if (method === 'book.toc') {
      if (tocGate) await tocGate.promise;
      return { data: { sourceId: 's1', bookId: params.bookId, sourceVersion: 'v1', catalogAt: Date.now(),
        catalogVersion: 'fresh-catalog', contextVersion: 'fresh-context', catalogInstalled: true, continuationVariables: {},
        toc: [{ index: 0, title: '第一章', url: '/1', variables: {} }] } };
    }
    if (method === 'search-book.put') return { data: {} };
    throw Error(`unhandled ${method}`);
  });
  return { runtime, calls };
}

for (const failAt of ['none', 'detail', 'toc']) {
  const detailGate = deferred(); const tocGate = deferred();
  const f = cachedFixture({ detailGate, tocGate });
  const first = await f.runtime.acquireBookWithBackgroundRefresh(seed('/cached'));
  assert.equal(first.session.book.title, '缓存目录');
  await until(() => f.calls.some(call => call.method === 'book.detail'));
  let settled = false;
  const secondPromise = f.runtime.acquireBookWithBackgroundRefresh(seed('/cached')).then(value => { settled = true; return value; });
  await until(() => settled);
  const second = await secondPromise;
  assert.equal(second.session, first.session, 'running refresh must not block a usable complete session');
  if (failAt === 'detail') detailGate.reject(Error('detail unavailable'));
  else {
    detailGate.resolve();
    await until(() => f.calls.some(call => call.method === 'book.toc'));
    const duringToc = await f.runtime.acquireBook(seed('/cached'));
    assert.equal(duringToc, first.session, 'detail completion cannot evict the complete cached session');
    if (failAt === 'toc') tocGate.reject(Error('catalog unavailable')); else tocGate.resolve();
  }
  const outcomes = await Promise.allSettled([first.backgroundRefresh, second.backgroundRefresh]);
  assert.ok(outcomes.every(result => result.status === (failAt === 'none' ? 'fulfilled' : 'rejected')));
  const next = await f.runtime.acquireBook(seed('/cached'));
  assert.equal(next.book.title, failAt === 'none' ? '刷新目录' : '缓存目录');
  assert.equal(f.calls.filter(call => call.method === 'book.detail').length, 1, 'all refresh subscribers share one real request');
  f.runtime.close();
}

{
  const original = Date.now; let now = 2000000000000; Date.now = () => now;
  const detailGate = deferred();
  const f = cachedFixture({ catalogAt: now - 23 * 3600000, detailGate });
  try {
    const first = await f.runtime.acquireBookWithBackgroundRefresh(seed('/age'));
    assert.equal(first.backgroundRefresh, undefined);
    now += 23 * 3600000;
    const aged = await f.runtime.acquireBookWithBackgroundRefresh(seed('/age'));
    assert.equal(aged.session.catalogAt, first.session.catalogAt);
    assert.ok(aged.backgroundRefresh, '46-hour-old TOC must refresh despite being in prepared less than a day');
    detailGate.resolve(); await aged.backgroundRefresh;
    assert.equal(f.calls.filter(call => call.method === 'book.detail').length, 1);
  } finally { f.runtime.close(); Date.now = original; }
}

for (const scenario of ['stop', 'hide-resume', 'foreground-takeover']) {
  const searchGate = deferred(); const detailGate = deferred();
  const f = cachedFixture({ cache: false, searchGate, detailGate });
  const occupied = Array.from({ length: 5 }, (_, i) => f.runtime.request('book.search', { sourceId: `busy-${i}`, keyword: 'q' }));
  f.runtime.beginSearch(); f.runtime.prepare([seed('/queued')]);
  await until(() => f.runtime.scheduler.queue.some(job => job.method === 'book.detail'));
  f.runtime.setPreparationVisible(false);
  let foreground;
  if (scenario === 'foreground-takeover') {
    foreground = f.runtime.acquireBook(seed('/queued'));
    await tick();
  }
  if (scenario !== 'hide-resume') f.runtime.endSearch();
  searchGate.resolve(); await Promise.all(occupied); await tick();
  if (scenario === 'stop') {
    await until(() => f.runtime.preparationActive === 0);
    assert.equal(f.calls.filter(call => call.method === 'book.detail').length, 0, 'orphaned queued work performs no network call');
  } else {
    if (scenario === 'hide-resume') {
      assert.equal(f.calls.filter(call => call.method === 'book.detail').length, 0, 'hiding pauses undispatched work');
      f.runtime.setPreparationVisible(true);
    }
    await until(() => f.calls.some(call => call.method === 'book.detail'));
    f.runtime.endSearch(); detailGate.resolve();
    if (foreground) assert.equal((await foreground).identity.bookId, '/queued');
    await until(() => f.runtime.preparationActive === 0);
    assert.equal(f.calls.filter(call => call.method === 'book.detail').length, 1);
    assert.equal(f.calls.filter(call => call.method === 'book.toc').length, foreground ? 1 : 0,
      'only the retained foreground consumer keeps the chain after search exit');
  }
  f.runtime.close();
}

{
  const f = fixture(); const session = await f.runtime.acquireBook(seed('/scope'));
  const count = () => f.calls.filter(call => call.method === 'search-book.put').length;
  const start = count();
  await f.runtime.reportVerdict({ ...session, catalogVersion: undefined }, 0, '/scope/1', 'host', 'body', 'processing');
  await f.runtime.reportVerdict({ ...session, acquisitionMode: 'offline' }, 0, '/scope/1', 'host', 'body', 'processing');
  assert.equal(count(), start, 'legacy and offline sessions cannot fabricate scoped online facts');
  await f.runtime.reportVerdict(session, 0, '/scope/1', 'host', 'body', 'processing');
  const fact = f.calls.at(-1).params.acquisition;
  assert.equal(fact.schemaVersion, 2);
  assert.equal(fact.catalogVersion, session.catalogVersion);
  assert.equal(fact.contextVersion, session.contextVersion);
  assert.equal(fact.bodyVersion, 'body');
  assert.equal(fact.processingVersion, 'processing');
  assert.equal(fact.contentVersion, 'host');
  f.runtime.close();
}
console.log('R1/R2 cache-refresh separation, original freshness, dispatch consumers and scoped facts: PASS');
