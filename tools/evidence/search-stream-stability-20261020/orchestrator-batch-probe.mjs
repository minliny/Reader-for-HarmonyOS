// Explicit issue-local production-method evidence. No suite, SDK or device IO.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { createHash } from 'node:crypto';
import vm from 'node:vm';

const sourceUrl = new URL('../../../entry/src/main/ets/features/search/SearchOrchestrator.ets', import.meta.url);
const source = readFileSync(sourceUrl, 'utf8');
const facts = readFileSync(new URL('../../../entry/src/main/ets/app/ReaderOperationFacts.ts', import.meta.url), 'utf8');
const before = readFileSync(new URL('./orchestrator-before.txt', import.meta.url), 'utf8');
const clean = text => text.replace(/^import[\s\S]*?;\n/gm, '').replace(/^export\s+/gm, '');
const key = book => `${book.sourceId}\u0000${book.bookId}`;
const dto = (name = 'a', overrides = {}) => ({ sourceId: name, bookId: `${name}/book`,
  title: '所选作品', author: '作者', sourceName: name, category: 'novel',
  searchRequestId: 'request', sourceRuleVersion: 'v1', variables: [], ...overrides });
const emptyPatch = () => ({ upserted: [], removedKeys: [], captured: new Map(), retryIdentities: [] });
const patch = (captured, values = [], removedKeys = []) => ({ upserted: values, removedKeys,
  captured: new Map([...values.map(book => [key(book), captured.get(key(book))]),
    ...removedKeys.map(identity => [identity, captured.get(identity)])]), retryIdentities: [] });
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };

function setup(actual = source) {
  let now = 1000, nextTimer = 0;
  const timers = new Map(), outputs = [], requests = [];
  let nextResponse;
  const gateway = {
    resetBookProjection() {}, loadSources: async () => [], generateSearchRequestId: () => 'next-request',
    refreshBookDelta: async (index, change) => {
      requests.push({ index: new Map(index), change });
      const response = nextResponse; nextResponse = undefined;
      return response === undefined ? emptyPatch() : await response;
    },
  };
  class ClockDate extends Date { static now() { return now; } }
  const context = vm.createContext({ Map, Set, Date: ClockDate, console,
    setTimeout(fn, delay) { const id = ++nextTimer; timers.set(id, { fn, at: now + delay }); return id; },
    clearTimeout(id) { timers.delete(id); },
    SearchGateway: class { constructor() { return gateway; } },
    hilog: { info() {}, warn() {}, error() {} },
    ReaderRuntimeOwner: { current: () => ({}) },
  });
  const code = stripTypeScriptTypes(clean(facts) + '\n' + clean(actual) +
    '\nglobalThis.actualClasses={SearchOrchestrator,SearchQueryRun};');
  vm.runInContext(code, context, { filename: String(sourceUrl), timeout: 2000 });
  const { SearchOrchestrator, SearchQueryRun } = context.actualClasses;
  const owner = new SearchOrchestrator(value => outputs.push(value), () => {}, () => true, {});
  owner.sessionOpen = true; owner.session = 1; owner.work = 1; owner.resultGeneration = 1;
  const run = new SearchQueryRun('所选作品', 'request'); owner.run = run; owner.sweepAlive = true;
  run.sources = [{ sourceId: 'a' }, { sourceId: 'b' }]; run.totalSourceCount = 2;
  owner.present({ kind: 'loading', keyword: run.keyword });
  const accept = books => {
    for (const book of books) run.sourceResults.set(book.sourceId, [book]);
    run.revision += 1;
  };
  const first = dto(); accept([first]);
  owner.scheduleRunPublish(run, owner.work, owner.session);
  assert.equal(outputs.length, 2, 'first result publishes immediately');
  const tick = async delay => {
    const until = now + delay;
    for (;;) {
      const entry = [...timers.entries()].filter(([, task]) => task.at <= until).sort((a, b) => a[1].at - b[1].at)[0];
      if (!entry) break;
      now = entry[1].at; timers.delete(entry[0]); entry[1].fn();
      await Promise.resolve(); await Promise.resolve();
    }
    now = until; await Promise.resolve(); await Promise.resolve();
  };
  const enrich = async value => {
    nextResponse = patch(owner.resultIndex, [value]);
    await owner.refreshSharedBooks({ reset: false, identities: [{ sourceId: value.sourceId, bookId: value.bookId }] });
  };
  return { owner, run, outputs, timers, requests, accept, tick, enrich, first, gateway,
    respond(value) { nextResponse = value; }, last() { return outputs.at(-1); } };
}

