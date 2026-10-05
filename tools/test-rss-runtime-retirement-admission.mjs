import assert from 'node:assert/strict';
import { stripTypeScriptTypes } from 'node:module';
import { rssRouteFixture,rssSource,RssRuntime,settleRss,deferredRss,RealRssEditor } from './lib/rss-operation-fixture.mjs';
// Use the exact production static current() with instance unset, not a fixture
// that silently returns undefined. ReaderRuntimeOwner.close() unsets this slot.
const source=rssSource('app/ReaderRuntimeOwner.ts'),start=source.indexOf('  static current()'),end=source.indexOf('\n  async start()',start);
const unsetCurrent=new Function(`${stripTypeScriptTypes(`class ReaderRuntimeOwner { static instance; ${source.slice(start,end)} }`)}; return () => ReaderRuntimeOwner.current();`)();
assert.throws(unsetCurrent,/must be installed/);
const current=RssRuntime.current;let available=true;RssRuntime.current=()=>available?current():unsetCurrent();
try {
  for(const lost of [false,true]){
    available=true;const f=rssRouteFixture(),gate=deferredRss();let dispatched=false;
    f.runtime.before=async method=>{if(method==='rss.entry.read'){dispatched=true;await gate.promise;}};
    if(lost)f.runtime.lost.add('rss.entry.read');f.invoke('openEntry','s','g');while(!dispatched)await new Promise(r=>setImmediate(r));
    const before=f.operations.length;available=false;gate.resolve();await settleRss(f.owner);
    const retained=f.owner.routeOperations.entries.get(JSON.stringify(['s','g']));assert.equal(retained.operation.projection.receipt.confirmation,lost?'unknown':'confirmed');
    assert.equal(f.operations.length,before,'runtime-unset late receipt never reaches retired UI');assert.equal(retained.pending,0);
    assert.equal(f.runtime.count('rss.entry.read'),1);assert.equal(f.runtime.count('rss-source.list'),0,'retirement skips follow-up read without calling it a read failure');
    assert.doesNotThrow(()=>f.invoke('openEntry','s','g'));await settleRss(f.owner);assert.equal(f.runtime.count('rss.entry.read'),1);
  }
  for(const lost of [false,true]){
    available=true;const f=rssRouteFixture(),states=[],saved=[],gate=deferredRss();let dispatched=false;
    const editor=new RealRssEditor(s=>states.push(structuredClone(s)),id=>saved.push(id),()=>true,f.runtime,work=>f.owner.runSerialized(work));
    editor.openCreate();editor.updateFeedUrl('https://example.test/new');editor.updateTitle('preserved draft');
    f.runtime.before=async method=>{if(method==='rss-source.put'){dispatched=true;await gate.promise;}};
    if(lost)f.runtime.lost.add('rss-source.put');editor.save();while(!dispatched)await new Promise(r=>setImmediate(r));
    const count=states.length;available=false;gate.resolve();await settleRss(f.owner);
    const receipt=editor.receipts.get('create'),draft=editor.drafts.get('create');assert.equal(receipt.confirmation,lost?'unknown':'confirmed');
    assert.equal(draft.canSave,false,'teardown admission never re-enables a confirmed/unknown pending draft');assert.equal(draft.title,'preserved draft');assert.equal(draft.busy,false);
    assert.equal(states.length,count);assert.deepEqual(saved,[]);assert.equal(editor.pending.size,0);assert.equal(f.runtime.count('rss-source.put'),1);
  }
  available=true;const f=rssRouteFixture();f.owner.routeOperations.dependencies.ownsRuntime=()=>{throw Error('runtime unset');};
  assert.doesNotThrow(()=>f.invoke('refreshSourceFeed','s'));await settleRss(f.owner);assert.equal(f.runtime.count('rss.feed.refresh'),0);
  // Removing the actual safe admission in the real owner detects the defect.
  available=true;const negative=rssRouteFixture();negative.owner.ownsRuntime=()=>negative.runtime===RssRuntime.current();available=false;
  assert.throws(()=>negative.owner.routeOperations.dependencies.ownsRuntime(),/must be installed/);
} finally {available=true;RssRuntime.current=current;}
console.log('RSS runtime-unset admission PASS: exact current() throws, real owner/Gateway ACK or unknown survives late teardown, drafts stay locked, no UI callback/read/replay, pending settles; no device claim');
