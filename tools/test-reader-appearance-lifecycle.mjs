import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';

export const CONTRACT_CASES = {
  "retained-lifecycle": {
    "description": "Actual appearance lifecycle, unknown offsets, retained actors and current font actions; SDK lowering only",
    "resources": []
  }
};

async function case_retained_lifecycle() {
const { virtualFilePath } = await import('./lib/tool-environment.mjs');
const { default: assert } = await import('node:assert/strict');
const { readFileSync } = await import('node:fs');
const { installedEtsCompiler } = await import('./lib/ets-compiler-runtime.mjs');
const { createReaderBuilderProbe } = await import('./lib/reader-control-builder-probe.mjs');
const { createArkUIPropertyRuntimeProbe } = await import('./lib/arkui-property-runtime-probe.mjs');
const { pureModuleProbe } = await import('./lib/ets-pure-module-probe.mjs');
const appearance = await import('../entry/src/main/ets/features/reading/ReaderAppearanceState.ts');
const render = await import('../entry/src/main/ets/features/reading/ReaderAppearanceRenderStyle.ts');
const geometry = await import('../entry/src/main/ets/features/reading/ReaderControlAppearanceGeometry.ts');
const style = await import('../entry/src/main/ets/features/reading/ReaderControlAppearanceStyle.ts');
const presentation = await import('../entry/src/main/ets/features/reading/ReaderControlMotionPresentation.ts');
const scroll = await import('../entry/src/main/ets/features/reading/ReaderControlMorphScroll.ts');
const select = await import('../entry/src/main/ets/features/common/ReaderSelectAppearanceStyle.ts');
const { MotionPointTrack } = await import('../entry/src/main/ets/features/common/MotionPointTrack.ts');
// Full, unchanged production component: SDK constructors, fields, @Watch,
// lifecycle and every Builder. Only platform layout/Scroller/font services and
// child view rendering are instrumented. This does not simulate device pixels.
const { ts, options } = installedEtsCompiler();
const source = readFileSync(new URL('../entry/src/main/ets/features/reading/ReaderControlAppearanceContent.ets', import.meta.url), 'utf8');
// Keep the production feedback owner and accessibility modifier. The retained
// appearance lifecycle does not publish feedback; AppStorage is its finite
// platform storage seam, not a replacement for the message owner.
const feedbackStorage = new Map();
const { ReaderTransientFeedback } = pureModuleProbe(readFileSync(new URL('../entry/src/main/ets/features/common/ReaderTransientFeedback.ts', import.meta.url), 'utf8'),
  'ReaderTransientFeedback.ts', { AppStorage: {
    get: key => feedbackStorage.get(key),
    setOrCreate: (key, value) => feedbackStorage.set(key, value),
  } }, ['ReaderTransientFeedback']);
const accessibility = pureModuleProbe(readFileSync(new URL('../entry/src/main/ets/features/common/ReaderActionAccessibility.ets', import.meta.url), 'utf8'),
  'ReaderActionAccessibility.ets', { AccessibilityRoleType: { BUTTON: 'AccessibilityRoleType.BUTTON' } }, ['ReaderActionAccessibility', 'readerActionTouchRegion']);
const parsed = ts.createSourceFile(virtualFilePath('ReaderControlAppearanceContent.ets'), source,
  ts.ScriptTarget.Latest, true, ts.ScriptKind.ETS, options);
const component = parsed.statements.find(node => node.name?.getText(parsed) === 'ReaderControlAppearanceContent');
const members = component.members.map(node => node.name?.getText(parsed)).filter(Boolean);
assert.ok(component.members.filter(node => !node.name).every(node =>
  ts.isConstructorDeclaration(node) && node.getText(parsed) === ''),
  'only omit the ETS parser synthetic empty constructor; retain every production member');
const childSources = Object.fromEntries(['ReaderSelect', 'ReaderSelectPanel'].map(name => [name,
  readFileSync(new URL(`../entry/src/main/ets/features/common/${name}.ets`, import.meta.url), 'utf8'),
]));
class NativeChild {
  constructor(owner, params, _storage, id) { Object.assign(this, { owner, params, id }); }
}
const enums = new Proxy({}, { get: (_target, key) => key });
const gesture = new Proxy({}, { get: () => () => {} });
const observedScrollState = owner => JSON.stringify({
  scrollMotion: owner.scrollMotion,
  extendedScrollOffset: owner.extendedScrollOffset,
  extendedScrollPath: owner.extendedScrollPath,
  extendedScrollInMotion: owner.extendedScrollInMotion,
  extendedScrollEndpoint: owner.extendedScrollEndpoint,
});
const results = [];
// This lifecycle case deliberately covers both production scroll paths. The
// default catalog must fit Quick; inserting a custom face adds the next font
// row. The component's historical 190vp Prop default no longer fits today's
// 264vp default catalog and would put both fixtures on the extended path.
const baselineSnapshot = appearance.createDefaultReaderAppearanceSnapshot();
const fullContentHeight = 666;
const quickContentHeight = geometry.sampleReaderControlAppearance(0, 286, fullContentHeight,
  style.READER_CONTROL_APPEARANCE_THEMES.length,
  appearance.normalizeReaderAppearanceFontOrder(baselineSnapshot.fontOrder).length - 1).quickContentHeight;
for (const custom of [false, true]) for (const endpoint of [0, 1]) {
  const runtime = createArkUIPropertyRuntimeProbe();
  const native = { offset: undefined, reads: 0, writes: [], fontRegistrations: 0 };
  const actions = [];
  let snapshot = appearance.createDefaultReaderAppearanceSnapshot();
  if (custom) snapshot = appearance.setReaderAppearanceCustomFont(snapshot,
    new appearance.ReaderCustomFontDescriptor('测试字体', 'ReaderCustom_aaaaaaaaaaaaaaaa', '/fonts/a.ttf', 'a'.repeat(64)));
  const { owner } = createReaderBuilderProbe(source, members, {
    ...appearance, ...render, ...geometry, ...style, ...presentation, ...scroll, ...select,
    ...runtime.sdk, ...accessibility, ReaderTransientFeedback, MotionPointTrack,
    Scroller: class {
      currentOffset() { native.reads++; return native.offset; }
      scrollTo(value) { native.writes.push(value); native.offset = { xOffset: value.xOffset, yOffset: value.yOffset }; }
    },
    uiContext: { getFont: () => ({}), vp2px: value => value, postFrameCallback() {} },
    registerReaderFonts() { native.fontRegistrations++; },
    curves: { cubicBezierCurve: () => ({ interpolate: value => value }) },
    readerMotionNowMs: () => 0, motionSpecGet: () => ({ durationMs: 100 }),
    ReaderFontMotionFrameCallback: class {},
    PathShape: class { commands(value) { this.value = value; return this; } },
    ReaderSelect: NativeChild, ReaderSelectPanel: NativeChild,
    BorderStyle: enums, GesturePriority: enums, TouchType: enums, ScrollSource: enums,
    Gesture: gesture, LongPressGesture: gesture, globalThis: { Gesture: gesture, LongPressGesture: gesture },
  }, { ...runtime.hooks, childSources, initialParams: {
    snapshot, motionProgress: endpoint, quickContentHeight, fullContentHeight,
    availableHeight: endpoint === 0 ? quickContentHeight : fullContentHeight,
    onFontChange: font => actions.push(font), onCustomFontImport: () => actions.push('import'),
  } });

  assert.equal(native.reads, 0, 'component construction must not access the unbound Scroller');
  assert.equal(owner.extendedThemes(), custom,
    `fixture scroll path custom=${custom} endpoint=${endpoint}: default catalog fits Quick, custom insertion extends it`);
  owner.aboutToAppear();
  assert.equal(native.fontRegistrations, 1);
  assert.equal(native.reads, 0, 'aboutToAppear precedes native Scroll binding');
  assert.deepEqual(owner.fontIds(), appearance.normalizeReaderAppearanceFontOrder(snapshot.fontOrder), 'font actors follow the current allowed snapshot, including custom insertion');

  const unknownOffsetChecks = (label, didScroll = () => owner.onFullDidScroll()) => {
    const before = observedScrollState(owner), writeCount = native.writes.length;
    for (const unknown of [undefined, { xOffset: 0, yOffset: NaN }, { xOffset: 0, yOffset: Infinity }]) {
      native.offset = unknown;
      // Exercise real SDK property delivery, including both @Watch callbacks.
      owner.motionProgress = owner.motionProgress === 0.4 ? 0.6 : 0.4;
      owner.interactionEnabled = !owner.interactionEnabled;
      didScroll();
      assert.equal(observedScrollState(owner), before, `${label}: an unknown native offset is not a zero measurement`);
      assert.equal(native.writes.length, writeCount, `${label}: an unbound controller must not receive scrollTo`);
    }
    native.offset = undefined;
    owner.motionProgress = endpoint;
    owner.interactionEnabled = true;
    assert.equal(observedScrollState(owner), before, `${label}: settling props cannot invent a native offset`);
  };
  unknownOffsetChecks('before initialRender');
  owner.initialRender();
  const scrollNode = [...owner.nodes.values()].find(node => node.type === 'Scroll');
  assert.ok(scrollNode, 'complete SDK-generated appearance tree contains its native Scroll');
  assert.equal(typeof scrollNode.onAppear, 'function', 'native Scroll binding owns initial synchronization');
  const initialNodes = owner.nodes.size;
  assert.ok([...owner.nodes.values()].some(node => node.accessibilityText === '导入自定义字体'), 'required import action is mounted without a historical node budget');
  assert.equal([...owner.nodes.values()].filter(node => node.accessibilityText === '切换到测试字体').length, custom ? 1 : 0);
  unknownOffsetChecks('after initialRender', scrollNode.onDidScroll);
  const beforeBinding = observedScrollState(owner), writesBeforeBinding = native.writes.length;
  scrollNode.onAppear();
  assert.equal(observedScrollState(owner), beforeBinding, 'an early native callback still waits for an offset');
  assert.equal(native.writes.length, writesBeforeBinding);

  native.offset = { xOffset: 0, yOffset: 96 };
  const readsBeforeBinding = native.reads;
  scrollNode.onAppear();
  assert.ok(native.reads > readsBeforeBinding, 'actual SDK-emitted Scroll.onAppear resumes synchronization');
  if (custom) {
    assert.equal(owner.extendedScrollOffset, 96, `extended native offset custom=${custom} endpoint=${endpoint}`);
    assert.equal(owner.extendedScrollEndpoint, endpoint, `extended endpoint custom=${custom} endpoint=${endpoint}`);
  } else {
    assert.equal(owner.scrollMotion.nativeScrollOffset, 96, `canonical native offset custom=${custom} endpoint=${endpoint}`);
    assert.equal(owner.scrollMotion.fullScrollActive, endpoint === 1, `canonical endpoint custom=${custom} endpoint=${endpoint}`);
  }
  owner.replay();
  assert.equal(owner.nodes.size, initialNodes, 'binding changes attributes without replacing font actors');

  // Both font actions remain reachable after restoring a real native offset.
  owner.motionProgress = 1;
  owner.interactionEnabled = true;
  owner.replay();
  const selectLabel = custom ? '切换到测试字体' : '切换到系统';
  const selectFont = [...owner.nodes.values()].find(node => node.accessibilityText === selectLabel);
  const importFont = [...owner.nodes.values()].find(node => node.accessibilityText === '导入自定义字体');
  assert.ok(selectFont, selectLabel); assert.ok(importFont);
  selectFont.onClick(); importFont.onClick();
  assert.deepEqual(actions, [custom ? 'custom' : 'system', 'import']);

  owner.aboutToDisappear();
  unknownOffsetChecks('after native detach', scrollNode.onDidScroll);
  results.push({ custom, endpoint, scrollPath: custom ? 'extended' : 'canonical', quickContentHeight,
    status: 'PASS', mountedNodes: initialNodes });
}
console.log(JSON.stringify({ contract: 'PH110 full production appearance lifecycle', memberCount: members.length,
  boundary: 'actual SDK compiler and property runtime; native Scroller, font service and child rendering instrumented; no device pixels', results }, null, 2));

}

const implementations = {'retained-lifecycle':case_retained_lifecycle};
for (const id of selectContractCases(CONTRACT_CASES)) {
  await implementations[id]();
  recordContractCasePass(id);
}
