import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { pureModuleProbe } from './lib/ets-pure-module-probe.mjs';
import { localRecoveryFileProbe } from './lib/local-recovery-file-probe.mjs';

const source = new URL('../entry/src/main/ets/features/bookshelf/application/LocalRecoveryGateway.ts', import.meta.url);
const passphrase = 'fixture archive passphrase';
const libraryId = '1'.repeat(32);
const createdAt = 1790000005000;
const content = 'sealed core content';
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const packageSha256 = sha256(content);
const original = Buffer.from('test original', 'utf8');
const originalSha256 = sha256(original);
const descriptor = { sha256: originalSha256, byteLength: original.length, sourceFormat: 'txt' };
const rows = [
  { bookId: 'metadata-only', original: { ...descriptor, sha256: '3'.repeat(64) }, included: false },
  { bookId: 'verified-original', original: descriptor, included: true },
  { bookId: 'verified-alias', original: descriptor, included: true },
];

async function createArchive(support, path, appended = [original, original]) {
  const header = Buffer.from(JSON.stringify({ content, packageSha256, rows }), 'utf8');
  const length = Buffer.alloc(4);
  length.writeUInt32BE(header.length);
  await support.sealRecoveryFile(path, passphrase, async emit => {
    await emit(length);
    await emit(header);
    for (const bytes of appended) await emit(bytes);
  });
}

test('backup verification authenticates and parses every included original without changing restore state', async () => {
  const root = await mkdtemp(join(tmpdir(), 'reader-backup-proof-'));
  try {
    const { support, io, util, handles } = localRecoveryFileProbe();
    const directory = join(root, 'reader-local-recovery');
    const inspections = [];
    const parsedBooks = [];
    let secondOriginalReadability = 'recoverable';
    let parserFailed = false;
    let keepCurrent = true;
    let cancelDuringParse = false;
    const runtime = {
      getUIAbilityContext: () => ({ filesDir: root }),
      async request(method, params) {
        if (method === 'local_book.parse') {
          assert.deepEqual(Object.keys(params).sort(), ['bookId', 'fileName', 'filePath']);
          const index = rows.findIndex(row => row.bookId === params.bookId);
          assert.ok(index === 1 || index === 2, 'only included originals should be parsed');
          assert.equal(params.fileName, 'book.txt');
          assert.ok(params.filePath.startsWith(directory + '/'));
          assert.match(params.filePath.slice(directory.length), new RegExp('^/work-[^/]+/book-' + index + '\\.txt$'));
          assert.deepEqual(await readFile(params.filePath), original);
          parsedBooks.push(params.bookId);
          if (cancelDuringParse) keepCurrent = false;
          if (index === 2 && parserFailed) throw new Error('could not parse included original');
          return { data: { integrity: { readability: index === 1 ? 'complete' : secondOriginalReadability } } };
        }
        assert.equal(method, 'library.package.inspect');
        inspections.push(Object.keys(params).sort());
        assert.equal(params.includeSourceLibraryId, true);
        assert.equal(params.includeLocalOriginals, true);
        assert.equal(params.content, content);
        assert.equal(params.password, passphrase);
        return { data: { packageSha256, scope: 'coreLibraryMetadata', sourceLibraryId: libraryId, createdAtUnixMillis: createdAt,
          localOriginals: rows.map(row => ({ bookId: row.bookId, original: row.original })) } };
      },
    };
    const { LocalRecoveryGateway: Gateway } = pureModuleProbe(
      readFileSync(source, 'utf8'), 'LocalRecoveryGateway.ts', {
        ...support, fileIo: io, util, readerHostFilesDirectory: path => path,
        isReaderLocalBookFileName: path => path === 'book.txt',
      }, ['LocalRecoveryGateway']);
    const gateway = new Gateway(runtime);
    await mkdir(directory);
    const existing = { packageSha256: 'a'.repeat(64), bundleSha256: 'b'.repeat(64) };
    gateway.preview = existing;
    await writeFile(join(directory, 'pending.readerbackup'), 'existing preview');
    await writeFile(join(directory, 'restore.json'), 'existing recovery journal');
    const archive = join(root, 'download.readerbackup');
    await createArchive(support, archive);

    const outputs = [];
    const rawOpen = io.open;
    io.open = (path, flags) => {
      if (flags !== io.OpenMode.READ_ONLY) outputs.push(path);
      return rawOpen(path, flags);
    };
    assert.deepEqual(await gateway.verifyBackupArchive(archive, passphrase, () => true), {
      libraryId, createdAt, includedOriginals: [originalSha256],
    });
    assert.deepEqual(inspections, [['content', 'includeLocalOriginals', 'includeSourceLibraryId', 'password']]);
    assert.deepEqual(parsedBooks, ['verified-original', 'verified-alias']);
    assert.equal(outputs.length, 3);
    assert.match(outputs[0], /\/work-[^/]+\/quarantine$/);
    assert.match(outputs[1], /\/work-[^/]+\/book-1\.txt$/);
    assert.match(outputs[2], /\/work-[^/]+\/book-2\.txt$/);
    assert.equal(gateway.preview, existing);
    assert.equal(await readFile(join(directory, 'pending.readerbackup'), 'utf8'), 'existing preview');
    assert.equal(await readFile(join(directory, 'restore.json'), 'utf8'), 'existing recovery journal');

    await assert.rejects(gateway.verifyBackupArchive(archive, 'incorrect passphrase', () => true));
    assert.equal(inspections.length, 1, 'failed outer authentication cannot reach Core inspection');
    assert.equal(parsedBooks.length, 2);
    io.open = rawOpen;

    secondOriginalReadability = 'incomplete';
    await assert.rejects(gateway.verifyBackupArchive(archive, passphrase, () => true));
    assert.deepEqual(parsedBooks.slice(2), ['verified-original', 'verified-alias']);
    parserFailed = true;
    await assert.rejects(gateway.verifyBackupArchive(archive, passphrase, () => true));
    assert.deepEqual(parsedBooks.slice(4), ['verified-original', 'verified-alias']);
    cancelDuringParse = true;
    await assert.rejects(gateway.verifyBackupArchive(archive, passphrase, () => keepCurrent));
    assert.deepEqual(parsedBooks.slice(6), ['verified-original'], 'a stale verification does not parse subsequent originals');

    await createArchive(support, archive, [original, Buffer.alloc(original.length, 2)]);
    await assert.rejects(gateway.verifyBackupArchive(archive, passphrase, () => true));
    assert.equal(inspections.length, 5);
    assert.equal(parsedBooks.length, 7, 'every original digest must verify before parsing starts');
    assert.equal(gateway.preview, existing);
    assert.equal(await readFile(join(directory, 'pending.readerbackup'), 'utf8'), 'existing preview');
    assert.equal(await readFile(join(directory, 'restore.json'), 'utf8'), 'existing recovery journal');
    assert.deepEqual((await readdir(directory)).sort(), ['pending.readerbackup', 'restore.json']);
    assert.equal(handles.size, 0);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
