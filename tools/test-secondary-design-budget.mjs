import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';
import { createReaderBuilderProbe } from './lib/reader-control-builder-probe.mjs';
import { switchControls, switchSpecs } from './lib/reader-switch-control-probe.mjs';
import { readerFoundationTokens } from './lib/reader-tokens-probe.mjs';
import { readerTypographyRoles } from './lib/reader-typography-probe.mjs';
import { readerAppColor } from '../entry/src/main/ets/ui/foundation/ReaderThemeRegistry.ts';

const read = path => readFileSync(new URL('../entry/src/main/ets/' + path, import.meta.url), 'utf8');
const enums = name => new Proxy({}, { get: (_target, key) => `${name}.${String(key)}` });
const deps = { ...readerFoundationTokens, ...readerTypographyRoles, readerAppColor,
  TextOverflow: enums('TextOverflow'), WordBreak: enums('WordBreak') };

function theme() {
  const samples = [];
  for (const viewport of [320, 366]) for (const scale of [1, 1.3, 1.6, 2]) {
    const probe = switchControls();
    const width = viewport - 38 - 2;
    // This finite native-measure port supplies a measured label width. It
    // proves allocation consumes that measurement, not a native font raster.
    const labelWidth = 48 * scale;
    const owner = probe.row.owner;
    Object.assign(owner, { label: 'App主题', icon: 'theme-icon', contentMinWidth: 168, mounted: true,
      getUIContext: () => ({ px2vp: value => value, getMeasureUtils: () => ({ measureText(input) {
        assert.equal(input.textContent, 'App主题');
        assert.equal(input.fontFamily, readerTypographyRoles.TYPE_APP_ROW_LABEL.fontFamily);
        assert.equal(input.fontSize, `${readerTypographyRoles.TYPE_APP_ROW_LABEL.fontSizeFp}fp`);
        return labelWidth;
      } }) }) });
    owner.recordContentWidth(width);
    const required = 24 + 40 + labelWidth + 12 + 168;
    assert.equal(owner.contentStacked, required > width);
    owner.initialRender();
    const nodes = [...owner.nodes.values()];
    const text = nodes.find(node => node.type === 'Text' && node.create === 'App主题');
    assert.ok(text);
    assert.equal(text.maxLines, owner.contentStacked ? undefined : 1);
    if (owner.contentStacked) {
      assert.ok(nodes.some(node => node.type === 'Column' && node.padding === 12));
      assert.ok(width - 24 - 40 >= labelWidth, 'complete label gets the full upper line');
    } else assert.ok(width - 24 - 40 - 12 - 168 >= labelWidth);
    owner.aboutToDisappear();
    const before = owner.contentRowWidth;
    owner.recordContentWidth(999);
    assert.equal(owner.contentRowWidth, before, 'retired row ignores later geometry');
    samples.push({ viewport, scale, rowWidth: width, measuredLabel: labelWidth, required,
      arrangement: owner.contentStacked ? 'stacked' : 'inline' });
  }
  class Child { constructor(owner, params, _storage, id) { Object.assign(this, { owner, params, id }); } }
  const page = createReaderBuilderProbe(read('features/settings/ui/SettingsPage.ets'), ['segmentRow'],
    { ...switchSpecs(), ReaderFormRow: Child }).owner;
  page.appThemeControl = () => {};
  page.segmentRow('App主题', () => 'theme-icon');
  const row = [...page.children.values()][0];
  assert.equal(row.params.contentMinWidth, switchSpecs().resolveReaderSegmentSpec('app-theme-segment').width,
    'page and shared control use the same width authority');
  const oldWidth = 320 - 38 - 2 - 24 - 12 - 168 - 28 - 12;
  assert.ok(oldWidth < 48, 'negative original layout rejects the complete label budget');
  console.log(JSON.stringify({ case: 'theme', samples, evidence: 'SDK composition and finite native-measure input; native font/layout OPEN' }));
}

