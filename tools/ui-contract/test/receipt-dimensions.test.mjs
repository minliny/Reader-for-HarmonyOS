import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, posix, relative } from 'node:path';
import test from 'node:test';
import { checkPageComposition } from '../../page-structure/check-register.mjs';
import { digest, loadInputs, root as checkout } from '../../page-structure/lib.mjs';
import { resolveStructureBindings, structureRuleOrder } from '../lib/structure-contract.mjs';
import { structureBindingSha256 } from '../lib/receipt-structure.mjs';
import { deriveReceiptDimensions, replayReceiptWithDimensions } from '../diagnostics/receipt-dimensions.mjs';
import { loadCase, replayToolFiles, toolIdentity } from '../lib/cases.mjs';
import { evidenceStore, jsonDigest, sha256 } from '../lib/evidence.mjs';
import { replayReceipt, sealReceipt, summarizeAcceptance } from '../lib/receipt.mjs';

const state = {
  role:'main', sampleId:'main-sample', ruleId:'main-rule', verdict:'FAIL', observationsComplete:false,
  checks:[{ruleId:'main-rule', verdict:'FAIL', observationsComplete:false}],
};
const contract = {
  id:'synthetic-mixed', pageId:'synthetic-unregistered-page', phase:1, structure:{main:state.sampleId},
  assertions:[
    {id:'route', evaluator:'motion', kind:'control-open'},
    {id:'gap', evaluator:'search', kind:'phase-relative'},
    {id:'motion', evaluator:'motion', kind:'motion-open'},
    {id:'text', evaluator:'source', kind:'surface-text', condition:'conditional-text', required:false},
    {id:'semantics', evaluator:'source', kind:'source-native-semantics', required:false},
  ],
};

function receiptFor(definition, verdicts, details = {}) {
  return {
    caseId:definition.id, caseSha256:jsonDigest(definition),
    page:{id:definition.pageId, registration:'UNREGISTERED_PAGE'},
    assertions:Object.entries(verdicts).map(([id, verdict]) => ({id, verdict})), ...details,
  };
}

const derive = (receipt, options = {}) => deriveReceiptDimensions({contract, receipt, ...options});

test('维度不继承全局 verdict，且只消费本维度的断言和结构规则', () => {
  const structure = {observations:'INCOMPLETE', behavior:'FAIL', states:[state]};
  const receipt = receiptFor(contract, {route:'PASS', gap:'FAIL', motion:'NOT_RUN', text:'NOT_RUN', semantics:'PASS'}, {
    structure, conditions:{text:{status:'DOES_NOT_APPLY', required:false}},
  });
  Object.assign(receipt, summarizeAcceptance({...receipt, observationsComplete:false}));
  assert.deepEqual(derive(receipt), {
    behavior:'PASS', layout:'FAIL', motion:'INCOMPLETE', text:'NOT_RUN', accessibility:'PASS', structure:'FAIL', page:'NOT_RUN',
  });
  assert.equal(receipt.behavior, 'FAIL');
  assert.equal(receipt.execution, 'INCOMPLETE');
  const completeStructure = {observations:'COMPLETE', behavior:'PASS', states:[{
    ...state, verdict:'PASS', observationsComplete:true, checks:[{ruleId:state.ruleId, verdict:'PASS', observationsComplete:true}],
  }]};
  const isolated = derive(receiptFor(contract, {route:'FAIL', gap:'PASS', motion:'PASS'}, {structure:completeStructure}));
  assert.equal(isolated.behavior, 'FAIL');
  assert.equal(isolated.structure, 'PASS');
  assert.equal(isolated.layout, 'PASS');
  assert.equal(isolated.motion, 'PASS');
});

