// Selected production policy methods; no SDK lowering, Core or device IO.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { stripTypeScriptTypes, registerHooks } from 'node:module';
import { createHash } from 'node:crypto';
import vm from 'node:vm';

registerHooks({ resolve(specifier, context, next) {
  try { return next(specifier, context); }
  catch (error) {
    if (error.code === 'ERR_MODULE_NOT_FOUND' && specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier))
      return next(specifier + '.ts', context);
    throw error;
  }
} });
const base = new URL('../../../entry/src/main/ets/', import.meta.url);
const { bookAuthorIdentity, bookIdentityText } = await import(new URL('features/common/BookAuthorMetadata.ts', base));
const { RemoteReadingGatewayError } = await import(new URL('features/reading/RemoteReadingContract.ts', base));
const { isRemoteSourceFailureKind, remoteReadingFailureKindOf } = await import(new URL('features/reading/RemoteContentAdmission.ts', base));
const sourcePath = new URL('app/BookAcquisitionCoordinator.ts', base);
const source = readFileSync(sourcePath, 'utf8');
const before = readFileSync(new URL('./candidate-policy-before.txt', import.meta.url), 'utf8');
const clean = text => text.replace(/^import[\s\S]*?;\n/gm, '').replace(/^export\s+/gm, '');
const identity = value => value.identity?.sourceId ?? value.seed?.sourceId ?? value.sourceId;
const candidate = (sourceId, overrides = {}) => ({ seed: { sourceId, bookId: '/book', detailUrl: '/book',
  title: '选择的作品', author: '原作者', sourceVersion: 'v1', contentKind: 'text' },
  catalogReady: false, failed: false, ...overrides });
const session = seed => ({ identity: { sourceId: seed.sourceId, bookId: seed.bookId }, book: { title: seed.title,
  author: seed.author }, sourceVersion: seed.sourceVersion, contentKind: seed.contentKind,
  refreshRecommended: false, entries: [{ index: 0, title: '第一章', url: '/chapter' }] });
const allowed = () => new RemoteReadingGatewayError('emptyToc', '当前源没有可用目录', 'book.toc');
const bodyFailure = () => new RemoteReadingGatewayError('commandFailed', '正文为空', 'chapter.content',
  undefined, undefined, undefined, 'SOURCE_CONTENT_EMPTY');
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
const pause = () => new Promise(setImmediate);
const until = async predicate => { for (let n = 0; n < 100; n++) { if (predicate()) return; await pause(); } assert.fail('effect port was not reached'); };

function fixture(actual = source) {
  let now = 1000, timerId = 0, current = true;
  const queue = new Map(), acquired = [], verified = [], catalogs = [], sequence = [];
  class ClockDate extends Date { static now() { return now; } }
  const context = vm.createContext({ Map, Set, Date: ClockDate, console,
    bookAuthorIdentity, bookIdentityText, RemoteReadingGatewayError, isRemoteSourceFailureKind, remoteReadingFailureKindOf,
    setTimeout(callback, delay) { const id = ++timerId; queue.set(id, { callback, at: now + delay }); return id; },
    clearTimeout(id) { queue.delete(id); },
  });
  const code = stripTypeScriptTypes(clean(actual) + '\nglobalThis.ActualCoordinator=BookAcquisitionCoordinator;');
  vm.runInContext(code, context, { filename: String(sourcePath), timeout: 2000 });
  const owner = Object.create(context.ActualCoordinator.prototype);
  owner.closed = false; owner.registryReady = true; owner.versions = new Map();
  const ports = {
    acquire: async seed => session(seed),
    verify: async value => ({ ...value, verified: true }),
  };
  owner.acquireBook = async (seed, options, priority) => {
    acquired.push(seed.sourceId); sequence.push(`acquire:${seed.sourceId}`);
    return await ports.acquire(seed, options, priority);
  };
  owner.verifyCandidateBody = async (value, options, priority) => {
    verified.push(identity(value)); sequence.push(`verify:${identity(value)}`);
    return await ports.verify(value, options, priority);
  };
  const options = { isCurrent: () => current,
    onCatalog(value) { catalogs.push(value); sequence.push(`catalog:${identity(value)}`); } };
  const advance = async duration => {
    const target = now + duration;
    await pause();
    for (let n = 0; n < 1000; n++) {
      const next = [...queue].filter(([, task]) => task.at <= target).sort((a, b) => a[1].at - b[1].at)[0];
      if (!next) { now = target; await pause(); return; }
      now = next[1].at; queue.delete(next[0]); next[1].callback(); await pause();
    }
    assert.fail('virtual timer work bound exceeded');
  };
  return { owner, ports, options, acquired, verified, catalogs, sequence, queue, advance,
    cancel() { current = false; },
    run(candidates, overrides = {}, priority = 'foreground') {
      return owner.acquireCandidateGroup(candidates, { ...options, ...overrides }, priority);
    } };
}

