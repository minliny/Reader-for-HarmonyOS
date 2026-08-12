import common from '@ohos.app.ability.common';
import { hilog } from '@kit.PerformanceAnalysisKit';
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
import { HarmonyHttpTtsHost } from './HarmonyHttpTtsHost';
import { HarmonyTtsHostRouter } from './HarmonyTtsHostRouter';
import { HarmonyTtsMediaSession } from './HarmonyTtsMediaSession';
import { LocalEpubResourceHost } from './LocalEpubResourceHost';
import { ReadingBodyImageHost, type ReadingBodyImagePayload } from './ReadingBodyImageHost';
import {
  ReadingImageDiskCache,
  type ReadingImageCacheIdentity,
  type ReadingImageChapterIdentity,
} from './ReadingImageDiskCache';
import { canonicalReadingImageBaseUrl } from '../common/ReadingImageIdentity';
import { ArkWebExecutor } from './ArkWebExecutor';
import { image } from '@kit.ImageKit';

type RuntimeState = 'new' | 'starting' | 'ready' | 'closing' | 'closed';

export type ReaderStartupFailureKind = 'storageIncompatible' | 'unavailable';

export type ReaderStartupFailure = {
  kind: ReaderStartupFailureKind;
};

// NAPI intentionally throws an ordinary Error rather than introducing a
// second SDK error hierarchy for runtime creation. Keep the Host dependency
// on its stable string code, not on the numeric C ABI status.
const NATIVE_STORAGE_INCOMPATIBLE_ERROR_CODE = 'RC_CREATE_STORAGE_INCOMPATIBLE';

// Local import and materialized chapter reads may perform file and parsing I/O.
// The SDK's generic 2s default is unsuitable; callers may still opt into a
// narrower explicit limit.
const DEFAULT_CORE_REQUEST_TIMEOUT_MS = 30000;
const LOG_DOMAIN = 0x5244;

type CoreBuildIdentity = {
  schemaVersion: number;
  buildId: string;
  gitCommit: string;
  gitDirty: boolean;
  cargoLockSha256: string;
  protocolSha256: string;
  rustProfile: string;
};

/**
 * Owns the one and only native Core runtime for the full application process.
 * Pages receive page state through gateways and never create or parse Core.
 */
export class ReaderRuntimeOwner {
  private static instance: ReaderRuntimeOwner | undefined = undefined;

  private readonly host: ReaderHostRegistry;
  private readonly ttsHost: HarmonyTtsHostRouter;
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
    this.ttsHost = new HarmonyTtsHostRouter(
      new HarmonySystemTtsHost(),
      new HarmonyHttpTtsHost(this),
      new HarmonyTtsMediaSession(context),
    );
    this.localEpubResourceHost = new LocalEpubResourceHost(context);
    this.readingImageDiskCache = new ReadingImageDiskCache(context);
    ReadingBodyImageHost.setDisplayCacheDir(context.cacheDir);
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

