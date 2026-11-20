import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';
const cases = {
  'launch-gate': { description: 'Actual debug gate, LaunchParam private receipt and watcher disposal', resources: [] },
  'crash-bounds': { description: 'Actual own-app APP_CRASH whitelist, bounded file bytes, fsync/rename, stale callback', resources: [] },
};
for (const id of selectContractCases(cases)) { await run(id); recordContractCasePass(id); }
async function run(id) {
const { pureModuleProbe } = await import('./lib/ets-pure-module-probe.mjs');
// Proposed repository destination: tools/test-reader-crash-evidence.mjs.
// Actual production class lowered by the installed SDK; only official OS/file
// and encoding API boundaries are controlled. No exception-handler surrogate.
const source = readFileSync(new URL('../entry/src/main/ets/app/ReaderCrashEvidence.ts', import.meta.url), 'utf8');
const files = new Map(); const writes = []; const ioOrder = []; const watchers = []; const removed = [];
let activeFile;
const root = '/private-own-app/files/reader-diagnostics';
function own(path) {
  assert.ok([root, `${root}/crash-evidence.json`, `${root}/crash-evidence.json.tmp`].includes(path));
}
const fs = {
  OpenMode: { WRITE_ONLY: 1, CREATE: 2, TRUNC: 4 },
  async stat(path) { own(path); if (!files.has(path)) throw Error('ENOENT'); return { size: files.get(path).length }; },
  async readText(path, options) { own(path); assert.equal(options.length, 65536); return new TextDecoder().decode(files.get(path)); },
  async mkdir(path, recursive) { own(path); assert.equal(recursive, true); },
  async open(path) { own(path); activeFile = path; return { fd: 7 }; },
  async write(fd, bytes) { assert.equal(fd, 7); const value = new Uint8Array(bytes); files.set(activeFile, value.slice()); writes.push(value.length); ioOrder.push('write'); return value.length; },
  async fsync(fd) { assert.equal(fd, 7); ioOrder.push('fsync'); }, async close(file) { assert.equal(file.fd, 7); },
  async rename(from, to) { own(from); own(to); ioOrder.push('rename'); files.set(to, files.get(from)); files.delete(from); },
};
class EncoderPort { encodeInto(text) { return new TextEncoder().encode(text); } }
const hiAppEvent = { domain: { OS: 'OS' }, event: { APP_CRASH: 'APP_CRASH' },
  addWatcher(watcher) { watchers.push(watcher); return {}; }, removeWatcher(watcher) { removed.push(watcher); } };
const { ReaderCrashEvidence } = pureModuleProbe(source, 'ReaderCrashEvidence.ts',
  { fs, util: { TextEncoder: EncoderPort }, hiAppEvent }, ['ReaderCrashEvidence']);
assert.equal(ReaderCrashEvidence.install(false, '/private-own-app/files', {}), undefined);
assert.equal(watchers.length, 0); assert.equal(writes.length, 0);
const diagnostic = ReaderCrashEvidence.install(true, '/private-own-app/files', { lastExitReason: 2, lastExitMessage: 'previous exit' });
await diagnostic.tail;
const read = () => JSON.parse(new TextDecoder().decode(files.get(`${root}/crash-evidence.json`)));
assert.equal(read().records[0].message, 'previous exit'); assert.equal(read().records[0].reason, 2);
assert.deepEqual(watchers[0].appEventFilters, [{ domain: 'OS', names: ['APP_CRASH'] }]);
if (id === 'launch-gate') { diagnostic.stop(); assert.equal(removed[0], watchers[0]); return; }
const receive = event => watchers[0].onReceive('OS', [{ appEventInfos: [event] }]);
receive({ domain: 'OS', name: 'APP_CRASH', params: { bundle_name: 'foreign.bundle', time: 1, pid: 8 } });
await diagnostic.tail; assert.equal(read().records.length, 1);
for (let i = 0; i < 6; i++) {
  const params = { bundle_name: 'io.reader.minliny', time: 100 + i, pid: 10 + i,
    exception: { name: 'Error', message: '\u0001'.repeat(9000), stack: '中\u0001'.repeat(9000) } };
  Object.defineProperty(params, 'external_log', { get() { assert.fail('external logs must never be read'); } });
  receive({ domain: 'OS', name: 'APP_CRASH', params });
}
await diagnostic.tail;
assert.ok(read().records.length <= 4); assert.ok(writes.every(bytes => bytes <= 65536));
assert.ok(read().records.some(row => row.stack.length > 0));
assert.ok(read().records.every(row => row.stack.length <= 4096 && row.message.length <= 1024));
assert.equal(ioOrder.length, writes.length * 3);
for (let i = 0; i < ioOrder.length; i += 3) assert.deepEqual(ioOrder.slice(i, i + 3), ['write', 'fsync', 'rename']);
const before = writes.length;
receive({ domain: 'OS', name: 'APP_CRASH', params: { bundle_name: 'io.reader.minliny', time: 100, pid: 10 } });
await diagnostic.tail; assert.equal(writes.length, before, 'duplicate and bounded event admission');
diagnostic.stop(); assert.equal(removed[0], watchers[0]);
receive({ domain: 'OS', name: 'APP_CRASH', params: { bundle_name: 'io.reader.minliny', time: 999, pid: 99 } });
await diagnostic.tail; assert.equal(writes.length, before, 'retired watcher callback cannot append');
}
