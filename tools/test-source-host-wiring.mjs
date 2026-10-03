import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const repo = resolve(new URL('..', import.meta.url).pathname);
const index = readFileSync(resolve(repo, 'entry/src/main/ets/pages/Index.ets'), 'utf8');
const host = readFileSync(resolve(repo, 'entry/src/main/ets/features/source/SourceHost.ets'), 'utf8');

assert.match(index, /import \{[\s\S]*SourceHost[\s\S]*\} from ['"]\.\.\/features\/source\/SourceHost['"]/,
  'Index must depend on the Source host boundary');
assert.doesNotMatch(index, /import[^\n]*SourceOrchestrator/,
  'Index must not construct or import the Source orchestrator');
assert.doesNotMatch(index, /private getSourceOrchestrator\(/,
  'Index must not own Source orchestrator construction');
for (const method of ['open', 'retryLoad', 'toggleSource', 'checkSource', 'loginSource', 'importBookSources']) {
  assert.match(host, new RegExp(`\\b${method}\\(`), `SourceHost must expose ${method}`);
}
for (const method of ['loadSourcesForIds', 'loadSources']) {
  assert.match(host, new RegExp(`\\b${method}\\(`), `SourceHost must expose ${method}`);
}
assert.match(host, /SourceOrchestrator\.forRuntime\(owner\)/,
  'SourceHost obtains the one original-runtime owner');
assert.doesNotMatch(host, /new SourceOrchestrator\(/, 'recreated presentation must not duplicate the business chain');
const orchestrator = readFileSync(resolve(repo, 'entry/src/main/ets/features/source/SourceOrchestrator.ets'), 'utf8');
assert.equal([...orchestrator.matchAll(/new SourceOrchestrator\(/g)].length, 1, 'only the finite runtime factory constructs its owner');
assert.match(orchestrator, /owners: WeakMap<ReaderRuntimeOwner, SourceOrchestrator>/);
assert.match(host, /private readonly owner: \(\) => ReaderRuntimeOwner/,
  'SourceHost must resolve the runtime owner lazily');
assert.match(index, /if \(this\.bindSourceManagement\(\)\) this\.sourceHost\.open\(this\.sourcePresentationIdentity\)/,
  'Index opens the original owner only after attaching the exact current presentation');
for (const call of ['host.retryLoad(identity)', 'host.toggleSource(id, enabled, identity)',
  'host.checkSource(id, identity)', 'host.loginSource(id, identity)', 'host.reconcile(expected, identity)']) {
  assert.ok(index.includes(call), `Index forwards ${call} with its captured presentation identity`);
}
assert.match(index, /source\.importBookSources\([\s\S]*sourceIdentity,\s*\);/,
  'JSON import keeps the original Source host and identity through the asynchronous picker');
assert.match(index, /private sourceManagementSurface\(generation: number, owner: ReaderRuntimeOwner \| undefined,[\s\S]*mounting: number, host: SourceHost, identity: string\)/);
assert.match(index, /host\.isPresentationCurrent\(owner, identity\)/,
  'same Runtime replacement must reject the alive old physical consumer');
assert.doesNotMatch(index, /new SourceGateway\(/,
  'Index must not construct SourceGateway for display or admitted-book projections');
assert.match(index, /sourceSources = sources/,
  'Index must retain the existing source list projection');
assert.match(index, /sourceStatusKind = kind/,
  'Index must retain the existing source status projection');
console.log('Source host wiring: PASS (Index dispatch boundary and source projections retained)');

const entry = readFileSync(resolve(repo, 'entry/src/main/ets/features/reading/ReadingEntryHost.ts'), 'utf8');
assert.match(entry, /new SourceGateway\(this\.runtime\)\.loadSources\(session\.identity\.sourceId\)/);
assert.match(entry, /source\.sourceId === session\.identity\.sourceId/);

const shelfHost=readFileSync(resolve(repo,'entry/src/main/ets/features/bookshelf/BookshelfHost.ets'),'utf8');
const shelfProjection=readFileSync(resolve(repo,'entry/src/main/ets/features/bookshelf/BookshelfProjectionOwner.ts'),'utf8');
assert.match(shelfHost, /new SourceGateway\(owner\)\.loadSourcesForIds\(ids, current\)/);
assert.match(shelfProjection, /this\.loadSources\(books\.map\(book => book\.sourceId\), current\)/);
