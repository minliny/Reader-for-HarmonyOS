import { localFilePath, resolveArkFrontend, resolveEtsLoaderRoot } from './lib/tool-environment.mjs';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { createRequire, stripTypeScriptTypes } from 'node:module';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { readerMangaProbeSelectionMode } from '../entry/src/main/ets/app/ReaderControlVerificationLaunch.ts';
import { productionMotionMethods } from './lib/reader-motion-method-probe.mjs';

const file = new URL('../entry/src/main/ets/app/ReaderMangaPlatformDiagnostic.ts', import.meta.url);
const source = readFileSync(file, 'utf8');
const body = stripTypeScriptTypes(source.replace(/^import .*?;\n/gm, '').replace(/^export /gm, ''));
const tick = () => new Promise(resolve => setImmediate(resolve));
const event = (name = 'MAIN_THREAD_JANK', time = 1791122350000, params = {}) => ({ domain: 'OS', name,
  eventType: 1, params: { bundle_name: 'io.reader.minliny', time, pid: 2598, uid: 20020074,
    begin_time: time - 10869, end_time: time, log_over_limit: false, ...params } });
const path = '/data/storage/el2/log/watchdog/MAIN_THREAD_JANK_20261004215910_2598.txt';
const freezePath = '/data/storage/el2/log/hiappevent/APP_FREEZE_1791122350000_2598.log';
function fixture(history = [], options = {}) {
  const watchers = [], removed = [], configs = [], rows = [], reads = [], closes = [], files = new Map(), handles = new Map();
  let nextFd = 10;
  const holder = { setRow(n) { assert.equal(n, 1); }, takeNext() { return history.shift() ?? null; } };
  const hiAppEvent = { domain: { OS: 'OS' }, event: { MAIN_THREAD_JANK: 'MAIN_THREAD_JANK', APP_FREEZE: 'APP_FREEZE' },
    addWatcher(watcher) { watchers.push(watcher); return options.nullHolder ? null : holder; },
    removeWatcher(watcher) { removed.push(watcher); }, setEventConfig(name, config) {
      assert.equal(name, 'MAIN_THREAD_JANK'); configs.push(config); return options.configuration ?? Promise.resolve();
    } };
  const fs = { OpenMode: { READ_ONLY: 1 }, async lstat(p) {
    reads.push(['lstat', p]); const data = files.get(p); if (!data) throw Error('not found');
    return { size: data.length, isFile: () => true, isSymbolicLink: () => options.symlink === true };
  }, async open(p, mode) { assert.equal(mode, 1); const fd = nextFd++; handles.set(fd, { data: files.get(p), position: 0 }); return { fd }; },
  async read(fd, buffer, opts) {
    assert.equal(opts.offset, undefined, 'sequential filePointer reads must not add a repeated offset');
    assert.ok(buffer.byteLength <= 32768); reads.push(['read', buffer.byteLength]);
    const h = handles.get(fd), count = Math.min(opts.length, h.data.length - h.position);
    new Uint8Array(buffer).set(h.data.subarray(h.position, h.position + count)); h.position += count; return count;
  }, async close(file) { closes.push(file.fd); handles.delete(file.fd); } };
  class Encoder { encodeInto(text) { return new TextEncoder().encode(text); } }
  class Decoder { constructor() { this.decoder = new TextDecoder(); } decodeWithStream(bytes, opts) { return this.decoder.decode(bytes, opts); } }
  const hilog = { info(domain, tag, format, text) {
    assert.equal(domain, 0x5244); assert.equal(tag, 'ReaderMangaDfx'); assert.equal(format, 'MANGA_PLATFORM_DIAGNOSTIC %{public}s');
    rows.push({ text, row: JSON.parse(text) });
  } };
  const Diagnostic = new Function('fs', 'util', 'hiAppEvent', 'hilog', `${body};return ReaderMangaPlatformDiagnostic`)(
    fs, { TextEncoder: Encoder, TextDecoder: Decoder }, hiAppEvent, hilog);
  return { Diagnostic, watchers, removed, configs, rows, reads, closes, files, handles, holder };
}

