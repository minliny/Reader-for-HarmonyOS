import { readFileSync } from 'node:fs';
import { deriveStructure, prototypeForBrief } from './derive-structure.mjs';
import { loadInputs, safePath, digest, diagnostic, printReport, isMain, registrations, isEmbeddedContent } from './lib.mjs';
import { checkLayoutEvidence } from './layout-evidence.mjs';

// These rules consume typed declarations. Source bindings below independently
// detect selected stale declarations. They do not claim native layout behavior.
export function evaluatePage(page, model) {
  const f = Object.fromEntries(Object.entries(page.layers).map(([k, v]) => [k, v.facts]));
  const diagnostics = [], add = (id, layer, field, message) => diagnostics.push(diagnostic(id, page.pageId, layer, field, message));
  // Legacy records describe fixed footers. New records distinguish presence
  // from placement so a real in-flow dock needs no fictitious fixed inset.
  const fixedFooter = f.footer.presence && (f.footer.placement ?? 'fixed') === 'fixed';
  if (f.footer.placement && f.footer.presence === (f.footer.placement === 'none')) add('FOOTER_PLACEMENT', 'footer', 'placement', 'Presence and explicit placement conflict');
  const placements = f.query.entryPlacements ?? [f.query.placement];
  if (placements.includes('headerSlot') && placements.includes('inline')) add('G-01', 'query', 'entryPlacements', 'Same query in header and content');
  const actions = [...(f.header.actions ?? []), ...(f.query.actions ?? []), ...(f.footer.actions ?? [])];
  for (const id of new Set(actions.map(a => a.actionId))) {
    const group = actions.filter(a => a.actionId === id);
    if (group.length > 1 && group.some(a => a.priority === 'unresolved')) diagnostics.push(diagnostic('B1', page.pageId, 'footer', 'actions', `${id}: D1/context priority unresolved`, 'NOT_RUN'));
    else if (group.length > 1 && (new Set(group.map(a => a.owner)).size > 1 || group.filter(a => a.priority === 'primary').length > 1)) add('G-02', 'footer', 'actions', `${id}: duplicate action without shared owner/context hierarchy`);
  }
  if (f.scroll.underlap || f.header.presentation === 'Floating') {
    if (f.scroll.obscurationCompensation === null) diagnostics.push(diagnostic('G-03', page.pageId, 'scroll', 'obscurationCompensation', 'Dynamic compensation requires measured geometry; null does not establish absence or PASS', 'NOT_RUN'));
    else if (!(f.scroll.obscurationCompensation > 0)) add('G-03', 'scroll', 'obscurationCompensation', 'Underlap/floating header has no compensation');
  }
  if (fixedFooter && (f.scroll.footerInset === 'none' || f.footer.contentEndInset === 'none')) add('G-04', 'scroll', 'footerInset', 'Fixed footer has no end inset');
  if (f.overlay.types?.length && f.overlay.backConsumption === 'after-route') add('G-05', 'overlay', 'backConsumption', 'Temporary layer must consume before route exit');
  if (f.content.availableWidth !== null && f.content.textMinWidth !== null && f.content.trailingMaxWidth !== null && f.content.textMinWidth + f.content.trailingMaxWidth > f.content.availableWidth && f.content.rowForm === 'single-line') add('G-06', 'content', 'rowForm', 'Declared row budget overflows available content width');
  if (page.brief.queryPriority !== 'none' && (!f.query.filteredEmpty || !f.query.reset)) add('G-07', 'query', 'filteredEmpty', 'Filterable collection needs empty result and reset');
  if (f.header.role === 'Contextual' && page.prototype !== 'SelectionPage') add('G-08', 'header', 'role', 'Contextual header requires selection prototype');
  if (page.layers.scroll.applicability === 'applicable' && f.scroll.primaryCount !== 1) add('G-09', 'scroll', 'primaryCount', 'Exactly one primary scroll owner');
  if ((f.header.presentation === 'Fixed' || fixedFooter) && (!f.measurement.keys?.length || !f.measurement.revisionSource)) add('G-10', 'measurement', 'keys', 'Fixed chrome requires measurements and revision');
  if (page.brief.role !== 'root' && !f.route.parentCaptured) add('G-11', 'route', 'parentCaptured', 'Parent must be captured on entry');
  if (page.platformHosts.some(h => h.registeredAsRoute || h.extraFrame)) add('G-12', 'overlay', 'platformHosts', 'Platform surface cannot be an application route or double frame');
  if (page.platformHosts.some(h => !h.identity || !h.returnContext)) add('G-13', 'overlay', 'platformHosts', 'Missing initiating identity/return context');
  if (page.operationRefs.some(o => !o.operationId || !o.owner || o.bindingStatus === 'unbound')) add('G-14', 'dataLifecycle', 'operationRefs', 'Write action has no owner/binding');
  if (f.dataLifecycle.confirmedRefreshPolicy === 'replay-write') add('G-15', 'dataLifecycle', 'confirmedRefreshPolicy', 'Confirmed write readback must not replay write');
  if (f.route.status === 'unresolved') add('S8', 'route', 'status', `Unresolved route contract: ${f.route.unresolvedRefs.join(', ')}`);
  for (const state of f.interaction.actionStates ?? []) if (!state.busyBound && !state.disabledBound) add('B4', 'interaction', `actionStates.${state.controlRef}`, 'Action exposes neither busy nor disabled from its owner');
  if (page.layers.interaction.applicability === 'applicable' && !f.interaction.statusNonColor) add('E1', 'interaction', 'statusNonColor', 'Status uses color alone');
  const targets = f.interaction.targets;
  if (targets && (targets.minWidth < 44 || targets.minHeight < 44) && !targets.equivalentResponseRegion) add('E2', 'interaction', 'targets', 'Touch target smaller than 44×44 without response region');
  const requiredStates = page.brief.stateSet;
  if (!requiredStates.every(s => f.states.required?.includes(s))) add('STATE_SET', 'states', 'required', 'Brief and layer required states differ');
  if (page.brief.messageSet.includes('pageState') && !requiredStates.some(s => ['loading', 'empty', 'error', 'filteredEmpty'].includes(s))) add('MESSAGE_SET', 'states', 'brief.messageSet', 'PageState has no corresponding state');
  return diagnostics;
}

