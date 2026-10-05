import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { productionMotionMethods } from './lib/reader-motion-method-probe.mjs';
import { createReaderBuilderProbe } from './lib/reader-control-builder-probe.mjs';
import * as state from '../entry/src/main/ets/features/reading/ReaderAppearanceState.ts';
import * as style from '../entry/src/main/ets/features/reading/ReaderAppearanceRenderStyle.ts';
import { READER_THEME_DEFINITIONS } from '../entry/src/main/ets/features/common/ReaderThemeRegistry.ts';
import { readerControlHostVisible } from '../entry/src/main/ets/features/reading/ReaderControlHostSession.ts';
import { createReaderControlSessionState } from '../entry/src/main/ets/features/reading/ReaderControlSessionState.ts';
import { readerWidthClass } from '../entry/src/main/ets/features/reading/ReaderLayoutGeometry.ts';

const require = createRequire(import.meta.url);
const ts = require(((process.env.READER_ETS_LOADER_ROOT ?? ((process.env.OHOS_SDK_HOME ?? '/Applications/DevEco-Studio.app/Contents/sdk/default') + '/openharmony/ets/build-tools/ets-loader')) + '/node_modules/typescript'));
const syntax = require(((process.env.READER_ETS_LOADER_ROOT ?? ((process.env.OHOS_SDK_HOME ?? '/Applications/DevEco-Studio.app/Contents/sdk/default') + '/openharmony/ets/build-tools/ets-loader')) + '/lib/validate_ui_syntax.js'));
const statusPaperSource = readFileSync(new URL('../entry/src/main/ets/features/reading/ReaderStatusBarPaper.ets', import.meta.url), 'utf8');
syntax.componentCollection.customComponents.add('ReaderStatusBarPaper');
syntax.propCollection.set('ReaderStatusBarPaper', new Set([...statusPaperSource.matchAll(/@Prop\s+(\w+)\s*:/g)].map(m => m[1])));
class StatusPaper { constructor(owner, params, _storage, id) { Object.assign(this, { owner, params, id }); } }
const baseline = process.env.READER_CONTROLS_BASELINE;
const scratch = baseline ? mkdtempSync(join(tmpdir(), 'reader-controls-baseline-')) : undefined;
function sourcePath(relative) {
  if (!baseline) return new URL(`../entry/src/main/ets/${relative}`, import.meta.url);
  const path = join(scratch, relative.replaceAll('/', '-'));
  writeFileSync(path, execFileSync('/Library/Developer/CommandLineTools/usr/bin/git',
    ['show', `${baseline}:entry/src/main/ets/${relative}`], { cwd: new URL('..', import.meta.url) }));
  return path;
}
const lre = sourcePath('features/reading/LocalReadingExperience.ets');
const results = [];
async function check(name, run) {
  try { await run(); results.push({ name, status: 'PASS' }); }
  catch (error) { results.push({ name, status: 'FAIL', error: error.message }); }
}
function ordinary(file, names, deps = {}) {
  const source = readFileSync(file, 'utf8');
  return productionMotionMethods(file, names.filter(name => source.includes(`${name}(`)), deps);
}
const tick = () => new Promise(resolve => setImmediate(resolve));
async function settled() { for (let i = 0; i < 5; i++) await tick(); }

