import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { ReaderDocumentPickerActivity as Activity } from '../entry/src/main/ets/platform/ReaderDocumentPickerActivity.ts';
import { ReaderCustomFontDescriptor, normalizeReaderCustomFontDescriptor } from '../entry/src/main/ets/features/reading/application/ReaderAppearanceState.ts';
import { READER_LOCAL_BOOK_PICKER_FILTER, isReaderLocalBookFileName } from '../entry/src/main/ets/app/ReaderLocalBookFormatAdmission.ts';
import { localImportFailure } from '../entry/src/main/ets/app/LocalImportFailure.ts';
import { selectedProductionMethods, selectedProductionClasses } from './lib/selected-production-methods.mjs';
import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';

const definitions = {
  'host-inflight': 'Four actual Host select/save calls synchronously reserve until the exact Native Promise settles, including cancellation',
  'host-failure-admission': 'Four actual Host calls reject missing/background windows and preserve exact constructor/call/rejection errors with finally cleanup',
  'window-tickets': 'Actual concurrent Host calls, same-window reuse, old/new window isolation, foreground retention and unsubscribed microtask notifications',
  'stage-recovery-epoch': 'Actual local-book recovery await cannot launch on a replacement window or from background',
  'host-io-preserved': 'Actual original local selection limits, bounded JSON read, partial-write/fsync/close and font staging/checked-load cleanup remain outside picker pending',
  'official-activity-types': 'Complete actual Activity/Ticket sources and real API23 picker consumer pass strict semantic and ArkTS1.1 lint with illegal inputs rejected',
};
const selected = selectContractCases(definitions);
const file = path => new URL('../entry/src/main/ets/' + path, import.meta.url);
const tick = () => new Promise(resolve => setImmediate(resolve));
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const sites = ['books', 'json', 'save', 'font'];
let windowId = 9100;
function mount() { Activity.destroy(); Activity.bind(++windowId); Activity.setForeground(true); }

