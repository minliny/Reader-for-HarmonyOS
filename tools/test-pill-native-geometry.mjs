import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';
import { foundationControls } from './lib/reader-foundation-control-probe.mjs';
import { iconButtonControls } from './lib/reader-icon-button-probe.mjs';
import { labeledIconControls } from './lib/reader-labeled-icon-action-probe.mjs';
import { createReaderBuilderProbe } from './lib/reader-control-builder-probe.mjs';
import { boundedMembers } from './lib/bounded-surface-sdk-probe.mjs';
import { readerTypographyRoles } from './lib/reader-typography-probe.mjs';
import { selectedProductionValues } from './lib/selected-production-methods.mjs';

const cases = {
  controls: { description: 'Actual shared native shape/finite paint modifiers, retained spec updates, geometry callbacks and existing action targets.', resources: [] },
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
    assert.equal(hit.borderRadius, Math.min(spec.radius, spec.boxSize / 2));
    const nativeId = icon.attributeCalls.find(call => call.property === 'createWithChild').id;
    const paintCalls = icon.attributeCalls.filter(call => call.id === nativeId);
    assert.ok(paintCalls.findIndex(call => call.property === 'border') <
      paintCalls.findIndex(call => call.property === 'attributeModifier'),
    'the actual native border is applied before the explicit finite corner modifier');
    assert.ok(hit.responseRegion.width >= 44 && hit.responseRegion.height >= 44, 'finite icon paint retains its independent target');
    const modifier = icon.attributeCalls.filter(call => call.property === 'attributeModifier').at(-1).args[0];
    const values = {};
    const attrs = new Proxy({}, { get: (_target, key) => value => { values[key] = value; return attrs; } });
    modifier.applyPressedAttribute(attrs);
    assert.equal(values.borderRadius, Math.min(spec.pressedRadius, spec.boxSize / 2));
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
  const icons = iconButtonControls();
  const fixture = [
    [foundation.button.Component, foundation.properties,
      { specId: 'search-filter-option', label: '全部', primary: true, selectionSemantic: true }, 'Text'],
    [icons.icon.Component, icons.properties,
      { specId: 'toolbar-standard', icon: 'back', accessibilityLabel: '返回', selectionState: 'selected' }, 'Image'],
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
    if (visualType === 'Text') assert.equal(visual.backgroundColor, `blend:${restingSurface}:#141D1B18`);
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
    assert.equal(visual.opacity, visualType === 'Image' ? 0.45 : 1);
    touch('down');
    assert.equal(owner.pressPointer, -1);
    assert.equal(target.enabled, false);
  }
}

for (const id of selectContractCases(cases)) {
  testControls();
  testPressMotion();
  recordContractCasePass(id);
}
