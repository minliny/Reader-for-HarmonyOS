import type { MangaDisplaySessionScope, ReadingGatewayImage, ReadingGatewayRuntime } from '../reading/ReadingGatewayRuntime';

/** Wire projection of Core MangaPageData; requestRule owns AnalyzeUrl semantics. */
export interface MangaResourcePage {
  url: string;
  resourceRef?: string;
  requestRule?: string;
  referrer?: string;
  headers?: Record<string, string>;
}

/** Supplied by the versioned Core chapter owner, never derived from a URL. */
export interface MangaResourceScope {
  sourceRuleVersion: string;
  decodeRevision: string;
  sourceId: string;
  bookId: string;
  chapterIndex: number;
  contentVersion: string;
  chapterUrl: string;
}

/** Manga's resource adapter over the shared transport, disk cache and pixels.
 * Loading one page does not certify a complete or offline chapter. */
export class MangaResourceGateway {
  private readonly runtime: ReadingGatewayRuntime;
  private displaySessionId: number | undefined;
  private displaySessionScope: MangaDisplaySessionScope | undefined;

  constructor(runtime: ReadingGatewayRuntime) {
    this.runtime = runtime;
  }

  beginDisplaySession(scope: MangaResourceScope, current: () => boolean, preview: boolean = false): void {
    this.endDisplaySession();
    this.assertScope(scope);
    if (this.runtime.beginMangaDisplaySession === undefined) return;
    const identity = this.displayScope(scope, preview);
    this.displaySessionId = this.runtime.beginMangaDisplaySession(identity, current);
    this.displaySessionScope = identity;
  }

  endDisplaySession(): void {
    const sessionId = this.displaySessionId;
    this.displaySessionId = undefined; this.displaySessionScope = undefined;
    if (sessionId !== undefined) this.runtime.endMangaDisplaySession?.(sessionId);
  }

  tryAcquirePage(scope: MangaResourceScope, page: MangaResourcePage, current: () => boolean,
    mangaPosition: number = 0, preview: boolean = false): ReadingGatewayImage | undefined {
    this.assertCurrent(current);
    this.assertPage(scope, page);
    const identity = this.displayScope(scope, preview);
    if (page.resourceRef === undefined || !this.sameDisplayScope(identity) || this.displaySessionId === undefined) return undefined;
    return this.runtime.tryAcquireMangaPreparedImage?.(this.displaySessionId, identity, page.resourceRef, mangaPosition, current);
  }

  private displayScope(scope: MangaResourceScope, preview: boolean): MangaDisplaySessionScope {
    return { sourceId: scope.sourceId, bookId: scope.bookId, chapterId: scope.chapterUrl,
      contentVersion: scope.contentVersion, sourceRuleVersion: scope.sourceRuleVersion, decodeRevision: scope.decodeRevision, preview };
  }

  private sameDisplayScope(scope: MangaDisplaySessionScope): boolean {
    const active = this.displaySessionScope;
    return active !== undefined && active.sourceId === scope.sourceId && active.bookId === scope.bookId &&
      active.chapterId === scope.chapterId && active.contentVersion === scope.contentVersion &&
      active.sourceRuleVersion === scope.sourceRuleVersion && active.decodeRevision === scope.decodeRevision && active.preview === scope.preview;
  }

  async loadPage(scope: MangaResourceScope, page: MangaResourcePage,
    allowNetwork: boolean, isCurrent: () => boolean, mangaPosition?: number, mangaPreview: boolean = false): Promise<ReadingGatewayImage> {
    // Runtime owns the shared manga allocation lane, including explicit offline
    // work and the operation's pending cache write. Do not lock it again here.
    return this.loadOwnedPage(scope, page, allowNetwork, isCurrent, mangaPosition, mangaPreview);
  }

