import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { compareOfflineCaptureFields, planCapture } from '../lib/capture-plan.mjs';
import { platformCapabilities, replayToolFiles } from '../lib/cases.mjs';
import { compareAuditedCaptureFields } from '../diagnostics/capture-field-projection.mjs';
import { jsonDigest } from '../lib/evidence.mjs';
import { normalizeHarmonyLayout } from '../lib/layout.mjs';

const harmony = platformCapabilities('harmonyos');
const contract = {
  phase: 1,
  steps: [
    {id:'before', kind:'locate', anchors:['open']},
    {id:'open', kind:'action', op:'click', from:'before', target:'open'},
    {id:'after', kind:'sample', afterAction:'open', anchors:['panel']},
  ],
  assertions: [{id:'gap', evaluator:'layout', kind:'gap', a:'panel', b:'open', axis:'x',
    expected:0, sample:'after', sources:['native-tree', 'window-metrics']}],
};
const structure = {
  selectors: {other:{prefix:'forbidden-'}, panel:{ids:['panel']}, host:{ids:['host']}},
  bindings: [{role:'opened', sampleId:'after', rules:[
    {id:'foundation', checks:[{kind:'absent', node:'other'}, {kind:'inFrontOf', node:'panel', behind:'other', optionalBehind:true}]},
    {id:'open', checks:[{kind:'backgroundAlpha', node:'panel', min:1, max:1}]},
  ]}],
};

function dryRun(id, platform = 'harmonyos') {
  const cli = fileURLToPath(new URL('../cli.mjs', import.meta.url));
  return JSON.parse(execFileSync(process.execPath, [cli, '--case', id, '--dry-run', '--platform', platform], {encoding:'utf8'}));
}

test('纯字段计划保留前置结构、整棵树、窗口、会话与正式样本截图', () => {
  const input = JSON.stringify([contract, harmony, structure]);
  const plan = planCapture(contract, harmony, structure);
  assert.equal(JSON.stringify([contract, harmony, structure]), input);
  assert.deepEqual(planCapture(contract, harmony, structure), plan);
  assert.equal(plan.mode, 'FIELD_PLAN_ONLY');
  assert.equal(plan.execution, 'NOT_RUN');
  assert.equal(plan.collection, 'UNCHANGED');
  assert.deepEqual(plan.requiredCapabilities, ['app-owner', 'native-tree', 'window-metrics']);
  assert.deepEqual(plan.nativeTree, {scope:'ALL_NODES', fieldScope:'NORMALIZED_NODE', fields:[
    'alias', 'backgroundAlpha', 'clickable', 'enabled', 'focused', 'id', 'key', 'opacity', 'parentPath',
    'path', 'rectPx', 'source', 'type', 'visible', 'visibleRectPx', 'zIndex',
  ]});
  assert.deepEqual(plan.preserve, {windowMetrics:'FULL', sessionAndCausality:'FULL', negativeProof:'FULL_TREE', screenshotSamples:['after']});
  assert.deepEqual(plan.deviceValidation, {nativeCaptureReduction:'UNVALIDATED', speedup:'UNVALIDATED', requiresSeparateAuthorization:true});
});

const submit = 'reader-bookshelf-search-submit';
const pilotContract = {
  phase:1,
  steps:[{id:'stable', kind:'sample', anchors:['panel', submit]}],
  assertions:[{...contract.assertions[0], sample:'stable', b:submit, expected:3}],
};
const pilotStructure = {
  selectors:{...structure.selectors, submit:{ids:[submit]}},
  bindings:[{role:'stable', sampleId:'stable', actionId:null, rules:[
    {id:'absence', checks:[{kind:'absent', node:'other'}]},
    {id:'panel', checks:[{kind:'inFrontOf', node:'panel', behind:'submit'},
      {kind:'backgroundAlpha', node:'panel', min:1, max:1}, {kind:'enabled', node:'submit', value:true}]},
  ]}],
};

