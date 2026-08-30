import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const expected = readFileSync(resolve(repo,
  'entry/src/main/resources/rawfile/reader-test-book-sources.json'));
const hapPaths = process.argv.slice(2).map(path => resolve(repo, path));
const outputDir = resolve(repo, 'entry/build/default/outputs/default');
const outputHaps = readdirSync(outputDir)
  .filter(name => name.endsWith('.hap'))
  .sort();
const canonicalHaps = [
  'entry-default-signed.hap',
  'entry-default-unsigned.hap',
];
const minimumBundledSourceCount = 6;

assert.ok(hapPaths.length >= 2,
  'pass both signed and unsigned HAP paths to the package source verifier');
assert.deepEqual(outputHaps, canonicalHaps,
  'package output must contain only the current signed/unsigned HAPs; isolate stale numbered copies');
assert.ok(hapPaths.some(path => path.endsWith('-signed.hap')), 'signed HAP is missing');
assert.ok(hapPaths.some(path => path.endsWith('-unsigned.hap')), 'unsigned HAP is missing');
assert.deepEqual(hapPaths.map(path => basename(path)).sort(), canonicalHaps,
  'the verifier must cover every installable HAP in the output directory');

for (const hapPath of hapPaths) {
  const extracted = spawnSync('unzip', [
    '-p', hapPath, 'resources/rawfile/reader-test-book-sources.json',
  ], { encoding: null, maxBuffer: 1024 * 1024 });
  assert.equal(extracted.status, 0,
    `${hapPath} does not expose the bundled source raw file: ${extracted.stderr?.toString('utf8') ?? ''}`);
  assert.deepEqual(extracted.stdout, expected,
    `${hapPath} bundled source bytes differ from the live-checked source document`);
  const sources = JSON.parse(extracted.stdout.toString('utf8'));
  assert.ok(Array.isArray(sources) && sources.length >= minimumBundledSourceCount,
    `${hapPath} must contain at least ${minimumBundledSourceCount} test sources`);
  console.log(`${hapPath}: bundled test sources PASS (${sources.length})`);
}
