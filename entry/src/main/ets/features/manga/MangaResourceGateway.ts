import type { ReadingGatewayImage, ReadingGatewayRuntime } from '../reading/ReadingGatewayRuntime';

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

  constructor(runtime: ReadingGatewayRuntime) {
    this.runtime = runtime;
  }

  async loadPage(scope: MangaResourceScope, page: MangaResourcePage,
    allowNetwork: boolean, isCurrent: () => boolean, mangaPosition?: number, mangaPreview: boolean = false): Promise<ReadingGatewayImage> {
    // Runtime owns the shared manga allocation lane, including explicit offline
    // work and the operation's pending cache write. Do not lock it again here.
    return this.loadOwnedPage(scope, page, allowNetwork, isCurrent, mangaPosition, mangaPreview);
  }

  /** Optional next-chapter work uses the same Runtime owner as foreground and
   * explicit downloads, without a display lease or offline completion receipt. */
  async prefetchPage(scope: MangaResourceScope, page: MangaResourcePage, isCurrent: () => boolean): Promise<void> {
    if (this.runtime.prefetchReadingImage === undefined) return;
    this.assertCurrent(isCurrent);
    if (page.resourceRef === undefined || page.resourceRef.length === 0) throw new Error('MANGA_RESOURCE_IDENTITY_INVALID');
    await this.runtime.prefetchReadingImage({ sourceId: scope.sourceId, bookId: scope.bookId,
      chapterIndex: scope.chapterIndex, contentVersion: scope.contentVersion, imageUrl: page.requestRule ?? page.url,
      resourceRef: page.resourceRef, baseUrl: scope.chapterUrl, mangaDecodeRevision: scope.decodeRevision }, isCurrent, scope.sourceRuleVersion, true);
    this.assertCurrent(isCurrent);
  }

  private async loadOwnedPage(scope: MangaResourceScope, page: MangaResourcePage,
    allowNetwork: boolean, isCurrent: () => boolean, mangaPosition?: number, mangaPreview: boolean = false): Promise<ReadingGatewayImage> {
    this.assertCurrent(isCurrent);
    if (!['identity-v1', 'bytes-v1'].includes(scope.decodeRevision)) throw new Error('MANGA_CACHE_PROFILE_REQUIRED');
    if (typeof scope.sourceRuleVersion !== 'string' || scope.sourceRuleVersion.trim().length === 0 ||
      scope.sourceId.trim().length === 0 || scope.bookId.trim().length === 0 ||
      scope.contentVersion.trim().length === 0 || scope.chapterUrl.trim().length === 0 ||
      !Number.isSafeInteger(scope.chapterIndex) || scope.chapterIndex < 0 || page.url.trim().length === 0) {
      throw new Error('MANGA_RESOURCE_IDENTITY_INVALID');
    }
    if (this.runtime.loadReadingImage === undefined || this.runtime.releaseReadingImage === undefined) {
      throw new Error('MANGA_RESOURCE_HOST_UNAVAILABLE');
    }
    const requestRule = page.requestRule;
    if (requestRule !== undefined && requestRule.trim().length === 0) throw new Error('MANGA_REQUEST_RULE_INVALID');
    // Old Core descriptors cannot silently discard their explicit per-page
    // metadata. The new Core normalizes it into the requestRule as well.
    if (requestRule === undefined &&
      (page.referrer !== undefined || (page.headers !== undefined && Object.keys(page.headers).length > 0))) {
      throw new Error('MANGA_REQUEST_RULE_REQUIRED');
    }
    const image = await this.runtime.loadReadingImage(scope.sourceId, scope.bookId, scope.chapterIndex,
      scope.contentVersion, requestRule ?? page.url, scope.chapterUrl, allowNetwork, isCurrent, page.resourceRef, mangaPosition,
      scope.sourceRuleVersion, mangaPreview, scope.decodeRevision);
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

  release(image: ReadingGatewayImage): void {
    this.runtime.releaseReadingImage?.(image.fileUri, image.pixelMap);
  }

  private assertCurrent(isCurrent: () => boolean): void {
    if (!isCurrent()) throw new Error('MANGA_RESOURCE_CANCELLED');
  }
}
