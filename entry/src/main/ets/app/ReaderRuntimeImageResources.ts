import type common from '@ohos.app.ability.common';
import type { JsonObject, ReaderCoreResultEvent } from '@reader/core-harmony';
import type { BookRequestOptions } from './BookRequestScheduler';
import { hilog } from '@kit.PerformanceAnalysisKit';
import { image } from '@kit.ImageKit';
import { readerHostCacheDirectory, readerHostFilesDirectory } from './diagnostics/ReaderPublicFixtureScope';
import { canonicalReadingImageBaseUrl } from '../common/ReadingImageIdentity';
import { LocalEpubResourceHost } from '../platform/reading-resources/LocalEpubResourceHost';
import { ReadingBodyImageHost, type ReadingBodyImagePayload } from '../platform/reading-resources/ReadingBodyImageHost';
import { MangaImageDecodeHost } from '../platform/reading-resources/MangaImageDecodeHost';
import { ReadingImageDiskCache, type ReadingImageCacheIdentity, type ReadingImageChapterIdentity,
  type MangaStorageChapter, type MangaStorageGrant } from '../platform/reading-resources/ReadingImageDiskCache';
import type { SharedDownloadStorageGateway } from '../features/downloads/application/SharedDownloadStorageGateway';
import type { MangaDisplaySessionScope } from '../features/reading/application/ReadingGatewayRuntime';
import type { ReaderMangaProbeRegistry } from './ReaderMangaProbeRegistry';

const LOG_DOMAIN = 0x5244;

/** One manga operation may publish its display before its own byte copies drain. */
type MangaImageWork = { drain?: Promise<void> };
export type MangaImagePriority = 'foreground' | 'chapter' | 'background' | 'download';
type MangaImageQueuedWork = { priority: MangaImagePriority; run: () => Promise<void> };
type MangaPreparedDisplayPage = { intrinsicHeight: number; tileHeight: number; regions: Map<number, ReadingBodyImagePayload>; };
type MangaDisplaySession = { scope: MangaDisplaySessionScope; current: () => boolean;
  aliases: Map<string, MangaPreparedDisplayPage>; files: Map<string, ReadingBodyImagePayload>;
  fileAliasCounts: Map<string, number>; };


interface ReaderRuntimeImagePorts {
  readonly request: (method: string, params?: JsonObject, options?: BookRequestOptions) => Promise<ReaderCoreResultEvent>;
  readonly requestTimeoutMs: number;
  readonly captureMangaContentValidity: (sourceId: string, bookId: string) => () => boolean;
  readonly downloadStorage: () => SharedDownloadStorageGateway | undefined;
  readonly retired: () => boolean;
}

/** Owns the serialized image work, storage grants, and native display leases. */
export class ReaderRuntimeImageResources {
  readonly storage: ReadingImageDiskCache;
  private readonly context: common.UIAbilityContext;
  private readonly localEpubResourceHost: LocalEpubResourceHost;
  private readonly ports: ReaderRuntimeImagePorts;
  private readonly probe: ReaderMangaProbeRegistry;
  /** Shared by foreground regions, adjacent preparation and explicit offline images. */
  private mangaImageTail: Promise<void> = Promise.resolve();
  private mangaImagePending: number = 0;
  private mangaImageQueue: MangaImageQueuedWork[] = [];
  private mangaImageActive: boolean = false;
  private mangaImageUrgentStreak: number = 0;
  private mangaImageIdle: (() => void) | undefined;
  /** Chapter/session ownership, not an eviction cache. No encoded bytes or
   * PixelMaps survive here; each physical display has one owner lease. */
  private readonly mangaDisplaySessions: Map<number, MangaDisplaySession> = new Map<number, MangaDisplaySession>();
  private nextMangaDisplaySession: number = 0;
  /** Lets concurrent Ability teardown callers await the same cleanup. */

  constructor(context: common.UIAbilityContext, ports: ReaderRuntimeImagePorts, probe: ReaderMangaProbeRegistry) {
    this.context = context;
    this.ports = ports;
    this.probe = probe;
    this.localEpubResourceHost = new LocalEpubResourceHost(context);
    this.storage = new ReadingImageDiskCache(context);
    ReadingBodyImageHost.setDisplayCacheDir(readerHostCacheDirectory(context.cacheDir));
    this.bindMangaStorage();
  }

  waitForIdle(): Promise<void> { return this.mangaImageTail; }

  retireInvalidDisplaySessions(): void {
    for (const [sessionId, session] of this.mangaDisplaySessions) {
      if (!session.current()) this.endMangaDisplaySession(sessionId);
    }
  }

  retireAllDisplaySessions(): void {
    for (const sessionId of this.mangaDisplaySessions.keys()) this.endMangaDisplaySession(sessionId);
  }

