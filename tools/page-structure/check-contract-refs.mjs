import { existsSync, readFileSync } from 'node:fs';
import { installedEtsCompiler } from '../lib/ets-compiler-runtime.mjs';
import { loadInputs, safePath, digest, diagnostic, printReport, isMain, registrations } from './lib.mjs';

// AST name resolution proves declaration existence, not runtime reachability.
const trees = new Map();
function hasSymbol(path, symbol) {
  const { ts, options } = installedEtsCompiler();
  if (!trees.has(path)) trees.set(path, ts.createSourceFile(path, readFileSync(safePath(path), 'utf8'), ts.ScriptTarget.Latest, true,
    path.endsWith('.ets') ? ts.ScriptKind.ETS : ts.ScriptKind.TS, options));
  const tree = trees.get(path), target = symbol.split('.').at(-1); let found = false;
  if (tree.parseDiagnostics.length) return false;
  function visit(node) {
    if (node.name?.getText(tree) === target) found = true;
    if (!found) ts.forEachChild(node, visit);
  }
  visit(tree); return found;
}
export function checkContractRefs(inputs = loadInputs()) {
  const diagnostics = [];
  const fail = (page, layer, field, message, rule = 'REFERENCE') => diagnostics.push(diagnostic(rule, page, layer, field, message));
  function source(ref, page, layer, field) {
    try {
      if (!ref?.path || !existsSync(safePath(ref.path))) return fail(page, layer, field, `Missing source ${ref?.path}`);
      if (ref.symbol && !hasSymbol(ref.path, ref.symbol)) fail(page, layer, field, `Missing declaration ${ref.path}#${ref.symbol}`);
    } catch (error) { fail(page, layer, field, error.message); }
  }
  function index(items, key, name) {
    const result = new Map();
    for (const item of items) {
      if (result.has(item[key])) fail('framework', name, item[key], `Duplicate ID/owner: ${item[key]}`, 'DUPLICATE_OWNER');
      else result.set(item[key], item);
      for (const [i, ref] of (item.sources ?? []).entries()) source(ref, name, name, `${item[key]}.sources[${i}]`);
    }
    return result;
  }
  const contracts = index(inputs.contracts.contracts, 'contractId', 'contracts');
  const routes = index(inputs.navigation.routes, 'routeId', 'route');
  const controls = index(inputs.controls.controls, 'controlId', 'interaction');
  for (const control of controls.values()) if (!control.states?.length || !control.hitTarget || !Object.hasOwn(control.hitTarget, 'width') || !Object.hasOwn(control.hitTarget, 'height')) fail('framework', 'interaction', control.controlId, 'Control needs declared states and hit target', 'G-16');
  const hosts = index(inputs.platform.hosts, 'refId', 'overlay');
  const messages = index(inputs.messages.entries, 'id', 'messages');
  const rules = new Set(inputs.model.invariants.map(r => r.id));
  for (const item of contracts.values()) if (item.machineSource) source({ path: item.machineSource }, 'framework', 'contracts', item.contractId);
  const knownRoutes = new Set(inputs.navigation.routes.map(r => r.route));
  for (const route of routes.values()) for (const parent of route.parentRoutes) if (!knownRoutes.has(parent)) fail('framework', 'route', route.routeId, `Unknown parent ${parent}`);
  for (const { page, host } of registrations(inputs.register)) {
    const id = page.pageId;
    if (host) source(host.factSource, id, 'scaffold', 'host.factSource');
    if (host && host.factSource.path !== page.source.path && !(page.sourceInputs ?? []).some(ref => ref.path === host.factSource.path)) fail(id, 'scaffold', 'host.factSource', 'Mounting source must be covered by a source fingerprint');
    source(page.source, id, 'measurement', 'source');
    const paths = new Set();
    for (const [i, ref] of (page.sourceInputs ?? []).entries()) {
      const field = `sourceInputs[${i}]`;
      source(ref, id, 'measurement', field);
      if (paths.has(ref.path)) fail(id, 'measurement', field, `Duplicate input path ${ref.path}`);
      paths.add(ref.path);
      try { if (digest(ref.path) !== ref.sha256) fail(id, 'measurement', field, `Input changed: ${ref.path}`, 'SOURCE_DRIFT'); }
      catch (error) { fail(id, 'measurement', field, error.message); }
    }
    const route = routes.get(page.routeContractRef);
    if (!route) fail(id, 'route', 'routeContractRef', `Unknown route ${page.routeContractRef}`);
    else {
      const facts = page.layers.route.facts;
      for (const key of ['parentRoutes','entrySources','backPolicy','restorePolicy','systemBackOwner','platformHostRefs','status','unresolvedRefs']) {
        const actual = facts[key], expected = route[key];
        const normalized = value => JSON.stringify(Array.isArray(value) ? [...value].sort() : value);
        if (normalized(actual) !== normalized(expected)) fail(id, 'route', key, `Route field differs from ${page.routeContractRef}`);
      }
      for (const [key, actual] of Object.entries(facts.retention)) if (route.retention[key] !== actual) fail(id, 'route', `retention.${key}`, 'Retention must reference the owning registry without inventing policy');
    }
    for (const [domain, field] of [['route', 'routeContractRef'], ['control', 'controlRefs'], ['operation', 'operationRefs'], ['platform', 'platformHosts'], ['a11y', 'layers.accessibility'], ['message', 'messageSurfaces']]) {
      if (!contracts.has(domain)) fail(id, domain, field, `No contract map owner for ${domain}`);
    }
    const refs = page.controlRefs ?? [];
    for (const ref of refs) if (!controls.has(ref)) fail(id, 'interaction', 'controlRefs', `Unknown control ${ref}`);
    if (new Set(refs).size !== refs.length) fail(id, 'interaction', 'controlRefs', 'Duplicate control references');
    for (const [layer, entry] of Object.entries(page.layers)) for (const ref of entry.facts.controlRefs ?? []) {
      if (!refs.includes(ref)) fail(id, layer, 'controlRefs', `Layer reference absent from page control set: ${ref}`);
    }
    for (const ref of page.platformHosts) {
      const host = hosts.get(ref.hostRef);
      if (!host || host.hostId !== ref.hostId) fail(id, 'overlay', 'platformHosts.hostRef', `Unknown/mismatched host ${ref.hostRef}`);
      if (!ref.identity || !ref.returnContext) fail(id, 'overlay', 'platformHosts', 'Host needs captured identity and return context', 'G-13');
      const operation = page.operationRefs.find(o=>o.operationId===ref.intent);
      if (!operation || ref.businessOwner !== operation.owner) fail(id,'overlay','platformHosts.businessOwner','Business owner must match the initiating operation owner');
      if (host && [...ref.resultPolicy].sort().join('|') !== [...host.resultPolicy].sort().join('|')) fail(id,'overlay','platformHosts.resultPolicy','Result policy differs from platform host registry');
    }
    const sorted = a => [...a].sort().join('|');
    if (sorted(page.brief.platformSet) !== sorted(new Set(page.platformHosts.map(h => h.hostId)))) fail(id, 'overlay', 'brief.platformSet', 'Brief and host categories differ');
    const routeHosts = page.layers.route.facts.platformHostRefs ?? [];
    if (sorted(routeHosts) !== sorted(page.platformHosts.map(h => h.hostRef))) fail(id, 'route', 'platformHostRefs', 'Route and page host references differ');
    for (const ref of page.messageSurfaces) {
      const actual = messages.get(ref.entryId);
      if (!actual) fail(id, 'states', 'messageSurfaces.entryId', `Unknown message ${ref.entryId}`);
      else if (ref.family && ref.family !== actual.family) fail(id, 'states', 'messageSurfaces.family', 'Message family conflicts with owning registry');
    }
    for (const scope of page.retainedScopeRefs ?? []) {
      const retained = inputs.messages.retainedScopes?.find(r=>r.scope===scope);
      if (!retained) fail(id,'overlay','retainedScopeRefs',`Missing retained scope ${scope}`);
      else if (retained.authority !== page.source.path) fail(id,'overlay','retainedScopeRefs',`Retained scope belongs to another source: ${scope}`);
    }
    const operationIds = new Set();
    for (const ref of page.operationRefs) {
      if (operationIds.has(ref.operationId)) fail(id, 'dataLifecycle', 'operationRefs', `Duplicate operation owner ${ref.operationId}`, 'DUPLICATE_OWNER');
      operationIds.add(ref.operationId);
      if (!ref.owner || ref.bindingStatus === 'unbound') fail(id, 'dataLifecycle', ref.operationId, 'Unbound operation', 'G-14');
      if (ref.bindingStatus === 'partial' && !ref.knownGap) fail(id, 'dataLifecycle', ref.operationId, 'Partial binding needs knownGap');
      source(ref.factSource, id, 'dataLifecycle', `${ref.operationId}.factSource`);
    }
    for (const ref of page.layers.interaction.facts.actionStates ?? []) if (!page.controlRefs.includes(ref.controlRef)) fail(id,'interaction','actionStates.controlRef',`Unregistered action control ${ref.controlRef}`);
    for (const ref of page.layers.accessibility.facts.ruleRefs ?? []) if (!rules.has(ref)) fail(id, 'accessibility', 'ruleRefs', `Unknown a11y rule ${ref}`);
    const expected = { contractMap: inputs.contracts.revision, navigation: inputs.navigation.revision, control: inputs.controls.revision, platform: inputs.platform.revision };
    for (const [key, revision] of Object.entries(expected)) if (page.registryRevisions[key] !== revision) fail(id, 'contracts', `registryRevisions.${key}`, `Expected consumed revision ${revision}`);
    for (const exceptionId of page.exceptions) if (!inputs.exceptions.exceptions.some(e => e.id === exceptionId && e.pageId === id)) fail(id, 'contracts', 'exceptions', `Unknown exception ${exceptionId}`);
  }
  return diagnostics;
}
if (isMain(import.meta.url)) {
  try { printReport('check-contract-refs', checkContractRefs(), { boundary: 'Declaration/reference integrity only; manual upstream behavior remains NOT_RUN.' }); }
  catch (error) { printReport('check-contract-refs', [diagnostic('INPUT', 'framework', null, '', error.message)]); }
}
