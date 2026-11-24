import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';
import { foundationControls } from './lib/reader-foundation-control-probe.mjs';
import { switchControls } from './lib/reader-switch-control-probe.mjs';
import { iconButtonControls } from './lib/reader-icon-button-probe.mjs';
import { labeledIconControls } from './lib/reader-labeled-icon-action-probe.mjs';
import { createReaderBuilderProbe } from './lib/reader-control-builder-probe.mjs';
import { boundedMembers } from './lib/bounded-surface-sdk-probe.mjs';
import { readerTypographyRoles } from './lib/reader-typography-probe.mjs';
import { readerAppColor } from '../entry/src/main/ets/ui/foundation/ReaderThemeRegistry.ts';
import { selectedProductionValues } from './lib/selected-production-methods.mjs';

const cases = {
  controls: { description: 'Actual shared native shape/finite paint modifiers, retained spec updates, geometry callbacks and existing action targets.', resources: [] },
  matrix: { description: 'Production button matrix, independent native hit dimensions, themed paint, keyboard focus, disabled admission and large-text geometry.', resources: [] },
  families: { description: 'Actual shared book search paint/input separation, native Toggle and SegmentV2 geometry, and noninteractive tabular status badge paint.', resources: [] },
};

const nodes = (owner, kind) => [...owner.nodes.values()].filter(node => node.type === kind);
const currentProps = owner => Object.fromEntries(Object.keys(owner).filter(key => key.startsWith('__'))
  .map(key => [key.slice(2), owner[key.slice(2)]]));