function pilotFixture() {
  const node = (id, bounds, extra, children = []) => ({attributes:{id, bounds, origBounds:bounds,
    hostWindowId:'42', type:'Column', visible:'true', opacity:'1', enabled:'true',
    clip:'false', selected:'false', hitTestBehavior:'HitTestMode.Default', ...extra}, children});
  const tree = {attributes:{bounds:'[0,0][300,500]'}, children:[
    node('host', '[20,40][220,440]', {type:'root', bundleName:'io.reader.minliny', abilityName:'EntryAbility',
      pagePath:'pages/Index'}, [
      node('panel', '[20,80][60,120]', {zIndex:'2', backgroundColor:'#ff112233', clip:'true'}),
      node(submit, '[66,80][106,120]', {type:'Button', zIndex:'1', description:'搜索', selected:'true', clickable:'true'}),
      node('hidden-host', '[20,120][100,200]', {visible:'false'}, [
        node('forbidden-copy', '[30,130][60,160]', {hitTestBehavior:'HitTestMode.None'}),
      ]),
    ]),
  ]};
  const report = {windowId:'42', vpPixels:2, metrics:{ready:true, revision:8, densityPixels:2,
    windowRect:{left:0, top:0, width:100, height:200}, globalRect:{left:10, top:20, width:100, height:200},
    keyboardArea:{available:true, visible:false, revision:8, rects:[]},
    keyboardInsets:{left:0, top:0, right:0, bottom:0}}};
  const raw = Object.fromEntries(Object.entries({tree, report}).map(([name, value]) =>
    [name, Buffer.from(`${JSON.stringify(value, null, 2)}\n`)]));
  const evidenceRefs = Object.entries(raw).map(([name, bytes]) => ({path:`fixture/${name}.json`, bytes:bytes.length,
    sha256:createHash('sha256').update(bytes).digest('hex')}));
  // 合成夹具声明采样完整；不作为设备、截图或回执准入的证明。
  const sample = {...normalizeHarmonyLayout({tree:JSON.parse(raw.tree), report:JSON.parse(raw.report),
    sampleId:'stable', state:'stable', instanceId:'offline-fixture', evidenceRefs}),
  captureComplete:true, beforeSeq:10, afterSeq:12};
  return {raw, sample};
}

const pilot = {contract:pilotContract, capabilities:harmony, structure:pilotStructure};

test('离线试点对照完整与字段投影结果，逐节点报告缺字段且原始字节不变', () => {
  const {raw, sample} = pilotFixture();
  const originalBytes = Object.fromEntries(Object.entries(raw).map(([name, bytes]) => [name, Buffer.from(bytes)]));
  const originalSample = structuredClone(sample);
  const result = compareOfflineCaptureFields({...pilot, sample});
  assert.equal(result.sampleId, 'stable');
  assert.equal(result.collection, 'UNCHANGED');
  assert.equal(result.comparison, 'MATCH');
  assert.deepEqual(result.fallbackReasons, []);
  assert.deepEqual(result.full, result.projected);
  assert.deepEqual(raw, originalBytes);
  assert.deepEqual(sample, originalSample);

  const common = ['clip', 'hitTestMode', 'selected'];
  assert.deepEqual(result.missingFields, [
    {path:'0', fields:common}, {path:'0/0', fields:common},
    {path:'0/1', fields:['clip', 'hitTestMode', 'searchSemantic', 'selected']},
    {path:'0/2', fields:common}, {path:'0/2/0', fields:common},
  ]);
  assert.equal(sample.nodes[1].clip, true);
  assert.equal(sample.nodes[2].selected, true);
  assert.equal(sample.nodes[2].searchSemantic, 'search');
  assert.equal(sample.nodes[4].hitTestMode, 'HitTestMode.None');

  const [gap] = result.projected.layout;
  assert.equal(gap.verdict, 'PASS');
  assert.deepEqual(gap.actual, {valueVp:3, axis:'x', toleranceVp:0});
  for (const check of [gap, ...result.projected.structure]) assert.deepEqual(check.evidenceRefs, sample.evidenceRefs);
  const [absence, panel] = result.projected.structure;
  assert.equal(absence.verdict, 'PASS');
  assert.equal(panel.verdict, 'PASS');
  assert.equal(panel.observationsComplete, true);
  const [order, paint, enabled] = panel.actual.checks;
  assert.deepEqual([order.actual.front.zIndex, order.actual.behind.zIndex], [2, 1]);
  assert.equal(paint.actual.value, 1);
  assert.equal(enabled.actual.value, true);
});