test('已选缺证是 INCOMPLETE，未选、不支持、可选缺证或确认不适用是 NOT_RUN', () => {
  const allNotRun = Object.fromEntries(Object.keys(derive()).map(key => [key, 'NOT_RUN']));
  const pending = derive(undefined, {selected:true});
  assert.equal(pending.behavior, 'INCOMPLETE');
  assert.equal(pending.structure, 'INCOMPLETE');
  assert.equal(pending.accessibility, 'NOT_RUN');
  const receipt = receiptFor(contract, {route:'FAIL', text:'PASS', semantics:'NOT_RUN'}, {
    conditions:{text:{status:'UNKNOWN', required:true}},
  });
  assert.deepEqual(derive(receipt, {selected:false}), allNotRun);
  assert.deepEqual(derive(receipt, {platform:'ios'}), allNotRun);
  assert.deepEqual(derive(receipt, {platform:'android'}), allNotRun);
  assert.equal(derive(receipt).text, 'INCOMPLETE');
  assert.equal(derive(receipt).accessibility, 'NOT_RUN');
  receipt.assertions.find(item => item.id === 'text').verdict = 'FAIL';
  assert.equal(derive(receipt).text, 'FAIL');
  assert.throws(() => derive({...receipt, caseSha256:'unrelated'}), /exact receipt case/);
});

test('结构条件只排除目标规则：不能吞掉基础规则失败或造成空 PASS', () => {
  const target = {ruleId:state.ruleId, verdict:'NOT_RUN', observationsComplete:false};
  const foundation = {ruleId:'foundation', verdict:'FAIL', observationsComplete:false};
  const receipt = receiptFor(contract, {}, {
    structure:{states:[{...state, conditionId:'text', checks:[foundation, target]}]},
    conditions:{text:{status:'DOES_NOT_APPLY', required:false}},
  });
  assert.equal(derive(receipt).structure, 'FAIL');
  foundation.verdict = 'NOT_RUN';
  assert.equal(derive(receipt).structure, 'INCOMPLETE');
  foundation.verdict = 'PASS';
  foundation.observationsComplete = true;
  assert.equal(derive(receipt).structure, 'PASS');
  receipt.structure.states[0].checks = [target];
  assert.equal(derive(receipt).structure, 'NOT_RUN');
  receipt.conditions.text = {status:'APPLIES', required:true, sampleApplies:false};
  assert.equal(derive(receipt).structure, 'INCOMPLETE');
});

test('用例 PASS 不会创建页面 PASS，也不会覆盖既有登记失败', () => {
  const definition = {...contract, pageId:'source-management'};
  const receipt = receiptFor(definition, {route:'PASS', gap:'PASS', motion:'PASS'}, {
    page:{id:definition.pageId, registration:'REGISTERED_PAGE'},
    behavior:'PASS', execution:'PASS', observations:'COMPLETE',
  });
  assert.equal(derive(receipt, {contract:definition}).page, 'FAIL');
  receipt.page.registration = 'UNREGISTERED_PAGE';
  assert.equal(derive(receipt, {contract:definition}).page, 'NOT_RUN');
});

