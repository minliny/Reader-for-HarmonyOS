import { resolveEtsLoaderRoot } from './lib/tool-environment.mjs';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createReaderBuilderProbe } from './lib/reader-control-builder-probe.mjs';
import { createArkUIPropertyRuntimeProbe } from './lib/arkui-property-runtime-probe.mjs';
import { ReadingSurfaceLayoutMap } from '../entry/src/main/ets/features/reading/ReadingSurfaceLayoutMap.ts';

const read = name => readFileSync(new URL(`../entry/src/main/ets/features/reading/${name}.ets`, import.meta.url), 'utf8');
const wholeSurface = read('ReadingSurface');
const surfaceSource = wholeSurface.slice(wholeSurface.lastIndexOf('@Component', wholeSurface.indexOf('export struct ReadingSurface')));
const continuousSource = read('ReaderContinuousReadingStage');
const nativeSource = read('ReaderNativeParagraphView');
const sdk = resolveEtsLoaderRoot();
const require = createRequire(import.meta.url);
const ts = require(`${sdk}/node_modules/typescript`);
const syntax = require(`${sdk}/lib/validate_ui_syntax.js`);
const options = require(`${sdk}/lib/ets_checker.js`).compilerOptions;
for (const [name, source] of [['ReadingSurface', wholeSurface], ['ReaderNativeParagraphView', nativeSource],
  ['ReaderPageChrome', read('ReaderPageChrome')], ['ReaderReadingTextFragment', wholeSurface], ['ReaderPaperBackground', read('ReaderPaperBackground')]]) {
  syntax.componentCollection.customComponents.add(name);
  syntax.propCollection.set(name, new Set([...source.matchAll(/@Prop(?:\s+@\w+(?:\([^)]*\))?)*\s+(\w+)\s*:/g)].map(match => match[1])));
}
const layout = { widthClass: 'compact', contentTop: 72, contentRight: 32, contentBottom: 48, contentLeft: 32,
  titleLineHeightFp: 32, titleToBodySpacingVp: 18, viewportWidth: 364 };
const style = { widthVp: 300, fontFamily: 'f', fontSize: 24, fontWeight: 500, lineHeight: 32,
  letterSpacing: 0, color: '#222', alignment: 0, breakAll: true };
const title = key => ({ key, text: key, startScalar: 0, firstLine: 0, lastLine: 0, style });
const fragment = (id, nativeTitle) => ({ id, text: id, startScalar: 4096, endScalar: 4100,
  imageHeight: 0, isParagraphStart: true, nativeTitle });
