import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { createArkUIPropertyRuntimeProbe } from '../../lib/arkui-property-runtime-probe.mjs';
import { createReaderBuilderProbe } from '../../lib/reader-control-builder-probe.mjs';
import { inlineSelectSdk } from '../../lib/reader-inline-select-sdk-probe.mjs';
import { pureModuleProbe } from '../../lib/ets-pure-module-probe.mjs';
import { readerFoundationTokens } from '../../lib/reader-tokens-probe.mjs';
import { readerTypographyRoles } from '../../lib/reader-typography-probe.mjs';
import { selectedProductionValues } from '../../lib/selected-production-methods.mjs';
import { ReaderKeyboardAreaVp, ReaderRectVp, ReaderWindowMetricsSnapshot } from '../../../entry/src/main/ets/ui/foundation/ReaderWindowMetrics.ts';
import * as selectGeometry from '../../../entry/src/main/ets/ui/foundation/ReaderSelectGeometry.ts';

const triggerPath = new URL('../../../entry/src/main/ets/ui/controls/ReaderSelect.ets', import.meta.url);
const pagePath = new URL('../../../entry/src/main/ets/features/source/ui/SourceManagementPage.ets', import.meta.url);
const searchPath = new URL('../../../entry/src/main/ets/ui/controls/ReaderSearchField.ets', import.meta.url);

test('source group trigger centers its measured label and chevron in the actual trigger height', () => {
  const properties = createArkUIPropertyRuntimeProbe();
  const source = readFileSync(triggerPath, 'utf8');
  const { owner } = createReaderBuilderProbe(source, ['phoneTrigger', 'trigger', 'sourceGroupTrigger'], {
    ...properties.sdk, ...readerFoundationTokens, ...readerTypographyRoles, ...selectGeometry,
    readerAppColor: () => '#FFFFFFFF',
  }, properties.hooks);
  Object.assign(owner, {
    variant: 'sourceGroup', value: '全部分组', focusId: 'group-trigger', appThemeScheme: 'day', resolvedWidth: () => 252,
    dropdownAnimation: () => ({}), triggerEnabled: () => true,
  });
  for (const valueHeight of [15, 24, 36]) {
    const triggerHeight = Math.max(44, valueHeight + 20);
    owner.measuredValueHeight = () => valueHeight;
    owner.triggerHeight = () => triggerHeight;
    owner.phoneTrigger();
    const frame = [...owner.nodes.values()].findLast(node => node.id === 'group-trigger:frame');
    assert.ok(frame, 'visible border has its own native paint node inside the trigger');
    assert.equal(frame.height, triggerHeight - 4);
    assert.deepEqual(frame.position, { x: 0, y: 2 });
    const button = [...owner.nodes.values()].findLast(node => node.type === 'Button');
    assert.equal(button.height, triggerHeight);
    assert.deepEqual(button.responseRegion, { x: 0, y: 0, width: '100%', height: triggerHeight });
    const [text, icon] = [...owner.nodes.values()].slice(-3).filter(node => node.type === 'Text' || node.type === 'Image');
    assert.equal(text.height, valueHeight);
    assert.equal(text.position.x, 14);
    assert.equal(text.position.y + text.height / 2, triggerHeight / 2);
    assert.equal(icon.position.y + icon.height / 2, triggerHeight / 2);
  }
});

function selectSdk(metrics) {
  const uiContext = {
    getFont: () => ({}), px2vp: value => value,
    animateTo(_params, apply) { apply(); },
    getMeasureUtils: () => ({
      measureText: ({ textContent }) => textContent.length * 15,
      measureTextSize: ({ textContent }) => ({ width: textContent.length * 15, height: 24 }),
    }),
  };
  return inlineSelectSdk({ uiContext, dependencies: { readerWindowMetrics: () => metrics } });
}

