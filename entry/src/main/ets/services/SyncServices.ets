// SyncServices — WebDAVAdapter + SyncTransport + BackupService contracts
// CONTRACT_ONLY for HTTP WebDAV implementation (adapter scope)
import { RemoteBookMetadata, ProgressSyncRecord, BackupConfig, BackupPackage,
  BackupManifest, RestorePolicy, ConflictPolicy } from '../models/SyncModels';

// WebDAVAdapter — mirrors Core WebDAVAdapter protocol
export interface WebDAVAdapter {
  listDirectory(path: string): Promise<RemoteBookMetadata[]>;
  downloadFile(remotePath: string): Promise<Uint8Array>;
  uploadFile(data: Uint8Array, remotePath: string): Promise<void>;
  deleteFile(remotePath: string): Promise<void>;
  connectionTest(): Promise<boolean>;
}

// SyncTransport — mirrors Core SyncTransport protocol
export interface SyncTransport {
  push(records: ProgressSyncRecord[]): Promise<void>;
  pull(since?: number): Promise<ProgressSyncRecord[]>;
  resolveConflicts(local: ProgressSyncRecord[], remote: ProgressSyncRecord[],
    policy: ConflictPolicy): ProgressSyncRecord[];
}

// BackupService — mirrors Core BackupService protocol
export interface BackupService {
  createBackup(config: BackupConfig, entriesPath: string): Promise<BackupPackage>;
  listBackups(config: BackupConfig): Promise<BackupManifest[]>;
  restoreBackup(pkg: BackupPackage, policy: RestorePolicy): Promise<void>;
}
