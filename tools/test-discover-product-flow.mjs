import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(resolve(repo, path), 'utf8');

const gateway = read('entry/src/main/ets/features/discover/DiscoverGateway.ts');
const orchestrator = read('entry/src/main/ets/features/discover/DiscoverOrchestrator.ets');
const page = read('entry/src/main/ets/features/discover/DiscoverPage.ets');
const index = read('entry/src/main/ets/pages/Index.ets');

assert.match(gateway, /request\('source\.exploreKinds', \{ sourceId \}\)/);
assert.match(gateway, /request\('source\.explore', \{ sourceId, url, page \}\)/);
assert.match(gateway, /page must be a positive safe integer/);
assert.match(orchestrator, /source\.enabled && source\.enabledExplore/);
assert.match(orchestrator, /private operationTail: Promise<void> = Promise\.resolve\(\)/);
assert.match(orchestrator, /loadPage\(session, index, 1, false\)/);
assert.match(orchestrator, /this\.presentation\.page \+ 1/);
assert.match(orchestrator, /this\.presentation\.page - 1/);
assert.match(orchestrator, /probingNext && books\.length === 0/);
assert.doesNotMatch(page, /@State private activeCategory/);
assert.match(page, /onSelectKind: \(index: number\) => void/);
assert.match(page, /onPreviousPage: \(\) => void/);
assert.match(page, /onNextPage: \(\) => void/);
assert.match(page, /onTap: \(\): void => this\.onRefresh\(\)/);
assert.match(page, /点击切换书源/);
assert.match(index, /getDiscoverOrchestrator\(\)\.open\(\)/);
assert.match(index, /getDiscoverOrchestrator\(\)\.selectKind\(index\)/);
assert.doesNotMatch(index, /private async loadDiscover/);

console.log('discover source filter and pagination contract: PASS');