  /** Project a native create failure into the small startup UI vocabulary. */
  static classifyStartupFailure(error: unknown): ReaderStartupFailure {
    if (typeof error === 'object' && error !== null) {
      const code = (error as Record<string, unknown>)['code'];
      if (code === NATIVE_STORAGE_INCOMPATIBLE_ERROR_CODE) {
        return { kind: 'storageIncompatible' };
      }
    }
    return { kind: 'unavailable' };
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
  ): Promise<ReadingBodyImagePayload> {
    this.assertReadingImageCurrent(isCurrent);
    if (imageUrl.trim().toLowerCase().startsWith('data:image/')) {
      const embedded = await ReadingBodyImageHost.instance.loadDataUri(imageUrl, isCurrent);
      return this.admitReadingImage(embedded, isCurrent);
    }
    if (sourceId === 'local' && imageUrl.startsWith('reader-local-epub://')) {
      const localImage = await this.localEpubResourceHost.load(imageUrl);
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
    const cachedBytes = await this.readingImageDiskCache.loadResource(identity);
    if (cachedBytes !== undefined) {
      try {
        const cached = await ReadingBodyImageHost.instance.loadBytes(cachedBytes, isCurrent);
        return this.admitReadingImage(cached, isCurrent);
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
    const request = await this.resolveReadingImageRequest(sourceId, imageUrl, identity.baseUrl, isCurrent);
    const bytes = await ReadingBodyImageHost.instance.fetchRequestBytes(request, isCurrent);
    const payload = await ReadingBodyImageHost.instance.loadBytes(bytes, isCurrent);
    try {
      await this.readingImageDiskCache.storeResource(identity, bytes);
    } catch (error) {
      // An ordinary online read remains usable when persistent storage is
      // full. Explicit offline prefetch uses the strict method below and
      // surfaces the same write failure instead of publishing completion.
      console.error(`Reader body image cache write failed: ${(error as Error).message}`);
    }
    return this.admitReadingImage(payload, isCurrent);
  }

  /** Persist and decode-validate one image before an offline chapter completes. */
  async prefetchReadingImage(
    identity: ReadingImageCacheIdentity,
    isCurrent?: () => boolean,
  ): Promise<void> {
    this.assertReadingImageCurrent(isCurrent);
    const cachedBytes = await this.readingImageDiskCache.loadResource(identity);
    if (cachedBytes !== undefined) {
      try {
        await ReadingBodyImageHost.instance.validateBytes(cachedBytes, isCurrent);
        return;
      } catch (_) {
        await this.readingImageDiskCache.removeResource(identity);
      }
    }
    const request = await this.resolveReadingImageRequest(
      identity.sourceId,
      identity.imageUrl,
      identity.baseUrl,
      isCurrent,
    );
    const bytes = await ReadingBodyImageHost.instance.fetchRequestBytes(request, isCurrent);
    await ReadingBodyImageHost.instance.validateBytes(bytes, isCurrent);
    this.assertReadingImageCurrent(isCurrent);
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
    isCurrent?: () => boolean,
  ): Promise<JsonObject> {
    const params: JsonObject = { sourceId, imageUrl };
    const canonicalBaseUrl = canonicalReadingImageBaseUrl(baseUrl);
    if (canonicalBaseUrl !== undefined) {
      params['baseUrl'] = canonicalBaseUrl;
    }
    // The SDK's shouldCancel is the logical inverse of the isCurrent guard
    // that the rest of the image chain already agrees on; without the flip a
    // still-current selection cancels its own request on the first poll.
    const descriptor = await this.request('source.imageRequest', params, {
      shouldCancel: isCurrent === undefined ? undefined : (): boolean => !isCurrent(),
      timeoutMs: DEFAULT_CORE_REQUEST_TIMEOUT_MS,
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

  getTtsHost(): HarmonyTtsHostRouter {
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

  async saveBookSourceJson(text: string, suggestedFileName: string): Promise<string | undefined> {
    if (this.state === 'closing' || this.state === 'closed') {
      throw new Error('Reader Host is no longer available after teardown');
    }
    return this.host.saveBookSourceJson(text, suggestedFileName);
  }

  async selectRuleBundleJson(): Promise<BookSourceJsonSelection | undefined> {
    if (this.state === 'closing' || this.state === 'closed') {
      throw new Error('Reader Host is no longer available after teardown');
    }
    return this.host.selectRuleBundleJson();
  }

  async saveRuleBundleJson(text: string, suggestedFileName: string): Promise<string | undefined> {
    if (this.state === 'closing' || this.state === 'closed') {
      throw new Error('Reader Host is no longer available after teardown');
    }
    return this.host.saveRuleBundleJson(text, suggestedFileName);
  }

  async selectRssSourceJson(): Promise<BookSourceJsonSelection | undefined> {
    if (this.state === 'closing' || this.state === 'closed') {
      throw new Error('Reader Host is no longer available after teardown');
    }
    return this.host.selectRssSourceJson();
  }

  async saveRssSourceJson(text: string, suggestedFileName: string): Promise<string | undefined> {
    if (this.state === 'closing' || this.state === 'closed') {
      throw new Error('Reader Host is no longer available after teardown');
    }
    return this.host.saveRssSourceJson(text, suggestedFileName);
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

  private assertReadingImageCurrent(isCurrent?: () => boolean): void {
    if (isCurrent !== undefined && !isCurrent()) {
      throw new Error('reading body image request was cancelled');
    }
    if (this.state === 'closing' || this.state === 'closed') {
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
      ReadingBodyImageHost.instance.releaseAllDisplayFiles();
      // Runs even when flush throws, so a rebuilt UIAbility in the same
      // process gets a fresh runtime rather than a half-closed one.
      this.state = 'closed';
      ReaderRuntimeOwner.instance = undefined;
    }
  }

  private async startRuntime(): Promise<void> {
    let runtime: ReaderCoreRuntime | undefined = undefined;
    try {
      // Runtime creation can fail synchronously (for example when a newer
      // storage schema is present). It belongs inside the same recovery
      // boundary as async setup so every startup failure returns this owner to
      // `new` and a user-requested retry can create a fresh candidate.
      runtime = createReaderCoreRuntime({
        dataDirectory: `${this.host.getContext().filesDir}/reader-core`,
      });
      runtime.setCapabilityRouter(this.host.createCapabilityRouter());
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
      const coreInfo = await runtime.request('core.info', {}, { timeoutMs: 5000 });
      const buildIdentity = this.requireCoreBuildIdentity(coreInfo.data['buildIdentity']);
      hilog.info(LOG_DOMAIN, 'Reader', 'Core build identity: %{public}s', JSON.stringify(buildIdentity));
      if (await this.host.needsLegacySnapshotMigration()) {
        await runtime.request('runtime.storage.restore', {}, { timeoutMs: 30000 });
        await this.host.markLegacySnapshotMigrated();
      }
      // A source switch is not admitted to the restored route until its first
      // canonical target progress atomically finalizes the Core transaction.
      // Recover before publishing this runtime so a cold-start page can never
      // observe the tentative shelf identity or retain a UI-owned journal.
      const recovery = await runtime.request('source.switch.recover', {}, { timeoutMs: 30000 });
      const recoveredCount = this.requireSourceSwitchRecoveryCount(recovery.data['recovered']);
      hilog.info(LOG_DOMAIN, 'Reader', 'Core source-switch startup recovery count: %{public}d', recoveredCount);
      // `close()` may have begun while Host capability setup/restore awaited.
      // Never publish a ready runtime after teardown has claimed this owner.
      if (this.state !== 'starting') {
        throw new Error('Reader Core runtime was closed during startup');
      }
      this.runtime = runtime;
      this.state = 'ready';
    } catch (error) {
      if (runtime !== undefined) {
        try {
          runtime.close();
        } catch (_) {
          // Preserve the setup/restore failure that the caller can act on.
        }
      }
      if (this.state === 'starting') {
        this.state = 'new';
      }
      throw error;
    }
  }

  private requireCoreBuildIdentity(value: unknown): CoreBuildIdentity {
    if (typeof value !== 'object' || value === null) {
      throw new Error('core.info did not return buildIdentity');
    }
    const identity = value as Record<string, unknown>;
    const gitCommit = identity['gitCommit'];
    if (identity['schemaVersion'] !== 1 ||
      !this.isLowerHex(identity['buildId'], 64, 64) ||
      !(gitCommit === 'unknown' || this.isLowerHex(gitCommit, 40, 64)) ||
      typeof identity['gitDirty'] !== 'boolean' ||
      !this.isLowerHex(identity['cargoLockSha256'], 64, 64) ||
      !this.isLowerHex(identity['protocolSha256'], 64, 64) ||
      typeof identity['rustProfile'] !== 'string' || identity['rustProfile'].trim().length === 0) {
      throw new Error('core.info returned an invalid buildIdentity');
    }
    return {
      schemaVersion: 1,
      buildId: identity['buildId'],
      gitCommit: gitCommit,
      gitDirty: identity['gitDirty'],
      cargoLockSha256: identity['cargoLockSha256'],
      protocolSha256: identity['protocolSha256'],
      rustProfile: identity['rustProfile'],
    };
  }

  private requireSourceSwitchRecoveryCount(value: unknown): number {
    if (!Array.isArray(value)) {
      throw new Error('source.switch.recover returned invalid recovered data');
    }
    for (const raw of value) {
      if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
        throw new Error('source.switch.recover returned a non-object transaction');
      }
      const transaction = raw as Record<string, unknown>;
      if (typeof transaction['transactionId'] !== 'string' ||
        transaction['transactionId'].trim().length === 0 ||
        transaction['phase'] !== 'rolledBack' || typeof transaction['changed'] !== 'boolean') {
        throw new Error('source.switch.recover returned an invalid transaction result');
      }
    }
    return value.length;
  }

  private isLowerHex(value: unknown, minLength: number, maxLength: number): value is string {
    return typeof value === 'string' && value.length >= minLength && value.length <= maxLength &&
      /^[0-9a-f]+$/.test(value);
  }
}
