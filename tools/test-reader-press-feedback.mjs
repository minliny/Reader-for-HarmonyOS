import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';

export const CONTRACT_CASES = {
  "native-composition": {
    "description": "Normal/pressed/disabled runtime composition and nonaccumulation; no fixed alpha design claim",
    "resources": []
  },
  "platform-failure-fallback": {
    "description": "Each platform color stage fails independently; retain color-only fallback negative control",
    "resources": []
  }
};

async function case_native_composition() {
const { default: assert } = await import('node:assert/strict');
const { readFileSync } = await import('node:fs');
const { productionReaderPressFeedback } = await import('./lib/reader-press-feedback-probe.mjs');
const { readerAppColor } = await import('../entry/src/main/ets/features/common/ReaderThemeRegistry.ts');
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
    assert.ok(Number.isFinite(overlays.at(-1).alpha) && overlays.at(-1).alpha >= 0 && overlays.at(-1).alpha <= 1, 'platform receives a valid alpha; a specific design percentage needs independent provenance');
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

}

async function case_platform_failure_fallback() {
const { default: assert } = await import('node:assert/strict');
const { readFileSync } = await import('node:fs');
const { productionReaderPressFeedback } = await import('./lib/reader-press-feedback-probe.mjs');
const { readerAppColor } = await import('../entry/src/main/ets/features/common/ReaderThemeRegistry.ts');
// Every official composition stage can fail independently. Preserve the
// complete original normal recipe, while the gradient-oriented public helper
// still returns the original unblended surface without leaking an exception.
const actualSource=readFileSync(new URL('../entry/src/main/ets/features/common/ReaderPressFeedback.ets',import.meta.url),'utf8');
function failedCompositionFallback(source=actualSource) {
  for(const stage of ['accent','rgba','base','blend']) {
    let requests=0;
    const Modifier=productionReaderPressFeedback({source,ColorMetrics:{
      resourceColor(){requests++;if((stage==='accent'&&requests===1)||(stage==='base'&&requests===2))throw Error('platform '+stage);
        return {red:244,green:139,blue:19,blendColor(){if(stage==='blend')throw Error('platform blend');return{color:'pressed'};}};},
      rgba(){if(stage==='rgba')throw Error('platform rgba');return{alpha:.12};},
    }});
    const attributes={backgroundColor(value){this.fill=value;return this;},borderRadius(value){this.radius=value;return this;}};
    const modifier=new Modifier('current-surface','day',17,12);
    modifier.applyPressedAttribute(attributes);
    assert.deepEqual([attributes.fill,attributes.radius],['current-surface',17],stage+': complete normal fallback');
    requests=0;assert.equal(modifier.pressedSurface(),'current-surface',stage+': finite gradient helper retains its fallback');
    requests=0;new Modifier('disabled-surface','day',17,12,false).applyPressedAttribute(attributes);
    assert.equal(requests,0,'disabled actor never requests a platform press color');
    assert.deepEqual([attributes.fill,attributes.radius],['disabled-surface',17]);
  }
}
failedCompositionFallback();
const correctFallback='this.applyNormalAttribute(instance);\n    }\n  }\n\n  applyDisabledAttribute';
assert.ok(actualSource.includes(correctFallback));
assert.throws(()=>failedCompositionFallback(actualSource.replace(correctFallback,
  'instance.backgroundColor(this.surface).borderRadius(this.pressedRadius);\n    }\n  }\n\n  applyDisabledAttribute')),
  /complete normal fallback/,'the prior color-only failure regression remains detectable');
console.log('reader press feedback: native tint delegation and normal/disabled restoration PASS');

}

const implementations = {'native-composition':case_native_composition,'platform-failure-fallback':case_platform_failure_fallback};
for (const id of selectContractCases(CONTRACT_CASES)) {
  await implementations[id]();
  recordContractCasePass(id);
}