async function primaryWins(actual) {
  for (const failed of [false, true]) {
    const f = fixture(actual);
    const admitted = await f.run([candidate('primary', { failed }), candidate('ready', { catalogReady: true })], { requireReadable: true });
    assert.equal(identity(admitted.session), 'primary', 'foreground must attempt the clicked primary before a ready fallback');
    assert.deepEqual(f.acquired, ['primary']); assert.deepEqual(f.verified, ['primary']);
    assert.deepEqual(f.catalogs.map(identity), ['primary']); assert.equal(f.queue.size, 0);
  }
}
async function noProvisionalFallback(actual) {
  const f = fixture(actual), gate = deferred();
  f.ports.verify = async value => {
    if (identity(value) === 'primary') throw bodyFailure();
    return await gate.promise;
  };
  const operation = f.run([candidate('primary'), candidate('fallback')], { requireReadable: true });
  await until(() => f.verified.includes('fallback'));
  const observedBeforeVerify = f.catalogs.map(identity);
  gate.resolve({ ...session(candidate('fallback').seed), verified: true });
  const admitted = await operation;
  assert.deepEqual(observedBeforeVerify, ['primary'], 'fallback catalog must wait for successful body verification');
  assert.equal(identity(admitted.session), 'fallback');
  assert.deepEqual(f.catalogs.map(identity), ['primary', 'fallback']);
  assert.equal(f.catalogs.at(-1).verified, true);
  assert.equal(f.queue.size, 0);
}

const receipts = [];
for (const [name, check, pattern] of [
  ['primary-priority', primaryWins, /foreground must attempt/],
  ['provisional-fallback', noProvisionalFallback, /fallback catalog must wait/],
]) {
  try { await check(before); assert.fail('old policy must be rejected'); }
  catch (error) { assert.match(error.message, pattern); receipts.push(`negative-control ${name}: former production policy rejected`); }
}
await primaryWins(source); receipts.push('primary success wins even with a prior failed flag and ready fallback');
await noProvisionalFallback(source); receipts.push('fallback publishes only its verified session');

