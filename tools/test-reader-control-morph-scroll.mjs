import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks, stripTypeScriptTypes } from 'node:module';
import * as policy from '../entry/src/main/ets/features/reading/ReaderControlMorphScroll.ts';
import { readerControlUnit } from '../entry/src/main/ets/features/reading/ReaderControlActorGeometry.ts';
import { readerControlAppearanceEndpoint } from '../entry/src/main/ets/features/reading/ReaderControlAppearanceGeometry.ts';
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
    Object.assign(owner, { motionProgress: 1, interactionEnabled: true,
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
console.log('PASS shared scroll lifecycle: 5 actual component adapters, latest-offset handoff, held endpoint reversals, delayed native reset, shared/full-only roles, new expansion top; NOT visual acceptance');
