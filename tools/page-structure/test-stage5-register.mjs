import assert from 'node:assert/strict';
import { loadInputs } from './lib.mjs';
import { validateModel } from './validate-model.mjs';
import { checkContractRefs } from './check-contract-refs.mjs';
import { evaluatePage, checkRegister } from './check-register.mjs';

const clone = value => structuredClone(value);
function fixture() {
  const inputs = clone(loadInputs());
  const source = inputs.register.pages.find(p => p.pageId === 'source-management');
  inputs.register.pages = [source];
  delete source.variants;
  const page = clone(source);
  page.pageId = 'source-management-fixture';
  page.brief.pageId = page.pageId;
  page.sourceInputs = [clone(page.source)];
  source.variants = [{ variantId: 'test-host', condition: 'isolated checker fixture',
    host: { kind: 'route', owner: 'SourceManagementPage', routeContractRef: page.routeContractRef,
      contextKinds: ['test'], factSource: { path: page.source.path, symbol: 'SourceManagementPage' } },
    registration: page }];
  return { inputs, source, page, variant: source.variants[0] };
}
const cases = {
  'host-variants'() {
    const { inputs, page, source, variant } = fixture();
    assert.deepEqual(validateModel(inputs).diagnostics, []);
    assert.deepEqual(checkContractRefs(inputs), []);
    const twoHosts = clone(inputs);
    const route = twoHosts.navigation.routes.find(r => r.routeId === page.routeContractRef);
    const existingHost = twoHosts.platform.hosts.find(h => h.refId === page.platformHosts[0].hostRef);
    const additionalRef = existingHost.refId + '.second-use';
    twoHosts.platform.hosts.push({ ...clone(existingHost), refId: additionalRef });
    route.platformHostRefs.push(additionalRef);
    for (const entry of [twoHosts.register.pages[0], twoHosts.register.pages[0].variants[0].registration]) {
      entry.platformHosts.push({ ...clone(entry.platformHosts[0]), hostRef: additionalRef });
      entry.layers.route.facts.platformHostRefs.push(additionalRef);
    }
    assert.deepEqual(checkContractRefs(twoHosts), [], 'multiple independently owned integrations may share one platform host category');
    twoHosts.register.pages[0].variants[0].registration.platformHosts[1].businessOwner = 'wrong-owner';
    assert(checkContractRefs(twoHosts).some(d => d.pageId === page.pageId && d.field === 'platformHosts.businessOwner'));
    let bad = clone(inputs);
    bad.register.pages[0].variants[0].registration.controlRefs.push('missing.variant.control');
    assert(checkContractRefs(bad).some(d => d.pageId === page.pageId && d.message.includes('missing.variant.control')));
    bad = clone(inputs);
    bad.register.pages[0].variants[0].host.factSource.symbol = 'MissingMountDeclaration';
    assert(checkContractRefs(bad).some(d => d.pageId === page.pageId && d.field === 'host.factSource'));
    bad = clone(inputs);
    bad.register.pages[0].variants[0].host.factSource = {path:'entry/src/main/ets/ui/layout/ReaderPageScaffold.ets',symbol:'ReaderPageScaffold'};
    assert(checkContractRefs(bad).some(d => d.pageId === page.pageId && d.message.includes('source fingerprint')));
    bad = clone(inputs);
    bad.register.pages[0].variants[0].registration.sourceInputs[0].sha256 = '0'.repeat(64);
    assert(checkContractRefs(bad).some(d => d.pageId === page.pageId && d.ruleId === 'SOURCE_DRIFT'));
    assert(checkRegister(bad).diagnostics.some(d => d.pageId === page.pageId && d.ruleId === 'SOURCE_DRIFT'));
    bad = clone(inputs);
    bad.register.pages[0].variants[0].registration.layers.interaction.result = 'NOT_RUN';
    assert(validateModel(bad).diagnostics.some(d => d.pageId === page.pageId && d.ruleId === 'RESULT'));
    bad = clone(inputs);
    bad.register.pages[0].variants[0].registration.variants = [clone(variant)];
    assert(validateModel(bad).diagnostics.some(d => d.ruleId === 'SCHEMA'));
    bad = clone(inputs);
    bad.register.pages[0].variants.push(clone(variant));
    assert(validateModel(bad).diagnostics.some(d => ['DUPLICATE', 'SCHEMA'].includes(d.ruleId)));
    bad = clone(inputs);
    delete bad.register.pages[0].variants[0].registration.layers.scroll;
    assert(validateModel(bad).diagnostics.some(d => d.ruleId === 'SCHEMA'));
    // null preserves missing upstream policy; it cannot become an acceptance.
    page.layers.route.result = 'NOT_RUN';
    page.invariants.S8 = { result: 'NOT_RUN', reason: 'Isolated unknown-retention fixture', evidence: [] };
    page.layers.route.facts.retention.query = null;
    assert.deepEqual(validateModel(inputs).diagnostics, []);
    page.invariants.S8 = { result: 'PASS', reason: 'invalid claimed policy', evidence: [{kind:'source',path:page.source.path,result:'PASS'}] };
    assert(validateModel(inputs).diagnostics.some(d => d.ruleId === 'EVIDENCE' && d.field === 'retention'));
    // Embedded modules inherit a route without being forced into a new frame.
    const embedded = fixture();
    embedded.variant.host.kind = 'embedded';
    embedded.page.layers.scaffold.facts.regions = ['content'];
    embedded.page.layers.header.facts.role = 'None';
    embedded.page.layers.header.facts.presentation = 'None';
    embedded.page.layers.header.facts.actions = [];
    embedded.page.layers.footer.facts.placement = 'inline';
    // These are explicit negative fixture facts. A real Source repair must not
    // make the preservation test require the live page to remain broken.
    const parent = embedded.inputs.register.pages[0];
    for (const id of ['S8', 'E2', 'E3']) {
      parent.invariants[id] = { ...clone(parent.invariants[id]), result: 'FAIL',
        reason: `Isolated parent ${id} failure must survive adding an embedded variant`, evidence: [],
        followUp: clone(parent.invariants.E2.followUp) };
      const layer = embedded.inputs.model.invariants.find(rule => rule.id === id).layer;
      parent.layers[layer].result = 'FAIL';
    }
    const report = checkRegister(embedded.inputs);
    assert(report.diagnostics.some(d => d.pageId === embedded.page.pageId && d.ruleId === 'SCOPE' && d.result === 'NOT_RUN'));
    assert(!report.diagnostics.some(d => d.pageId === embedded.page.pageId && ['DERIVE','GRAMMAR'].includes(d.ruleId)));
    let invalidModule = clone(embedded.inputs);
    invalidModule.register.pages[0].variants[0].registration.layers.header.facts.presentation = 'Fixed';
    assert(validateModel(invalidModule).diagnostics.some(d => d.ruleId === 'SCOPE'));
    assert(checkRegister(invalidModule).diagnostics.some(d => d.pageId === embedded.page.pageId && d.ruleId === 'SCOPE' && d.result === 'FAIL'));
    embedded.page.layers.scroll.facts.primaryCount = 2;
    embedded.page.layers.interaction.facts.targets = {minWidth:44,minHeight:20,equivalentResponseRegion:false};
    const local = checkRegister(embedded.inputs).diagnostics.filter(d => d.pageId === embedded.page.pageId);
    assert(local.some(d => d.ruleId === 'G-09' && d.result === 'FAIL'));
    assert(local.some(d => d.ruleId === 'E2' && d.field === 'targets' && d.result === 'FAIL'));
    embedded.page.layers.scroll.facts.underlap = true;
    embedded.page.layers.scroll.facts.obscurationCompensation = null;
    assert(evaluatePage(embedded.page, inputs.model).some(d => d.ruleId === 'G-03' && d.result === 'NOT_RUN'));
    embedded.page.layers.scroll.facts.obscurationCompensation = 0;
    assert(evaluatePage(embedded.page, inputs.model).some(d => d.ruleId === 'G-03' && d.result === 'FAIL'));
    // Parent-source failures remain visible while variants are added.
    for (const id of ['S8','E2','E3']) assert(report.diagnostics.some(d => d.pageId === source.pageId && d.ruleId === id && d.result === 'FAIL'));
  },
  'footer-placement'() {
    const { inputs, page } = fixture();
    page.layers.header.facts.presentation = 'ScrollAway';
    page.layers.footer.facts.presence = true;
    page.layers.footer.facts.contentEndInset = 'none';
    page.layers.scroll.facts.footerInset = 'none';
    page.layers.measurement.facts.keys = [];
    page.layers.measurement.facts.revisionSource = '';
    const rules = () => evaluatePage(page, inputs.model).map(d => d.ruleId);
    delete page.layers.footer.facts.placement;
    assert(rules().includes('G-04')); // legacy records retain fixed semantics
    assert(rules().includes('G-10'));
    page.layers.footer.facts.placement = 'inline';
    assert(!rules().includes('G-04'));
    assert(!rules().includes('G-10'));
    page.layers.footer.facts.placement = 'fixed';
    assert(rules().includes('G-04'));
    assert(rules().includes('G-10'));
    page.layers.footer.facts.placement = 'none';
    assert(rules().includes('FOOTER_PLACEMENT'));
    assert(validateModel(inputs).diagnostics.some(d => d.ruleId === 'SCHEMA' && d.field.includes('footer')));
    page.layers.footer.facts.presence = false;
    page.layers.footer.facts.placement = 'inline';
    assert(rules().includes('FOOTER_PLACEMENT'));
  },
};
const args = process.argv.slice(2);
if (!args.length || args[0] === '--list') {
  console.log(JSON.stringify({result:'NOT_RUN',cases:Object.keys(cases)}));
} else {
  if (args.length !== 2 || args[0] !== '--case') throw Error('Use --case host-variants,footer-placement');
  const selected = args[1].split(',');
  if (new Set(selected).size !== selected.length || selected.some(id => !cases[id])) throw Error('Unknown or duplicate case');
  for (const id of selected) {
    cases[id]();
    console.log(JSON.stringify({case:id,result:'PASS',boundary:'Schema/reference and typed rule fixtures only; no production or native behavior'}));
  }
}