test('同一夹具的负向证明保留隐藏子树，并区分可见、未知和不完整', () => {
  const {sample} = pilotFixture();
  for (const [visible, verdict] of [[false, 'PASS'], [true, 'FAIL'], [null, 'NOT_RUN']]) {
    const nodes = sample.nodes.map(node => node.id === 'hidden-host' ? {...node, visible} : node);
    const result = compareOfflineCaptureFields({...pilot, sample:{...sample, nodes}});
    assert.equal(result.comparison, 'MATCH');
    assert.deepEqual(result.full, result.projected);
    const [absence] = result.projected.structure;
    assert.equal(absence.verdict, verdict);
    assert.equal(absence.observationsComplete, visible !== null);
    assert.deepEqual(absence.actual.checks[0].actual, [{path:'0/2/0', id:'forbidden-copy',
      bounds:{left:30, top:130, width:30, height:30}, visible, opacity:visible === null ? null : Number(visible)}]);
  }
  const incomplete = compareOfflineCaptureFields({...pilot, sample:{...sample, captureComplete:false}});
  assert.equal(incomplete.comparison, 'MATCH');
  assert.equal(incomplete.projected.structure[0].verdict, 'NOT_RUN');
  assert.equal(incomplete.projected.structure[0].observationsComplete, false);
});

test('离线试点显式回退且不返回投影：不支持的平台、断言和跨样本依赖', () => {
  const {sample} = pilotFixture();
  const variants = [
    [{...pilot, capabilities:platformCapabilities('ios')}, 'UNSUPPORTED',
      ['capability:app-owner', 'capability:native-tree', 'capability:window-metrics']],
    [{...pilot, contract:{...pilotContract, assertions:[{...pilotContract.assertions[0], kind:'clip'}]}},
      'FULL_CAPTURE', ['assertion:gap']],
    [{...pilot, contract:{...pilotContract, assertions:[{...pilotContract.assertions[0], baseline:'before'}]}},
      'FULL_CAPTURE', ['pilot:single-independent-sample-required']],
  ];
  for (const [input, mode, fallbackReasons] of variants) {
    assert.deepEqual(compareOfflineCaptureFields({...input, sample}), {
      sampleId:'stable', collection:'UNCHANGED', mode, comparison:'NOT_RUN', fallbackReasons,
    });
  }
});

test('未覆盖的能力、断言、步骤、结构或条件均保守回退', () => {
  const variants = [
    [{...contract, assertions:[{...contract.assertions[0], sources:['future-source']}]}, structure, 'capability:future-source'],
    [{...contract, assertions:[{...contract.assertions[0], kind:'clip'}]}, structure, 'assertion:gap'],
    [{...contract, steps:[...contract.steps, {id:'ime', kind:'action', op:'keyEvent'}]}, structure, 'step:ime'],
    [contract, undefined, 'structure:missing-bindings'],
    [contract, {...structure, bindings:structure.bindings.map(binding => ({...binding, conditionId:'maybe'}))}, 'structure:opened'],
    [contract, {...structure, selectors:{...structure.selectors, panel:{under:'host', role:'scrim'}}}, 'selector:panel'],
    [contract, {...structure, bindings:[{role:'opened', rules:[{id:'open', checks:[{kind:'future-check', node:'panel'}]}]}]},
      'structure:open/future-check'],
  ];
  for (const [input, bindings, reason] of variants) {
    const plan = planCapture(input, harmony, bindings);
    assert.equal(plan.mode, 'FULL_CAPTURE', reason);
    assert.equal(plan.nativeTree.fields, 'ALL');
    assert.ok(plan.fallbackReasons.includes(reason));
    assert.deepEqual(plan.preserve.screenshotSamples, ['after']);
  }
});

test('真实显式 dry-run 只扩展报告，不改变用例摘要、步骤与断言', () => {
  const id = 'source-management.layout-filter';
  const original = JSON.parse(readFileSync(new URL(`../cases/${id}.json`, import.meta.url), 'utf8'));
  const report = dryRun(id);
  assert.equal(report.mode, 'DRY_RUN');
  assert.equal(report.execution, 'NOT_RUN');
  assert.equal(report.caseSha256, jsonDigest(original));
  assert.deepEqual(report.steps, original.steps);
  assert.deepEqual(report.assertions, original.assertions.map(assertion => ({...assertion, verdict:'NOT_RUN'})));
  assert.equal(report.capturePlan.mode, 'FULL_CAPTURE');
  assert.deepEqual(report.capturePlan.preserve.screenshotSamples, original.steps.filter(step => step.kind === 'sample').map(step => step.id));
});