  private bindMangaStorage(): void {
    const selector = (chapter: MangaStorageChapter): JsonObject => ({ chapter: { sourceId: chapter.sourceId,
      bookId: chapter.bookId, chapterId: chapter.chapterId }, manifestVersion: chapter.contentVersion });
    const projectGrant = (value: JsonObject): MangaStorageGrant => {
      const chapter = value['chapter'] as JsonObject;
      return { sourceId: chapter['sourceId'] as string, bookId: chapter['bookId'] as string,
        chapterId: chapter['chapterId'] as string, contentVersion: value['manifestVersion'] as string, grantToken: value['token'] as string };
    };
    this.storage.setMangaStorageAuthority({
      classify: async (chapter) => (await this.ports.request('manga.cache.classify', selector(chapter))).data['status'] as
        'cache' | 'download' | 'protected' | 'unknown' | 'missing',
      classifyBatch: async (chapters) => {
        const response = await this.ports.request('manga.cache.classifyBatch', { versions: chapters.map((chapter) => ({
          ...selector(chapter), manifestVersion: chapter.contentVersion,
        })) });
        const results = response.data['results'];
        if (!Array.isArray(results) || results.length !== chapters.length) throw new Error('MANGA_CACHE_CLASSIFY_BATCH_INVALID');
        return results.map((result: JsonObject) => result['status'] as 'cache' | 'download' | 'protected' | 'unknown' | 'missing');
      },
      policy: async (chapter) => {
        const data = (await this.ports.request('manga.cache.classify', selector(chapter))).data;
        const lastReadAt = data['lastReadAt'];
        if (typeof data['inUse'] !== 'boolean' || (lastReadAt !== null && !Number.isSafeInteger(lastReadAt)))
          throw new Error('MANGA_CACHE_POLICY_UNAVAILABLE');
        return { status: data['status'] as 'cache' | 'download' | 'protected' | 'unknown' | 'missing',
          inUse: data['inUse'] as boolean, lastReadAt: lastReadAt as number | null };
      },
      policyBatch: async (chapters) => {
        const response = await this.ports.request('manga.cache.classifyBatch', { versions: chapters.map((chapter) => ({
          ...selector(chapter), manifestVersion: chapter.contentVersion,
        })) });
        const results = response.data['results'];
        if (!Array.isArray(results) || results.length !== chapters.length) throw new Error('MANGA_CACHE_POLICY_BATCH_INVALID');
        return results.map((data: JsonObject) => {
          const lastReadAt = data['lastReadAt'];
          if (typeof data['inUse'] !== 'boolean' || (lastReadAt !== null && !Number.isSafeInteger(lastReadAt)))
            throw new Error('MANGA_CACHE_POLICY_UNAVAILABLE');
          return { status: data['status'] as 'cache' | 'download' | 'protected' | 'unknown' | 'missing',
            inUse: data['inUse'] as boolean, lastReadAt: lastReadAt as number | null };
        });
      },
      candidates: async (reason, scope, expiry) => {
        if (reason === 'expiry' && expiry === undefined) throw new Error('MANGA_CACHE_EXPIRY_POLICY_REQUIRED');
        const data = (await this.ports.request('manga.cache.evict', { nowSeconds: expiry?.nowSeconds ?? Math.floor(Date.now() / 1000),
          ttlSeconds: reason === 'expiry' ? expiry!.ttlSeconds : 0 })).data;
        return (data['candidates'] as JsonObject[]).map(value => {
          const chapter = value['chapter'] as JsonObject;
          return { sourceId: chapter['sourceId'] as string, bookId: chapter['bookId'] as string,
            chapterId: chapter['chapterId'] as string, contentVersion: value['manifestVersion'] as string };
        }).filter(chapter => scope === undefined || (chapter.sourceId === scope.sourceId && chapter.bookId === scope.bookId));
      },
      claim: async (chapter, expiry) => {
        const grant = (await this.ports.request('manga.cache.eviction.claim', { ...selector(chapter), ...(expiry ?? {}) })).data['grant'];
        return grant === null ? undefined : projectGrant(grant as JsonObject);
      },
      complete: async (grant, removed): Promise<void> => { await this.ports.request('manga.cache.eviction.complete', { token: grant.grantToken, removed }); },
      pending: async () => ((await this.ports.request('manga.cache.eviction.pending')).data['grants'] as JsonObject[]).map(projectGrant),
    });
    const body = ReadingBodyImageHost.instance;
    body.configureMangaDisplayCache(readerHostFilesDirectory(this.context.filesDir));
    this.storage.setMangaExternalStorage({
      inventory: () => body.mangaDisplayInventory(),
      remove: (grant, files) => body.removeMangaDisplay(grant, files),
      removeDerived: (chapter, files, current) => body.removeMangaDerived(chapter, files, current),
    });
    body.setMangaDisplayReserve((chapter, bytes, priority) =>
      this.storage.reserveExternalWrite(chapter, bytes, priority === 'foreground' ? 'foreground' : 'background', 'derived'));
  }

