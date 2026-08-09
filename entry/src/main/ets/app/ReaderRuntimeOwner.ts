import common from '@ohos.app.ability.common';
import {
  createReaderCoreRuntime,
  type JsonObject,
  type ReaderCoreResultEvent,
  type ReaderCoreRuntime,
  type RequestOptions,
} from '@reader/core-harmony';
import {
  type BookSourceJsonSelection,
  type LocalBookAssetCommit,
  type LocalBookInput,
  type LocalBookPreparation,
  ReaderHostRegistry,
} from './ReaderHostRegistry';
import { HarmonySystemTtsHost } from './HarmonySystemTtsHost';
import { LocalEpubResourceHost } from './LocalEpubResourceHost';
import { ReadingBodyImageHost, type ReadingBodyImagePayload } from './ReadingBodyImageHost';
import {
  ReadingImageDiskCache,
  type ReadingImageCacheIdentity,
  type ReadingImageChapterIdentity,
} from './ReadingImageDiskCache';
import { ArkWebExecutor } from './ArkWebExecutor';
import { image } from '@kit.ImageKit';

type RuntimeState = 'new' | 'starting' | 'ready' | 'closing' | 'closed';

// Local import and materialized chapter reads may perform file and parsing I/O.
// The SDK's generic 2s default is unsuitable; callers may still opt into a
// narrower explicit limit.
const DEFAULT_CORE_REQUEST_TIMEOUT_MS = 30000;

/**
 * Owns the one and only native Core runtime for the full application process.
 * Pages receive page state through gateways and never create or parse Core.
 */
export class ReaderRuntimeOwner {
  private static instance: ReaderRuntimeOwner | undefined = undefined;

  private readonly host: ReaderHostRegistry;
  private readonly ttsHost: HarmonySystemTtsHost;
  private readonly localEpubResourceHost: LocalEpubResourceHost;
  private readonly readingImageDiskCache: ReadingImageDiskCache;
  private runtime: ReaderCoreRuntime | undefined = undefined;
  private startup: Promise<void> | undefined = undefined;
  /** Serializes background storage flushes with teardown. */
  private flushTail: Promise<void> = Promise.resolve();
  /** Lets concurrent Ability teardown callers await the same cleanup. */
  private closeTask: Promise<void> | undefined = undefined;
  private state: RuntimeState = 'new';

  private constructor(context: common.UIAbilityContext) {
    this.host = new ReaderHostRegistry(context);
    this.ttsHost = new HarmonySystemTtsHost();
    this.localEpubResourceHost = new LocalEpubResourceHost(context);
    this.readingImageDiskCache = new ReadingImageDiskCache(context);
  }

  static install(context: common.UIAbilityContext): ReaderRuntimeOwner {
    if (ReaderRuntimeOwner.instance === undefined) {
      ReaderRuntimeOwner.instance = new ReaderRuntimeOwner(context);
    }
    return ReaderRuntimeOwner.instance;
  }

  static current(): ReaderRuntimeOwner {
    if (ReaderRuntimeOwner.instance === undefined) {
      throw new Error('ReaderRuntimeOwner must be installed by EntryAbility');
    }
    return ReaderRuntimeOwner.instance;
  }

  async start(): Promise<void> {
    if (this.state === 'closing' || this.state === 'closed') {
      throw new Error('Reader Core runtime is no longer available after teardown');
    }
    if (this.state === 'ready') {
      return;
    }
    if (this.startup !== undefined) {
      return this.startup;
    }
    this.state = 'starting';
    this.startup = this.startRuntime();
    try {
      await this.startup;
    } finally {
      this.startup = undefined;
    }
  }

  async request(method: string, params: JsonObject = {}, options: RequestOptions = {}): Promise<ReaderCoreResultEvent> {
    await this.start();
    const runtime = this.runtime;
    if (runtime === undefined) {
      throw new Error('Reader Core runtime did not become ready');
    }
    if (options.timeoutMs !== undefined) {
      return runtime.request(method, params, options);
    }
    return runtime.request(method, params, {
      timeoutMs: DEFAULT_CORE_REQUEST_TIMEOUT_MS,
      pollMs: options.pollMs,
      hostRequest: options.hostRequest,
      shouldCancel: options.shouldCancel,
    });
  }

