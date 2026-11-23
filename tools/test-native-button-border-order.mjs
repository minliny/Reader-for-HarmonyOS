import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';
import { createReaderBuilderProbe } from './lib/reader-control-builder-probe.mjs';
import { pureModuleProbe } from './lib/ets-pure-module-probe.mjs';
import { installedEtsCompiler } from './lib/ets-compiler-runtime.mjs';
import { resolveReaderChoiceSpec } from './lib/reader-choice-row-probe.mjs';
import { readerFoundationTokens } from './lib/reader-tokens-probe.mjs';
import { readerTypographyRoles } from './lib/reader-typography-probe.mjs';
import { readerAppColor } from '../entry/src/main/ets/ui/foundation/ReaderThemeRegistry.ts';
import * as readerFonts from '../entry/src/main/ets/ui/foundation/ReaderFontFamilies.ts';

const definitions = {
  'border-radius-order': {
    description: 'Actual native Button setters preserve each existing radius after border, including the Settings modifier.',
    resources: [],
  },
};
const sources = {
  choice: 'entry/src/main/ets/ui/controls/ReaderChoiceRow.ets',
  bounded: 'entry/src/main/ets/ui/surfaces/ReaderBoundedSurfaceActions.ets',
  appearance: 'entry/src/main/ets/features/reading/ui/ReaderControlAppearanceContent.ets',
  auto: 'entry/src/main/ets/features/reading/ui/ReaderControlAutoPageContent.ets',
  replace: 'entry/src/main/ets/features/reading/ui/ReaderControlReplaceContent.ets',
  overlay: 'entry/src/main/ets/features/reading/ui/ReaderTtsConfigOverlay.ets',
  settings: 'entry/src/main/ets/features/reading/ui/ReaderControlSettingsContent.ets',
  modifier: 'entry/src/main/ets/features/reading/ui/ReaderControlSettingsOptionModifier.ets',
  mangaChoice: 'entry/src/main/ets/features/manga/ui/MangaReadingSurface.ets',
  mangaFit: 'entry/src/main/ets/features/manga/ui/MangaReadingSurface.ets',
};
const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const dependencies = { ...readerFoundationTokens, ...readerTypographyRoles, ...readerFonts, readerAppColor,
  readerControlLerp: (from, to, progress) => from + (to - from) * progress };

function assertRadiusAfterBorder(owner, button, radius) {
  const nativeId = [...owner.nodes].find(([_id, node]) => node === button)[0];
  const calls = owner.attributeCalls.filter(call => call.id === nativeId);
  const borderIndex = calls.findLastIndex(call => call.property === 'border');
  const radiusIndex = calls.findLastIndex(call => call.property === 'borderRadius');
  assert.ok(borderIndex >= 0, 'actual native Button emits its border');
  assert.ok(radiusIndex > borderIndex, 'explicit native Button radius must follow its border');
  assert.equal(calls[radiusIndex].args[0], radius, 'the existing role radius is retained');
  return calls.filter(call => ['border', 'borderRadius'].includes(call.property))
    .map(call => ({ property: call.property, value: call.args[0] }));
}

// Preserve actual declaration values while comparing only setter order.
// The native port records calls. It does not emulate Button.border resetting
// its radius or render pixels from those calls.
const attributes = ['type', 'create', 'createWithChild', 'width', 'height', 'layoutWeight', 'padding',
  'constraintSize', 'border', 'borderRadius', 'backgroundColor', 'position', 'opacity', 'enabled',
  'fontFamily', 'fontWeight', 'fontSize', 'fontColor', 'lineHeight', 'textAlign', 'maxLines',
  'accessibilityText', 'accessibilityRole', 'accessibilityLevel', 'accessibilitySelected'];
function declarationValues(owner) {
  return [...owner.nodes.values()].map(node => Object.fromEntries(attributes
    .filter(key => Object.hasOwn(node, key)).map(key => [key, node[key]])));
}