function compositionFixture(t) {
  const inputs = loadInputs();
  const page = inputs.register.pages.find(item => item.pageId === 'source-management');
  delete page.variants;
  delete page.layoutEvidence;
  delete page.layers.visual.facts.designContractRef;
  const definition = loadCase('source-management.layout-font-default');
  page.sourceInputs = page.sourceInputs.filter(({path}) => definition.ownerSources.includes(path));
  const files = [page.source, ...page.sourceInputs];
  const ownerSources = files.map(({path}) => path).filter(path => definition.ownerSources.includes(path));
  assert.ok(ownerSources.length);
  for (const file of files) file.sha256 = digest(file.path);
  const claims = ['layers.header', 'layers.content', 'invariants.S1'];
  for (const [id, record] of Object.entries(page.layers)) {
    record.applicability = claims.includes(`layers.${id}`) ? 'applicable' : 'not_applicable';
    record.result = record.applicability === 'applicable' ? 'PASS' : 'NOT_RUN';
  }
  inputs.register.pages = [page];
  inputs.model.invariants = inputs.model.invariants.filter(({id}) => id === 'S1');
  page.invariants = {S1:{result:'PASS', evidence:[]}};
  const assertions = definition.assertions.filter(item => item.required && item.sample === 'source-ready');
  assert.ok(assertions.length >= claims.length);
  inputs.model.receiptAdmissions = claims.map((claim, index) => ({
    pageId:page.pageId, routeContractRef:page.routeContractRef, claim, caseId:definition.id, ownerSources,
    assertions:[{id:assertions[index].id, sampleId:assertions[index].sample}],
  }));

  const directory = mkdtempSync(join(checkout, 'tools/ui-contract/test/.page-composition-'));
  t.after(() => rmSync(directory, {recursive:true, force:true}));
  const tool = join(directory, 'frozen');
  const bundle = join(directory, 'bundle');
  const write = (root, path, value) => {
    const absolute = join(root, path);
    mkdirSync(dirname(absolute), {recursive:true});
    writeFileSync(absolute, value);
    return {path, bytes:Buffer.byteLength(value), sha256:sha256(value)};
  };
  const json = (root, path, value) => write(root, path, `${JSON.stringify(value)}\n`);
  const toolFiles = [
    json(tool, 'tools/page-structure/model.json', inputs.model),
    json(tool, 'tools/page-structure/register.json', inputs.register),
    write(tool, 'tools/ui-contract/cli.mjs', `
      import { appendFileSync, readFileSync } from 'node:fs';
      import { createHash } from 'node:crypto';
      const [, , caseFlag, id, replayFlag, path, rootFlag, expected] = process.argv;
      const bytes = readFileSync(path);
      const receipt = JSON.parse(bytes);
      if (caseFlag !== '--case' || id !== receipt.caseId || replayFlag !== '--replay' ||
          rootFlag !== '--expected-root' || createHash('sha256').update(bytes).digest('hex') !== expected) process.exit(2);
      appendFileSync(path + '.calls', 'replay\\n');
      process.stdout.write(JSON.stringify({receipt, rootSha256:expected}));
    `),
  ];
  const toolSha256 = jsonDigest(toolFiles.map(({path, sha256}) => ({path:posix.relative('tools/ui-contract', path), sha256}))
    .sort((left, right) => left.path < right.path ? -1 : 1));
  json(tool, 'tool-identity.json', {version:'phase1.0', sha256:toolSha256});
  const candidate = {appBuildId:'synthetic', hapSha256:'a'.repeat(64), sourceFingerprint:'b'.repeat(64), targetRef:'123456789abc'};
  const screenshot = write(bundle, 'raw/sample.png', 'synthetic screenshot');
  const layout = json(bundle, 'raw/sample.json', {});
  const commands = write(bundle, 'session/commands.ndjson', '\n');
  const session = json(bundle, 'session/session.json', {commands, chain:[{entry:{kind:'sample', id:'source-ready', screenshot, layout}}]});
  const refs = [screenshot, layout, commands, session];
  const rules = new Map(inputs.model.structureRules.map(rule => [rule.id, rule]));
  const states = resolveStructureBindings(definition, inputs.model).map(({role, sampleId, actionId, conditionId, rule}) => ({
    role, sampleId, actionId, conditionId, ruleId:rule.id, verdict:'PASS', observationsComplete:true,
    checks:structureRuleOrder(rule.id, rules).map(item => ({
      ruleId:item.id, requiredRuleIds:item.requires, verdict:'PASS', observationsComplete:true, evidenceRefs:refs,
    })),
  }));
  const receipt = {
    caseId:definition.id, caseSha256:jsonDigest(definition), page:{id:page.pageId, registration:'REGISTERED_PAGE'},
    case:json(bundle, 'case.json', definition), tool:{sha256:toolSha256}, session,
    candidate:{identity:candidate, snapshot:json(bundle, 'snapshot.json', {files})},
    execution:'PASS', behavior:'PASS', observations:'COMPLETE',
    structure:{behavior:'PASS', observations:'COMPLETE', states, bindingSha256:structureBindingSha256(definition, inputs.model)},
    assertions:assertions.map(({id, sample}) => ({id, actual:{sampleId:sample}, verdict:'PASS', evidenceRefs:refs})),
    measurement:{sampleWindows:{'source-ready':{widthPx:366}}},
  };
  const {sha256:rootSha256} = json(bundle, 'receipt.json', receipt);
  const evidence = {kind:'device', result:'PASS', symbol:'ui-contract-receipt', rootSha256, toolSha256, candidate,
    path:relative(checkout, join(bundle, 'receipt.json')), toolPath:relative(checkout, tool)};
  for (const claim of claims) {
    const [scope, id] = claim.split('.');
    page[scope][id].evidence = [structuredClone(evidence)];
  }
  return {inputs, page, selection:{receipt:JSON.parse(JSON.stringify(receipt)), rootSha256},
    calls:join(bundle, 'receipt.json.calls'), claims};
}