function themeMeasurementIdentity() {
  const probe = switchControls(), owner = probe.row.owner;
  let measuredLabel = 48;
  Object.assign(owner, { label: 'App主题', icon: 'theme-icon', contentMinWidth: 168, mounted: true,
    getUIContext: () => ({ px2vp: value => value, getMeasureUtils: () => ({ measureText: () => measuredLabel }) }) });
  owner.recordContentWidth(326);
  assert.equal(owner.contentStacked, false);
  const inlineMeasure = owner.contentWidthChangeHandler();
  owner.initialRender();
  const actualMeasure = [...owner.nodes.values()].find(node => node.onAreaChange).onAreaChange;
  measuredLabel = 96;
  owner.uiConfigurationRevision++;
  owner.windowMetricsRevision++;
  assert.equal(owner.contentStacked, true);
  const currentMeasure = owner.contentWidthChangeHandler();
  currentMeasure({}, { width: '280vp' });
  assert.equal(owner.contentRowWidth, 280);
  inlineMeasure({}, { width: '326vp' }); actualMeasure({}, { width: '326vp' });
  assert.equal(owner.contentRowWidth, 280, 'retired inline/configuration receipts cannot overwrite current narrow width');
  const beforeLabel = owner.contentWidthChangeHandler();
  owner.label = '新的主题标签';
  beforeLabel({}, { width: '999vp' });
  assert.equal(owner.contentRowWidth, 280);
  owner.contentWidthChangeHandler()({}, { width: 302 });
  assert.equal(owner.contentRowWidth, 302, 'current label/configuration retains a live measurement callback');
  assert.ok(probe.properties.dependencies.get(owner)?.get('windowMetricsRevision')?.size > 0,
    'the actual Area attribute factory subscribes to window revision for rebinding');
  measuredLabel = 48;
  owner.windowMetricsRevision++;
  assert.equal(owner.contentStacked, false, 'actual StorageLink Watch remeasures the current window');
  measuredLabel = 96;
  owner.uiConfigurationRevision++;
  assert.equal(owner.contentStacked, true, 'actual configuration Watch remeasures current font policy');
  const retired = owner.contentWidthChangeHandler();
  owner.aboutToDisappear(); retired({}, { width: 999 });
  assert.equal(owner.contentRowWidth, 302);

  const firstProbe = switchControls(), first = firstProbe.row.owner;
  Object.assign(first, { label: 'App主题', icon: 'theme-icon', contentMinWidth: 168, mounted: true,
    getUIContext: () => ({ px2vp: value => value, getMeasureUtils: () => ({ measureText: () => 48 }) }) });
  first.initialRender();
  const firstArea = [...first.nodes.values()].find(node => node.onAreaChange).onAreaChange;
  firstArea({}, { width: 326 });
  assert.equal(first.contentRowWidth, 326); assert.equal(first.contentStacked, false,
    'the first legitimate stacked-branch measurement can choose inline');
  for (let i = 0; i < 5; i++) first.contentWidthChangeHandler()({}, { width: 326 });
  assert.equal(first.contentStacked, false, 'equal current widths do not oscillate layout');

  for (const kind of ['standard', 'compact', 'danger']) {
    const plain = switchControls().row.owner, actions = [];
    Object.assign(plain, { label: '原有动作', kind, mounted: true, contentMinWidth: 0,
      actionEnabled: true, isBusy: false, onAction: () => actions.push(kind),
      getUIContext: () => { throw Error('default rows do not need native capacity measurement'); } });
    plain.initialRender();
    plain.windowMetricsRevision++; plain.uiConfigurationRevision++;
    assert.equal(plain.contentRowWidth, 0);
    const button = [...plain.nodes.values()].find(node => node.type === 'Button');
    assert.equal(button.enabled, true); button.onClick(); assert.deepEqual(actions, [kind]);
    assert.equal([...plain.nodes.values()].filter(node => node.type === 'Column').length, 0,
      'default nonadaptive rows preserve their existing row branch');
  }
}

