import fileIo from '@ohos.file.fs';
import util from '@ohos.util';
import { replaceReaderAtomicSnapshot } from '../app/ReaderAtomicSnapshotFile';
import {
  recoveryCopyBytes, recoveryOutput, recoveryRead, recoveryReserve, recoveryText,
  recoveryVisitFile, recoveryWithFile,
} from '../platform/backup/LocalRecoveryFile';
import {
  READER_SYSTEM_MIGRATION_MANIFEST, READER_SYSTEM_MIGRATION_PAYLOAD,
  READER_SYSTEM_MIGRATION_PENDING_DIRECTORY, readReaderSystemMigrationManifest, sameReaderSystemMigration,
  type ReaderSystemMigrationManifest,
} from './ReaderSystemMigrationPolicy';

const MANIFEST_MAX_BYTES = 2048;
let stagingTail: Promise<void> = Promise.resolve();

export async function ensureSystemMigrationDirectory(directory: string): Promise<void> {
  if (!(await fileIo.access(directory))) await fileIo.mkdir(directory, true);
  if (!(await fileIo.lstat(directory)).isDirectory()) throw new Error('SYSTEM_MIGRATION_DIRECTORY_INVALID');
}

export async function readSystemMigrationManifest(directory: string): Promise<ReaderSystemMigrationManifest | undefined> {
  if (!(await fileIo.access(directory))) return undefined;
  if (!(await fileIo.lstat(directory)).isDirectory()) throw new Error('SYSTEM_MIGRATION_DIRECTORY_INVALID');
  const path = `${directory}/${READER_SYSTEM_MIGRATION_MANIFEST}`;
  if (!(await fileIo.access(path))) return undefined;
  return recoveryWithFile(path, fileIo.OpenMode.READ_ONLY | fileIo.OpenMode.NOFOLLOW, async (file): Promise<ReaderSystemMigrationManifest> => {
    const info = await fileIo.stat(file.fd);
    if (!info.isFile() || info.size <= 0 || info.size > MANIFEST_MAX_BYTES) throw new Error('SYSTEM_MIGRATION_MANIFEST_INVALID');
    const raw = recoveryText(await recoveryRead(file.fd, info.size));
    if (await fileIo.read(file.fd, new ArrayBuffer(1)) !== 0) throw new Error('SYSTEM_MIGRATION_MANIFEST_INVALID');
    return readReaderSystemMigrationManifest(JSON.parse(raw) as ReaderSystemMigrationManifest);
  });
}

export async function copySystemMigrationPayload(source: string, destination: string, manifest: ReaderSystemMigrationManifest,
  current: () => boolean): Promise<void> {
  await recoveryWithFile(source, fileIo.OpenMode.READ_ONLY | fileIo.OpenMode.NOFOLLOW, async (file): Promise<void> => {
    const info = await fileIo.stat(file.fd);
    if (!info.isFile() || info.size !== manifest.packageBytes) throw new Error('SYSTEM_MIGRATION_PAYLOAD_INVALID');
    await recoveryOutput(destination, async (emit): Promise<void> => {
      if (await recoveryCopyBytes(file.fd, info.size, emit, current) !== manifest.packageSha256 ||
        await fileIo.read(file.fd, new ArrayBuffer(1)) !== 0) {
        throw new Error('SYSTEM_MIGRATION_PAYLOAD_CHANGED');
      }
    });
  });
  if (await recoveryVisitFile(destination, async (): Promise<void> => {}, current, manifest.packageBytes) !== manifest.packageSha256) {
    throw new Error('SYSTEM_MIGRATION_READBACK_INVALID');
  }
}

export function systemMigrationPendingDirectory(applicationFilesDir: string): string {
  return `${applicationFilesDir}/${READER_SYSTEM_MIGRATION_PENDING_DIRECTORY}`;
}

export function systemMigrationPayload(directory: string): string {
  return `${directory}/${READER_SYSTEM_MIGRATION_PAYLOAD}`;
}

export function systemMigrationPendingPayload(directory: string, manifest: ReaderSystemMigrationManifest): string {
  return `${directory}/${manifest.packageSha256}.readerbackup`;
}

/** The extension writes verified bytes to private staging and commits only the journal. */
export function stageSystemMigration(incoming: string, pending: string): Promise<void> {
  const staged = stagingTail.then((): Promise<void> => stageSystemMigrationOnce(incoming, pending));
  stagingTail = staged.catch((): void => {});
  return staged;
}

async function stageSystemMigrationOnce(incoming: string, pending: string): Promise<void> {
  const manifest = await readSystemMigrationManifest(incoming);
  if (manifest === undefined) throw new Error('SYSTEM_MIGRATION_MANIFEST_MISSING');
  await ensureSystemMigrationDirectory(pending);
  const existing = await readSystemMigrationManifest(pending);
  const target = systemMigrationPendingPayload(pending, manifest);
  if (existing !== undefined) {
    if (!sameReaderSystemMigration(existing, manifest)) throw new Error('SYSTEM_MIGRATION_ALREADY_PENDING');
    if (await recoveryVisitFile(target, async (): Promise<void> => {}, () => true, existing.packageBytes) !== existing.packageSha256) {
      throw new Error('SYSTEM_MIGRATION_PENDING_PAYLOAD_CHANGED');
    }
    return;
  }
  await recoveryReserve(pending, manifest.packageBytes);
  const staging = `${pending}/payload-${util.generateRandomUUID(true)}.stage`;
  try {
    await copySystemMigrationPayload(systemMigrationPayload(incoming), staging, manifest, () => true);
    // A different restored package is never allowed to replace an accepted one.
    if (await readSystemMigrationManifest(pending) !== undefined) throw new Error('SYSTEM_MIGRATION_ALREADY_PENDING');
    await fileIo.rename(staging, target);
    await replaceReaderAtomicSnapshot(`${pending}/${READER_SYSTEM_MIGRATION_MANIFEST}`, pending, JSON.stringify(manifest));
  } finally {
    if (await fileIo.access(staging)) await fileIo.unlink(staging);
  }
}

export async function finishSystemMigration(pending: string, expected: ReaderSystemMigrationManifest): Promise<void> {
  const manifest = await readSystemMigrationManifest(pending);
  if (manifest === undefined || !sameReaderSystemMigration(manifest, expected)) throw new Error('SYSTEM_MIGRATION_JOURNAL_CHANGED');
  await fileIo.unlink(`${pending}/${READER_SYSTEM_MIGRATION_MANIFEST}`);
  const folder = await fileIo.open(pending, fileIo.OpenMode.READ_ONLY);
  try { await fileIo.fsync(folder.fd); } finally { await fileIo.close(folder); }
  try { await fileIo.unlink(systemMigrationPendingPayload(pending, manifest)); } catch (_) {}
}
