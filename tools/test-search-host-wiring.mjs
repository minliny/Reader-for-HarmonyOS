import { localFilePath } from './lib/tool-environment.mjs';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { resolve } from 'node:path';

const repo = resolve(localFilePath(new URL('..', import.meta.url)));
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
assert.match(host,
  /\(sources: SearchSource\[\]\): void => \{[\s\S]*?publication\.updateSources\(sources\);[\s\S]*?this\.advanceRevision\(\);/,
  'Search source snapshots must advance the publication revision');

// Exercise the production SearchHost callback directly with a tiny
// orchestrator/publication boundary. This catches a regression where the
// source list is updated but the mounted SearchPage never receives a new
// numeric publication revision.
const hostModuleSource = host
  .replace(/^import[^;]+;\s*/gm, '')
  .replace(/^export /gm, '');
const hostProbeSource = `
class SearchViewState { reset() {} requestInputFocus() {} }
class SearchPublication {
  updateSources(sources) { this.sources = sources; }
  sourcesAt() { return this.sources ?? []; }
  updateShelf() {}
  presentationAt() { return {}; }
}
class SearchOrchestrator {
  constructor(emitPresentation, emitSources) {
    this.emitPresentation = emitPresentation;
    this.emitSources = emitSources;
  }
}
${hostModuleSource}
export { SearchHost };
`;
const hostModule = await import(`data:text/javascript;base64,${Buffer.from(
  stripTypeScriptTypes(hostProbeSource)).toString('base64')}`);
let publicationChanges = 0;
const hostProbe = new hostModule.SearchHost(() => { publicationChanges += 1; }, () => true);
const orchestratorProbe = hostProbe.getOrchestrator();
orchestratorProbe.emitSources([{ sourceId: 'source-a', name: '源甲', enabled: true }]);
assert.equal(publicationChanges, 1, 'source publication must notify the mounted page');
assert.equal(hostProbe.sources()[0].sourceId, 'source-a', 'source publication must retain the refreshed ID');
console.log('Search host wiring: PASS (Index dispatch boundary and single orchestrator owner)');
