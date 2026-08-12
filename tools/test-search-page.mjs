import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const page = readFileSync(
  resolve(repo, 'entry/src/main/ets/features/search/SearchPage.ets'),
  'utf8',
);
const index = readFileSync(
  resolve(repo, 'entry/src/main/ets/pages/Index.ets'),
  'utf8',
);

const chipsStart = page.indexOf('private sourceChips()');
const chipsEnd = page.indexOf('private stateContent()', chipsStart);
assert.ok(chipsStart >= 0 && chipsEnd > chipsStart, 'source chips builder must remain present');
const chips = page.slice(chipsStart, chipsEnd);

assert.match(chips, /Scroll\(\)/, 'source chips must use a horizontal viewport');
assert.match(chips, /\.scrollable\(ScrollDirection\.Horizontal\)/);
assert.match(chips, /\.scrollBar\(BarState\.Off\)/);
assert.match(chips, /this\.presentation\.scopeSourceId === undefined/,
  'the all chip must reflect the selected scope');
assert.match(chips, /this\.presentation\.scopeSourceId === source\.sourceId/,
  'a source chip must reflect its exact selected sourceId');
assert.match(chips, /\.onClick\(\(\): void => this\.onScopeChange\(sourceId\)\)/,
  'chips must emit the existing scope-change intent');
const sourceChipStart = chips.indexOf('private sourceChip(');
assert.ok(sourceChipStart >= 0, 'source chip builder must remain present');
const sourceChip = chips.slice(sourceChipStart);
assert.match(sourceChip,
  /Stack\(\{ alignContent: Alignment\.Center \}\) \{[\s\S]*?Text\(label\)[\s\S]*?\n    \}\s*\.padding\([\s\S]*?\.accessibilityText\(label\)\s*\.onClick\(\(\): void => this\.onScopeChange\(sourceId\)\)/,
  'the chip container, not its Text child, must own the full painted hit target');
assert.equal((sourceChip.match(/\.onClick\(/g) ?? []).length, 1,
  'a source chip must expose one container-owned click handler');

assert.match(page, /Text\('共 1 个书源'\)/,
  'one raw result card represents one exact source hit');
assert.doesNotMatch(page, /countBySource/,
  'book count within a source must never be mislabeled as source count');
assert.doesNotMatch(page, /sourceCount: number/,
  'raw cards must not accept an unproven aggregate source count');
assert.match(page,
  /this\.emptyContent\(this\.presentation\.keyword, this\.presentation\.scopeSourceId\)/,
  'empty copy must receive the exact active scope');
assert.match(page, /private emptyContent\(keyword: string, scopeSourceId: SearchScope\)/);
assert.match(page, /scopeSourceId === undefined \? '所有书源' : '所选书源'/,
  'empty copy must distinguish an all-source search from a selected-source search');
assert.match(page, /this\.loadingContent\(this\.presentation\.scopeSourceId\)/,
  'loading copy must receive the exact active scope');
assert.match(page, /private loadingContent\(scopeSourceId: SearchScope\)/);
assert.match(page,
  /Text\(`正在搜索\$\{scopeSourceId === undefined \? '所有书源' : '所选书源'\}…`\)/,
  'loading copy must distinguish an all-source search from a selected-source search');
assert.match(index, /onScopeChange:\s*\(sourceId: string \| undefined\): void =>\s*this\.changeSearchScope\(sourceId\)/,
  'Index must receive the page scope-change intent');
assert.match(index, /private changeSearchScope\(sourceId: string \| undefined\): void \{[\s\S]*?this\.getSearchOrchestrator\(\)\.changeScope\(sourceId\);[\s\S]*?\n  \}/,
  'Index must forward the page intent to the existing SearchOrchestrator owner');

console.log('search page scope and raw-source projection contract: PASS');
