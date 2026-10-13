import type { BookRequestOptions } from '../../app/BookRequestScheduler';
import type { common } from '@kit.AbilityKit';
import type { BookAcquisitionCoordinator } from '../../app/BookAcquisitionCoordinator';
import type { RemoteReadingSession } from './RemoteReadingFlowGateway';
import type { image } from '@kit.ImageKit';
import type {
  JsonObject,
  ReaderCoreResultEvent,
} from '@reader/core-harmony';

export type ReadingGatewayImage = {
  pixelMap: image.PixelMap | undefined;
  fileUri: string;
  width: number;
  height: number;
  intrinsicWidth?: number;
  intrinsicHeight?: number;
  regionY?: number;
  revision: string;
};

/** Exact chapter presentation owned until its reader/preview closes. */
export type MangaDisplaySessionScope = {
  sourceId: string;
  bookId: string;
  chapterId: string;
  contentVersion: string;
  sourceRuleVersion: string;
  decodeRevision: string;
  preview: boolean;
};

export type ReadingGatewayImageCacheIdentity = {
  sourceId: string;
  bookId: string;
  chapterIndex: number;
  chapterId?: string;
  contentVersion: string;
  mangaDecodeRevision?: string;
  imageUrl: string;
  resourceRef?: string;
  baseUrl?: string;
};

export type ReadingGatewayImageChapterIdentity = {
  sourceId: string;
  bookId: string;
  chapterIndex: number;
  chapterId?: string;
  contentVersion: string;
  mangaDecodeRevision?: string;
};

/** The only Core request surface feature gateways may consume. */
export interface ReadingGatewayRuntime {
  /** Existing Ability context supplies only platform IO to finite mutation intents. */
  getUIAbilityContext?(): common.UIAbilityContext;
  /** Ephemeral debug observation; never part of the persisted reading contract. */
  subscribeMangaOfflineProbe?(listener: (state: string) => void): () => void;
  finishMangaOfflineProbe?(sourceId: string, bookId: string): void;
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
    options?: BookRequestOptions,
  ): Promise<ReaderCoreResultEvent>;

  requestBook?(method: string, params?: JsonObject, options?: BookRequestOptions,
    priority?: 'foreground' | 'background'): Promise<ReaderCoreResultEvent>;
  allowOptionalMangaPreparation?(): boolean;
  isMangaPreparationForeground?(): boolean;

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
    resourceRef?: string,
    mangaPosition?: number,
    expectedSourceVersion?: string,
    mangaPreview?: boolean,
    mangaDecodeRevision?: string,
    mangaDisplaySessionId?: number,
  ): Promise<ReadingGatewayImage>;

  beginMangaDisplaySession?(scope: MangaDisplaySessionScope, isCurrent: () => boolean): number;
  endMangaDisplaySession?(sessionId: number): void;
  /** Synchronous prepared-file lease; no byte I/O, hashing or native decode. */
  tryAcquireMangaPreparedImage?(sessionId: number, scope: MangaDisplaySessionScope, resourceRef: string,
    mangaPosition: number, isCurrent: () => boolean): ReadingGatewayImage | undefined;

  prefetchReadingImage?(
    identity: ReadingGatewayImageCacheIdentity,
    isCurrent?: () => boolean,
    expectedSourceVersion?: string,
    allowNetwork?: boolean,
    priority?: 'foreground' | 'chapter' | 'background' | 'download',
  ): Promise<void>;

  markOfflineImageChapterComplete?(
    chapter: ReadingGatewayImageChapterIdentity,
    resources: ReadingGatewayImageCacheIdentity[],
    isCurrent?: () => boolean,
  ): Promise<void>;

  isOfflineImageChapterComplete?(chapter: ReadingGatewayImageChapterIdentity, manga?: boolean,
    isCurrent?: () => boolean): Promise<boolean>;

  isOfflineImageChapterMaterialized?(sourceId: string, bookId: string, chapterIndex: number): Promise<boolean>;

  clearOfflineBookImages?(sourceId: string, bookId: string, manga?: boolean): Promise<void>;

  listMangaDownloadChapters?(sourceId: string, bookId: string, isCurrent?: () => boolean):
    Promise<Array<{ sourceId: string; bookId: string; chapterId: string; }>>;
  listMangaDownloadVersions?(chapter: { sourceId: string; bookId: string; chapterId: string; },
    isCurrent?: () => boolean): Promise<string[]>;
  /** Called after retention release; false means the exact content is still protected. */
  deleteMangaDownload?(chapter: { sourceId: string; bookId: string; chapterId: string; },
    manifestVersion: string, isCurrent?: () => boolean): Promise<boolean>;

  /** Releases one acquired display lease when its caller retires or closes. */
  releaseReadingImage?(fileUri: string, pixelMap?: image.PixelMap): void;
}