// Restore the former incorrect pair order in the current actual method.
// No ignored artifact or historical worktree is needed to run this check.
function oldOrderSource(source, method) {
  const { ts, options } = installedEtsCompiler();
  const tree = ts.createSourceFile('BorderOrder.ets', source, ts.ScriptTarget.Latest, true,
    ts.ScriptKind.ETS, options);
  assert.deepEqual(tree.parseDiagnostics, []);
  let declaration;
  function find(node) {
    if (ts.isMethodDeclaration(node) && node.name.getText(tree) === method) declaration = node;
    ts.forEachChild(node, find);
  }
  find(tree);
  assert.ok(declaration, 'actual selected method is present');
  const calls = [];
  function collect(node) {
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) &&
      ['border', 'borderRadius'].includes(node.expression.name.text)) calls.push(node);
    ts.forEachChild(node, collect);
  }
  collect(declaration);
  const borders = calls.filter(node => node.expression.name.text === 'border');
  assert.equal(borders.length, 1, 'one exact native-border setter in this selected method');
  const borderStart = borders[0].expression.name.getStart(tree) - 1;
  const radius = calls.find(node => node.expression.name.text === 'borderRadius' &&
    node.expression.name.getStart(tree) > borderStart);
  assert.ok(radius, 'current explicit radius follows the actual border');
  const radiusStart = radius.expression.name.getStart(tree) - 1;
  const radiusCall = source.slice(radiusStart, radius.end);
  return source.slice(0, borderStart) + radiusCall + source.slice(borderStart, radiusStart) + source.slice(radius.end);
}

