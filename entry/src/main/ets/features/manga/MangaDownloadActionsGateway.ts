import type { JsonObject, RequestOptions } from '@reader/core-harmony';
import type { ReadingGatewayRuntime } from '../reading/ReadingGatewayRuntime';
import type { RemoteReadingSession } from '../reading/RemoteReadingFlowGateway';
import type { MangaChapterIdentity } from './MangaContract';

export type MangaDownloadOperation = 'pause' | 'resume' | 'cancel';
export type MangaDownloadActionId = 'downloadChapter' | 'downloadBook' | MangaDownloadOperation |
  'releaseRetention' | 'deleteDownloads' | 'clearCache' | 'updateChapter';
export interface MangaDownloadAction { id: MangaDownloadActionId; label: string; }
export type MangaDownloadChapterState = 'missing' | 'queued' | 'paused' | 'inProgress' |
  'cached' | 'completed' | 'failed' | 'cancelled';
export interface MangaDownloadChapterStatus {
  chapterIndex: number;
  chapter: MangaChapterIdentity;
  state: MangaDownloadChapterState;
  attempts: number;
  maxAttempts: number;
}
export interface MangaDownloadRetention {
  chapter: MangaChapterIdentity;
  manifestVersion: string;
  retainedAt: number;
}
export interface MangaDownloadSnapshot {
  chapters: MangaDownloadChapterStatus[];
  retentions: MangaDownloadRetention[];
  downloadChapters: MangaChapterIdentity[];
}
export interface MangaDownloadDeleteOutcome { removedVersions: number; protectedVersions: number; }
interface MangaDownloadPreparedDeletion { chapter: MangaChapterIdentity; versions: string[]; }
interface MangaDownloadTaskResult {
  sourceId: string;
  bookId: string;
  chapterIndex: number;
  status: string;
  attempts: number;
  maxAttempts: number;
}

/** Reader operation intent over existing queue/retention RPCs. No fetching,
 * retry queue, eviction policy, or disk ownership lives in this adapter. */
export class MangaDownloadActionsGateway {
  private readonly runtime: ReadingGatewayRuntime;
  constructor(runtime: ReadingGatewayRuntime) { this.runtime = runtime; }

  async snapshot(session: RemoteReadingSession, current?: () => boolean): Promise<MangaDownloadSnapshot> {
    this.assertManga(session, current);
    const result = await this.runtime.request('cache.book.status', {
      sourceId: session.identity.sourceId, bookId: session.identity.bookId,
      includeGlobalStats: false, includeChapterStates: true,
    }, this.options(current));
    this.assertCurrent(current);
    const data = result.data;
    if (data['sourceId'] !== session.identity.sourceId || data['bookId'] !== session.identity.bookId ||
      !Array.isArray(data['chapters'])) throw new Error('漫画下载状态需要重新读取，请重试');
    const chapters: MangaDownloadChapterStatus[] = [];
    const seen: Set<number> = new Set();
    for (const raw of data['chapters']) {
      const row = this.object(raw);
      const chapterIndex = this.integer(row['chapterIndex']);
      if (seen.has(chapterIndex)) throw new Error('漫画下载状态需要重新读取，请重试');
      seen.add(chapterIndex);
      // Core group/disabled facts are authoritative. Never create a download
      // action from a group URL or an approximate ordinal.
      if (row['navigable'] === false || typeof row['url'] !== 'string' || row['url'].trim().length === 0) continue;
      const chapter = this.chapter({ sourceId: session.identity.sourceId, bookId: session.identity.bookId,
        chapterId: row['url'] });
      chapters.push({ chapterIndex, chapter, state: this.state(row['state']),
        attempts: this.integer(row['attempts'] ?? 0), maxAttempts: this.integer(row['maxAttempts'] ?? 0) });
    }
    const retained = await this.runtime.request('manga.retention.list', {
      sourceId: session.identity.sourceId, bookId: session.identity.bookId,
    }, this.options(current));
    this.assertCurrent(current);
    if (!Array.isArray(retained.data['retentions'])) throw new Error('漫画下载保留状态需要重新读取，请重试');
    const retentions = retained.data['retentions'].map((raw): MangaDownloadRetention => {
      const row = this.object(raw), chapter = this.chapter(row['chapter']);
      this.assertBook(session, chapter);
      return { chapter, manifestVersion: this.identity(row['manifestVersion']), retainedAt: this.integer(row['retainedAt'], Number.MAX_SAFE_INTEGER) };
    });
    const downloadChapters = this.runtime.listMangaDownloadChapters === undefined ?
      retentions.map(row => row.chapter) : await this.runtime.listMangaDownloadChapters(
        session.identity.sourceId, session.identity.bookId, current);
    this.assertCurrent(current);
    if (!Array.isArray(downloadChapters)) throw new Error('漫画下载归属需要重新读取，请重试');
    const known = downloadChapters.map(raw => {
      const chapter = this.chapter(raw); this.assertBook(session, chapter); return chapter;
    });
    return { chapters, retentions, downloadChapters: known };
  }

