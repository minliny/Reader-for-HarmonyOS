import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const history = 'docs/history/worktrees/';
const index = JSON.parse(readFileSync(resolve(root, history, 'CONTENT_INDEX.json'), 'utf8'));
assert.equal(index.schemaVersion, 1);
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
function localPath(base, path) {
  assert.ok(!isAbsolute(path) && path.startsWith(history), 'historical paths must stay in their archive');
  const target = resolve(base, path), from = relative(base, target);
  assert.ok(from !== '..' && !from.startsWith(`..${sep}`) && !isAbsolute(from), 'path escapes archive');
  return target;
}
for (const [hash, object] of Object.entries(index.objects)) {
  const bytes = readFileSync(localPath(root, object.path));
  assert.equal(sha(bytes), hash, `${object.path}: original payload hash`);
  assert.equal(bytes.length, object.bytes);
}
for (const [path, alias] of Object.entries(index.aliases)) {
  const object = index.objects[alias.sourceSha256];
  assert.ok(object, `${path}: missing original content`);
  assert.equal(alias.contentObject, object.path);
  assert.equal(alias.sourceBytes, object.bytes);
  assert.equal(sha(readFileSync(localPath(root, path))), alias.pointerSha256, `${path}: changed reference`);
}
// Existing source identities are independent of the new storage path. Check
// every affected provenance record without executing archived tests/scripts.
for (const [file, field] of [['COMMITTED_REFERENCE_MANIFEST.json', 'archivePath'], ['WIP_REFERENCE_MANIFEST.json', 'destination']]) {
  const manifest = JSON.parse(readFileSync(resolve(root, history, file), 'utf8'));
  for (const record of manifest.files) {
    const alias = index.aliases[record[field]];
    if (!alias) continue;
    assert.equal(record.sha256, alias.sourceSha256);
    assert.equal(record.bytes, alias.sourceBytes);
    assert.equal(record.contentObject, alias.contentObject);
  }
}
const [mode, output, ...extra] = process.argv.slice(2);
assert.ok(extra.length === 0 && ((mode === '--verify' && output === undefined) ||
  (mode === '--export' && output)), 'Usage: history-artifacts.mjs --verify | --export <new directory>');
if (mode === '--export') {
  const destination = resolve(output);
  assert.ok(!existsSync(destination), 'Export requires a new directory; existing files are never overwritten');
  mkdirSync(destination, { recursive: true });
  for (const [path, alias] of Object.entries(index.aliases)) {
    const target = localPath(destination, path), bytes = readFileSync(localPath(root, alias.contentObject));
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, bytes, { flag: 'wx' });
    assert.equal(sha(readFileSync(target)), alias.sourceSha256, `${path}: export hash`);
  }
}
console.log(JSON.stringify({ status: 'PASS', action: mode, objects: Object.keys(index.objects).length,
  logicalPaths: Object.keys(index.aliases).length, executedHistoricalCode: false }));