function themeAppearanceIdentity() {
  const probe = switchControls(), owner = probe.row.owner;
  Object.assign(owner, { label: 'App主题', icon: 'theme-icon', contentMinWidth: 168,
    getUIContext: () => ({ px2vp: value => value, getMeasureUtils: () => ({ measureText: () => 48 }) }) });
  owner.aboutToAppear(); owner.recordContentWidth(326); owner.initialRender();
  const row = [...owner.nodes.values()].find(node => node.onAreaChange);
  const oldMeasure = row.onAreaChange, revision = owner.contentAppearanceRevision;
  assert.ok(probe.properties.dependencies.get(owner)?.get('contentAppearanceRevision')?.size > 0,
    'the actual Area attribute subscribes to appearance revision');
  owner.aboutToDisappear(); oldMeasure({}, { width: 999 });
  assert.equal(owner.contentRowWidth, 326);
  owner.aboutToAppear(); probe.properties.flush();
  assert.equal(owner.contentAppearanceRevision, revision + 1);
  assert.equal([...owner.nodes.values()].find(node => node.onAreaChange), row,
    'reappearance keeps the same actual row actor');
  assert.notEqual(row.onAreaChange, oldMeasure, 'observable appearance identity rebinds the actual Area callback');
  oldMeasure({}, { width: 999 });
  assert.equal(owner.contentRowWidth, 326, 'the prior appearance cannot borrow mounted=true');
  row.onAreaChange({}, { width: 310 });
  assert.equal(owner.contentRowWidth, 310, 'the successor appearance has an admitted live measurement callback');
}

function sourceStats() {
  const source = read('features/source/ui/SourceManagementPage.ets');
  for (const width of [282, 328]) for (const scale of [1, 1.3, 1.6, 2]) {
    const owner = createReaderBuilderProbe(source, ['statsRow'], deps).owner;
    const label = '显示 123456/999999 个书源 · 123456 个启用';
    Object.assign(owner, { appThemeScheme: 'day', statsText: () => label, contentFrame: () => ({ width }), fontScale: () => scale });
    owner.statsRow();
    const node = [...owner.nodes.values()].find(node => node.type === 'Text');
    assert.equal(node.create, label);
    assert.equal(node.width, width);
    assert.equal(node.maxLines, undefined);
    assert.equal(node.height, undefined);
    assert.equal(node.maxFontScale, scale);
    assert.equal(node.wordBreak, 'WordBreak.BREAK_WORD');
  }
}

function batchSummary() {
  const source = read('features/source/ui/SourceToolsPage.ets');
  const labels = ['所选项通过 123456', '所选项未通过 123456', '检测错误 123456', '剩余 123456'];
  const owner = createReaderBuilderProbe(source, ['batchCounter'], deps).owner;
  owner.appThemeScheme = 'day';
  labels.forEach(label => owner.batchCounter(label, '#123456'));
  const counters = [...owner.nodes.values()].filter(node => node.type === 'Text');
  assert.equal(counters.length, 4);
  for (const node of counters) {
    assert.equal(node.width, undefined);
    assert.deepEqual(node.constraintSize, { maxWidth: '100%' });
    assert.equal(node.height, undefined);
    assert.equal(node.maxLines, undefined);
    assert.equal(node.padding.top + node.padding.bottom, 8);
    assert.equal(node.onClick, undefined);
  }
  // The audit regression is a forced 4×44+3×8 allocation for read-only facts.
  const old = { width: '100%', constraintSize: { minHeight: 44 } };
  assert.notEqual(counters[0].width, old.width);
  assert.notEqual(counters[0].constraintSize.minHeight, old.constraintSize.minHeight);
}