  /**
   * Coordinated Host cleanup after Core has durably disabled/deleted a source.
   * The opaque source id scopes the jar; no cookie plaintext crosses Core.
   */
  async clearSourceCookieSession(sourceId: string): Promise<void> {
    await this.host.clearSourceCookieSession(sourceId);
  }

  /** Open a user-operated source login/challenge page on the shared Host jar. */
  async openSourceLogin(sourceId: string, loginUrl: string, sourceName: string): Promise<void> {
    await ArkWebExecutor.instance.openInteractive(
      loginUrl,
      sourceId,
      `${sourceName} · 登录 / 验证`,
    );
  }

  /**
   * Resolve one normalized body-image URL through Core's source semantics,
   * then execute the resulting request with the already-owned Host transport.
   * A stale selection is checked before and after both async boundaries, so a
   * superseded chapter can never publish image bytes or dimensions.
   */
  async loadReadingImage(
    sourceId: string,
    bookId: string,
    chapterIndex: number,
    contentVersion: string,
    imageUrl: string,
    baseUrl: string | undefined,
    allowNetwork: boolean,
    shouldCancel?: () => boolean,
  ): Promise<ReadingBodyImagePayload> {
    this.assertReadingImageCurrent(shouldCancel);
    if (imageUrl.trim().toLowerCase().startsWith('data:image/')) {
      const embedded = await ReadingBodyImageHost.instance.loadDataUri(imageUrl, shouldCancel);
      return this.admitReadingImage(embedded, shouldCancel);
    }
    if (sourceId === 'local' && imageUrl.startsWith('reader-local-epub://')) {
      const localImage = await this.localEpubResourceHost.load(imageUrl);
      return this.admitReadingImage(localImage, shouldCancel);
    }
    const identity = this.readingImageCacheIdentity(
      sourceId,
      bookId,
      chapterIndex,
      contentVersion,
      imageUrl,
      baseUrl,
    );
    const cachedBytes = await this.readingImageDiskCache.loadResource(identity);
    if (cachedBytes !== undefined) {
      try {
        const cached = await ReadingBodyImageHost.instance.loadBytes(cachedBytes, shouldCancel);
        return this.admitReadingImage(cached, shouldCancel);
      } catch (error) {
        await this.readingImageDiskCache.removeResource(identity);
        if (!allowNetwork) {
          throw error;
        }
      }
    }
    if (!allowNetwork) {
      throw new Error('REMOTE_READING_IMAGE_NOT_DOWNLOADED');
    }
    const request = await this.resolveReadingImageRequest(sourceId, imageUrl, baseUrl, shouldCancel);
    const bytes = await ReadingBodyImageHost.instance.fetchRequestBytes(request, shouldCancel);
    const payload = await ReadingBodyImageHost.instance.loadBytes(bytes, shouldCancel);
    try {
      await this.readingImageDiskCache.storeResource(identity, bytes);
    } catch (error) {
      // An ordinary online read remains usable when persistent storage is
      // full. Explicit offline prefetch uses the strict method below and
      // surfaces the same write failure instead of publishing completion.
      console.error(`Reader body image cache write failed: ${(error as Error).message}`);
    }
    return this.admitReadingImage(payload, shouldCancel);
  }

  /** Persist and decode-validate one image before an offline chapter completes. */
  async prefetchReadingImage(
    identity: ReadingImageCacheIdentity,
    shouldCancel?: () => boolean,
  ): Promise<void> {
    this.assertReadingImageCurrent(shouldCancel);
    const cachedBytes = await this.readingImageDiskCache.loadResource(identity);
    if (cachedBytes !== undefined) {
      try {
        const payload = await ReadingBodyImageHost.instance.loadBytes(cachedBytes, shouldCancel);
        ReadingBodyImageHost.instance.release(payload.pixelMap);
        return;
      } catch (_) {
        await this.readingImageDiskCache.removeResource(identity);
      }
    }
    const request = await this.resolveReadingImageRequest(
      identity.sourceId,
      identity.imageUrl,
      identity.baseUrl,
      shouldCancel,
    );
    const bytes = await ReadingBodyImageHost.instance.fetchRequestBytes(request, shouldCancel);
    const payload = await ReadingBodyImageHost.instance.loadBytes(bytes, shouldCancel);
    ReadingBodyImageHost.instance.release(payload.pixelMap);
    this.assertReadingImageCurrent(shouldCancel);
    await this.readingImageDiskCache.storeResource(identity, bytes);
  }