  /** Optional next-chapter work uses the same Runtime owner as foreground and
   * explicit downloads, without a display lease or offline completion receipt. */
  async prefetchPage(scope: MangaResourceScope, page: MangaResourcePage, isCurrent: () => boolean,
    allowNetwork: boolean = true, priority: 'foreground' | 'chapter' | 'background' | 'download' = 'background'): Promise<void> {
    if (this.runtime.prefetchReadingImage === undefined) return;
    this.assertCurrent(isCurrent);
    if (page.resourceRef === undefined || page.resourceRef.length === 0) throw new Error('MANGA_RESOURCE_IDENTITY_INVALID');
    await this.runtime.prefetchReadingImage({ sourceId: scope.sourceId, bookId: scope.bookId,
      chapterId: scope.chapterUrl, chapterIndex: scope.chapterIndex, contentVersion: scope.contentVersion, imageUrl: page.requestRule ?? page.url,
      resourceRef: page.resourceRef, baseUrl: scope.chapterUrl, mangaDecodeRevision: scope.decodeRevision }, isCurrent, scope.sourceRuleVersion, allowNetwork, priority);
    this.assertCurrent(isCurrent);
  }

  private async loadOwnedPage(scope: MangaResourceScope, page: MangaResourcePage,
    allowNetwork: boolean, isCurrent: () => boolean, mangaPosition?: number, mangaPreview: boolean = false): Promise<ReadingGatewayImage> {
    this.assertCurrent(isCurrent);
    this.assertPage(scope, page);
    if (this.runtime.loadReadingImage === undefined || this.runtime.releaseReadingImage === undefined) {
      throw new Error('MANGA_RESOURCE_HOST_UNAVAILABLE');
    }
    const image = await this.runtime.loadReadingImage(scope.sourceId, scope.bookId, scope.chapterIndex,
      scope.contentVersion, page.requestRule ?? page.url, scope.chapterUrl, allowNetwork, isCurrent, page.resourceRef, mangaPosition,
      scope.sourceRuleVersion, mangaPreview, scope.decodeRevision,
      this.sameDisplayScope(this.displayScope(scope, mangaPreview)) ? this.displaySessionId : undefined);
    if (!isCurrent()) {
      this.release(image);
      throw new Error('MANGA_RESOURCE_CANCELLED');
    }
    if (image.fileUri.trim().length === 0 || !Number.isFinite(image.width) || !Number.isFinite(image.height) ||
      image.width <= 0 || image.height <= 0) {
      this.release(image);
      throw new Error('MANGA_RESOURCE_INVALID_IMAGE');
    }
    return image;
  }

  private assertScope(scope: MangaResourceScope): void {
    if (!['identity-v1', 'bytes-v1'].includes(scope.decodeRevision)) throw new Error('MANGA_CACHE_PROFILE_REQUIRED');
    if (typeof scope.sourceRuleVersion !== 'string' || scope.sourceRuleVersion.trim().length === 0 ||
      scope.sourceId.trim().length === 0 || scope.bookId.trim().length === 0 ||
      scope.contentVersion.trim().length === 0 || scope.chapterUrl.trim().length === 0 ||
      !Number.isSafeInteger(scope.chapterIndex) || scope.chapterIndex < 0) {
      throw new Error('MANGA_RESOURCE_IDENTITY_INVALID');
    }
  }

  private assertPage(scope: MangaResourceScope, page: MangaResourcePage): void {
    this.assertScope(scope);
    if (page.url.trim().length === 0) throw new Error('MANGA_RESOURCE_IDENTITY_INVALID');
    const requestRule = page.requestRule;
    if (requestRule !== undefined && requestRule.trim().length === 0) throw new Error('MANGA_REQUEST_RULE_INVALID');
    // Old Core descriptors cannot silently discard their explicit per-page
    // metadata. The new Core normalizes it into the requestRule as well.
    if (requestRule === undefined &&
      (page.referrer !== undefined || (page.headers !== undefined && Object.keys(page.headers).length > 0))) {
      throw new Error('MANGA_REQUEST_RULE_REQUIRED');
    }
  }

  release(image: ReadingGatewayImage): void {
    this.runtime.releaseReadingImage?.(image.fileUri, image.pixelMap);
  }

  private assertCurrent(isCurrent: () => boolean): void {
    if (!isCurrent()) throw new Error('MANGA_RESOURCE_CANCELLED');
  }
}
