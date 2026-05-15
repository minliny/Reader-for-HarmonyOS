// SyncModels — mirrors Core SyncWebDAVModels.swift + SyncWebDAVProtocols.swift
export enum ConflictPolicy {
  lastWriteWins = 'lastWriteWins',
  manual = 'manual',
  keepBoth = 'keepBoth'
}

export enum RestorePolicy {
  overwrite = 'overwrite',
  merge = 'merge',
  skipExisting = 'skipExisting'
}

export interface BackupConfig {
  name: string;
  remotePath: string;
  webdavURL?: string;
  includeProgress: boolean;
  includeBooks: boolean;
  autoBackup: boolean;
  intervalMinutes?: number;
  lastBackupAt?: number;
}

export interface BackupManifest {
  id: string;
  configName: string;
  createdAt: number;
  entryCount: number;
  totalSize: number;
}

export interface BackupEntry {
  path: string;
  size: number;
  modifiedAt: number;
}

export interface BackupPackage {
  manifest: BackupManifest;
  entries: BackupEntry[];
}

export interface ProgressSyncRecord {
  bookId: string;
  currentChapterIndex: number;
  chapterProgress: number;
  totalChapters: number;
  lastOpenedAt: number;
  updatedAt: number;
  syncedAt?: number;
}

export interface RemoteBookMetadata {
  path: string;
  name: string;
  size: number;
  modifiedAt: number;
  isDirectory: boolean;
}

export interface SyncState {
  lastSyncAt?: number;
  pendingPush: number;
  pendingPull: number;
  inProgress: boolean;
}