{
  const f = fixture();
  f.ports.acquire = async seed => { if (seed.sourceId === 'primary') throw allowed(); return session(seed); };
  const admitted = await f.run([candidate('primary'), candidate('fallback')], { requireReadable: true });
  assert.equal(identity(admitted.session), 'fallback'); assert.deepEqual(f.acquired, ['primary', 'fallback']);
  assert.deepEqual(f.catalogs.map(identity), ['fallback']);
  receipts.push('an allowed actual primary failure opens fallback');
}
{
  const f = fixture();
  f.ports.acquire = async () => { throw new RemoteReadingGatewayError('storageFailure', '保留存储失败', 'book.detail'); };
  await assert.rejects(f.run([candidate('primary'), candidate('fallback')]), error => error.code === 'storageFailure');
  assert.deepEqual(f.acquired, ['primary']); assert.equal(f.catalogs.length, 0);
  receipts.push('fatal primary failure cannot enter fallback');
}
{
  const f = fixture(); f.ports.verify = async () => { throw bodyFailure(); };
  await assert.rejects(f.run([candidate('primary'), candidate('fallback'), candidate('last')], { requireReadable: true }), error => error.category === 'SOURCE_CONTENT_EMPTY');
  assert.deepEqual(f.acquired, ['primary', 'fallback', 'last']);
  assert.deepEqual(f.catalogs.map(identity), ['primary'], 'all body failures retain only the clicked primary catalog');
  assert.equal(f.catalogs[0].entries.length, 1); assert.equal(f.queue.size, 0);
  receipts.push('all body failures leave only the selected primary catalog');
}
{
  const f = fixture();
  const admitted = await f.run([candidate('primary'), candidate('ready', { catalogReady: true })], {}, 'background');
  assert.equal(identity(admitted.session), 'ready'); assert.deepEqual(f.acquired, ['ready']);
  assert.equal(f.verified.length, 0);
  receipts.push('background keeps readiness sorting and catalog-only acquisition');
}
{
  const f = fixture(); f.ports.acquire = async () => { throw allowed(); };
  await assert.rejects(f.run([candidate('u1'), candidate('u1'), candidate('u2'), candidate('u3'), candidate('u4'),
    candidate('ready', { catalogReady: true }), candidate('failed', { failed: true })], {}, 'background'));
  assert.deepEqual(f.acquired, ['ready', 'u1', 'u2', 'u3']);
  assert.equal(f.verified.length, 0); assert.equal(f.queue.size, 0);
  receipts.push('background preserves exact dedup, failed skip and three-unverified budget');
}
{
  const f = fixture();
  await f.run([candidate('failed', { failed: true })], { forceRefresh: true }, 'background');
  assert.deepEqual(f.acquired, ['failed']);
  receipts.push('explicit background forceRefresh still bypasses only the failed skip');
}
{
  const f = fixture();
  f.ports.acquire = async seed => { if (seed.sourceId === 'primary') throw allowed(); return session(seed); };
  const admitted = await f.run([candidate('primary'), candidate('fallback')], { requireReadable: false });
  assert.equal(identity(admitted.session), 'fallback'); assert.equal(f.verified.length, 0);
  assert.deepEqual(f.catalogs.map(identity), ['fallback']);
  receipts.push('requireReadable=false retains immediate catalog admission without body effects');
}
{
  const f = fixture();
  await assert.rejects(f.run([candidate('primary'), candidate('fallback')], { requireReadable: true,
    onCatalog(value) { f.catalogs.push(value); f.cancel(); } }), error => error.code === 'cancelled');
  assert.deepEqual(f.acquired, ['primary']); assert.equal(f.verified.length, 0);
  assert.deepEqual(f.catalogs.map(identity), ['primary']); assert.equal(f.queue.size, 0);
  receipts.push('cancellation in early primary callback blocks body verification and fallback');
}
{
  const f = fixture();
  f.ports.verify = async value => { if (identity(value) === 'primary') throw bodyFailure(); return { ...value, verified: true }; };
  await assert.rejects(f.run([candidate('primary'), candidate('fallback'), candidate('last')], { requireReadable: true,
    onCatalog(value) { f.catalogs.push(value); if (identity(value) === 'fallback') f.cancel(); } }), error => error.code === 'cancelled');
  assert.deepEqual(f.acquired, ['primary', 'fallback']);
  assert.equal(f.catalogs.at(-1).verified, true); assert.equal(f.queue.size, 0);
  receipts.push('cancellation in verified fallback callback prevents admission and further fallback');
}
{
  const f = fixture(), gate = deferred();
  f.ports.verify = async value => { if (identity(value) === 'primary') throw bodyFailure(); return await gate.promise; };
  const operation = f.run([candidate('primary'), candidate('fallback')], { requireReadable: true });
  const rejected = assert.rejects(operation, error => error.code === 'cancelled');
  await until(() => f.verified.includes('fallback')); f.cancel();
  gate.resolve({ ...session(candidate('fallback').seed), verified: true }); await rejected;
  assert.deepEqual(f.catalogs.map(identity), ['primary']); assert.equal(f.queue.size, 0);
  receipts.push('late verification after cancellation cannot publish fallback');
}
{
  const f = fixture(), gate = deferred(); f.ports.acquire = async () => await gate.promise;
  const operation = f.run([candidate('primary'), candidate('fallback')], { budgetMs: 30 });
  const rejected = assert.rejects(operation, error => error.code === 'cancelled' && /超时/.test(error.message));
  await f.advance(31); await rejected;
  gate.resolve(session(candidate('primary').seed)); await pause();
  assert.deepEqual(f.acquired, ['primary']); assert.equal(f.catalogs.length, 0); assert.equal(f.queue.size, 0);
  receipts.push('whole foreground deadline includes acquisition waiting and rejects late catalogs');
}

const result = { status: 'PASS', source: String(sourcePath),
  sourceSha256: createHash('sha256').update(source).digest('hex'),
  formerSourceSha256: createHash('sha256').update(before).digest('hex'),
  evidence: 'actual Coordinator ordinary methods; acquireBook/verifyCandidateBody and virtual clock are explicit ports', receipts,
  notRun: ['SDK/Index owner', 'unselected cases/full suites', 'Core/network IO', 'build/sign/install', 'device/user acceptance'] };
writeFileSync(new URL('./candidate-policy-result.json', import.meta.url), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result, null, 2));