test('Source Management replaces the measured group box with a search field above the results', () => {
  const metrics = new ReaderWindowMetricsSnapshot(new ReaderRectVp(0, 0, 366, 600));
  metrics.ready = true;
  const sdk = selectSdk(metrics);
  const { ReaderSelectPanel, ReaderChoiceRow } = sdk.dependencies;
  const searchSource = readFileSync(searchPath, 'utf8');
  const { readerActionTouchRegion, READER_ACTION_MIN_TARGET } = pureModuleProbe(
    readFileSync(new URL('ReaderActionAccessibility.ets', searchPath), 'utf8'),
    'ReaderActionAccessibility.ets', {}, ['readerActionTouchRegion', 'READER_ACTION_MIN_TARGET']);
  const modifiers = pureModuleProbe(searchSource.slice(0, searchSource.indexOf('@Component')),
    'ReaderSearchInputTarget.ets', { FrameCallback: class {}, readerActionTouchRegion }, ['ReaderSearchInputTarget']);
  const { Component: ReaderSearchField } = createReaderBuilderProbe(searchSource, [
    'build', 'autoLineHeightField', 'fieldHeight', 'inputHeight', 'fieldBorderWidth', 'fieldBorderColor', 'cornerRadius',
    'isBookField', 'nativeInputBackground', 'directoryFontScale', 'iconGap', 'searchIcon', 'iconSize', 'horizontalPadding',
    'textStyle', 'fieldBackgroundColor', 'inputColor', 'caretColor', 'placeholderColor', 'resolvedAccessibilityLabel',
    'editingNativeId', 'changeText', 'onTextChange', 'mounted', 'variant', 'mode', 'text', 'placeholder', 'editingFocusId',
    'directoryFocusId', 'naturalFieldHeightVp', 'directoryFocusAllowed', 'accessibilityLabel',
  ], { ...sdk.dependencies, ...modifiers, SEARCH_CONTROL_MIN_TARGET: READER_ACTION_MIN_TARGET,
    readerReadableFontScale: value => value }, sdk.hooks);
  const constants = selectedProductionValues(pagePath, ['GROUP_ICON_WIDTH', 'GROUP_LABEL_GAP', 'GROUP_TRIGGER_GAP']);
  const { owner } = createReaderBuilderProbe(readFileSync(pagePath, 'utf8'), [
    'groupFilter', 'groupOverlay', 'recordGroupTrigger', 'numericAreaLength', 'toggleGroupSelection', 'commitGroupSelection',
    'dismissGroupSelection', 'retireGroupSelection', 'overlayTop', 'overlayBottom', 'overlayLeft', 'overlayRight', 'groupOverlayTop',
    'groupX', 'groupY', 'groupTriggerWidth', 'groupTriggerHeight', 'groupClosingAnchor', 'groupValue',
    'groupOpen', 'groupClosing', 'groupSelectionId', 'groupSearchField', 'groupSearchIsCurrent', 'visibleGroupOptions',
    'groupSearchQuery', 'changeGroupSearch', 'requestGroupClose', 'collapseGroupSearch',
    'originX', 'originY', 'viewportWidth', 'viewportHeight', 'readerWindowMetricsRevision',
  ], {
    ...sdk.dependencies, ...constants, sourceTemporaryGeneration: 0, ReaderRectVp, ReaderSearchField,
    ReaderWindowCoordinator: { metrics: () => metrics },
  }, { ...sdk.hooks, childSources: { ...sdk.hooks.childSources, ReaderSearchField: searchSource } });
  let keyboardHides = 0;
  const setKeyboardTop = top => {
    metrics.keyboardArea = new ReaderKeyboardAreaVp(true, true, [new ReaderRectVp(0, top, 366, 600 - top)]);
    owner.readerWindowMetricsRevision += 1;
  };
  Object.assign(owner, {
    mounted: true, appThemeScheme: 'day', originX: 23, originY: 24, viewportWidth: 320, viewportHeight: 440, reduceMotion: true,
    groupValue: '当前分组', groupOptions: () => ['全部分组', '当前分组', '特别长的书源分组名称，用来覆盖选项折行和滚动的场景', '其他'],
    groupSelectWidth: () => 225, groupLabelWidth: () => 30, filterControlWidth: () => 300,
    managementInputIsCurrent: () => true, ownsGroupSelection: identity => owner.groupOpen && identity === owner.groupSelectionId,
    groupTriggerFocusId: () => 'group-trigger', groupCloseAction: () => () => {},
    groupPanelFocusPrefix: identity => `${identity}:focus`, groupPanelLayoutAction: () => () => {}, toolsFocusId: () => 'header',
    scheduleGroupFocus() {}, cancelGroupFocus() {}, cancelToolsReturnFocus() {}, prepareVerificationGroupText() {},
    hideManagementKeyboard() { keyboardHides += 1; },
    footerFallbackHeight: () => 50, refreshGeometry() {}, observeVerificationOverlay() {}, rebuildSourceProjection() {},
  });

  owner.groupFilter();
  const triggerBox = sdk.nodes(owner).find(node => node.id === 'reader-source-group-trigger');
  const measureTrigger = (x, y, width) => triggerBox.onAreaChange({}, { width, height: 44, globalPosition: { x, y } });
  const panelFrame = panel => sdk.nodes(panel).find(node => node.type === 'Column' && node.position !== undefined);

  owner.toggleGroupSelection();
  assert.equal(owner.groupOpen, false, 'unmeasured trigger cannot open a modal');
  measureTrigger(123, 200, '160vp');
  setKeyboardTop(200);
  owner.toggleGroupSelection();
  assert.equal(owner.groupOpen, false, 'zero space below the measured trigger cannot open a modal');
  setKeyboardTop(245);
  owner.toggleGroupSelection();
  assert.equal(owner.groupOpen, false, 'opening needs the editor and a full option row');

  setKeyboardTop(324);
  owner.toggleGroupSelection();
  owner.groupOverlay();
  const panel = sdk.walk(owner).find(child => child instanceof ReaderSelectPanel);
  assert.ok(panel);
  sdk.properties.flush();
  assert.equal(triggerBox.visibility, 'Visibility.Hidden');
  const field = sdk.walk(owner).find(child => child instanceof ReaderSearchField);
  assert.ok(field);
  field.mounted = true;
  const input = sdk.nodes(field).find(node => node.type === 'TextInput');
  assert.ok(input);
  assert.equal(input.create.placeholder, '搜索分组');
  assert.deepEqual(sdk.nodes(field).find(node => node.type === 'Row').padding, { left: 14, right: 44 },
    'the expanded editor starts at the same inset as the collapsed value');
  assert.equal(input.fontFamily, readerTypographyRoles.TYPE_SELECT_SOURCE_GROUP_VALUE.fontFamily);
  assert.equal(input.fontSize, readerTypographyRoles.TYPE_SELECT_SOURCE_GROUP_VALUE.fontSizeFp);
  assert.ok(!sdk.nodes(field).some(node => node.type === 'Image'), 'no leading icon displaces the expanded label');
  const collapseButtons = () => sdk.nodes(owner).filter(node => node.type === 'Button' && node.accessibilityText === '收起分组');
  const collapse = collapseButtons()[0];
  assert.ok(collapse);
  assert.equal(collapse.width, 44);
  assert.equal(collapse.height, 44);
  assert.equal(collapse.id, 'reader-source-group-collapse');
  assert.equal(panel.menuHeaderHeight, 44, 'the search field reserves the original trigger height');
  assert.equal(sdk.nodes(field).find(node => node.type === 'Stack').height, 44);
  assert.equal(sdk.nodes(field).find(node => node.type === 'Stack').width, '100%');
  const chrome = sdk.nodes(panel).find(node => node.id === `${panel.selectionId}:frame`);
  assert.deepEqual(chrome.position, { x: 0, y: 2 });
  assert.equal(chrome.height, 40, 'the opening menu starts with the same compact paint as the closed selector');
  sdk.nodes(panel).find(node => node.type === 'Column' && node.onAppear).onAppear();
  sdk.properties.flush();
  const arrows = sdk.nodes(owner).filter(node => node.type === 'Image' && node.width === 12 && node.position?.x === 23);
  assert.ok(arrows.some(node => node.height === 12 && node.rotate?.angle === -180));
  assert.equal(chrome.height, 122, 'menu paint grows down from the same upper border');
  assert.equal(chrome.backgroundColor, sdk.dependencies.readerAppColor('app.surface.menuSolid', 'day'));
  assert.equal(chrome.border.color, sdk.dependencies.readerAppColor('app.border.sourceGroup', 'day'));
  assert.equal(chrome.borderRadius, 8);
  const frame = panelFrame(panel);
  assert.deepEqual(frame.position, { x: 100, y: 176 });
  assert.equal(frame.width, 160, 'uses native layout width even when the planned width and long option disagree');
  assert.equal(frame.height, 124);
  assert.equal(sdk.nodes(panel).filter(node => node.type === 'Scroll').length, 1);
  const rows = sdk.walk(panel).filter(child => child instanceof ReaderChoiceRow);
  assert.equal(rows[0].label, owner.groupValue);
  assert.equal(rows[0].selected, true);
  assert.equal(rows[0].focusId, `${owner.groupSelectionId}:focus:selected`);
  assert.equal(rows[0].hideIcon, true, 'the selected result is a choice rather than another trigger');
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

  // The finite SDK port does not model removing mounted native branches.
  // Mount the actual result builder at each query outcome for inspection.
  const renderResults = () => {
    const results = new ReaderSelectPanel(undefined, {
      variant: 'sourceGroup', controlWidth: 145, reduceMotion: true, menuHeaderHeight: 44,
      selectionId: owner.groupSelectionId, value: owner.groupValue, options: owner.visibleGroupOptions(),
      emptyOptionsText: panel.emptyOptionsText, onCommit: panel.onCommit, onDismiss: panel.onDismiss,
      onMenuHeaderCollapse: panel.onMenuHeaderCollapse,
    });
    results.aboutToAppear();
    results.initialRender();
    return results;
  };
  input.onChange(' 不存在 ');
  assert.deepEqual(owner.visibleGroupOptions(), []);
  assert.ok(sdk.nodes(renderResults()).some(node => node.type === 'Text' && node.create === '没有匹配的分组'));
  input.onChange(' 其他 ');
  assert.deepEqual(owner.visibleGroupOptions(), ['其他']);
  assert.equal(owner.groupValue, '当前分组', 'typing only filters the menu');
  owner.commitGroupSelection('当前分组', owner.groupSelectionId);
  assert.equal(owner.groupClosing, false, 'a result hidden by the query cannot be selected');
  const choices = sdk.walk(renderResults()).filter(child => child instanceof ReaderChoiceRow);
  assert.deepEqual(choices.map(child => child.label), ['其他']);
  const [choice] = choices;
  sdk.nodes(choice).find(node => node.type === 'Button').onClick();
  assert.equal(owner.groupValue, '其他');
  assert.equal(keyboardHides, 1);
  measureTrigger(135, 200, 145);
  assert.equal(owner.groupSearchQuery, '', 'the query is scoped to one opening');
  assert.equal(owner.groupOpen, false);
  setKeyboardTop(340);
  owner.toggleGroupSelection();
  assert.equal(owner.groupClosingAnchor, undefined);
  assert.equal(owner.groupY, 200, 'the next opening retains current trigger layout');
  input.onChange('retired query');
  assert.equal(owner.groupSearchQuery, '', 'an edit callback from the retired editor cannot affect the new opening');
  collapse.onClick();
  assert.equal(owner.groupClosing, false, 'a retired collapse click cannot close the new opening');

  const opening = owner.groupSelectionId;
  owner.changeGroupSearch(opening, '其他');
  const currentCollapse = sdk.nodes(renderResults()).find(node => node.id === 'reader-source-group-collapse');
  assert.ok(currentCollapse);
  assert.notEqual(currentCollapse, collapse);
  currentCollapse.onClick();
  currentCollapse.onClick();
  assert.equal(owner.groupClosing, true);
  assert.equal(keyboardHides, 2, 'the explicit collapse requests one keyboard dismissal');
  assert.equal(owner.groupValue, '其他', 'collapse keeps the existing choice');
  owner.dismissGroupSelection(opening);
  assert.equal(owner.groupOpen, false);
  assert.equal(owner.groupSearchQuery, '', 'explicit collapse restores the trigger and clears the menu query');
});