function testControls() {
  const shared = foundationControls();
  let actions = 0;
  const owner = new shared.button.Component(undefined, {
    specId: 'search-primary', label: '搜索', actionEnabled: true, primary: false,
    layout: 'intrinsic', onAction: () => actions++,
  });
  owner.aboutToAppear();
  owner.initialRender();
  const button = nodes(owner, 'Button')[0];
  assert.equal(button.nativeInputType, 'ButtonType.Capsule', 'the actual type modifier selects a true pill');
  const retainedId = [...owner.nodes].find(([_id, node]) => node === button)[0];
  button.onClick();
  assert.equal(actions, 1);
  owner.updateStateVars({ ...currentProps(owner), specId: 'source-action', label: '普通动作' });
  shared.properties.flush();
  assert.equal(owner.nodes.get(retainedId), button, 'the retained native actor is updated');
  assert.equal(button.nativeInputType, 'ButtonType.Normal', 'retained pill-to-rectangle updates the native type attribute');
  assert.equal(button.borderRadius, 8, 'the rectangular recipe keeps its own finite radius');
  owner.updateStateVars({ ...currentProps(owner), specId: 'search-primary', actionEnabled: false });
  shared.properties.flush();
  assert.equal(button.nativeInputType, 'ButtonType.Capsule', 'retained rectangle-to-pill updates the native type attribute');
  button.onClick();
  assert.equal(actions, 1, 'shape updates preserve current disabled action admission');

  const ColorMetrics = {
    resourceColor: () => ({ red: 1, green: 2, blue: 3, blendColor: () => ({ color: 'native-pressed' }) }),
    rgba: (red, green, blue, alpha) => ({ red, green, blue, alpha }),
  };
  const icons = iconButtonControls({ ColorMetrics });
  for (const specId of ['reader-chapter-step', 'toolbar-standard', 'floating-more', 'shelf-section']) {
    const icon = new icons.icon.Component(undefined, { specId, icon: 'icon', accessibilityLabel: '动作', actionEnabled: true,
      selectionState: 'selected' });
    icon.aboutToAppear(); icon.initialRender();
    const hit = nodes(icon, 'Button')[0];
    const spec = icons.resolveReaderIconButtonSpec(specId);
    assert.equal(hit.backgroundColor, 'Color.Transparent', 'native target carries focus without a duplicate material');
    assert.equal(hit.borderRadius, Math.min(spec.radius, spec.boxSize / 2), 'native focus keeps its original shape');
    const paint = nodes(icon, 'Stack').find(node => node.scale !== undefined);
    assert.equal(paint.borderRadius, Math.min(spec.radius, spec.boxSize / 2));
    const nativeId = paint.id;
    const paintCalls = icon.attributeCalls.filter(call => call.id === nativeId);
    assert.ok(paintCalls.findIndex(call => call.property === 'border') <
      paintCalls.findIndex(call => call.property === 'attributeModifier'),
    'the actual native border is applied before the explicit finite corner modifier');
    assert.ok(hit.responseRegion.width >= 44 && hit.responseRegion.height >= 44, 'finite icon paint retains its independent target');
    const modifier = icon.attributeCalls.filter(call => call.property === 'attributeModifier').at(-1).args[0];
    const values = {};
    const attrs = new Proxy({}, { get: (_target, key) => value => { values[key] = value; return attrs; } });
    modifier.applyPressedAttribute(attrs);
    assert.equal(values.borderRadius, Math.min(spec.pressFeedback === false ? spec.radius : spec.pressedRadius, spec.boxSize / 2));
  }

  const labeled = labeledIconControls();
  const label = new labeled.component(undefined, { specId: 'rss-feed', label: '自然增长', actionEnabled: true });
  label.aboutToAppear(); label.initialRender();
  let row = nodes(label, 'Row')[0];
  const oldArea = row.onAreaChange;
  oldArea({}, { width: 80, height: 32 });
  labeled.properties.flush();
  row = nodes(label, 'Row')[0];
  assert.equal(row.borderRadius, 16, 'actual Row paint consumes the admitted box');
  label.updateStateVars({ ...currentProps(label), label: '修改后长内容' });
  labeled.properties.flush();
  oldArea({}, { width: 999, height: 999 });
  assert.notEqual(label.rowPaintShape?.height, 999, 'old content geometry is rejected');
  row = nodes(label, 'Row')[0];
  row.onAreaChange({}, { width: 80, height: 48 });
  labeled.properties.flush();
  row = nodes(label, 'Row')[0];
  assert.equal(row.borderRadius, 24, 'naturally growing paint updates its finite pill radius');
  const target = nodes(label, 'Button')[0];
  assert.ok(target.constraintSize.minHeight >= 44, 'compact paint preserves the original separate 44 target');
  const modifier = label.attributeCalls.filter(call => call.property === 'attributeModifier' &&
    call.args[0].constructor.name === 'ReaderLabeledIconRowModifier').at(-1).args[0];
  const values = {};
  const attrs = new Proxy({}, { get: (_target, key) => value => { values[key] = value; return attrs; } });
  modifier.applyPressedAttribute(attrs);
  assert.equal(values.borderRadius, 24, 'pressed paint consumes the same admitted geometry');

  const selectSource = readFileSync(new URL('../entry/src/main/ets/ui/controls/ReaderSelect.ets', import.meta.url), 'utf8');
  const selectValues = selectedProductionValues(new URL('../entry/src/main/ets/ui/controls/ReaderSelect.ets', import.meta.url),
    ['APPEARANCE_HIT_OUTSET']);
  const select = createReaderBuilderProbe(selectSource, boundedMembers(selectSource),
    { ...shared.dependencies, ...selectValues }, shared.hooks).owner;
  Object.assign(select, { variant: 'appearanceLibrary', value: '字体', mounted: true,
    resolvedWidth: () => 80, triggerHeight: () => 44, dropdownAnimation: () => ({ duration: 0 }) });
  select.initialRender();
  assert.equal(nodes(select, 'Button')[0].borderRadius, 22);
  assert.equal(nodes(select, 'Row')[0].borderRadius, 22, 'select hit and visible paint share actual finite dimensions');

  const groupSource = readFileSync(new URL('../entry/src/main/ets/features/bookshelf/ui/BookshelfGroupSelector.ets', import.meta.url), 'utf8');
  const group = createReaderBuilderProbe(groupSource, boundedMembers(groupSource), shared.dependencies, shared.hooks).owner;
  group.initialRender();
  const chip = nodes(group, 'Text').find(node => node.create === '默认');
  assert.equal(chip.borderRadius, (readerTypographyRoles.TYPE_APP_FILTER_OPTION.lineHeightFp + 10) / 2);
  assert.equal(nodes(group, 'Button')[0].constraintSize.minHeight, 44);

  const fieldSource = readFileSync(new URL('../entry/src/main/ets/ui/controls/ReaderSearchField.ets', import.meta.url), 'utf8');
  const field = createReaderBuilderProbe(fieldSource, ['passiveField', 'cornerRadius', 'nativeFieldBackground',
    'fieldBackgroundColor', 'resolvedAccessibilityLabel'], shared.dependencies, shared.hooks).owner;
  Object.assign(field, { variant: 'rssPassive', appThemeScheme: 'day', placeholder: '搜索订阅源', accessibilityLabel: '搜索',
    iconGap: () => 10, searchIcon: () => 'icon', iconSize: () => 20, fieldHeight: () => 44,
    horizontalPadding: () => 15, fieldBorderWidth: () => 1, fieldBorderColor: () => 'border' });
  for (const width of [0, 30, 80]) {
    field.fieldWidthVp = width;
    field.passiveField();
    assert.equal(nodes(field, 'Row').at(-1).borderRadius, Math.min(width, 44) / 2,
      'passive field corners consume the explicit frame width, including the narrow width axis');
  }
  class FieldInput { constructor(owner, params, _storage, id) { Object.assign(this, { owner, params, id }); } }
  const rss = createReaderBuilderProbe(readFileSync(new URL('../entry/src/main/ets/features/rss/ui/RssPage.ets', import.meta.url), 'utf8'),
    ['searchBar'], { ...shared.dependencies, ReaderSearchField: FieldInput },
    { ...shared.hooks, childSources: { ...shared.hooks.childSources, ReaderSearchField: fieldSource } }).owner;
  rss.contentFrame = () => ({ width: 280, left: 20 });
  rss.searchBar();
  const input = [...rss.children.values()][0];
  assert.equal(input.params.fieldWidthVp, 280, 'the sole real RSS caller binds its actual enclosing frame width');
  console.log('PASS actual shared pill modifiers, retained native type, finite measured paint, independent 44 targets');
}