class Child { constructor(owner, params, _storage, id) { Object.assign(this, { owner, params, id }); } }
const measurementSource = read('ReaderNativeTextMeasurement');
const geometryJs = ts.transpileModule(measurementSource.replace(/^import.*$/gm, '').replace(/^export /gm, ''),
  { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
const geometryKey = new Function(geometryJs + ';return readerNativeTextGeometryKey;')();
const nativeTree = ts.createSourceFile('NativeLifetime.ets', nativeSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.ETS, options);
const nativeMembers = nativeTree.statements.find(node => node.name?.text === 'ReaderNativeParagraphView').members
  .filter(node => node.name).map(node => node.name.getText(nativeTree));

function instrument(source, mode) {
  const runtime = createArkUIPropertyRuntimeProbe(), prepared = [], actors = [];
  class Controller {
    prepare(_context, recipe) { assert.ok(recipe, 'native preparation requires an actual measured recipe'); prepared.push(recipe.key); }
    heightVp() { return 32; } color() {} selection() {} close() {}
  }
  const node = name => new Proxy({ name }, { get(target, key) { return key === 'name' ? target.name : () => {}; } });
  const { Component: Native } = createReaderBuilderProbe(nativeSource, nativeMembers, {
    ...runtime.sdk, ReaderNativeParagraphController: Controller, ReadingSurfaceLayoutMap,
    readerNativeParagraphResource: () => undefined, readerNativeTextGeometryKey: geometryKey,
    NodeContainer: node('NodeContainer'), Canvas: node('Canvas'), uiContext: { vp2px: value => value, fp2px: value => value },
  }, runtime.hooks);
  class NativeChild extends Native {
    constructor(...args) { super(...args); this.params = { ...args[1] }; actors.push(this); this.aboutToAppear(); }
    updateStateVars(params) { super.updateStateVars(params); Object.assign(this.params, params); }
  }
  const dependencies = { ...runtime.sdk, ReaderNativeParagraphView: NativeChild, ReadingSurface: Child,
    ReaderPaperBackground: Child, ReaderPageChrome: Child, ReaderReadingTextFragment: Child,
    TYPE_READER_CHAPTER_TITLE: { fontFamily: 'f', fontWeight: 500, fontSizeFp: 24 },
    WordBreak: { BREAK_ALL: 'breakAll' }, GradientDirection: { Bottom: 'bottom' }, Canvas: node('Canvas'),
    BlendMode: { SRC_OVER: 'over', MULTIPLY: 'multiply' }, BlendApplyType: { FAST: 'fast' },
    ImageFit: { Contain: 'contain' }, ImageInterpolation: { High: 'high' }, CONTINUOUS_TITLE_ID: 'continuous-title',
    LazyForEach: { name: 'LazyForEach', create(_id, owner, _data, generator) {
      if (!owner.titleRowMounted) { owner.titleRowMounted = true; generator({ id: 'continuous-title' }, 0); }
    }, pop() {} }, ListItem: node('ListItem'), readerAppearanceThemeStyle: () => ({ ink: '#222' }),
    GestureMode: {}, GesturePriority: { Parallel: 'parallel' }, TapGesture: node('TapGesture') };
  let current = [fragment('first', title('chapter A'))];
  const params = mode === 'paged' ? { contentRevision: 1, pageFragments: [], showChapterTitle: true,
    chapterTitle: 'chapter A', fragmentsProvider: () => current } : { appearance: { activeTheme: 'paper', paragraphSpacing: 16 } };
  const names = mode === 'paged' ? ['chapterTitle', 'showChapterTitle', 'pageFragments', 'contentRevision', 'fragmentsProvider', 'build',
    'renderFragments', 'contentInsets', 'usesHighlightCanvas', 'dynamicHighlightBlend', 'onHighlightContentChanged'] : ['appearance', 'build'];
  const { owner, output } = createReaderBuilderProbe(source, names, dependencies,
    { ...runtime.hooks, initialParams: params, allowEmptyBranchAdmission: true });
  Object.assign(owner, { pageParagraphs: [], snapshotSynchronousImages: false, bottomJustifyGap: 0, staticSnapshotId: '',
    layout, appearance: { activeTheme: 'paper', paragraphSpacing: 16 }, themeStyle: () => ({ ink: '#222', sourcePaperLighting: false, paperTexture: false }),
    scheduleDynamicHighlights() {}, listMountIdentity: 'list-A', fragmentDataSource: {}, initialListIndex: () => 0,
    titleRecipeProvider: () => current[0]?.nativeTitle, initialListOffset: () => 0, hasTitleItem: () => true,
    fragmentRenderKey: value => value.id, initialParagraphKey: '', paragraphTop: () => 0 });
  // Only the native LazyForEach boundary is instrumented. Its row generator,
  // nested title ForEach/If and child observers are the SDK compiler output.
  function withGesture(action) {
    const previousGesture = globalThis.Gesture;
    globalThis.Gesture = node('Gesture');
    try { action(); }
    finally { if (previousGesture === undefined) delete globalThis.Gesture; else globalThis.Gesture = previousGesture; }
  }
  withGesture(() => owner.initialRender());
  assert.equal(actors.length, 1);
  const original = actors[0], titleObserver = [...owner.children.entries()].find(([, child]) => child === original)[0];
  return { owner, runtime, prepared, actors, output, original, replay: () => withGesture(() => owner.replay()),
    publish(value) { current = value; },
    updateTitleBeforeRemoval() {
      // The VM crash names this outgoing child's update closure. Run that
      // exact closure while it is pending native removal; no parent remount or
      // replacement recipe is supplied by the fixture. SDK reset -> @Watch ->
      // production prepare executes synchronously, as in the captured stack.
      owner.replayOnly([titleObserver]);
    },
  };
}

const modes = process.argv.includes('--continuous-only') ? ['continuous'] : ['paged', 'continuous'];
for (const mode of modes) {
  const probe = instrument(mode === 'paged' ? surfaceSource : continuousSource, mode);
  assert.equal(probe.original.recipe.key, 'chapter A');
  probe.publish([fragment('middle')]);
  assert.doesNotThrow(() => probe.updateTitleBeforeRemoval(), `${mode}: pending outgoing title keeps its own valid recipe`);
  assert.equal(probe.original.recipe.key, 'chapter A', 'an outgoing actor is not assigned the incoming body as a title');
  assert.equal(probe.actors.length, 1, 'the pending update does not create a substitute native actor');
  probe.publish([]);
  assert.doesNotThrow(() => probe.updateTitleBeforeRemoval(), `${mode}: an empty owner cannot invalidate the outgoing recipe`);
  probe.original.aboutToDisappear();
  assert.equal(probe.original.mounted, false);
  const next = title('chapter B');
  probe.publish([fragment('next', next)]);
  // Run the real parent observers now. ForEach emits the incoming recipe/key;
  // historical child records represent pending native disposal, not pixels.
  probe.replay();
  const incoming = probe.actors.at(-1);
  assert.equal(incoming.recipe.key, next.key);
  assert.notEqual(incoming, probe.original, 'a changed measured title key owns a new native actor');
  assert.equal(probe.prepared.at(-1), next.key);
  assert.ok(probe.output.includes('forEachUpdateFunction'));
  const before = mode === 'paged' ? surfaceSource : continuousSource;
  const oldSource = mode === 'paged' ? before.replace(
    /            \/\/ An outgoing title[\s\S]*?            \}, \(fragment: ReadingSurfacePageFragment\): string => fragment\.nativeTitle!\.key\);/,
    '            ReaderNativeParagraphView({ recipe: this.renderFragments()[0].nativeTitle!, inkColor: this.themeStyle().ink, selectionEnabled: false });') : before.replace(
    /                \/\/ A retained outgoing row[\s\S]*?                \}, \(recipe: ReaderNativeParagraphRecipe\): string => recipe\.key\);/,
    `                if (this.titleRecipeProvider() !== undefined) {
                  ReaderNativeParagraphView({ recipe: this.titleRecipeProvider()!,
                    inkColor: readerAppearanceThemeStyle(this.appearance.activeTheme).ink })
                    .margin({ bottom: this.layout.titleToBodySpacingVp });
                }`);
  assert.notEqual(oldSource, before, 'negative control restores only the prior title actor call site');
  const old = instrument(oldSource, mode);
  old.publish([fragment('middle')]);
  assert.throws(() => old.updateTitleBeforeRemoval(), /Cannot read properties of undefined \(reading 'key'\)/,
    `${mode}: restoring the old actor ownership reproduces the VM native Watch/prepare crash`);
  assert.equal(old.actors.length, 1, 'old-code failure occurs in the retained actor');
  old.original.aboutToDisappear();
  console.log(`PASS ${mode}: real SDK retained title observer -> Prop reset -> production Watch/prepare; title to middle/empty to next title`);
}
console.log('Native removal, layout and compositor pixels are instrumented boundaries, not VM evidence.');