  /**
   * Resolve one normalized body-image URL through Core's source semantics,
   * then execute the resulting request with the already-owned Host transport.
   * `isCurrent` uses keep-going semantics (true = the resolving selection is
   * still current) and is checked before and after both async boundaries, so a
   * superseded chapter can never publish image bytes or dimensions. The SDK's
   * shouldCancel slot is the logical inverse, applied only at that boundary.
   */
  async loadReadingImage(
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
  ): Promise<ReadingBodyImagePayload> {
    this.assertReadingImageCurrent(isCurrent);
    if (resourceRef === undefined && imageUrl.trim().toLowerCase().startsWith('data:image/')) {
      await this.ports.downloadStorage()?.waitForActiveMutation();
      this.assertReadingImageCurrent(isCurrent);
      const embedded = await (this.probe.readingSamplingEnabled() ?
        this.probe.observeReadingImageWork(sourceId, bookId, false, () => ReadingBodyImageHost.instance.loadDataUri(imageUrl, isCurrent)) :
        ReadingBodyImageHost.instance.loadDataUri(imageUrl, isCurrent));
      return this.admitReadingImage(embedded, isCurrent);
    }
    if (sourceId === 'local' && (imageUrl.startsWith('reader-local-epub://') || imageUrl.startsWith('reader-local-mobi://'))) {
      await this.ports.downloadStorage()?.waitForActiveMutation();
      this.assertReadingImageCurrent(isCurrent);
      const localImage = await (this.probe.readingSamplingEnabled() ?
        this.probe.observeReadingImageWork(sourceId, bookId, false, () => this.localEpubResourceHost.load(imageUrl, isCurrent)) :
        this.localEpubResourceHost.load(imageUrl, isCurrent));
      return this.admitReadingImage(localImage, isCurrent);
    }
    const identity = this.readingImageCacheIdentity(
      sourceId,
      bookId,
      chapterIndex,
      contentVersion,
      imageUrl,
      baseUrl,
    );
    if (resourceRef !== undefined) {
      if (mangaDecodeRevision !== 'identity-v1' && mangaDecodeRevision !== 'bytes-v1') throw new Error('MANGA_CACHE_PROFILE_REQUIRED');
      identity.resourceRef = resourceRef;
      identity.mangaDecodeRevision = mangaDecodeRevision;
      // Manga chapter identity is a Core business key, including any fragment.
      identity.baseUrl = baseUrl;
      identity.chapterId = baseUrl;
    }
    const cacheCurrent = this.storage.captureValidity(identity.sourceId, identity.bookId, isCurrent);
    // Once displayed, an original belongs to its exact content/storage owner,
    // rather than the temporary viewport that requested it. Capture before
    // queueing so rule changes, book clear, restore and teardown still revoke
    // its pending write; ordinary scrolling must not discard fetched bytes.
    const persistCurrent = resourceRef === undefined ? cacheCurrent :
      this.storage.captureValidity(identity.sourceId, identity.bookId,
        this.ports.captureMangaContentValidity(identity.sourceId, identity.bookId));
    // Capture both owners before the storage wait so clear/restore cannot
    // authorize an already queued request under a successor generation.
    await this.ports.downloadStorage()?.waitForActiveMutation();
    this.assertReadingImageCurrent(cacheCurrent);
    this.assertReadingImageCurrent(persistCurrent);
    if (mangaDisplaySessionId !== undefined && resourceRef !== undefined && baseUrl !== undefined &&
      expectedSourceVersion !== undefined && mangaDecodeRevision !== undefined) {
      const prepared = this.tryAcquireMangaPreparedImage(mangaDisplaySessionId,
        { sourceId, bookId, chapterId: baseUrl, contentVersion, sourceRuleVersion: expectedSourceVersion,
          decodeRevision: mangaDecodeRevision, preview: mangaPreview === true }, resourceRef, mangaPosition ?? 0,
        isCurrent ?? ((): boolean => true));
      if (prepared !== undefined) return prepared;
    }
    if (resourceRef !== undefined || mangaPosition !== undefined) {
      if (this.probe.readingSamplingEnabled()) return this.runMangaImageWork(cacheCurrent,
        (work: MangaImageWork): Promise<ReadingBodyImagePayload> => this.probe.observeReadingImageWork(sourceId, bookId, resourceRef !== undefined,
          (): Promise<ReadingBodyImagePayload> => this.loadReadingImageOwned(identity, allowNetwork, cacheCurrent,
            mangaPosition, expectedSourceVersion, mangaPreview, work, persistCurrent), (): Promise<void> | undefined => work.drain));
      return this.runMangaImageWork(cacheCurrent, (work: MangaImageWork): Promise<ReadingBodyImagePayload> =>
        this.loadReadingImageOwned(identity, allowNetwork, cacheCurrent, mangaPosition, expectedSourceVersion, mangaPreview, work, persistCurrent));
    }
    if (this.probe.readingSamplingEnabled()) return this.probe.observeReadingImageWork(sourceId, bookId, false,
      (): Promise<ReadingBodyImagePayload> => this.loadReadingImageOwned(identity, allowNetwork, cacheCurrent,
        mangaPosition, expectedSourceVersion, mangaPreview));
    return this.loadReadingImageOwned(identity, allowNetwork, cacheCurrent, mangaPosition, expectedSourceVersion, mangaPreview);
  }