await check('PH108: real SDK If observes the control visibility edge with extension enabled', () => {
  const source = readFileSync(lre, 'utf8');
  const stack = [], reads = new Map();
  const { owner } = createReaderBuilderProbe(source,
    ['readerStatusBarUnderlay', 'readerStatusBarMetrics', 'controlsPresentedForWindow'], {
      ...style, readerControlHostVisible, ReaderStatusBarPaper: StatusPaper,
      ReaderWindowCoordinator: { metrics: () => ({ statusBarRect: { left: 0, top: 0, width: 390 }, statusBarHeight: 48 }) },
    }, {
      onObserverEnter: (_owner, id) => { stack.push(id); reads.set(id, new Set()); },
      onObserverExit: (_owner, id) => assert.equal(stack.pop(), id),
    });
  for (const [key, value] of Object.entries({ windowChromeActive: true,
    readerSettingsSnapshot: { extendIntoCutout: true }, sessionLaunch: undefined,
    windowControlsPresented: false, controlSession: {}, appearanceSnapshot: { activeTheme: 'greenNight' },
    readerWindowMetricsRevision: 1 })) {
    Object.defineProperty(owner, key, { get() {
      if (stack.length) reads.get(stack.at(-1)).add(key);
      return value;
    } });
  }
  owner.latestControlVisualSession = createReaderControlSessionState();
  // The old helper reads a deliberately non-observed visual cache.
  owner.readerStatusBarUnderlay();
  assert.ok([...reads.values()].some(keys => keys.has('windowControlsPresented') || keys.has('controlSession')),
    'opening controls must invalidate the native If even when metrics and theme remain equal');
});

await check('PH108: every theme-only change invalidates page textures without repagination', () => {
  const C = ordinary(lre, ['admitAppearanceSnapshot']);
  for (const theme of READER_THEME_DEFINITIONS) {
    let invalidations = 0, refreshed = 0, measured = 0;
    const p = Object.assign(new C(), { appearanceSnapshot: { activeTheme: theme.id === 'day' ? 'night' : 'day' },
      sameAppearanceLayout: () => true, pageTurnInputPhase: () => 'idle',
      invalidatePageTurnRuntime: () => invalidations++, hasMeasuredViewport: () => false,
      readerSettingsSnapshot: {}, desiredChapterOffset: 12, phase: 'ready',
      applyWindowChrome() {}, hasCurrentMaterializedChapter: () => true,
      schedulePageTurnPreparation: () => refreshed++, beginMeasurement: () => measured++,
    });
    p.admitAppearanceSnapshot({ activeTheme: theme.id });
    assert.equal(invalidations, 1, theme.id + ': stale raster must be invalidated');
    assert.equal(refreshed, 1); assert.equal(measured, 0);
  }
});

if (!baseline) await check('PH108: shell repaints the reader band above directory and source-switch overlays', () => {
  const source = readFileSync(sourcePath('features/shell/ReaderShell.ets'), 'utf8');
  for (const theme of READER_THEME_DEFINITIONS) for (const route of ['directory', 'reading']) {
    const { owner } = createReaderBuilderProbe(source, ['overlayStatusBarUnderlay', 'chromeMetrics'], {
      ReaderStatusBarPaper: StatusPaper, readerWidthClass,
      ReaderWindowCoordinator: { metrics: () => ({ windowRect: { width: 390, height: 844 },
        statusBarRect: { left: 2, top: 1, width: 386, height: 48 }, statusBarHeight: 48 }) },
    });
    Object.assign(owner, { visible: true, route, sourceSwitchVisible: route === 'reading',
      chromeUnderlayColor: theme.statusBackground, chromePaperThemeId: theme.id, windowMetricsRevision: 1 });
    owner.overlayStatusBarUnderlay();
    const row = [...owner.nodes.values()].find(row => row.id === 'reader-overlay-status-bar-underlay');
    const props = [...owner.children.values()][0].params;
    assert.equal(props.fallbackColor, theme.statusBackground);
    assert.equal(props.theme, theme.id); assert.equal(row.zIndex, 10);
    assert.deepEqual(props.statusRect, { left: 2, top: 1, width: 386, height: 48 });
  }
});

