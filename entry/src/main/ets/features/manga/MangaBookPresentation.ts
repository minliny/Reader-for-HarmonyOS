import type { MangaPreparedEntry, MangaProgressState, MangaLocation, MangaChapterResult, MangaManifestPage } from './MangaContract';

export interface MangaBookPosition {
  chapterIndex?: number;
  chapterTitle?: string;
  pageOrdinal: number;
  totalPages?: number;
}

/** Session display facts only. Core owns the durable location and manifest. */
export class MangaBookPresentation {
  private static owner: object | undefined = undefined;
  private static tokens: Map<string, { epoch: number; revision: number }> = new Map();
  private static positions: Map<string, MangaBookPosition> = new Map<string, MangaBookPosition>();
  /** Platform owners publish this into readerMangaPresentationRevision. */
  static revision: number = 0;

  private static key(sourceId: string, bookId: string): string {
    return `${sourceId.length}:${sourceId}${bookId.length}:${bookId}`;
  }

  static useOwner(owner: object): void {
    if (this.owner === owner) return;
    this.owner = owner; this.positions.clear(); this.tokens.clear(); this.revision += 1;
  }

  /** Retain the bounded admitted shelf window and current reader/detail. This
   * is a display projection, not a second cache or an eviction engine. */
  static retainIdentities(identities: { sourceId: string; bookId: string }[]): void {
    const keys = new Set(identities.map(identity => this.key(identity.sourceId, identity.bookId)));
    for (const key of this.positions.keys()) {
      if (!keys.has(key)) { this.positions.delete(key); this.tokens.delete(key); this.revision += 1; }
    }
    for (const key of this.tokens.keys()) if (!keys.has(key)) this.tokens.delete(key);
  }

  private static acceptToken(key: string, token: { epoch: number; revision: number } | undefined): boolean {
    if (token === undefined) return true;
    if (!Number.isSafeInteger(token.epoch) || !Number.isSafeInteger(token.revision)) return false;
    const previous = this.tokens.get(key);
    if (previous !== undefined && (previous.epoch > token.epoch ||
      (previous.epoch === token.epoch && previous.revision > token.revision))) return false;
    this.tokens.set(key, { epoch: token.epoch, revision: token.revision });
    return true;
  }

  private static put(key: string, position: MangaBookPosition): void {
    const previous = this.positions.get(key);
    if (previous !== undefined && previous.chapterIndex === position.chapterIndex &&
      previous.chapterTitle === position.chapterTitle && previous.pageOrdinal === position.pageOrdinal &&
      previous.totalPages === position.totalPages) return;
    this.positions.set(key, position); this.revision += 1;
  }

  static get(sourceId: string, bookId: string): MangaBookPosition | undefined {
    return this.positions.get(this.key(sourceId, bookId));
  }

  static admitEntry(sourceId: string, bookId: string, entry: MangaPreparedEntry | null): boolean {
    if (entry === null) return false;
    const key = this.key(sourceId, bookId);
    if (entry.progress.location === null) {
      if (!this.acceptToken(key, entry.progress.token)) return false;
      this.clear(sourceId, bookId);
      return true;
    }
    const location = entry.progress.location;
    if (location.chapter.sourceId !== sourceId || location.chapter.bookId !== bookId ||
      entry.chapter.manifest.chapter.chapterId !== location.chapter.chapterId ||
      entry.chapter.manifest.manifestVersion !== location.manifestVersion ||
      !Number.isSafeInteger(location.pageOrdinalFallback) || location.pageOrdinalFallback < 0 ||
      !Number.isSafeInteger(entry.chapter.totalPages) || entry.chapter.totalPages <= location.pageOrdinalFallback ||
      !entry.chapter.manifest.pages.some((page): boolean => page.pageId === location.pageId && page.ordinal === location.pageOrdinalFallback)) return false;
    const position: MangaBookPosition = { chapterIndex: entry.chapter.chapterIndex,
      chapterTitle: entry.chapter.chapterTitle, pageOrdinal: location.pageOrdinalFallback,
      totalPages: entry.chapter.totalPages };
    if (!this.acceptToken(key, entry.progress.token)) return false;
    this.put(key, position);
    return true;
  }

  static admitConfirmedLocation(sourceId: string, bookId: string, location: MangaLocation | null,
    chapter: MangaChapterResult, totalPages: number, admittedPage?: MangaManifestPage): boolean {
    const currentPage = admittedPage ?? chapter.manifest.pages.find((page): boolean =>
      page.pageId === location?.pageId && page.ordinal === location?.pageOrdinalFallback);
    if (location === null || location.chapter.sourceId !== sourceId || location.chapter.bookId !== bookId ||
      chapter.manifest.chapter.sourceId !== sourceId || chapter.manifest.chapter.bookId !== bookId ||
      chapter.manifest.chapter.chapterId !== location.chapter.chapterId ||
      chapter.manifest.manifestVersion !== location.manifestVersion ||
      !Number.isSafeInteger(location.pageOrdinalFallback) || location.pageOrdinalFallback < 0 ||
      !Number.isSafeInteger(totalPages) || totalPages <= location.pageOrdinalFallback ||
      currentPage === undefined || currentPage.pageId !== location.pageId || currentPage.ordinal !== location.pageOrdinalFallback) return false;
    const key = this.key(sourceId, bookId), token = this.tokens.get(key);
    if (token !== undefined && !this.acceptToken(key, { epoch: token.epoch, revision: location.progressRevision })) return false;
    this.put(key, { chapterIndex: chapter.chapterIndex,
      chapterTitle: chapter.chapterTitle, pageOrdinal: location.pageOrdinalFallback, totalPages });
    return true;
  }

  static admitProgress(sourceId: string, bookId: string, progress: MangaProgressState): boolean {
    const location = progress.location;
    const key = this.key(sourceId, bookId);
    if (location === null) {
      if (!this.acceptToken(key, progress.token)) return false;
      this.clear(sourceId, bookId);
      return true;
    }
    if (location.chapter.sourceId !== sourceId || location.chapter.bookId !== bookId ||
      !Number.isSafeInteger(location.pageOrdinalFallback) || location.pageOrdinalFallback < 0) return false;
    // A bare location does not certify a chapter name, index or total. Do not
    // retain these from a previous chapter without the corresponding manifest.
    if (!this.acceptToken(key, progress.token)) return false;
    this.put(key, { pageOrdinal: location.pageOrdinalFallback });
    return true;
  }

  static clear(sourceId: string, bookId: string): void {
    if (this.positions.delete(this.key(sourceId, bookId))) this.revision += 1;
  }

  static label(position: MangaBookPosition | undefined): string {
    if (position === undefined) return '尚未阅读';
    const page = `第 ${position.pageOrdinal + 1} 页`;
    const total = position.totalPages !== undefined && position.totalPages > position.pageOrdinal ?
      ` / ${position.totalPages} 页` : '';
    return `${position.chapterTitle?.trim() ? `${position.chapterTitle.trim()} · ` : ''}${page}${total}`;
  }
}
