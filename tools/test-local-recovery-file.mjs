import assert from 'node:assert/strict';
import { createHash, randomBytes } from 'node:crypto';
import { mkdtemp, readFile, rm, stat, truncate, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ReaderDocumentPickerActivity } from '../entry/src/main/ets/platform/ReaderDocumentPickerActivity.ts';

import { localRecoveryFileProbe } from './lib/local-recovery-file-probe.mjs';

const { support, handles, updateSizes, setPicker } = localRecoveryFileProbe(20 * 1024 * 1024);
const hasReason = reason => error => error instanceof support.LocalRecoveryFileError && error.reason === reason;
const root = await mkdtemp(join(tmpdir(), 'reader-local-recovery-file-'));
try {
  const encrypted = join(root, 'snapshot.readerbackup'), staged = join(root, 'private-plaintext');
  const expected = randomBytes(2 * 1024 * 1024 + 23);
  const passphrase = 'fixture recovery passphrase';
  const emit = async accept => {
    await accept(expected.subarray(0, 1024 * 1024 + 7));
    await accept(expected.subarray(1024 * 1024 + 7));
  };
  await support.sealRecoveryFile(encrypted, passphrase, emit);
  const sealed = await readFile(encrypted);
  assert.equal(sealed.subarray(0, 22).toString(), 'ReaderLocalRecovery/1\n');
  assert.equal(sealed.length, expected.length + 22 + 16 + 12 + 16);
  await support.openRecoveryFile(encrypted, staged, passphrase, () => true);
  assert.deepEqual(await readFile(staged), expected);
  assert.ok(updateSizes.length > 4 && updateSizes.every(size => size <= 1024 * 1024));
  const segments = [];
  const digest = await support.recoveryVisitFile(staged, async bytes => segments.push(bytes), () => true, expected.length);
  assert.equal(digest, createHash('sha256').update(expected).digest('hex'));
  assert.deepEqual(Buffer.concat(segments), expected);
  assert.equal(handles.size, 0);
  console.log('PASS SDK-emitted recovery file streams through bounded data with short filesystem reads and writes');

  await assert.rejects(support.openRecoveryFile(encrypted, staged, 'different passphrase', () => true), hasReason('rejected'));
  const changed = join(root, 'changed.readerbackup');
  const damaged = Buffer.from(sealed);
  damaged[100] ^= 1;
  await writeFile(changed, damaged);
  await assert.rejects(support.openRecoveryFile(changed, staged, passphrase, () => true), hasReason('rejected'));
  await writeFile(changed, sealed.subarray(0, 30));
  await assert.rejects(support.openRecoveryFile(changed, staged, passphrase, () => true), hasReason('rejected'));
  await assert.rejects(support.openRecoveryFile(encrypted, staged, passphrase, () => false), hasReason('cancelled'));
  assert.equal(handles.size, 0);
  console.log('PASS wrong passphrase, ciphertext tampering, truncation and cancellation produce separate file outcomes');

  const sparse = join(root, 'oversized.readerbackup'), out = join(root, 'must-not-open');
  await writeFile(sparse, '');
  await truncate(sparse, support.LOCAL_RECOVERY_MAX_BYTES + 1);
  await assert.rejects(support.openRecoveryFile(sparse, out, passphrase, () => true), hasReason('tooLarge'));
  await assert.rejects(stat(out), { code: 'ENOENT' });
  await assert.rejects(support.recoveryVisitFile(sparse, async () => assert.fail(), () => true), hasReason('tooLarge'));
  await support.recoveryReserve(root, 4 * 1024 * 1024);
  await assert.rejects(support.recoveryReserve(root, 4 * 1024 * 1024 + 1), /Insufficient space/);
  assert.equal(handles.size, 0);
  console.log('PASS oversized input is rejected before quarantine output opens and staging requires free-space margin');

  ReaderDocumentPickerActivity.bind(11);
  ReaderDocumentPickerActivity.setForeground(true);
  const context = { id: 'test-context' };
  setPicker(async (kind, options) => {
    assert.equal(ReaderDocumentPickerActivity.isPending(), true);
    assert.equal(kind, 'select');
    assert.equal(options.maxSelectNumber, 1);
    assert.match(options.fileSuffixFilters[0], /\.readerbackup$/);
    return [];
  });
  assert.equal(await support.selectRecoveryDocument(context, false), undefined);
  assert.equal(ReaderDocumentPickerActivity.isPending(), false);
  setPicker(async (kind, options) => {
    assert.equal(ReaderDocumentPickerActivity.isPending(), true);
    assert.equal(kind, 'save');
    assert.match(options.newFileNames[0], /^Reader-\d{4}-\d{2}-\d{2}\.readerbackup$/);
    throw Error('picker port failure');
  });
  await assert.rejects(support.selectRecoveryDocument(context, true), /picker port failure/);
  assert.equal(ReaderDocumentPickerActivity.isPending(), false);
  console.log('PASS actual picker activity settles on empty selection and failed save');
} finally {
  ReaderDocumentPickerActivity.destroy();
  await rm(root, { recursive: true, force: true });
}