  async markOfflineImageChapterComplete(
    chapter: ReadingImageChapterIdentity,
    resources: ReadingImageCacheIdentity[],
  ): Promise<void> {
    await this.readingImageDiskCache.markChapterComplete(chapter, resources);
  }

  async isOfflineImageChapterComplete(chapter: ReadingImageChapterIdentity): Promise<boolean> {
    return this.readingImageDiskCache.isChapterComplete(chapter);
  }

  async isOfflineImageChapterMaterialized(
    sourceId: string,
    bookId: string,
    chapterIndex: number,
  ): Promise<boolean> {
    return this.readingImageDiskCache.isChapterMaterialized(sourceId, bookId, chapterIndex);
  }

  async clearOfflineBookImages(sourceId: string, bookId: string): Promise<void> {
    await this.readingImageDiskCache.clearBook(sourceId, bookId);
  }

  private async resolveReadingImageRequest(
    sourceId: string,
    imageUrl: string,
    baseUrl: string | undefined,
    shouldCancel?: () => boolean,
  ): Promise<JsonObject> {
    const params: JsonObject = { sourceId, imageUrl };
    if (baseUrl !== undefined && baseUrl.trim().length > 0) {
      params['baseUrl'] = baseUrl;
    }
    const descriptor = await this.request('source.imageRequest', params, {
      shouldCancel,
      timeoutMs: DEFAULT_CORE_REQUEST_TIMEOUT_MS,
    });
    this.assertReadingImageCurrent(shouldCancel);
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
    return { sourceId, bookId, chapterIndex, contentVersion, imageUrl, baseUrl };
  }

  /** Release one Host-created native image after session eviction/teardown. */
  releaseReadingImage(pixelMap: image.PixelMap): void {
    ReadingBodyImageHost.instance.release(pixelMap);
  }

  async flush(): Promise<void> {
    const previousFlush = this.flushTail;
    let releaseFlush: (() => void) | undefined = undefined;
    this.flushTail = new Promise<void>((resolve: () => void): void => {
      releaseFlush = resolve;
    });
    try {
      // A failed earlier flush must not strand this queue (and teardown) behind
      // an unresolved successor. Preserve that earlier caller's rejection but
      // always release this slot in `finally`.
      await previousFlush;
      const runtime = this.runtime;
      if (runtime === undefined || this.state !== 'ready') {
        return;
      }
      await runtime.request('runtime.storage.flush', {}, { timeoutMs: 30000 });
    } finally {
      if (releaseFlush !== undefined) {
        releaseFlush();
      }
    }
  }

  /**
   * Exposes the stored UIAbilityContext for Host-side persistence
   * (e.g. app-level settings stored via @ohos.data.preferences). Core
   * itself does not own app-level settings, so this is intentionally
   * kept separate from the Core protocol boundary.
   */
  getUIAbilityContext(): common.UIAbilityContext {
    return this.host.getContext();
  }

  getTtsHost(): HarmonySystemTtsHost {
    if (this.state === 'closing' || this.state === 'closed') {
      throw new Error('Reader system TTS Host is no longer available after teardown');
    }
    return this.ttsHost;
  }

  async selectLocalBookInputs(): Promise<LocalBookPreparation[]> {
    if (this.state === 'closing' || this.state === 'closed') {
      throw new Error('Reader Host is no longer available after teardown');
    }
    return this.host.selectLocalBookInputs();
  }

