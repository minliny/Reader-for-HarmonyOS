import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';
const definitions = {
  dto: { description: 'Actual highlight DTO normalization, alpha, bounds and rejected invalid inputs', resources: [] },
  'canvas-policy': { description: 'Actual ReadingSurface overlay admission and TTS blend methods; excludes native shader identity', resources: [] },
};
const selected = selectContractCases(definitions);
const cases = {
  async dto() {
    const { default: assert } = await import('node:assert/strict');
    const { readerNativeHighlightValues, readerHighlightColor, readerHighlightCanvasColor } = await import('../entry/src/main/ets/features/reading/ReaderDynamicHighlight.ts');
const rect={left:10,top:20,right:80,bottom:25,color:'#33594632',multiply:true};
const values=readerNativeHighlightValues([rect],100,100);assert.deepEqual(values.slice(0,4),[.1,.2,.8,.25]);assert.equal(values[7],-.2);
assert.equal(readerHighlightCanvasColor('#33594632'),'rgba(89,70,50,0.2)');assert.deepEqual(readerHighlightColor('#FFFFFF'),[1,1,1,1]);
assert.equal(readerNativeHighlightValues([{...rect,multiply:false,color:'#101010'}],100,100)[7],1);
assert.deepEqual(readerNativeHighlightValues([{...rect,left:-10,right:120}],100,100).slice(0,4),[0,.2,1,.25]);
assert.throws(()=>readerNativeHighlightValues(Array(65).fill(rect),100,100),/LIMIT/);assert.throws(()=>readerNativeHighlightValues([{...rect,left:NaN}],100,100),/INVALID/);

  },
  async 'canvas-policy'() {
    const { default: assert } = await import('node:assert/strict');
    const { selectedProductionMethods } = await import('./lib/selected-production-methods.mjs');
    const Surface = selectedProductionMethods(new URL('../entry/src/main/ets/features/reading/ReadingSurface.ets', import.meta.url), 'ReadingSurface', ['usesHighlightCanvas', 'dynamicHighlightBlend'], { BlendMode: { SRC_OVER: 'over', MULTIPLY: 'multiply' } });
    const surface = Object.assign(new Surface(), { staticSnapshotId: '', snapshotSynchronousImages: true, renderFragments: () => [{ nativeParagraph: { key: 'native' } }] });
    assert.equal(surface.usesHighlightCanvas(), false, 'synchronous native paragraphs need no live overlay');
    surface.snapshotSynchronousImages = false; assert.equal(surface.usesHighlightCanvas(), true);
    surface.renderFragments = () => []; assert.equal(surface.usesHighlightCanvas(), false);
    surface.staticSnapshotId = 'snapshot-owned'; assert.equal(surface.usesHighlightCanvas(), true, 'snapshot owner admits its Canvas');
    assert.equal(surface.dynamicHighlightBlend(), 'multiply');
    surface.ttsHighlightStart = 0; surface.ttsHighlightEnd = 8; assert.equal(surface.dynamicHighlightBlend(), 'over');
    surface.ttsHighlightStart = NaN; assert.equal(surface.dynamicHighlightBlend(), 'multiply');
    surface.ttsHighlightStart = 8; assert.equal(surface.dynamicHighlightBlend(), 'multiply', 'empty TTS interval is not an active range');
  },
};
// Native slot identity/uniform rejection is independently covered by
// test-reader-book-turn-host-runtime.mjs#native-render-state; no import or automatic run.
// Real GL shader pixels remain outside both local probes.
for (const id of selected) { await cases[id](); recordContractCasePass(id); }
