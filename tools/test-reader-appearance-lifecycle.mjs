import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';

export const CONTRACT_CASES = {
  "retained-lifecycle": {
    "description": "Actual appearance lifecycle, unknown offsets, retained actors and current font actions; SDK lowering only",
    "resources": []
  }
};

async function case_retained_lifecycle() {
const { resolveEtsLoaderRoot, virtualFilePath } = await import('./lib/tool-environment.mjs');
const { default: assert } = await import('node:assert/strict');
const { readFileSync } = await import('node:fs');
const { createRequire } = await import('node:module');
const { createReaderBuilderProbe } = await import('./lib/reader-control-builder-probe.mjs');
const { createArkUIPropertyRuntimeProbe } = await import('./lib/arkui-property-runtime-probe.mjs');
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
const sdkRoot = resolveEtsLoaderRoot();
const require = createRequire(import.meta.url);
const ts = require(`${sdkRoot}/node_modules/typescript`);
const syntax = require(`${sdkRoot}/lib/validate_ui_syntax.js`);
const options = require(`${sdkRoot}/lib/ets_checker.js`).compilerOptions;
const source = readFileSync(new URL('../entry/src/main/ets/features/reading/ReaderControlAppearanceContent.ets', import.meta.url), 'utf8');
const parsed = ts.createSourceFile(virtualFilePath('ReaderControlAppearanceContent.ets'), source,
  ts.ScriptTarget.Latest, true, ts.ScriptKind.ETS, options);
const component = parsed.statements.find(node => node.name?.getText(parsed) === 'ReaderControlAppearanceContent');
const members = component.members.map(node => node.name?.getText(parsed)).filter(Boolean);
assert.ok(component.members.filter(node => !node.name).every(node =>
  ts.isConstructorDeclaration(node) && node.getText(parsed) === ''),
  'only omit the ETS parser synthetic empty constructor; retain every production member');
for (const name of ['ReaderSelect', 'ReaderSelectPanel']) {
  const child = readFileSync(new URL(`../entry/src/main/ets/features/common/${name}.ets`, import.meta.url), 'utf8');
  syntax.componentCollection.customComponents.add(name);
  syntax.propCollection.set(name, new Set([...child.matchAll(/@Prop\s+(\w+)\s*:/g)].map(match => match[1])));
}
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
for (const custom of [false, true]) for (const endpoint of [0, 1]) {
  const runtime = createArkUIPropertyRuntimeProbe();
  const native = { offset: undefined, reads: 0, writes: [], fontRegistrations: 0 };
  const actions = [];
  let snapshot = appearance.createDefaultReaderAppearanceSnapshot();
  if (custom) snapshot = appearance.setReaderAppearanceCustomFont(snapshot,
    new appearance.ReaderCustomFontDescriptor('测试字体', 'ReaderCustom_aaaaaaaaaaaaaaaa', '/fonts/a.ttf', 'a'.repeat(64)));
  const { owner } = createReaderBuilderProbe(source, members, {
    ...appearance, ...render, ...geometry, ...style, ...presentation, ...scroll, ...select,
    ...runtime.sdk, MotionPointTrack,
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
  }, { ...runtime.hooks, initialParams: {
    snapshot, motionProgress: endpoint,
    onFontChange: font => actions.push(font), onCustomFontImport: () => actions.push('import'),
  } });

  assert.equal(native.reads, 0, 'component construction must not access the unbound Scroller');
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
    assert.equal(owner.extendedScrollOffset, 96);
    assert.equal(owner.extendedScrollEndpoint, endpoint);
  } else {
    assert.equal(owner.scrollMotion.nativeScrollOffset, 96);
    assert.equal(owner.scrollMotion.fullScrollActive, endpoint === 1);
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
  results.push({ custom, endpoint, status: 'PASS', mountedNodes: initialNodes });
}
console.log(JSON.stringify({ contract: 'PH110 full production appearance lifecycle', memberCount: members.length,
  boundary: 'actual SDK compiler and property runtime; native Scroller, font service and child rendering instrumented; no device pixels', results }, null, 2));

}

const implementations = {'retained-lifecycle':case_retained_lifecycle};
for (const id of selectContractCases(CONTRACT_CASES)) {
  await implementations[id]();
  recordContractCasePass(id);
}
