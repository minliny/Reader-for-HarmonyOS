// CoreStorageBackupHistory — path policy and pure projection helpers for the
// app-private, user-visible local Core backup history.  Snapshot bytes remain
// in the Host sandbox; AppStorage receives only this metadata projection.
import { CoreStorageBackupHistoryEntry, CoreStorageBackupInfo } from './ReaderUiState';

export class CoreStorageBackupHistory {
  static readonly DIRECTORY_PATH: string = 'files://backups';
  static readonly LEGACY_FILE_NAME: string = 'core-storage-snapshot-v1.json';
  static readonly FILE_PREFIX: string = 'core-storage-snapshot-v1-';
  static readonly FILE_SUFFIX: string = '.json';

  /**
   * A newly exported snapshot gets an immutable name bound to Core's measured
   * timestamp and SHA-256.  The full checksum prevents two exports in the
   * same millisecond from overwriting each other.
   */
  static fileNameFor(info: CoreStorageBackupInfo): string {
    return `${CoreStorageBackupHistory.FILE_PREFIX}${info.exportedAt}-${info.checksum}${CoreStorageBackupHistory.FILE_SUFFIX}`;
  }

  static pathFor(info: CoreStorageBackupInfo): string {
    return `${CoreStorageBackupHistory.DIRECTORY_PATH}/${CoreStorageBackupHistory.fileNameFor(info)}`;
  }

  static legacyPath(): string {
    return `${CoreStorageBackupHistory.DIRECTORY_PATH}/${CoreStorageBackupHistory.LEGACY_FILE_NAME}`;
  }

  static isCandidateFileName(name: string): boolean {
    return name === CoreStorageBackupHistory.LEGACY_FILE_NAME ||
      new RegExp(`^${CoreStorageBackupHistory.FILE_PREFIX}\\d+-[0-9a-f]{64}\\.json$`).test(name);
  }

  /** Immutable filenames must agree with the manifest, otherwise the file is
   * excluded rather than presented as a valid restore candidate. */
  static immutableFileNameMatches(name: string, info: CoreStorageBackupInfo): boolean {
    if (name === CoreStorageBackupHistory.LEGACY_FILE_NAME) return true;
    return name === CoreStorageBackupHistory.fileNameFor(info);
  }

  static entry(path: string, fileName: string, info: CoreStorageBackupInfo): CoreStorageBackupHistoryEntry {
    return {
      path: path,
      fileName: fileName,
      source: info.source,
      schemaVersion: info.schemaVersion,
      bytes: info.bytes,
      checksum: info.checksum,
      exportedAt: info.exportedAt,
    };
  }

  static sortNewestFirst(entries: CoreStorageBackupHistoryEntry[]): CoreStorageBackupHistoryEntry[] {
    const sorted = entries.slice();
    sorted.sort((left: CoreStorageBackupHistoryEntry, right: CoreStorageBackupHistoryEntry): number => {
      if (left.exportedAt !== right.exportedAt) {
        return right.exportedAt - left.exportedAt;
      }
      // A deterministic tie-breaker makes the AppStorage projection stable.
      if (left.fileName < right.fileName) {
        return 1;
      }
      if (left.fileName > right.fileName) {
        return -1;
      }
      return 0;
    });
    return sorted;
  }

  static info(entry: CoreStorageBackupHistoryEntry): CoreStorageBackupInfo {
    return {
      source: entry.source,
      schemaVersion: entry.schemaVersion,
      bytes: entry.bytes,
      checksum: entry.checksum,
      exportedAt: entry.exportedAt,
    };
  }

  static sameInfo(left: CoreStorageBackupInfo, right: CoreStorageBackupInfo): boolean {
    return left.source === right.source && left.schemaVersion === right.schemaVersion &&
      left.bytes === right.bytes && left.checksum === right.checksum &&
      left.exportedAt === right.exportedAt;
  }

  /** Source is a local UI projection and is not serialized in Core's file. */
  static sameSnapshot(left: CoreStorageBackupInfo, right: CoreStorageBackupInfo): boolean {
    return left.schemaVersion === right.schemaVersion && left.bytes === right.bytes &&
      left.checksum === right.checksum && left.exportedAt === right.exportedAt;
  }
}