async function sameBatch(actual) {
  const p = setup(actual), baseline = p.outputs.length;
  const enriched = { ...p.first, intro: '目录预取补齐简介' };
  await p.enrich(enriched);
  assert.equal(p.outputs.length, baseline, 'metadata must wait for the existing publication batch');
  assert.equal(p.timers.size, 1, 'metadata uses the single run timer');
  const timer = p.run.timer;
  await p.tick(50);
  const other = dto('b'); p.accept([other]); p.run.completed.add('b');
  p.owner.scheduleRunPublish(p.run, p.owner.work, p.owner.session);
  assert.equal(p.run.timer, timer, 'network joins the already scheduled metadata batch');
  await p.tick(49); assert.equal(p.outputs.length, baseline);
  await p.tick(1);
  assert.equal(p.outputs.length, baseline + 1);
  assert.equal(p.last().results.find(book => key(book) === key(enriched)), enriched);
  assert.equal(p.last().results.length, 2);
  assert.equal(p.last().completedSourceCount, 1, 'flush uses the latest network counters');
  assert.equal(p.last().delta.upserted.length, 2, 'one delta contains both causes');
  assert.equal(p.timers.size, 0);
}

const receipts = [];
try { await sameBatch(before); assert.fail('former source must expose unbatched metadata'); }
catch (error) {
  assert.match(error.message, /metadata must wait/);
  receipts.push('negative-control: former production source immediately emits metadata (reproduced)');
}
await sameBatch(source); receipts.push('network and warmup share one timer/delta with latest counters');