await check('PH104: moving launch blocks native captures and adjacent preparation, hold resumes', async () => {
  const C = ordinary(lre, ['performBookTurnTextureRefresh', 'drainPageTurnPreparationQueue', 'sessionLaunchRenderWorkBlocked']);
  let renders = 0, schedules = 0;
  const p = Object.assign(new C(), { sessionLaunch: { ownership: 'stage', sample: { settled: false, finished: false } },
    mounted: true, bookTurnTextureCaptureGeneration: 1, usesBookTurnSimulation: () => true,
    controlVisible: () => false, bookTurnRuntimeFailed: false, phase: 'ready',
    bookTurnSession: { isReady: () => true }, pageTurnInputPhase: () => 'idle',
    currentPageTurnRenderPage: () => { renders++; return { renderRevision: 8 }; }, bookTurnArkUIContentRevision: 0,
    pageTurnGestureState: { phase: 'idle' }, readerSettingsSnapshot: {}, canTurnPage: () => true,
    pageTurnPreparationQueue: [], scheduleBookTurnTextureRefresh: () => schedules++,
  });
  await p.performBookTurnTextureRefresh(1);
  assert.equal(renders, 0, 'control close is not the end of capsule motion');
  // Avoid a rewritten queue: evaluate the ordinary production method with its existing mode predicate.
  const Q = ordinary(lre, ['drainPageTurnPreparationQueue', 'sessionLaunchRenderWorkBlocked'],
    { readerPageTransitionUsesPreparedPages: () => true });
  Object.setPrototypeOf(p, Q.prototype);
  p.drainPageTurnPreparationQueue(); assert.equal(schedules, 0);
  p.sessionLaunch.sample.settled = true;
  p.drainPageTurnPreparationQueue(); assert.equal(schedules, 1);
});

await check('PH107: native volume subscriptions are absent in controls, overlays and background', () => {
  const C = ordinary(lre, ['applyReaderSystemEventPolicy', 'syncVolumeKeyPolicy']);
  for (const [input, controls, overlay, expected] of [[true,false,false,true], [true,true,false,false],
    [true,false,true,false], [false,false,false,false]]) {
    let handler;
    const p = Object.assign(new C(), { isControlInputEnabled: () => input, controlsPresentedForWindow: () => controls,
      windowChromeOverlayActive: overlay, readingSystemEventHost: { setVolumeKeyHandler: fn => handler = fn, setScreenOffHandler() {} } });
    p.applyReaderSystemEventPolicy({ volumeKeysTurnPage: true, stopTtsOnScreenOff: false });
    assert.equal(typeof handler === 'function', expected, `input=${input} controls=${controls} overlay=${overlay}`);
  }
});

if (!baseline) await check('PH107: actual InputKit host releases partial registrations, deduplicates and disposes', () => {
  const src = readFileSync(sourcePath('app/ReaderReadingSystemEventHost.ts'), 'utf8');
  const output = ts.transpileModule(src, { compilerOptions: { target: ts.ScriptTarget.ES2021, module: ts.ModuleKind.CommonJS } }).outputText;
  const listeners = new Set(); let failDown = false, subscriptions = 0;
  const deps = { '@kit.BasicServicesKit': {}, '@kit.InputKit': { KeyCode: { KEYCODE_VOLUME_UP: 1, KEYCODE_VOLUME_DOWN: 2 }, inputConsumer: {
    on: (_type, options, listener) => { if (failDown && options.key === 2) throw Error('registration failure'); listeners.add(listener); subscriptions++; },
    off: (_type, listener) => listeners.delete(listener),
  } } };
  const module = { exports: {} };
  new Function('require', 'module', 'exports', output)(id => deps[id] ?? {}, module, module.exports);
  const host = new module.exports.ReaderReadingSystemEventHost();
  failDown = true; host.setVolumeKeyHandler(() => {}); assert.equal(listeners.size, 0);
  failDown = false; host.setVolumeKeyHandler(() => {}); assert.equal(listeners.size, 2);
  const count = subscriptions; host.setVolumeKeyHandler(() => {}); assert.equal(subscriptions, count);
  host.setVolumeKeyHandler(undefined); assert.equal(listeners.size, 0);
  host.setVolumeKeyHandler(() => {}); assert.equal(listeners.size, 2);
  host.dispose(); assert.equal(listeners.size, 0);
  host.setVolumeKeyHandler(() => {}); assert.equal(listeners.size, 0);
});