{
  const f = fixture();
  for (const mode of [undefined, 'offline', 'true', true, false]) assert.equal(f.Diagnostic.install(mode), undefined);
  assert.equal(f.watchers.length, 0); assert.equal(f.configs.length, 0); assert.equal(f.reads.length, 0);
  // Reuse the actual existing cold-selection parser, including exact boolean,
  // generated debug fields and conflicts; the diagnostic admits its result only.
  for (const flag of [undefined, false, 'true', 1, {}, new Boolean(true)]) {
    assert.equal(f.Diagnostic.install(readerMangaProbeSelectionMode(true, 'debug', undefined, flag)), undefined);
  }
  assert.equal(f.Diagnostic.install(readerMangaProbeSelectionMode(false, 'debug', undefined, true)), undefined);
  assert.equal(f.Diagnostic.install(readerMangaProbeSelectionMode(true, 'release', undefined, true)), undefined);
  assert.equal(f.Diagnostic.install(readerMangaProbeSelectionMode(true, 'debug', true, true)), undefined);
  assert.equal(f.Diagnostic.install(readerMangaProbeSelectionMode(true, 'debug', undefined, true, [true])), undefined);
  assert.equal(f.watchers.length, 0);
}
console.log('PASS actual production diagnostic admits only existing exact debug reading-selection mode; no flag/release/conflict/offline performs no SDK or file work');

{
  for (const flag of [undefined, false, 'true', 1, {}, new Boolean(true)]) {
    const f = fixture(), d = f.Diagnostic.install('reading', flag); await d.tail;
    assert.equal(f.reads.length, 0, 'ordinary watcher mode never reads the fixed historical file'); d.stop();
  }
  for (const mode of [undefined, 'offline']) {
    const f = fixture(); assert.equal(f.Diagnostic.install(mode, true), undefined);
    assert.equal(f.watchers.length, 0); assert.equal(f.configs.length, 0); assert.equal(f.reads.length, 0);
  }
  const f = fixture();
  const stack = '9 #00 pc 123 /system/lib64/libace.z.so(Layout+10)\n';
  f.files.set(path, Buffer.from(stack.repeat(24000)));
  const d = f.Diagnostic.install('reading', true); await d.tail;
  const known = f.rows.find(x => x.row.kind === 'known-r31-history').row;
  assert.equal(known.event, 'MAIN_THREAD_JANK'); assert.equal(known.pid, 2598); assert.equal(known.time, 1791122350000);
  assert.equal(known.text, 'fixed-r31-file-not-new-os-event');
  assert.equal(f.rows.filter(x => x.row.kind === 'event').length, 0, 'fixed history is never represented as fresh OS delivery');
  assert.deepEqual(f.reads.filter(x => x[0] === 'lstat'), [['lstat', path]], 'the one recorded path is read, without listing or Want parameters');
  assert.ok(f.rows.some(x => x.row.kind === 'log-present')); assert.ok(f.rows.some(x => x.row.kind === 'stack'));
  assert.ok(d.readBytes <= 1024 * 1024); assert.ok(d.emittedBytes <= 1024 * 1024); assert.equal(f.handles.size, 0); d.stop();
  const missing = fixture(), absent = missing.Diagnostic.install('reading', true); await absent.tail;
  assert.ok(missing.rows.some(x => x.row.kind === 'known-r31-history'));
  assert.ok(missing.rows.some(x => x.row.kind === 'log-unavailable')); assert.deepEqual(missing.reads, [['lstat', path]]); absent.stop();
}
console.log('PASS strict reading-only fixed r31 history flag; no default/string/offline read, exact fixed metadata/path, separate historical receipt, presence/missing and shared 1MiB bounds');

