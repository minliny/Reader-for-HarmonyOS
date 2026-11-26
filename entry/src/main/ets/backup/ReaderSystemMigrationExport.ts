import { common } from '@kit.AbilityKit';
import fileIo from '@ohos.file.fs';
import util from '@ohos.util';
import { createReaderCoreRuntimeAsync, probeReaderCoreStorageAsync, type JsonObject, type ReaderCoreStorageProbe } from
  '@reader/core-harmony';
import { ReaderLocalRecoveryExportPort } from './ReaderSystemMigrationOriginals';
import { LocalRecoveryGateway, type LocalRecoveryExportPort } from '../features/bookshelf/application/LocalRecoveryGateway';
import { replaceReaderAtomicSnapshot } from '../app/ReaderAtomicSnapshotFile';
import { recoveryReserve } from '../platform/backup/LocalRecoveryFile';
import { copySystemMigrationPayload, ensureSystemMigrationDirectory, systemMigrationPayload } from './ReaderSystemMigrationFiles';
import {
  READER_SYSTEM_MIGRATION_DIRECTORY, READER_SYSTEM_MIGRATION_MANIFEST, type ReaderSystemMigrationManifest,
} from './ReaderSystemMigrationPolicy';

async function requireSnapshotIdentity(context: common.Context, probe: ReaderCoreStorageProbe): Promise<void> {
  const raw = await context.resourceManager.getRawFileContent('reader-core-storage-identity.v1.json');
  if (raw.length === 0 || raw.length > 4096) throw new Error('SYSTEM_MIGRATION_STORAGE_IDENTITY');
  const identity = JSON.parse(util.TextDecoder.create('utf-8', { fatal: true }).decodeToString(raw)) as JsonObject;
  if (identity['format'] !== 'reader.storage-bootstrap-identity' || identity['version'] !== 1 ||
    identity['buildId'] !== probe.buildIdentity['buildId'] || identity['contractSha256'] !== probe.contractSha256 ||
    identity['coreInputFingerprint'] !== probe.coreInputFingerprint || probe.observation.requiresMigration) {
    throw new Error('SYSTEM_MIGRATION_STORAGE_IDENTITY');
  }
}

export async function createReaderSystemMigrationArchive(context: common.Context, applicationFilesDir: string,
  includeOriginals: boolean, current: () => boolean): Promise<void> {
  const dataDirectory = `${context.filesDir}/reader-core`;
  const directory = `${applicationFilesDir}/${READER_SYSTEM_MIGRATION_DIRECTORY}`;
  await ensureSystemMigrationDirectory(directory);
  const manifestPath = `${directory}/${READER_SYSTEM_MIGRATION_MANIFEST}`;
  const payloadPath = systemMigrationPayload(directory);
  // Only files produced in this operation are published for OS collection.
  if (await fileIo.access(manifestPath)) await fileIo.unlink(manifestPath);
  if (await fileIo.access(payloadPath)) await fileIo.unlink(payloadPath);
  if (!(await fileIo.access(dataDirectory))) return;

  const probe = await probeReaderCoreStorageAsync(dataDirectory, current);
  await requireSnapshotIdentity(context, probe);
  const core = await createReaderCoreRuntimeAsync({ dataDirectory }, current);
  try {
    const secret = (util.generateRandomUUID(false) + util.generateRandomUUID(false)).replace(/-/g, '');
    const source = new ReaderLocalRecoveryExportPort(context.filesDir);
    const port: LocalRecoveryExportPort = {
      filesDir: `${context.filesDir}/reader-system-migration-export-work`,
      request: async (method: string, params: JsonObject): Promise<JsonObject> =>
        (await core.request(method, params, { timeoutMs: 120000, shouldCancel: (): boolean => !current() })).data,
      retainedLocalBookSourcePath: (bookId: string, live: () => boolean): Promise<string | undefined> =>
        source.retainedLocalBookSourcePath(bookId, live),
    };
    const result = await new LocalRecoveryGateway(undefined, port).exportStagedPackage(secret, includeOriginals,
      async (path: string, packageSha256: string, packageBytes: number): Promise<boolean> => {
        if (!current()) return false;
        const manifest: ReaderSystemMigrationManifest = {
          format: 'reader.system-migration', version: 1, secret, packageSha256, packageBytes, includeOriginals,
        };
        await recoveryReserve(directory, packageBytes);
        const temp = `${directory}/library-${util.generateRandomUUID(true)}.stage`;
        try {
          await copySystemMigrationPayload(path, temp, manifest, current);
          if (!current()) return false;
          await fileIo.rename(temp, payloadPath);
          await replaceReaderAtomicSnapshot(manifestPath, directory, JSON.stringify(manifest));
        } finally {
          if (await fileIo.access(temp)) await fileIo.unlink(temp);
        }
        return current();
      }, current);
    if (result.state !== 'exported') throw new Error('SYSTEM_MIGRATION_EXPORT_UNCONFIRMED');
  } finally { core.close(); }
}