{
  const p = setup(), raw = p.run.results(), baseline = p.outputs.length;
  const one = { ...p.first, intro: '补齐一' }, two = { ...p.first, intro: '补齐二' };
  await p.enrich(one); await p.enrich(two);
  assert.equal(p.outputs.length, baseline); assert.equal(p.timers.size, 1);
  assert.equal(p.run.results(), raw, 'production raw-array cache really remains identical');
  await p.tick(100);
  assert.equal(p.last().results[0], two, 'unchanged raw pointer cannot swallow the newest enrichment');
  assert.equal(p.outputs.length, baseline + 1);
  receipts.push('same-raw fast path preserves latest coalesced metadata');
}
{
  const p = setup(); p.run.localStatus = 'done'; p.run.onlineStatus = 'done';
  p.owner.scheduleRunPublish(p.run, p.owner.work, p.owner.session);
  const baseline = p.outputs.length;
  await p.enrich({ ...p.first, intro: '结束后一' });
  await p.enrich({ ...p.first, intro: '结束后二' });
  assert.equal(p.outputs.length, baseline, 'settled metadata does not bypass batching');
  assert.equal(p.timers.size, 1); await p.tick(100);
  assert.equal(p.outputs.length, baseline + 1); assert.equal(p.last().searching, false);
  receipts.push('metadata remains batched after network completion');
}
for (const boundary of ['stop', 'settle', 'retry']) {
  const p = setup(), value = { ...p.first, intro: `flush at ${boundary}` };
  await p.enrich(value); const baseline = p.outputs.length;
  if (boundary === 'stop') p.owner.stop();
  if (boundary === 'settle') {
    p.run.localStatus = 'done'; p.run.onlineStatus = 'done';
    p.owner.scheduleRunPublish(p.run, p.owner.work, p.owner.session);
  }
  if (boundary === 'retry') {
    p.run.localStatus = 'failed'; p.run.localFailed = true;
    p.owner.performSearch = async () => {}; p.owner.retry();
  }
  assert.equal(p.outputs.length, baseline + 1, `${boundary} is immediate`);
  assert.equal(p.last().results[0], value, `${boundary} consumes already accepted pending metadata`);
  assert.equal(p.timers.size, 0);
  if (boundary === 'stop') {
    assert.equal(p.last().stopped, true); assert.equal(p.last().operation.canCancel, false);
    await p.enrich({ ...value, intro: '停止后的新元信息' });
    await p.tick(100);
    assert.equal(p.last().stopped, true); assert.equal(p.last().searching, false);
  }
  receipts.push(`${boundary} flushes accepted metadata immediately`);
}
for (const boundary of ['stop', 'search', 'close']) {
  const p = setup(), waiting = deferred();
  p.respond(waiting.promise);
  const captured = new Map(p.owner.resultIndex);
  const read = p.owner.refreshSharedBooks({ reset: false, identities: [{ sourceId: 'a', bookId: 'a/book' }] });
  if (boundary === 'stop') p.owner.stop();
  if (boundary === 'search') { p.owner.performSearch = async () => {}; p.owner.search('新查询'); }
  if (boundary === 'close') p.owner.close();
  const baseline = p.outputs.length;
  waiting.resolve(patch(captured, [{ ...p.first, intro: 'stale async payload' }])); await read; await p.tick(1000);
  assert.equal(p.outputs.length, baseline, `${boundary} rejects the prior query/work async patch`);
  assert.notEqual(p.last().results?.[0]?.intro, 'stale async payload');
  receipts.push(`${boundary} rejects stale async work`);
}
for (const boundary of ['search', 'close']) {
  const p = setup();
  await p.enrich({ ...p.first, intro: '前一查询已暂存元信息' });
  assert.equal(p.timers.size, 1);
  if (boundary === 'search') { p.owner.performSearch = async () => {}; p.owner.search('下一查询'); }
  else p.owner.close();
  const baseline = p.outputs.length; await p.tick(1000);
  assert.equal(p.outputs.length, baseline, `${boundary} retires the already staged query batch`);
  assert.equal(p.timers.size, 0);
  receipts.push(`${boundary} cancels a prepared but retired query batch`);
}
{
  const p = setup(), waiting = deferred(), captured = new Map(p.owner.resultIndex);
  p.respond(waiting.promise);
  const read = p.owner.refreshSharedBooks({ reset: false, identities: [{ sourceId: 'a', bookId: 'a/book' }] });
  p.owner.resultGeneration += 1;
  waiting.resolve(patch(captured, [{ ...p.first, intro: '旧结果代次' }]));
  await read; await p.tick(100);
  assert.equal(p.last().results[0], p.first);
  assert.equal(p.timers.size, 0);
  receipts.push('result-generation guard rejects an old asynchronous patch');
}
{
  const p = setup(), waiting = deferred(), captured = new Map(p.owner.resultIndex);
  p.respond(waiting.promise);
  const read = p.owner.refreshSharedBooks({ reset: false, identities: [{ sourceId: 'a', bookId: 'a/book' }] });
  const next = { ...p.first, sourceRuleVersion: 'v2', intro: '先完成的新版本' };
  p.accept([next]); p.owner.publishRun(p.run);
  const baseline = p.outputs.length;
  waiting.resolve(patch(captured, [{ ...p.first, intro: '读回捕获的旧DTO' }]));
  await read; await Promise.resolve(); await p.tick(100);
  assert.equal(p.last().results[0], next);
  assert.equal(p.outputs.length, baseline, 'captured-object rejection does not emit an obsolete replacement');
  assert.ok(p.requests.length >= 2, 'conflicting identity is reread against the latest published DTO');
  receipts.push('read completion rejects replaced captured DTOs and requeues the identity');
}
{
  const p = setup();
  await p.enrich({ ...p.first, intro: '旧版本补齐' });
  const next = { ...p.first, sourceRuleVersion: 'v2', intro: '新规则实时结果' };
  p.accept([next]); await p.tick(100);
  assert.equal(p.last().results[0], next, 'staged metadata cannot overwrite a newer raw source version');
  assert.equal(p.last().delta.upserted[0], next);
  receipts.push('flush rechecks captured identity and source version');
}
{
  const p = setup();
  const discovered = dto('b', { intro: 'Core确认关系成员' });
  p.respond(patch(p.owner.resultIndex, [discovered], [key(p.first)]));
  await p.owner.refreshSharedBooks({ reset: false, identities: [{ sourceId: 'a', bookId: 'a/book' }] });
  await p.tick(100);
  assert.equal(p.last().results.length, 1); assert.equal(p.last().results[0], discovered);
  assert.equal(p.last().delta.removedKeys[0], key(p.first));
  receipts.push('same batch retains confirmed removals and discovered relation members');
}
{
  const p = setup(); delete p.gateway.refreshBookDelta;
  const value = { ...p.first, intro: 'legacy gateway boundary' };
  p.gateway.refreshBooks = async () => [value];
  const baseline = p.outputs.length;
  await p.owner.refreshSharedBooks({ reset: false, identities: [{ sourceId: 'a', bookId: 'a/book' }] });
  assert.equal(p.outputs.length, baseline); await p.tick(100);
  assert.equal(p.last().results[0], value);
  receipts.push('existing refreshBooks fallback shares the publication batch');
}
const result = { status: 'PASS', source: String(sourceUrl), evidence: 'actual production ordinary methods with gateway and clock boundaries',
  sourceSha256: createHash('sha256').update(source).digest('hex'),
  negativeControlSha256: createHash('sha256').update(before).digest('hex'),
  receipts, notRun: ['SDK', 'full suites', 'Core/network IO', 'build/sign/install', 'ArkUI pixels/gestures', 'device/user acceptance'] };
writeFileSync(new URL('./orchestrator-batch-result.json', import.meta.url), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result, null, 2));