  async selectBookSourceJson(): Promise<BookSourceJsonSelection | undefined> {
    if (this.state === 'closing' || this.state === 'closed') {
      throw new Error('Reader Host is no longer available after teardown');
    }
    return this.host.selectBookSourceJson();
  }

  async commitLocalBookInput(input: LocalBookInput): Promise<LocalBookAssetCommit> {
    return this.host.commitLocalBookInput(input);
  }

  async discardLocalBookInput(input: LocalBookInput): Promise<void> {
    return this.host.discardLocalBookInput(input);
  }

  async rollbackLocalBookAsset(commit: LocalBookAssetCommit): Promise<void> {
    return this.host.rollbackLocalBookAsset(commit);
  }

  async releaseLocalBookAsset(bookId: string): Promise<void> {
    return this.host.releaseLocalBookAsset(bookId);
  }

  async close(): Promise<void> {
    if (this.closeTask !== undefined) {
      return this.closeTask;
    }
    if (this.state === 'closed') {
      return;
    }
    this.state = 'closing';
    this.closeTask = this.closeRuntime();
    return this.closeTask;
  }

  private assertReadingImageCurrent(shouldCancel?: () => boolean): void {
    if (shouldCancel !== undefined && !shouldCancel()) {
      throw new Error('reading body image request was cancelled');
    }
    if (this.state === 'closing' || this.state === 'closed') {
      throw new Error('Reader Host is no longer available after teardown');
    }
  }

  private admitReadingImage(
    payload: ReadingBodyImagePayload,
    shouldCancel?: () => boolean,
  ): ReadingBodyImagePayload {
    try {
      this.assertReadingImageCurrent(shouldCancel);
      return payload;
    } catch (error) {
      ReadingBodyImageHost.instance.release(payload.pixelMap);
      throw error;
    }
  }

  private async closeRuntime(): Promise<void> {
    try {
      if (this.startup !== undefined) {
        try {
          await this.startup;
        } catch (_) {
          // Startup has already closed its candidate runtime on failure.
        }
      }
      // A foreground/background flush that began before `closing` must finish
      // before the runtime is released. Later flush calls see `closing` and
      // become no-ops, so they cannot race this final flush/close pair.
      await this.flushTail;
      // Host callbacks must be invalidated before Core is released, otherwise
      // a late platform completion could attempt to advance a closed queue.
      await this.ttsHost.close();
      const runtime = this.runtime;
      this.runtime = undefined;
      if (runtime !== undefined) {
        try {
          await runtime.request('runtime.storage.flush', {}, { timeoutMs: 30000 });
        } finally {
          runtime.close();
        }
      }
    } finally {
      // Runs even when flush throws, so a rebuilt UIAbility in the same
      // process gets a fresh runtime rather than a half-closed one.
      this.state = 'closed';
      ReaderRuntimeOwner.instance = undefined;
    }
  }

  private async startRuntime(): Promise<void> {
    const runtime = createReaderCoreRuntime({
      dataDirectory: `${this.host.getContext().filesDir}/reader-core`,
    });
    runtime.setCapabilityRouter(this.host.createCapabilityRouter());
    try {
      await runtime.request('runtime.setHostCapabilities', {
        capabilities: [
          'persistence.get',
          'persistence.put',
          'http.execute',
          'cookie.get',
          'cookie.set',
          'webview.evaluateJavaScript',
        ],
        platform: 'harmonyos',
      }, { timeoutMs: 5000 });
      if (await this.host.needsLegacySnapshotMigration()) {
        await runtime.request('runtime.storage.restore', {}, { timeoutMs: 30000 });
        await this.host.markLegacySnapshotMigrated();
      }
      // `close()` may have begun while Host capability setup/restore awaited.
      // Never publish a ready runtime after teardown has claimed this owner.
      if (this.state !== 'starting') {
        throw new Error('Reader Core runtime was closed during startup');
      }
      this.runtime = runtime;
      this.state = 'ready';
    } catch (error) {
      try {
        runtime.close();
      } catch (_) {
        // Preserve the setup/restore failure that the caller can act on.
      }
      if (this.state === 'starting') {
        this.state = 'new';
      }
      throw error;
    }
  }
}
