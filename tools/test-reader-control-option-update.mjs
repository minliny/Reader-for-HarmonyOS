import {selectContractCases,recordContractCasePass} from './lib/contract-case-selection.mjs';
const definitions={'modifier-budget':{description:'Pinned Apache-2.0 upstream modifier correctness and native setter call budget',resources:[]}};
const selected=selectContractCases(definitions);
async function runCase(){
const {default:assert}=await import('node:assert/strict');
const { readFileSync }=await import('node:fs');
const { gunzipSync }=await import('node:zlib');
const { createHash }=await import('node:crypto');
const { runInNewContext }=await import('node:vm');
const { productionSettingsOptionModifier }=await import('./lib/reader-control-option-modifier-probe.mjs');
const { sampleReaderControlSettings }=await import('../entry/src/main/ets/features/reading/ReaderControlSettingsGeometry.ts');
const { sampleReaderControlMotionPresentation }=await import('../entry/src/main/ets/features/reading/ReaderControlMotionPresentation.ts');

const upstreamEvidence=[];
const fixture = name => {
  const url = new URL(`./fixtures/openharmony/${name}`, import.meta.url);
  const bytes = gunzipSync(readFileSync(new URL(`${url}.js.gz`)));
  const meta = JSON.parse(readFileSync(new URL(`${url}.json`)));
  assert.equal(createHash('sha256').update(bytes).digest('hex'), meta.sha256, 'exact unmodified upstream bytes');
  assert.equal(meta.license,'Apache-2.0');assert.match(meta.gitBlob,/^[a-f0-9]{40}$/);
  upstreamEvidence.push({repository:meta.repository,ref:meta.ref,gitBlob:meta.gitBlob,sha256:meta.sha256,license:meta.license,scope:meta.scope});
  return bytes.toString();
};
const calls = [], values = new Map();
const native = new Proxy({}, { get: (_, section) => new Proxy({}, { get: (_, method) => (...args) => {
  if (section === 'nativeUtils') return {};
  calls.push({ section, method, args });
  const node = values.get(args[0]) ?? new Map(); values.set(args[0], node);
  node.set(method, args.slice(1));
} }) });
const ArkText = runInNewContext(`${fixture('jsEnumStyle-5.0.0')}\n${fixture('arkComponent-5.0.0')}\nArkTextComponent;`,
  { getArkUINativeModule: () => native, _a: undefined });
const Modifier = productionSettingsOptionModifier();
const actors = Array.from({ length: 13 }, (_, index) => ({ node: new ArkText(index), modifier: new Modifier(() => {}) }));
function pose(p, width = 286 + 52 * p, active = 0, enabled = true) {
  const f = sampleReaderControlSettings(p, width), paint = sampleReaderControlMotionPresentation(p);
  const frames = [...f.directionChoices, ...f.pageChoices, ...f.pageChoices];
  actors.forEach(({ node, modifier }, index) => {
    modifier.update(frames[index], paint, index === active, enabled, `option-${index}`).applyNormalAttribute(node);
    node.applyModifierPatch();
    const v = values.get(index), frame = frames[index];
    assert.deepEqual(v.get('setWidth'), [frame.width]); assert.deepEqual(v.get('setHeight'), [frame.height]);
    assert.deepEqual(v.get('setPosition'), [false, frame.x, frame.y]);
    assert.deepEqual(v.get('setOpacity'), [paint.contentOpacity]); assert.deepEqual(v.get('setBlur'), [paint.contentBlur, undefined]);
    assert.deepEqual(v.get('setFontColor'), [index === active ? '#FF2F6373' : '#FF332C25']);
    assert.deepEqual(v.get('setBackgroundColor'), [index === active ? '#BDFFFCF8' : 'Color.Transparent']);
    assert.deepEqual(v.get('setEnabled'), [enabled]);
  });
}
pose(0);
const mountedCalls = calls.length;
calls.length = 0;
for (let i = 1; i <= 120; i++) pose(i / 120);
const movingCalls = calls.length;
// Budget covers five changing setters for each of 13 native nodes over 120 poses; no wall-clock inference.
const nativeSetterCallBudget=13*5*120;
assert.ok(movingCalls<=nativeSetterCallBudget,'bounded dynamic native setter calls');
for (const name of ['setFontFamily', 'setFontSize', 'setTextAlign', 'setMaxLines', 'setBorderRadius',
  'setFontColor', 'setBackgroundColor', 'setEnabled', 'setAccessibilityText', 'setOnClick',
  'setFontFamily', 'setFontSize', 'setFontWeight', 'setTextAlign', 'setMaxLines', 'setBorderRadius']) {
  assert.equal(calls.filter(c => c.method === name).length, 0, `stable ${name} is not forwarded during motion`);
}
const last = calls.length;
pose(1); pose(1);
assert.equal(calls.slice(last).length, 0, 'same pose does not forward any dynamic attribute');
for (const p of [.8, .2, .7, 0, .5, 1]) pose(p);
pose(.5, 450); pose(.5, 220); pose(.5, 220, 5, false); pose(.5, 220, 1, true);
assert.equal(actors.length, values.size, 'same 13 native nodes across reverse/resize/business changes');
let current = 1, received;
const retained = new Modifier(() => { received = current; }), retainedNode = new ArkText(99);
retained.update({ x: 0, y: 0, width: 20, height: 20, opacity: 1 }, sampleReaderControlMotionPresentation(.5), false, true, 'live').applyNormalAttribute(retainedNode);
retainedNode.applyModifierPatch(); current = 2; values.get(99).get('setOnClick')[0](); assert.equal(received, 2);
console.log(JSON.stringify({ result: 'PASS', layer: 'real upstream 5.0 attribute diff + production modifier; not native layout or VM performance',
  mountedNodes: 13, mountedCalls, poses:120,upstreamEvidence,nativeSetterCallBudget,patchedAttributeCalls:movingCalls,
  sdkRelationship:'Pinned OpenHarmony 5.0 upstream attribute diff fixture; production installed API23 SDK may differ; no VM performance claim', reverseResizeBusinessAndCallback: 'PASS' }));

}
for(const id of selected){await runCase();recordContractCasePass(id);}