function syncRecovery() {
  const source = read('features/sync/ui/SyncPage.ets');
  const members = ['originalRecovery', 'originalRecoveryNotice', 'hasOriginalRecovery', 'recoveryIdentity',
    'recoveryCurrent', 'canContinueConfigSave', 'configSaveContinuationIdentities', 'configSaveGeneration',
    'canSkipBackupRetention', 'backupRetentionActionIdentities', 'backupGeneration', 'recoveryLabel'];
  class Notice { constructor(owner, params, _storage, id) { Object.assign(this, { owner, params, id }); } }
  for (const kind of ['config', 'retention', 'query']) {
    const calls = [];
    const owner = createReaderBuilderProbe(source, members, { ReaderRecoveryNotice: Notice }).owner;
    const operation = { operationId: 'operation-a', action: kind === 'config' ? 'saveConfig' : 'backup',
      completed: false, canContinueOriginal: kind === 'config', uploadQualified: kind === 'retention',
      retentionSkipped: false, projection: { facts: { generation: 7 } } };
    Object.assign(owner, { snapshot: { facts: { operation, busy: false } },
      feedbackView: () => ({ visible: true, canRetry: true, message: '原操作结果未确认', generation: 7 }),
      effectiveWebdavUrl: () => 'https://retained.test', effectiveWebdavUser: () => 'fixture-user',
      effectiveWebdavPath: () => 'fixture-path', webdavPass: 'fixture-password', backupPass: 'fixture-backup',
      onReconcile: generation => calls.push(['query', generation]),
      onContinueConfigSave: generation => calls.push(['config', generation]),
      onSkipBackupRetention: generation => calls.push(['retention', generation]) });
    owner.originalRecovery(owner.recoveryIdentity());
    const notices = [...owner.children.values()].filter(child => child instanceof Notice);
    assert.equal(notices.length, 1);
    const params = notices[0].params;
    assert.equal(params.secondaryActionLabel, kind === 'config' ? '继续原操作' : kind === 'retention' ? '保留备份，结束清理' : '');
    params.onReconcile(7);
    assert.deepEqual(calls, [['query', 7]]);
    params.onSecondaryAction();
    assert.deepEqual(calls, kind === 'query' ? [['query', 7]] : [['query', 7], [kind, 7]]);
    for (const mutate of [
      () => { owner.snapshot.facts.busy = true; },
      () => { owner.snapshot.facts.busy = false; operation.operationId = 'successor'; },
      () => { operation.operationId = 'operation-a'; operation.projection.facts.generation = 8; },
      () => { operation.projection.facts.generation = 7; operation.completed = true; },
      () => { operation.completed = false; owner.snapshot.restoreConflict = {}; },
    ]) {
      mutate();
      const before = calls.length;
      params.onReconcile(7); params.onSecondaryAction();
      assert.equal(calls.length, before, 'retained Notice closures preserve the original operation admission');
    }
  }
}

const cases = { theme, 'theme-measurement-identity': themeMeasurementIdentity, 'theme-appearance-identity': themeAppearanceIdentity, 'source-stats': sourceStats, 'batch-summary': batchSummary, 'sync-recovery': syncRecovery };
for (const id of selectContractCases({
  'theme-appearance-identity': 'Same FormRow actor reappearance rebinds the actual SDK Area factory and rejects the prior appearance callback.',
  'theme-measurement-identity': 'Actual FormRow Area callback captures label/configuration/window/branch identity, rejects retired receipts and admits current width.',
  theme: 'Actual SDK FormRow real measured-label allocation at320/366×1/1.3/1.6/2, shared width authority and retired geometry.',
  'source-stats': 'Actual SDK Source statistics retains full long counts without single-line/fixed-height cap.',
  'batch-summary': 'Actual SDK four readonly counter texts use natural width/height and wrap within their parent.',
  'sync-recovery': 'Actual SDK Sync Notice primary/secondary binding, config/retention/query separation and original identity guards.',
})) {
  cases[id]();
  recordContractCasePass(id);
}
