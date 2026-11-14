import assert from 'node:assert/strict';
import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';
import { buttonSource, foundationControls, foundationSpecs, foundationModifiers } from './lib/reader-foundation-control-probe.mjs';
import { inlineSelectSdk } from './lib/reader-inline-select-sdk-probe.mjs';
import { createDefaultReaderWindowMetrics } from '../entry/src/main/ets/ui/foundation/ReaderWindowMetrics.ts';

const definitions = {
  'source-native-targets': { description: 'Current SDK-emitted native Buttons reserve the scaled source/tool targets and publish opt-in choice semantics.', resources: [] },
  'source-group-budget': { description: 'Actual select panel and choice row pay border-box width and 44vp native row minimum while default variants keep their own geometry.', resources: [] },
};

function button(specId, fontScale, extra = {}, specs = foundationSpecs(), definition = buttonSource) {
  const controls = foundationControls({ specs, buttonSource: definition, windowMetrics: () => ({ systemFontScale: fontScale }) });
  const intents = [];
  const actor = new controls.button.Component(undefined, {
    specId, label: '全选', onAction: () => intents.push(specId), ...extra,
  });
  actor.aboutToAppear();
  actor.initialRender();
  const target = controls.nodes(actor).find(node => node.type === 'Button');
  assert.ok(target, 'production action uses the native Button carrier');
  return { actor, controls, target, intents };
}

function assertChoice(target, selected) {
  assert.equal(target.accessibilityRole, 'AccessibilityRoleType.RADIO', 'choice role reaches the native carrier');
  assert.equal(target.accessibilitySelected, selected, 'current selection reaches the native carrier');
}

function assertUpdatedButton(view) {
  view.actor.primary = false;
  view.actor.actionEnabled = false;
  view.controls.properties.flush();
  const target = view.controls.nodes(view.actor).find(node => node.type === 'Button');
  assertTarget(target);
  assert.equal(target.enabled, false, 'normal SDK update disables the carrier');
  if (view.actor.selectionSemantic) assertChoice(target, false);
  target.onClick();
  assert.equal(view.intents.length, 1, 'disabled update rejects the real callback');
  view.actor.actionEnabled = true;
  view.controls.properties.flush();
  view.actor.aboutToDisappear();
  target.onClick();
  assert.equal(view.intents.length, 1, 'retired actor rejects its retained callback');
}

function assertTarget(target) {
  assert.ok((target.width ?? target.constraintSize?.minWidth) >= 44, 'native carrier pays minimum width');
  assert.ok((target.height ?? target.constraintSize?.minHeight) >= 44, 'native carrier pays minimum height');
}

function assertNativeStates() {
  const ColorMetrics = { resourceColor: color => ({ red: 1, green: 2, blue: 3,
    blendColor: () => ({ color: `pressed:${color}` }) }), rgba: () => ({}) };
  const { ReaderButtonFrameModifier } = foundationModifiers(foundationSpecs(), ColorMetrics);
  function applied(modifier, method) {
    const attributes = {};
    const native = new Proxy({}, { get: (_target, property) => (...args) => {
      attributes[property] = args.length === 1 ? args[0] : args; return native;
    } });
    modifier[method](native); return attributes;
  }
  const enabled = new ReaderButtonFrameModifier('source-tools-compact', false, true, 'intrinsic', 'day');
  const normal = applied(enabled, 'applyNormalAttribute'), pressed = applied(enabled, 'applyPressedAttribute');
  assert.notEqual(pressed.backgroundColor, normal.backgroundColor, 'pressed native state consumes the platform blend result');
  assert.equal(pressed.height, normal.height); assert.equal(pressed.borderRadius, normal.borderRadius);
  const disabled = new ReaderButtonFrameModifier('source-tools-compact', false, false, 'intrinsic', 'day');
  const disabledNormal = applied(disabled, 'applyNormalAttribute'), disabledPress = applied(disabled, 'applyPressedAttribute');
  assert.equal(disabledPress.backgroundColor, disabledNormal.backgroundColor, 'disabled press preserves its normal surface');
  assert.deepEqual(applied(disabled, 'applyDisabledAttribute'), disabledNormal);
}

