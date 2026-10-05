import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const repo = resolve(new URL('..', import.meta.url).pathname);
const index = readFileSync(resolve(repo, 'entry/src/main/ets/pages/Index.ets'), 'utf8');
const host = readFileSync(resolve(repo, 'entry/src/main/ets/features/search/SearchHost.ets'), 'utf8');

assert.match(index, /import \{ SearchHost \} from ['"]\.\.\/features\/search\/SearchHost['"]/,
  'Index must depend on the Search host boundary');
assert.doesNotMatch(index, /import .*SearchOrchestrator/,
  'Index must not construct or import the Search orchestrator');
assert.doesNotMatch(index, /private getSearchOrchestrator\(/,
  'Index must not own Search orchestrator construction');
for (const method of ['prepareEntry', 'open', 'search', 'stop', 'retry', 'retryHistory',
  'clearHistory', 'resume', 'refreshSources', 'visibilityChanged']) {
  assert.match(host, new RegExp(`\\b${method}\\(`), `SearchHost must expose ${method}`);
}
assert.match(host, /new SearchOrchestrator\(/,
  'SearchHost must be the single SearchOrchestrator construction site');
assert.match(host, /new SearchGateway|SearchOrchestrator/,
  'Search host must retain the gateway/orchestrator feature boundary');
assert.match(host, /publication\.updateShelf\(books\)/,
  'Search shelf snapshot updates must pass through the host');
assert.match(index, /this\.searchHost\.updateShelf\(/,
  'Index must forward shelf snapshots to SearchHost');
console.log('Search host wiring: PASS (Index dispatch boundary and single orchestrator owner)');
