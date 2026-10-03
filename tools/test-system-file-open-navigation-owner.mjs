import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { ReaderSystemFileOpenQueue } from '../entry/src/main/ets/app/ReaderSystemFileOpenQueue.ts';

const source = readFileSync(new URL('../entry/src/main/ets/app/ReaderSystemFileOpenNavigationHost.ts', import.meta.url), 'utf8');
const tick = () => new Promise(resolve => setImmediate(resolve));
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
const book = { sourceId: 'local', bookId: 'local:fixture', title: '本地书', currentChapterIndex: 4,
  readingPosition: { chapterIndex: 4, chapterOffset: 217, updatedAt: 5 } };

function fixture(text = source) {
  const owner = {}, runtime = { current: owner }, events = [];
  const view = { foreground: true, reading: false, navigationGeneration: 1, readerIdentity: 'reader-entry-1', switchBlocked: false };
  let queue = new ReaderSystemFileOpenQueue(async () => ({ book }));
  const bridge = { peek: () => queue.peek(), subscribe: cb => queue.subscribe(cb), acknowledge: id => { events.push(['ack', id]); queue.acknowledge(id); } };
  const Owner = new Function('ReaderRuntimeOwner', 'ReaderSystemFileOpenHost', stripTypeScriptTypes(text
    .replace(/^import[\s\S]*?;\n/gm, '').replace(/^export /gm, '')) + '; return ReaderSystemFileOpenNavigationHost;')(
    { isCurrent: candidate => candidate === runtime.current }, bridge);
  const adapter = { isCurrent: () => true, view: () => view,
    resolveReaderTransaction: async () => { events.push(['query']); },
    notice: message => { events.push(['notice', message]); },
    open: value => { assert.deepEqual(value.readingPosition, book.readingPosition); events.push(['open', value.bookId]); } };
  const host = new Owner(owner, adapter);
  const enqueue = async (outcome, uri = 'file://provider/local.txt') => {
    if (outcome !== undefined) { queue.dispose(); queue = new ReaderSystemFileOpenQueue(async () => outcome); }
    assert.equal(queue.enqueue(uri), 'accepted'); await tick(); return queue.peek();
  };
  return { host, view, runtime, owner, events, adapter, enqueue, peek: bridge.peek, dispose: () => { host.dispose(); queue.dispose(); } };
}