function testPressMotion() {
  const foundation = foundationControls({ ColorMetrics: {
    resourceColor: color => ({ color, blendColor: overlay => ({ color: `blend:${color}:${overlay.color}` }) }),
  } });
  const icons = iconButtonControls({ ColorMetrics: {
    resourceColor: color => ({ color, blendColor: overlay => ({ color: `blend:${color}:${overlay.color}` }) }),
  } });
  const fixture = [
    [foundation.button.Component, foundation.properties,
      { specId: 'search-filter-option', label: '全部', primary: true, selectionSemantic: true }, 'Text'],
    [icons.icon.Component, icons.properties,
      { specId: 'toolbar-standard', icon: 'back', accessibilityLabel: '返回', selectionState: 'selected' }, 'Stack'],
  ];
  for (const [Component, properties, props, visualType] of fixture) {
    const owner = new Component(undefined, props);
    owner.aboutToAppear();
    owner.initialRender();
    const nodes = [...owner.nodes.values()];
    const target = nodes.find(node => node.type === 'Button');
    const visual = nodes.find(node => node.type === visualType);
    const hitGeometry = target.responseRegion ?? target.constraintSize;
    const targetOpacity = target.opacity;
    const restingSurface = visual.backgroundColor;
    const selected = target.accessibilitySelected;
    assert.ok((hitGeometry.width ?? hitGeometry.minWidth) >= 44);
    assert.ok((hitGeometry.height ?? hitGeometry.minHeight) >= 44);
    const touch = (type, id = 3) => {
      target.onTouch({ type, changedTouches: [{ id }] });
      properties.flush();
    };
    touch('down');
    assert.equal(target.scale, undefined, 'native hit target is not the animated actor');
    assert.deepEqual(target.responseRegion ?? target.constraintSize, hitGeometry);
    assert.deepEqual(visual.scale, { x: 0.978, y: 0.978 });
    assert.equal(visual.opacity, 1);
    assert.equal(visual.backgroundColor, `blend:${restingSurface}:#141D1B18`);
    assert.deepEqual(visual.animation, { duration: 140, curve: [0.2, 0, 0, 1] });
    touch('down', 7);
    touch('up', 7);
    assert.deepEqual(visual.scale, { x: 0.978, y: 0.978 }, 'secondary touch cannot release the active press');
    touch('cancel');
    assert.deepEqual(visual.scale, { x: 1, y: 1 });
    owner.reduceMotion = true;
    touch('down');
    assert.deepEqual(visual.scale, { x: 1, y: 1 });
    assert.equal(visual.opacity, 0.92);
    assert.equal(target.opacity, targetOpacity);
    assert.equal(target.accessibilitySelected, selected);
    assert.deepEqual(visual.animation, { duration: 120, curve: 'Curve.EaseOut' });
    touch('cancel');
    assert.equal(visual.opacity, 1);
    assert.equal(visual.backgroundColor, restingSurface, 'the original visual surface returns after cancellation');
    touch('down');
    touch('up');
    assert.equal(owner.pressPointer, -1);
    assert.equal(visual.opacity, 1);
    touch('down');
    const snapshot = Object.fromEntries(Object.keys(owner).filter(key => key.startsWith('__'))
      .map(key => [key.slice(2), owner[key.slice(2)]]));
    owner.updateStateVars({ ...snapshot, actionEnabled: false });
    properties.flush();
    assert.equal(owner.pressPointer, -1);
    assert.equal(visual.opacity, 1);
    if (visualType === 'Stack') assert.equal(nodes.find(node => node.type === 'Image').opacity, 0.45);
    touch('down');
    assert.equal(owner.pressPointer, -1);
    assert.equal(target.enabled, false);
  }
}