test('页面组合仅放行已有的同根登记：每个适用声明恰好准入一次', t => {
  const {inputs, selection, calls, claims} = compositionFixture(t);
  assert.deepEqual(checkPageComposition(selection, inputs), {verdict:'PASS', diagnostics:[]});
  assert.equal(readFileSync(calls, 'utf8'), 'replay\n'.repeat(claims.length));
});

test('页面组合拒绝跨候选、跨状态、重复和缺失证据，保留结构失败', t => {
  const {inputs, page, selection} = compositionFixture(t);
  const record = page.layers.header;
  const [original] = record.evidence;
  const compose = () => checkPageComposition(selection, inputs);
  for (const [key, value] of Object.entries({appBuildId:'different', hapSha256:'c'.repeat(64),
    sourceFingerprint:'c'.repeat(64), targetRef:'abcdef123456'})) {
    record.evidence = [{...original, candidate:{...original.candidate, [key]:value}}];
    const rejected = compose();
    assert.equal(rejected.verdict, 'FAIL', key);
    assert.match(rejected.diagnostics[0].message, /candidate/u);
  }
  record.evidence = [{...original, rootSha256:'d'.repeat(64)}];
  assert.equal(compose().verdict, 'INCOMPLETE');
  record.evidence = [original, structuredClone(original)];
  assert.equal(compose().verdict, 'INCOMPLETE');
  record.evidence = [{...original, symbol:'normal-page'}, {...original, symbol:'ui-contract-receipt-group'}];
  assert.equal(compose().verdict, 'INCOMPLETE');
  record.evidence = [original];
  const structure = selection.receipt.structure;
  const changedState = structuredClone(structure);
  changedState.states[0].sampleId = 'other-state';
  selection.receipt.structure = changedState;
  const rejected = compose();
  assert.equal(rejected.verdict, 'FAIL');
  assert.match(rejected.diagnostics[0].message, /Frozen replay or current case differs/u);
  changedState.states[0].checks[0].verdict = 'FAIL';
  assert.equal(compose().verdict, 'FAIL');
  delete selection.receipt.structure;
  assert.equal(compose().verdict, 'INCOMPLETE');
  selection.receipt.structure = structure;
  page.invariants.S1.result = 'NOT_RUN';
  assert.equal(compose().verdict, 'INCOMPLETE');
  page.invariants.S1.result = 'FAIL';
  assert.equal(compose().verdict, 'FAIL');
});

