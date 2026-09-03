import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const expected = readFileSync(resolve(repo,
  'entry/src/main/resources/rawfile/reader-test-book-sources.json'));
const hapPaths = process.argv.slice(2).map(path => resolve(repo, path));
const canonicalHaps = [
  'entry-default-signed.hap',
  'entry-default-unsigned.hap',
];
const minimumBundledSourceCount = 6;

assert.ok(hapPaths.length >= 1,
  'pass at least one immutable signed or unsigned HAP to the package source verifier');
assert.equal(new Set(hapPaths.map(path => basename(path))).size, hapPaths.length,
  'the package source verifier refuses duplicate artifact arguments');
for (const hapPath of hapPaths) {
  assert.ok(canonicalHaps.includes(basename(hapPath)),
    `${hapPath} is not a canonical signed/unsigned artifact name`);
}

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