// Actual bounded queue retains a cold result until a foreground mounted
// consumer exists; acknowledgement is navigation consumption, not a write ACK.
{
  const f = fixture(); await f.enqueue(); f.view.foreground = false; f.host.mount();
  assert.deepEqual(f.events, []); assert.ok(f.peek());
  f.view.foreground = true; f.host.consume(); assert.deepEqual(f.events.map(e => e[0]), ['open', 'ack']);
  f.host.consume(); assert.equal(f.events.length, 2); assert.equal(f.peek(), undefined); f.dispose();
}
// A system picker/result cannot skip the reader's existing progress-preserving
// exit. Reentry requests that exit once; cancellation keeps the imported book.
{
  const f = fixture(); f.view.reading = true; f.view.book = book; await f.enqueue(); f.host.mount();
  assert.deepEqual(f.events, []);
  f.view.requestExit = reason => { assert.equal(reason, 'navigation'); f.events.push(['exit']); f.host.consume(); };
  f.host.consume(); f.host.consume(); assert.deepEqual(f.events, [['exit']]);
  assert.equal(f.host.hasPendingExit(), true); assert.equal(f.host.readerExited(f.view.readerIdentity), true); assert.equal(f.host.readerExited(f.view.readerIdentity), false);
  f.view.reading = false; f.host.consume(); assert.deepEqual(f.events.map(e => e[0]), ['exit', 'open', 'ack']);
  f.view.reading = true; await f.enqueue(); f.host.consume(); f.host.cancelExit(f.view.readerIdentity);
  assert.equal(f.peek(), undefined); assert.equal(f.host.hasPendingExit(), false); f.dispose();
}
// The serialized reader reports its immutable entry identity. A delayed exit
// or cancel from an old physical ReaderShell cannot consume a successor's
// retained Want result, even when the reader reopened the very same book.
for (const cancel of [false, true]) {
  const f = fixture(); f.view.reading = true; f.view.book = book;
  f.view.requestExit = () => f.events.push(['exit', f.view.readerIdentity]);
  await f.enqueue(); f.host.mount(); const old = f.view.readerIdentity;
  f.view.readerIdentity = 'reader-entry-2'; f.view.navigationGeneration++;
  assert.equal(f.host.hasPendingExit(), false); f.host.consume();
  const settle = id => cancel ? f.host.cancelExit(id) : f.host.readerExited(id);
  const before = f.events.length;
  assert.equal(settle(old), false); assert.equal(f.events.length, before);
  assert.ok(f.peek()); assert.equal(f.host.hasPendingExit(), true);
  assert.equal(settle(f.view.readerIdentity), true);
  if (cancel) assert.equal(f.peek(), undefined); else assert.ok(f.peek());
  f.dispose();
}
// Same reader identity cannot consume a different queued result's ticket.
{
  const f = fixture(); f.view.reading = true; f.view.book = book;
  f.view.requestExit = () => f.events.push(['exit']); await f.enqueue(); f.host.mount();
  await f.enqueue({ book }, 'file://provider/next.txt');
  assert.equal(f.host.cancelExit(f.view.readerIdentity), false); assert.ok(f.peek()); f.dispose();
}
{
  const f = fixture(); f.view.switchBlocked = true; await f.enqueue(); f.host.mount(); f.host.consume();
  assert.deepEqual(f.events.map(e => e[0]), ['notice']); assert.ok(f.peek());
  f.view.switchBlocked = false; f.host.consume(); assert.deepEqual(f.events.map(e => e[0]), ['notice', 'open', 'ack']); f.dispose();
}
// Query the existing journal before a cold remote reader can exit. A discovered
// pending transaction defers the external navigation without dropping its book.
{
  const f = fixture(), gate = deferred(); f.view.reading = true; f.view.book = { sourceId: 'remote', bookId: 'remote-book' };
  f.adapter.resolveReaderTransaction = async () => { f.events.push(['query']); await gate.promise; f.view.switchBlocked = true; };
  await f.enqueue(); f.host.mount(); f.host.consume(); await tick(); assert.deepEqual(f.events, [['query']]);
  gate.resolve(); await tick(); assert.deepEqual(f.events.map(e => e[0]), ['query', 'notice']); assert.ok(f.peek());
  f.view.switchBlocked = false; f.view.requestExit = () => f.events.push(['exit']); f.host.consume();
  assert.equal(f.events.at(-1)[0], 'exit'); f.dispose();
}
for (const retirement of ['runtime', 'navigation', 'book', 'dispose', 'result']) {
  const f = fixture(), gate = deferred(); f.view.reading = true; f.view.book = { sourceId: 'remote', bookId: 'old' };
  f.adapter.resolveReaderTransaction = async () => { f.events.push(['query']); await gate.promise; };
  f.view.requestExit = () => f.events.push(['exit']); await f.enqueue(); f.host.mount(); await tick();
  if (retirement === 'runtime') f.runtime.current = {};
  if (retirement === 'navigation') f.view.navigationGeneration++;
  if (retirement === 'book') f.view.book = { sourceId: 'remote', bookId: 'new' };
  if (retirement === 'dispose') f.host.dispose();
  if (retirement === 'result') await f.enqueue({ book }, 'file://provider/new.txt');
  const before = f.events.length; gate.reject(new Error('late journal read failure')); await tick();
  assert.equal(f.events.length, before, retirement + ': old failure cannot notify/ack/open/exit in a successor');
  assert.ok(f.peek()); f.dispose();
}
// Background transition cannot strand the same checking tuple. A successful
// read may settle while hidden; actual exit waits for foreground publication.
for (const failed of [false, true]) {
  const f = fixture(), gate = deferred(); f.view.reading = true; f.view.book = { sourceId: 'remote', bookId: 'same' };
  let queries = 0; f.adapter.resolveReaderTransaction = async () => { queries++; if (queries === 1) await gate.promise; };
  f.view.requestExit = () => f.events.push(['exit']); await f.enqueue(); f.host.mount(); await tick(); f.view.foreground = false;
  if (failed) gate.reject(new Error('offline read')); else gate.resolve(); await tick();
  assert.deepEqual(f.events, []); assert.ok(f.peek()); f.view.foreground = true; f.host.consume(); await tick();
  assert.deepEqual(f.events, [['exit']]); assert.equal(queries, failed ? 2 : 1); f.dispose();
}
// UI/notification faults never rewrite the completed import or silently erase
// a result. Reentrant route publication cannot consume it twice.
{
  const f = fixture(); await f.enqueue({ failure: { code: 'readFailed', message: '读取失败' } });
  f.adapter.notice = () => { throw Error('native toast unavailable'); }; f.host.mount();
  assert.deepEqual(f.events.map(e => e[0]), ['ack']); assert.equal(f.peek(), undefined); f.dispose();
}
{
  const f = fixture(); await f.enqueue(); f.adapter.open = () => { throw Error('route adapter unavailable'); }; f.host.mount();
  assert.deepEqual(f.events.map(e => e[0]), ['notice']); assert.ok(f.peek());
  f.adapter.open = () => { f.events.push(['open']); f.host.consume(); }; f.host.consume();
  assert.deepEqual(f.events.map(e => e[0]), ['notice', 'open', 'ack']); f.dispose();
}
{
  const f = fixture(); f.view.reading = true; f.view.book = book;
  f.view.requestExit = () => { f.events.push(['exit']); throw Error('accepted callback publication lost'); };
  await f.enqueue(); f.host.mount(); f.host.consume();
  assert.equal(f.events.filter(e => e[0] === 'exit').length, 1); assert.ok(f.peek()); f.dispose();
}
// Controlled negative: without the actual Runtime identity guard an old
// mounted consumer would open/ack a replacement owner's queued result.
for (const guarded of [true, false]) {
  const text = guarded ? source : source.replace('ReaderRuntimeOwner.isCurrent(this.owner) && ', '');
  assert.ok(guarded || text !== source);
  const f = fixture(text); f.host.mount(); f.runtime.current = {}; await f.enqueue(); f.host.consume();
  assert.equal(f.events.some(e => e[0] === 'open'), !guarded); f.dispose();
}
console.log('PASS actual system-file queue → finite navigation Host: cold delivery, serialized exit/cancel, transaction deferral, exact Runtime/navigation/book/result retirement, background read settlement, notification/reentry faults and Runtime negative control. SDK/target evidence remains separate.');
