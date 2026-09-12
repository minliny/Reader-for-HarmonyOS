import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const store = readFileSync(
  resolve(repo, 'entry/src/main/ets/features/sync/WebDavCredentialStore.ts'),
  'utf8',
);

// The production queue must preserve the current caller's rejection while
// handing later operations a recovered serialization tail.
assert.match(store, /const next = this\.writeTail\.catch\(\(\): void => \{\}\)\.then\(\(\): Promise<void> => this\.persist\(normalized\)\)/);
assert.match(store, /const next = this\.writeTail\.catch\(\(\): void => \{\}\)\.then\(\(\): Promise<void> => this\.remove\(\)\)/);
assert.match(store, /this\.writeTail = next\.catch\(\(\): void => \{\}\)/);

let tail = Promise.resolve();
const enqueue = (operation) => {
  const next = tail.catch(() => {}).then(operation);
  tail = next.catch(() => {});
  return next;
};

let failFirst = true;
const persist = async (value) => {
  if (failFirst) {
    failFirst = false;
    throw new Error('transient AssetStore failure');
  }
  return value;
};
let failRemove = true;
const remove = async () => {
  if (failRemove) {
    failRemove = false;
    throw new Error('transient AssetStore remove failure');
  }
  return 'cleared';
};

await assert.rejects(enqueue(() => persist('first')), /transient AssetStore failure/);
assert.equal(await enqueue(() => persist('second')), 'second',
  'a failed save must not poison the next save');
await assert.rejects(enqueue(remove), /transient AssetStore remove failure/);
assert.equal(await enqueue(remove), 'cleared',
  'a failed clear must not poison the next clear');
assert.equal(await tail, 'cleared');

console.log('WebDAV credential queue recovers after save failure: PASS');
