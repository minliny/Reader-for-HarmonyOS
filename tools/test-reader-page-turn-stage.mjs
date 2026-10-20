import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';

export const CONTRACT_CASES = {
  "slot-placement-admission": {
    "description": "Actual AST-selected Stage methods: slot promotion, hidden ACK, providers per revision and snapshot identities",
    "resources": []
  },
  "sdk-build-slot-binding": {
    "description": "Actual SDK Stage.build child payload and bad slot-identity counterexample; no whole LRE or native compositor claim",
    "resources": []
  }
};

async function case_slot_placement_admission() {
const { default: assert } = await import('node:assert/strict');
const {readFileSync} = await import('node:fs');
const {productionMotionMethods} = await import('./lib/reader-motion-method-probe.mjs');
const file=new URL('../entry/src/main/ets/features/reading/ReaderPageTurnStage.ets',import.meta.url);
const names=["slotPage", "refreshRenderPages", "currentRenderPage", "adjacentRenderPage", "slotIdentity", "slotSnapshotId", "slotPresented", "hasActiveTurn", "slotVisible", "slotX", "slotLayer", "slotShadow", "hasLiveTurnWidth", "previousPageX", "nextPageX", "turnProgress", "coverOcclusionStrength"];
const dependencies={READER_PAGE_TURN_SLOT_A:'reader-page-slot-a',READER_PAGE_TURN_SLOT_B:'reader-page-slot-b'};
const Subject=productionMotionMethods(file,names,dependencies);
const origin = { identity: 'origin', renderRevision: 1 }, next = { identity: 'next', renderRevision: 1 }, previous = { identity: 'previous', renderRevision: 1 };
const x = Object.assign(new Subject(), { currentPage: origin, currentPageSlot: 'a', nextPage: next,
  previousPage: previous, viewportWidth: 400, offsetX: 0, pageTurnStyle: 'slide', emptyPage: { fragments: [] } });
Object.assign(x, { contentRevision: 1, currentPageProvider: () => x.currentPage, previousPageProvider: () => x.previousPage, nextPageProvider: () => x.nextPage });
assert.equal(x.slotVisible('a'), true); assert.equal(x.slotVisible('b'), false);
for (const currentSlot of ['a', 'b']) {
  x.currentPageSlot = currentSlot;
  const adjacentSlot = currentSlot === 'a' ? 'b' : 'a';
  for (const mode of ['slide', 'cover']) {
    x.pageTurnStyle = mode;
    x.turnDirection = 'next'; x.offsetX = -120;
    assert.equal(x.slotPage(currentSlot), origin);
    assert.equal(x.slotPage(adjacentSlot), next);
    assert.equal(x.slotX(currentSlot), -120);
    assert.equal(x.slotX(adjacentSlot), mode === 'slide' ? 280 : 0);
    assert.ok(x.slotLayer(currentSlot) > x.slotLayer(adjacentSlot));
    x.turnDirection = 'previous'; x.offsetX = 120;
    assert.equal(x.slotX(currentSlot), mode === 'slide' ? 120 : 0);
    assert.equal(x.slotX(adjacentSlot), -280);
    assert.equal(x.slotLayer(adjacentSlot) > x.slotLayer(currentSlot), mode === 'cover');
    assert.equal(x.slotIdentity('a'), 'reader-page-slot-a');
    assert.equal(x.slotIdentity('b'), 'reader-page-slot-b');
  }
}
x.pageTurnStyle = 'slide'; x.currentPageSlot = 'b'; x.currentPage = next;
x.turnDirection = undefined; x.previousPage = origin; x.nextPage = undefined; x.contentRevision++;
// The outgoing page already owns slot a at the promotion boundary.
x.slotPageA = origin;
assert.equal(x.slotPage('b'), next); assert.equal(x.slotPage('a'), origin);
assert.equal(x.slotX('b'), 0); assert.equal(x.slotVisible('a'), false);
x.pageTurnStyle = 'simulation'; x.currentPageSnapshotId = 'native-current';
assert.equal(x.slotIdentity('b'), 'reader-page-slot-b', 'snapshot identity belongs to inner static content, never the physical slot');
assert.equal(x.slotPage('a'), origin, 'simulation keeps already-bound outgoing text hidden instead of clearing and rebuilding it');
let presented = 0; x.onCurrentPagePresented = () => presented++;
x.slotPresented('a', 1); x.slotPresented('b', 0); assert.equal(presented, 0);
x.slotPresented('b', 1); assert.equal(presented, 1);
console.log('reader page-turn stable slot geometry and role transition: PASS');

// Idle prefetch completion must not evict the outgoing page from its slot.
x.pageTurnStyle = 'slide'; x.nextPage = { identity: 'third', renderRevision: 2 }; x.contentRevision++;
assert.equal(x.slotPage('a'), origin, 'idle reserve retains the outgoing page for immediate reversal');
let providerReads = 0;
x.currentPageProvider = () => { providerReads++; return next; };
x.previousPageProvider = () => { providerReads++; return origin; };
x.nextPageProvider = () => { providerReads++; return x.nextPage; };
x.contentRevision++;
for (let frame = 0; frame < 100; frame++) {
  x.currentRenderPage(); x.adjacentRenderPage('next'); x.adjacentRenderPage('previous');
}
assert.equal(providerReads, 3, 'one projection read per role/revision, independent of geometry expression count');

// Snapshot lookup stays bound to a physical subtree through both promotions.
x.currentPageSnapshotId = 'native-current';
for (const role of ['a', 'b', 'a', 'b']) {
  x.currentPageSlot = role;
  assert.equal(x.slotSnapshotId('a'), 'native-current-a');
  assert.equal(x.slotSnapshotId('b'), 'native-current-b');
  assert.notEqual(x.slotSnapshotId(role), x.slotSnapshotId(role === 'a' ? 'b' : 'a'));
}
x.currentPageSnapshotId = '';
assert.equal(x.slotSnapshotId('a'), ''); assert.equal(x.slotSnapshotId('b'), '');

// Both non-flat modes retain only pages that actually occupied a slot. A cold
// reserve cannot invoke speculative providers; promotion must publish the new
// current revision rather than acknowledge the hidden outgoing revision.
for (const mode of ['simulation', 'none']) {
  const y = Object.assign(new Subject(), {
    pageTurnStyle: mode, viewportWidth: 400, currentPageSlot: 'a', emptyPage: {},
    contentRevision: 1, currentPageProvider: () => origin,
    previousPageProvider: () => undefined, nextPageProvider: () => next,
  });
  assert.equal(y.slotPage('b'), y.emptyPage);
  assert.equal(y.renderPagesRevision, undefined, 'cold reserve does not request page projections');
  assert.equal(y.slotPage('a'), origin);
  y.currentPageSlot = 'b'; y.contentRevision = 2;
  const promoted = { identity: 'next-revised', renderRevision: 2 };
  y.currentPageProvider = () => promoted;
  assert.equal(y.slotPage('b'), promoted);
  assert.equal(y.slotPage('a'), origin);
  assert.equal(y.slotVisible('a'), false);
  assert.equal(y.slotVisible('b'), true);
  const acknowledgements = [];
  y.onCurrentPagePresented = revision => acknowledgements.push(revision);
  y.slotPresented('a', 1); y.slotPresented('b', 1); y.slotPresented('b', 2);
  assert.deepEqual(acknowledgements, [2]);
}

}

