import { BookAcquisitionCoordinator } from './BookAcquisitionCoordinator';
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
  type PendingLocalImportFinalize,
  ReaderHostRegistry,
} from './ReaderHostRegistry';
import { errorMessageOf } from './ErrorMessage';
import { HarmonySystemTtsHost } from './HarmonySystemTtsHost';
import { HarmonyHttpTtsHost } from './HarmonyHttpTtsHost';
import { HarmonyTtsHostRouter } from './HarmonyTtsHostRouter';
import { HarmonyTtsMediaSession } from './HarmonyTtsMediaSession';
import { HarmonyTtsBackgroundSession } from './HarmonyTtsBackgroundSession';
import { LocalEpubResourceHost } from './LocalEpubResourceHost';
import { ReadingBodyImageHost, type ReadingBodyImagePayload } from './ReadingBodyImageHost';
import {
  ReadingImageDiskCache,
  type ReadingImageCacheIdentity,
  type ReadingImageChapterIdentity,
} from './ReadingImageDiskCache';
import { canonicalReadingImageBaseUrl } from '../common/ReadingImageIdentity';
import { ArkWebExecutor } from './ArkWebExecutor';
import type { SourceHttpDiagnosticRecord } from './HttpExecuteHost';
import {
  BundledSourceLedger,
  canonicalRulePayloadJson,
  decideBundledUpgrade,
  hasBuiltinMarker,
  isUserModifiedBuiltinCopy,
  sha256Hex,
} from './BundledBookSourceSupply';
import { image } from '@kit.ImageKit';
import { ReaderAppearanceStore } from '../features/reading/ReaderAppearanceStore';
import { ReaderAppearancePreferences } from './ReaderAppearancePreferences';

type RuntimeState = 'new' | 'starting' | 'ready' | 'closing' | 'closed';

// Local import and materialized chapter reads may perform file and parsing I/O.
// The SDK's generic 2s default is unsuitable; callers may still opt into a
// narrower explicit limit.
const DEFAULT_CORE_REQUEST_TIMEOUT_MS = 30000;
// Deferred local-import cleanup is best-effort during startup. A malformed or
// unavailable Core journal must not blank the application for several minutes.
const PENDING_LOCAL_IMPORT_FINALIZE_TIMEOUT_MS = 5000;
const LOG_DOMAIN = 0x5244;
const BUNDLED_BOOK_SOURCE_COLLECTION_RAW_FILE = 'reader-tested-book-source-collection.json';
// BEGIN bundled-source-integrity (managed by tools/refresh-source-supply-manifest.mjs)
const BUNDLED_RAW_FILE_SHA256 = '0efc24aa6e9c4fe393ee0aa53fc5f72adf1e6ec6d47844d25c268a2a6623c58f';
// END bundled-source-integrity

type CoreBuildIdentity = {
  schemaVersion: number;
  buildId: string;
  gitCommit: string;
  gitDirty: boolean;
  cargoLockSha256: string;
  protocolSha256: string;
  rustProfile: string;
};