function testButtonMatrix() {
  let scale = 1;
  const shared = foundationControls({ windowMetrics: () => ({ systemFontScale: scale }) });
  const sizes = [['large', 46, 24, 15], ['medium', 38, 16, 13], ['small', 30, 12, 12]];
  const variants = [
    ['primary', 'TOK_PRIMARY_DARK', 'TOK_ON_PRIMARY'],
    ['tonal', 'TOK_PRIMARY_SOFT', 'TOK_PRIMARY_DARK'],
    ['subtle', 'TOK_SURFACE_FIELD', 'TOK_INK'],
    ['danger', 'app.action.destructiveSoft', 'app.action.destructive'],
  ];
  for (const scheme of ['day', 'night']) for (const [variant, surface, ink] of variants) for (const [size, height, inset, textSize] of sizes) {
    let clicks = 0, focus = 0;
    const owner = new shared.button.Component(undefined, { variant, size, scheme, label: '确认 12',
      focusId: 'reader-matrix-action', onAction: () => clicks++, onFocused: () => focus++ });
    owner.aboutToAppear(); owner.initialRender();
    const [target] = nodes(owner, 'Button');
    const [paint] = nodes(owner, 'Row');
    const [label] = nodes(owner, 'Text');
    assert.deepEqual(target.constraintSize, { minWidth: 44, minHeight: 44 });
    assert.equal(target.scale, undefined);
    assert.equal(target.id, 'reader-matrix-action');
    assert.equal(paint.constraintSize.minHeight, height);
    assert.deepEqual(paint.padding, { left: inset, right: inset });
    assert.equal(paint.borderRadius, 999);
    assert.equal(paint.backgroundColor, readerAppColor(surface, scheme));
    assert.equal(label.fontSize, textSize);
    assert.equal(label.fontFeature, '"tnum" 1');
    assert.equal(label.fontColor, readerAppColor(ink, scheme));
    target.onFocus(); target.onClick(); assert.deepEqual([focus, clicks], [1, 1]);
    owner.updateStateVars({ ...currentProps(owner), actionEnabled: false });
    shared.properties.flush(); target.onClick();
    assert.equal(clicks, 1);
    assert.equal(target.enabled, false);
    assert.equal(paint.opacity, 0.45);
    assert.equal(paint.backgroundColor, readerAppColor('TOK_SURFACE_FIELD', scheme));
    assert.equal(label.fontColor, readerAppColor('TOK_MUTED', scheme));
    scale = 2; owner.readerWindowMetricsRevision += 1; shared.properties.flush();
    assert.ok(paint.constraintSize.minHeight > height, 'large text grows paint independently of the hit minimum');
    scale = 1;
    owner.aboutToDisappear();
  }
}

