import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks, stripTypeScriptTypes } from 'node:module';
import * as policy from '../entry/src/main/ets/features/reading/ReaderControlMorphScroll.ts';
import { readerControlUnit } from '../entry/src/main/ets/features/reading/ReaderControlActorGeometry.ts';
import { readerControlAppearanceEndpoint } from '../entry/src/main/ets/features/reading/ReaderControlAppearanceGeometry.ts';
import { readerControlPlaybackMeasuredSource, readerControlPlaybackSourceKind } from '../entry/src/main/ets/features/reading/ReaderControlPlaybackGeometry.ts';
import { productionMotionMethods } from './lib/reader-motion-method-probe.mjs';
registerHooks({ resolve(specifier, context, nextResolve) {
  try { return nextResolve(specifier, context); } catch (error) {
    if (specifier.startsWith('./') && !specifier.endsWith('.ts')) return nextResolve(`${specifier}.ts`, context);
    throw error;
  }
} });
const { readerControlReplaceEndpoint } = await import('../entry/src/main/ets/features/reading/ReaderControlReplaceGeometry.ts');

const root = new URL('../entry/src/main/ets/features/reading/', import.meta.url);
function method(source, name) {
  const start = source.indexOf(`  private ${name}(`);
  assert.ok(start >= 0, name);
  const open = source.indexOf('{', start);
  let end = open + 1, depth = 1;
  while (depth) { const c = source[end++]; if (c === '{') depth++; if (c === '}') depth--; }
  return source.slice(start, end);
}
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-8, `${a} != ${b}`);
const deps = { ...policy, readerControlUnit, readerControlAppearanceEndpoint, readerControlReplaceEndpoint,
  ScrollSource: { SCROLLER: 6, FLING: 1 } };