{
  const held = event('MAIN_THREAD_JANK', 1791122350000, { external_log: [path] });
  const f = fixture([{ appEventInfos: [held] }]);
  f.files.set(path, Buffer.from('Tid:2598, Name:.reader.minliny\n#00 pc 00000001 /system/lib64/libace.z.so(Layout+10)\n'
    + '10-04 Reader params=https://source.invalid/secret\n#01 pc 10 token=SECRET\n' + 'at MangaReadingSurface.rememberVisible (MangaReadingSurface.ts:440)\n'));
  const d = f.Diagnostic.install('reading'); await d.tail;
  assert.equal(f.watchers.length, 2);
  assert.ok(f.watchers[0].onReceive); assert.equal(f.watchers[0].onTrigger, undefined);
  assert.ok(f.watchers[1].onTrigger); assert.equal(f.watchers[1].onReceive, undefined);
  assert.deepEqual(f.watchers[1].triggerCondition, { row: 1 });
  assert.deepEqual(f.configs[0], { log_type: '1', sample_interval: '100', ignore_startup_time: '10', sample_count: '21', report_times_per_app: '3' });
  assert.equal(f.rows.filter(x => x.row.kind === 'event').length, 1, 'returned holder is proactively drained');
  assert.equal(f.rows.filter(x => x.row.kind === 'stack').length, 3);
  assert.ok(!f.rows.some(x => /https:|SECRET|params=/.test(x.text)));
  assert.ok(!f.rows.some(x => x.text.includes(path)), 'raw OS paths and arbitrary params are not output');
  f.watchers[0].onReceive('OS', [{ name: held.name, appEventInfos: [held] }]); await d.tail;
  assert.equal(f.rows.filter(x => x.row.kind === 'event').length, 1, 'live/history duplicate is joined');
  const freeze = event('APP_FREEZE', 1791122350001, { external_log: [freezePath] });
  f.files.set(freezePath, Buffer.from('#00 pc 123 /system/lib64/libeventhandler.z.so(epoll_wait+80)\n'));
  f.watchers[0].onReceive('OS', [{ name: 'APP_FREEZE', appEventInfos: [freeze] }]); await d.tail;
  assert.equal(f.rows.filter(x => x.row.kind === 'event').length, 2); assert.equal(f.closes.length, 2);
  d.stop(); d.stop(); await tick();
  assert.equal(f.removed.length, 2); assert.deepEqual(f.configs.at(-1), { log_type: '0' });
  const count = f.rows.length;
  f.watchers[0].onReceive('OS', [{ appEventInfos: [event()] }]); f.watchers[1].onTrigger(1, 20, f.holder); await tick();
  assert.equal(f.rows.length, count); assert.equal(f.handles.size, 0);
}
console.log('PASS real production live + proactive/onTrigger holder paths, Reader OS ownership, deduplication, stack-only output, cleanup and default restoration; controlled SDK callbacks are not history/device proof');

{
  // Official MainThreadSampler tree format keeps sample weight and indentation:
  // https://github.com/openharmony/docs/blob/master/zh-cn/application-dev/dfx/apptask-timeout-guidelines.md
  const weighted = ['9 #00 pc 0000757c /system/bin/appspawn(55679d09bcdea35bb1e0d4e1d9a3e58f)',
    '    1 #23 at wait2 (/entry/build/default/cache/default/XXX/entry/src/main/ets/pages/Index.js:16:12)'];
  const rejected = ['0 #00 pc 1 /system/lib.so', '-1 #00 pc 1 /system/lib.so',
    '1.2 #00 pc 1 /system/lib.so', '9 params=request-body', '1 #01 pc 1 token=SECRET',
    '1 #02 at fetch (https://source.invalid/private)'];
  const f = fixture(); f.files.set(path, Buffer.from([...weighted, ...rejected].join('\n') + '\n'));
  const d = f.Diagnostic.install('reading');
  d.admit(event('MAIN_THREAD_JANK', 1791122351000, { external_log: [path],
    heaviest_stack: [...weighted, ...rejected].join('\n') })); await d.tail;
  assert.deepEqual(f.rows.filter(x => x.row.kind === 'stack').map(x => x.row.text), [...weighted, ...weighted],
    'real sampler native/JS weighted frames retain count and tree indentation in event and external file output');
  assert.ok(!f.rows.some(x => /SECRET|request-body|https:/.test(x.text))); d.stop(); await tick();
}
console.log('PASS official aggregated native/JS stack tree preserves positive sample count and indentation; invalid prefixes and non-stack/secret/URL lines stay filtered');