export function checkRegister(inputs = loadInputs(), { bindSource = true } = {}) {
  const diagnostics = [];
  const all = registrations(inputs.register);
  for (const { page, host } of all) {
    diagnostics.push(...evaluatePage(page, inputs.model));
    diagnostics.push(...checkLayoutEvidence(page, { bindSource }).diagnostics);
    for (const [id, record] of Object.entries(page.invariants)) {
      if (record.result === 'FAIL' && !diagnostics.some(d=>d.pageId===page.pageId && d.ruleId===id && d.result==='FAIL')) diagnostics.push(diagnostic(id, page.pageId, inputs.model.invariants.find(r=>r.id===id)?.layer, `invariants.${id}`, record.reason));
    }
    let derived;
    const embedded = isEmbeddedContent(page, host);
    if (host?.kind === 'embedded' && !embedded) diagnostics.push(diagnostic('SCOPE', page.pageId, 'scaffold', 'host.kind', 'Embedded label cannot exempt a page header, fixed footer or whole-page regions'));
    if (embedded) diagnostics.push(diagnostic('SCOPE', page.pageId, 'scaffold', 'host.kind', 'Embedded module inherits its route; whole-page prototype derivation is not applicable. Applicable layer checks remain active.', 'NOT_RUN'));
    if (embedded && page.brief.queryViewport !== undefined) {
      try {
        const query = deriveStructure(page.brief, inputs.model).query;
        if (page.layers.query.facts.placement !== query) diagnostics.push(diagnostic('QUERY_VIEWPORT', page.pageId, 'query', 'brief.queryViewport', `Measured viewport requires ${query}, registered ${page.layers.query.facts.placement}`));
      } catch (error) { diagnostics.push(diagnostic('QUERY_VIEWPORT', page.pageId, 'query', 'brief.queryViewport', error.message)); }
    }
    try { if (!embedded) derived = deriveStructure(page.brief, inputs.model); }
    catch (error) { diagnostics.push(diagnostic('DERIVE', page.pageId, 'scaffold', 'brief', error.message)); }
    if (derived && derived.prototype !== page.prototype) diagnostics.push(diagnostic('DERIVE', page.pageId, 'scaffold', 'prototype', `Expected ${derived.prototype}`));
    if (derived && derived.headerRole !== page.layers.header.facts.role) diagnostics.push(diagnostic('GRAMMAR',page.pageId,'header','role',`Prototype requires ${derived.headerRole}`));
    if (page.layers.scaffold.facts.prototype !== page.prototype) diagnostics.push(diagnostic('DERIVE', page.pageId, 'scaffold', 'facts.prototype', 'Scaffold prototype differs from page prototype'));
    const definition = prototypeForBrief(page.brief, inputs.model);
    if (definition && !embedded) for (const region of definition.regions.filter(r => !r.startsWith('optional'))) if (!page.layers.scaffold.facts.regions.includes(region)) diagnostics.push(diagnostic('GRAMMAR', page.pageId, 'scaffold', 'regions', `Required region ${region} is absent`));
    if (derived?.primaryAction === 'Footer' && !page.layers.footer.facts.presence) diagnostics.push(diagnostic('DERIVE', page.pageId, 'footer', 'presence', 'Global primary action needs Footer'));
    for (const [key, actual] of [['header', page.layers.header.facts.presentation], ['query', page.layers.query.facts.placement]]) {
      if (derived && page.layers[key].applicability === 'applicable' && derived[key] !== actual) diagnostics.push(diagnostic('DERIVE', page.pageId, key, key, `Derived ${derived[key]}, registered ${actual}`));
    }
    if (bindSource) {
      if (digest(page.source.path) !== page.source.sha256) diagnostics.push(diagnostic('SOURCE_DRIFT', page.pageId, 'measurement', 'source.sha256', 'Source changed: review impacted facts and update registration'));
      for (const ref of page.sourceInputs ?? []) if (digest(ref.path) !== ref.sha256) diagnostics.push(diagnostic('SOURCE_DRIFT', page.pageId, 'measurement', 'sourceInputs', `Dependency changed: ${ref.path}`));
      const source = readFileSync(safePath(page.source.path), 'utf8');
      if (page.pageId === 'source-management') {
        const facts = page.layers;
        const hasFilteredEmpty = source.includes('没有匹配的书源');
        if (facts.query.facts.filteredEmpty !== hasFilteredEmpty) diagnostics.push(diagnostic('SOURCE_BINDING', page.pageId, 'query', 'filteredEmpty', 'Declaration differs from selected PageState source binding'));
        const footerBinding = /input\.contentEndInset\s*=\s*input\.footerHeight/.test(source);
        if (!footerBinding) diagnostics.push(diagnostic('S2', page.pageId, 'scroll', 'footerInset', 'Selected footer-height binding is absent; manual review required'));
      }
    }
  }
  const manual = [
    ...inputs.model.illegalCombinations.filter(r => r.checkMode === 'manual').map(r => ({ ruleId: r.id, result: 'NOT_RUN', layer: r.layer, reason: 'Requires manual/native evidence' })),
    ...all.flatMap(({page})=>Object.entries(page.invariants).filter(([,r])=>r.result==='NOT_RUN').map(([id,r])=>({pageId:page.pageId,ruleId:id,result:'NOT_RUN',layer:inputs.model.invariants.find(rule=>rule.id===id)?.layer,reason:r.reason}))),
  ];
  return { diagnostics, manual };
}
if (isMain(import.meta.url)) {
  try { const { diagnostics, manual } = checkRegister(); printReport('check-register', diagnostics, { manual, boundary: 'Registration/source checks; page failures are preserved. Native geometry/accessibility remains NOT_RUN.' }); }
  catch (error) { printReport('check-register', [diagnostic('INPUT', 'framework', null, '', error.message)]); }
}