for (const name of ['Tts', 'AutoPage', 'Settings', 'Appearance', 'Replace']) {
  const source = readFileSync(new URL(`ReaderControl${name}Content.ets`, root), 'utf8');
  const members = ['syncMorphScroll', 'onFullDidScroll', 'nativeScrollDelta',
    'sharedScrollTranslation', 'fullOnlyScrollTranslation', 'fullInput'];
  if (source.includes('  private p(')) members.push('p');
  const Component = new Function(...Object.keys(deps), stripTypeScriptTypes(
    `class Probe { ${members.map(n => method(source, n)).join('\n')} }; Probe;`) + 'return Probe;')(...Object.values(deps));
  for (const start of [0, 180, 523, 3300]) {
    const owner = new Component(), calls = [];
    let native = start;
    Object.assign(owner, { motionProgress: 1, interactionEnabled: true, sourceOnly: 'none', reportMorphActor: () => {},
      extendedThemes: () => false,
      scrollMotion: policy.createReaderControlMorphScroll(),
      scroller: { currentOffset: () => ({ yOffset: native }), scrollTo: command => calls.push(command) } });
    owner.syncMorphScroll(); owner.onFullDidScroll();
    native += 7; owner.interactionEnabled = false; owner.syncMorphScroll();
    const anchor = start + 7;
    assert.equal(owner.scrollMotion.fullScrollOffset, anchor, `${name}: handoff reads latest native frame`);
    assert.deepEqual(calls, [{ xOffset: 0, yOffset: anchor, animation: false }]);
    for (const p of [1, .8, .3, 0, .2, .65, 1, .4, 0]) {
      owner.motionProgress = p; owner.syncMorphScroll();
      // A late native clamp alters N, never the frozen semantic S.
      native = p === .3 ? 9 : anchor;
      owner.onFullDidScroll();
      near(owner.sharedScrollTranslation() - native, -anchor * p);
      near(owner.fullOnlyScrollTranslation() - native, -anchor);
      assert.equal(owner.scrollMotion.fullScrollOffset, anchor);
      assert.ok(policy.readerControlMorphScrollExtent(owner.scrollMotion) >= native);
      assert.equal(calls.length, 1, `${name}: no native commands per animation frame`);
      assert.equal(owner.nativeScrollDelta(9, 1).yOffset, 0);
    }
    owner.interactionEnabled = true; owner.syncMorphScroll();
    assert.equal(owner.scrollMotion.fullScrollOffset, 0, `${name}: only committed Quick discards scroll`);
    assert.equal(calls.at(-1).yOffset, 0);
    assert.equal(owner.nativeScrollDelta(-native, 6).yOffset, -native);
    owner.interactionEnabled = false;
    for (const p of [.1, .6, 1]) {
      owner.motionProgress = p; owner.syncMorphScroll();
      near(owner.sharedScrollTranslation() - native, 0);
      near(owner.fullOnlyScrollTranslation() - native, 0);
    }
    native = 0; owner.onFullDidScroll();
    assert.equal(owner.scrollMotion.resettingFullScroll, false);
    owner.interactionEnabled = true; owner.syncMorphScroll();
    native = 88; owner.onFullDidScroll();
    assert.equal(owner.scrollMotion.fullScrollOffset, 88, `${name}: fresh Full scrolling works`);
  }
  // The SDK explicitly permits an unbound controller to return undefined.
  // Early/late Watch callbacks must neither crash nor erase a retained anchor.
  for (const nativeOffset of [undefined, { yOffset: NaN }]) {
    const owner = new Component(), calls = [];
    const held = { fullScrollOffset: 180, nativeScrollOffset: 180,
      fullScrollActive: true, resettingFullScroll: false };
    Object.assign(owner, { motionProgress: .5, interactionEnabled: false, sourceOnly: 'none',
      reportMorphActor: () => {}, extendedThemes: () => false, scrollMotion: held,
      scroller: { currentOffset: () => nativeOffset, scrollTo: command => calls.push(command) } });
    owner.syncMorphScroll(); owner.onFullDidScroll();
    assert.equal(owner.scrollMotion, held, `${name}: unbound controller retains the last valid state`);
    assert.equal(calls.length, 0, `${name}: no unbound scroll command`);
  }
  assert.match(source, /@State private scrollMotion: ReaderControlMorphScrollState/);
  assert.match(source, /@Watch\('onMotionChanged'\) motionProgress/);
  assert.match(source, /@Watch\('(?:onMotionChanged|onInputChanged)'\) interactionEnabled/);
  assert.match(source, /\.onWillScroll\(/); assert.match(source, /\.onDidScroll\(/);
  assert.match(source, /readerControlMorphScrollExtent\(this.scrollMotion\)/);
  assert.doesNotMatch(source, /this\.(?:fullScrollOffset|scrollOffset)\s*\*\s*\(1 -/);
}
const appearance = readFileSync(new URL('ReaderControlAppearanceContent.ets', root), 'utf8');
assert.match(appearance, /actorPosition\(this\.frame\(\)\.themeSwatches\[index\], true\)/);
assert.match(appearance, /actorPosition\(this\.fontActor\(font\), font !== 'import'\)/);
assert.match(appearance, /actorPosition\(this\.frame\(\)\.layout\)/);
for (const start of [0, 1]) {
  const path = policy.readerControlMorphScrollPath(start, 18);
  for (const p of [0, .3, .8, 1, .8, .3, 0]) {
    near(policy.sampleReaderControlMorphScrollPath(path, p), 18 * (start === 1 ? p : 1 - p));
  }
}
for (const name of ['Tts', 'AutoPage']) {
  const Component = productionMotionMethods(new URL(`ReaderControl${name}Content.ets`, root),
    ['measureActor', 'reportMorphActor'], { readerControlPlaybackMeasuredSource, readerControlPlaybackSourceKind });
  for (const unboundOffset of [undefined, { yOffset: NaN }]) {
    const owner = new Component(), reports = [];
    let nativeOffset = unboundOffset;
    const previous = { left: 3, top: 10, width: 99, height: 44 };
    Object.assign(owner, { sourceOnly: 'none', sourceDetached: false, form: 'full',
      fullMeasurement: previous, fullMeasurementScrollOffset: 13,
      scroller: { currentOffset: () => nativeOffset },
      onMorphActorMeasured: (...args) => reports.push(args) });
    const nextArea = { globalPosition: { x: 4, y: 20 }, width: 100, height: 40 };
    owner.measureActor(true, nextArea);
    owner.reportMorphActor();
    assert.equal(owner.fullMeasurement, previous, `${name}: unknown offset cannot replace a full measurement`);
    assert.equal(owner.fullMeasurementScrollOffset, 13, `${name}: retain the measured full anchor`);
    assert.equal(reports.length, 0, `${name}: do not publish an invented full position`);
    owner.form = 'quick';
    owner.measureActor(false, nextArea);
    assert.deepEqual(reports.at(-1), [readerControlPlaybackSourceKind(name === 'Tts' ? 'tts' : 'autoPage', 'quick'),
      4, 20, 100, 40], `${name}: the independent measured quick actor stays reportable`);
    owner.form = 'full'; nativeOffset = { yOffset: 28 };
    owner.reportMorphActor();
    assert.deepEqual(reports.at(-1).slice(1), [3, -5, 99, 44], `${name}: bound offset adjusts the retained full anchor`);
    owner.measureActor(true, nextArea);
    assert.equal(owner.fullMeasurementScrollOffset, 28);
    assert.deepEqual(reports.at(-1).slice(1), [4, 20, 100, 40], `${name}: a valid fresh full measurement publishes normally`);
  }
}
console.log('PASS PH110 playback anchors: TTS/AutoPage reject unbound or non-finite full measurements, retain quick measurements, resume accurate full reporting after binding');

const Replace = productionMotionMethods(new URL('ReaderControlReplaceContent.ets', root),
  ['onSourceChanged', 'onFullDidScroll', 'fullInput'], { ...policy, readerControlReplaceEndpoint });
for (const unboundOffset of [undefined, { yOffset: NaN }]) {
  const owner = new Replace(), commands = [];
  let nativeOffset = unboundOffset, dismissals = 0;
  const previous = { fullScrollOffset: 67, nativeScrollOffset: 67,
    fullScrollActive: true, resettingFullScroll: false };
  Object.assign(owner, { lastSessionKey: 'previous-book', state: { sessionKey: 'next-book' },
    localError: 'retained until source reset', scrollMotion: previous, motionProgress: 1, interactionEnabled: true,
    dismissTemporaryLayer: () => { dismissals++; },
    scroller: { currentOffset: () => nativeOffset,
      scrollTo: command => { commands.push(command); nativeOffset = { yOffset: command.yOffset }; } } });
  owner.onSourceChanged();
  assert.equal(owner.lastSessionKey, 'previous-book', 'unbound source reset remains pending');
  assert.equal(owner.scrollMotion, previous, 'pending source reset preserves the retained position');
  assert.equal(owner.localError, 'retained until source reset');
  assert.equal(commands.length, 0); assert.equal(dismissals, 0);
  nativeOffset = { yOffset: 67 };
  owner.onSourceChanged();
  assert.equal(owner.lastSessionKey, 'next-book');
  assert.equal(owner.localError, ''); assert.equal(dismissals, 1);
  assert.deepEqual(commands, [{ xOffset: 0, yOffset: 0, animation: false }]);
  assert.equal(owner.scrollMotion.nativeScrollOffset, 0, 'confirmed native reset reaches the new source top');
  owner.onSourceChanged();
  assert.equal(commands.length, 1, 'repeated binding/source callbacks do not reset twice');
}
console.log('PASS PH110 replacement source: unbound reset remains pending, binding replays it once and admits the confirmed native position');

const TtsAnchor = productionMotionMethods(new URL('ReaderControlTtsContent.ets', root), ['configurationAnchorY']);
for (const unboundOffset of [undefined, { yOffset: NaN }]) {
  const owner = new TtsAnchor();
  let nativeOffset = unboundOffset;
  const previous = { nativeScrollOffset: 67 };
  Object.assign(owner, { configField: 'voice', scrollMotion: previous,
    scroller: { currentOffset: () => nativeOffset }, frame: () => ({ detail: { y: 100 } }) });
  assert.equal(owner.configurationAnchorY(), 111, 'detached configuration uses the saved 67vp anchor');
  assert.equal(owner.scrollMotion, previous, 'display fallback does not replace the scroll state');
  nativeOffset = { yOffset: 91 };
  assert.equal(owner.configurationAnchorY(), 87, 'available native configuration position takes precedence');
  assert.equal(owner.scrollMotion.nativeScrollOffset, 67, 'display calculation does not mutate stored scroll');
}
console.log('PASS PH110 TTS configuration: missing native offset retains the saved display anchor without a synthetic zero or state write');
console.log('PASS shared scroll lifecycle: 5 actual component adapters, latest-offset handoff, held endpoint reversals, delayed native reset, shared/full-only roles, new expansion top; NOT visual acceptance');
