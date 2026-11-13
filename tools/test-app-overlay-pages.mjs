import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';

const selected = selectContractCases({
  'manga-recovery-cold': {
    description: 'The retained Manga recovery input stays retired at the real one-vp cold viewport and activates only when its same actor receives a measured positive viewport.',
    resources: [],
  },
  'manga-recovery': {
    description: 'Manga recovery is a current independent overlay and preserves the ordinary viewport, dock budget and user-control chrome across recovery state changes.',
    resources: [],
  },
});

if (selected.length > 0) {
  const { createReaderBuilderProbe } = await import('./lib/reader-control-builder-probe.mjs');
  const { createArkUIPropertyRuntimeProbe } = await import('./lib/arkui-property-runtime-probe.mjs');
  const { mangaSurfaceSdkDependencies } = await import('./lib/manga-surface-sdk-probe.mjs');
  const { createDefaultReaderWindowMetrics } = await import('../entry/src/main/ets/ui/foundation/ReaderWindowMetrics.ts');
  const source = readFileSync(new URL('../entry/src/main/ets/features/manga/ui/MangaReadingSurface.ets', import.meta.url), 'utf8');
  const methods = ['recoveryOverlay', 'recoveryOverlayIdentity', 'recoveryOverlayCurrent',
    'controlsPresentedForWindow', 'readerPanelForeground', 'bottomControlViewportHeight', 'recoveryNoticeHeight',
    'controlFontScale', 'dockPageRowHeight', 'dockActionHeight', 'dockHeight', 'mangaTopBarHeight',
    'recovering', 'controlsVisible', 'presentationGeneration', 'panel', 'panelPhase', 'viewportWidth', 'viewportHeight'];

  function model(code = source) {
    const properties = createArkUIPropertyRuntimeProbe();
    const metrics = createDefaultReaderWindowMetrics();
    metrics.systemInsets.top = 24;
    metrics.navigationInsets.bottom = 24;
    const calls = [];
    const instance = createReaderBuilderProbe(code, methods, {
      ...mangaSurfaceSdkDependencies, ...properties.sdk,
      ReaderWindowCoordinator: { metrics: () => metrics },
    }, properties.hooks).owner;
    Object.assign(instance, {
      sourceId: 'source', bookId: 'book', mounted: true, exiting: false,
      appForeground: true, windowChromeActive: true, windowChromeOverlayActive: false,
      interactionBlocked: false, isReaderIdentityCurrent: () => true,
      opened: true, openingRetry: false, controlsVisible: false, chapterEnd: false,
      panel: '', panelPhase: 'closed', recovering: false, presentationGeneration: 7,
      boundaryBusy: false, loginRequiredForControls: false, offlineProbeStatus: '',
      viewportWidth: 366, viewportHeight: 844, windowMetricsRevision: 1,
      interactiveInsets: () => ({ left: 0, right: 0, top: 24, bottom: 24 }),
      mangaTopBarHeight: () => 52,
      refreshLoginRequiredForControls() {},
      applyWindowChrome() {},
      applyWindowPolicyForChromeOwner() {},
      controller: { replacementRecoveryRequired: false },
      confirmRecovery() { calls.push(this.presentationGeneration); return Promise.resolve(); },
    });
    return { instance, properties, metrics, calls };
  }

  const samples = [];
  for (const id of selected) {
    if (id === 'manga-recovery-cold') {
      const { instance: owner, properties, calls } = model();
      Object.assign(owner, { viewportWidth: 1, viewportHeight: 1, recovering: true });
      owner.recoveryOverlay(); properties.flush();
      const carrier = [...owner.nodes.values()].find(node => node.type === 'Column' && node.onTouch);
      const notice = [...owner.children.values()].find(child => (child.tag ?? child.params?.tag) === '内容更新');
      const invoke = notice.onReconcile ?? notice.params.onReconcile;
      assert.equal(carrier.enabled, false);
      assert.equal(carrier.opacity, 0);
      assert.equal(carrier.hitTestBehavior, 'HitTestMode.None');
      assert.equal(carrier.accessibilityLevel, 'no-hide-descendants');
      invoke(7); assert.equal(calls.length, 0);
      owner.viewportWidth = 366; owner.viewportHeight = 844; properties.flush();
      assert.equal(carrier.enabled, true);
      assert.equal(carrier.opacity, 1);
      assert.equal(carrier.hitTestBehavior, 'HitTestMode.Default');
      invoke(7); assert.deepEqual(calls, [7]);
      owner.viewportHeight = 1; properties.flush();
      assert.equal(carrier.enabled, false);
      invoke(7); assert.equal(calls.length, 1);
      console.log('PASS app-overlay-pages manga-recovery-cold with the same actual SDK carrier and current callback. Native viewport measurement and pixels are not executed.');
    }
    if (id === 'manga-recovery') {
      for (const width of [320, 366, 760]) for (const height of [320, 568, 844]) for (const scale of [1, 2]) {
        const { instance: owner, metrics } = model();
        Object.assign(owner, { viewportWidth: width, viewportHeight: height });
        metrics.systemFontScale = scale;
        const baseDock = owner.bottomControlViewportHeight();
        const baseChrome = owner.controlsPresentedForWindow();
        owner.recovering = true;
        assert.equal(owner.bottomControlViewportHeight(), baseDock, 'recovery cannot consume the normal dock viewport');
        assert.equal(owner.controlsPresentedForWindow(), baseChrome, 'passive recovery cannot force normal control chrome');
        assert.ok(owner.recoveryNoticeHeight() > 44);
        assert.ok(owner.recoveryNoticeHeight() <= (height - 48) / 3);
        samples.push({ width, height, scale, dockHeight: baseDock, recoveryLimit: owner.recoveryNoticeHeight() });
      }

      const { instance: owner, properties, calls } = model();
      owner.recovering = true;
      owner.recoveryOverlay();
      properties.flush();
      const column = [...owner.nodes.values()].find(node => node.type === 'Column' && node.onTouch);
      assert.ok(column, 'the recovery owns a bounded independent overlay carrier');
      const notice = [...owner.children.values()].find(child => (child.tag ?? child.params?.tag) === '内容更新');
      assert.ok(notice);
      const action = notice.onReconcile ?? notice.params?.onReconcile;
      assert.equal(typeof action, 'function');
      assert.equal(column.hitTestBehavior, 'HitTestMode.Default');
      assert.equal(column.enabled, true);
      assert.equal(column.opacity, 1);
      let stopped = false;
      column.onTouch({ stopPropagation() { stopped = true; } });
      assert.equal(stopped, true);
      action(7);
      assert.deepEqual(calls, [7]);
      for (const [field, value] of [['controlsVisible', true], ['panel', 'directory'], ['panelPhase', 'preparing'],
        ['chapterEnd', true], ['openingRetry', true], ['loginRequiredForControls', true], ['windowChromeOverlayActive', true],
        ['appForeground', false], ['windowChromeActive', false], ['interactionBlocked', true], ['exiting', true], ['mounted', false], ['opened', false]]) {
        const before = owner[field];
        owner[field] = value;
        action(7);
        assert.equal(calls.length, 1, `${field} rejects an old action before queued repaint`);
        owner[field] = before;
      }
      owner.controlsVisible = true;
      properties.flush();
      assert.equal(column.enabled, false);
      assert.equal(column.opacity, 0);
      assert.equal(column.hitTestBehavior, 'HitTestMode.None');
      assert.equal(column.accessibilityLevel, 'no-hide-descendants');
      owner.controlsVisible = false;
      properties.flush();
      assert.equal(column.enabled, true);
      assert.equal(column.opacity, 1);
      action(7);
      assert.deepEqual(calls, [7, 7]);
      owner.opened = false;
      owner.error = 'chapter unavailable';
      assert.equal(owner.controlsPresentedForWindow(), true, 'the existing failed-chapter controls remain available');
      assert.equal(owner.recoveryOverlayCurrent(owner.recoveryOverlayIdentity()), false,
        'a failed or preparing chapter preserves its own retry UI instead of an unusable recovery action');
      owner.opened = true;
      owner.error = '';
      owner.presentationGeneration++;
      action(7);
      assert.equal(calls.length, 2, 'a retired recovery callback cannot act on the successor chapter');

      const dockMutation = source.replace('const top = this.mangaTopBarHeight() + 10 +\n',
        'const top = this.mangaTopBarHeight() + 10 + (this.recovering ? this.recoveryNoticeHeight() + 8 : 0) +\n');
      assert.notEqual(dockMutation, source);
      const oldDock = model(dockMutation).instance;
      oldDock.viewportHeight = 320;
      const height = oldDock.bottomControlViewportHeight();
      oldDock.recovering = true;
      assert.notEqual(oldDock.bottomControlViewportHeight(), height, 'the prior recovery-dependent dock budget is rejected');
      const chromeMutation = source.replace('this.loginRequiredForControls || this.panel.length > 0);',
        'this.recovering || this.loginRequiredForControls || this.panel.length > 0);');
      assert.notEqual(chromeMutation, source);
      const oldChrome = model(chromeMutation).instance;
      oldChrome.recovering = true;
      assert.equal(oldChrome.controlsPresentedForWindow(), true, 'the prior implicit chrome expansion is rejected');
      console.log(JSON.stringify({ kind: 'app-overlay-pages', case: id, samples: samples.length,
        boundary: 'Actual SDK-emitted overlay properties, current action closures and production geometry methods. Image paint, system window scheduling, physical hit testing and Native pixels are not executed.' }));
    }
    recordContractCasePass(id);
  }
}