{
  const f = fixture(), d = f.Diagnostic.install('reading');
  const badPaths = ['/data/storage/el2/base/secret.txt', '/data/log/faultlog/faultlogger/a.log', 'file://' + path,
    path.replace('_2598.txt', '_9999.txt'), path.replace('watchdog/', 'watchdog/../watchdog/'),
    path.replace('.txt', '.trace'), path.replace('MAIN_THREAD_JANK_', 'APP_FREEZE_')];
  for (let i = 0; i < badPaths.length; i++) d.admit(event('MAIN_THREAD_JANK', 100 + i, { external_log: [badPaths[i]] }));
  d.admit(event('MAIN_THREAD_JANK', 200, { external_log: path, custom_path: path, external_callback_log: path }));
  d.admit(event('MAIN_THREAD_JANK', 201, { bundle_name: 'other.app', external_log: [path] }));
  d.admit({ ...event('MAIN_THREAD_JANK', 202, { external_log: [path] }), domain: 'custom' });
  d.admit(event('APP_CRASH', 203, { external_log: [path] }));
  await d.tail; assert.deepEqual(f.reads, [], 'only genuine matching OS external_log string[] can reach filesystem');
  d.stop(); await tick();
  const symlink = fixture([], { symlink: true }); symlink.files.set(path, Buffer.from('#00 pc 1 secret\n'));
  const s = symlink.Diagnostic.install('reading'); s.admit(event('MAIN_THREAD_JANK', 301, { external_log: [path] }));
  await s.tail; assert.deepEqual(symlink.reads, [['lstat', path]]); assert.equal(symlink.closes.length, 0); s.stop();
}
console.log('PASS genuine OS external_log array only; other bundles/domains/events, custom params, traversal, physical paths, wrong PID, trace and symlinks cannot read');

{
  const f = fixture(), d = f.Diagnostic.install('reading');
  // More than one stream chunk; output accounting includes its fixed prefix.
  const stack = '#00 pc 123 /system/lib64/libace.z.so(' + 'A'.repeat(1000) + ')\n';
  f.files.set(path, Buffer.from(stack.repeat(1300)));
  d.admit(event('MAIN_THREAD_JANK', 401, { external_log: [path] })); await d.tail;
  assert.ok(d.readBytes <= 1024 * 1024); assert.ok(d.emittedBytes <= 1024 * 1024);
  assert.ok(f.rows.reduce((n, x) => n + Buffer.byteLength('MANGA_PLATFORM_DIAGNOSTIC ' + x.text), 0) <= 1024 * 1024);
  assert.ok(f.rows.filter(x => x.row.kind === 'stack').length > 20); assert.equal(f.handles.size, 0);
  for (let i = 0; i < 100; i++) d.admit(event('MAIN_THREAD_JANK', 500 + i));
  await d.tail; assert.equal(d.seen.size, 16); d.stop();
  const h = fixture(Array.from({ length: 100 }, (_, i) => ({ appEventInfos: [event('APP_FREEZE', 1000 + i)] })));
  const hd = h.Diagnostic.install('reading'); await hd.tail;
  assert.equal(hd.seen.size, 16); assert.ok(h.rows.some(x => x.row.kind === 'history-package-limit')); hd.stop();
}
console.log('PASS production 16-event/package cap, sequential <=32KiB reads and total read/output <=1MiB; no arbitrary full-log buffering');

{
  let settle; const configuration = new Promise(resolve => { settle = resolve; });
  const f = fixture([], { configuration }), d = f.Diagnostic.install('reading'); d.stop();
  assert.equal(f.configs.length, 1); settle(); await tick(); assert.deepEqual(f.configs[1], { log_type: '0' });
  assert.ok(!f.rows.some(x => x.row.kind === 'configured'), 'late config receipt cannot publish after destruction');
  const failure = fixture([], { nullHolder: true }); const failed = failure.Diagnostic.install('reading'); await tick();
  assert.equal(failed.active, false); assert.equal(failure.removed.length, 1);
}
console.log('PASS null subscription and config completion after destroy keep cleanup/default order');

