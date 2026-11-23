import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { diagnostic, safePath, digest, readJSON, schemaValidator } from './lib.mjs';
import { sourceE2InventoryPath } from './source-e2-admission.mjs';

// This finite evidence adapter validates SDK property / measurement reports.
// It never claims pointer dispatch, clipping or rendered pixels from dimensions.
const widths = [320, 366], fontScales = [1, 1.3, 1.6, 2];
const sharedInputs = [
  'entry/src/main/ets/ui/controls/ReaderButton.ets',
  'entry/src/main/ets/ui/controls/ReaderControlSpecs.ets',
  'entry/src/main/ets/ui/foundation/ReaderTypography.ets',
  'entry/src/main/ets/ui/foundation/ReaderSurfaceResolvers.ts',
];
export const sourceInteractiveControls = [
  'page-back', 'source-tools', 'source-add-inline', 'source-search', 'source-filter-chip',
  'source-group-select', 'source-login', 'source-detect', 'source-toggle', 'footer-batch', 'footer-add',
  'source-category-chip', 'source-group-option', 'source-status-action', 'source-read-refresh',
  'source-read-retry', 'source-filter-clear', 'source-original-reconcile', 'source-original-continue',
  'source-original-expand', 'source-unknown-reconcile', 'source-unknown-expand',
];
let validate, validateNative;
function validator() {
  if (!validate) validate = schemaValidator().ajv.compile(readJSON('tools/page-structure/schema/layout-evidence.schema.json'));
  return validate;
}
function nativeValidator() {
  if (!validateNative) validateNative = schemaValidator().ajv.compile(readJSON('tools/page-structure/schema/layout-evidence.schema.json').definitions.nativeManifest);
  return validateNative;
}
export function checkLayoutEvidence(page, { bindSource = true, read = path => readFileSync(safePath(path), 'utf8'), fingerprint = digest } = {}) {
  const diagnostics = [], fail = (id, field, message) => diagnostics.push(diagnostic(id, page.pageId, 'adaptation', field, message));
  const claimedPass = ['E2', 'E3'].filter(id => page.invariants[id]?.result === 'PASS');
  if (!page.layoutEvidence) {
    if (claimedPass.length) fail('LAYOUT_EVIDENCE_REQUIRED', 'layoutEvidence', `PASS requires bound layout evidence: ${claimedPass.join(', ')}`);
    return { diagnostics, report: null };
  }
  if (!bindSource) {
    if (claimedPass.length) fail('LAYOUT_EVIDENCE_UNBOUND', 'layoutEvidence', 'Cannot accept E2/E3 PASS with bindSource=false');
    return { diagnostics, report: null };
  }
  let report;
  try {
    const bytes = read(page.layoutEvidence.path);
    const hash = createHash('sha256').update(bytes).digest('hex');
    if (hash !== page.layoutEvidence.sha256) fail('LAYOUT_EVIDENCE_DRIFT', 'layoutEvidence.sha256', 'Report bytes differ from registration');
    report = JSON.parse(bytes);
    const validate = validator();
    if (!validate(report)) {
      for (const error of validate.errors) fail('LAYOUT_EVIDENCE_SCHEMA', error.instancePath, error.message);
      return { diagnostics, report: null };
    }
    if (report.pageId !== page.pageId) fail('LAYOUT_EVIDENCE_SUBJECT', 'pageId', 'Report belongs to another page');
    const inputs = new Map();
    for (const input of report.inputs) {
      if (inputs.has(input.path)) fail('LAYOUT_EVIDENCE_INPUT', 'inputs', `Duplicate input ${input.path}`);
      inputs.set(input.path, input.sha256);
      if (fingerprint(input.path) !== input.sha256) fail('LAYOUT_EVIDENCE_DRIFT', input.path, 'Probe input changed after evidence was captured');
    }
    for (const path of [page.source.path, report.command.entry, ...sharedInputs]) if (!inputs.has(path)) fail('LAYOUT_EVIDENCE_INPUT', 'inputs', `Missing subject/shared input ${path}`);
    if (inputs.get(page.source.path) !== page.source.sha256) fail('LAYOUT_EVIDENCE_SUBJECT', 'inputs', 'Report/source registration fingerprints differ');
    for (const width of widths) if (!report.widths.includes(width)) fail('LAYOUT_EVIDENCE_COVERAGE', 'widths', `Missing width ${width}`);
    for (const scale of fontScales) if (!report.fontScales.includes(scale)) fail('LAYOUT_EVIDENCE_COVERAGE', 'fontScales', `Missing font scale ${scale}`);
    const checkMatrix = (rows, ids, key) => {
      const seen = new Set();
      for (const row of rows) {
        const identity = `${row[key]}:${row.width}:${row.fontScale}`;
        if (seen.has(identity)) fail('LAYOUT_EVIDENCE_COVERAGE', key, `Duplicate sample ${identity}`);
        seen.add(identity);
        if (!report.widths.includes(row.width) || !report.fontScales.includes(row.fontScale)) fail('LAYOUT_EVIDENCE_COVERAGE', key, `Sample outside declared matrix ${identity}`);
      }
      for (const id of ids) for (const width of report.widths) for (const scale of report.fontScales) if (!seen.has(`${id}:${width}:${scale}`)) fail('LAYOUT_EVIDENCE_COVERAGE', key, `Missing sample ${id}:${width}:${scale}`);
    };
    const targetIds = [...new Set(report.targets.map(row => row.controlRef))];
    for (const id of targetIds) if (!page.controlRefs.includes(id)) fail('LAYOUT_EVIDENCE_SUBJECT', 'targets.controlRef', `Unknown page control ${id}`);
    checkMatrix(report.targets, targetIds, 'controlRef');
    checkMatrix(report.budgets, ['row', 'chip', 'footer'], 'region');
    if (report.results.E2 === 'PASS') {
      if (!targetIds.length) fail('LAYOUT_EVIDENCE_COVERAGE', 'targets', 'No target dimensions measured');
      for (const target of report.targets) {
        const size = target.response ?? target.visual ?? target.minimum;
        if (size.width < 44 || size.height < 44) fail('E2', 'targets', `${target.controlRef} target is smaller than 44×44 at ${target.width}/${target.fontScale}`);
      }
    }
    if (report.results.E3 === 'PASS') {
      for (const budget of report.budgets) {
        if (budget.measurementKind !== 'native') fail('LAYOUT_EVIDENCE_LEVEL', 'budgets.measurementKind', 'SDK fixture/property evidence cannot prove native fp text layout');
        if (budget.requiredWidth > budget.availableWidth || budget.requiredHeight > budget.availableHeight) fail('E3', 'budgets', `${budget.region} overflows at ${budget.width}/${budget.fontScale}`);
      }
      // A manifest hash binds a frozen receipt; it is not cryptographic proof
      // that native collection occurred. Provider provenance remains reviewed.
      if (!report.nativeEvidence) fail('LAYOUT_NATIVE_EVIDENCE_REQUIRED', 'nativeEvidence', 'Native E3 PASS needs a frozen native measurement manifest, not only measurementKind');
      else {
        try {
          const nativeBytes = read(report.nativeEvidence.path);
          if (createHash('sha256').update(nativeBytes).digest('hex') !== report.nativeEvidence.sha256) fail('LAYOUT_NATIVE_EVIDENCE_DRIFT', 'nativeEvidence.sha256', 'Native manifest bytes differ from frozen reference');
          const manifest = JSON.parse(nativeBytes), nativeValidate = nativeValidator();
          if (!nativeValidate(manifest)) {
            for (const error of nativeValidate.errors) fail('LAYOUT_NATIVE_EVIDENCE_SCHEMA', error.instancePath, error.message);
          } else {
            if (manifest.pageId !== page.pageId) fail('LAYOUT_NATIVE_EVIDENCE_SUBJECT', 'nativeEvidence.pageId', 'Native manifest belongs to another page');
            for (const width of report.widths) if (!manifest.widths.includes(width)) fail('LAYOUT_NATIVE_EVIDENCE_COVERAGE', 'nativeEvidence.widths', `Native manifest lacks width ${width}`);
            for (const scale of report.fontScales) if (!manifest.fontScales.includes(scale)) fail('LAYOUT_NATIVE_EVIDENCE_COVERAGE', 'nativeEvidence.fontScales', `Native manifest lacks scale ${scale}`);
            const nativeInputs = new Map();
            for (const input of manifest.inputs) {
              if (nativeInputs.has(input.path)) fail('LAYOUT_NATIVE_EVIDENCE_INPUT', 'nativeEvidence.inputs', `Duplicate native input ${input.path}`);
              nativeInputs.set(input.path, input.sha256);
              if (fingerprint(input.path) !== input.sha256) fail('LAYOUT_NATIVE_EVIDENCE_DRIFT', input.path, 'Native measurement input changed');
            }
            for (const input of report.inputs.filter(input => !input.path.startsWith('tools/'))) {
              if (nativeInputs.get(input.path) !== input.sha256) fail('LAYOUT_NATIVE_EVIDENCE_INPUT', input.path, 'Native manifest lacks matching production input fingerprint');
            }
            const samples = new Map();
            for (const sample of manifest.samples) {
              const key = `${sample.region}:${sample.width}:${sample.fontScale}`;
              if (samples.has(key)) fail('LAYOUT_NATIVE_EVIDENCE_COVERAGE', 'nativeEvidence.samples', `Duplicate native sample ${key}`);
              samples.set(key, sample);
            }
            for (const budget of report.budgets) {
              const key = `${budget.region}:${budget.width}:${budget.fontScale}`, sample = samples.get(key);
              if (!sample) fail('LAYOUT_NATIVE_EVIDENCE_COVERAGE', 'nativeEvidence.samples', `Native measurement lacks ${key}`);
              else if (sample.requiredWidth !== budget.requiredWidth || sample.requiredHeight !== budget.requiredHeight) fail('LAYOUT_NATIVE_EVIDENCE_SUBJECT', 'nativeEvidence.samples', `Native measurement and budget differ for ${key}`);
            }
          }
        } catch (error) { fail('LAYOUT_NATIVE_EVIDENCE_INPUT', 'nativeEvidence', error.message); }
      }
    }
    for (const id of claimedPass) if (report.results[id] !== 'PASS') fail('LAYOUT_EVIDENCE_RESULT', `results.${id}`, 'Page PASS is unsupported by probe result');
    if (claimedPass.includes('E2')) {
      if (page.pageId === 'source-management') {
        const composer = 'tools/page-structure/source-e2-evidence.mjs';
        const requiredInputs = [composer,sourceE2InventoryPath,'tools/page-structure/evidence/source-layout-matrix.json',
          'tools/page-structure/evidence/source-interaction.json'];
        if (report.command.entry !== composer || report.command.cases.length !== 1 ||
            report.command.cases[0] !== 'complete-targets' || requiredInputs.some(path=>!inputs.has(path))) {
          fail('LAYOUT_EVIDENCE_PROVENANCE', 'layoutEvidence', 'Source E2 requires its current bound SDK matrix and interaction report');
        }
        if (report.results.E2 === 'PASS') {
          const group = report.sourceE2ReceiptGroup;
          const registered = (page.invariants.E2.evidence ?? []).some(item =>
            item.kind === 'device' && item.result === 'PASS' && item.symbol === 'ui-contract-receipt-group' &&
            item.path === group?.path && item.rootSha256 === group?.sha256);
          if (!registered || fingerprint(group.path) !== group.sha256) {
            fail('LAYOUT_EVIDENCE_PROVENANCE', 'sourceE2ReceiptGroup', 'Source E2 requires the same pinned native receipt group in its report and registration');
          }
        }
      }
      const required = page.pageId === 'source-management' ? sourceInteractiveControls.filter(id => page.controlRefs.includes(id)) : page.controlRefs;
      for (const id of required) if (!targetIds.includes(id)) fail('LAYOUT_EVIDENCE_COVERAGE', 'targets', `Whole-page E2 PASS lacks ${id}; scoped SDK target PASS is not whole-page PASS`);
      const declaredScope = page.layers.interaction.facts.targets?.controlRefs;
      if (declaredScope) for (const id of required) if (!declaredScope.includes(id)) fail('LAYOUT_EVIDENCE_COVERAGE', 'layers.interaction.facts.targets.controlRefs', `Scoped minimum excludes ${id}; local 44×44 cannot be a whole-page minimum`);
    }
  } catch (error) { fail('LAYOUT_EVIDENCE_INPUT', 'layoutEvidence', error.message); }
  return { diagnostics, report };
}
