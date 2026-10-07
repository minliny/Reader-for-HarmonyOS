import type { JsonObject, ReaderCoreResultEvent } from '@reader/core-harmony';
import type { BookRequestOptions } from '../../app/BookRequestScheduler';
import type { ShelfBook } from '../../app/ReaderCoreGateway';
import { MangaSessionGateway } from '../manga/MangaSessionGateway';
import { LocalReadingFlowGateway, type LocalReadingDownloadState } from '../reading/LocalReadingFlowGateway';
import type { ReadingGatewayRuntime } from '../reading/ReadingGatewayRuntime';
import {
  createDownloadBookView, downloadChapterStateLabel, projectDownloadBookAvailability,
  type DownloadBookView, type DownloadChapterView,
} from './SharedDownloadProjection';

/** Read-only joins of the existing Core catalog/body/queue and Host manifests.
 * No network acquisition, queue, cache policy or mutation authority lives here. */
export class SharedDownloadGateway {
  private readonly reads: ReadingGatewayRuntime;
  private readonly manifests: MangaSessionGateway;
  private readonly local: LocalReadingFlowGateway;
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
    this.manifests = new MangaSessionGateway(this.reads);
    this.local = new LocalReadingFlowGateway(this.reads);
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
      if (view.contentKind === 'manga') {
        // Check only persisted version candidates. Each batch is bounded;
        // entry.get reads at most one prepared window and never fetches images.
        const candidates = chapters.filter(chapter => chapter.navigable && chapter.mangaManifestVersion !== undefined);
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
      return { ...view, projectionStatus: 'unavailable', projectionError: (error as Error).message };
    }
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
      const localComplete = navigable && book.contentKind === 'novel' && cachedBytes > 0;
      const mangaManifestVersion = typeof row['mangaManifestVersion'] === 'string' &&
        (row['mangaManifestVersion'] as string).trim().length > 0 ? row['mangaManifestVersion'] as string : undefined;
      const level = row['level'] === undefined || row['level'] === null ? undefined : this.integer(row['level']);
      if (level !== undefined && (level < 1 || level > 32)) throw new Error('下载目录层级无效');
      rows.push({ key: JSON.stringify([book.sourceId, book.bookId, index]), sourceId: book.sourceId,
        bookId: book.bookId, index, title: row['title'] as string, chapterId, navigable, level,
        localComplete, queueState, cachedBytes, mangaManifestVersion,
        stateLabel: downloadChapterStateLabel(queueState, localComplete) });
    }
    return rows.sort((left, right) => left.index - right.index);
  }

  private async verifyMangaChapter(chapter: DownloadChapterView, current: () => boolean): Promise<void> {
    this.assertCurrent(current);
    if (this.runtime.isOfflineImageChapterComplete === undefined) throw new Error('当前无法验证漫画本地图片完整性');
    const entry = await this.manifests.entry(chapter.sourceId, chapter.bookId, chapter.index, current);
    this.assertCurrent(current);
    const manifest = entry?.chapter.manifest;
    if (manifest !== undefined && manifest.chapter.chapterId === chapter.chapterId &&
      manifest.manifestVersion === chapter.mangaManifestVersion) {
      chapter.mangaTotalPages = entry?.chapter.totalPages;
      chapter.localComplete = await this.runtime.isOfflineImageChapterComplete({
        sourceId: chapter.sourceId, bookId: chapter.bookId, chapterIndex: chapter.index,
        chapterId: chapter.chapterId, contentVersion: manifest.manifestVersion,
        mangaDecodeRevision: manifest.decodeRevision,
      }, true, current);
      this.assertCurrent(current);
      chapter.mangaSavedPages = chapter.localComplete ? chapter.mangaTotalPages : undefined;
    }
    chapter.stateLabel = downloadChapterStateLabel(chapter.queueState, chapter.localComplete);
  }

  private state(value: unknown): LocalReadingDownloadState {
    if (value === 'missing' || value === 'queued' || value === 'paused' || value === 'inProgress' ||
      value === 'cached' || value === 'completed' || value === 'failed' || value === 'cancelled') return value;
    throw new Error('下载章节状态无效');
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