  /** Called only after the manga lane is acquired, or by the unchanged novel path. */
  private async loadReadingImageOwned(identity: ReadingImageCacheIdentity, allowNetwork: boolean,
    cacheCurrent: () => boolean, mangaPosition?: number, expectedSourceVersion?: string, mangaPreview?: boolean,
    work?: MangaImageWork, persistCurrent: () => boolean = cacheCurrent): Promise<ReadingBodyImagePayload> {
    let cachedBytes: Uint8Array | undefined;
    try { cachedBytes = await this.storage.loadResource(identity, cacheCurrent); }
    catch (error) {
      // A previous Host's transformed payload is retained for recovery. Only
      // online preparation may replace its usability, in a new profile path.
      if (!allowNetwork || !(error instanceof Error)) throw error;
      if (error.message === 'MANGA_CACHE_RESOURCE_CORRUPT') {
        await this.storage.removeResource(identity, cacheCurrent);
      } else if (error.message !== 'READING_IMAGE_REPROCESS_REQUIRED') throw error;
    }
    if (cachedBytes !== undefined) {
      try {
        const cached = identity.resourceRef === undefined ?
          await ReadingBodyImageHost.instance.loadBytes(cachedBytes, cacheCurrent, mangaPosition, mangaPreview) :
          await ReadingBodyImageHost.instance.loadMangaBytes(cachedBytes, this.mangaStorageChapter(identity), cacheCurrent, mangaPosition ?? 0, mangaPreview);
        const admitted = this.admitReadingImage(cached, cacheCurrent);
        if ((this.mangaDisplaySessions?.size ?? 0) > 0)
          this.publishMangaPreparedImage(identity, expectedSourceVersion, mangaPosition ?? 0, mangaPreview === true, admitted);
        return admitted;
      } catch (error) {
        // loadResource already verified manga original bytes. Native decoding,
        // display I/O and allocation failures are not proof of corruption and
        // must never erase durable originals, including permanent downloads.
        if (identity.resourceRef !== undefined) throw error;
        if (mangaPosition !== undefined && error instanceof Error && error.message.startsWith('MANGA_REGION_')) throw error;
        await this.storage.removeResource(identity, cacheCurrent);
        if (!allowNetwork) {
          throw error;
        }
      }
    }
    if (!allowNetwork) {
      throw new Error('REMOTE_READING_IMAGE_NOT_DOWNLOADED');
    }
    const bytes = await this.prepareReadingImageBytes(identity, cacheCurrent, expectedSourceVersion);
    const payload = identity.resourceRef === undefined ?
      await ReadingBodyImageHost.instance.loadBytes(bytes, cacheCurrent, mangaPosition, mangaPreview) :
      await ReadingBodyImageHost.instance.loadMangaBytes(bytes, this.mangaStorageChapter(identity), cacheCurrent, mangaPosition ?? 0, mangaPreview);
    const admitted = this.admitReadingImage(payload, cacheCurrent);
    if ((this.mangaDisplaySessions?.size ?? 0) > 0)
      this.publishMangaPreparedImage(identity, expectedSourceVersion, mangaPosition ?? 0, mangaPreview === true, admitted);
    // The display resource is already decoded and actionable. Persistent
    // cache maintenance must not keep first paint waiting for a second disk
    // write; explicit offline prefetch retains its strict awaited path below.
    const stored = this.storage.storeResource(identity, bytes, persistCurrent)
      .catch((error: Error): void => {
        hilog.error(LOG_DOMAIN, 'Reader', 'Reader body image cache write failed: %{private}s', error.message);
      });
    // The first image can paint now; only this operation's retained cache bytes
    // keep the manga lane occupied. Unrelated disk-cache writes are not joined.
    if (work !== undefined) work.drain = stored;
    return admitted;
  }

  async readMangaImageForSave(identity: ReadingImageCacheIdentity, sourceRuleVersion: string,
    allowNetwork: boolean, current: () => boolean): Promise<Uint8Array | undefined> {
    if (identity.resourceRef === undefined || identity.chapterId !== identity.baseUrl) return undefined;
    const contentCurrent = this.ports.captureMangaContentValidity(identity.sourceId, identity.bookId);
    const cacheCurrent = this.storage.captureValidity(identity.sourceId, identity.bookId,
      (): boolean => current() && contentCurrent());
    await this.ports.downloadStorage()?.waitForActiveMutation();
    this.assertReadingImageCurrent(cacheCurrent);
    // Wait behind the foreground page's pending durable original. Export reads
    // the verified resource bytes and leaves both caches and progress alone.
    return this.runMangaImageWork(cacheCurrent, async (): Promise<Uint8Array | undefined> => {
      const cached = await this.storage.loadResource(identity, cacheCurrent);
      this.assertReadingImageCurrent(cacheCurrent);
      if (cached !== undefined || !allowNetwork) return cached;
      const bytes = await this.prepareReadingImageBytes(identity, cacheCurrent, sourceRuleVersion);
      this.assertReadingImageCurrent(cacheCurrent);
      return bytes;
    });
  }