test('诊断模块不进入工具指纹，派生回放不改变已封存字节或原回放结果', t => {
  assert.ok(!replayToolFiles().includes('diagnostics/receipt-dimensions.mjs'));
  const root = mkdtempSync(join(tmpdir(), 'reader-receipt-dimensions-'));
  t.after(() => rmSync(root, {recursive:true, force:true}));
  const definition = loadCase('bookshelf.search-input-ime');
  const store = evidenceStore(root);
  const ownerSources = {};
  const files = [...definition.ownerSources].sort().map((path, index) => {
    const content = Buffer.from(`synthetic owner ${index}\n`);
    const ref = store.write(`candidate/owner/${path}`, content);
    ownerSources[path] = ref;
    return {path, type:'file', mode:0o644, bytes:content.length, sha256:ref.sha256};
  });
  const fingerprint = sha256(files.map(file => `${JSON.stringify(file)}\n`).join(''));
  const appVersion = {schema:'reader-app-build-v1', versionName:'0.2.0', versionCode:1000000, channel:'DEV',
    contentId:'a'.repeat(12), appContentHash:'a'.repeat(64), appBuildId:`0.2.0.DEV.${'a'.repeat(12)}`};
  const hapSha256 = 'b'.repeat(64);
  const targetRef = '123456789abc', hdcServer = '127.0.0.1:8710', completedAt = '2026-11-19T06:00:00Z';
  const refs = {
    ownerSources,
    manifest:store.writeJson('candidate/manifest.json', {schemaVersion:2, name:'synthetic', abi:'x86_64', runId:'synthetic',
      artifacts:[{kind:'signed', path:'synthetic.hap', sha256:hapSha256, signature:{verified:true}}],
      source:{buildInputs:{snapshot:'source-snapshot.json', fileCount:files.length, fingerprint}}, expectedVersion:appVersion}),
    deployment:store.writeJson('candidate/deployment.json', {runId:'synthetic', dataPolicy:'preserve', targetKind:'vm', hdcServer,
      install:'PASS', launch:'PASS', appVersionCheck:'PASS', artifact:{kind:'signed', sha256:hapSha256}, targetRef, completedAt,
      postInstall:{bundlePresent:true, bundleName:'io.reader.minliny', appVersion, cpuAbi:'x86_64', appProvisionType:'debug',
        appIdSha256:'c'.repeat(64), appIdentifierSha256:'d'.repeat(64), updateTime:1795068000000}}),
    snapshot:store.write('candidate/source-snapshot.json', `${JSON.stringify({schemaVersion:1, fingerprint, files})}\n`),
  };
  const fixture = store.writeJson('session/fixture.json', {schema:'reader-ui-public-fixture-v1', caseId:definition.id,
    fixtureId:definition.fixture.id, targetRef, hdcServer, vmName:'Synthetic fixture with no target', checkedAt:completedAt,
    publicBooks:true, publicHistory:true, publicImeCandidates:true, developerMode:true, noPersonalData:true,
    directRoute:Object.fromEntries(['clientToServer', 'serverToTarget'].map(leg =>
      [leg, {direct:true, socketObservation:'Synthetic socket', routeObservation:'Synthetic route'}]))});
  const session = {runId:'synthetic-incomplete', platform:'harmonyos', instanceId:null, result:'INCOMPLETE', reason:'Synthetic fixture',
    commands:store.write('session/commands.ndjson', '\n'), fixture, chain:[]};
  const sessionRef = store.writeJson('session/session.json', session);
  const sealed = sealReceipt({store, refs, session, sessionRef}, definition);
  const receiptPath = join(root, 'receipt.json');
  const before = readFileSync(receiptPath);
  const options = {contract:definition, receiptPath, expectedRoot:sealed.rootSha256};
  assert.deepEqual(toolIdentity(), sealed.receipt.tool, '测试期间回放工具的指纹必须保持稳定');
  const canonical = replayReceipt(options);
  const derived = replayReceiptWithDimensions(options);
  assert.deepEqual(derived.receipt, canonical.receipt);
  assert.equal(derived.rootSha256, canonical.rootSha256);
  assert.equal(derived.rootSha256, sha256(before));
  assert.deepEqual(readFileSync(receiptPath), before);
  assert.equal(derived.dimensions.behavior, 'INCOMPLETE');
  assert.equal(derived.dimensions.structure, 'NOT_RUN');
  assert.throws(() => replayReceiptWithDimensions({...options, expectedRoot:'0'.repeat(64)}), /sealed handoff root/);
});
