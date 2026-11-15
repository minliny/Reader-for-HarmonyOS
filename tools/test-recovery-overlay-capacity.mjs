import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';
import { boundedSurfaceSdk } from './lib/bounded-surface-sdk-probe.mjs';
import { pureModuleProbe } from './lib/ets-pure-module-probe.mjs';
import { createDefaultReaderWindowMetrics, readerInteractiveSafeTop, readerInteractiveSafeBottom, readerVisualSafeTop } from '../entry/src/main/ets/ui/foundation/ReaderWindowMetrics.ts';

const cases = selectContractCases({
  'import-pending': 'Actual import overlay passes its viewport/safe/keyboard remainder into the shared bounded Notice, including zero height and current-generation action qualification.',
  'shelf-mode-pending': 'Actual shelf view-mode overlay pays header/primary-notice/footer and current viewport height to one shared Notice Scroll.',
  'shelf-operation-pending': 'Actual shelf shell original-operation overlay pays current measured header/footer and viewport height to its shared Notice Scroll.',
});
const { readerSurfaceMaxHeight } = pureModuleProbe(readFileSync(new URL(
  '../entry/src/main/ets/ui/foundation/ReaderSurfaceResolvers.ts', import.meta.url), 'utf8'),
  'ReaderSurfaceResolvers.ts', { readerVisualSafeTop }, ['readerSurfaceMaxHeight']);
const root = new URL('../entry/src/main/ets/features/bookshelf/ui/', import.meta.url);
const read = name => readFileSync(new URL(`${name}.ets`, root), 'utf8');

