import type { BookAcquisitionCoordinator } from '../../app/BookAcquisitionCoordinator';
import type { RemoteReadingSession } from './RemoteReadingFlowGateway';
import type { image } from '@kit.ImageKit';
import type {
  JsonObject,
  ReaderCoreResultEvent,
  RequestOptions,
} from '@reader/core-harmony';

export type ReadingGatewayImage = {
  pixelMap: image.PixelMap | undefined;
  fileUri: string;
  width: number;
  height: number;
  intrinsicWidth?: number;
  intrinsicHeight?: number;
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
  /** Optional preparation has read authority only; foreground gateways own repairs. */
  readonly allowSourceContentCorrection?: boolean;
  /** Runtime/content lifetime for already displayed position persistence. */
  captureReadingContentValidity?(sourceId: string, bookId: string): () => boolean;
  supportsCoreCapability?(capability: string): boolean;
  /** One bounded, read-only persisted entry; never dispatches asynchronous work. */
  readPreparedEntry?(params: JsonObject): JsonObject;
  /** Existing immutable local archive for optional background parser upgrades. */
  retainedLocalBookSourcePath?(bookId: string, isCurrent: () => boolean): Promise<string | undefined>;
  /** Read-only catalog proof for preparation runtimes without acquisition authority. */
  hasCurrentCatalogProjection?(session: RemoteReadingSession): boolean;
  bookAcquisitions?(): BookAcquisitionCoordinator;
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
    isCurrent?: () => boolean,
  ): Promise<ReadingGatewayImage>;

  prefetchReadingImage?(
    identity: ReadingGatewayImageCacheIdentity,
    isCurrent?: () => boolean,
  ): Promise<void>;

  markOfflineImageChapterComplete?(
    chapter: ReadingGatewayImageChapterIdentity,
    resources: ReadingGatewayImageCacheIdentity[],
  ): Promise<void>;

  isOfflineImageChapterComplete?(chapter: ReadingGatewayImageChapterIdentity): Promise<boolean>;

  isOfflineImageChapterMaterialized?(sourceId: string, bookId: string, chapterIndex: number): Promise<boolean>;

  clearOfflineBookImages?(sourceId: string, bookId: string): Promise<void>;

  /** Releases one display file/native fallback after the chapter window evicts it. */
  releaseReadingImage?(fileUri: string, pixelMap?: image.PixelMap): void;
}
