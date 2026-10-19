import {selectContractCases,recordContractCasePass} from './lib/contract-case-selection.mjs';
const definitions={"caller-barrier": {"description": "实际reader caller原Promise/全局suppression/retired拒绝", "resources": []}, "metrics-dedup": {"description": "实际Coordinator相同metric静默/changed事实revision一次", "resources": []}, "policy-dedup": {"description": "实际Coordinator equal applied/noequal/forced reapply/native失败重试", "resources": []}};
for(const id of selectContractCases(definitions)){await runSelectedCase(id);recordContractCasePass(id);}
async function runSelectedCase(selectedCase){
const {default: assert} = await import('node:assert/strict');
const {selectedProductionMethods} = await import('./lib/selected-production-methods.mjs');

const appRoot=new URL('../entry/src/main/ets/',import.meta.url);
if(selectedCase==='caller-barrier') {
// Callers must keep awaiting the deduped promise (persistence continues).
{
  let writes = 0, expectedSuppression = true;
  const policy = {}, pending = new Promise(() => {});
  const storage = new Map(), storageWrites = [];
  const Owner = selectedProductionMethods(new URL('features/reading/LocalReadingExperience.ets', appRoot),'LocalReadingExperience',
    ['applyReaderWindowPolicy'], { AppStorage: {
      get(key) { return storage.get(key); },
      setOrCreate(key, value) { storage.set(key, value); storageWrites.push([key, value]); },
    }, ReaderWindowCoordinator: { requestReaderWindowPolicy(value) {
      assert.equal(value, policy);
      assert.equal(storage.get('readerTopInfoSuppressed'), expectedSuppression,
        'page-info suppression must be current when the native policy request is forwarded');
      writes++; return pending;
    } } });
  const owner = Object.assign(new Owner(), { windowChromeActive: true, isReaderIdentityCurrent: () => true,
    windowPolicyFor: () => policy, controlsPresentedForWindow: () => false });
  assert.equal(owner.applyReaderWindowPolicy({}), pending,
    'the settings commit path must return the coordinator promise without releasing its persistence barrier');
  assert.equal(writes, 1, 'each settings application forwards exactly one coordinator request');
  assert.equal(storage.get('readerTopInfoSuppressed'), true,
    'the default visible status bar suppresses page-owned information before forwarding its policy');
  for (const hideStatusBar of [false, true]) for (const controls of [false, true]) {
    const before = writes, beforeStorage = storageWrites.length;
    owner.controlsPresentedForWindow = () => controls;
    expectedSuppression = controls || !hideStatusBar;
    assert.equal(owner.applyReaderWindowPolicy({ hideStatusBar }), pending,
      'every current settings application retains the original coordinator promise');
    assert.equal(writes, before + 1, 'one settings application forwards exactly one policy request');
    assert.equal(storageWrites.length, beforeStorage + 1);
    assert.deepEqual(storageWrites.at(-1), ['readerTopInfoSuppressed', controls || !hideStatusBar],
      'current policy suppression follows the independent status preference and controls visibility');
    assert.equal(storage.get('readerTopInfoSuppressed'), controls || !hideStatusBar);
  }
  for (const [active, current] of [[false, true], [true, false], [false, false]]) {
    owner.windowChromeActive = active;
    owner.isReaderIdentityCurrent = () => current;
    storage.set('readerTopInfoSuppressed', false);
    storage.set('unrelated-visible-owner', 'retained');
    const before = writes, beforeStorage = storageWrites.length, beforeValues = new Map(storage);
    const ignored = owner.applyReaderWindowPolicy({ hideStatusBar: false }, true);
    assert.equal(writes, before, 'offstage or retired readers must not enqueue native policies');
    assert.equal(storageWrites.length, beforeStorage,
      'offstage or retired readers must not publish any global storage key');
    assert.deepEqual(storage, beforeValues,
      'a retained reader must preserve the visible owner\'s complete global storage state');
    await ignored;
  }
}


}
if(selectedCase==='metrics-dedup'||selectedCase==='policy-dedup') {
 const {createWindowCoordinatorFixture}=await import('./lib/reader-window-coordinator-fixture.mjs');const f=await createWindowCoordinatorFixture();try {const w=f.windowPort();await f.C.install(w);await f.C.windowPolicyTail;
 if(selectedCase==='metrics-dedup') {const writes=()=>f.appWrites.filter(([key])=>key==='readerWindowMetricsRevision').length;const before=writes();f.C.refreshConfiguration();assert.equal(writes(),before,'equal geometry does not broadcast revision');for(const change of [()=>{w.rect={...w.rect,width:w.rect.width+17};},()=>{f.displayInfo.scaledDensity+=.25;},()=>{f.displayInfo.densityPixels+=.5;}]){const old=writes();change();f.C.refreshConfiguration();assert.equal(writes(),old+1,'a changed committed geometry/font/density fact broadcasts once');f.C.refreshConfiguration();assert.equal(writes(),old+1);}}
 if(selectedCase==='policy-dedup') {const policy=new f.P('portrait',true,true,false,false);await f.C.requestReaderWindowPolicy(policy);let count=w.calls.length,storage=f.appWrites.length;await f.C.requestReaderWindowPolicy(policy);assert.equal(w.calls.length,count);assert.equal(f.appWrites.length,storage,'equal applied reader policy has no AppStorage broadcast');f.C.reapplyWindowPolicy();await f.C.windowPolicyTail;assert.ok(w.calls.length>count,'explicit foreground reapply revokes receipt');await f.C.requestAppWindowPolicy();count=w.calls.length;await f.C.requestAppWindowPolicy();assert.equal(w.calls.length,count);const original=w.setPreferredOrientation;let fail=true;w.setPreferredOrientation=async value=>{if(fail){fail=false;throw Error('native failure');}return original(value);};await assert.rejects(f.C.requestReaderWindowPolicy(policy),/native failure/);await f.C.requestReaderWindowPolicy(policy);assert.equal(f.C.appliedPolicyRevision,f.C.windowPolicyRevision,'failed equal policy must retry instead of pretending applied');}
 }finally{f.cleanup();}
}

}
