import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { createArkUIPropertyRuntimeProbe } from '../../lib/arkui-property-runtime-probe.mjs';
import { createReaderBuilderProbe } from '../../lib/reader-control-builder-probe.mjs';
import { inlineSelectSdk } from '../../lib/reader-inline-select-sdk-probe.mjs';
import { readerFoundationTokens } from '../../lib/reader-tokens-probe.mjs';
import { readerTypographyRoles } from '../../lib/reader-typography-probe.mjs';
import { selectedProductionValues } from '../../lib/selected-production-methods.mjs';
import { ReaderKeyboardAreaVp, ReaderRectVp, ReaderWindowMetricsSnapshot } from '../../../entry/src/main/ets/ui/foundation/ReaderWindowMetrics.ts';

const triggerPath = new URL('../../../entry/src/main/ets/ui/controls/ReaderSelect.ets', import.meta.url);
const pagePath = new URL('../../../entry/src/main/ets/features/source/ui/SourceManagementPage.ets', import.meta.url);

test('source group trigger centers its measured label and chevron in the actual trigger height', () => {
  const properties = createArkUIPropertyRuntimeProbe();
  const source = readFileSync(triggerPath, 'utf8');
  const { owner } = createReaderBuilderProbe(source, ['trigger', 'sourceGroupTrigger'], {
    ...properties.sdk, ...readerFoundationTokens, ...readerTypographyRoles, readerAppColor: () => '#FFFFFFFF',
  }, properties.hooks);
  Object.assign(owner, {
    variant: 'sourceGroup', value: '全部分组', appThemeScheme: 'day', resolvedWidth: () => 252,
    dropdownAnimation: () => ({}),
  });
  for (const valueHeight of [15, 24, 36]) {
    const triggerHeight = Math.max(44, valueHeight + 20);
    owner.measuredValueHeight = () => valueHeight;
    owner.triggerHeight = () => triggerHeight;
    owner.trigger();
    const [text, icon] = [...owner.nodes.values()].slice(-3).filter(node => node.type === 'Text' || node.type === 'Image');
    assert.equal(text.height, valueHeight);
    assert.equal(text.position.x, 14);
    assert.equal(text.position.y + text.height / 2, triggerHeight / 2);
    assert.equal(icon.position.y + icon.height / 2, triggerHeight / 2);
  }
});

