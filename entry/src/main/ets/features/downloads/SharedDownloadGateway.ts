import type { JsonObject, ReaderCoreResultEvent } from '@reader/core-harmony';
import type { BookRequestOptions } from '../../app/BookRequestScheduler';
import type { ShelfBook } from '../../app/ReaderCoreGateway';
import { LocalReadingFlowGateway, type LocalReadingDownloadState } from '../reading/LocalReadingFlowGateway';
import type { ReadingGatewayRuntime } from '../reading/ReadingGatewayRuntime';
import type { RemoteReadingSession } from '../reading/RemoteReadingFlowGateway';
import type { RemoteReadingVariable } from '../reading/RemoteReadingContract';
import { MangaSessionGateway } from '../manga/MangaSessionGateway';
import {
  createDownloadBookView, downloadChapterStateLabel, projectDownloadBookAvailability,
  type DownloadBookView, type DownloadChapterView,
} from './SharedDownloadProjection';

/** Read-only joins of the existing Core catalog/body/queue and Host manifests.
 * No network acquisition, queue, cache policy or mutation authority lives here. */
export class SharedDownloadGateway {
  private readonly reads: ReadingGatewayRuntime;
  private readonly local: LocalReadingFlowGateway;
  private readonly manifests: MangaSessionGateway;
  private readonly runtime: ReadingGatewayRuntime;

  constructor(runtime: ReadingGatewayRuntime) {
    this.runtime = runtime;
    this.reads = {
      supportsCoreCapability: (capability: string): boolean => runtime.supportsCoreCapability?.(capability) === true,
      request: (method: string, params?: JsonObject, options?: BookRequestOptions): Promise<ReaderCoreResultEvent> => {
        if (!['cache.book.status', 'local_book.toc', 'manga.entry.get'].includes(method)) {
          return Promise.reject(new Error('下载页当前仅允许读取已有内容'));
        }
        return runtime.requestBook === undefined ? runtime.request(method, params, options) :
          runtime.requestBook(method, params, options, 'background');
      },
    };
    this.local = new LocalReadingFlowGateway(this.reads);
    this.manifests = new MangaSessionGateway(this.reads);
  }

  /** Rebuild the minimal cache-only session needed by the existing offline
   * Host. It uses Core's canonical TOC/variables and never invents a source
   * URL, so download-page actions share the same queue/materialization path as
   * the reader directory. */
  async loadOfflineSession(input: DownloadBookView, isCurrent: () => boolean): Promise<RemoteReadingSession> {
    this.assertCurrent(isCurrent);
    const result = await this.reads.request('cache.book.status', {
      sourceId: input.sourceId, bookId: input.bookId, includeGlobalStats: false, includeChapterStates: true,
    }, { shouldCancel: (): boolean => !isCurrent() });
    this.assertCurrent(isCurrent);
    const data = result.data;
    if (data['sourceId'] !== input.sourceId || data['bookId'] !== input.bookId || !Array.isArray(data['chapters']))
      throw new Error('下载操作目录身份不一致');
    const variables = this.variables(data['continuationVariables']);
    const entries = (data['chapters'] as unknown[]).map((rawValue: unknown): RemoteReadingSession['entries'][number] => {
      const raw = this.object(rawValue);
      const index = this.integer(raw['chapterIndex']);
      const title = typeof raw['title'] === 'string' ? raw['title'] as string : '';
      const url = typeof raw['url'] === 'string' ? raw['url'] as string : '';
      return { index, title, url, variables: this.variables(raw['variables']),
        navigable: raw['navigable'] !== false && url.trim().length > 0,
        ...(typeof raw['level'] === 'number' && Number.isSafeInteger(raw['level']) ? { level: raw['level'] as number } : {}),
        ...(typeof raw['proofState'] === 'string' ? { proofState: raw['proofState'] as string } : {}),
        ...(typeof raw['resumeOnly'] === 'boolean' ? { resumeOnly: raw['resumeOnly'] as boolean } : {}) };
    });
    return {
      contentKind: input.contentKind === 'manga' ? 'manga' : 'text', acquisitionMode: 'offline',
      identity: { sourceId: input.sourceId, bookId: input.bookId }, detailUrl: '', tocUrl: '',
      book: { title: input.title, author: input.author, kind: input.shelfBook.kind, contentKind: input.contentKind === 'manga' ? 'manga' : 'text' },
      continuationVariables: variables, entries, hostRequirements: [],
      sourceVersion: typeof data['sourceVersion'] === 'string' ? data['sourceVersion'] as string : undefined,
      catalogAt: typeof data['catalogAt'] === 'number' ? data['catalogAt'] as number : undefined,
      catalogVersion: typeof data['catalogVersion'] === 'string' ? data['catalogVersion'] as string : undefined,
      contextVersion: typeof data['contextVersion'] === 'string' ? data['contextVersion'] as string : undefined,
    };
  }