  /** Persist and decode-validate one image before an offline chapter completes. */
  async prefetchReadingImage(
    identity: ReadingImageCacheIdentity,
    isCurrent?: () => boolean,
    expectedSourceVersion?: string,
    allowNetwork: boolean = true,
    priority: MangaImagePriority = 'download',
  ): Promise<void> {
    this.assertReadingImageCurrent(isCurrent);
    const ownedIdentity: ReadingImageCacheIdentity = identity.resourceRef === undefined ? { ...identity } :
      { ...identity, chapterId: identity.chapterId ?? identity.baseUrl,
        priority: priority === 'foreground' ? 'foreground' : 'background' };
    const contentCurrent = ownedIdentity.resourceRef === undefined ? undefined :
      this.ports.captureMangaContentValidity(ownedIdentity.sourceId, ownedIdentity.bookId);
    const cacheCurrent = this.storage.captureValidity(ownedIdentity.sourceId, ownedIdentity.bookId,
      (): boolean => isCurrent?.() !== false && contentCurrent?.() !== false);
    await this.ports.downloadStorage()?.waitForActiveMutation();
    this.assertReadingImageCurrent(cacheCurrent);
    if (ownedIdentity.resourceRef !== undefined) {
      // Capture the cache generation before waiting: a queued request cannot
      // become current again after a book clear or owner teardown.
      if (this.probe.readingSamplingEnabled()) return this.runMangaImageWork(cacheCurrent,
        (): Promise<void> => this.probe.observeReadingImageWork(ownedIdentity.sourceId, ownedIdentity.bookId, true,
          (): Promise<void> => this.prefetchReadingImageOwned(ownedIdentity, cacheCurrent, expectedSourceVersion, allowNetwork, priority)), priority);
      return this.runMangaImageWork(cacheCurrent, (): Promise<void> =>
        this.prefetchReadingImageOwned(ownedIdentity, cacheCurrent, expectedSourceVersion, allowNetwork, priority), priority);
    }
    if (this.probe.readingSamplingEnabled()) return this.probe.observeReadingImageWork(
      ownedIdentity.sourceId, ownedIdentity.bookId, false,
      (): Promise<void> => this.prefetchReadingImageOwned(ownedIdentity, cacheCurrent, expectedSourceVersion, allowNetwork));
    return this.prefetchReadingImageOwned(ownedIdentity, cacheCurrent, expectedSourceVersion, allowNetwork);
  }

  private async prefetchReadingImageOwned(identity: ReadingImageCacheIdentity, cacheCurrent: () => boolean,
    expectedSourceVersion?: string, allowNetwork: boolean = true, priority: MangaImagePriority = 'download'): Promise<void> {
    const onPrepared = (this.mangaDisplaySessions?.size ?? 0) === 0 ? undefined :
      (payload: ReadingBodyImagePayload, position: number): void => {
        if (cacheCurrent()) this.publishMangaPreparedImage(identity, expectedSourceVersion, position, false, payload);
      };
    let cachedBytes: Uint8Array | undefined;
    try { cachedBytes = await this.storage.loadResource(identity, cacheCurrent); }
    catch (error) {
      // A previous Host's transformed payload is retained for recovery. Only
      // online preparation may replace its usability, in a new profile path.
      if (!allowNetwork || !(error instanceof Error)) throw error;
      if (error.message === 'MANGA_CACHE_RESOURCE_CORRUPT') {
        await this.storage.removeResource(identity, cacheCurrent);
      } else if (error.message !== 'READING_IMAGE_REPROCESS_REQUIRED') throw error;
    }
    if (cachedBytes !== undefined) {
      try {
        if (identity.resourceRef === undefined) await ReadingBodyImageHost.instance.validateBytes(cachedBytes, cacheCurrent);
        else await ReadingBodyImageHost.instance.prepareMangaDisplay(cachedBytes, this.mangaStorageChapter(identity), cacheCurrent, priority, onPrepared);
        return;
      } catch (error) {
        // Corruption repair belongs to the explicit digest check above. A
        // display-preparation failure preserves verified downloaded content.
        if (identity.resourceRef !== undefined) throw error;
        await this.storage.removeResource(identity, cacheCurrent);
      }
    }
    if (!allowNetwork) throw new Error('REMOTE_READING_IMAGE_NOT_DOWNLOADED');
    const bytes = await this.prepareReadingImageBytes(identity, cacheCurrent, expectedSourceVersion);
    if (identity.resourceRef === undefined) await ReadingBodyImageHost.instance.validateBytes(bytes, cacheCurrent);
    else await ReadingBodyImageHost.instance.prepareMangaDisplay(bytes, this.mangaStorageChapter(identity), cacheCurrent, priority, onPrepared);
    this.assertReadingImageCurrent(cacheCurrent);
    await this.storage.storeResource(identity, bytes, cacheCurrent);
  }

  private mangaStorageChapter(identity: ReadingImageCacheIdentity): MangaStorageChapter {
    const chapterId = identity.chapterId ?? identity.baseUrl;
    if (chapterId === undefined || chapterId.trim().length === 0) throw new Error('MANGA_RESOURCE_IDENTITY_INVALID');
    return { sourceId: identity.sourceId, bookId: identity.bookId, chapterId, contentVersion: identity.contentVersion };
  }