test('未支持平台不派发动作，保留现有原生输入提示', () => {
  const report = dryRun('reading.control-grabber-reversal', 'ios');
  assert.equal(report.capturePlan.mode, 'UNSUPPORTED');
  assert.equal(report.capturePlan.nativeTree.fields, 'ALL');
  assert.equal(report.capabilities['native-tree'].status, 'UNSUPPORTED');
  assert.equal(report.nativeInput.op, 'grabberReversal');
  assert.equal(report.nativeInput.execution, 'NOT_RUN');
});

const defaultAuditDir = fileURLToPath(new URL(
  '../../../../../../evidence/reader-ui-verification-plan-20261119/implementation/phase-1/', import.meta.url));
const auditDir = process.env.READER_D_AUDIT_DIR ?? defaultAuditDir;
const auditOptions = {
  receiptPath:join(auditDir, 'source-empty-library-new-guest/receipt.json'),
  frozenToolRoot:join(auditDir, 'isolated-public-source-replay-tool'),
};
const skipAudit = !process.env.READER_D_AUDIT_DIR && !existsSync(auditOptions.receiptPath) && '原审计证据不在此工作区';

function assertUnverifiedFallback(result, reason) {
  assert.equal(result.diagnosticOnly, true);
  assert.equal(result.collection, 'UNCHANGED');
  assert.equal(result.mode, 'FULL_CAPTURE');
  assert.equal(result.proofValidation, 'NOT_VERIFIED');
  assert.equal(result.comparison, 'NOT_RUN');
  assert.equal(result.actionReplay, 'NOT_RUN');
  assert.equal(result.caseReplay, 'NOT_RUN');
  assert.match(result.fallbackReasons[0], reason);
  for (const key of ['waitActionContext', 'projection', 'caseBinding', 'sourceSession', 'sourceSample']) {
    assert.ok(!Object.hasOwn(result, key), key);
  }
}

test('D：没有原始证明时不得返回投影或只读动作上下文', async () => {
  assert.ok(!replayToolFiles().includes('diagnostics/capture-field-projection.mjs'));
  assertUnverifiedFallback(await compareAuditedCaptureFields(), /path/u);
});

test('D：真实 source-empty-library-new-guest 只投影 source-ready 的 footer 断言', {skip:skipAudit}, async () => {
  const bytes = readFileSync(auditOptions.receiptPath);
  const original = JSON.parse(bytes);
  const folder = join(auditDir, 'source-empty-library-new-guest');
  const session = JSON.parse(readFileSync(join(folder, original.session.path)));
  const contract = JSON.parse(readFileSync(join(folder, original.case.path)));
  const findLink = id => session.chain.find(({entry}) => entry.id === id);
  const sourceLink = findLink('source-ready');
  const actionLink = findLink('open-sources');
  const dry = dryRun(contract.id);
  assert.equal(dry.capturePlan.mode, 'FULL_CAPTURE');
  assert.ok(dry.capturePlan.fallbackReasons.includes('step:source-ready'));
  const result = await compareAuditedCaptureFields(auditOptions);
  assert.equal(result.diagnosticOnly, true);
  assert.equal(result.mode, 'POST_VALIDATION_FIELD_PROJECTION', result.fallbackReasons.join('; '));
  assert.equal(result.proofValidation, 'VERIFIED');
  assert.equal(result.collection, 'UNCHANGED');
  assert.equal(result.comparison, 'MATCH');
  assert.equal(result.caseReplay, 'NOT_RUN');
  assert.equal(result.actionReplay, 'NOT_RUN');
  assert.deepEqual(result.caseBinding, {id:contract.id, version:contract.version, sha256:jsonDigest(contract), ref:original.case});
  assert.equal(result.rootSha256, createHash('sha256').update(bytes).digest('hex'));
  assert.deepEqual(result.sourceSession, {runId:session.runId, instanceId:session.instanceId, platform:session.platform,
    ref:original.session, chainTail:original.chainTail, commandJournal:session.commands});
  assert.deepEqual(result.sourceSample, {id:'source-ready', chainRef:{index:sourceLink.index, sha256:sourceLink.sha256},
    windowMetrics:original.measurement.sampleWindows['source-ready']});
  const {waitActionContext:context, projection, sizeComparison} = result;
  assert.equal(sizeComparison.scope, 'HOST_NORMALIZED_SAMPLE_JSON');
  assert.equal(sizeComparison.nodeCount, projection.nodes.length);
  assert.equal(sizeComparison.projectedBytes, Buffer.byteLength(JSON.stringify(projection), 'utf8'));
  assert.equal(sizeComparison.savedBytes, sizeComparison.fullBytes - sizeComparison.projectedBytes);
  assert.ok(sizeComparison.savedBytes > 0);
  assert.equal(context.mode, 'READ_ONLY');
  assert.equal(context.actionStepId, 'open-sources');
  assert.equal(context.action.actionId, `${session.runId}:open-sources`);
  assert.equal(context.action.instanceId, projection.instanceId);
  assert.equal(projection.instanceId, session.instanceId);
  assert.deepEqual(context.actionChainRef, {index:actionLink.index, sha256:actionLink.sha256});
  assert.deepEqual(context.actionWaitFor, contract.steps.find(step => step.id === 'open-sources').waitFor);
  assert.deepEqual(context.sampleWaitFor, [{kind:'source.projection', fields:{'payload.readFact':'current', 'payload.state':'empty'}}]);
  assert.equal(context.quietMs, 500);
  assert.deepEqual([projection.beforeSeq, projection.afterSeq], [sourceLink.entry.beforeSeq, sourceLink.entry.afterSeq]);
  assert.equal(projection.window.density, 3.5);
  assert.equal(projection.window.keyboard.visible, false);
  assert.equal(projection.nodes.length, 102);
  assert.equal(result.omittedFields.length, projection.nodes.length);
  assert.ok(result.omittedFields.some(({fields}) => fields.includes('clip')));
  assert.ok(projection.nodes.every(node => !Object.hasOwn(node, 'clip')));
  assert.deepEqual(projection.evidenceRefs, [sourceLink.entry.screenshot, sourceLink.entry.layout, original.session, session.commands]);
  assert.deepEqual(result.full, original.assertions.find(assertion => assertion.id === 'source.layout.footer-empty-library'));
  assert.deepEqual(result.projected, result.full);
  assert.equal(result.projected.actual.overlapAreaVp2, 0);
  assert.deepEqual(readFileSync(auditOptions.receiptPath), bytes);
});

