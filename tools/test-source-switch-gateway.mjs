import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const gateway = readFileSync(
  resolve(repo, 'entry/src/main/ets/features/source/SourceSwitchGateway.ts'),
  'utf8',
);

const fetchStart = gateway.indexOf('async fetchTargetToc(');
const fetchEnd = gateway.indexOf('async commitSwitch(', fetchStart);
assert.ok(fetchStart >= 0 && fetchEnd > fetchStart, 'fetchTargetToc method must remain present');
const fetchTargetToc = gateway.slice(fetchStart, fetchEnd);

const detailRequest = fetchTargetToc.indexOf("'book.detail'");
const tocRequest = fetchTargetToc.indexOf("'book.toc'");
assert.ok(detailRequest >= 0, 'fetchTargetToc must resolve book.detail');
assert.ok(tocRequest > detailRequest, 'book.detail must complete before book.toc');
assert.match(fetchTargetToc, /book:\s*\{\s*bookId\s*\}/);
assert.match(fetchTargetToc, /bookUrl:\s*bookId/);
assert.match(fetchTargetToc, /detailSourceId !== sourceId \|\| detailBookId !== bookId/);
assert.match(fetchTargetToc, /requireString\(detail\.data, 'tocUrl', 'book\.detail'\)/);
assert.match(fetchTargetToc, /requireStringMap\(detail\.data\['variables'\], 'variables', 'book\.detail'\)/);
assert.match(fetchTargetToc, /\{\s*sourceId,\s*bookId,\s*tocUrl,\s*variables\s*\}/);
assert.doesNotMatch(fetchTargetToc, /'book\.toc',\s*\{\s*sourceId,\s*bookId\s*\}/);

assert.match(gateway, /private requireStringMap\([\s\S]*typeof variableValue !== 'string'/);
assert.match(gateway, /candidate\.trim\(\)\.length === 0/);
assert.match(gateway, /'change\.bookSource',[\s\S]*\{ sourceId, bookId, keyword, sourceIds \}/);

console.log('source-switch gateway contract: PASS');