  actions(snapshot: MangaDownloadSnapshot, chapterIndex?: number, hostDownloadActive: boolean = false): MangaDownloadAction[] {
    const selected = chapterIndex === undefined ? undefined : this.requireSelected(snapshot, chapterIndex);
    const rows = selected === undefined ? snapshot.chapters : [selected];
    const actions: MangaDownloadAction[] = [];
    const paused = rows.some(row => row.state === 'paused');
    if (!hostDownloadActive && !paused && rows.some(row => row.state !== 'completed')) {
      actions.push({ id: selected === undefined ? 'downloadBook' : 'downloadChapter',
        label: selected === undefined ? '下载全部章节' : '下载本话' });
    }
    if (rows.some(row => row.state === 'queued' || row.state === 'inProgress')) actions.push({ id: 'pause', label: '暂停下载' });
    if (paused) actions.push({ id: 'resume', label: selected === undefined ? '继续已暂停章节' : '继续下载' });
    if (rows.some(row => row.maxAttempts > 0 && this.operationApplies('cancel', row.state))) actions.push({ id: 'cancel', label: '取消下载' });
    const retained = selected === undefined ? snapshot.downloadChapters.length > 0 || snapshot.retentions.length > 0 :
      snapshot.downloadChapters.some(chapter => chapter.chapterId === selected.chapter.chapterId) ||
        snapshot.retentions.some(row => row.chapter.chapterId === selected.chapter.chapterId);
    if (selected !== undefined && retained && !hostDownloadActive && !paused) {
      actions.push({ id: 'updateChapter', label: '更新本话' });
    }
    if (retained) {
      actions.push({ id: 'releaseRetention', label: '解除永久保留' });
      actions.push({ id: 'deleteDownloads', label: '删除下载' });
    }
    if (selected === undefined) actions.push({ id: 'clearCache', label: '清除普通阅读缓存' });
    return actions;
  }

  async operate(session: RemoteReadingSession, operation: MangaDownloadOperation,
    chapterIndex?: number, current?: () => boolean): Promise<MangaDownloadSnapshot> {
    const snapshot = await this.snapshot(session, current);
    if (chapterIndex !== undefined) this.requireSelected(snapshot, chapterIndex);
    for (const chapter of snapshot.chapters) {
      if (chapterIndex !== undefined && chapter.chapterIndex !== chapterIndex) continue;
      if (chapter.maxAttempts === 0 || !this.operationApplies(operation, chapter.state)) continue;
      this.assertCurrent(current);
      const result = await this.runtime.request(`cache.download.${operation}`, {
        sourceId: session.identity.sourceId, bookId: session.identity.bookId, chapterIndex: chapter.chapterIndex,
      }, this.options(current));
      this.assertCurrent(current);
      const data = result.data as unknown as MangaDownloadTaskResult;
      if (data.sourceId !== session.identity.sourceId || data.bookId !== session.identity.bookId ||
        data.chapterIndex !== chapter.chapterIndex ||
        !['pending', 'paused', 'inProgress', 'completed', 'failed', 'cancelled'].includes(data.status)) {
        throw new Error('漫画下载操作结果需要重新读取，请重试');
      }
      this.integer(data.attempts); this.integer(data.maxAttempts);
    }
    // Completion may race a pause/cancel. Display the actual durable state,
    // never an optimistic operation label or a remembered local boolean.
    return this.snapshot(session, current);
  }

  async releaseRetention(session: RemoteReadingSession, chapterIndex?: number,
    current?: () => boolean): Promise<MangaDownloadSnapshot> {
    const snapshot = await this.snapshot(session, current);
    const chapters = await this.downloadChapters(session, snapshot, chapterIndex, current);
    for (const chapter of chapters) {
      await this.releaseChapter(chapter, current);
    }
    return this.snapshot(session, current);
  }

  async deleteDownloads(session: RemoteReadingSession, chapterIndex?: number,
    current?: () => boolean): Promise<MangaDownloadDeleteOutcome> {
    const snapshot = await this.snapshot(session, current);
    if (this.runtime.listMangaDownloadVersions === undefined || this.runtime.deleteMangaDownload === undefined) {
      throw new Error('当前暂时无法删除漫画下载，请稍后重试');
    }
    const chapters = await this.downloadChapters(session, snapshot, chapterIndex, current);
    const prepared: MangaDownloadPreparedDeletion[] = [];
    let removedVersions = 0, protectedVersions = 0;
    for (const chapter of chapters) {
      this.assertCurrent(current);
      const known = await this.runtime.listMangaDownloadVersions(chapter, current);
      this.assertCurrent(current);
      if (!Array.isArray(known)) throw new Error('漫画下载归属需要重新读取，请重试');
      const versions: Set<string> = new Set(known.map(version => this.identity(version)));
      for (const retained of snapshot.retentions) {
        if (retained.chapter.chapterId === chapter.chapterId) versions.add(retained.manifestVersion);
      }
      prepared.push({ chapter, versions: [...versions] });
    }
    // Inventory every version before releasing any retention: classification
    // switches to cache afterwards, so a later download-only scan would miss it.
    for (const entry of prepared) {
      await this.releaseChapter(entry.chapter, current);
      for (const version of entry.versions) {
        this.assertCurrent(current);
        const removed = await this.runtime.deleteMangaDownload(entry.chapter, version, current);
        this.assertCurrent(current);
        if (typeof removed !== 'boolean') throw new Error('漫画下载删除结果需要重新读取，请重试');
        if (removed) removedVersions += 1;
        else protectedVersions += 1;
      }
    }
    return { removedVersions, protectedVersions };
  }