async function case_sdk_build_slot_binding() {
const { default: assert } = await import('node:assert/strict');
const {readFileSync} = await import('node:fs');
const {productionMotionMethods} = await import('./lib/reader-motion-method-probe.mjs');
const file=new URL('../entry/src/main/ets/features/reading/ReaderPageTurnStage.ets',import.meta.url);
const names=["slotPage", "refreshRenderPages", "currentRenderPage", "adjacentRenderPage", "slotIdentity", "slotSnapshotId", "slotPresented", "hasActiveTurn", "slotVisible", "slotX", "slotLayer", "slotShadow", "hasLiveTurnWidth", "previousPageX", "nextPageX", "turnProgress", "coverOcclusionStrength"];
const dependencies={READER_PAGE_TURN_SLOT_A:'reader-page-slot-a',READER_PAGE_TURN_SLOT_B:'reader-page-slot-b'};
const Subject=productionMotionMethods(file,names,dependencies);
const {createReaderBuilderProbe} = await import('./lib/reader-control-builder-probe.mjs');
const stage=readFileSync(file,'utf8');class Child {constructor(owner,params,_storage,id){Object.assign(this,{owner,params,id});}updateStateVars(params){Object.assign(this.params,params);}}
const {owner}=createReaderBuilderProbe(stage,['build',...names,'slotContentReady'],{...dependencies,ReaderPageTurnSurface:Child},{componentName:'ReaderPageTurnStage',childSources:{ReaderPageTurnSurface:stage}});
const origin={identity:'origin',textureIdentity:'origin-pixels',renderRevision:1,fragments:[{text:'origin'}]},next={identity:'next',textureIdentity:'next-pixels',renderRevision:2,fragments:[{text:'next'}]};
const params={currentPageSnapshotId:'',contentRevision:1,currentPageSlot:'a',pageTurnStyle:'slide',turnDirection:'next',offsetX:-120,viewportWidth:400,translateY:12,layout:{viewportWidth:400,viewportHeight:800},appearance:{activeTheme:'paper'},currentPageProvider:()=>origin,previousPageProvider:()=>undefined,nextPageProvider:()=>next,emptyPage:{fragments:[]},onDynamicHighlights(){},onCurrentPagePresented(){},longPressSelectText:true};Object.assign(owner,params);
owner.initialRender();const children=[...owner.children.values()];assert.equal(children.length,2,'two current physical slot actors are mounted by actual build');
const a=children.find(child=>child.params.slotIdentity==='reader-page-slot-a'),b=children.find(child=>child.params.slotIdentity==='reader-page-slot-b');assert.ok(a&&b);
assert.equal(a.params.pageIdentity,'origin');assert.equal(b.params.pageIdentity,'next');assert.equal(a.params.pageFragmentsProvider(),origin.fragments);assert.equal(b.params.pageFragmentsProvider(),next.fragments);assert.equal(a.params.translateX,-120);assert.equal(b.params.translateX,280);assert.equal(a.params.chromeTopTranslateY,-12);assert.equal(a.params.longPressSelectText,true);assert.equal(b.params.longPressSelectText,false);
const wrong=stage.replace("slotIdentity: this.slotIdentity('b')", "slotIdentity: this.slotIdentity('a')");assert.notEqual(wrong,stage);
const mutant=createReaderBuilderProbe(wrong,['build',...names,'slotContentReady'],{...dependencies,ReaderPageTurnSurface:Child},{componentName:'ReaderPageTurnStage',childSources:{ReaderPageTurnSurface:stage}}).owner;Object.assign(mutant,params);mutant.initialRender();
assert.ok([...mutant.children.values()].every(child=>child.params.slotIdentity==='reader-page-slot-a'),'negative control proves actual payload can duplicate a physical slot; original identity matrix rejects it');

}

const implementations = {'slot-placement-admission':case_slot_placement_admission,'sdk-build-slot-binding':case_sdk_build_slot_binding};
for (const id of selectContractCases(CONTRACT_CASES)) {
  await implementations[id]();
  recordContractCasePass(id);
}
