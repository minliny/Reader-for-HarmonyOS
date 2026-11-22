import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { createImpactView } from '../../lib/gate-index-impact.mjs';
import { digest } from '../../page-structure/lib.mjs';
import { checkNormalPageEvidence } from '../../page-structure/normal-page-evidence.mjs';
import {
  admitReplayedRule, checkContractReceipt, checkContractReceiptGroup, receiptGroupRuns, requireCompatibleClaimReceipts,
} from '../../page-structure/receipt-evidence.mjs';
import { structureBindingSha256 } from '../lib/receipt-structure.mjs';
import { resolveStructureBindings, structureRuleOrder } from '../lib/structure-contract.mjs';

const read = path => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const model = read('../../page-structure/model.json');
const claim = 'invariants.S5';
const page = read('../../page-structure/register.json').pages.find(item => item.pageId === 'source-management');
const mapping = model.receiptAdmissions.find(item => item.pageId === page.pageId && item.claim === claim);
const candidate = {
  appBuildId:'0.2.0.DEV.0123456789ab', appContentHash:'a'.repeat(64), buildRunId:'prepared-run',
  hapSha256:'b'.repeat(64), sourceFingerprint:'c'.repeat(64), hdcServer:'127.0.0.1:8710',
  targetRef:'0123456789ab', targetKind:'vm',
};
const window = {widthPx:1280, heightPx:2832, density:3.5, orientation:'portrait', fontScale:1};
const reference = path => ({path, bytes:17, sha256:'a'.repeat(64)});
const capture = sampleId => [reference(`raw/${sampleId}.png`), reference(`raw/${sampleId}.json`)];

function groupRoot() {
  return {
    schema:'reader-ui-contract-receipt-group-v1', pageId:page.pageId, routeContractRef:page.routeContractRef, claim,
    runs:mapping.cases.map(({caseId}, index) => ({
      case:caseId, receipt:`member-${index}/receipt.json`, expectedRoot:String(index + 1).repeat(64),
    })),
  };
}

test('S5 registration binds a complete distinct pair to one candidate and measured claim window', () => {
  assert.equal(page.invariants.S5.result, 'NOT_RUN');
  assert.deepEqual(mapping.cases.map(part => part.caseId),
    ['source-management.scroll-return', 'source-management.layout-filter']);
  assert.equal(receiptGroupRuns(groupRoot(), mapping).length, 2);
  for (const change of [
    group => group.runs.pop(),
    group => { group.runs[1].case = group.runs[0].case; },
    group => { group.runs[1].expectedRoot = group.runs[0].expectedRoot; },
    group => { group.runs[1].receipt = group.runs[0].receipt; },
    group => { group.runs[0].case = 'source-management.temporary-back-return'; },
    group => { group.routeContractRef = 'nav.stale'; },
    group => { group.claim = 'invariants.S2'; },
    group => { group.runs[0].receipt = '../other/receipt.json'; },
  ]) {
    const group = groupRoot();
    change(group);
    assert.throws(() => receiptGroupRuns(group, mapping), /Receipt group/u);
  }
  const parts = mapping.cases.map(part => ({
    part, receipt:{
      candidate:{identity:{...candidate}},
      measurement:{sampleWindows:{[part.assertions[0].sampleId]:{...window}}},
    },
  }));
  requireCompatibleClaimReceipts(parts);
  for (const [change, reason] of [
    [item => { item.receipt.candidate.identity.buildRunId = 'other-run'; }, /candidate/u],
    [item => { item.receipt.candidate.identity.hdcServer = '192.168.1.10:8710'; }, /deployment or target/u],
    [item => { item.receipt.measurement.sampleWindows['zero-match'].fontScale = 2; }, /different measured window/u],
    [item => { delete item.receipt.measurement.sampleWindows['zero-match']; }, /no fixed measured window/u],
  ]) {
    const mutated = structuredClone(parts);
    change(mutated[1]);
    assert.throws(() => requireCompatibleClaimReceipts(mutated), reason);
  }
  const incomplete = structuredClone(page);
  incomplete.invariants.S5 = {result:'PASS', evidence:[
    {kind:'device', symbol:'ui-contract-receipt', result:'PASS'},
    {kind:'device', symbol:'normal-page', result:'PASS'},
  ]};
  assert.throws(() => checkContractReceipt(page, model, claim, {}), /unambiguous owner mapping/u);
  assert.throws(() => checkContractReceiptGroup(page, model, claim, {
    path:'tools/page-structure/model.json', rootSha256:'0'.repeat(64),
  }), /independent root digest/u);
  assert.throws(() => checkContractReceiptGroup({...page, routeContractRef:'nav.stale'}, model, claim, {}),
    /unambiguous owner mapping/u);
  assert.ok(checkNormalPageEvidence(incomplete, model).some(item => item.field === claim && item.result === 'FAIL'));
});

