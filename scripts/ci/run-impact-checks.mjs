#!/usr/bin/env node
import { execFileSync, spawnSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { journeys } from '../lib/vm-journey-cases.mjs';
import { affectedHostDomains, committedHostChanges, isHostDocument, suggestedVmJourneys } from '../test-host.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const nodePaths = ['scripts', 'tests', 'tools'].flatMap(directory =>
  ['js', 'cjs', 'mjs', 'ts', 'cts', 'mts'].map(extension => `:(glob)${directory}/**/*.${extension}`));
// Split the literal markers so the detector can also scan this file.
const arkUI = /\bViewP[U]\b|@Build[e]r\b/;
const layoutSourceRegex = /\\+\.(?:width|height|size|padding|margin|position|translate|offset|constraintSize|alignItems|alignContent|layoutWeight|enabled|opacity|visibility|hitTestBehavior)\b/;

function checkAddedNodeLines(base, head) {
  const patch = execFileSync('git', ['diff', '--no-ext-diff', '--no-textconv', '--no-color', '--no-renames',
    '--unified=0', base, head, '--', ...nodePaths], { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  let file = '';
  let inHunk = false;
  for (const line of patch.split('\n')) {
    if (line.startsWith('diff --git ')) inHunk = false;
    else if (line.startsWith('@@ ')) inHunk = true;
    else if (!inHunk && line.startsWith('+++ ')) file = line.slice(4);
    else if (inHunk && line.startsWith('+') && (arkUI.test(line) || layoutSourceRegex.test(line))) {
      throw new Error(`${file} adds an ArkUI simulation marker or a source layout regex; use pure Host state or native VM evidence`);
    }
  }
}

function main() {
  const { values } = parseArgs({ options: {
    base: { type: 'string' }, head: { type: 'string', default: 'HEAD' },
    'summary-file': { type: 'string' }, 'output-file': { type: 'string' }, help: { type: 'boolean' },
  } });
  if (values.help) {
    console.log('Usage: node scripts/ci/run-impact-checks.mjs --base <treeish> [--head <checked-out commit>] [--summary-file <path>] [--output-file <path>]');
    return;
  }
  if (!values.base) throw new Error('Provide --base');
  const { base, head, paths } = committedHostChanges(values.base, values.head);
  const nonDocument = paths.filter(path => !isHostDocument(path));
  const designContractPaths = [
    'tests/navigation-geometry/design-size-contract.json',
    'entry/src/main/ets/ui/layout/LayoutInvariantNativeAudit.ts',
  ];
  const designContractChanged = nonDocument.some(path => designContractPaths.includes(path));
  const selected = affectedHostDomains(nonDocument);
  const suggested = suggestedVmJourneys(nonDocument);
  const journeyArgs = suggested.length === Object.keys(journeys).length ? '--all' :
    suggested.map(journey => `--journey ${journey}`).join(' ');
  let executed = 0;
  let failure = '';
  try {
    checkAddedNodeLines(base, head);
    if (designContractChanged) {
      console.log('NOTICE: Design contract / R12 budget modified — confirm approved design spec before merging.');
    }
    if (selected.length > 0) {
      const outcome = spawnSync(process.execPath, ['scripts/test-host.mjs', '--changed-from', base, '--committed'],
        { cwd: root, stdio: 'inherit' });
      if (outcome.pid) executed = selected.length;
      if (outcome.error) throw outcome.error;
      if (outcome.status !== 0) throw new Error(outcome.signal ? `received ${outcome.signal}` : `exit ${outcome.status}`);
    }
  } catch (error) { failure = error.message; }

  const status = failure ? 'FAIL' : executed ? 'PASS' : 'NOT_RUN';
  const report = `${status} — Host incremental checks${failure ? ` (${failure})` : ''}\n\n` +
    `Non-document paths: ${nonDocument.length}\nHost domains selected: ${selected.length}, executed: ${executed}` +
    (selected.length > 0 ? `\nSelected: ${selected.join(', ')}` : '') +
    `\nDesign contract modified: ${designContractChanged}` +
    `\nSuggested VM journeys: ${suggested.join(', ') || 'none'}` +
    (journeyArgs ? `\nVM journey arguments: ${journeyArgs}` : '');
  console.log(report);
  if (values['summary-file']) appendFileSync(values['summary-file'], `\n## ${report}\n`);
  if (values['output-file']) appendFileSync(values['output-file'],
    `non_document=${nonDocument.length > 0}\nselected=${selected.length}\nexecuted=${executed}\n` +
    `design_contract_changed=${designContractChanged}\n` +
    `suggested_vm_journeys=${suggested.join(',') || 'none'}\n` +
    (journeyArgs ? `suggested_vm_journey_args=${journeyArgs}\n` : ''));
  if (failure) process.exitCode = 1;
}

try { main(); }
catch (error) {
  console.error(`FAIL — Host incremental checks (${error.message})`);
  process.exitCode = 1;
}