function actualFixture(kind, value, oldOrder = false) {
  const events = [];
  const file = sources[kind];
  const method = { choice: 'radioRow', bounded: 'textAction', appearance: 'themeAction',
    auto: 'speedStepButton', replace: 'toolbarButton', overlay: 'configurationBody', settings: 'segmentRow',
    mangaChoice: 'sheetChoice', mangaFit: 'fitLine' }[kind];
  const currentSource = read(file);
  const source = oldOrder && kind !== 'settings' ? oldOrderSource(currentSource, method) : currentSource;
  const bindings = { ...dependencies };
  let modifier;
  if (kind === 'settings') {
    const currentModifier = read(sources.modifier);
    const modifierSource = oldOrder ? oldOrderSource(currentModifier, 'applyNormalAttribute') : currentModifier;
    const { ReaderControlSettingsOptionModifier } = pureModuleProbe(modifierSource,
      'ReaderControlSettingsOptionModifier.ets', { readerAppColor, Color: { Transparent: 'Color.Transparent' } },
      ['ReaderControlSettingsOptionModifier']);
    modifier = new ReaderControlSettingsOptionModifier(() => events.push(['setting']));
    modifier.update({ x: 0, y: 0, width: 60, height: 30, opacity: 1 },
      { contentOpacity: 1, contentBlur: 0 }, value, true, '方向', 'day');
  }
  const owner = createReaderBuilderProbe(source, [method], bindings).owner;
  const paint = { contentOpacity: 1, contentBlur: 0 };
  Object.assign(owner, {
    appThemeScheme: 'day', appScheme: 'day', scheme: 'day', actionEnabled: true,
    selected: value, optionId: 'one', groupId: 'selection', label: '原选项', focusId: '',
    spec: () => resolveReaderChoiceSpec('download-radio'), choose: () => events.push(['choose']),
    specId: 'replace-editor', cancelEnabled: true, scaledHeight: height => height,
    dispatch: id => events.push(['dispatch', id]),
    minimumProfile: () => ({ themeActionHeight: 28 }),
    defaultThemeActionLabel: day => day ? '已设为日间' : '设为夜间主题',
    frame: () => ({ themeDayAction: { x: 0, y: 0 }, themeNightAction: { x: 80, y: 0 },
      toolbarCellHeight: 40, toolbarColumns: 3 }),
    actorPosition: actor => ({ x: actor.x, y: actor.y }), presentation: () => paint, motionProgress: 1,
    fullInput: () => true, requestDefaultTheme: day => events.push(['theme', day]),
    textMetric: (_key, fallback) => fallback,
    speedActor: () => ({ x: 0, y: 0, width: 30, height: 30, opacity: 1 }),
    sharedInput: () => true, p: () => 0, changeSpeedStep: increase => events.push(['step', increase]),
    toolbarButtonWidth: () => 100, toolbarButtonX: () => 0,
    state: { sessionKey: 'original' }, layer: '', readyInput: () => true,
    manager: false, choices: [], showManage: true, busy: false, errorText: '', selectionId: 'original',
    configurationStatus() {}, onManage: id => events.push(['manage', id]),
    groupLabel: () => '方向', label: () => ({ width: 60, height: 12, x: 0, y: 0 }),
    groupOptions: () => ['one'], optionLabel: () => '选项', optionModifier: () => modifier,
    isSegmentActive: () => value, bar: () => ({ x: 0, y: 0, width: 180, height: 30 }),
    sharedClip: () => undefined,
    choiceIcon: () => 'original-choice-icon', isSheetChoiceSelected: () => value,
    greenColor: () => '#2F6373', mutedColor: () => '#8F8576', softSurfaceColor: () => '#F4F0EA',
    inkColor: () => '#333333', lineColor: () => '#D0C5B4', fitPreference: value ? 'width' : 'contain',
    backgroundPreference: 'paper', sheetActionHeight: () => 44,
  });
  // radioRow uses a string label; Settings uses its existing label(row) method.
  if (kind === 'choice') owner.label = '原选项';
  const args = { choice: [], bounded: ['cancel'], appearance: [value], auto: [value],
    replace: [value ? 'add' : 'import', value ? '新增规则' : '导入', 'existing-icon', value, 0,
      () => events.push(['toolbar'])], overlay: [], settings: ['direction', 0],
    mangaChoice: ['sun', '暖纸', () => events.push(['mangaChoice'])],
    mangaFit: ['适合屏幕', 'width', () => events.push(['mangaFit'])] }[kind];
  owner[method](...args);
  const buttons = [...owner.nodes.values()].filter(node => node.type === 'Button');
  assert.equal(buttons.length, 1, 'the selected real template keeps its single native Button');
  return { owner, button: buttons[0], events };
}

for (const id of selectContractCases(definitions)) {
  const expectedRadius = { choice: 0, bounded: 6, appearance: 6, auto: 12, replace: 8, overlay: 0,
    settings: 6, mangaChoice: 12, mangaFit: 0 };
  const traces = [];
  let combinations = 0;
  for (const kind of Object.keys(expectedRadius)) {
    for (const value of [false, true]) {
      const actual = actualFixture(kind, value);
      const original = actualFixture(kind, value, true);
      traces.push({ kind, value, setters: assertRadiusAfterBorder(actual.owner, actual.button, expectedRadius[kind]) });
      assert.deepEqual(declarationValues(actual.owner), declarationValues(original.owner),
        'existing geometry, typography, native attributes and radius values remain equal');
      actual.button.onClick(); original.button.onClick();
      assert.deepEqual(actual.events, original.events, 'the original action port and arguments remain');
      assert.throws(() => assertRadiusAfterBorder(original.owner, original.button, expectedRadius[kind]),
        /explicit native Button radius must follow/, 'the former wrong setter pair order is rejected');
      combinations++;
    }
  }
  console.log(JSON.stringify({ kind: id, status: 'PASS', templates: 9, combinations,
    oldOrderNegatives: combinations, traces,
    boundary: 'Actual installed SDK emission and existing values only. Complete ArkTS/native radius raster NOT_RUN.' }));
  recordContractCasePass(id);
}
