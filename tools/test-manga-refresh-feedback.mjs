import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { productionMotionMethods } from './lib/reader-motion-method-probe.mjs';
import { createReaderBuilderProbe } from './lib/reader-control-builder-probe.mjs';
import { boundedSurfaceSdk } from './lib/bounded-surface-sdk-probe.mjs';
import { readerMessageStyles } from './lib/reader-typography-probe.mjs';
import { readerAppColor } from '../entry/src/main/ets/ui/foundation/ReaderThemeRegistry.ts';

const source = new URL('../entry/src/main/ets/features/manga/ui/MangaReadingSurface.ets', import.meta.url);
const Surface = productionMotionMethods(source, ['performMoreAction', 'performMorePanelAction', 'performPanelAction',
  'moreActions', 'readerPanelForeground', 'refreshImages'], {
  ReaderMenuActionView: class { constructor(id, _label, enabled) { Object.assign(this, { id, enabled }); } },
  readerActionIcon: () => undefined,
});
const settle = () => new Promise(resolve => setImmediate(resolve));

function fixture() {
  const ready = [], notices = [];
  let resolveRefresh, rejectRefresh;
  const refresh = new Promise((resolve, reject) => { resolveRefresh = resolve; rejectRefresh = reject; });
  const original = { manifest: { chapter: { sourceId: 'source', bookId: 'book', chapterId: 'chapter' }, manifestVersion: 'old' } };
  const controller = { chapter: original, displayedOrdinal: 1, savedLocation: { x: 0.2, y: 0.3 },
    refreshChapter: () => refresh, setPreviewMode: async () => {} };
  let current = true;
  const owner = Object.assign(new Surface(), { mounted: true, opened: true, appForeground: true,
    windowChromeActive: true, sourceId: 'source', bookId: 'book', isReaderIdentityCurrent: () => current,
    controller, title: '第一话', panel: 'more', panelPhase: 'open', panelGeneration: 1,
    actionPanelPresentationGeneration: 1, panelActionGeneration: 0, presentationGeneration: 1,
    refreshing: false, error: '', controlsVisible: true, viewportWidth: 390,
    saveVisible: async () => true, requestPanelFocus() {}, effectiveFit: () => 'contain',
    closePanel: async () => { owner.panel = ''; owner.panelPhase = 'closed'; owner.panelGeneration++; return true; },
    publish: () => ready.push(controller.chapter.manifest.manifestVersion),
    restore: (...anchor) => ready.push(anchor),
    transientFeedback: { show: (_context, view, eligible) => { if (eligible()) notices.push(view.message); } },
  });
  const start = () => owner.performMoreAction('refresh', owner.actionPanelPresentationGeneration);
  return { owner, controller, original, ready, notices, start, rejectRefresh,
    retire: () => { current = false; },
    unchanged: resolveRefresh,
    complete: () => { controller.chapter = { manifest: { ...original.manifest, manifestVersion: 'new' } }; resolveRefresh(); },
    requireRecovery: () => { controller.replacementRecoveryRequired = true; resolveRefresh(); } };
}

const sourceText = readFileSync(source, 'utf8');
function refreshProgress(operation, changes = {}) {
  const sdk = boundedSurfaceSdk();
  const { owner } = createReaderBuilderProbe(sourceText, ['refreshProgress'], {
    ...sdk.deps, ...readerMessageStyles, readerAppColor,
  }, sdk.hooks);
  Object.assign(owner, { refreshing: operation.refreshing, opened: operation.opened, panel: operation.panel,
    panelPhase: operation.panelPhase, chromeScheme: () => 'day', readerPanelForeground: () => operation.readerPanelForeground(),
    controlsPresentedForWindow: () => operation.controlsVisible, bottomControlViewportHeight: () => 84,
    interactiveInsets: () => ({ top: 40, bottom: 16, left: 8, right: 8 }), ...changes });
  owner.refreshProgress();
  return sdk.nodes(owner).filter(node => node.type !== 'If');
}

const success = fixture();
success.start(); await settle();
assert.equal(success.owner.panel, '', 'More closes before refresh work completes');
assert.equal(success.controller.chapter, success.original, 'retain the old chapter while replacement is pending');
assert.deepEqual(success.notices, [], 'no completion before replacement');
assert.match(sourceText, /this\.boundaryViewport\(\);[\s\S]*?this\.refreshProgress\(\);/, 'the reading page mounts progress over its viewport');
const progress = refreshProgress(success.owner);
assert.ok(progress.some(node => node.type === 'Text' && node.create === '正在更新本章'));
assert.ok(progress.some(node => node.type === 'Stack' && node.hitTestBehavior === 'HitTestMode.None'));
assert.equal(progress.find(node => node.type === 'Row').margin.bottom, 94, 'the progress avoids the visible dock');
assert.equal(refreshProgress(success.owner, { panel: 'directory' }).length, 0, 'a current panel covers progress');
assert.equal(refreshProgress(success.owner, { reduceMotion: true }).find(node => node.type === 'LoadingProgress').enableLoading, false);
success.complete(); await settle();
assert.deepEqual(success.ready, ['new', [1, 0.3, 0.2]], 'project the replacement at the mapped image and offset');
assert.deepEqual(success.notices, ['本章已更新']);
assert.equal(refreshProgress(success.owner).length, 0, 'settlement clears progress');

const unchanged = fixture();
unchanged.start(); await settle(); unchanged.unchanged(); await settle();
assert.deepEqual(unchanged.notices, [], 'a reparse with the same version is not a replacement');

const recovery = fixture();
recovery.start(); await settle(); recovery.requireRecovery(); await settle();
assert.equal(recovery.owner.recovering, true, 'the existing position recovery stays available');
assert.equal(recovery.owner.refreshing, false);
assert.equal(recovery.controller.chapter, recovery.original);
assert.deepEqual(recovery.ready, []);
assert.deepEqual(recovery.notices, []);

const failed = fixture();
failed.start(); await settle(); failed.rejectRefresh(new Error('NET')); await settle();
assert.equal(failed.controller.chapter, failed.original);
assert.deepEqual(failed.notices, ['刷新未完成，已保留当前内容。']);

const cancelled = fixture();
cancelled.start(); await settle(); cancelled.rejectRefresh(new Error('MANGA_SESSION_CANCELLED')); await settle();
assert.equal(cancelled.controller.chapter, cancelled.original);
assert.deepEqual(cancelled.notices, []);

const retired = fixture();
retired.start(); await settle(); retired.retire(); retired.complete(); await settle();
assert.deepEqual(retired.ready, []);
assert.deepEqual(retired.notices, []);
console.log('PASS manga More refresh retains the pending chapter and publishes only current settled feedback');