type BundledSourceInstallSummary = {
  collectionRecords: number;
  uniqueSourceIds: number;
  processed: number;
  installedOrUpgraded: number;
  failed: number;
  interrupted: boolean;
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
  private appearanceStore: ReaderAppearanceStore | undefined = undefined;
  private startup: Promise<void> | undefined = undefined;
  /** Serializes background storage flushes with teardown. */
  private flushTail: Promise<void> = Promise.resolve();
  /** Lets concurrent Ability teardown callers await the same cleanup. */
  private closeTask: Promise<void> | undefined = undefined;
  /** Background source seeding never gates page availability. */
  private sourceSupplyTask: Promise<void> = Promise.resolve();
  private state: RuntimeState = 'new';
  private bookCoordinator: BookAcquisitionCoordinator | undefined = undefined;
  /** Number of live UIAbility instances sharing this process runtime. */
  private abilityLeases: number = 0;
  /** A successor never starts platform hosts before its predecessor is closed. */
  private readonly predecessorClose: Promise<void>;

  private constructor(context: common.UIAbilityContext, predecessorClose: Promise<void> = Promise.resolve()) {
    this.predecessorClose = predecessorClose;
    this.host = new ReaderHostRegistry(context);
    this.ttsHost = new HarmonyTtsHostRouter(
      new HarmonySystemTtsHost(),
      new HarmonyHttpTtsHost(this),
      new HarmonyTtsMediaSession(context),
      new HarmonyTtsBackgroundSession(context),
    );
    this.localEpubResourceHost = new LocalEpubResourceHost(context);
    this.readingImageDiskCache = new ReadingImageDiskCache(context);
    ReadingBodyImageHost.setDisplayCacheDir(context.cacheDir);
  }

  static install(context: common.UIAbilityContext): ReaderRuntimeOwner {
    const current = ReaderRuntimeOwner.instance;
    if (current === undefined || current.state === 'closing' || current.state === 'closed') {
      const predecessorClose = current?.closeTask ?? Promise.resolve();
      ReaderRuntimeOwner.instance = new ReaderRuntimeOwner(context, predecessorClose);
    }
    ReaderRuntimeOwner.instance.abilityLeases += 1;
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
    this.startup = this.startAfterPredecessor();
    try {
      await this.startup;
    } finally {
      this.startup = undefined;
    }
  }

  /** Release one UIAbility lease; only the final owner tears the runtime down. */
  async release(): Promise<void> {
    if (this.abilityLeases > 0) {
      this.abilityLeases -= 1;
    }
    if (this.abilityLeases > 0) {
      return;
    }
    await this.close();
  }

  bookAcquisitions(): BookAcquisitionCoordinator {
    if (this.bookCoordinator === undefined) {
      this.bookCoordinator = new BookAcquisitionCoordinator(
        (method: string, params: JsonObject, options: RequestOptions): Promise<ReaderCoreResultEvent> =>
          this.requestDirect(method, params, options),
      );
    }
    return this.bookCoordinator;
  }

  async request(method: string, params: JsonObject = {}, options: RequestOptions = {}): Promise<ReaderCoreResultEvent> {
    return this.bookAcquisitions().request(method, params, options);
  }

  private async requestDirect(method: string, params: JsonObject = {}, options: RequestOptions = {}): Promise<ReaderCoreResultEvent> {
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

  /** Return recorder-only evidence for the same completed Core command. */
  takeSourceHttpDiagnostics(requestId: number): SourceHttpDiagnosticRecord[] {
    return this.host.takeSourceHttpDiagnostics(requestId);
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
    if (sourceId === 'local' && (imageUrl.startsWith('reader-local-epub://') || imageUrl.startsWith('reader-local-mobi://'))) {
      const localImage = await this.localEpubResourceHost.load(imageUrl, isCurrent);
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
    // The display resource is already decoded and actionable. Persistent
    // cache maintenance must not keep first paint waiting for a second disk
    // write; explicit offline prefetch retains its strict awaited path below.
    void this.readingImageDiskCache.storeResource(identity, bytes)
      .catch((error: Error): void => {
        hilog.error(LOG_DOMAIN, 'Reader', 'Reader body image cache write failed: %{private}s', error.message);
      });
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
      try {
        const runtime = this.runtime;
        if (runtime !== undefined && this.state === 'ready') {
          await runtime.request('runtime.storage.flush', {}, { timeoutMs: 30000 });
        }
      } finally {
        if (this.appearanceStore !== undefined) await this.appearanceStore.flush();
      }
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

  getAppearanceStore(): ReaderAppearanceStore {
    if (this.appearanceStore === undefined) {
      this.appearanceStore = new ReaderAppearanceStore(new ReaderAppearancePreferences(this.host.getContext()));
    }
    return this.appearanceStore;
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

  /** Acquire a portable JSON document from an HTTP(S) URL through Host I/O. */
  async loadOnlineJsonDocument(onlineUrl: string): Promise<BookSourceJsonSelection> {
    if (this.state === 'closing' || this.state === 'closed') {
      throw new Error('Reader Host is no longer available after teardown');
    }
    return this.host.loadOnlineJsonDocument(onlineUrl);
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

  /**
   * Persist an opaque local-import cleanup token after the shelf commit. This
   * is deliberately a Host-only operation; callers never receive the queue
   * path or token contents back.
   */
  async enqueuePendingLocalImportFinalize(rollbackToken: JsonObject): Promise<void> {
    // Host app-private storage remains valid during teardown; allowing this
    // write while the Core runtime is closing closes the last crash window
    // between the visible shelf commit and the deferred cleanup enqueue.
    await this.host.enqueuePendingLocalImportFinalize(rollbackToken);
  }

  async close(): Promise<void> {
    this.bookCoordinator?.close();
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
      // `close()` sets state=closing first, so the supply loop stops after its
      // current local Core request. Wait for that request before closing Core.
      await this.sourceSupplyTask;
      // A foreground/background flush that began before `closing` must finish
      // before the runtime is released. Later flush calls see `closing` and
      // become no-ops, so they cannot race this final flush/close pair.
      await this.flushTail;
      try {
        if (this.appearanceStore !== undefined) await this.appearanceStore.flush();
      } catch (error) {
        hilog.warn(LOG_DOMAIN, 'Reader', '%{private}s', `Appearance teardown save failed: ${errorMessageOf(error)}`);
      }
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
      if (ReaderRuntimeOwner.instance === this) {
        ReaderRuntimeOwner.instance = undefined;
      }
    }
  }

  private async startAfterPredecessor(): Promise<void> {
    await this.predecessorClose;
    if (this.state !== 'starting') {
      throw new Error('Reader Core runtime was closed before successor startup');
    }
    await this.startRuntime();
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
      // Build identity and the Host migration marker are independent reads.
      // Settle them together before the optional restore barrier.
      const startupReads = await Promise.all([
        runtime.request('core.info', {}, { timeoutMs: 5000 }),
        this.host.needsLegacySnapshotMigration(),
      ]);
      const coreInfo = startupReads[0];
      const buildIdentity = this.requireCoreBuildIdentity(coreInfo.data['buildIdentity']);
      hilog.info(LOG_DOMAIN, 'Reader', 'Core build identity: %{public}s', JSON.stringify(buildIdentity));
      if (startupReads[1]) {
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
      // A shelf commit may have succeeded while the UI lost the finalize
      // reply. Drain the bounded Host queue before exposing this runtime so a
      // cold-start page never inherits an unconsumed Core journal.
      await this.recoverPendingLocalImportFinalizes(runtime);
      // `close()` may have begun while Host capability setup/restore awaited.
      // Never publish a ready runtime after teardown has claimed this owner.
      if (this.state !== 'starting') {
        throw new Error('Reader Core runtime was closed during startup');
      }
      this.runtime = runtime;
      this.state = 'ready';
      // A 1,951-record collection must not hold the first frame or turn a
      // single malformed/dead source into an application startup failure.
      this.sourceSupplyTask = this.installBundledBookSourceCollection(runtime)
        .then((summary: BundledSourceInstallSummary): void => {
          hilog.info(LOG_DOMAIN, 'Reader',
            'Bundled source collection completed: records=%{public}d unique=%{public}d ' +
            'processed=%{public}d imported=%{public}d failed=%{public}d interrupted=%{private}s',
            summary.collectionRecords, summary.uniqueSourceIds, summary.processed,
            summary.installedOrUpgraded, summary.failed, String(summary.interrupted));
        })
        .catch((error: Error): void => {
          hilog.error(LOG_DOMAIN, 'Reader',
            'Bundled source collection failed without blocking Reader: %{private}s',
            errorMessageOf(error));
        });
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

  /**
   * Every install ships the complete recorded source collection as a normal
   * app-importable JSON array. Seeding runs after Core becomes observable so a
   * large collection or one bad item can never blank the application. Matching
   * versions are read-only on later launches; upgrades preserve the user's
   * enabled/explore choices; user-modified copies are never force-overwritten;
   * identities removed from a later collection are retired, never deleted.
   */
  private async installBundledBookSourceCollection(
    runtime: ReaderCoreRuntime,
  ): Promise<BundledSourceInstallSummary> {
    const document = await this.host.readBundledRawFileText(BUNDLED_BOOK_SOURCE_COLLECTION_RAW_FILE);
    const fileDigest = await sha256Hex(document);
    if (fileDigest !== BUNDLED_RAW_FILE_SHA256) {
      throw new Error(`Bundled book-source collection failed integrity verification: ` +
        `expected ${BUNDLED_RAW_FILE_SHA256}, got ${fileDigest}`);
    }
    const bundledSources = this.requireBundledBookSourceCollection(document);
    // Per-source integrity: the embedded fingerprint must match the rules it
    // certifies. A mismatched source is rejected loudly, never silently skipped.
    const admittedBySourceId = new Map<string, JsonObject>();
    for (const bundled of bundledSources) {
      const digest = await sha256Hex(canonicalRulePayloadJson(bundled));
      if (digest !== bundled['ruleFingerprint']) {
        hilog.error(LOG_DOMAIN, 'Reader',
          'Bundled book source rejected, rule fingerprint mismatch: %{private}s',
          bundled['bookSourceName'] as string);
        continue;
      }
      // The portable collection retains every tested rule variant. Core uses
      // bookSourceUrl as its primary key, so the last (preferred) variant is
      // the one installed for duplicate identities.
      admittedBySourceId.set(bundled['bookSourceUrl'] as string, bundled);
    }
    const admitted = Array.from(admittedBySourceId.values());
    if (admitted.length === 0) {
      throw new Error('Bundled book-source collection admitted no sources');
    }
    const existingSources = await this.loadExistingBundledSources(runtime);
    const ledger = await BundledSourceLedger.load(this.host.getContext());
    let installedCount = 0;
    let failedCount = 0;
    let processedCount = 0;
    let interrupted = false;
    const managedCurrent: JsonObject[] = [];
    for (const bundled of admitted) {
      if (this.state === 'closing' || this.state === 'closed') {
        interrupted = true;
        break;
      }
      const sourceId = bundled['bookSourceUrl'] as string;
      const bundledVersion = bundled['builtinVersion'] as number;
      const bundledFingerprint = bundled['ruleFingerprint'] as string;
      try {
        const existing = existingSources.get(sourceId);
        if (existing === undefined) {
          await this.importBundledSource(runtime, sourceId, bundled);
          installedCount += 1;
          processedCount += 1;
          managedCurrent.push(bundled);
          continue;
        }
        if (!hasBuiltinMarker(existing)) {
          // The user imported their own copy over the same identity: preserve
          // it and ensure the withdrawal ledger never claims that user object.
          ledger.remove(sourceId);
          processedCount += 1;
          continue;
        }
        const storedActualFingerprint = await sha256Hex(canonicalRulePayloadJson(existing));
        const reBundled = existing['readerBuiltinWithdrawn'] === true ||
          existing['readerTestBuiltinWithdrawn'] === true;
        if (reBundled && isUserModifiedBuiltinCopy(existing, storedActualFingerprint)) {
          ledger.remove(sourceId);
          processedCount += 1;
          continue;
        }
        const decision = decideBundledUpgrade(
          bundledVersion, bundledFingerprint, existing, storedActualFingerprint);
        if (decision === 'userCopy') {
          ledger.remove(sourceId);
          processedCount += 1;
          continue;
        }
        if (decision === 'unchanged' && !reBundled) {
          processedCount += 1;
          managedCurrent.push(bundled);
          continue;
        }
        const importedSource: JsonObject = { ...bundled };
        delete importedSource['readerBuiltinWithdrawn'];
        delete importedSource['readerTestBuiltinWithdrawn'];
        const metadataCorrection = (bundled['provenance'] as JsonObject | undefined)?.['metadataCorrection'] as JsonObject | undefined;
        if (metadataCorrection?.['preserveExploreRules'] === true) {
          // This metadata-only revision does not own discovery rules. They are
          // outside the legacy fingerprint, so retain existing edits/deletions;
          // a future discovery upgrade requires a separate explicit migration.
          for (const field of ['exploreUrl', 'ruleExplore']) {
            if (Object.prototype.hasOwnProperty.call(existing, field)) importedSource[field] = existing[field];
            else delete importedSource[field];
          }
        }
        if (!reBundled) {
          if (typeof existing['enabled'] === 'boolean') {
            importedSource['enabled'] = existing['enabled'];
          }
          if (typeof existing['enabledExplore'] === 'boolean') {
            importedSource['enabledExplore'] = existing['enabledExplore'];
          }
        }
        await this.importBundledSource(runtime, sourceId, importedSource);
        installedCount += 1;
        processedCount += 1;
        managedCurrent.push(bundled);
      } catch (error) {
        failedCount += 1;
        processedCount += 1;
        hilog.error(LOG_DOMAIN, 'Reader',
          'Bundled source item failed and was isolated: %{private}s %{private}s',
          sourceId, errorMessageOf(error));
      }
    }
    if (interrupted) {
      return {
        collectionRecords: bundledSources.length,
        uniqueSourceIds: admitted.length,
        processed: processedCount,
        installedOrUpgraded: installedCount,
        failed: failedCount,
        interrupted: true,
      };
    }
    const bundledIds = new Set<string>(admitted.map(source => source['bookSourceUrl'] as string));
    for (const entry of ledger.all()) {
      if (bundledIds.has(entry.sourceId)) {
        continue;
      }
      const stored = existingSources.get(entry.sourceId);
      if (stored === undefined) {
        ledger.remove(entry.sourceId);
        continue;
      }
      if (stored['readerBuiltinWithdrawn'] === true || stored['readerTestBuiltinWithdrawn'] === true) {
        continue;
      }
      const storedActualFingerprint = await sha256Hex(canonicalRulePayloadJson(stored));
      const userModified = isUserModifiedBuiltinCopy(stored, storedActualFingerprint);
      const retired: JsonObject = { ...stored };
      retired['readerBuiltinWithdrawn'] = true;
      delete retired['readerTestBuiltinWithdrawn'];
      if (!userModified) {
        retired['enabled'] = false;
      }
      await this.importBundledSource(runtime, entry.sourceId, retired);
      hilog.warn(LOG_DOMAIN, 'Reader',
        'Bundled source withdrawn from collection, marked retired (enabled=%{private}s): %{private}s',
        String(retired['enabled']), entry.sourceId);
    }
    ledger.syncCurrentBundle(managedCurrent);
    await ledger.save(this.host.getContext());
    return {
      collectionRecords: bundledSources.length,
      uniqueSourceIds: admitted.length,
      processed: processedCount,
      installedOrUpgraded: installedCount,
      failed: failedCount,
      interrupted: false,
    };
  }

  private async importBundledSource(
    runtime: ReaderCoreRuntime,
    sourceId: string,
    bookSource: JsonObject,
  ): Promise<void> {
    const imported = await runtime.request('source.import', {
      sourceId,
      bookSource,
    }, { timeoutMs: 30000 });
    if (imported.data['imported'] !== true || imported.data['sourceId'] !== sourceId) {
      throw new Error(`source.import did not confirm bundled source ${sourceId}`);
    }
  }

  private async loadExistingBundledSources(
    runtime: ReaderCoreRuntime,
  ): Promise<Map<string, JsonObject>> {
    const exported = await runtime.request('source.export', {
      format: 'json',
    }, { timeoutMs: 30000 });
    const data = exported.data['data'];
    const count = exported.data['count'];
    if (typeof data !== 'string' || typeof count !== 'number' || !Number.isSafeInteger(count)) {
      throw new Error('source.export returned invalid bundled source data');
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(data) as unknown;
    } catch (error) {
      throw new Error(`source.export returned invalid JSON: ${(error as Error).message}`);
    }
    if (!Array.isArray(parsed) || parsed.length !== count) {
      throw new Error('source.export returned invalid source collection shape');
    }
    const sources = new Map<string, JsonObject>();
    for (const raw of parsed) {
      if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
        continue;
      }
      const source = raw as JsonObject;
      const sourceId = source['bookSourceUrl'];
      if (typeof sourceId === 'string' && sourceId.trim().length > 0) {
        sources.set(sourceId, source);
      }
    }
    return sources;
  }

  private requireBundledBookSourceCollection(document: string): JsonObject[] {
    let parsed: unknown;
    try {
      parsed = JSON.parse(document) as unknown;
    } catch (error) {
      throw new Error(`Bundled book-source collection JSON is invalid: ${(error as Error).message}`);
    }
    if (!Array.isArray(parsed) || parsed.length === 0) {
      throw new Error('Bundled book-source collection must contain at least one source');
    }
    const sources: JsonObject[] = [];
    const builtinIds = new Set<string>();
    for (let index = 0; index < parsed.length; index += 1) {
      const raw = parsed[index];
      if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
        throw new Error(`Bundled book source ${index + 1} must be an object`);
      }
      const source = raw as JsonObject;
      const sourceId = source['bookSourceUrl'];
      const name = source['bookSourceName'];
      const builtinVersion = source['builtinVersion'];
      const enabled = source['enabled'];
      const defaultEnabled = source['defaultEnabled'];
      const builtinId = source['builtinId'];
      if (typeof sourceId !== 'string' || !/^https?:\/\//.test(sourceId) ||
        typeof name !== 'string' || name.trim().length === 0 ||
        typeof enabled !== 'boolean' || typeof defaultEnabled !== 'boolean' ||
        enabled !== defaultEnabled ||
        typeof builtinVersion !== 'number' || !Number.isSafeInteger(builtinVersion) ||
        builtinVersion < 1 ||
        typeof builtinId !== 'string' || builtinId.trim().length === 0 ||
        typeof source['ruleFingerprint'] !== 'string' ||
        !/^[0-9a-f]{64}$/.test(source['ruleFingerprint'] as string) ||
        typeof source['verifiedAt'] !== 'string' ||
        Number.isNaN(Date.parse(source['verifiedAt'] as string)) ||
        typeof source['verificationSuiteVersion'] !== 'string' ||
        (source['verificationSuiteVersion'] as string).trim().length === 0 ||
        !Array.isArray(source['capabilities']) || (source['capabilities'] as unknown[]).length === 0 ||
        !(source['capabilities'] as unknown[]).includes('import') ||
        typeof source['provenance'] !== 'object' || source['provenance'] === null ||
        typeof (source['provenance'] as JsonObject)['origin'] !== 'string' ||
        typeof source['readerHistoricalTest'] !== 'object' || source['readerHistoricalTest'] === null ||
        builtinIds.has(builtinId)) {
        hilog.error(LOG_DOMAIN, 'Reader',
          'Bundled source record skipped, invalid collection contract at index %{public}d', index + 1);
        continue;
      }
      builtinIds.add(builtinId);
      sources.push(source);
    }
    if (sources.length === 0) {
      throw new Error('Bundled book-source collection contains no valid source records');
    }
    return sources;
  }

  private async recoverPendingLocalImportFinalizes(runtime: ReaderCoreRuntime): Promise<void> {
    let pending: PendingLocalImportFinalize[];
    try {
      pending = await this.host.readPendingLocalImportFinalizes();
    } catch (_) {
      // Keep a corrupt queue for forensic repair, but never make startup
      // fail or print its opaque token contents.
      hilog.error(LOG_DOMAIN, 'Reader', 'Pending local import finalize queue could not be loaded');
      return;
    }
    let finalized = 0;
    let deferred = 0;
    for (const entry of pending) {
      try {
        const result = await runtime.request(
          'import.finalize',
          { rollbackToken: entry.rollbackToken },
          { timeoutMs: PENDING_LOCAL_IMPORT_FINALIZE_TIMEOUT_MS },
        );
        const data = result.data;
        if (data['kind'] !== 'localBook' || typeof data['data'] !== 'object' || data['data'] === null ||
          (data['data'] as JsonObject)['finalized'] !== true) {
          deferred += 1;
          continue;
        }
      } catch (error) {
        // The original finalize may have committed Core's journal before its
        // reply was lost. A subsequent retry then returns the deterministic
        // "journal unavailable" validation error; that is an idempotent
        // success for this cleanup queue, not a reason to retry forever.
        if (this.isAlreadyFinalizedLocalImportError(error)) {
          try {
            await this.host.removePendingLocalImportFinalize(entry.transactionId);
            finalized += 1;
          } catch (_) {
            deferred += 1;
          }
          continue;
        }
        deferred += 1;
        continue;
      }
      try {
        await this.host.removePendingLocalImportFinalize(entry.transactionId);
        finalized += 1;
      } catch (_) {
        // Core accepted the cleanup, but retain the queue entry if the atomic
        // removal failed; a later idempotent retry can finish the file repair.
        deferred += 1;
      }
    }
    if (pending.length > 0) {
      hilog.info(LOG_DOMAIN, 'Reader',
        'Pending local import finalize recovery: queued=%{public}d finalized=%{public}d deferred=%{public}d',
        pending.length, finalized, deferred);
    }
  }

  private isAlreadyFinalizedLocalImportError(error: unknown): boolean {
    if (typeof error !== 'object' || error === null) {
      return false;
    }
    const event = (error as { event?: unknown })['event'];
    if (typeof event !== 'object' || event === null) {
      return false;
    }
    const structured = (event as { error?: unknown })['error'];
    if (typeof structured !== 'object' || structured === null) {
      return false;
    }
    const code = (structured as { code?: unknown })['code'];
    const message = (structured as { message?: unknown })['message'];
    return code === 'INVALID_PARAMS' && typeof message === 'string' &&
      message.includes('local book journal unavailable');
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
