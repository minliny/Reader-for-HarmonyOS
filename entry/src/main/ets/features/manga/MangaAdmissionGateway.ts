import type { JsonObject, ReaderCoreResultEvent } from '@reader/core-harmony';
import type { ReadingGatewayRuntime } from '../reading/ReadingGatewayRuntime';
import type { RemoteReadingSession } from '../reading/RemoteReadingFlowGateway';
import { MangaSessionGateway } from './MangaSessionGateway';
import { MangaResourceGateway } from './MangaResourceGateway';
import type { MangaChapterResult, MangaFirstImageReceipt } from './MangaContract';
import type { ReadingGatewayImage } from '../reading/ReadingGatewayRuntime';

interface MangaPreparedFirstImage { chapter: MangaChapterResult; image: ReadingGatewayImage; }

/** First-image admission over the existing preparation intent and Host owner. */
export class MangaAdmissionGateway {
  private readonly runtime: ReadingGatewayRuntime;
  constructor(runtime: ReadingGatewayRuntime) { this.runtime = runtime; }

  async verify(session: RemoteReadingSession, current: () => boolean, revision?: number): Promise<void> {
    const prepared = await this.prepare(session, current, revision);
    new MangaResourceGateway(this.runtime).release(prepared.image);
  }

  async admit(session: RemoteReadingSession, book: JsonObject, revision: number,
    current: () => boolean): Promise<ReaderCoreResultEvent> {
    const prepared = await this.prepare(session, current, revision);
    const chapter = prepared.chapter;
    const image = prepared.image;
    const first = chapter.manifest.pages[0];
    try {
      if (!current()) throw new Error('MANGA_ADMISSION_CANCELLED');
      const receipt: MangaFirstImageReceipt = { chapter: chapter.manifest.chapter,
        chapterIndex: chapter.chapterIndex, manifestVersion: chapter.manifest.manifestVersion,
        sourceRuleVersion: chapter.manifest.sourceRuleVersion, decodeRevision: chapter.manifest.decodeRevision,
        pageId: first.pageId, resourceRef: first.resourceRef, imageRevision: image.revision,
        width: image.width, height: image.height };
      return await this.runtime.request('bookshelf.add', { ...book, requireReadable: true,
        preparationRevision: revision, mangaFirstImage: receipt as unknown as JsonObject }, { shouldCancel: (): boolean => !current() });
    } finally { new MangaResourceGateway(this.runtime).release(image); }
  }

  private async prepare(session: RemoteReadingSession, current: () => boolean,
    revision?: number): Promise<MangaPreparedFirstImage> {
    if (!current()) throw new Error('MANGA_ADMISSION_CANCELLED');
    const entry = session.entries.find(row => row.navigable !== false && row.url.trim().length > 0);
    if (entry === undefined || session.contentKind !== 'manga') throw new Error('MANGA_ADMISSION_CATALOG_REQUIRED');
    const gateway = new MangaSessionGateway(this.runtime);
    let chapter = await gateway.chapter(session.identity.sourceId,
      session.identity.bookId, entry.index, 'cacheFirst', current, undefined, revision);
    try { return { chapter, image: await this.loadFirst(session, chapter, current) }; }
    catch (error) {
      // Cached manifests deliberately omit expiring transport descriptors.
      // Renew once only when their bytes are absent; never retry a live request.
      if (!current() || !chapter.cached || chapter.resources.length > 0 ||
        chapter.manifest.sourceRuleVersion !== session.sourceVersion) throw error;
      chapter = await gateway.chapter(session.identity.sourceId, session.identity.bookId,
        entry.index, 'refresh', current, chapter.manifest.manifestVersion, revision);
      return { chapter, image: await this.loadFirst(session, chapter, current) };
    }
  }

  private async loadFirst(session: RemoteReadingSession, chapter: MangaChapterResult,
    current: () => boolean): Promise<ReadingGatewayImage> {
    if (chapter.manifest.sourceRuleVersion !== session.sourceVersion) throw new Error('MANGA_ADMISSION_SOURCE_CHANGED');
    const first = chapter.manifest.pages[0];
    const binding = chapter.resources.find(row => row.resourceRef === first.resourceRef)?.request;
    const resources = new MangaResourceGateway(this.runtime);
    return resources.loadPage({ sourceId: session.identity.sourceId, bookId: session.identity.bookId,
      sourceRuleVersion: chapter.manifest.sourceRuleVersion, decodeRevision: chapter.manifest.decodeRevision, chapterIndex: chapter.chapterIndex,
      chapterUrl: chapter.manifest.chapter.chapterId, contentVersion: chapter.manifest.manifestVersion },
      { ...(binding ?? { url: first.resourceRef }), resourceRef: first.resourceRef }, binding !== undefined, current, 0);
  }
}