{
  const ability = new URL('../entry/src/main/ets/entryability/EntryAbility.ets', import.meta.url);
  const effects = [], destroyed = productionMotionMethods(ability, ['onDestroy'], {
    ReaderThemeHost: { detach() {} }, ReaderWindowCoordinator: { detach() {} }, AppStorage: { setOrCreate() {} },
    ReaderSystemFileOpenHost: { detach() {} }, hilog: { error() {} }, DOMAIN: 0x5244,
  });
  const a = new destroyed(); a.mangaPlatformDiagnostic = { stop() { effects.push('stop'); } }; a.onDestroy();
  assert.deepEqual(effects, ['stop']); assert.equal(a.mangaPlatformDiagnostic, undefined);
  const entry = readFileSync(ability, 'utf8');
  assert.match(entry, /ReaderMangaPlatformDiagnostic\.install\(mangaSelectionMode,\s*want\.parameters\?\.readerMangaRecordedJankR31 === true\)/);
  const warm = entry.slice(entry.indexOf('  onNewWant('), entry.indexOf('  private async prepareSelectedReadingFont'));
  assert.ok(!warm.includes('PlatformDiagnostic'), 'warm Wants never change the diagnostic owner');
  assert.doesNotMatch(source, /setInterval\(|new ThreadSampler|want\.parameters|import .*Want/,
    'the diagnostic uses platform sampling and accepts no Want descriptor');
}

// The actual production module matches installed official API types. This seam
// does not substitute for the later canonical ArkTS/HAP build or device proof.
{
  const require = createRequire(import.meta.url), sdk = resolveEtsLoaderRoot();
  const ts = require(`${sdk}/node_modules/typescript`), sdkRoot = `${sdk}/../..`;
  const virtual = localFilePath(new URL('../entry/src/main/ets/app/ReaderMangaPlatformDiagnosticSdkCheck.ts', import.meta.url));
  const text = source.replace(/^import type \{ MangaProbeSelectionMode \}.*?;\n/m, "type MangaProbeSelectionMode = 'reading' | 'offline';\n");
  const options = { noEmit: true, skipLibCheck: true, moduleResolution: ts.ModuleResolutionKind.NodeJs,
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, types: [], baseUrl: '/',
    paths: { '@ohos.*': [`${sdkRoot}/api/@ohos.*.d.ts`], '@kit.*': [`${sdkRoot}/kits/@kit.*.d.ts`] } };
  const roots = readdirSync(`${sdk}/declarations`).filter(n => n.endsWith('.d.ts')).map(n => `${sdk}/declarations/${n}`);
  function errors(text) {
    const host = ts.createCompilerHost(options), get = host.getSourceFile.bind(host);
    host.getSourceFile = (path, ...args) => path === virtual ? ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true) : get(path, ...args);
    return ts.getPreEmitDiagnostics(ts.createProgram([virtual, ...roots], options, host))
      .filter(x => x.category === ts.DiagnosticCategory.Error).map(x => ts.flattenDiagnosticMessageText(x.messageText, '\n'));
  }
  assert.deepEqual(errors(text), []);
  assert.ok(errors(text.replace('holder.setRow(1)', 'holder.setRow("wrong")')).length > 0, 'actual SDK rejects invalid holder arguments');
  const frontend = resolveArkFrontend();
  const parsed = spawnSync(frontend, ['--target-api-version', '23', '--module', '--parse-only', localFilePath(file)], { encoding: 'utf8' });
  assert.equal(parsed.status, 0, parsed.stderr || parsed.stdout || String(parsed.error));
  const dir = mkdtempSync(join(tmpdir(), 'reader-manga-dfx-'));
  try {
    const bad = join(dir, 'invalid.ts'); writeFileSync(bad, 'export const invalid = (;\n');
    assert.notEqual(spawnSync(frontend, ['--target-api-version', '23', '--module', '--parse-only', bad]).status, 0);
  } finally { rmSync(dir, { recursive: true, force: true }); }
}
console.log('PASS production Entry destruction and installed SDK HiAppEvent/file/decoder types + es2abc parse-only with negative control; historical delivery/native stacks not claimed');