if (!baseline) await check('PH106: import stays an action; a separate selected custom font survives restore and reorder', () => {
  const descriptor = new state.ReaderCustomFontDescriptor('测试字体', 'ReaderCustom_aaaaaaaaaaaaaaaa',
    '/data/storage/el2/base/files/reader-fonts/' + 'a'.repeat(64) + '.ttf', 'a'.repeat(64));
  const snapshot = state.setReaderAppearanceCustomFont(state.createDefaultReaderAppearanceSnapshot(), descriptor);
  assert.equal(style.readerAppearanceFontSlotLabel(snapshot, 'import'), '导入');
  assert.equal(style.readerAppearanceFontSlotLabel(snapshot, 'custom'), '测试字体');
  assert.equal(style.readerAppearanceFontSlotFamily(snapshot, 'custom'), descriptor.familyName);
  assert.ok(snapshot.fontOrder.includes('custom')); assert.ok(snapshot.fontOrder.includes('import'));
  const restored = state.normalizeReaderAppearanceSnapshot(JSON.parse(JSON.stringify(snapshot)));
  assert.deepEqual(restored.fontOrder, snapshot.fontOrder);
  assert.equal(style.readerAppearanceSnapshotFontFamily(restored), descriptor.familyName);
  assert.equal(state.setReaderAppearanceFont(restored, 'serif').customFont.filePath, descriptor.filePath);
});

await check('PH106: actual font Host registers persisted sandbox font through file URI', async () => {
  const src = readFileSync(sourcePath('app/ReaderCustomFontHost.ts'), 'utf8');
  const output = ts.transpileModule(src, { compilerOptions: { target: ts.ScriptTarget.ES2021, module: ts.ModuleKind.CommonJS } }).outputText;
  const module = { exports: {} };
  let registered;
  const deps = { '@ohos.file.fs': { default: { access: async () => true } }, '../features/reading/ReaderAppearanceState': state,
    './ReaderFontLoadHost': {loadReaderFontChecked: async (familyName, familySrc) => { registered = {familyName, familySrc}; }} };
  new Function('require', 'module', 'exports', output)(id => deps[id] ?? {}, module, module.exports);
  const host = new module.exports.ReaderCustomFontHost({ filesDir: '/files' });
  const descriptor = new state.ReaderCustomFontDescriptor('字体', 'ReaderCustom_aaaaaaaaaaaaaaaa',
    '/files/reader-fonts/' + 'a'.repeat(64) + '.ttf', 'a'.repeat(64));
  assert.equal(await host.registerPersisted({ registerFont: font => registered = font }, descriptor), true);
  assert.equal(registered.familySrc, 'file://' + descriptor.filePath);
});