test('D：修改根、原用例、前置日志或冻结工具都不会放行投影', {skip:skipAudit}, async t => {
  const tmp = mkdtempSync(join(tmpdir(), 'reader-d-audit-'));
  t.after(() => rmSync(tmp, {recursive:true, force:true}));
  const bundle = join(tmp, 'bundle');
  cpSync(join(auditDir, 'source-empty-library-new-guest'), bundle, {recursive:true});
  const options = {...auditOptions, receiptPath:join(bundle, 'receipt.json')};
  const receiptBytes = readFileSync(options.receiptPath);
  const receipt = JSON.parse(receiptBytes);
  const session = JSON.parse(readFileSync(join(bundle, receipt.session.path)));
  writeFileSync(options.receiptPath, Buffer.concat([receiptBytes, Buffer.from(' ')]));
  assertUnverifiedFallback(await compareAuditedCaptureFields(options), /independently audited root/u);
  writeFileSync(options.receiptPath, receiptBytes);

  const casePath = join(bundle, receipt.case.path);
  const caseBytes = readFileSync(casePath);
  const modified = JSON.parse(caseBytes);
  delete modified.steps.find(step => step.id === 'source-ready').waitFor;
  writeFileSync(casePath, JSON.stringify(modified));
  assertUnverifiedFallback(await compareAuditedCaptureFields(options), /Changed evidence bytes: case\.json/u);
  writeFileSync(casePath, caseBytes);

  const journalPath = join(bundle, session.commands.path);
  const journal = readFileSync(journalPath);
  writeFileSync(journalPath, journal.subarray(0, journal.length - 1));
  assertUnverifiedFallback(await compareAuditedCaptureFields(options), /not verified complete|independently recomputed|Changed evidence bytes/u);
  writeFileSync(journalPath, journal);

  const tool = join(tmp, 'tool');
  cpSync(auditOptions.frozenToolRoot, tool, {recursive:true});
  const cli = join(tool, 'tools/ui-contract/cli.mjs');
  writeFileSync(cli, Buffer.concat([readFileSync(cli), Buffer.from('\n')]));
  assertUnverifiedFallback(await compareAuditedCaptureFields({...options, frozenToolRoot:tool}), /exported replay tool files changed/u);
});