  beginMangaDisplaySession(scope: MangaDisplaySessionScope, isCurrent: () => boolean): number {
    this.assertReadingImageCurrent(isCurrent);
    if ([scope.sourceId, scope.bookId, scope.chapterId, scope.contentVersion, scope.sourceRuleVersion]
      .some(value => typeof value !== 'string' || value.trim().length === 0) ||
      (scope.decodeRevision !== 'identity-v1' && scope.decodeRevision !== 'bytes-v1') || typeof scope.preview !== 'boolean')
      throw new Error('MANGA_RESOURCE_IDENTITY_INVALID');
    const contentCurrent = this.ports.captureMangaContentValidity(scope.sourceId, scope.bookId);
    const storageCurrent = this.storage.captureValidity(scope.sourceId, scope.bookId, contentCurrent);
    const current = (): boolean => storageCurrent() && isCurrent();
    this.assertReadingImageCurrent(current);
    const sessionId = ++this.nextMangaDisplaySession;
    this.mangaDisplaySessions.set(sessionId, { scope: { ...scope }, current,
      aliases: new Map<string, MangaPreparedDisplayPage>(), files: new Map<string, ReadingBodyImagePayload>(),
      fileAliasCounts: new Map<string, number>() });
    return sessionId;
  }

  endMangaDisplaySession(sessionId: number): void {
    const session = this.mangaDisplaySessions.get(sessionId);
    if (session === undefined) return;
    this.mangaDisplaySessions.delete(sessionId);
    for (const payload of session.files.values()) ReadingBodyImageHost.instance.release(payload.fileUri);
    session.aliases.clear(); session.files.clear(); session.fileAliasCounts.clear();
  }

  tryAcquireMangaPreparedImage(sessionId: number, scope: MangaDisplaySessionScope, resourceRef: string,
    mangaPosition: number, isCurrent: () => boolean): ReadingBodyImagePayload | undefined {
    this.assertReadingImageCurrent(isCurrent);
    const session = this.mangaDisplaySessions.get(sessionId);
    if (session === undefined) return undefined;
    if (!session.current()) { this.endMangaDisplaySession(sessionId); return undefined; }
    if (this.mangaDisplaySessionKey(scope) !== this.mangaDisplaySessionKey(session.scope) ||
      !Number.isFinite(mangaPosition) || mangaPosition < 0 || mangaPosition > 1) return undefined;
    const page = session.aliases.get(resourceRef);
    if (page === undefined) return undefined;
    // Match Body's normalized region coordinates, including its rounding
    // tolerance at y/height boundaries. Lookup examines metadata only.
    const targetY = Math.min(page.intrinsicHeight - 1, Math.floor(mangaPosition * page.intrinsicHeight + 0.000001));
    const regionY = session.scope.preview ? 0 : Math.floor(targetY / page.tileHeight) * page.tileHeight;
    const payload = page.regions.get(regionY);
    if (payload === undefined) return undefined;
    if (!session.scope.preview && (targetY < (payload.regionY ?? 0) || targetY >= (payload.regionY ?? 0) + payload.height)) return undefined;
    const acquired = ReadingBodyImageHost.instance.retainMangaDisplay(payload);
    if (acquired === undefined) { this.endMangaDisplaySession(sessionId); return undefined; }
    try { this.assertReadingImageCurrent(isCurrent); }
    catch (error) { ReadingBodyImageHost.instance.release(acquired.fileUri); throw error; }
    return acquired;
  }

  private mangaDisplaySessionKey(scope: MangaDisplaySessionScope): string {
    return JSON.stringify([scope.sourceId, scope.bookId, scope.chapterId, scope.contentVersion,
      scope.sourceRuleVersion, scope.decodeRevision, scope.preview]);
  }

  private publishMangaPreparedImage(identity: ReadingImageCacheIdentity, sourceRuleVersion: string | undefined,
    position: number, preview: boolean, payload: ReadingBodyImagePayload): void {
    const chapterId = identity.chapterId ?? identity.baseUrl;
    if (identity.resourceRef === undefined || chapterId === undefined || sourceRuleVersion === undefined ||
      identity.mangaDecodeRevision === undefined || !Number.isFinite(position) || position < 0 || position > 1) return;
    const scope: MangaDisplaySessionScope = { sourceId: identity.sourceId, bookId: identity.bookId, chapterId,
      contentVersion: identity.contentVersion, sourceRuleVersion, decodeRevision: identity.mangaDecodeRevision, preview };
    const scopeKey = this.mangaDisplaySessionKey(scope);
    for (const [sessionId, session] of this.mangaDisplaySessions) {
      if (!session.current()) { this.endMangaDisplaySession(sessionId); continue; }
      if (this.mangaDisplaySessionKey(session.scope) !== scopeKey) continue;
      if (!session.files.has(payload.fileUri)) {
        const retained = ReadingBodyImageHost.instance.retainMangaDisplay(payload);
        if (retained === undefined) continue;
        session.files.set(payload.fileUri, retained);
      }
      let page = session.aliases.get(identity.resourceRef);
      if (page === undefined) {
        page = { intrinsicHeight: payload.intrinsicHeight,
          tileHeight: Math.min(payload.intrinsicHeight, 2048, Math.max(1, Math.floor(1024 * 1024 / payload.intrinsicWidth))),
          regions: new Map<number, ReadingBodyImagePayload>() };
        session.aliases.set(identity.resourceRef, page);
      }
      const regionY = preview ? 0 : payload.regionY ?? 0;
      const previous = page.regions.get(regionY);
      page.regions.set(regionY, { ...payload, pixelMap: undefined });
      if (previous?.fileUri !== payload.fileUri) {
        session.fileAliasCounts.set(payload.fileUri, (session.fileAliasCounts.get(payload.fileUri) ?? 0) + 1);
        if (previous !== undefined) {
          const count = (session.fileAliasCounts.get(previous.fileUri) ?? 1) - 1;
          if (count > 0) session.fileAliasCounts.set(previous.fileUri, count);
          else {
            session.fileAliasCounts.delete(previous.fileUri); session.files.delete(previous.fileUri);
            ReadingBodyImageHost.instance.release(previous.fileUri);
          }
        }
      }
    }
  }