if (baseline) await check('PH105: download feedback starts immediately, verifies completion and ignores stale owner', async () => {
  const src = sourcePath('pages/Index.ets');
  for (const mode of ['complete', 'partial', 'failure', 'stale']) {
    let resolve, reject, calls = 0;
    const pending = new Promise((a,b) => { resolve = a; reject = b; });
    class Gateway { prefetchBook() { calls++; return pending; } async loadProjection() { return []; } }
    const C = ordinary(src, ['downloadDirectoryBook', 'showOfflineDownloadFeedback'], {
      ReadingOfflineGateway: Gateway, ReaderRuntimeOwner: { current: () => ({}) }, hilog: { error() {} }, DOMAIN: 0,
    });
    const messages = [], errors = [];
    const p = Object.assign(new C(), { remoteReadingSession: { identity: { sourceId: 's', bookId: 'b' }, entries: [{ url: 'chapter' }] },
      offlineMutationActiveKey: '', mangaDownloadActionActiveKey: '', offlineMutationGeneration: 0, detailToc: [{ index: 0 }],
      getUIContext: () => ({ getPromptAction: () => ({ showToast: ({ message }) => messages.push(message) }) }),
      mergeDirectoryBookmarks: entries => entries, showReadingFailure: (...args) => errors.push(args),
    });
    p.downloadDirectoryBook();
    assert.ok(messages[0]?.includes('开始下载'), 'immediate accepted feedback');
    assert.equal(calls, 1);
    if (mode === 'stale') p.remoteReadingSession = undefined;
    if (mode === 'failure') reject(new Error('offline unavailable'));
    else resolve([{ index: 0, navigable: true, downloadState: mode === 'partial' ? 'cached' : 'completed' }]);
    await settled();
    if (mode === 'complete') assert.ok(messages.at(-1).includes('下载完成'));
    if (mode === 'partial') assert.ok(messages.at(-1).includes('0/1'));
    if (mode === 'failure') assert.equal(errors.length, 1);
    if (mode === 'stale') assert.equal(messages.length, 1);
    assert.equal(p.offlineMutationActiveKey, '');
  }
});
if (!baseline) await check('PH105: real Gateway/Host feedback preserves verified completion, partial body, failure and retired owner', async () => {
  const { actualCacheAuthorityFixture, makeIndex, settled: ownerSettled } = await import('./lib/reading-directory-sdk-consumer.mjs');
  const { deferred, until } = await import('./lib/reading-operation-durable-probe.mjs');
  for (const mode of ['complete', 'partial', 'failure', 'stale']) {
    const f = await actualCacheAuthorityFixture(true), pending = deferred(), messages = [];
    const model = { state: mode==='failure'?'cached':'missing', bytes: mode==='failure'?64:0, manifest: false, lastError: undefined, queued: 0 };
    const privateFailure='offline unavailable https://fixture.invalid/?token=PRIVATE_TEST_TOKEN Cookie=PRIVATE_TEST_COOKIE';
    f.runtime.supportsCoreCapability = capability => capability === 'chapter.content.cacheOnly.v1';
    f.runtime.markOfflineImageChapterComplete = async () => { model.manifest = mode !== 'partial'; };
    f.runtime.isOfflineImageChapterComplete = async () => model.manifest;
    f.runtime.request = async (method, params, options = {}) => {
      f.calls.push({ method, params: structuredClone(params), options });
      if (options.canDispatch?.() === false) throw Error('actual adapter refused before send');
      options.onDispatch?.();
      if (method === 'cache.book.prefetch') {
        assert.equal(options.shouldCancel, undefined, 'accepted queue cannot be cancelled by the UI');
        model.queued++; await pending.promise; model.state = 'inProgress'; model.bytes = 4;
        return { data: { sourceId: 'source', bookId: 'book', chapterRange: params.chapterRange,
          chapterCount: 1, prefetchedCount: 1, materializations: [{ chapterIndex: 0, token: 'actual-queue-lease' }] } };
      }
      if (method === 'cache.book.status') return { data: { sourceId: 'source', bookId: 'book', tocAvailable: true,
        chapters: [{ chapterIndex: 0, title: 'Chapter', url: '/chapter', state: model.state, cachedBytes: model.bytes, lastError: model.lastError }] } };
      if (method === 'chapter.content') return { data: { sourceId: 'source', bookId: 'book', chapterTitle: 'Chapter', content: '这是能够通过既有正文准入的真实章节内容。'.repeat(20), via: 'cache' } };
      if (method === 'cache.chapter.materialization.report') {
        model.state = params.outcome; model.lastError = params.errorCode;
        return { data: { sourceId: 'source', bookId: 'book', chapterIndex: 0, state: params.outcome, retainedCachedBody: true } };
      }
      throw Error('Unexpected offline boundary: ' + method);
    };
    const { idx, render, p, click } = makeIndex(f, { remote: true });
    idx.detailToc = [{ index: 0, title: 'Chapter', navigable: true, downloadState: model.state }];
    idx.getUIContext = () => ({ getPromptAction: () => ({ showToast: ({ message }) => messages.push(message) }) });
    idx.downloadDirectoryBook();
    assert.ok(messages[0]?.includes('开始下载'), 'immediate accepted feedback precedes filesystem/RPC admission');
    await until(() => model.queued === 1);
    assert.equal(f.offline.busy(), true);
    if (mode === 'stale') idx.remoteReadingSession = undefined;
    if (mode === 'failure') pending.reject(Error(privateFailure));
    else pending.resolve();
    await ownerSettled(f);
    assert.equal(model.queued, 1, 'one actual queue write');
    if (mode === 'complete') {
      assert.match(messages.at(-1), /全部 1 章下载完成/);
      assert.equal(idx.detailToc[0].downloadState, 'completed');
    }
    if (mode === 'partial') {
      assert.match(messages.at(-1), /已完成 0\/1 章.*1 章正文已缓存/);
      assert.equal(idx.detailToc[0].downloadState, 'cached');
    }
    if (mode === 'failure') {
      assert.equal(idx.offlineOperation.projection.receipt.confirmation, 'unknown');
      const leaf = render();
      const generation=idx.offlineOperation.generation;
      assert.equal(idx.offlineOperation.operationFailure,privateFailure,'actual private cause stays independent of the unknown write receipt');
      const notice=p.walk(leaf).find(actor=>actor instanceof p.deps.ReaderRecoveryNotice&&actor.view?.generation===generation);
      assert.ok(notice?.view.visible,'the actual notice represents this unknown queue operation');
      assert.match(notice.view.message,/结果尚未确认/);assert.match(notice.view.message,/已有内容仍保留/);
      assert.doesNotMatch(notice.view.message,/PRIVATE_TEST|fixture\.invalid|Cookie=|offline unavailable/);
      assert.equal(notice.view.canRetry,false,'the notice itself does not dispatch recovery');
      assert.equal(idx.directoryRecovery().offline.canRetry,true);
      const action=p.walk(leaf).find(actor=>actor instanceof p.deps.ReaderRecoveryAction&&actor.label==='核对离线结果');
      assert.ok(action);assert.equal(action.generation,generation);assert.equal(action.actionEnabled,true);
      assert.equal(messages.length,2,'the actual Index shows one safe unknown-ACK feedback after its immediate acceptance');
      assert.match(messages[1],/结果尚未确认/);assert.doesNotMatch(messages.join('\n'),/PRIVATE_TEST|fixture\.invalid|Cookie=|offline unavailable/);
      assert.equal(idx.detailToc[0].downloadState,'cached');assert.equal(model.bytes,64,'unknown queue ACK preserves the previously cached body');
      const reads=f.calls.filter(call=>call.method==='cache.book.status').length;
      const oldNative=[...action.nodes.values()].find(node=>typeof node.onClick==='function').onClick;
      click(leaf,'核对离线结果');await ownerSettled(f);
      assert.ok(f.calls.filter(call=>call.method==='cache.book.status').length>reads,'actual reconciliation performs only a canonical read');
      assert.equal(model.queued,1,'a recovery click cannot dispatch a second queue write');
      assert.equal(f.calls.filter(call=>call.method==='cache.clear').length,0);
      assert.equal(idx.offlineOperation.projection.receipt.confirmation,'unknown','availability is not an ACK of the original queue write');
      assert.equal(idx.offlineOperation.operationFailure,privateFailure);assert.equal(idx.detailToc[0].downloadState,'cached');
      const before=f.calls.length;
      idx.directoryPresentationGeneration++;oldNative();await ownerSettled(f);assert.equal(f.calls.length,before,'obsolete physical recovery actor cannot consume the reopened directory');
      idx.directoryPresentationGeneration--;f.unset();oldNative();await ownerSettled(f);assert.equal(f.calls.length,before,'unset Runtime rejects the old admitted actor');
      f.install({...f.runtime});oldNative();await ownerSettled(f);assert.equal(f.calls.length,before,'replacement Runtime cannot lend authority to the old actor');
    }
    if (mode === 'stale') {
      assert.equal(messages.length, 1, 'retired UI gets no delayed toast');
      assert.equal(f.offline.snapshot().projection.receipt.confirmation, 'confirmed', 'accepted queue ACK settles in the original domain owner');
      assert.equal(f.calls.filter(call => call.method === 'cache.chapter.materialization.report').length, 1, 'granted lease is terminally reported after UI retirement');
    }
    assert.equal(f.offline.busy(), false, 'actual owner mutex released');
  }
});
for (const result of results) console.log(JSON.stringify(result));
assert.equal(results.filter(result => result.status === 'FAIL').length, 0, 'PH104–108 production regression');