test('capped source group menus avoid serializing or publishing native option heights', () => {
  const metrics = new ReaderWindowMetricsSnapshot(new ReaderRectVp(0, 0, 366, 844));
  const sdk = selectSdk(metrics);
  const { ReaderSelectPanel, ReaderChoiceRow } = sdk.dependencies;
  for (const count of [314, 316]) {
    const options = Array.from({ length: count }, (_, index) => `测试书源分组 ${index}`);
    const value = count === 314 ? options[0] : '此前选择的分组';
    const panel = new ReaderSelectPanel(undefined, {
      variant: 'sourceGroup', value, options, x: 100, y: 176, controlWidth: 160,
      hostTopVp: 176, hostBottomVp: 620, hostRightVp: 320, reduceMotion: true, selectionId: `large:${count}`,
      menuHeaderHeight: 44,
    });
    let optionListSerializations = 0;
    const stringify = JSON.stringify;
    JSON.stringify = function (input, ...args) {
      if (Array.isArray(input) && input[1] === 'sourceGroup' && Array.isArray(input[5])) optionListSerializations += 1;
      return stringify(input, ...args);
    };
    try {
      panel.aboutToAppear();
      panel.initialRender();
      const nodes = sdk.nodes(panel);
      nodes.find(node => node.type === 'Column' && node.onAppear).onAppear();
      const rows = sdk.walk(panel).filter(row => row instanceof ReaderChoiceRow);
      assert.equal(rows.length, count);
      assert.equal(rows[0].label, options[0]);
      assert.ok(rows.every(row => row.wrapLabel));
      for (const row of rows) {
        sdk.nodes(row).find(node => node.type === 'Button').onAreaChange({}, { height: 72 });
      }
      sdk.properties.flush();
      const frame = nodes.find(node => node.type === 'Column' && node.position !== undefined);
      assert.equal(frame.height, 374);
      assert.equal(nodes.filter(node => node.type === 'Scroll').length, 1);
      panel.maxPanelHeight = 280;
      sdk.properties.flush();
      assert.equal(frame.height, 324);
      panel.hostBottomVp = 270;
      sdk.properties.flush();
      assert.equal(frame.height, 94);
      assert.deepEqual(frame.position, { x: 100, y: 176 });
    } finally {
      JSON.stringify = stringify;
    }
    assert.equal(optionListSerializations, 0, 'capped rows and host changes never serialize every group per row');
    assert.equal(panel.measuredHeightRevision, 0, 'capped option height reports never publish a new layout');
  }
});

