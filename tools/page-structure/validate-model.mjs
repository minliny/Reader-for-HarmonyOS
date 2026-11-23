import { loadInputs, readJSON, diagnostic, printReport, isMain, schemaValidator, registrations, isEmbeddedContent } from './lib.mjs';
import { validateStructureDefinition } from '../ui-contract/lib/structure-contract.mjs';
import { isSourceE3Claim, requireSourceE3Matrix } from './source-e3-admission.mjs';
import { isSourceE2Claim, requireSourceE2InteractionPlan } from './source-e2-admission.mjs';

const pairs = [
  ['model', 'tools/page-structure/schema/model.schema.json'],
  ['register', 'tools/page-structure/schema/register.schema.json'],
  ['exceptions', 'tools/page-structure/schema/exceptions.schema.json'],
  ['contracts', 'tools/contracts/schema/contract-map.schema.json'],
  ['navigation', 'tools/contracts/schema/navigation-registry.schema.json'],
  ['controls', 'tools/contracts/schema/control-registry.schema.json'],
  ['platform', 'tools/contracts/schema/platform-host-registry.schema.json'],
];
export function validateModel(inputs = loadInputs(), { asOf = new Date().toISOString().slice(0,10) } = {}) {
  const { ajv, dependency } = schemaValidator(), diagnostics = [];
  for (const [key, path] of pairs) {
    const validate = ajv.compile(readJSON(path));
    if (!validate(inputs[key])) for (const error of validate.errors) diagnostics.push(diagnostic('SCHEMA', key, null, error.instancePath, `${error.message}: ${JSON.stringify(error.params)}`));
  }
  if (diagnostics.length) return { diagnostics, dependency };
  const model = inputs.model;
  if (['structureSelectors', 'structureRules', 'scenarioObligations', 'structureFoundations'].some(key => Object.hasOwn(model, key))) {
    try {
      validateStructureDefinition(model);
    } catch (error) {
      diagnostics.push(diagnostic('STRUCTURE_DEFINITION', 'model', null, 'scenarioObligations', error.message));
    }
  }
  if (model.modelVersion !== inputs.register.modelVersion) diagnostics.push(diagnostic('VERSION', 'register', null, 'modelVersion', 'Registration must consume the same model version'));
  if (model.layers.length !== 16 || new Set(model.layers.map(l => l.id)).size !== 16) diagnostics.push(diagnostic('L0', 'model', null, 'layers', 'Exactly sixteen unique layer definitions required'));
  for (const key of ['layers', 'prototypes', 'illegalCombinations', 'invariants']) {
    const ids = model[key].map(x => x.id);
    if (new Set(ids).size !== ids.length) diagnostics.push(diagnostic('DUPLICATE', 'model', null, key, 'Duplicate model IDs'));
  }
  const all = registrations(inputs.register), ids = new Set();
  const receiptClaims = new Set();
  for (const mapping of model.receiptAdmissions ?? []) {
    const page = all.find(item => item.page.pageId === mapping.pageId)?.page;
    const [scope, id] = mapping.claim.split('.');
    const key = JSON.stringify([mapping.pageId, mapping.claim]);
    const parts = mapping.cases ?? [mapping];
    const owners = new Set([page?.source, ...(page?.sourceInputs ?? [])].map(input => input?.path));
    if (!page || page.routeContractRef !== mapping.routeContractRef || !page[scope]?.[id] ||
        receiptClaims.has(key) || new Set(parts.map(part => part.caseId)).size !== parts.length ||
        parts.some(part => new Set(part.assertions.map(value => value.id)).size !== part.assertions.length ||
          (mapping.cases && !model.scenarioObligations?.some(item => item.caseId === part.caseId)) ||
          part.ownerSources.some(path => !owners.has(path)))) {
      diagnostics.push(diagnostic('RECEIPT_ADMISSION', mapping.pageId, null, mapping.claim,
        'Expected one declared page/route rule with distinct cases, distinct assertions and fingerprinted owners'));
    }
    if (isSourceE3Claim(mapping,mapping.claim)) {
      try {
        requireSourceE3Matrix(mapping);
      } catch (error) {
        diagnostics.push(diagnostic('RECEIPT_ADMISSION', mapping.pageId, null, mapping.claim, error.message));
      }
    }
    if (isSourceE2Claim(mapping,mapping.claim)) {
      try {
        requireSourceE2InteractionPlan(mapping);
      } catch (error) {
        diagnostics.push(diagnostic('RECEIPT_ADMISSION', mapping.pageId, null, mapping.claim, error.message));
      }
    }
    receiptClaims.add(key);
  }
  for (const family of inputs.register.pages) {
    const variantIds = (family.variants ?? []).map(v => v.variantId);
    if (new Set(variantIds).size !== variantIds.length) diagnostics.push(diagnostic('DUPLICATE', family.pageId, null, 'variants', 'Duplicate mounting variant ID'));
  }
  for (const { page, host } of all) {
    if (ids.has(page.pageId)) diagnostics.push(diagnostic('DUPLICATE', page.pageId, null, 'pageId', 'Duplicate registration identity'));
    ids.add(page.pageId);
    if (page.brief.pageId !== page.pageId) diagnostics.push(diagnostic('REFERENCE', page.pageId, 'scaffold', 'brief.pageId', 'Brief and registration identities differ'));
    if (host && host.routeContractRef !== page.routeContractRef) diagnostics.push(diagnostic('REFERENCE', page.pageId, 'route', 'host.routeContractRef', 'Host must inherit the same owning route as its registration'));
    if (host?.kind === 'embedded' && !isEmbeddedContent(page, host)) diagnostics.push(diagnostic('SCOPE', page.pageId, 'scaffold', 'host.kind', 'Embedded scope requires content-only regions, no page header and no independent fixed footer'));
    if (Object.values(page.layers.route.facts.retention).includes(null) && (page.invariants.S8.result === 'PASS' || page.layers.route.result === 'PASS')) diagnostics.push(diagnostic('EVIDENCE', page.pageId, 'route', 'retention', 'Unknown upstream retention cannot establish route/S8 PASS'));
    for (const layer of model.layers) if (!page.layers[layer.id]) diagnostics.push(diagnostic('L0', page.pageId, layer.id, 'layers', 'Missing layer'));
    for (const rule of model.invariants) if (!page.invariants[rule.id]) diagnostics.push(diagnostic('L0', page.pageId, rule.layer, `invariants.${rule.id}`, 'Missing explicit invariant result'));
    for (const [id, value] of Object.entries(page.invariants)) {
      const rule = model.invariants.find(r => r.id === id);
      if (!rule) diagnostics.push(diagnostic('INVARIANT', page.pageId, null, id, 'Unknown invariant'));
      if (value.result === 'EXCEPTION' && !rule?.exceptionAllowed) diagnostics.push(diagnostic('EXCEPTION_FORBIDDEN', page.pageId, rule?.layer, id, 'This invariant cannot be excepted'));
      if (value.result === 'EXCEPTION' && !inputs.exceptions.exceptions.some(e => e.pageId === page.pageId && e.invariantId === id)) diagnostics.push(diagnostic('EXCEPTION', page.pageId, rule?.layer, id, 'Missing exception record'));
      if (value.result === 'PASS' && !value.evidence.some(e=>e.result==='PASS')) diagnostics.push(diagnostic('EVIDENCE',page.pageId,rule?.layer,id,'PASS needs positive evidence in the declared evidence layer'));
      if (value.result === 'FAIL' && !value.followUp) diagnostics.push(diagnostic('FOLLOW_UP',page.pageId,rule?.layer,id,'Known failure requires owner, review trigger and exit criteria'));
      if (value.result === 'FAIL' && rule && page.layers[rule.layer]?.result !== 'FAIL') diagnostics.push(diagnostic('RESULT',page.pageId,rule.layer,id,'Known invariant failure must remain FAIL in its owning layer'));
    }
  }
  for (const exception of inputs.exceptions.exceptions) {
    if (!all.some(({page})=>page.pageId===exception.pageId)) diagnostics.push(diagnostic('EXCEPTION',exception.pageId,null,exception.id,'Unknown exception page'));
    const rule = model.invariants.find(r=>r.id===exception.invariantId);
    if (!rule?.exceptionAllowed) diagnostics.push(diagnostic('EXCEPTION_FORBIDDEN',exception.pageId,rule?.layer,exception.id,'Unknown or non-exceptable invariant'));
    const deadline = exception.expiresAtOrReviewTrigger.match(/\d{4}-\d{2}-\d{2}/)?.[0];
    if (deadline && deadline <= asOf) diagnostics.push(diagnostic('EXCEPTION_EXPIRED',exception.pageId,rule?.layer,exception.id,`Exception expired/review due ${deadline}`));
    if (!deadline) diagnostics.push(diagnostic('EXCEPTION_REVIEW',exception.pageId,rule?.layer,exception.id,'Review trigger requires explicit manual validation before EXCEPTION can be accepted'));
  }
  return { diagnostics, dependency };
}
if (isMain(import.meta.url)) {
  try { const { diagnostics, dependency } = validateModel(); printReport('validate-model', diagnostics, { dependency }); }
  catch (error) { printReport('validate-model', [diagnostic('INPUT', 'framework', null, '', error.message)]); }
}
