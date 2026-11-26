import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';

const cases = {
  'detail-footer-measurement': { description: 'Phone detail measures the dock without the fade for text and manga.', resources: [] },
  'button-press-animation-scope': { description: 'Stacked and plain buttons animate press scale after frame setters.', resources: [] },
  'file-primary-capsule': { description: 'Both local import primary actions use full capsules and keep their width rules.', resources: [] },
  'module-navigation-width': { description: 'Navigation label measurement pays both 9vp side insets.', resources: [] },
};

for (const id of selectContractCases(cases)) {
  if (id === 'detail-footer-measurement') await detailFooterMeasurement();
  if (id === 'button-press-animation-scope') await buttonPressAnimationScope();
  if (id === 'file-primary-capsule') await filePrimaryCapsule();
  if (id === 'module-navigation-width') await moduleNavigationWidth();
  recordContractCasePass(id);
}

async function detailFooterMeasurement() {
  const { localBookDetailSdk, localBookDetailSource } = await import('./lib/local-book-detail-sdk-probe.mjs');
  const { installedEtsCompiler } = await import('./lib/ets-compiler-runtime.mjs');
  const { ReaderInsetsVp, ReaderRectVp, ReaderWindowMetricsSnapshot } =
    await import('../entry/src/main/ets/ui/foundation/ReaderWindowMetrics.ts');
  const { ts, options } = installedEtsCompiler();
  const tree = ts.createSourceFile('LocalBookDetail.ets', localBookDetailSource,
    ts.ScriptTarget.Latest, true, ts.ScriptKind.ETS, options);
  const detail = tree.statements.find(node => node.name?.text === 'LocalBookDetail');
  const actionArea = detail.members.find(member => member.name?.text === 'actionArea');
  const stacks = [];
  function visit(node) {
    if (ts.isEtsComponentExpression(node) && node.expression.getText(tree) === 'Stack') stacks.push(node);
    ts.forEachChild(node, visit);
  }
  visit(actionArea);
  assert.equal(stacks.length, 2);
  assert.match(stacks[1].body.getText(tree), /\.linearGradient\(/, 'gradient is inside the decoration host');
  assert.equal(stacks[0].body.statements.at(-1).getText(tree), 'this.actionSurface();',
    'natural dock and decoration host are siblings');

  const metrics = new ReaderWindowMetricsSnapshot(new ReaderRectVp(0, 0, 390, 840));
  metrics.gestureInsets = new ReaderInsetsVp(0, 0, 0, 27);
  for (const [contentKind, clearance] of [['text', 24], ['manga', 28]]) {
    const { owner, properties } = localBookDetailSdk({ ReaderWindowCoordinator: { metrics: () => metrics } });
    Object.assign(owner, { book: { sourceId: 'remote', bookId: 'footer', contentKind, title: '书', author: '作者' },
      mounted: true, viewportWidth: 390, viewportHeight: 840, mangaFontsReady: true, admissionIdentity: 'footer' });
    owner.refreshGeometry();
    owner.initialRender();
    const scaffold = [...owner.children.values()].find(child => child.footerMeasurement !== undefined);
    assert.ok(scaffold, 'detail renders the production footer measurement owner');
    const measured = [...scaffold.nodes.values()].find(node => node.id === scaffold.footerMeasurement.id);
    const nodes = [...owner.nodes.values()];
    const host = nodes.find(node => node.type === 'Stack' && node.width === 0 && node.height === 0 && node.clip === false);
    assert.ok(host, 'out-of-bounds paint reserves zero layout space');
    assert.equal(host.hitTestBehavior, 'HitTestMode.None');
    const fade = nodes.find(node => node.type === 'Column' && node.linearGradient?.direction === 'top');
    assert.ok(fade);
    assert.equal(fade.width, 390);
    assert.equal(fade.position.y, -clearance);
    const dock = nodes.find(node => node.type === 'Stack' && node.constraintSize?.minHeight >= 44);
    assert.ok(dock && dock.height === undefined, 'the dock can grow to fit scaled labels');
    for (const height of [93, 93, 113, 113]) {
      measured.onAreaChange({}, { height });
      properties.flush();
      assert.equal(owner.geometry.footer.height, height);
      assert.equal(fade.height, height + owner.geometry.footer.bottom + clearance);
      assert.equal(fade.height, owner.geometry.content.endInset);
    }
  }
}

async function buttonPressAnimationScope() {
  const { foundationControls } = await import('./lib/reader-foundation-control-probe.mjs');
  const controls = foundationControls();
  for (const specId of ['sync-action', 'source-action']) {
    const actor = new controls.button.Component(undefined, { specId, label: '全选' });
    actor.aboutToAppear();
    actor.initialRender();
    const [nodeId] = [...actor.nodes.entries()].find(([, node]) => node.type === 'Button');
    const calls = actor.attributeCalls.filter(call => call.id === nodeId);
    const frameIndex = calls.findIndex(call => call.property === 'attributeModifier');
    const scaleIndex = calls.findIndex(call => call.property === 'scale');
    assert.ok(frameIndex >= 0 && scaleIndex > frameIndex);
    const enabledAnimations = calls.filter(call => call.property === 'contextAnimation' && call.args[0] != null);
    assert.equal(enabledAnimations.length, 1);
    assert.ok(calls.indexOf(enabledAnimations[0]) > frameIndex);
    assert.equal(calls[scaleIndex - 1], enabledAnimations[0]);
    assert.equal(enabledAnimations[0].args[0].duration, 140);
    assert.equal(calls[scaleIndex + 1].property, 'contextAnimation');
    assert.equal(calls[scaleIndex + 1].args[0], null);
  }
}

async function filePrimaryCapsule() {
  const { boundedSurfaceSdk } = await import('./lib/bounded-surface-sdk-probe.mjs');
  for (const specId of ['local-file-selection', 'local-import-result']) {
    const probe = boundedSurfaceSdk(), actions = [];
    const owner = new probe.deps.ReaderBoundedSurfaceActions(undefined, {
      specId, primaryLabel: '继续', actionWidth: 318, onAction: action => actions.push(action),
    });
    owner.initialRender();
    const primary = [...owner.nodes.values()].find(node => node.type === 'Button' && node.accessibilityText === '继续');
    assert.ok(primary);
    assert.equal(primary.borderRadius, 999);
    if (specId === 'local-import-result') assert.equal(primary.width, 318);
    else assert.equal(primary.layoutWeight, 1);
    primary.onClick();
    assert.deepEqual(actions, ['primary']);
  }
}

async function moduleNavigationWidth() {
  const { pureModuleProbe } = await import('./lib/ets-pure-module-probe.mjs');
  const { readerFoundationTokens } = await import('./lib/reader-tokens-probe.mjs');
  const { readerTypographyRoles } = await import('./lib/reader-typography-probe.mjs');
  const controlGeometry = await import('../entry/src/main/ets/features/reading/ui/ReaderControlGeometry.ts');
  const headerGeometry = await import('../entry/src/main/ets/features/reading/ui/ReaderControlHeaderGeometry.ts');
  const minimumSource = readFileSync(new URL('../entry/src/main/ets/features/reading/ui/ReaderControlMinimumMeasurement.ets', import.meta.url), 'utf8');
  const navigationWidths = [];
  const { measureReaderControlMinimum } = pureModuleProbe(minimumSource, 'ReaderControlMinimumMeasurement.ets', {
    ...controlGeometry, ...headerGeometry, ...readerTypographyRoles, ...readerFoundationTokens,
    measureReaderControlText(_context, _label, style, width) {
      if (style === readerTypographyRoles.TYPE_READER_CONTROLS_RETAINED_MODULE_BUTTON_LABEL) navigationWidths.push(width);
      return { heightVp: 20, singleLineWidthVp: 20 };
    },
  }, ['measureReaderControlMinimum']);
  const input = { context: {}, headerInter: false, title: '', identity: 'current', metricsRevision: 1,
    topBarHeightVp: 54, measureHomeForm: () => ({ minimumHeight: 100, minWidth: 100, fits: true }) };
  const result = measureReaderControlMinimum(input, 'home',
    { panelWidthVp: 364, quickContentWidthVp: 286, fullContentWidthVp: 338 }, 'current');
  assert.ok(result);
  assert.deepEqual(navigationWidths, [77, 77, 77, 77]);
}