for (const id of selectContractCases(definitions)) {
  if (id === 'source-native-targets') {
    assertNativeStates();
    for (const scale of [1, 1.3, 1.6, 2]) {
      for (const specId of ['source-management-category', 'source-management-status-compact',
        'source-management-status-wide', 'source-management-login', 'source-management-detect',
        'source-tools-action', 'source-tools-compact']) {
        const view = button(specId, scale, { selectionSemantic: specId.includes('category'), primary: true });
        assertTarget(view.target);
        if (view.actor.selectionSemantic) {
          assertChoice(view.target, true);
        }
        view.target.onClick();
        assert.equal(view.intents.length, 1);
        assertUpdatedButton(view);
      }
    }
    const ordinary = button('source-action', 1);
    assert.equal(ordinary.target.height, 44, 'source-action keeps its current authored target');
    assert.equal(ordinary.target.accessibilitySelected, undefined, 'default Button receives no new choice state');
    const duplicateModifier = buttonSource.replaceAll('.attributeModifier(new ReaderButtonFrameModifier(',
      '.attributeModifier(new ReaderButtonSelectionModifier(this.selectionSemantic, this.primary))\n        .attributeModifier(new ReaderButtonFrameModifier(');
    const composed = button('source-management-status-wide', 1, { selectionSemantic: true, primary: true }, foundationSpecs(), duplicateModifier);
    assertTarget(composed.target);
    assertChoice(composed.target, true);
    composed.target.onClick();
    assertUpdatedButton(composed);
    const override = duplicateModifier.replaceAll('.attributeModifier(new ReaderButtonFrameModifier(',
      '.attributeModifier(new ReaderButtonSelectionModifier(true, false))\n        .attributeModifier(new ReaderButtonFrameModifier(');
    const overridden = button('source-management-status-wide', 1, { selectionSemantic: false, primary: true }, foundationSpecs(), override);
    assertChoice(overridden.target, false);
    const missingChoice = buttonSource.replace('instance.accessibilityRole(AccessibilityRoleType.RADIO).accessibilitySelected(this.primary)',
      'instance.accessibilityRole(AccessibilityRoleType.BUTTON)');
    assert.notEqual(missingChoice, buttonSource);
    assert.throws(() => assertChoice(button('source-management-status-wide', 1,
      { selectionSemantic: true, primary: true }, foundationSpecs(), missingChoice).target, true), /choice role/);
    const staleSelection = buttonSource.replace('accessibilitySelected(this.primary)', 'accessibilitySelected(true)');
    const stale = button('source-management-status-wide', 1, { selectionSemantic: true, primary: true }, foundationSpecs(), staleSelection);
    stale.target.onClick();
    assert.throws(() => assertUpdatedButton(stale), /current selection/, 'a broken state update fails the actual updated property');
    const unguarded = buttonSource.replace('if (this.mounted && this.actionEnabled) this.onAction()', 'this.onAction()');
    const unsafe = button('source-tools-action', 1, {}, foundationSpecs(), unguarded);
    unsafe.target.onClick();
    assert.throws(() => assertUpdatedButton(unsafe), /disabled update/, 'a broken action guard fails the real disabled callback');
    const specs = foundationSpecs();
    const oldHeight = { ...specs, resolveReaderButtonSpec: key => ({ ...specs.resolveReaderButtonSpec(key), height: 28, minHeight: undefined }) };
    assert.throws(() => assertTarget(button('source-management-status-wide', 1, {}, oldHeight).target),
      /minimum height/, 'old 28vp actual native carrier fails the current requirement');
  }
  if (id === 'source-group-budget') {
    for (const width of [320, 366]) {
      const metrics = createDefaultReaderWindowMetrics();
      metrics.windowRect.width = width;
      const uiContext = {
        getFont: () => ({}), px2vp: value => value,
        getMeasureUtils: () => ({ measureText: () => 1 }),
        animateTo: (_options, action) => action(),
      };
      const sdk = inlineSelectSdk({ uiContext, dependencies: { readerWindowMetrics: () => metrics } });
      const panel = new sdk.dependencies.ReaderSelectPanel(undefined, {
        variant: 'sourceGroup', value: '', options: ['A'], selectionId: 'source-group:1',
      });
      panel.aboutToAppear();
      assert.equal(panel.resolvedWidth(), 46, 'real panel minimum pays two borders around its 44vp content');
      panel.selectedRow();
      const target = sdk.nodes(panel).find(node => node.type === 'Button');
      assert.ok(target);
      assert.equal(target.width, '100%');
      assert.equal(target.constraintSize.minHeight, 44);
      assert.ok(panel.resolvedWidth() - 2 >= 44, 'actual border-box has room for the child width');
      panel.variant = 'default';
      assert.equal(panel.resolvedWidth(), 43, 'source-specific minimum leaves the default width policy intact');
    }
  }
  recordContractCasePass(id);
}
