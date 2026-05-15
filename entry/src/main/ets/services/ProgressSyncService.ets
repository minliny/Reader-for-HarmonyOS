// ProgressSyncService — local progress sync (export/import/markSynced)
// No remote sync — pure local. Remote sync needs WebDAVAdapter (HOS-8B).
import { ProgressService, ReadingProgress } from './ProgressService';
import { ProgressSyncRecord } from '../models/SyncModels';

export class ProgressSyncService {
  private progressService: ProgressService;

  constructor(progressService: ProgressService) {
    this.progressService = progressService;
  }

  exportProgress(): ProgressSyncRecord[] {
    const active = this.progressService.getActiveBooks();
    const now = Date.now();
    return active.map(p => ({
      bookId: p.bookId,
      currentChapterIndex: p.currentChapterIndex,
      chapterProgress: p.chapterProgress,
      totalChapters: p.totalChapters,
      lastOpenedAt: p.lastOpenedAt,
      updatedAt: now,
      syncedAt: undefined
    }));
  }

  importProgress(records: ProgressSyncRecord[]): number {
    let imported = 0;
    for (let i = 0; i < records.length; i++) {
      const r = records[i];
      const ok = this.progressService.updateProgress(
        r.bookId, r.currentChapterIndex, r.chapterProgress, r.totalChapters
      );
      if (ok) { imported++; }
    }
    return imported;
  }

  getUnsyncedChanges(alreadySynced?: ProgressSyncRecord[]): ProgressSyncRecord[] {
    const all = this.exportProgress();
    if (!alreadySynced) { return all; }

    const syncedIds: Set<string> = new Set();
    for (let i = 0; i < alreadySynced.length; i++) {
      const key = `${alreadySynced[i].bookId}:${alreadySynced[i].chapterProgress}`;
      syncedIds.add(key);
    }

    return all.filter(r => !syncedIds.has(`${r.bookId}:${r.chapterProgress}`));
  }

  markSynced(recordIds: string[]): void {
    // Mark progress records as synced (no-op for local-only sync)
    // In production, this updates a syncedAt timestamp per record
  }

  exportSummary(): Record<string, Object> {
    const all = this.exportProgress();
    return {
      totalRecords: all.length,
      exportedAt: Date.now(),
      records: all
    };
  }
}
