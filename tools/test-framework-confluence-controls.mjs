import assert from 'node:assert/strict';
import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';
import { buttonSource, foundationControls, foundationSpecs, foundationModifiers } from './lib/reader-foundation-control-probe.mjs';
import { inlineSelectSdk } from './lib/reader-inline-select-sdk-probe.mjs';
import { createDefaultReaderWindowMetrics } from '../entry/src/main/ets/ui/foundation/ReaderWindowMetrics.ts';

const definitions = {
  'source-native-targets': { description: 'Current SDK-emitted native Buttons reserve the scaled source/tool targets and publish opt-in choice semantics.', resources: [] },
  'directory-query-targets': { description: 'Actual shared directory query retains compact paint/input recipes inside a paid44vp wrapper and centered response through normal Toolbar assembly and short prefix allocation.', resources: [] },
  'inline-popup-layout': { description: 'Normal InlineSelect popup mounts a naturally sized shared panel inside current window capacity, preserving positioned overlay hosting and current motion/identity guards.', resources: [] },
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
  if (id === 'directory-query-targets') await directoryQueryTargets();
  if (id === 'inline-popup-layout') await inlinePopupLayout();
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

async function directoryQueryTargets() {
  const { readFileSync } = await import('node:fs');
  const { pureModuleProbe } = await import('./lib/ets-pure-module-probe.mjs');
  const { createReaderBuilderProbe } = await import('./lib/reader-control-builder-probe.mjs');
  const { createArkUIPropertyRuntimeProbe } = await import('./lib/arkui-property-runtime-probe.mjs');
  const { boundedMembers } = await import('./lib/bounded-surface-sdk-probe.mjs');
  const { selectedProductionMethods } = await import('./lib/selected-production-methods.mjs');
  const { readerFoundationTokens, surfaceFontResolvers } = await import('./lib/reader-foundation-control-probe.mjs');
  const searchGeometry = await import('../entry/src/main/ets/ui/foundation/ReaderSearchControlGeometry.ts');
  const budget = await import('../entry/src/main/ets/features/reading/presentation/ReaderFullDirectoryBudget.ts');
  const root = new URL('../entry/src/main/ets/', import.meta.url);
  const read = path => readFileSync(new URL(path, root), 'utf8');
  const source = read('ui/controls/ReaderSearchField.ets');
  const target = pureModuleProbe(source.slice(0, source.indexOf('@Component')), 'ReaderSearchInputTarget.ets',
    { FrameCallback: class {} }, ['ReaderSearchInputTarget', 'ReaderSearchFocusFrame']);
  for (const width of [320, 366]) for (const scale of [1, 1.3, 1.6, 2]) {
    const metrics = createDefaultReaderWindowMetrics(); metrics.windowRect.width = width; metrics.systemFontScale = scale;
    for (const caller of [{ variant: 'full-directory', field: 32, input: 30 },
      { variant: 'full-directory', field: 32, input: 32 }, { variant: 'manga-catalog', field: 44, input: 44 }]) {
      const properties = createArkUIPropertyRuntimeProbe();
      const dependencies = { ...properties.sdk, ...target, ...readerFoundationTokens, ...surfaceFontResolvers(), ...searchGeometry,
        readerWindowMetrics: () => metrics, TextInputController: class {} };
      const Field = createReaderBuilderProbe(source, boundedMembers(source), dependencies, properties.hooks).Component;
      const toolbar = createReaderBuilderProbe(read('features/reading/ui/ReaderDirectoryToolbar.ets'),
        ['queryField', 'controlFieldHeight', 'currentDirectoryInput'], { ...dependencies, ReaderSearchField: Field },
        { ...properties.hooks, childSources: { ReaderSearchField: source }, mountChildren: true, lifecycleChildren: true }).owner;
      let edits = 0;
      Object.assign(toolbar, { variant: caller.variant, readerWindowMetricsRevision: 1, directoryMounted: true,
        naturalFieldHeightVp: caller.field, naturalInputHeightVp: caller.input,
        placeholder: '搜索章节', text: '', directoryFocusId: '', directoryFocusAllowed: false,
        onTextChange() { edits += 1; }, onSearch() {} });
      toolbar.queryField('');
      const field = [...toolbar.children.values()][0];
      const nodes = [...field.nodes.values()];
      const input = nodes.find(node => node.type === 'TextInput');
      const paint = nodes.find(node => node.type === 'Row' && node.backgroundColor !== undefined && node.height === field.fieldHeight());
      const parent = [...toolbar.nodes.values()].find(node => node.type === 'Row');
      assert.ok(paint && input);
      assert.equal(paint.height, field.fieldHeight(), 'paint still follows the original field recipe');
      const expectedInput = caller.variant === 'manga-catalog' ? toolbar.controlFieldHeight() : caller.input;
      assert.equal(input.height, expectedInput, 'caller-specific native typography height stays explicit');
      assert.equal(input.responseRegion.height, Math.max(44, expectedInput));
      assert.equal(input.responseRegion.y, (expectedInput - Math.max(44, expectedInput)) / 2);
      const carrier = nodes.find(node => node.type === 'Stack' && node.height === Math.max(44, field.fieldHeight()));
      assert.ok(carrier, 'the normal shared build pays the complete native response');
      assert.ok(parent.height >= carrier.height, 'the immediate query parent pays the shared carrier');
      const toolbarBudget = budget.readerDirectoryToolbarBudget(width, true, toolbar.controlFieldHeight(), 60 * scale);
      assert.ok(toolbarBudget.height >= parent.height + 6, 'actual toolbar budget pays padding outside the response');
      input.onChange('章节'); assert.equal(edits, 1);
      toolbar.directoryMounted = false; input.onChange('旧章节'); assert.equal(edits, 1, 'retired actual caller refuses input');
      field.text = '后继'; properties.flush();
      assert.equal([...field.nodes.values()].find(node => node.type === 'TextInput').create.text, '后继');
    }
  }
  const Prefix = selectedProductionMethods(new URL('features/reading/ui/ReaderControlDirectoryContent.ets', root),
    'ReaderControlDirectoryContent', ['shortHeaderHeight'], { readerScaledControlHeight: surfaceFontResolvers().readerScaledControlHeight });
  const prefix = Object.assign(new Prefix(), { tab: 'bookmarks', directoryQueryHeight: () => 32,
    tabHeight: () => 36, shortToolsHeight: () => 44 });
  assert.equal(prefix.shortHeaderHeight(), 24 + 36 + 44 + 44, 'short List prefix pays the same actual query carrier');
  const brokenTarget = source.replace('const targetHeight = Math.max(44, this.height);', 'const targetHeight = this.height;');
  const Broken = pureModuleProbe(brokenTarget.slice(0, brokenTarget.indexOf('@Component')), 'BrokenSearchTarget.ets',
    { FrameCallback: class {} }, ['ReaderSearchInputTarget']).ReaderSearchInputTarget;
  let response;
  new Broken('readerDirectory', 30).applyNormalAttribute({ responseRegion(value) { response = value; return this; },
    minFontScale() { return this; }, maxFontScale() { return this; } });
  assert.throws(() => assert.ok(response.height >= 44), /AssertionError/, 'the old response fails the actual target requirement');
}

async function inlinePopupLayout() {
  for (const height of [852, 180, 0]) for (const scale of [1, 2]) for (const reduced of [false, true]) {
    const metrics = createDefaultReaderWindowMetrics();
    metrics.ready = true; metrics.windowRect.width = 366; metrics.windowRect.height = height;
    metrics.systemFontScale = scale; metrics.systemInsets.top = 24; metrics.systemInsets.bottom = 16;
    const animations = [];
    const uiContext = { px2vp: value => value, getFont: () => ({}), getMeasureUtils: () => ({ measureText: () => 26 * scale, measureTextSize: () => ({ width: 26 * scale, height: 24 * scale }) }),
      animateTo(params, action) { animations.push(params); action(); }, postFrameCallback() {} };
    const sdk = inlineSelectSdk({ uiContext, dependencies: { readerWindowMetrics: () => metrics } });
    const actor = new sdk.dependencies.ReaderInlineSelect(undefined,
      { value: '搜索', options: ['搜索', '发现'], reduceMotion: reduced });
    actor.aboutToAppear(); actor.initialRender(); actor.toggle(); sdk.properties.flush();
    actor.popupOptions(actor.selectionId).builder(); sdk.properties.flush();
    const panel = sdk.walk(actor).find(child => child instanceof sdk.dependencies.ReaderSelectPanel);
    assert.ok(panel);
    assert.equal(panel.hosting, 'popup', 'normal popup builder declares natural native hosting');
    assert.equal(panel.hostBottomVp, Math.max(0, height - 24 - 16 - 32));
    const body = [...panel.nodes.values()].find(node => node.onAppear);
    assert.ok(body); body.onAppear(); sdk.properties.flush();
    assert.ok([...panel.nodes.values()].every(node => node.position === undefined),
      'the native popup receives actual flow size instead of an absolute child inside zero-size wrappers');
    assert.equal(body.height, Math.min(panel.expandedHeight, panel.hostBottomVp));
    assert.ok(body.width > 0);
    if (height === 0) assert.equal(body.height, 0, 'zero window capacity preserves a zero menu viewport');
    else assert.ok(body.height >= 44 + 2, 'current popup pays a bordered choice row');
    if (reduced) assert.equal(animations.length, 0, 'reduced-motion panel uses its immediate branch');
    else assert.equal(animations.at(-1).duration, 160);
    const retainedIdentity = actor.selectionId;
    actor.toggle(); actor.dismiss(retainedIdentity); sdk.properties.flush();
    actor.aboutToDisappear();
    const oldIntent = actor.open; actor.commit('发现', retainedIdentity);
    assert.equal(actor.open, oldIntent, 'retired popup callback cannot revive the owner');
  }
  const metrics = createDefaultReaderWindowMetrics(); metrics.windowRect.width = 320; metrics.windowRect.height = 180;
  const sdk = inlineSelectSdk({ uiContext: { getFont: () => ({}), px2vp: value => value,
    getMeasureUtils: () => ({ measureText: () => 70 }), animateTo(_params, action) { action(); } },
    dependencies: { readerWindowMetrics: () => metrics } });
  const overlay = new sdk.dependencies.ReaderSelectPanel(undefined, { variant: 'sourceGroup',
    value: '全部分组', options: ['全部分组', '长分组'], x: 180, y: 250,
    hostTopVp: 0, hostBottomVp: 180, reduceMotion: true });
  overlay.aboutToAppear(); overlay.initialRender();
  [...overlay.nodes.values()].find(node => node.onAppear).onAppear(); sdk.properties.flush();
  const positioned = [...overlay.nodes.values()].find(node => node.position);
  assert.ok(positioned, 'existing full-height overlays keep their explicit positional owner');
  assert.ok(positioned.position.y >= 0 && positioned.position.y + positioned.height <= 180);
  assert.throws(() => assert.ok([...overlay.nodes.values()].every(node => node.position === undefined)),
    /AssertionError/, 'the previous overlay assembly is an invalid native popup flow root');
}