test('short source group menus retain wrapped row heights when the keyboard leaves more room', () => {
  const metrics = new ReaderWindowMetricsSnapshot(new ReaderRectVp(0, 0, 366, 844));
  const sdk = selectSdk(metrics);
  const { ReaderSelectPanel, ReaderChoiceRow } = sdk.dependencies;
  const panel = new ReaderSelectPanel(undefined, {
    variant: 'sourceGroup', value: '全部分组', options: ['全部分组', '很长的选项'], x: 100, y: 176, controlWidth: 160,
    hostTopVp: 176, hostBottomVp: 251, hostRightVp: 320, reduceMotion: true, selectionId: 'short',
  });
  panel.aboutToAppear();
  panel.initialRender();
  const nodes = sdk.nodes(panel);
  nodes.find(node => node.type === 'Column' && node.onAppear).onAppear();
  const frame = nodes.find(node => node.type === 'Column' && node.position !== undefined);
  const rows = sdk.walk(panel).filter(row => row instanceof ReaderChoiceRow);
  const reports = rows.map(row => sdk.nodes(row).find(node => node.type === 'Button').onAreaChange);
  reports[0]({}, { height: 60 });
  reports[1]({}, { height: 90 });
  sdk.properties.flush();
  assert.equal(frame.height, 75);
  assert.equal(panel.measuredHeightRevision, 0, 'short-host receipts do not publish until they change the panel height');
  panel.hostBottomVp = 430;
  sdk.properties.flush();
  assert.equal(frame.height, 152, 'removing the keyboard uses the actual height of both rows');

  metrics.systemFontScale = 2;
  panel.readerWindowMetricsRevision += 1;
  reports[1]({}, { height: 120 });
  assert.equal(panel.optionHeights.size, 0, 'a prior-font area callback cannot fill the current height cache');
  panel.optionHeightHandler('很长的选项', false)(120);
  sdk.properties.flush();
  assert.equal(frame.height, 166, 'uncapped height changes still publish');
});
