import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
const read = name => readFileSync(new URL('../entry/src/main/ets/app/' + name, import.meta.url), 'utf8');
const compile = (source, name, dependencies) => new Function(...Object.keys(dependencies), stripTypeScriptTypes(
  source.replace(/^import[\s\S]*?;\n/gm, '').replace(/^export /gm, '')) + '; return ' + name)(...Object.values(dependencies));
const ioSource = read('ReaderAtomicSnapshotFile.ts'), probeSource = read('ReaderAtomicSnapshotProbe.ts');
function fixture({ lostDirectorySync = false, brokenRecord = false } = {}) {
  const events = [], samples = [], files = new Map(); let clock = 0, failedWrites = 0;
  const fs = { OpenMode: { READ_ONLY: 0, READ_WRITE: 2 },
    async open(path) { events.push(['open', path]); return { fd: path }; },
    async close(file) { events.push(['close', file.fd]); },
    async fsync(fd) { events.push(['sync', fd]); if (fd === '/files' && lostDirectorySync) throw { code: 13900012 }; },
    async readText(path) { events.push(['read', path]); return files.get(path); },
    async unlink(path) { events.push(['unlink', path]); files.delete(path); },
    AtomicFile: class {
      constructor(path) { this.path = path; }
      startWrite() { return { on() {}, end: (raw, _encoding, done) => { this.raw = raw; queueMicrotask(done); } }; }
      finishWrite() { files.set(this.path, this.raw); events.push(['finish', this.path]); }
      failWrite() { failedWrites++; }
    },
  };
  const replaceReaderAtomicSnapshot = compile(ioSource, 'replaceReaderAtomicSnapshot', { fileIo: fs });
  const probe = compile(probeSource, 'probeReaderAtomicSnapshot', { fileIo: fs, replaceReaderAtomicSnapshot,
    util: { generateRandomUUID: () => '00000000-0000-4000-8000-000000000001' } });
  const run = (...arguments_) => {
    const [debug, mode, requested, current] = arguments_.length === 0 ? [true, 'debug', true] : arguments_;
    return probe(debug, mode, requested, '/files', current ?? (() => true), () => ++clock,
      sample => { samples.push(sample); if (brokenRecord) throw Error('logger unavailable'); });
  };
  return { run, events, samples, files, failedWrites: () => failedWrites };
}
for (const arguments_ of [[false, 'debug', true], [true, 'release', true], [true, 'debug', 'true'],
  [true, 'debug', 1], [true, 'debug', undefined], [true, 'debug', true, () => false],
  [true, 'debug', true, () => { throw Error('retired Runtime'); }]]) {
  const f = fixture(); await f.run(...arguments_); assert.deepEqual(f.events, []);
}
for (const brokenRecord of [false, true]) {
  const f = fixture({ brokenRecord }); await f.run();
  assert.deepEqual(f.samples.map(sample => [sample.phase, sample.status]),
    [['write', 'pass'], ['read', 'pass'], ['clear', 'pass'], ['cleanup', 'pass']]);
  assert.ok(f.samples[0].characters > 8192); assert.equal(f.files.size, 0);
  assert.equal(f.failedWrites(), 0); assert.equal(f.events.filter(event => event[0] === 'sync').length, 4);
  assert.ok(f.events.every(event => typeof event[1] !== 'string' ||
    event[1] === '/files' || event[1].startsWith('/files/reader-platform-atomic-')),
  'diagnostic never opens production intents, Core storage or user files');
  assert.ok(!JSON.stringify(f.samples).includes('probe.invalid'), 'report does not expose content/URLs');
}
{
  const f = fixture({ lostDirectorySync: true }); await f.run();
  assert.deepEqual(f.samples.map(sample => [sample.phase, sample.status]), [['write', 'unverified']]);
  assert.equal(f.samples[0].errorCode, 13900012); assert.equal(f.failedWrites(), 0);
  assert.equal(f.events.filter(event => event[0] === 'unlink').length, 0);
  assert.equal(f.files.size, 1, 'unknown actual write keeps only its unique synthetic scratch; no compensation');
}
const ability = readFileSync(new URL('../entry/src/main/ets/entryability/EntryAbility.ets', import.meta.url), 'utf8');
assert.match(ability, /DEBUG === true && BUILD_MODE_NAME === 'debug' && want\.parameters\?\.readerAtomicSnapshotProbe === true/);
const warm = ability.slice(ability.indexOf('  onNewWant('), ability.indexOf('  private async prepareSelectedReadingFont'));
assert.ok(!warm.includes('probeReaderAtomicSnapshot'), 'warm file Wants never start diagnostic IO');
console.log('PASS actual atomic IO helper and bounded cold-debug scratch probe: real DTO shape, exact opt-in, logger isolation and lost-directory-sync noncompensation. OS/restart acceptance separate.');