test('S5 registration admits exact single-sample layout evidence with no synthetic sample ID', () => {
  const part = mapping.cases.find(member => member.caseId === 'source-management.layout-filter');
  const contract = read(`../cases/${part.caseId}.json`);
  const currentPage = structuredClone(page);
  const inputs = [currentPage.source, ...currentPage.sourceInputs];
  for (const input of inputs.filter(item => item.path === currentPage.source.path || part.ownerSources.includes(item.path))) {
    input.sha256 = digest(input.path);
  }
  const commands = reference('session/commands.jsonl');
  const sessionRef = reference('session.json');
  const refs = sampleId => [...capture(sampleId), commands, sessionRef];
  const rules = new Map(model.structureRules.map(rule => [rule.id, rule]));
  const states = resolveStructureBindings(contract, model).map(({role, rule, sampleId, actionId}) => ({
    role, ruleId:rule.id, sampleId, actionId, verdict:'PASS', observationsComplete:true,
    checks:structureRuleOrder(rule.id, rules).map(required => ({
      ruleId:required.id, requiredRuleIds:required.requires, verdict:'PASS', observationsComplete:true,
      evidenceRefs:refs(sampleId),
    })),
  }));
  const [screenshot, layout] = capture('zero-match');
  const nativeSamples = new Map(states.map(state => {
    const [screenshot, layout] = capture(state.sampleId);
    return [state.sampleId, {entry:{kind:'sample', id:state.sampleId, screenshot, layout}}];
  }));
  const receipt = {
    caseId:contract.id, page:{id:page.pageId, registration:'REGISTERED_PAGE'},
    candidate:{identity:candidate}, session:sessionRef,
    assertions:part.assertions.map(({id, sampleId}) => ({
      id, actual:id === 'source.filteredEmpty' ? {sampleId} : {overlapAreaVp2:0},
      verdict:'PASS', evidenceRefs:refs(sampleId),
    })),
    measurement:{sampleWindows:Object.fromEntries(states.map(state => [state.sampleId, window]))},
    structure:{bindingSha256:structureBindingSha256(contract, model), states},
  };
  const {appBuildId, hapSha256, sourceFingerprint, targetRef} = candidate;
  const witness = {
    page:currentPage, claim, mapping:{...part, pageId:page.pageId, routeContractRef:page.routeContractRef, claim},
    evidence:{candidate:{appBuildId, hapSha256, sourceFingerprint, targetRef}},
    receipt, contract, currentCase:contract, model,
    frozenPage:structuredClone(currentPage), snapshot:{files:inputs},
    session:{commands, chain:[...nativeSamples.values()]},
  };
  admitReplayedRule(witness);
  const assertion = receipt.assertions.find(item => item.id === 'source.layout.footer-empty-state');
  assertion.evidenceRefs = [...assertion.evidenceRefs.filter(ref => ref.path !== layout.path), capture('cleared')[1]];
  assert.throws(() => admitReplayedRule(witness), /raw native capture/u);
  assertion.evidenceRefs = [screenshot, layout, commands, sessionRef];
  assertion.actual.sampleId = 'cleared';
  assert.throws(() => admitReplayedRule(witness), /raw native capture/u);
});

test('S5 registration impact includes both members in the existing rule closure', () => {
  const root = new URL('../../../', import.meta.url).pathname;
  const id = 'registration:source-management/invariants.S5';
  const view = createImpactView({root, deps:[id]});
  assert.deepEqual(view.relationships.filter(edge => edge.consumer === id && edge.kind === 'required-evidence')
    .map(edge => edge.dependency).sort(),
  ['ui-case:source-management.layout-filter', 'ui-case:source-management.scroll-return']);
  for (const related of ['structure-rule:source.catalog', 'structure-rule:source.filtered-empty']) {
    assert.ok(view.prerequisites.includes(related));
  }
  assert.ok(!view.unresolved.some(gap => gap.id === id));
});
