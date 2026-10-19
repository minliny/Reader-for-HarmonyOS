import {selectContractCases,recordContractCasePass} from './lib/contract-case-selection.mjs';
const selected=selectContractCases({'property-authority':{description:'Actual renderFragments reads reactive property even with live provider; fallback revision admission',resources:[]}});
async function runCase(){
const {default:assert}=await import('node:assert/strict');

const file = new URL('../entry/src/main/ets/features/reading/ReadingSurface.ets', import.meta.url);
const {selectedProductionMethods}=await import('./lib/selected-production-methods.mjs');
const Surface=selectedProductionMethods(file,'ReadingSurface',['renderFragments']);
const surface = new Surface();
let reads = 0;
let fallback = [{ id: 'fallback', nativeTitle: { text: 'old title' } }];
let current = [{ id: 'text-page', nativeTitle: { text: 'new title' } }];
Object.defineProperty(surface, 'pageFragments', { get() { reads++; return fallback; } });
surface.contentRevision = 7;
surface.fragmentsProvider = () => current;
assert.equal(surface.renderFragments(), current);
assert.equal(reads, 1, 'provider path must read the reactive fragment property');
current = [{ id: 'image-page', image: { src: 'retained-image' } }];
fallback = current;
assert.equal(surface.renderFragments(), current, 'same revision can carry a different page');
assert.equal(reads, 2, 'reused offscreen page keeps a fragment dependency');
surface.fragmentsProvider = undefined;
assert.equal(surface.renderFragments(), fallback);
surface.fragmentsProvider = () => { throw Error('provider is not active'); };
surface.contentRevision = -1;
assert.equal(surface.renderFragments(), fallback);


}
for(const id of selected){await runCase();recordContractCasePass(id);}