  async load(input: ShelfBook | DownloadBookView, isCurrent: () => boolean): Promise<DownloadBookView> {
    this.assertCurrent(isCurrent);
    const projected = (input as DownloadBookView).shelfBook;
    const book: ShelfBook = projected === undefined ? input as ShelfBook : projected;
    const view = createDownloadBookView(book);
    if (view.contentKind === undefined) return view;
    const contentCurrent = this.runtime.captureReadingContentValidity?.(book.sourceId, book.bookId);
    const current = (): boolean => isCurrent() && (contentCurrent === undefined || contentCurrent());
    this.assertCurrent(current);
    try {
      const result = await this.reads.request('cache.book.status', {
        sourceId: book.sourceId, bookId: book.bookId, includeGlobalStats: false, includeChapterStates: true,
      }, { shouldCancel: (): boolean => !current() });
      this.assertCurrent(current);
      const data = result.data;
      if (data['sourceId'] !== book.sourceId || data['bookId'] !== book.bookId ||
        typeof data['tocAvailable'] !== 'boolean' || !Array.isArray(data['chapters'])) {
        throw new Error('下载内容归属需要重新读取');
      }
      let chapters = this.chapterRows(view, data['chapters']);
      let totalChapters: number | undefined = data['tocAvailable'] === true ?
        chapters.filter(chapter => chapter.navigable).length : undefined;
      if (book.sourceId === 'local') {
        const toc = await this.local.loadToc(book.bookId, current);
        this.assertCurrent(current);
        const known = new Map<number, DownloadChapterView>();
        for (const chapter of chapters) known.set(chapter.index, chapter);
        chapters = toc.entries.map(entry => {
          const cached = known.get(entry.index);
          // Local body facts retain their Core index/URL, joined to the local
          // catalog. A missing row is missing content, never a whole-book proof.
          const localComplete = cached?.localComplete === true;
          const queueState: LocalReadingDownloadState = cached?.queueState ?? 'missing';
          return { key: JSON.stringify([book.sourceId, book.bookId, entry.index]),
            sourceId: book.sourceId, bookId: book.bookId, index: entry.index,
            title: entry.title, chapterId: cached?.chapterId ?? '', level: entry.level,
            navigable: entry.navigable !== false, localComplete, queueState,
            cachedBytes: cached?.cachedBytes,
            stateLabel: downloadChapterStateLabel(queueState, localComplete) };
        });
        totalChapters = chapters.filter(chapter => chapter.navigable).length;
      }
      // Core queue state is only a first-pass hint for manga. A completed or
      // cached row with a manifest may still point at a missing or stale Host
      // file; validate the manifest and file lease in bounded batches before
      // publishing the list. Core can retain `cached` after a partial/retried
      // image write, so filtering to `completed` would hide repairable rows.
      // This keeps initialization bounded while preserving the old Host
      // completeness semantics for repair/cleanup decisions.
      if (view.contentKind === 'manga') {
        const candidates = chapters.filter(chapter => chapter.navigable &&
          chapter.mangaManifestVersion !== undefined &&
          (chapter.queueState === 'completed' || chapter.queueState === 'cached'));
        if (candidates.length > 0 && this.runtime.supportsCoreCapability?.('manga.entry.v1') !== true) {
          throw new Error('当前无法读取漫画本地内容版本');
        }
        for (let start = 0; start < candidates.length; start += 4) {
          this.assertCurrent(current);
          await Promise.all(candidates.slice(start, start + 4).map(chapter => this.verifyMangaChapter(chapter, current)));
          this.assertCurrent(current);
        }
      }
      this.assertCurrent(current);
      // Core only measures cached text-body bytes. Manga image totals are not
      // exposed by the current read surface, so size stays empty rather than
      // presenting a JSON/body-size estimate as occupied disk space.
      const bytes = view.contentKind === 'novel' ? chapters.filter(chapter => chapter.navigable)
        .reduce((total, chapter) => total + (chapter.cachedBytes ?? 0), 0) : undefined;
      return projectDownloadBookAvailability(view, chapters, totalChapters, bytes);
    } catch (error) {
      this.assertCurrent(current);
      const message = (error as Error).message;
      return { ...view, projectionStatus: 'unavailable', projectionError: this.publicProjectionError(message) };
    }
  }