test('Source Management opens from the measured group box and scrolls down within the keyboard-safe height', () => {
  const metrics = new ReaderWindowMetricsSnapshot(new ReaderRectVp(0, 0, 366, 600));
  metrics.ready = true;
  const uiContext = {
    getFont: () => ({}), px2vp: value => value,
    animateTo(_params, apply) { apply(); },
    getMeasureUtils: () => ({
      measureText: ({ textContent }) => textContent.length * 15,
      measureTextSize: ({ textContent }) => ({ width: textContent.length * 15, height: 24 }),
    }),
  };
  const sdk = inlineSelectSdk({ uiContext, dependencies: { readerWindowMetrics: () => metrics } });
  const { ReaderSelectPanel, ReaderChoiceRow } = sdk.dependencies;
  const constants = selectedProductionValues(pagePath, ['GROUP_ICON_WIDTH', 'GROUP_LABEL_GAP', 'GROUP_TRIGGER_GAP']);
  const { owner } = createReaderBuilderProbe(readFileSync(pagePath, 'utf8'), [
    'groupFilter', 'groupOverlay', 'recordGroupTrigger', 'numericAreaLength', 'toggleGroupSelection', 'commitGroupSelection',
    'dismissGroupSelection', 'retireGroupSelection', 'overlayTop', 'overlayBottom', 'overlayLeft', 'overlayRight', 'groupOverlayTop',
    'groupX', 'groupY', 'groupTriggerWidth', 'groupClosingAnchor', 'groupValue', 'groupOpen', 'groupClosing', 'groupSelectionId',
    'originX', 'originY', 'viewportWidth', 'viewportHeight', 'readerWindowMetricsRevision',
  ], {
    ...sdk.dependencies, ...constants, sourceTemporaryGeneration: 0, ReaderRectVp,
    ReaderWindowCoordinator: { metrics: () => metrics },
  }, sdk.hooks);
  const setKeyboardTop = top => {
    metrics.keyboardArea = new ReaderKeyboardAreaVp(true, true, [new ReaderRectVp(0, top, 366, 600 - top)]);
    owner.readerWindowMetricsRevision += 1;
  };
  Object.assign(owner, {
    mounted: true, appThemeScheme: 'day', originX: 23, originY: 24, viewportWidth: 320, viewportHeight: 440, reduceMotion: true,
    groupValue: '当前分组', groupOptions: () => ['全部分组', '当前分组', '特别长的书源分组名称，用来覆盖选项折行和滚动的场景', '其他'],
    groupSelectWidth: () => 225, groupLabelWidth: () => 30, filterControlWidth: () => 300,
    managementInputIsCurrent: () => true, ownsGroupSelection: identity => owner.groupOpen && identity === owner.groupSelectionId,
    requestGroupClose: () => false, groupTriggerFocusId: () => 'group-trigger', groupCloseAction: () => () => {},
    groupPanelFocusPrefix: identity => `${identity}:focus`, groupPanelLayoutAction: () => () => {}, toolsFocusId: () => 'header',
    scheduleGroupFocus() {}, cancelGroupFocus() {}, cancelToolsReturnFocus() {}, prepareVerificationGroupText() {},
    footerFallbackHeight: () => 50, refreshGeometry() {}, observeVerificationOverlay() {}, rebuildSourceProjection() {},
  });

  owner.groupFilter();
  const triggerBox = sdk.nodes(owner).find(node => node.id === 'reader-source-group-trigger');
  const measureTrigger = (x, y, width) => triggerBox.onAreaChange({}, { width, globalPosition: { x, y } });
  const panelFrame = panel => sdk.nodes(panel).find(node => node.type === 'Column' && node.position !== undefined);

  owner.toggleGroupSelection();
  assert.equal(owner.groupOpen, false, 'unmeasured trigger cannot open a modal');
  measureTrigger(123, 200, '160vp');
  setKeyboardTop(200);
  owner.toggleGroupSelection();
  assert.equal(owner.groupOpen, false, 'zero space below the measured trigger cannot open a modal');
  setKeyboardTop(245);
  owner.toggleGroupSelection();
  assert.equal(owner.groupOpen, false, 'opening needs a full 44vp row plus the panel border');

  setKeyboardTop(324);
  owner.toggleGroupSelection();
  owner.groupOverlay();
  const panel = sdk.walk(owner).find(child => child instanceof ReaderSelectPanel);
  assert.ok(panel);
  sdk.nodes(panel).find(node => node.type === 'Column' && node.onAppear).onAppear();
  sdk.properties.flush();
  const frame = panelFrame(panel);
  assert.deepEqual(frame.position, { x: 100, y: 176 });
  assert.equal(frame.width, 160, 'uses native layout width even when the planned width and long option disagree');
  assert.equal(frame.height, 124);
  assert.equal(sdk.nodes(panel).filter(node => node.type === 'Scroll').length, 1);
  const rows = sdk.walk(panel).filter(child => child instanceof ReaderChoiceRow);
  assert.equal(rows[0].label, owner.groupValue);
  assert.equal(rows[0].selected, true);
  assert.equal(rows[0].focusId, `${owner.groupSelectionId}:focus:selected`);
  assert.equal(sdk.nodes(rows[0]).find(node => node.type === 'Button').constraintSize.minHeight, 44);

  setKeyboardTop(275);
  sdk.properties.flush();
  assert.deepEqual(frame.position, { x: 100, y: 176 });
  assert.equal(frame.height, 75, 'keyboard changes update only the available height');

  measureTrigger(135, 210, 145);
  sdk.properties.flush();
  assert.deepEqual(frame.position, { x: 112, y: 186 });
  assert.equal(frame.width, 145);
  assert.equal(frame.height, 65);

  owner.commitGroupSelection('其他', owner.groupSelectionId);
  measureTrigger(135, 200, 145);
  sdk.properties.flush();
  assert.deepEqual(frame.position, { x: 112, y: 186 }, 'projection scroll cannot pull the closing panel along');
  owner.dismissGroupSelection(owner.groupSelectionId);
  owner.toggleGroupSelection();
  assert.equal(owner.groupClosingAnchor, undefined);
  assert.equal(owner.groupY, 200, 'the next opening retains current trigger layout');
});
