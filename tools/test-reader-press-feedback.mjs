import assert from 'node:assert/strict';
import { productionReaderPressFeedback } from './lib/reader-press-feedback-probe.mjs';
import { readerAppColor } from '../entry/src/main/ets/features/common/ReaderThemeRegistry.ts';

for (const scheme of ['day', 'night']) {
  const bases = [], overlays = [];
  const Modifier = productionReaderPressFeedback({ ColorMetrics: {
    resourceColor(value) {
      if (value === readerAppColor('TOK_ACCENT', scheme)) return { red: 244, green: 139, blue: 19 };
      return { blendColor(overlay) { bases.push(value); return { color: `native-blend:${value}:${overlay.alpha}` }; } };
    },
    rgba(red, green, blue, alpha) { overlays.push({ red, green, blue, alpha }); return { alpha }; },
  } });
  for (const surface of ['#00000000', readerAppColor('TOK_PRIMARY_SOFT', scheme), readerAppColor('TOK_PRIMARY_DARK', scheme)]) {
    const attributes = { backgroundColor(value) { this.fill = value; return this; }, borderRadius(value) { this.radius = value; return this; } };
    const modifier = new Modifier(surface, scheme, 17, 12);
    modifier.applyNormalAttribute(attributes); assert.equal(attributes.fill, surface);
    modifier.applyPressedAttribute(attributes); modifier.applyPressedAttribute(attributes);
    assert.deepEqual(bases.slice(-2), [surface, surface], 'pressed re-evaluation must not accumulate tint over a selected surface');
    assert.equal(attributes.radius, 12);
    assert.equal(overlays.at(-1).alpha, 0.12);
    modifier.applyNormalAttribute(attributes);
    assert.equal(attributes.fill, surface); assert.equal(attributes.radius, 17);
    modifier.applyPressedAttribute(attributes); modifier.applyDisabledAttribute(attributes);
    assert.equal(attributes.fill, surface, 'disabling a pressed control restores its current business state');
  }
}
{
  const Modifier = productionReaderPressFeedback({ ColorMetrics: {
    resourceColor() { throw new Error('native color resource unavailable'); },
  } });
  const attributes = { backgroundColor(value) { this.fill = value; return this; }, borderRadius(value) { this.radius = value; return this; } };
  assert.doesNotThrow(() => new Modifier('current-surface', 'day', 17, 12).applyPressedAttribute(attributes));
  assert.deepEqual([attributes.fill, attributes.radius], ['current-surface', 17]);
  assert.doesNotThrow(() => new Modifier('inert-surface', 'day', 0, 14, false).applyPressedAttribute(attributes));
  assert.deepEqual([attributes.fill, attributes.radius], ['inert-surface', 0]);
}
console.log('reader press feedback: native tint delegation and normal/disabled restoration PASS');
