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
assert.match(gateway, /const name = this\.string\(obj, 'title'\)/,
  'Core source.explore books use the stable BookSearchBookData title field');
assert.doesNotMatch(gateway, /const name = this\.string\(obj, 'name'\)/,
  'Harmony must not filter valid Core explore books by a non-existent name field');
assert.match(gateway, /url\.trim\(\)\.length === 0/,
  'Legado explore group headings with blank URLs must never be dispatched as categories');
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
for (const asset of [
  'discover_refresh',
  'discover_source_stack',
  'discover_source_chevron',
  'discover_filter',
  'discover_filter_chevron',
  'discover_apply',
]) {
  assert.ok(page.includes(`app.media.${asset}`), `Discover must use Figma-specific icon ${asset}`);
}
for (const alias of ['rss_refresh', 'rss_source', 'bookshelf_filter', 'reader_chevron_right', 'import_success']) {
  assert.ok(!page.includes(`app.media.${alias}`), `Discover must not reuse unrelated icon ${alias}`);
}
assert.match(index, /getDiscoverOrchestrator\(\)\.open\(\)/);
assert.match(index, /getDiscoverOrchestrator\(\)\.selectKind\(index\)/);
assert.doesNotMatch(index, /private async loadDiscover/);

console.log('discover source filter and pagination contract: PASS');
