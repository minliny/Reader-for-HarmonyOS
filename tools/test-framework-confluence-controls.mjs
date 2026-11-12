import assert from 'node:assert/strict';
import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';
import { buttonSource, foundationControls, foundationSpecs } from './lib/reader-foundation-control-probe.mjs';
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

function assertSingleNativeModifier(view) {
  const nodeKey = [...view.actor.nodes].find(([, node]) => node === view.target)?.[0];
  const calls = view.actor.attributeCalls.filter(call => call.id === nodeKey && call.property === 'attributeModifier');
  assert.equal(calls.length, 1, 'one native Button owns one combined attribute modifier');
}

function assertTarget(target) {
  assert.ok((target.width ?? target.constraintSize?.minWidth) >= 44, 'native carrier pays minimum width');
  assert.ok((target.height ?? target.constraintSize?.minHeight) >= 44, 'native carrier pays minimum height');
}

for (const id of selectContractCases(definitions)) {
  if (id === 'source-native-targets') {
    for (const scale of [1, 1.3, 1.6, 2]) {
      for (const specId of ['source-management-category', 'source-management-status-compact',
        'source-management-status-wide', 'source-management-login', 'source-management-detect',
        'source-tools-action', 'source-tools-compact']) {
        const view = button(specId, scale, { selectionSemantic: specId.includes('category'), primary: true });
        assertTarget(view.target);
        assertSingleNativeModifier(view);
        if (view.actor.selectionSemantic) {
          assert.equal(view.target.accessibilityRole, 'AccessibilityRoleType.RADIO');
          assert.equal(view.target.accessibilitySelected, true);
        }
        view.target.onClick();
        assert.equal(view.intents.length, 1);
        view.actor.actionEnabled = false;
        view.target.onClick();
        view.actor.actionEnabled = true;
        view.actor.aboutToDisappear();
        view.target.onClick();
        assert.equal(view.intents.length, 1, 'disabled and retired callbacks are rejected by the actual actor');
      }
    }
    const ordinary = button('source-action', 1);
    assert.equal(ordinary.target.height, 42, 'retained source-action keeps its authored target');
    assert.equal(ordinary.target.accessibilitySelected, undefined, 'default Button receives no new choice state');
    for (const variant of ['search-field-wide', 'search-filter-option']) assertSingleNativeModifier(button(variant, 1));
    const duplicateModifier = buttonSource.replaceAll('.attributeModifier(new ReaderButtonFrameModifier(',
      '.attributeModifier(new ReaderButtonSelectionModifier(this.selectionSemantic, this.primary))\n        .attributeModifier(new ReaderButtonFrameModifier(');
    assert.throws(() => assertSingleNativeModifier(button('source-management-category', 1, {}, foundationSpecs(), duplicateModifier)),
      /one native Button/, 'the former double-modifier assembly is rejected even when the probe can accumulate both');
    const specs = foundationSpecs();
    const oldHeight = { ...specs, resolveReaderButtonSpec: key => ({ ...specs.resolveReaderButtonSpec(key), height: 28 }) };
    assert.throws(() => assertTarget(button('source-management-login', 1, {}, oldHeight).target),
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