function fixture() {
  const calls = [], jobs = [], events = [], files = new Map(), handles = new Map();
  let nextFd = 0;
  const f = { calls, jobs, events, files, handles, mode: '', failure: { exact: 'foreign platform failure' },
    async beforeIo() {}, async recover() {}, async checkedLoad() {} };
  const io = {
    OpenMode: { READ_ONLY: 1, CREATE: 2, READ_WRITE: 4, TRUNC: 8 },
    async stat(path) { events.push(['stat', path, Activity.isPending()]); await f.beforeIo(); return { size: files.get(path)?.length ?? 0 }; },
    async access(path) { return files.has(path); },
    async mkdir() {},
    async open(path, mode) {
      events.push(['open', path, Activity.isPending()]); await f.beforeIo();
      if (mode !== 1) files.set(path, new Uint8Array());
      assert.ok(files.has(path), 'controlled platform file exists');
      const fd = ++nextFd; handles.set(fd, { path, offset: 0 }); return { fd };
    },
    async read(fd, buffer, options) {
      const handle = handles.get(fd), input = files.get(handle.path);
      const length = Math.min(buffer.byteLength, options?.length ?? buffer.byteLength, input.length - handle.offset);
      new Uint8Array(buffer).set(input.subarray(handle.offset, handle.offset + length)); handle.offset += length;
      return length;
    },
    async write(fd, buffer) {
      const handle = handles.get(fd), bytes = new Uint8Array(buffer), length = Math.min(2, bytes.length);
      const output = new Uint8Array(handle.offset + length); output.set(files.get(handle.path)); output.set(bytes.subarray(0, length), handle.offset);
      handle.offset += length; files.set(handle.path, output); events.push(['write', length]); return length;
    },
    async fsync(fd) { events.push(['fsync', fd]); },
    async close(handle) { events.push(['close', handle.fd]); handles.delete(handle.fd); },
    async rename(from, to) { files.set(to, files.get(from)); files.delete(from); },
    async unlink(path) { files.delete(path); events.push(['unlink', path]); },
  };
  const picker = {
    DocumentSelectOptions: class {}, DocumentSaveOptions: class {},
    DocumentViewPicker: class {
      constructor(context) {
        calls.push({ context, pendingAtConstruction: Activity.isPending() });
        if (f.mode === 'constructor-throw') throw f.failure;
      }
      select(options) { return this.invoke('select', options); }
      save(options) { return this.invoke('save', options); }
      invoke(kind, options) {
        Object.assign(calls.at(-1), { kind, options });
        if (f.mode === 'call-throw') throw f.failure;
        const job = deferred(); jobs.push(job); return job.promise;
      }
    },
  };
  const fileUri = { FileUri: class { constructor(uri) { if (uri === 'bad://no-name') throw Error('no name'); this.name = uri.split('/').at(-1); } } };
  const util = { TextEncoder, TextDecoder: { create: (encoding, options) => ({ decodeToString: bytes => new TextDecoder(encoding, options).decode(bytes) }) } };
  const dependencies = { ReaderDocumentPickerActivity: Activity, picker, fileIo: io, fileUri, util,
    READER_LOCAL_BOOK_PICKER_FILTER, isReaderLocalBookFileName, localImportFailure,
    errorMessageOf: error => error instanceof Error ? error.message : String(error), LOG_DOMAIN: 0,
    hilog: { warn() {}, error() {} }, ReaderCustomFontDescriptor, normalizeReaderCustomFontDescriptor,
    loadReaderFontChecked: (...args) => f.checkedLoad(...args),
    cryptoFramework: { createMd: () => { const hash = createHash('sha256'); return {
      async update(input) { hash.update(input.data); }, async digest() { return { data: hash.digest() }; },
    }; } },
  };
  const Host = selectedProductionMethods(file('app/ReaderHostRegistry.ts'), 'ReaderHostRegistry', [
    'LocalBookSelectionLimit', 'LocalBookStagingConcurrency', 'JsonDocumentLimitBytes', 'JsonDocumentReadChunkBytes',
    'selectLocalBookInputs', 'selectBoundedJsonDocument', 'saveBoundedJsonDocument',
    'requireSelectedFileName', 'requireExportFileName', 'readBoundedUtf8Document',
  ], dependencies);
  f.host = Object.assign(new Host(), { context: { test: 'actual UIAbilityContext port' },
    ensureStageRecovery: () => f.recover(),
    stageLocalBook: async (uri, name) => { events.push(['book-stage-port', uri, Activity.isPending()]); await f.beforeIo();
      return { fileName: name, bookId: 'retained:' + name, stagedPath: '/stage/' + name, assetKind: 'source' }; },
  });
  const Font = selectedProductionClasses(file('app/ReaderCustomFontHost.ts'), ['ReaderCustomFontHost'], dependencies).ReaderCustomFontHost;
  f.font = new Font({ filesDir: '/font-test' });
  f.invoke = site => site === 'books' ? f.host.selectLocalBookInputs(() => true) : site === 'json' ? f.host.selectBoundedJsonDocument('原标签') :
    site === 'save' ? f.host.saveBoundedJsonDocument('{"原字节":1}', 'original.json', '原标签', 'Original') : f.font.selectAndRegister(undefined);
  return f;
}

