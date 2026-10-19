import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire,stripTypeScriptTypes} from 'node:module';
import {selectContractCases,recordContractCasePass} from './lib/contract-case-selection.mjs';
async function rowIdentity(){
 const {resolveEtsLoaderRoot,virtualFilePath}=await import('./lib/tool-environment.mjs');
 const {createArkUIPropertyRuntimeProbe}=await import('./lib/arkui-property-runtime-probe.mjs');
 const {sourceSwitchRowSdk}=await import('./lib/source-switch-row-sdk-probe.mjs');
 const window=readFileSync(new URL('../entry/src/main/ets/features/source/SourceSwitchWindow.ets',import.meta.url),'utf8');
const require = createRequire(import.meta.url);
const sdk = resolveEtsLoaderRoot();
const ts = require(`${sdk}/node_modules/typescript`);
const tree = ts.createSourceFile(virtualFilePath('SourceSwitchTransactionIdentity.ets'), window,
  ts.ScriptTarget.Latest, true, ts.ScriptKind.ETS, require(`${sdk}/lib/ets_checker.js`).compilerOptions);
assert.deepEqual(tree.parseDiagnostics, []);
let nativeKeyFactory;
const visitLazyIdentity = node => {
  if ((ts.isCallExpression(node) || ts.isEtsComponentExpression(node)) &&
    node.expression.getText(tree) === 'LazyForEach' && node.arguments[0]?.getText(tree) === 'this.candidateDataSource') {
    assert.equal(nativeKeyFactory, undefined, 'one authoritative native candidate range');
    nativeKeyFactory = node.arguments[2];
  }
  ts.forEachChild(node, visitLazyIdentity);
};
visitLazyIdentity(tree);
assert.ok(nativeKeyFactory && ts.isArrowFunction(nativeKeyFactory), 'production LazyForEach supplies its actual key factory');
const rowSdk = sourceSwitchRowSdk(createArkUIPropertyRuntimeProbe(), window);
const lazyKey = new Function('sourceSwitchCandidateKey',
  `return (${stripTypeScriptTypes(nativeKeyFactory.getText(tree))});`)(rowSdk.sourceSwitchCandidateKey);
function verifyNativeCandidateIdentity(keyFactory) {
  const data = new rowSdk.SourceSwitchCandidateDataSource();
  const samples = [
    { sourceId: 'same-source', bookUrl: '/book/a', latencyMs: 780 },
    { sourceId: 'same-source', bookUrl: '/book/b', latencyMs: 5 },
    { sourceId: 'other-source', bookUrl: '/book/a', latencyMs: 900 },
  ];
  data.publish(samples);
  const retained = samples.map((_sample, position) => data.getData(position));
  const expected = samples.map(sample => rowSdk.sourceSwitchCandidateKey(sample.sourceId, sample.bookUrl));
  const initialKeys = retained.map(keyFactory);
  assert.equal(new Set(initialKeys).size, samples.length, 'same-source alternate books and same-URL alternate sources are distinct');
  const remeasured = { ...samples[0], latencyMs: 12 };
  data.publish([samples[1], remeasured, samples[2]]);
  assert.equal(data.getData(1), retained[0], 'remeasurement/reorder retains the exact observed row');
  assert.equal(data.getData(1).candidate, remeasured);
  assert.deepEqual([0, 1, 2].map(position => keyFactory(data.getData(position))), [initialKeys[1], initialKeys[0], initialKeys[2]],
    'new latency and position cannot become selection identity');
  const remeasuredAgain = { ...samples[0], latencyMs: 98 };
  data.publish([samples[2], remeasuredAgain, samples[1]]);
  assert.equal(data.getData(1), retained[0]);
  assert.equal(data.getData(1).candidate, remeasuredAgain);
  assert.deepEqual([0, 1, 2].map(position => keyFactory(data.getData(position))), [initialKeys[2], initialKeys[0], initialKeys[1]],
    'a second measurement and reorder still retain the admitted keys');
  assert.deepEqual(initialKeys, expected, 'native keys retain both source and book URL');
}
verifyNativeCandidateIdentity(lazyKey);
assert.throws(() => verifyNativeCandidateIdentity(row => row.candidate.sourceId), assert.AssertionError,
  'a sourceId-only key cannot collapse alternate URLs');
assert.throws(() => verifyNativeCandidateIdentity(row => `${row.key}:${row.candidate.latencyMs}`), assert.AssertionError,
  'measured latency cannot enter the native selection key');

}
async function refreshMeasurement(){
 const {fixture,settle,deferred,rawCandidate}=await import('./lib/source-switch-owner-probe.mjs');
 const f=fixture({open:false});f.setRows([{...rawCandidate,acquisition:{sourceVersion:'v1',searchTiming:{kind:'search',sourceVersion:'v1',durationMs:321,measuredAt:1700000000000}}}]);
 assert.equal(f.host.open(f.context,f.lease),true);await settle();
 const before=f.host.current().state.candidates;assert.ok(before?.length);assert.equal(before[0].latencyMs,321,'the fixture must contain a real version-bound previous measurement');
 const saved=structuredClone(before),gate=deferred();let initial;
 f.host.gateway.refreshCandidates=(_query,_current,excluded,_progress,retained)=>{assert.deepEqual(excluded,[]);initial=retained;return gate.promise;};
 try{
  f.host.refresh(f.host.current().scopeId);await settle();assert.equal(f.host.current().state.refreshing,true);assert.deepEqual(initial,before);assert.deepEqual(f.host.current().state.candidates,saved,'pending refresh keeps old truthful version-bound timing');assert.deepEqual(before,saved,'old observed DTO is not mutated');
  gate.resolve({kind:'sources',candidates:[{...before[0],latencyMs:12,latencyKind:'search',latencyMeasuredAt:1700000000012}]});await settle();assert.equal(f.host.current().state.refreshing,false);assert.equal(f.host.current().state.candidates[0].latencyMs,12,'new completed search replaces the measurement');
 }finally{gate.resolve({kind:'sources',candidates:before});f.host.retire();await settle();}
}
const cases={'row-identity':rowIdentity,'refresh-measurement':refreshMeasurement};
for(const id of selectContractCases({'row-identity':'Actual LazyForEach key factory and observed row ownership with bad-key controls','refresh-measurement':'Actual Host keeps nonempty prior search timing until new result; no empty-fixture clearing claim'})){await cases[id]();recordContractCasePass(id);}
