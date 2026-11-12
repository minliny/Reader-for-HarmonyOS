import assert from 'node:assert/strict';
import { productionMotionMethods } from './lib/reader-motion-method-probe.mjs';
const liveSourcePaths = new Map([
 ['features/source/SourceOrchestrator.ets', 'features/source/application/SourceOrchestrator.ets'],
 ['features/source/SourceToolsOrchestrator.ets', 'features/source/application/SourceToolsOrchestrator.ets'],
]);
const path=p=>new URL('../entry/src/main/ets/'+(liveSourcePaths.get(p)??p),import.meta.url);
import { runtimeOwnerIdentityProbe } from './lib/reader-runtime-admission-probe.mjs';
let installed;
const unavailable=runtimeOwnerIdentityProbe(()=>installed);
const oldOwner={};
assert.throws(()=>unavailable.current(),/must be installed/);
assert.equal(unavailable.isCurrent(oldOwner),false);
installed=oldOwner;assert.equal(unavailable.current(),oldOwner);assert.equal(unavailable.isCurrent(oldOwner),true);
installed={};assert.equal(unavailable.isCurrent(oldOwner),false);
installed=undefined;
for(const file of ['source/SourceOrchestrator.ets','source/SourceToolsOrchestrator.ets','settings/application/RulesManagementOrchestrator.ets','bookshelf/application/BookshelfManagementOrchestrator.ets','settings/application/SettingsOrchestrator.ets']){
  const Host=productionMotionMethods(path('features/'+file),['isCurrentSession'],{ReaderRuntimeOwner:unavailable});
  const host=Object.assign(new Host(),{owner:{},isCurrent:()=>true,session:1,writeGeneration:1});
  assert.doesNotThrow(()=>host.isCurrentSession(1,1),`${file}: actual predicate after Runtime teardown`);
  assert.equal(host.isCurrentSession(1,1),false);
}

console.log('PASS actual Runtime authority identity: unavailable/replaced false, required current hard-fails, five production session predicates safely reject teardown');
