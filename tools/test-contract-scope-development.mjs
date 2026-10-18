import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { contractSelection, contractTests, runContractsBounded } from './run-contract-tests.mjs';
import { localContractPlan } from '../scripts/check-local.mjs';
import { buildContractScope, remainingContractBudget } from '../scripts/hap-pipeline.mjs';

// Only tiny owned Node fixtures execute here. "full" below is the two-child
// fixture inventory, never the production classified inventory.
const root = mkdtempSync(join(tmpdir(), 'reader-development-scope-'));
const logs = [];
try {
  mkdirSync(join(root, 'tools'));
  const marker = join(root, 'must-not-run');
  writeFileSync(join(root, 'tools/test-a-failure.mjs'), 'process.exit(7);');
  writeFileSync(join(root, 'tools/test-z-unrun.mjs'), `import {writeFileSync} from 'node:fs';writeFileSync(${JSON.stringify(marker)},'unexpected');`);
  const inventory = ['test-a-failure.mjs', 'test-z-unrun.mjs'];
  const manifest = { schemaVersion: 1, source: inventory, integration: [], scopes: { 'search-return-runtime': inventory },
    scopePolicies: { 'search-return-runtime': { timeoutMs: 120_000, failFast: true, layers: [{ id: 'fixture', tests: inventory,
      proves: 'Two real Node children exercise dispatch and receipt policy.', doesNotProve: 'No product build, native pixels or device acceptance.' }] } } };
  const save = value => writeFileSync(join(root, 'tools/contract-test-tiers.json'), JSON.stringify(value));
  save(manifest);
  const stdinImport = spawnSync(process.execPath, ['--input-type=module', '-'], { encoding: 'utf8',
    input: `import { contractTests } from ${JSON.stringify(new URL('./run-contract-tests.mjs', import.meta.url).href)}; console.log(typeof contractTests);`, timeout: 2_000 });
  assert.equal(stdinImport.status, 0, stdinImport.stderr); assert.equal(stdinImport.stdout.trim(), 'function',
    'read-only stdin imports do not enter the real CLI or resolve a nonexistent dash path');
  assert.equal(buildContractScope(new Map([['--contracts-scope', 'search-return-runtime']]), root), 'search-return-runtime');
  assert.throws(() => buildContractScope(new Map([['--class', 'acceptance'], ['--contracts-scope', 'search-return-runtime']]), root), /only supported for iteration/);
  for (const scope of ['', 'unknown', 'search-message-ui']) {
    assert.throws(() => contractTests(root, 'full', scope), /unknown contract scope/);
    assert.throws(() => localContractPlan(['--contracts-scope', scope], root), /Usage|unknown contract scope/);
  }
  assert.throws(() => localContractPlan(['--contracts-scope'], root), /Usage/);
  assert.deepEqual(localContractPlan([], root).args, ['tools/run-contract-tests.mjs', '--full']);
  assert.deepEqual(localContractPlan(['--contracts-scope', 'search-return-runtime'], root).args,
    ['tools/run-contract-tests.mjs', '--scope', 'search-return-runtime']);
  assert.equal(contractTests(root, 'full', 'search-return-runtime').scopePolicy.timeoutMs, 120_000);
  assert.ok(remainingContractBudget(performance.now() - 90_000, 1_000, 120_000) > 28_000,
    'the retained runtime scope uses its own finite total budget');
  for (const change of [m => { m.scopePolicies['search-return-runtime'].timeoutMs = 600_001; },
    m => { delete m.scopePolicies; }, m => { m.scopePolicies['search-return-runtime'].failFast = false; },
    m => { delete m.scopePolicies['search-return-runtime'].failFast; },
    m => { m.scopePolicies['search-return-runtime'].layers[0].tests = ['test-a-failure.mjs']; },
    m => { m.scopePolicies['search-return-runtime'].layers[0].tests.push('test-a-failure.mjs'); },
    m => { m.scopes['search-return-runtime'].push('test-a-failure.mjs'); },
    m => { m.scopePolicies['search-return-runtime'].layers[0].doesNotProve = ''; },
    m => { m.scopePolicies.unknown = m.scopePolicies['search-return-runtime']; }]) {
    const invalid = structuredClone(manifest); change(invalid);
    assert.throws(() => contractSelection(invalid, inventory, 'full', 'search-return-runtime'));
  }
  await assert.rejects(runContractsBounded(root, 'full', 1, { scope: 'search-return-runtime', scopeTimeoutMs: 120_001 }), /invalid scope deadline/);
  let failure;
  try { await runContractsBounded(root, 'full', 1, { scope: 'search-return-runtime', timeoutMs: 2_000 }); }
  catch (error) { failure = error; }
  assert.match(failure?.message ?? '', /test-a-failure.mjs failed \(7\)/);
  const report = failure.report; logs.push(report.logRoot);
  assert.equal(report.scopeTimeoutMs, 120_000); assert.equal(report.failFast, true); assert.equal(report.failureStopped, true);
  assert.deepEqual(report.unrun, ['test-z-unrun.mjs']); assert.equal(existsSync(marker), false);
  assert.deepEqual(report.results.map(row => row.name), ['test-a-failure.mjs']);
  assert.equal(report.selectedStatus, 'FAIL'); assert.equal(report.fullSuite, 'NOT_RUN'); assert.equal(report.acceptanceEligible, false);
  const persisted = JSON.parse(readFileSync(join(report.logRoot, 'results.json'), 'utf8'));
  assert.deepEqual(persisted.unrun, report.unrun); assert.deepEqual(persisted.evidenceLayers, manifest.scopePolicies['search-return-runtime'].layers);

  // Fail-fast stops new work without cancelling a peer already executing.
  const parallel = structuredClone(manifest);
  parallel.source = ['test-a-failure.mjs', 'test-m-active.mjs', 'test-z-unrun.mjs'];
  parallel.scopes['search-return-runtime'] = parallel.source;
  parallel.scopePolicies['search-return-runtime'].layers[0].tests = parallel.source;
  writeFileSync(join(root, 'tools/test-m-active.mjs'), 'setTimeout(()=>process.exit(0),200);'); save(parallel);
  let parallelFailure;
  try { await runContractsBounded(root, 'full', 2, { scope: 'search-return-runtime', timeoutMs: 2_000 }); }
  catch (error) { parallelFailure = error; }
  logs.push(parallelFailure.report.logRoot);
  assert.deepEqual(parallelFailure.report.unrun, ['test-z-unrun.mjs']); assert.equal(existsSync(marker), false);
  assert.equal(parallelFailure.report.results.find(row => row.name === 'test-m-active.mjs').status, 0);
  assert.equal(parallelFailure.report.results.find(row => row.name === 'test-m-active.mjs').timedOut, false);
  rmSync(join(root, 'tools/test-m-active.mjs')); save(manifest);

  // The ordinary full mode retains its collect-all behavior after exit 7.
  let fullFailure;
  try { await runContractsBounded(root, 'full', 1, { timeoutMs: 2_000 }); } catch (error) { fullFailure = error; }
  logs.push(fullFailure.report.logRoot);
  assert.equal(fullFailure.report.failFast, false); assert.equal(fullFailure.report.scopeTimeoutMs, null);
  assert.equal(fullFailure.report.results.length, 2); assert.deepEqual(fullFailure.report.unrun, []); assert.equal(existsSync(marker), true);

  writeFileSync(join(root, 'tools/test-a-failure.mjs'), 'process.exit(0);');
  const passed = await runContractsBounded(root, 'full', 2, { scope: 'search-return-runtime', timeoutMs: 2_000 }); logs.push(passed.logRoot);
  assert.equal(passed.harmonyContracts, 'PARTIAL'); assert.equal(passed.selectedStatus, 'PASS'); assert.equal(passed.failureStopped, false);
  assert.equal(passed.fullSuite, 'NOT_RUN'); assert.equal(passed.acceptanceEligible, false); assert.deepEqual(passed.unrun, []);
  const sourceOnly = await runContractsBounded(root, 'source', 2, { timeoutMs: 2_000 }); logs.push(sourceOnly.logRoot);
  assert.equal(sourceOnly.harmonyContracts, 'PARTIAL'); assert.equal(sourceOnly.fullSuite, 'NOT_RUN',
    'the source tier cannot acquire full-suite evidence labels even when its tiny fixture has no integration children');

  // The fast layer deliberately sorts after the witness by file name. The
  // selected/result receipt and real process dispatch must follow layers.
  const orderedRoot = join(root, 'ordered'); mkdirSync(join(orderedRoot, 'tools'), { recursive: true });
  const orderedMarker = join(orderedRoot, 'slow-witness-must-not-start');
  const trace = join(orderedRoot, 'dispatch.jsonl');
  const orderedInventory = ['test-a-witness.mjs', 'test-z-fast.mjs'];
  const ordered = { schemaVersion: 1, source: orderedInventory, integration: [],
    scopes: { 'search-return-runtime': orderedInventory, 'manga-image-cache': [...orderedInventory].reverse() },
    scopePolicies: { 'search-return-runtime': { timeoutMs: 120_000, failFast: true, layers: [
      { id: 'fast', tests: ['test-z-fast.mjs'], proves: 'Real fast child runs first.', doesNotProve: 'No product or SDK execution.' },
      { id: 'shared-witness', tests: ['test-a-witness.mjs'], proves: 'Real witness runs last.', doesNotProve: 'No product or SDK execution.' },
    ] } } };
  writeFileSync(join(orderedRoot, 'tools/contract-test-tiers.json'), JSON.stringify(ordered));
  writeFileSync(join(orderedRoot, 'tools/test-z-fast.mjs'), `import {appendFileSync} from 'node:fs';appendFileSync(${JSON.stringify(trace)},'fast\\n');process.exit(7);`);
  writeFileSync(join(orderedRoot, 'tools/test-a-witness.mjs'), `import {appendFileSync,writeFileSync} from 'node:fs';appendFileSync(${JSON.stringify(trace)},'witness\\n');writeFileSync(${JSON.stringify(orderedMarker)},'unexpected');`);
  const feedbackOrder = ['test-z-fast.mjs', 'test-a-witness.mjs'];
  assert.deepEqual(contractTests(orderedRoot, 'full', 'search-return-runtime').selected, feedbackOrder);
  assert.deepEqual(contractTests(orderedRoot, 'full').selected, orderedInventory, 'full remains alphabetical');
  assert.deepEqual(contractTests(orderedRoot, 'full', 'manga-image-cache').selected, orderedInventory, 'manga remains alphabetical');
  let orderedFailure;
  try { await runContractsBounded(orderedRoot, 'full', 1, { scope: 'search-return-runtime', timeoutMs: 2_000 }); }
  catch (error) { orderedFailure = error; }
  logs.push(orderedFailure.report.logRoot);
  assert.deepEqual(orderedFailure.report.selected, feedbackOrder);
  assert.deepEqual(orderedFailure.report.results.map(row => row.name), ['test-z-fast.mjs']);
  assert.deepEqual(orderedFailure.report.unrun, ['test-a-witness.mjs']);
  assert.equal(readFileSync(trace, 'utf8'), 'fast\n'); assert.equal(existsSync(orderedMarker), false,
    'a fast-layer failure never starts the alphabetically earlier slow witness');
  writeFileSync(join(orderedRoot, 'tools/test-z-fast.mjs'), 'setTimeout(()=>process.exit(0),100);');
  const orderedPass = await runContractsBounded(orderedRoot, 'full', 2, { scope: 'search-return-runtime', timeoutMs: 2_000 }); logs.push(orderedPass.logRoot);
  assert.deepEqual(orderedPass.results.map(row => row.name), feedbackOrder,
    'receipts retain declared selection order even when the later witness settles first');
  // A separate finite scope covers the newly repaired return hot path. Its
  // real fixtures retain exact omissions and cannot acquire full acceptance.
  const returnRoot=join(root,'return-runtime');mkdirSync(join(returnRoot,'tools'),{recursive:true});
  const returnMarker=join(returnRoot,'later-ran'),returnInventory=['test-a-later.mjs','test-m-omitted.mjs','test-z-direct.mjs'];
  writeFileSync(join(returnRoot,'tools/test-z-direct.mjs'),'process.exit(7);');
  writeFileSync(join(returnRoot,'tools/test-a-later.mjs'),`import {writeFileSync} from 'node:fs';writeFileSync(${JSON.stringify(returnMarker)},'later');`);
  writeFileSync(join(returnRoot,'tools/test-m-omitted.mjs'),'process.exit(99);');
  const returnManifest={schemaVersion:1,source:returnInventory,integration:[],scopes:{'search-return-runtime':['test-a-later.mjs','test-z-direct.mjs']},
    scopePolicies:{'search-return-runtime':{timeoutMs:120000,failFast:true,layers:[
      {id:'direct',tests:['test-z-direct.mjs'],proves:'Runs the direct fixture first.',doesNotProve:'No native ICU or wall-time proof.'},
      {id:'owner',tests:['test-a-later.mjs'],proves:'Runs the remaining owner fixture.',doesNotProve:'No device or full-suite acceptance.'}]}}};
  writeFileSync(join(returnRoot,'tools/contract-test-tiers.json'),JSON.stringify(returnManifest));
  assert.equal(buildContractScope(new Map([['--contracts-scope','search-return-runtime']]),returnRoot),'search-return-runtime');
  assert.throws(()=>buildContractScope(new Map([['--class','acceptance'],['--contracts-scope','search-return-runtime']]),returnRoot),/only supported for iteration/);
  assert.deepEqual(localContractPlan(['--contracts-scope','search-return-runtime'],returnRoot).args,['tools/run-contract-tests.mjs','--scope','search-return-runtime']);
  assert.throws(()=>contractTests(returnRoot,'full','search-return-runtime-unknown'),/unknown contract scope/);
  assert.throws(()=>contractTests(returnRoot,'source','search-return-runtime'),/scope cannot replace the source tier/);
  const returnSelection=contractTests(returnRoot,'full','search-return-runtime');
  assert.deepEqual(returnSelection.selected,['test-z-direct.mjs','test-a-later.mjs']);
  assert.deepEqual(returnSelection.omitted,['test-m-omitted.mjs']);assert.deepEqual(returnSelection.inventory,returnInventory);
  assert.equal(returnSelection.scopePolicy.timeoutMs,120000);
  assert.ok(remainingContractBudget(performance.now()-90000,1000,120000)>28000,'the return scope consumes its own declared total budget');
  for(const [change,expected]of[
    [m=>{delete m.scopePolicies['search-return-runtime'];},/search-return-runtime requires its declared scope policy/],
    [m=>{m.scopePolicies['search-return-runtime'].failFast=false;},/search-return-runtime requires fail-fast/],
    [m=>{m.scopePolicies['search-return-runtime'].timeoutMs=180001;},/deadline cannot exceed 180 seconds/],
    [m=>{m.scopePolicies['search-return-runtime'].layers.pop();},/every scoped test must have one evidence layer/],
  ]){const invalid=structuredClone(returnManifest);change(invalid);assert.throws(()=>contractSelection(invalid,returnInventory,'full','search-return-runtime'),expected);}
  await assert.rejects(runContractsBounded(returnRoot,'full',1,{scope:'search-return-runtime',scopeTimeoutMs:120001}),/invalid scope deadline/);
  let returnFailure;try{await runContractsBounded(returnRoot,'full',1,{scope:'search-return-runtime',timeoutMs:2000});}catch(error){returnFailure=error;}
  assert.match(returnFailure?.message??'',/test-z-direct.mjs failed \(7\)/);logs.push(returnFailure.report.logRoot);
  assert.equal(returnFailure.report.failFast,true);assert.equal(returnFailure.report.failureStopped,true);
  assert.deepEqual(returnFailure.report.results.map(row=>row.name),['test-z-direct.mjs']);assert.deepEqual(returnFailure.report.unrun,['test-a-later.mjs']);
  assert.deepEqual(returnFailure.report.omitted,['test-m-omitted.mjs']);assert.equal(existsSync(returnMarker),false);
  assert.equal(returnFailure.report.treeSettled,true);assert.equal(returnFailure.report.scopeTimeoutMs,120000);
  const returnPersisted=JSON.parse(readFileSync(join(returnFailure.report.logRoot,'results.json'),'utf8'));
  assert.deepEqual(returnPersisted.unrun,returnFailure.report.unrun);assert.deepEqual(returnPersisted.evidenceLayers,returnManifest.scopePolicies['search-return-runtime'].layers);
  writeFileSync(join(returnRoot,'tools/test-z-direct.mjs'),'process.exit(0);');
  const returnPass=await runContractsBounded(returnRoot,'full',1,{scope:'search-return-runtime',timeoutMs:2000});logs.push(returnPass.logRoot);
  assert.deepEqual(returnPass.results.map(row=>row.name),returnSelection.selected);assert.deepEqual(returnPass.omitted,['test-m-omitted.mjs']);
  assert.deepEqual(returnPass.unrun,[]);assert.equal(returnPass.selectedStatus,'PASS');assert.equal(returnPass.harmonyContracts,'PARTIAL');
  assert.equal(returnPass.fullSuite,'NOT_RUN');assert.equal(returnPass.acceptanceEligible,false);
  console.log('PASS separate search-return-runtime: strict named 120s policy, <=180s ceiling, direct-first execution, omitted inventory, fail-fast/unrun, PARTIAL receipts and acceptance/unknown/source-tier rejection');
  console.log('PASS named development scope: declared 120s budget, fail-fast/unrun receipts, evidence boundaries, invalid scope rejection and unchanged full fixture dispatch');
} finally {
  for (const log of logs) rmSync(log, { recursive: true, force: true });
  rmSync(root, { recursive: true, force: true });
}