  /** Reuses the former regionTail ownership at the only allocating Runtime
   * entry. Queued callbacks contain descriptors, never fetched image bytes.
   * Core transfer/metadata callbacks belong to the running operation and must
   * not acquire this lane again while their Core request waits for them. */
  private async runMangaImageWork<T>(current: () => boolean,
    run: (work: MangaImageWork) => Promise<T>, priority: MangaImagePriority = 'foreground'): Promise<T> {
    this.assertReadingImageCurrent(current);
    if (this.mangaImagePending >= (priority === 'foreground' ? 16 : 12)) throw new Error('MANGA_DECODE_CAPACITY');
    if (this.mangaImagePending === 0) {
      this.mangaImageTail = new Promise<void>((resolve): void => { this.mangaImageIdle = resolve; });
    }
    this.mangaImagePending++;
    return new Promise<T>((resolve, reject): void => {
      this.mangaImageQueue.push({ priority, run: async (): Promise<void> => {
        const work: MangaImageWork = {};
        try { this.assertReadingImageCurrent(current); resolve(await run(work)); }
        catch (error) { reject(error); }
        finally {
          try { await work.drain; } catch (_) { /* The write owner reports failure. */ }
        }
      } });
      this.drainMangaImageWork();
    });
  }

  /** One allocating lane; queued jobs hold descriptors and foreground reserves. */
  private drainMangaImageWork(): void {
    if (this.mangaImageActive) return;
    let index = this.mangaImageQueue.findIndex(job => job.priority === 'foreground');
    if (index < 0) index = this.mangaImageQueue.findIndex(job => job.priority === 'chapter');
    const download = this.mangaImageQueue.findIndex(job => job.priority === 'download');
    // Bound the urgent burst so a permanent download keeps advancing during
    // a long chapter fill. Visible work keeps its reserved queue capacity.
    if (download >= 0 && (index < 0 || this.mangaImageUrgentStreak >= 4)) index = download;
    if (index < 0) index = 0;
    const job = this.mangaImageQueue.splice(index, 1)[0];
    if (job === undefined) return;
    this.mangaImageUrgentStreak = job.priority === 'foreground' || job.priority === 'chapter' ?
      this.mangaImageUrgentStreak + 1 : 0;
    this.mangaImageActive = true;
    void job.run().finally((): void => {
      this.mangaImageActive = false;
      this.mangaImagePending--;
      if (this.mangaImagePending === 0) { this.mangaImageIdle?.(); this.mangaImageIdle = undefined; }
      this.drainMangaImageWork();
    });
  }

  private async prepareReadingImageBytes(identity: ReadingImageCacheIdentity,
    isCurrent: () => boolean, expectedSourceVersion?: string): Promise<Uint8Array> {
    if (identity.resourceRef !== undefined) {
      if (expectedSourceVersion === undefined || identity.baseUrl === undefined) throw new Error('MANGA_DECODE_IDENTITY');
      return MangaImageDecodeHost.instance.prepare({
        chapter: { sourceId: identity.sourceId, bookId: identity.bookId, chapterId: identity.baseUrl },
        manifestVersion: identity.contentVersion,
        resourceRef: identity.resourceRef,
        sourceRuleVersion: expectedSourceVersion,
      }, (params: JsonObject): Promise<ReaderCoreResultEvent> => this.ports.request('manga.resource.prepare', params,
        { timeoutMs: 30000, shouldCancel: (): boolean => !isCurrent() }), isCurrent);
    }
    return ReadingBodyImageHost.instance.fetchRequestBytes(
      await this.resolveReadingImageRequest(identity.sourceId, identity.imageUrl, identity.baseUrl, isCurrent, expectedSourceVersion), isCurrent);
  }

  async markOfflineImageChapterComplete(
    chapter: ReadingImageChapterIdentity,
    resources: ReadingImageCacheIdentity[],
    isCurrent?: () => boolean,
  ): Promise<void> {
    const current = this.storage.captureValidity(chapter.sourceId, chapter.bookId, isCurrent);
    if (resources.some(resource => resource.resourceRef !== undefined)) {
      const ownedChapter: ReadingImageChapterIdentity = { ...chapter, priority: 'background' };
      const ownedResources: ReadingImageCacheIdentity[] = resources.map(resource => ({ ...resource, priority: 'background' }));
      // Acquire the image lane before the existing per-book mutation lock.
      // Digest reads own encoded bytes too; DiskCache never reenters this lane.
      return this.runMangaImageWork(current, (): Promise<void> =>
        this.storage.markChapterComplete(ownedChapter, ownedResources, current));
    }
    await this.storage.markChapterComplete(chapter, resources, current);
  }