function checkCapacity(id, sourceOverride) {
  const metrics = createDefaultReaderWindowMetrics();
  metrics.windowRect.width = 320;
  metrics.windowRect.height = 400;
  metrics.systemInsets.top = 20;
  metrics.systemInsets.bottom = 14;
  const sdk = boundedSurfaceSdk({ allowEmptyBranchAdmission: true, windowMetrics: () => metrics });
  const dependencies = {
    ReaderWindowCoordinator: { metrics: () => metrics }, readerSurfaceMaxHeight,
    readerInteractiveSafeTop, readerInteractiveSafeBottom,
    readerPageAreaLength: Number, bookshelfHeaderSpec: () => ({ contentGap: 8 }),
  };
  const recovery = { visible: true, canRetry: true, generation: 7, message: '原操作的核对详情。'.repeat(90) };
  let owner;
  let expected;
  let area;
  const actions = [];
  if (id === 'import-pending') {
    owner = sdk.consumer(sourceOverride ?? read('LocalImportDialog'), ['build', 'pendingImport', 'recoveryTop', 'recoveryMaxHeight',
      'reconcilePendingImport', 'viewportHeight', 'viewportOriginY', 'readerWindowMetricsRevision'], dependencies);
    Object.assign(owner, {
      state: 'result', batch: { items: [] }, originalPending: true, viewportHeight: 168, viewportOriginY: 0,
      viewportWidth: 320, appThemeScheme: 'day', mounted: true, foreground: true, recovery,
      resultItems: () => [], progressLayers() {}, resultPanelHeight: () => 0, numericAreaLength: Number,
      panelFrame: () => ({ width: 280, left: 20, right: 20 }), onReconcile: generation => actions.push(generation),
    });
    expected = 118;
    owner.initialRender();
    area = [...owner.nodes.values()].find(node => node.type === 'Stack' && node.clip === true).onAreaChange;
  } else if (id === 'shelf-mode-pending') {
    owner = sdk.consumer(sourceOverride ?? read('BookshelfPage'), ['build', 'bookshelfTabContent', 'viewModeRecoveryMaxHeight',
      'recoveryViewportHeight', 'recoveryOriginY', 'readerWindowMetricsRevision'], dependencies);
    Object.assign(owner, {
      recoveryViewportHeight: 168, recoveryOriginY: 0, navigationGeneration: 2, viewModeSnapshot: {}, modeReconcileBusy: false,
      isWideViewport: () => false, phoneContent() {}, tabletContent() {}, viewModePending: () => true,
      viewModeRecovery: () => recovery, shelfHeaderClearance: () => 56, noticeTopInset: 12,
      shelfContentEndInset: () => 64, bookActionSheetOptions: () => ({}), bookActionSheetContent() {},
      viewModeReconcileAction: () => generation => actions.push(generation),
    });
    expected = 28;
    owner.initialRender();
    area = [...owner.nodes.values()].find(node => node.type === 'Stack' && node.onAreaChange).onAreaChange;
  } else {
    sdk.childSources.MainTabShell = readFileSync(new URL('../../shell/MainTabShell.ets', root), 'utf8');
    owner = sdk.consumer(sourceOverride ?? read('BookshelfShell'), ['shellOverlay', 'recoveryNoticeContent', 'recoveryMaxHeight',
      'recoveryViewportHeight', 'recoveryOriginY', 'readerWindowMetricsRevision', 'build'], {
      ...dependencies,
      MainTabShell: class {
        constructor(owner, params, _storage, id) {
          Object.assign(this, { owner, params, id });
          params.overlayContent();
        }
        updateStateVars() {}
      },
    });
    Object.assign(owner, {
      recovery, headerBottom: 56, measuredFooterHeight: 64, recoveryViewportHeight: 168, recoveryOriginY: 0,
      recoveryBusy: false, canContinueRemoval: true, removalActionLabel: '继续原删除操作',
      navigationGeneration: 2, mounted: true,
      noticeHeightHandler: () => () => {}, moreSheetOptions: () => ({}), moreSheetContent() {}, numericAreaLength: Number,
      onReconcile: generation => actions.push(generation), onContinueRemoval: generation => actions.push(generation),
    });
    // The finite MainTabShell port invokes the actual supplied overlay slot.
    owner.initialRender();
    area = [...owner.nodes.values()].find(node => node.type === 'Stack' && node.onAreaChange).onAreaChange;
    expected = 32;
  }
  const notice = sdk.walk(owner).find(actor => actor instanceof sdk.deps.ReaderRecoveryNotice);
  assert.ok(notice, 'the actual pending overlay mounts the shared Notice');
  const scrolls = () => [...notice.nodes.values()].filter(node => node.type === 'Scroll');
  assert.equal(notice.maxHeightVp, expected, 'overlay must pay current host remainder to the Notice');
  assert.equal(scrolls().length, 1, 'the shared Notice owns the bounded vertical scroll');
  assert.deepEqual(scrolls()[0].constraintSize, { maxHeight: expected });
  for (const height of [0, 320, 168]) {
    if (area) area({}, { height, width: 320, globalPosition: { y: 0 } });
    else owner.recoveryViewportHeight = height;
    sdk.properties.flush();
    assert.ok(notice.maxHeightVp >= 0 && notice.maxHeightVp <= height);
    assert.equal(scrolls().length, 1);
    assert.deepEqual(scrolls()[0].constraintSize, { maxHeight: notice.maxHeightVp });
  }
  if (area) area({}, { height: 320, width: 320, globalPosition: { y: 100 } });
  else { owner.recoveryViewportHeight = 320; owner.recoveryOriginY = 100; }
  sdk.properties.flush();
  const originExpected = id === 'import-pending' ? 270 : id === 'shelf-mode-pending' ? 160 : 164;
  assert.equal(notice.maxHeightVp, originExpected, 'global origin clamps the current local viewport');
  metrics.keyboardInsets.bottom = 96;
  owner.readerWindowMetricsRevision += 1;
  sdk.properties.flush();
  const keyboardExpected = id === 'import-pending' ? 188 : id === 'shelf-mode-pending' ? 128 : 132;
  assert.equal(notice.maxHeightVp, keyboardExpected, 'keyboard changes recompute the existing Scroll capacity');
  if (id === 'import-pending') {
    const reconcile = sdk.nodes(owner).find(node => node.type === 'Button' && node.accessibilityText === '核对导入结果');
    assert.ok(reconcile);
    reconcile.onClick();
    assert.deepEqual(actions, [7]);
    owner.recovery = { ...recovery, generation: 8 };
    reconcile.onClick();
    assert.deepEqual(actions, [7], 'old generation cannot reconcile a successor import');
  }
  return { initialMaxHeight: expected, heightSequence: [168, 0, 320, 168], scrollOwners: 1, originExpected, keyboardExpected };
}

for (const id of cases) {
  const result = checkCapacity(id);
  const component = id === 'import-pending' ? 'LocalImportDialog' : id === 'shelf-mode-pending' ? 'BookshelfPage' : 'BookshelfShell';
  const source = read(component);
  const naturalHeight = source.replace(/maxHeightVp: this\.(?:viewModeRecoveryMaxHeight|recoveryMaxHeight)\(\)/, 'maxHeightVp: -1');
  assert.notEqual(naturalHeight, source);
  assert.throws(() => checkCapacity(id, naturalHeight), /overlay must pay current host remainder to the Notice/);
  console.log(JSON.stringify({ case: id, result, oldNaturalHeightNegative: 'rejected',
    boundary: 'Actual overlay/Notice SDK attributes and finite geometry ports. Native layout, text measurement, scroll/focus and persistence retain their evidence requirements.' }));
  recordContractCasePass(id);
}
