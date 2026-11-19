import { lstatSync, readFileSync, readdirSync } from 'node:fs';
import { posix } from 'node:path';
import { canonicalAppJson } from '../../../scripts/lib/app-build-identity.mjs';
import { jsonDigest, requireEvidence, sha256, validate } from './evidence.mjs';

const ids = ['bookshelf.search-input-ime', 'reading.control-open-motion'];
export const caseIds = Object.freeze(ids);
export const toolRoot = new URL('../', import.meta.url);

export function loadCase(id) {
  requireEvidence(ids.includes(id), 'Select one exact registered --case');
  const contract = validate('case', JSON.parse(readFileSync(new URL(`cases/${id}.json`, toolRoot), 'utf8')));
  requireEvidence(contract.id === id, 'Case file identity differs from its registration');
  const from = new Set();
  for (const step of contract.steps) {
    if (step.kind === 'action') {
      requireEvidence(from.has(step.from) && (step.op === 'keyEvent') === (step.target === undefined),
        `Action ${step.id} must follow one previously measured target state`);
    } else from.add(step.id);
  }
  requireEvidence(Boolean(contract.fixture.inputWord) !== Boolean(contract.fixture.bookTitle),
    'Case requires exactly one public fixture kind');
  for (const list of [contract.steps, contract.assertions]) {
    requireEvidence(list.every(item => typeof item.id === 'string' && item.id) &&
      new Set(list.map(item => item.id)).size === list.length, 'Case contains missing or duplicated IDs');
  }
  return contract;
}

export function replayToolFiles(root = toolRoot) {
  const tracked = [];
  function walk(path, dependency = false) {
    for (const item of readdirSync(new URL(path, root), { withFileTypes: true })) {
      const name = path === './' ? item.name : `${path}${item.name}`;
      if (item.isDirectory() && (dependency || ['cases','lib','collectors','schema'].includes(item.name) ||
        path.startsWith('collectors/'))) {
        walk(`${name}/`, dependency);
      } else if (item.isFile() && (dependency || /\.(mjs|json)$/.test(item.name))) {
        tracked.push(name);
      } else if (dependency && !item.isDirectory()) {
        throw new Error(`Unsupported installed dependency file type: ${name}`);
      }
    }
  }
  walk('./');
  tracked.push('README.md', '../lib/native-ui-evidence.mjs', '../reader-control-device-probe.mjs',
    '../reader-hdc-lease.mjs', '../reader-hdc-foreground.mjs', '../page-structure/register.json',
    '../../scripts/hap-pipeline.mjs', '../../scripts/lib/hap-delivery-evidence.mjs', '../../scripts/lib/app-build-identity.mjs');
  const lock = JSON.parse(readFileSync(new URL('package-lock.json', root), 'utf8'));
  for (const [path, metadata] of Object.entries(lock.packages)) {
    if (path === '') continue;
    requireEvidence(path.startsWith('node_modules/') && path === posix.normalize(path) && !path.includes('\\') &&
      typeof metadata.version === 'string' && lstatSync(new URL(path, root)).isDirectory(),
    `Invalid locked dependency location: ${path}`);
    const installed = JSON.parse(readFileSync(new URL(`${path}/package.json`, root), 'utf8'));
    requireEvidence(installed.version === metadata.version, `Installed version differs from package lock: ${path}`);
    walk(`${path}/`, true);
  }
  return [...new Set(tracked)].sort();
}

export function toolIdentity(root = toolRoot) {
  const inputs = replayToolFiles(root).map(path => ({ path, sha256: sha256(readFileSync(new URL(path, root))) }));
  return { version: 'phase0.2', sha256: jsonDigest(inputs) };
}

export function pageStatus(pageId) {
  const register = JSON.parse(readFileSync(new URL('../page-structure/register.json', toolRoot), 'utf8'));
  const registered = register.pages.find(page => page.pageId === pageId);
  return { id: pageId, registration: registered ? 'REGISTERED_PAGE' : 'UNREGISTERED_PAGE' };
}

export const sources = Object.freeze({
  'native-tree': ['normal Reader window', 'accessibility ID', 'native bounds px', 'exposed node states'],
  'window-metrics': ['window revision', 'window rect and density', 'native keyboard rectangles and insets'],
  'app-input': ['editor mount and focus', 'length and selection', 'search button intent'],
  'app-owner': ['accepted query revision', 'result settlement', 'reader control session and commits'],
  'debug-frame': ['runtime frame callback', 'native fields as read', 'field availability', 'read overhead'],
});

export function platformCapabilities(platform) {
  requireEvidence(['harmonyos','android','ios'].includes(platform), 'Unknown collector platform');
  return Object.fromEntries(Object.entries(sources).map(([source, fields]) => [source, {
    status: platform === 'harmonyos' ? 'AVAILABLE_BY_FIELD' : 'UNSUPPORTED',
    fields: platform === 'harmonyos' ? fields : [],
  }]));
}

export function planCase(contract, platform) {
  return { caseId: contract.id, caseVersion: contract.version, caseSha256: jsonDigest(contract),
    mode: 'DRY_RUN', execution: 'NOT_RUN', platform, fixture: contract.fixture, page: pageStatus(contract.pageId),
    capabilities: platformCapabilities(platform), steps: contract.steps,
    assertions: contract.assertions.map(assertion => ({ ...assertion, verdict: 'NOT_RUN' })) };
}

export const equalJson = (left, right) => canonicalAppJson(left) === canonicalAppJson(right);