  private async verifyMangaChapter(chapter: DownloadChapterView, current: () => boolean): Promise<void> {
    this.assertCurrent(current);
    if (this.runtime.isOfflineImageChapterComplete === undefined) {
      throw new Error('当前无法验证漫画本地图片完整性');
    }
    const entry = await this.manifests.entry(chapter.sourceId, chapter.bookId, chapter.index, current);
    this.assertCurrent(current);
    const manifest = entry?.chapter.manifest;
    if (manifest !== undefined && manifest.chapter.chapterId === chapter.chapterId &&
      manifest.manifestVersion === chapter.mangaManifestVersion) {
      chapter.mangaTotalPages = entry?.chapter.totalPages;
      chapter.localComplete = await this.runtime.isOfflineImageChapterComplete({
        sourceId: chapter.sourceId,
        bookId: chapter.bookId,
        chapterIndex: chapter.index,
        chapterId: manifest.chapter.chapterId,
        contentVersion: manifest.manifestVersion,
        mangaDecodeRevision: manifest.decodeRevision,
      }, true, current);
      this.assertCurrent(current);
      chapter.mangaSavedPages = chapter.localComplete ? chapter.mangaTotalPages : undefined;
    } else {
      chapter.localComplete = false;
      chapter.mangaTotalPages = undefined;
      chapter.mangaSavedPages = undefined;
    }
    chapter.stateLabel = chapter.localComplete ? downloadChapterStateLabel(chapter.queueState, true) :
      chapter.mangaManifestVersion !== undefined ? '待修复' : downloadChapterStateLabel(chapter.queueState, false);
  }

  private publicProjectionError(message: string): string {
    if (message === 'MANGA_CACHE_STORAGE_FULL' || message === 'MANGA_CHAPTER_CACHE_CAPACITY' ||
      /ENOSPC|no space|disk full|空间不足/i.test(message)) return '存储空间不足，请释放空间后重试。';
    return message;
  }

  private chapterRows(book: DownloadBookView, rawRows: unknown[]): DownloadChapterView[] {
    const seen = new Set<number>();
    const rows: DownloadChapterView[] = [];
    for (const raw of rawRows) {
      const row = this.object(raw);
      const index = this.integer(row['chapterIndex']);
      if (seen.has(index)) throw new Error('下载目录包含重复章节');
      seen.add(index);
      if (typeof row['title'] !== 'string' || typeof row['url'] !== 'string') throw new Error('下载目录条目不完整');
      const chapterId = row['url'] as string;
      const navigable = row['navigable'] !== false && chapterId.trim().length > 0;
      const queueState = this.state(row['state']);
      const cachedBytes = this.integer(row['cachedBytes']);
      // SQLite's status query joins the actual chapter_cache body with byte
      // metrics computed from that body by triggers. InMemory measures the
      // actual content string. A cached state by itself is insufficient.
      const mangaManifestVersion = typeof row['mangaManifestVersion'] === 'string' &&
        (row['mangaManifestVersion'] as string).trim().length > 0 ? row['mangaManifestVersion'] as string : undefined;
      // Core's batch status distinguishes a completed manga queue row from a
      // body-only/cache row. This is a projection hint for the list; opening a
      // chapter still performs the strict manifest and file check.
      const localComplete = book.contentKind === 'novel' ? navigable && cachedBytes > 0 :
        navigable && mangaManifestVersion !== undefined && queueState === 'completed';
      const level = row['level'] === undefined || row['level'] === null ? undefined : this.integer(row['level']);
      if (level !== undefined && (level < 1 || level > 32)) throw new Error('下载目录层级无效');
      rows.push({ key: JSON.stringify([book.sourceId, book.bookId, index]), sourceId: book.sourceId,
        bookId: book.bookId, index, title: row['title'] as string, chapterId, navigable, level,
        localComplete, queueState, cachedBytes, mangaManifestVersion,
        stateLabel: downloadChapterStateLabel(queueState, localComplete) });
    }
    return rows.sort((left, right) => left.index - right.index);
  }

  private state(value: unknown): LocalReadingDownloadState {
    if (value === 'missing' || value === 'queued' || value === 'paused' || value === 'inProgress' ||
      value === 'cached' || value === 'completed' || value === 'failed' || value === 'cancelled') return value;
    throw new Error('下载章节状态无效');
  }
  private variables(value: unknown): RemoteReadingVariable[] {
    if (value === undefined || value === null) return [];
    if (typeof value !== 'object' || Array.isArray(value)) throw new Error('下载章节变量无效');
    return Object.entries(value as Record<string, unknown>).filter((entry): boolean => typeof entry[1] === 'string')
      .map(([name, variable]): RemoteReadingVariable => ({ name, value: variable as string }));
  }
  private object(value: unknown): JsonObject {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error('下载内容记录无效');
    return value as JsonObject;
  }
  private integer(value: unknown): number {
    if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) throw new Error('下载内容计数无效');
    return value;
  }
  private assertCurrent(current: () => boolean): void {
    if (!current()) throw new Error('下载页读取已失效');
  }
}