  private async releaseChapter(chapter: MangaChapterIdentity, current?: () => boolean): Promise<void> {
    this.assertCurrent(current);
    const result = await this.runtime.request('manga.retention.set', {
      chapter: chapter as unknown as JsonObject, retain: false,
    }, this.options(current));
    this.assertCurrent(current);
    if (result.data['retention'] !== null) throw new Error('漫画下载保留状态需要重新读取，请重试');
  }

  private async downloadChapters(session: RemoteReadingSession, snapshot: MangaDownloadSnapshot,
    chapterIndex?: number, current?: () => boolean): Promise<MangaChapterIdentity[]> {
    if (chapterIndex !== undefined) return [this.requireSelected(snapshot, chapterIndex).chapter];
    // The exact Host inventory covers obsolete partial downloads absent from
    // the current directory. Selected Core versions without Host files join it.
    if (this.runtime.listMangaDownloadChapters === undefined) throw new Error('当前暂时无法管理本书全部下载，请稍后重试');
    const known = await this.runtime.listMangaDownloadChapters(session.identity.sourceId, session.identity.bookId, current);
    this.assertCurrent(current);
    if (!Array.isArray(known)) throw new Error('漫画下载归属需要重新读取，请重试');
    const chapters: MangaChapterIdentity[] = [], seen: Set<string> = new Set();
    for (const raw of [...known, ...snapshot.retentions.map(row => row.chapter)]) {
      const chapter = this.chapter(raw); this.assertBook(session, chapter);
      if (seen.has(chapter.chapterId)) continue;
      seen.add(chapter.chapterId); chapters.push(chapter);
    }
    return chapters;
  }

  private operationApplies(operation: MangaDownloadOperation, state: MangaDownloadChapterState): boolean {
    if (operation === 'resume') return state === 'paused';
    if (operation === 'pause') return state === 'queued' || state === 'inProgress' || state === 'failed';
    return state === 'queued' || state === 'inProgress' || state === 'paused' || state === 'failed';
  }
  private requireSelected(snapshot: MangaDownloadSnapshot, index: number): MangaDownloadChapterStatus {
    this.integer(index);
    const selected = snapshot.chapters.find(row => row.chapterIndex === index);
    if (selected === undefined) throw new Error('目标章节不可用，请重新打开目录');
    return selected;
  }
  private assertManga(session: RemoteReadingSession, current?: () => boolean): void {
    this.assertCurrent(current);
    if (session.contentKind !== 'manga' || this.runtime.supportsCoreCapability?.('manga.offline.v1') !== true) {
      throw new Error('漫画下载暂不可用');
    }
    this.identity(session.identity.sourceId); this.identity(session.identity.bookId);
  }
  private assertBook(session: RemoteReadingSession, chapter: MangaChapterIdentity): void {
    if (chapter.sourceId !== session.identity.sourceId || chapter.bookId !== session.identity.bookId) {
      throw new Error('漫画下载归属需要重新读取，请重试');
    }
  }
  private chapter(value: unknown): MangaChapterIdentity {
    const raw = this.object(value);
    return { sourceId: this.identity(raw['sourceId']), bookId: this.identity(raw['bookId']), chapterId: this.identity(raw['chapterId']) };
  }
  private identity(value: unknown): string {
    if (typeof value !== 'string' || value.trim().length === 0 || value.length > 4096 || /[\u0000-\u001f\u007f-\u009f]/.test(value)) {
      throw new Error('漫画下载归属需要重新读取，请重试');
    }
    return value;
  }
  private integer(value: unknown, maximum: number = 4294967295): number {
    if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0 || value > maximum) {
      throw new Error('漫画下载状态需要重新读取，请重试');
    }
    return value;
  }
  private object(value: unknown): JsonObject {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error('漫画下载状态需要重新读取，请重试');
    return value as JsonObject;
  }
  private state(value: unknown): MangaDownloadChapterState {
    if (value === 'missing' || value === 'queued' || value === 'paused' || value === 'inProgress' ||
      value === 'cached' || value === 'completed' || value === 'failed' || value === 'cancelled') return value;
    throw new Error('漫画下载状态需要重新读取，请重试');
  }
  private assertCurrent(current?: () => boolean): void {
    if (current?.() === false) throw new Error('CANCELLED');
  }
  private options(current?: () => boolean): RequestOptions {
    return current === undefined ? {} : { shouldCancel: (): boolean => !current() };
  }
}
