import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { productionMangaDirectoryPressFeedback } from './lib/manga-directory-press-feedback-probe.mjs';
import { createArkUIPropertyRuntimeProbe } from './lib/arkui-property-runtime-probe.mjs';
import { createReaderBuilderProbe } from './lib/reader-control-builder-probe.mjs';

const source = readFileSync(new URL('../entry/src/main/ets/features/manga/MangaDirectoryPressFeedback.ets', import.meta.url), 'utf8');
const prototype = readFileSync(new URL('../../Reader-UI/design/manga-directory/reference.css', import.meta.url), 'utf8');
assert.equal(createHash('sha256').update(prototype).digest('hex'), '6a37247662ce1bdb2805d5dc4b768b3676ebd0ab77a06b16b55647d859c174c7',
  'paired UI reference preserves the original approved prototype CSS bytes');
assert.match(prototype, /button:not\(:disabled\):active \{ opacity:\.73/);
assert.match(prototype, /button:disabled \{ opacity:\.36/);
assert.match(prototype, /:focus-visible \{ outline:2px solid var\(--accent\); outline-offset:3px/);
const sdkApi = readFileSync('/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/ets/build-tools/ets-loader/declarations/common.d.ts', 'utf8');
for (const callback of ['applyNormalAttribute', 'applyPressedAttribute', 'applyDisabledAttribute']) {
  assert.match(sdkApi, new RegExp(`${callback}\\?\\(instance: T\\): void`), 'installed SDK owns this attribute-state callback');
}
assert.match(sdkApi, /focusBox\(style: FocusBoxStyle\): T/);
assert.match(sdkApi, /focusable\(value: boolean\): T/);
const focusApi = readFileSync('/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/ets/build-tools/ets-loader/declarations/focus.d.ts', 'utf8');
assert.match(focusApi, /strokeWidth\?: LengthMetrics/); assert.match(focusApi, /margin\?: LengthMetrics/);
assert.match(focusApi, /strokeColor\?: ColorMetrics/);
const expectedFocus = scheme => ({ strokeWidth: { value: 2, unit: 'vp' },
  strokeColor: { color: scheme === 'night' ? '#B9CEB1' : '#425D45' }, margin: { value: 3, unit: 'vp' } });

function check(candidate = source) {
  const Modifier = productionMangaDirectoryPressFeedback(candidate);
  for (const scheme of ['day', 'night']) for (const enabled of [true, false]) for (const applies of [true, false]) {
    const calls = [], focusBoxes = [], focusableCalls = [];
    const attributes = { value: .81, opacity(value) { calls.push(value); this.value = value; return this; },
      focusBox(value) { focusBoxes.push(value); return this; },
      focusable(value) { focusableCalls.push(value); return this; },
      backgroundColor() { throw new Error('demo opacity must not tint the selected surface'); },
      borderRadius() { throw new Error('press must not change geometry'); } };
    const modifier = new Modifier(enabled, applies, scheme);
    modifier.applyNormalAttribute(attributes);
    assert.equal(attributes.value, applies ? enabled ? 1 : .36 : .81);
    modifier.applyPressedAttribute(attributes);
    assert.equal(attributes.value, applies ? enabled ? .73 : .36 : .81);
    modifier.applyPressedAttribute(attributes);
    assert.equal(attributes.value, applies ? enabled ? .73 : .36 : .81, 'repeated native state dispatch never compounds alpha');
    modifier.applyNormalAttribute(attributes);
    assert.equal(attributes.value, applies ? enabled ? 1 : .36 : .81, 'release/cancel restores the current business state');
    modifier.applyDisabledAttribute(attributes);
    assert.equal(attributes.value, applies ? .36 : .81);
    if (!applies) {
      assert.deepEqual(calls, [], 'shared standard variants retain every existing paint attribute');
      assert.deepEqual(focusBoxes, [], 'standard presentation retains its own keyboard focus box');
      assert.deepEqual(focusableCalls, [], 'standard presentation retains its own native focus admission');
    } else {
      assert.equal(focusBoxes.length, 5, 'every native state dispatch retains the same keyboard focus definition');
      for (const box of focusBoxes) assert.deepEqual(box, expectedFocus(scheme));
      assert.deepEqual(focusableCalls, [enabled, enabled, enabled, enabled, false],
        'native enabled actors admit focus and native disabled state always excludes it');
    }
  }

  const properties = createArkUIPropertyRuntimeProbe();
  // This fixture exercises the installed SDK's native-node modifier call.
  // The next callback is delivered through the explicit platform state seam.
  const nativeConsumer = `@Component struct MangaPressProbe {
    @Prop actionEnabled: boolean = true;
    @Prop mangaApplies: boolean = true;
    @Prop scheme: string = 'day';
    build() {
      Button('阅读章节').backgroundColor('selected-surface').opacity(0.81).focusable(false)
        .attributeModifier(new MangaDirectoryPressFeedback(this.actionEnabled, this.mangaApplies, this.scheme))
        .enabled(this.actionEnabled);
    }
  }`;
  const { owner } = createReaderBuilderProbe(nativeConsumer, ['build', 'actionEnabled', 'mangaApplies', 'scheme'],
    { ...properties.sdk, MangaDirectoryPressFeedback: Modifier }, properties.hooks);
  owner.initialRender();
  const node = [...owner.nodes.values()].find(value => value.type === 'Button');
  assert.equal(node.backgroundColor, 'selected-surface'); assert.equal(node.opacity, 1);
  assert.equal(node.focusable, true, 'the actual native actor admits platform keyboard focus');
  assert.deepEqual(node.focusBox, expectedFocus('day'), 'actual SDK modifier applies the platform focusBox object');
  const boundModifier = () => owner.attributeCalls.filter(call => call.id === node.id && call.property === 'attributeModifier').at(-1)?.args[0];
  assert.ok(boundModifier() instanceof Modifier, 'the actual SDK native actor consumes the production modifier');
  const platformAttributes = { opacity(value) { node.opacity = value; return this; },
    focusBox(value) { node.focusBox = value; return this; },
    focusable(value) { node.focusable = value; return this; },
    backgroundColor() { assert.fail('the selected surface belongs to the consumer'); } };
  boundModifier().applyPressedAttribute(platformAttributes); assert.equal(node.opacity, .73);
  boundModifier().applyNormalAttribute(platformAttributes); assert.equal(node.opacity, 1);
  const actor = node;
  owner.scheme = 'night'; properties.flush();
  assert.equal([...owner.nodes.values()].find(value => value.type === 'Button'), actor);
  assert.deepEqual(node.focusBox, expectedFocus('night'), 'retained native actor receives the current theme focus accent');
  owner.actionEnabled = false; properties.flush();
  assert.equal([...owner.nodes.values()].find(value => value.type === 'Button'), actor);
  assert.equal(node.enabled, false); assert.equal(node.opacity, .36);
  assert.equal(node.focusable, false);
  boundModifier().applyPressedAttribute(platformAttributes); assert.equal(node.opacity, .36);
  boundModifier().applyDisabledAttribute(platformAttributes); assert.equal(node.opacity, .36);
  assert.equal(node.focusable, false);
  const previousFocus = node.focusBox;
  owner.mangaApplies = false; properties.flush();
  assert.equal(node.opacity, .81, 'standard presentation does not receive manga alpha during normal SDK rebinding');
  boundModifier().applyPressedAttribute(platformAttributes); assert.equal(node.opacity, .81);
  boundModifier().applyDisabledAttribute(platformAttributes); assert.equal(node.opacity, .81);
  assert.equal(node.focusBox, previousFocus, 'standard no-op does not overwrite the caller focus box');
  assert.equal(node.focusable, false, 'standard no-op preserves the caller native focus admission');
  assert.equal(node.backgroundColor, 'selected-surface');
}
check();
for (const [label, candidate] of [
  ['missing press effect', source.replace('MANGA_DIRECTORY_VISUAL.pressOpacity', '1')],
  ['wrong disabled alpha', source.replaceAll('MANGA_DIRECTORY_VISUAL.disabledOpacity', '1')],
  ['standard variant is changed', source.replaceAll('if (!this.applies) return;', '')],
  ['legacy tint instead of opacity', source.replace('instance.opacity(this.enabled ? MANGA_DIRECTORY_VISUAL.pressOpacity : MANGA_DIRECTORY_VISUAL.disabledOpacity);', "instance.backgroundColor('pressed-tint');")],
  ['missing keyboard focus mapping', source.replaceAll('this.applyFocusBox(instance);', '')],
  ['wrong focus width', source.replace('MANGA_DIRECTORY_VISUAL.focusWidth', 'MANGA_DIRECTORY_VISUAL.focusMargin')],
  ['wrong focus margin', source.replace('MANGA_DIRECTORY_VISUAL.focusMargin', 'MANGA_DIRECTORY_VISUAL.focusWidth')],
  ['wrong keyboard focus color', source.replace("mangaDirectoryColor('accent', this.scheme)", "mangaDirectoryColor('muted', this.scheme)")],
  ['stale day focus accent', source.replace("mangaDirectoryColor('accent', this.scheme)", "mangaDirectoryColor('accent', 'day')")],
  ['enabled actor cannot receive focus', source.replace('instance.focusable(enabled);', 'instance.focusable(false);')],
  ['disabled actor keeps native focus', source.replace('this.applyFocusBox(instance, false);', 'this.applyFocusBox(instance);')],
]) {
  assert.notEqual(candidate, source); assert.throws(() => check(candidate), undefined, `reject ${label}`);
}
console.log('PASS production manga modifier plus actual SDK native Button binding: .73 pressed,1 normal,.36 disabled, enabled-only native focus, day/night 2vp accent focusBox with3vp margin, standard no-op, retained actor/business surface and no compounded alpha; eleven old-rule negative controls rejected. Native keyboard/state dispatch and focus/compositor pixels require target evidence.');
