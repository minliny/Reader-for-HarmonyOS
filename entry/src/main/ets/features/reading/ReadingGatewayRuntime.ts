import type { image } from '@kit.ImageKit';
import type {
  JsonObject,
  ReaderCoreResultEvent,
  RequestOptions,
} from '@reader/core-harmony';

export type ReadingGatewayImage = {
  pixelMap: image.PixelMap;
  width: number;
  height: number;
  revision: string;
};

export type ReadingGatewayImageCacheIdentity = {
  sourceId: string;
  bookId: string;
  chapterIndex: number;
  contentVersion: string;
  imageUrl: string;
  baseUrl?: string;
};

export type ReadingGatewayImageChapterIdentity = {
  sourceId: string;
  bookId: string;
  chapterIndex: number;
  contentVersion: string;
};

/** The only Core request surface feature gateways may consume. */
export interface ReadingGatewayRuntime {
  request(
    method: string,
    params?: JsonObject,
    options?: RequestOptions,
  ): Promise<ReaderCoreResultEvent>;

  /**
   * Optional in pure gateway tests; production ReaderRuntimeOwner implements
   * it with Core `source.imageRequest` plus the existing Host HTTP adapter.
   */
  loadReadingImage?(
    sourceId: string,
    bookId: string,
    chapterIndex: number,
    contentVersion: string,
    imageUrl: string,
    baseUrl: string | undefined,
    allowNetwork: boolean,
    shouldCancel?: () => boolean,
  ): Promise<ReadingGatewayImage>;

  prefetchReadingImage?(
    identity: ReadingGatewayImageCacheIdentity,
    shouldCancel?: () => boolean,
  ): Promise<void>;

  markOfflineImageChapterComplete?(
    chapter: ReadingGatewayImageChapterIdentity,
    resources: ReadingGatewayImageCacheIdentity[],
  ): Promise<void>;

  isOfflineImageChapterComplete?(chapter: ReadingGatewayImageChapterIdentity): Promise<boolean>;

  isOfflineImageChapterMaterialized?(sourceId: string, bookId: string, chapterIndex: number): Promise<boolean>;

  clearOfflineBookImages?(sourceId: string, bookId: string): Promise<void>;

  /** Releases one native image after the bounded chapter window evicts it. */
  releaseReadingImage?(pixelMap: image.PixelMap): void;
}