  async isOfflineImageChapterComplete(chapter: ReadingImageChapterIdentity, manga: boolean = false,
    isCurrent?: () => boolean): Promise<boolean> {
    if (manga) {
      if (chapter.mangaDecodeRevision !== 'identity-v1' && chapter.mangaDecodeRevision !== 'bytes-v1') throw new Error('MANGA_CACHE_PROFILE_REQUIRED');
      const ownedChapter: ReadingImageChapterIdentity = { ...chapter };
      const current = this.storage.captureValidity(chapter.sourceId, chapter.bookId, isCurrent);
      return this.runMangaImageWork(current, async (): Promise<boolean> => {
        const complete = await this.storage.isChapterComplete(ownedChapter);
        this.assertReadingImageCurrent(current);
        return complete;
      });
    }
    return this.storage.isChapterComplete(chapter);
  }

  async isOfflineImageChapterMaterialized(
    sourceId: string,
    bookId: string,
    chapterIndex: number,
  ): Promise<boolean> {
    return this.storage.isChapterMaterialized(sourceId, bookId, chapterIndex);
  }

  async clearOfflineBookImages(sourceId: string, bookId: string, manga: boolean = false): Promise<void> {
    for (const [sessionId, session] of this.mangaDisplaySessions ?? []) {
      if (session.scope.sourceId === sourceId && session.scope.bookId === bookId) this.endMangaDisplaySession(sessionId);
    }
    await this.storage.clearBook(sourceId, bookId, manga);
  }

  async listMangaDownloadChapters(sourceId: string, bookId: string, isCurrent?: () => boolean):
    Promise<Array<{ sourceId: string; bookId: string; chapterId: string; }>> {
    return this.storage.listMangaDownloadChapters(sourceId, bookId, isCurrent);
  }

  async listMangaDownloadVersions(chapter: { sourceId: string; bookId: string; chapterId: string; },
    isCurrent?: () => boolean): Promise<string[]> {
    return this.storage.listMangaDownloadVersions(chapter, isCurrent);
  }

  async deleteMangaDownload(chapter: { sourceId: string; bookId: string; chapterId: string; },
    manifestVersion: string, isCurrent?: () => boolean): Promise<boolean> {
    return this.storage.deleteMangaVersion({ ...chapter, contentVersion: manifestVersion }, isCurrent);
  }

  private async resolveReadingImageRequest(
    sourceId: string,
    imageUrl: string,
    baseUrl: string | undefined,
    isCurrent?: () => boolean,
    expectedSourceVersion?: string,
  ): Promise<JsonObject> {
    const params: JsonObject = { sourceId, imageUrl };
    if (expectedSourceVersion !== undefined) params['expectedSourceVersion'] = expectedSourceVersion;
    const canonicalBaseUrl = canonicalReadingImageBaseUrl(baseUrl);
    if (canonicalBaseUrl !== undefined) {
      params['baseUrl'] = canonicalBaseUrl;
    }
    // The SDK's shouldCancel is the logical inverse of the isCurrent guard
    // that the rest of the image chain already agrees on; without the flip a
    // still-current selection cancels its own request on the first poll.
    const descriptor = await this.ports.request('source.imageRequest', params, {
      shouldCancel: isCurrent === undefined ? undefined : (): boolean => !isCurrent(),
      timeoutMs: this.ports.requestTimeoutMs,
    });
    this.assertReadingImageCurrent(isCurrent);
    const request = descriptor.data['request'];
    if (request === null || typeof request !== 'object' || Array.isArray(request)) {
      throw new Error('source.imageRequest returned an invalid Host request descriptor');
    }
    return request as JsonObject;
  }

  private readingImageCacheIdentity(
    sourceId: string,
    bookId: string,
    chapterIndex: number,
    contentVersion: string,
    imageUrl: string,
    baseUrl: string | undefined,
  ): ReadingImageCacheIdentity {
    return {
      sourceId,
      bookId,
      chapterIndex,
      contentVersion,
      imageUrl,
      baseUrl: canonicalReadingImageBaseUrl(baseUrl),
    };
  }

  /** Release one Host-created display resource after session eviction/teardown. */
  releaseReadingImage(fileUri: string, pixelMap?: image.PixelMap): void {
    ReadingBodyImageHost.instance.release(fileUri, pixelMap);
  }

  private assertReadingImageCurrent(isCurrent?: () => boolean): void {
    if (isCurrent !== undefined && !isCurrent()) {
      throw new Error('reading body image request was cancelled');
    }
    if (this.ports.retired()) {
      throw new Error('Reader Host is no longer available after teardown');
    }
  }

  private admitReadingImage(
    payload: ReadingBodyImagePayload,
    isCurrent?: () => boolean,
  ): ReadingBodyImagePayload {
    try {
      this.assertReadingImageCurrent(isCurrent);
      return payload;
    } catch (error) {
      ReadingBodyImageHost.instance.release(payload.fileUri, payload.pixelMap);
      throw error;
    }
  }
}
