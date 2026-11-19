import { readFileSync, readdirSync } from 'node:fs';
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

export function toolIdentity() {
  const tracked = [];
  function walk(url, path) {
    for (const item of readdirSync(url, { withFileTypes: true })) {
      const name = `${path}${item.name}`;
      if (item.isDirectory() && ['lib','collectors','schema'].includes(item.name)) {
        walk(new URL(`${item.name}/`, url), `${name}/`);
      } else if (item.isDirectory() && path.startsWith('collectors/')) {
        walk(new URL(`${item.name}/`, url), `${name}/`);
      } else if (item.isFile() && /\.(mjs|json)$/.test(item.name)) tracked.push(name);
    }
  }
  walk(toolRoot, '');
  tracked.push('../lib/native-ui-evidence.mjs', '../reader-control-device-probe.mjs',
    '../reader-hdc-lease.mjs', '../reader-hdc-foreground.mjs', '../page-structure/register.json',
    '../../scripts/hap-pipeline.mjs', '../../scripts/lib/hap-delivery-evidence.mjs', '../../scripts/lib/app-build-identity.mjs');
  const inputs = tracked.sort().map(path => ({ path, sha256: sha256(readFileSync(new URL(path, toolRoot))) }));
  return { version: 'phase0.1', sha256: jsonDigest(inputs) };
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
