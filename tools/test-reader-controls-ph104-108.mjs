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
const ts = require('/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/ets/build-tools/ets-loader/node_modules/typescript');
const syntax = require('/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/ets/build-tools/ets-loader/lib/validate_ui_syntax.js');
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

await check('PH105: download feedback starts immediately, verifies completion and ignores stale owner', async () => {
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
      offlineMutationActiveKey: '', offlineMutationGeneration: 0, detailToc: [{ index: 0 }],
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
for (const result of results) console.log(JSON.stringify(result));
assert.equal(results.filter(result => result.status === 'FAIL').length, 0, 'PH104–108 production regression');