for (const id of selected) {
  mount();
  if (id === 'host-inflight') for (const site of sites) {
    const f = fixture(), work = f.invoke(site); await tick();
    assert.equal(f.calls.length, 1, site + ': one actual Native invocation');
    assert.equal(f.calls[0].pendingAtConstruction, true, site + ': reserve precedes real picker construction');
    assert.equal(Activity.isPending(), true, site + ': exact unresolved Native Promise blocks');
    f.jobs[0].resolve([]); const result = await work;
    assert.equal(Activity.isPending(), false);
    if (site === 'books') assert.deepEqual(result, []); else assert.equal(result, undefined);
    assert.deepEqual(f.events, [], site + ': cancelled picker starts no original I/O');
  }
  if (id === 'host-failure-admission') for (const site of sites) {
    for (const admission of ['no-window', 'background']) {
      mount(); if (admission === 'no-window') Activity.destroy(); else Activity.setForeground(false);
      const f = fixture(), rejected = assert.rejects(f.invoke(site), admission === 'no-window' ? /current main window/ : /foreground/);
      await tick(); assert.equal(f.calls.length, 0, site + ': rejected admission never constructs Native picker');
      await rejected; assert.equal(Activity.isPending(), false);
    }
    for (const mode of ['constructor-throw', 'call-throw', 'reject']) {
      mount(); const f = fixture(); f.mode = mode;
      const work = f.invoke(site), rejected = assert.rejects(work, error => error === f.failure);
      await tick(); if (mode === 'reject') { assert.equal(Activity.isPending(), true); f.jobs[0].reject(f.failure); }
      await rejected; assert.equal(Activity.isPending(), false, site + ': original failure clears only invocation pending');
      assert.deepEqual(f.events, []);
    }
  }
  if (id === 'window-tickets') {
    const f = fixture(), first = f.invoke('json'), second = f.invoke('save'); await tick();
    const epoch = Activity.windowEpoch(); Activity.bind(windowId); assert.equal(Activity.windowEpoch(), epoch);
    Activity.setForeground(false); assert.equal(Activity.isPending(), true, 'background never finishes accepted invocations');
    f.jobs[0].resolve([]); await first; assert.equal(Activity.isPending(), true, 'one completed invocation cannot clear another');
    Activity.setForeground(true); Activity.bind(++windowId); const third = f.invoke('font'); await tick();
    f.jobs[1].resolve([]); await second; assert.equal(Activity.isPending(), true, 'old window completion cannot clear new pending');
    f.jobs[2].resolve([]); await third; assert.equal(Activity.isPending(), false);
    const one = Activity.begin(), two = Activity.begin(); one.finish(); one.finish(); assert.equal(Activity.isPending(), true);
    two.finish(); assert.equal(Activity.isPending(), false);
    let cancelled = 0, live = 0;
    const unsubscribe = Activity.subscribe(() => cancelled++); unsubscribe();
    const stop = Activity.subscribe(() => live++); assert.equal(live, 0, 'subscribers run after the current call stack');
    await tick(); assert.equal(cancelled, 0); assert.equal(live, 1); stop();
    const native = f.invoke('json'); await tick(); Activity.destroy(); assert.equal(Activity.hasWindow(), false);
    let settled = false; native.then(() => { settled = true; }); await tick(); assert.equal(settled, false, 'window destruction does not settle the Native Promise or business task');
    f.jobs[3].resolve([]); await native; assert.equal(Activity.hasWindow(), false); assert.equal(Activity.isPending(), false);
  }
  if (id === 'stage-recovery-epoch') {
    for (const transition of ['replacement', 'destroyed', 'background', 'same-window']) {
      mount(); const f = fixture(), recovery = deferred(); f.recover = () => recovery.promise;
      const work = f.invoke('books'); const rejection = transition === 'same-window' ? undefined : assert.rejects(work, /main window|foreground/);
      assert.equal(f.calls.length, 0);
      if (transition === 'replacement') Activity.bind(++windowId);
      if (transition === 'destroyed') Activity.destroy();
      if (transition === 'background') Activity.setForeground(false);
      if (transition === 'same-window') Activity.bind(windowId);
      recovery.resolve(); await tick();
      if (rejection) { assert.equal(f.calls.length, 0, 'old recovery cannot open a new Native picker'); await rejection; }
      else { assert.equal(f.calls.length, 1); f.jobs[0].resolve([]); await work; }
      assert.equal(Activity.isPending(), false);
    }
  }
  if (id === 'host-io-preserved') {
    {
      const f = fixture(), work = f.invoke('books'); await tick();
      assert.deepEqual(f.calls[0].options.fileSuffixFilters, [READER_LOCAL_BOOK_PICKER_FILTER]); assert.equal(f.calls[0].options.maxSelectNumber, 50);
      f.jobs[0].resolve(['file://provider/good.txt', 'bad://no-name', 'file://provider/not.zip']);
      const rows = await work; assert.deepEqual(rows.map(row => row.state), ['ready', 'failed', 'failed']);
      assert.deepEqual(f.events.filter(e => e[0] === 'book-stage-port').map(e => [e[1], e[2]]), [['file://provider/good.txt', false]]);
      const more = f.invoke('books'); await tick(); f.jobs[1].resolve(Array.from({ length: 55 }, (_, i) => 'file://provider/' + i + '.txt'));
      assert.equal((await more).length, 50, 'original provider over-return remains bounded before staging');
    }
    {
      const f = fixture(), pause = deferred(); f.beforeIo = () => pause.promise;
      const uri = 'file://provider/原文件.json', content = '{"原字节":"保留"}'; f.files.set(uri, new TextEncoder().encode(content));
      const work = f.invoke('json'); await tick(); f.jobs[0].resolve([uri]); await tick();
      assert.equal(Activity.isPending(), false, 'bounded JSON read is original I/O after picker result, not a Native window ACK');
      pause.resolve(); assert.deepEqual(await work, { fileName: '原文件.json', text: content }); assert.equal(f.handles.size, 0);
    }
    {
      const f = fixture(), uri = 'file://provider/original.json', work = f.invoke('save'); await tick(); f.jobs[0].resolve([uri]);
      assert.equal(await work, 'original.json'); assert.deepEqual(f.files.get(uri), new TextEncoder().encode('{"原字节":1}'));
      assert.ok(f.events.filter(e => e[0] === 'write').length > 1, 'original short-write loop remains active');
      assert.equal(f.events.filter(e => e[0] === 'fsync').length, 1); assert.equal(f.events.at(-1)[0], 'close'); assert.equal(f.handles.size, 0);
      assert.ok(f.events.filter(e => ['stat', 'open'].includes(e[0])).every(e => e[2] === false));
    }
    {
      const f = fixture(), uri = 'file://provider/original.ttf'; f.files.set(uri, Uint8Array.from([0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]));
      f.checkedLoad = async () => { assert.equal(Activity.isPending(), false); throw f.failure; };
      const work = f.invoke('font'), rejected = assert.rejects(work, error => error === f.failure); await tick(); f.jobs[0].resolve([uri]); await rejected;
      assert.equal([...f.files.keys()].filter(path => path.startsWith('/font-test/')).length, 0, 'original failed checked load cleans only newly staged/font files');
      assert.equal(f.handles.size, 0); assert.equal(Activity.isPending(), false);
    }
  }
  if (id === 'official-activity-types') await officialTypes();
  Activity.destroy(); await tick(); recordContractCasePass(id);
}

