import assert from 'node:assert/strict';
import fs, { chmodSync, mkdirSync, mkdtempSync, renameSync, rmSync, symlinkSync, utimesSync, writeFileSync } from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { contentSnapshot } from '../../../Reader-Core/scripts/build-input-snapshot.mjs';
import { regularInputSnapshot, startRegularInputSnapshots } from './regular-input-snapshot.mjs';

async function fixture(action) {
  const dir = mkdtempSync(join(tmpdir(), 'reader-snapshot-worker-fixture-'));
  try { return await action(dir); }
  finally { rmSync(dir, { recursive: true, force: true }); }
}

test('synchronous and bounded worker outputs match Core record ordering, shapes and multichunk bytes', async () => {
  await fixture(async dir => {
    mkdirSync(join(dir, 'sub'));
    writeFileSync(join(dir, 'sub', 'Zeta'), Buffer.alloc(2 * 1024 ** 2 + 37, 42));
    writeFileSync(join(dir, 'sub', 'éclair'), 'data');
    writeFileSync(join(dir, 'empty'), '');
    chmodSync(join(dir, 'sub', 'Zeta'), 0o755);
    const inputs = ['sub', 'empty', 'missing/item'];
    const expected = contentSnapshot(dir, inputs);
    assert.deepEqual(regularInputSnapshot(dir, inputs), expected);
    const batch = startRegularInputSnapshots([{ repo: dir, inputs }, { repo: dir, inputs: ['.'] }]);
    try {
      assert.throws(batch.assertUnchanged, /results must be awaited/);
      assert.deepEqual(await batch.result, [expected, contentSnapshot(dir, ['.'])]);
      assert.doesNotThrow(batch.assertUnchanged);
      assert.throws(() => startRegularInputSnapshots(Array(3).fill({ repo: dir, inputs })), /one or two/);
    } finally { await batch.stop(); }
  });
});

test('rejects symlinked files, ancestor redirects and input escape both synchronously and in a worker', async () => {
  await fixture(async dir => {
    const real = join(dir, 'real');
    mkdirSync(real);
    writeFileSync(join(real, 'item'), 'data');
    symlinkSync(real, join(dir, 'alias'), 'dir');
    symlinkSync(join(real, 'item'), join(dir, 'item'), 'file');
    assert.throws(() => regularInputSnapshot(dir, ['item']), /only regular files/);
    assert.throws(() => regularInputSnapshot(dir, ['alias/item']), /ancestor must be a real directory/);
    assert.throws(() => regularInputSnapshot(dir, ['../elsewhere']), /input escapes/);
    const batch = startRegularInputSnapshots([{ repo: dir, inputs: ['alias/item'], label: 'Test inputs' }]);
    try { await assert.rejects(batch.result, /Test inputs:.*ancestor must be a real directory/); }
    finally { await batch.stop(); }
  });
});

test('rejects an in-place same-size mutation during the actual descriptor read', async () => {
  await fixture(dir => {
    const item = join(dir, 'item');
    writeFileSync(item, 'first value');
    const original = fs.readSync;
    try {
      fs.readSync = (...args) => {
        const read = original(...args);
        writeFileSync(item, 'wrong value');
        return read;
      };
      syncBuiltinESMExports();
      assert.throws(() => regularInputSnapshot(dir, ['item']), /regular input changed while it was being read/);
    } finally {
      fs.readSync = original;
      syncBuiltinESMExports();
    }
  });
});

test('late same-size edits are rejected while excluded ancestor churn is allowed', async () => {
  await fixture(async dir => {
    mkdirSync(join(dir, 'entry/src'), { recursive: true });
    const selected = join(dir, 'entry/src/module');
    writeFileSync(selected, 'before');
    const batch = startRegularInputSnapshots([{ repo: dir, inputs: ['entry/src'] }]);
    try {
      await batch.result;
      mkdirSync(join(dir, 'entry/build'));
      writeFileSync(join(dir, 'entry/build/generated'), 'tool output');
      assert.doesNotThrow(batch.assertUnchanged);
      writeFileSync(selected, 'after!');
      assert.throws(batch.assertUnchanged, /snapshot input changed before publication/);
    } finally { await batch.stop(); }
  });
});

test('late additions under included directories and new previously missing roots are rejected', async () => {
  await fixture(async dir => {
    mkdirSync(join(dir, 'selected'));
    const changedTree = startRegularInputSnapshots([{ repo: dir, inputs: ['selected'] }]);
    const missingRoot = startRegularInputSnapshots([{ repo: dir, inputs: ['absent'] }]);
    try {
      await Promise.all([changedTree.result, missingRoot.result]);
      writeFileSync(join(dir, 'selected/new-item'), 'first bytes');
      writeFileSync(join(dir, 'absent'), 'first bytes');
      assert.throws(changedTree.assertUnchanged, /snapshot input changed before publication: selected/);
      assert.throws(missingRoot.assertUnchanged, /snapshot input changed before publication: absent/);
    } finally { await Promise.all([changedTree.stop(), missingRoot.stop()]); }
  });
});

test('late directory timestamp changes preserve the seal only with the same members and file identities', async () => {
  await fixture(async dir => {
    const selected = join(dir, 'selected');
    const item = join(selected, 'item');
    mkdirSync(selected);
    writeFileSync(item, 'original');
    const batch = startRegularInputSnapshots([{ repo: dir, inputs: ['selected'] }]);
    try {
      await batch.result;
      utimesSync(selected, 1, 1);
      assert.doesNotThrow(batch.assertUnchanged);
      writeFileSync(join(selected, 'new'), 'new');
      assert.throws(batch.assertUnchanged, /snapshot input changed before publication: selected/);
      rmSync(join(selected, 'new'));
      assert.doesNotThrow(batch.assertUnchanged);
      rmSync(item);
      writeFileSync(item, 'original');
      assert.throws(batch.assertUnchanged, /snapshot input changed before publication: selected[\\/]item/);
    } finally { await batch.stop(); }
  });
});

test('late replacement of an ancestor is rejected even if selected bytes still match', async () => {
  await fixture(async dir => {
    const parent = join(dir, 'parent');
    const item = join(parent, 'selected');
    mkdirSync(parent);
    writeFileSync(item, 'same bytes');
    const batch = startRegularInputSnapshots([{ repo: dir, inputs: ['parent/selected'] }]);
    try {
      await batch.result;
      renameSync(parent, join(dir, 'previous'));
      mkdirSync(parent);
      writeFileSync(item, 'same bytes');
      assert.throws(batch.assertUnchanged, /snapshot input changed before publication: parent/);
    } finally { await batch.stop(); }
  });
});
