import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { withHapZip } from '../scripts/lib/hap-zip-reader.mjs';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const expected = readFileSync(resolve(repo,
  'entry/src/main/resources/rawfile/reader-tested-book-source-collection.json'));
const hapPaths = process.argv.slice(2).map(path => resolve(repo, path));
const canonicalHaps = [
  'entry-default-signed.hap',
  'entry-default-unsigned.hap',
];

assert.ok(hapPaths.length >= 1,
  'pass at least one immutable signed or unsigned HAP to the package source verifier');
assert.equal(new Set(hapPaths.map(path => basename(path))).size, hapPaths.length,
  'the package source verifier refuses duplicate artifact arguments');
for (const hapPath of hapPaths) {
  assert.ok(canonicalHaps.includes(basename(hapPath)),
    `${hapPath} is not a canonical signed/unsigned artifact name`);
}

for (const hapPath of hapPaths) {
  const extracted = withHapZip(hapPath, zip =>
    zip.read('resources/rawfile/reader-tested-book-source-collection.json', 32 * 1024 * 1024));
  assert.deepEqual(extracted, expected,
    `${hapPath} bundled source bytes differ from the current build input`);
  console.log(`${hapPath}: bundled source byte identity PASS (${expected.length} bytes); source behavior NOT_RUN`);
}