async function officialTypes() {
  const { readFileSync } = await import('node:fs'), { fileURLToPath } = await import('node:url'), { resolve } = await import('node:path');
  const { resolveEtsLoaderRoot, virtualFilePath } = await import('./lib/tool-environment.mjs');
  const { installedEtsCompiler } = await import('./lib/ets-compiler-runtime.mjs');
  const loader = resolveEtsLoaderRoot(), sdk = resolve(loader, '../..'), manifest = JSON.parse(readFileSync(resolve(sdk, 'oh-uni-package.json'), 'utf8'));
  assert.equal(manifest.apiVersion, '23', 'fixed23 loader is explicit, never inferred from the default SDK');
  const { ts, require } = installedEtsCompiler(loader), official = require(loader + '/lib/ets_checker.js');
  const activity = fileURLToPath(file('platform/ReaderDocumentPickerActivity.ts')), consumer = virtualFilePath('ReaderDocumentPickerActivityConsumer.ets');
  const ownModule = activity.replace(/\.ts$/, '').replaceAll('\\', '/');
  const options = { ...official.compilerOptions, ets: { ...official.compilerOptions.ets, libs: [loader + '/declarations/index-full.d.ts'] }, target: ts.ScriptTarget.ES2021,
    lib: ['lib.es2021.d.ts'], module: ts.ModuleKind.CommonJS, moduleResolution: ts.ModuleResolutionKind.NodeJs, strict: true, noEmit: true, skipLibCheck: true,
    allowNonTsExtensions: true, needDoArkTsLinter: true, isCompatibleVersion: false, etsLoaderPath: loader };
  function check(fault = '') {
    const input = `import picker from '@ohos.file.picker';\nimport common from '@ohos.app.ability.common';\nimport { ReaderDocumentPickerActivity } from ${JSON.stringify(ownModule)};\ndeclare let context: common.UIAbilityContext;
ReaderDocumentPickerActivity.bind(1); ReaderDocumentPickerActivity.setForeground(true);
async function select(): Promise<string[]> { const ticket = ReaderDocumentPickerActivity.begin(${fault === 'epoch' ? "'wrong'" : 'ReaderDocumentPickerActivity.windowEpoch()'}); try { return await new picker.DocumentViewPicker(context).select({ maxSelectNumber: ${fault === 'select' ? "'wrong'" : '1'} }); } finally { ticket.finish(${fault === 'finish' ? '1' : ''}); } }
async function save(): Promise<string[]> { const ticket = ReaderDocumentPickerActivity.begin(); try { return await new picker.DocumentViewPicker(context).save({ newFileNames: ${fault === 'save' ? '[1]' : "['original.json']"} }); } finally { ticket.finish(); } }`;
    const host = ts.createCompilerHost(options), original = host.getSourceFile, exists = host.fileExists;
    host.fileExists = path => path === consumer || exists(path);
    host.getSourceFile = (path, version, ...rest) => { const source = path === consumer ? ts.createSourceFile(path, input, version, true, ts.ScriptKind.ETS, options) : original(path, version, ...rest); if (source) source.version = '1'; return source; };
    host.resolveModuleNames = (names, from) => names.map(name => name === ownModule ? { resolvedFileName: activity, extension: ts.Extension.Ts } : name.startsWith('@ohos.')
      ? { resolvedFileName: resolve(sdk, 'api/' + name + '.d.ts'), extension: ts.Extension.Dts, isExternalLibraryImport: true }
      : ts.resolveModuleName(name, from, options, host).resolvedModule);
    const inputs = new Set([activity, consumer]), builder = ts.createSemanticDiagnosticsBuilderProgram([...inputs, ...official.readDeaclareFiles()], options, host);
    const convert = d => ({ path: d.file.fileName, code: d.code, message: ts.flattenDiagnosticMessageText(d.messageText, ' ') });
    return { semantic: builder.getSyntacticDiagnostics().concat(builder.getSemanticDiagnostics()).filter(d => inputs.has(d.file?.fileName)).map(convert),
      lint: ts.ArkTSLinter_1_1.runArkTSLinter(builder, undefined, () => {}, '1.1').filter(d => inputs.has(d.file?.fileName)).map(convert) };
  }
  const valid = check(), rejected = {}; assert.deepEqual(valid, { semantic: [], lint: [] });
  for (const fault of ['epoch', 'finish', 'select', 'save']) { const result = check(fault); assert.ok(result.semantic.length > 0, 'actual fixed23 types reject ' + fault); rejected[fault] = result.semantic.map(d => d.code); }
  console.log(JSON.stringify({ kind: 'reader-document-picker-type-receipt', loader, manifest, completeInputs: [activity, consumer], valid, rejected }));
}