function testControlFamilies() {
  const shared = foundationControls();
  const source = name => readFileSync(new URL(`../entry/src/main/ets/ui/controls/${name}.ets`, import.meta.url), 'utf8');
  const search = source('ReaderSearchField');
  const field = createReaderBuilderProbe(search,
    ['fixedLineHeightField', 'bookEditorLane', 'nativeFieldBackground', 'nativeInputBackground',
      'fieldHeight', 'inputHeight', 'horizontalPadding', 'isBookField', 'fieldBackgroundColor', 'fieldBorderWidth', 'fieldBorderColor'],
    shared.dependencies, shared.hooks).owner;
  Object.assign(field, {
    variant: 'bookPanel', appThemeScheme: 'day', placeholder: '搜索书名', text: '第12章',
    bookFontScale: () => 1, bookTextStyle: () => readerTypographyRoles.TYPE_SEARCH_BOOK_PANEL_INPUT,
    resolvedAccessibilityLabel: () => '搜索书名', bookPanelFrameId: 'book-search',
    clearable: true, bookPanelClearId: 'book-search-clear',
  });
  field.fixedLineHeightField();
  const frame = nodes(field, 'Stack').find(node => node.id === 'book-search');
  const paint = nodes(field, 'Row').find(node => node.height === 40);
  const input = nodes(field, 'TextInput')[0];
  const clear = nodes(field, 'Button').find(node => node.id === 'book-search-clear');
  assert.equal(frame.height, 44);
  assert.equal(paint.height, 40);
  assert.equal(paint.borderRadius, 20);
  assert.equal(paint.backgroundColor, readerAppColor('TOK_SURFACE_FIELD', 'day'));
  assert.equal(paint.border.width, 1);
  assert.equal(input.height, 44);
  assert.equal(input.borderRadius, 0);
  assert.equal(input.fontFeature, '"tnum" 1');
  assert.deepEqual([clear.width, clear.height], [44, 44]);

  const switches = switchControls();
  for (const specId of ['standard-toggle', 'bookshelf-update-toggle']) {
    const intents = [];
    const owner = new switches.toggle.Component(undefined, { specId, inputIdentity: specId, onToggle: next => intents.push(next) });
    owner.aboutToAppear(); owner.initialRender();
    const target = nodes(owner, 'Toggle')[0];
    assert.deepEqual([target.width, target.height, target.switchStyle.pointRadius, target.switchStyle.trackBorderRadius],
      [44, 26, 10, 13]);
    assert.deepEqual(target.responseRegion, { x: 0, y: -9, width: 44, height: 44 });
    assert.equal(target.selectedColor, readerAppColor('TOK_PRIMARY_DARK', 'day'));
    target.onChange(true); assert.deepEqual(intents, [true]);
    assert.equal(owner.value, false, 'business owner still accepts the native proposal');
  }
  const choices = [];
  const segmented = switches.mount(switches.segment, {
    inputIdentity: 'theme', options: ['跟随系统', '浅色宣纸', '夜间松墨'], optionIds: ['system', 'day', 'night'],
    selectedIndex: 0, onSelect: index => choices.push(index),
  });
  const capsule = switches.capsules(segmented)[0].params;
  assert.equal(nodes(segmented, 'Row')[0].borderRadius, 12);
  assert.equal(capsule.itemBorderRadius.value, 9);
  assert.equal(capsule.itemMinHeight.value, 44);
  assert.equal(capsule.items[0].textModifier.attributes.fontFeature, '"tnum" 1');
  capsule.onItemClicked(1); assert.deepEqual(choices, [1]);
  assert.equal(segmented.selectedIndex, 0, 'native item presses remain proposals');

  const badgeSource = source('StatusBadge');
  const Badge = createReaderBuilderProbe(badgeSource, boundedMembers(badgeSource), {
    ...shared.dependencies, LineJoinStyle: { Round: 'LineJoinStyle.Round' },
    uiContext: { vp2px: value => value },
  }, shared.hooks).Component;
  for (const [status, role] of [['success', 'app.status.goodSoft'], ['error', 'app.status.checkErrorSoft']]) {
    const badge = new Badge(undefined, { status, label: '书源测速 128 毫秒', text: '128ms' });
    badge.initialRender();
    const frame = nodes(badge, 'Stack').find(node => node.accessibilityGroup);
    const value = nodes(badge, 'Text')[0];
    assert.equal(frame.borderRadius, 999);
    assert.equal(frame.backgroundColor, readerAppColor(role, 'day'));
    assert.equal(frame.accessibilityText, '书源测速 128 毫秒');
    assert.equal(frame.onClick, undefined);
    assert.equal(value.fontFeature, '"tnum" 1');
    assert.equal(value.fontSize, 11);
  }
  const symbol = new Badge(undefined, { status: 'pending', label: '搜索中', text: '128ms', symbolOnly: true });
  symbol.initialRender();
  const markCarrier = nodes(symbol, 'Stack').find(node => node.accessibilityGroup);
  assert.deepEqual([markCarrier.width, markCarrier.height, markCarrier.accessibilityLevel], [14, 18, 'no']);
  assert.equal(nodes(symbol, 'Text').length, 0, 'existing symbol-only facts stay in their compact graphic slot');

}

for (const id of selectContractCases(cases)) {
  if (id === 'controls') {
    testControls();
    testPressMotion();
  } else if (id === 'matrix') {
    testButtonMatrix();
  } else {
    testControlFamilies();
  }
  recordContractCasePass(id);
}
