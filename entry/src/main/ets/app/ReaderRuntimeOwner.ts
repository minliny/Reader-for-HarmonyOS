import { ReaderRuntimeImageResources, type MangaImagePriority } from './ReaderRuntimeImageResources';
import { ReaderBundledBookSourceInstaller, type BundledSourceInstallSummary } from './ReaderBundledBookSourceInstaller';
import { requireStorageProbeIdentity, requireCoreBuildIdentity, requireCoreStorageFormat,
  requireSourceSwitchRecoveryCount, type CoreBuildIdentity } from './ReaderCoreStartupAdmission';
import { BookAcquisitionCoordinator } from '../features/reading/application/BookAcquisitionCoordinator';
import { readerRuleMutationEffects } from './ReaderRuleMutationEffects';
import { readerHostFilesDirectory, type ReaderPublicFixtureScope } from './diagnostics/ReaderPublicFixtureScope';
import { ReaderPublicFixtureBridge } from './ReaderPublicFixtureBridge';
import { ReaderMangaProbeRegistry } from './ReaderMangaProbeRegistry';
import { BookRequestNotDispatchedError as ReaderCoreNotDispatchedError, type BookRequestOptions } from './BookRequestScheduler';
export { BookRequestNotDispatchedError as ReaderCoreNotDispatchedError } from './BookRequestScheduler';
import common from '@ohos.app.ability.common';
import { hilog } from '@kit.PerformanceAnalysisKit';
import {
  createReaderCoreRuntimeAsync,
  probeReaderCoreStorageAsync,
  readLibraryBackupIdentityAsync,
  type JsonObject,
  type ReaderCoreResultEvent,
  type ReaderCoreRuntime,
  type ReaderCoreStorageProbe,
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
import { errorMessageOf, httpResponseFailureSummary, coreAdmissionFailureSummary } from './ErrorMessage';
import { HarmonySystemTtsHost } from '../platform/tts/HarmonySystemTtsHost';
import { HarmonyHttpTtsHost } from '../platform/tts/HarmonyHttpTtsHost';
import { HarmonyTtsHostRouter } from '../platform/tts/HarmonyTtsHostRouter';
import { HarmonyTtsMediaSession } from '../platform/tts/HarmonyTtsMediaSession';
import { HarmonyTtsBackgroundSession } from '../platform/tts/HarmonyTtsBackgroundSession';
import { ReadingBodyImageHost, type ReadingBodyImagePayload, type MangaImageMetadataProof } from '../platform/reading-resources/ReadingBodyImageHost';
import { MangaImageMetadataHost } from '../platform/reading-resources/MangaImageMetadataHost';
import {
  type ReadingImageCacheIdentity,
  type ReadingImageChapterIdentity,
} from '../platform/reading-resources/ReadingImageDiskCache';
import { ArkWebExecutor, type ArkWebLoginClearOutcome } from '../platform/network/ArkWebExecutor';
import { sourceLoginPageUrl } from './SourceLoginPageProjection';
import type { SourceHttpDiagnosticRecord } from '../platform/network/HttpExecuteHost';
import { image } from '@kit.ImageKit';
import { ReaderAppearanceStore } from '../features/reading/application/ReaderAppearanceStore';
import { ReaderAppearancePreferences } from './ReaderAppearancePreferences';
import { ReadingEntryPreparation } from '../features/reading/application/ReadingEntryPreparation';
import { releaseReadingEntryMemory } from '../features/reading/application/ReadingEntryHandoff';
import { ReaderPreparationNetworkHost } from './ReaderPreparationNetworkHost';
import { ReaderStartupTrace } from './ReaderStartupTrace';
import type { MangaOfflineProbeScope, MangaProbeSelectionMode } from './MangaOfflineNetworkProbe';
import { MangaChapterPreparationCoordinator } from '../features/manga/application/MangaChapterPreparationCoordinator';
import type { MangaDisplaySessionScope } from '../features/reading/application/ReadingGatewayRuntime';
import { SharedDownloadCoordinator } from '../features/downloads/application/SharedDownloadCoordinator';
import type { ReaderWriteEvidence } from './ReaderWriteEvidence';
import { SharedDownloadStorageGateway, type SettingsTextCleanupJournal, type SharedDownloadCleanupResult,
  type SharedDownloadStoragePolicyResult } from '../features/downloads/application/SharedDownloadStorageGateway';
import type { ReadingTextStorageChapter } from '../platform/reading-resources/ReadingImageDiskCache';
import type { DownloadStorageSummary } from '../features/downloads/presentation/SharedDownloadProjection';
import { ReadingRecordGateway } from '../features/reading/application/ReadingRecordGateway';
import { ReadingProgressJournal } from '../features/reading/application/ReadingProgressJournal';
import { ReadingProgressIntentFile } from '../features/reading/application/ReadingProgressIntentFile';
import { recoverReadingProgress } from '../features/reading/application/ReadingSessionFlowGateway';

type RuntimeState = 'new' | 'starting' | 'ready' | 'closing' | 'closed';

// The SDK's generic 2s default is unsuitable; callers may still opt into a
// narrower explicit limit.
const DEFAULT_CORE_REQUEST_TIMEOUT_MS = 30000;
// Deferred local-import cleanup is best-effort during startup. A malformed or
// unavailable Core journal must not blank the application for several minutes.
const PENDING_LOCAL_IMPORT_FINALIZE_TIMEOUT_MS = 5000;
const LOG_DOMAIN = 0x5244;
// BEGIN bundled-source-integrity (managed by tools/refresh-source-supply-manifest.mjs)
const BUNDLED_RAW_FILE_SHA256 = '405661f1a7308c95e922eddea876ec10888563fde36d7e814064f585bb2142b9';
// END bundled-source-integrity

export type ReaderLegacySnapshotRecovery = 'none' | 'unsupportedStorageFormat' | 'storageCapabilityUnavailable' | 'automaticImportDeferred';

/**
 * Owns the one and only native Core runtime for the full application process.
 * Pages receive page state through gateways and never create or parse Core.
 */
export class ReaderRuntimeOwner {
  private static instance: ReaderRuntimeOwner | undefined = undefined;

  private readonly host: ReaderHostRegistry;
  private readonly ttsHost: HarmonyTtsHostRouter;
  private readonly images: ReaderRuntimeImageResources;
  private readonly mangaProbes: ReaderMangaProbeRegistry;
  private runtime: ReaderCoreRuntime | undefined = undefined;
  private searchPageEvidenceCount: number = 0;
  private switchPageEvidenceCount: number = 0;
  private appearanceStore: ReaderAppearanceStore | undefined = undefined;
  private startup: Promise<void> | undefined = undefined;
  /** Serializes background storage flushes with teardown. */
  private flushTail: Promise<void> = Promise.resolve();
  private closeTask: Promise<void> | undefined = undefined;
  /** Background source seeding never gates page availability. */
  private sourceSupplyTask: Promise<void> = Promise.resolve();
  private importFinalizeTask: Promise<void> = Promise.resolve();
  private state: RuntimeState = 'new';
  private reservationQuarantineDiagnosticLogged: boolean = false;
  private coreCapabilities: Set<string> = new Set<string>();
  private legacySnapshotRecovery: ReaderLegacySnapshotRecovery = 'none';
  private downloadCoordinator: SharedDownloadCoordinator | undefined;
  private downloadStorageGateway: SharedDownloadStorageGateway | undefined;
  private downloadReadingProtection: { sourceId: string; bookId: string; chapterIndex?: number; } | undefined;
  private downloadProtectionRevision: number = 0;
  private readingRecordGateway: ReadingRecordGateway | undefined;
  private readingProgressJournal: ReadingProgressJournal | undefined;

  /** One application-owned duration outbox, independent of reading routes. */
  getReadingRecordGateway(): ReadingRecordGateway {
    if (this.readingRecordGateway === undefined) this.readingRecordGateway = new ReadingRecordGateway(this);
    return this.readingRecordGateway;
  }

  getReadingProgressJournal(): ReadingProgressJournal {
    if (this.readingProgressJournal === undefined) this.readingProgressJournal = new ReadingProgressJournal(
      new ReadingProgressIntentFile(readerHostFilesDirectory(this.getUIAbilityContext().filesDir),
        (): boolean => ReaderRuntimeOwner.isCurrent(this)));
    return this.readingProgressJournal;
  }

  notifyBackgroundReadingProgressConfirmed(sourceId: string, bookId: string): void {
    if (this.state !== 'ready' || !ReaderRuntimeOwner.isCurrent(this)) return;
    this.bookCoordinator?.backgroundReadingProgressConfirmed(sourceId, bookId);
  }

  private recoverReadingProgressInBackground(): void {
    void recoverReadingProgress(this).catch((error: Error): void => {
      hilog.warn(LOG_DOMAIN, 'Reader', 'Reading progress recovery: %{private}s', error.message);
    });
  }

  supportsCoreCapability(capability: string): boolean { return this.coreCapabilities.has(capability); }

  /** Deferred migration is not a failed current SQLite store or a completed import. */
  legacySnapshotMigrationRecovery(): ReaderLegacySnapshotRecovery { return this.legacySnapshotRecovery; }
  private bookCoordinator: BookAcquisitionCoordinator | undefined = undefined;
  private entryPreparations: ReadingEntryPreparation | undefined = undefined;
  private preparationNetwork: ReaderPreparationNetworkHost | undefined;
  private deepReadingPrefetchObservers?: Set<() => void>;
  private preparationWakeTimer: number = -1;
  private preparationForeground: boolean = false;
  private preparationCatalogAllowed: boolean = false;
  private preparationIntentEpoch: number = 0;
  /** Number of live UIAbility instances sharing this process runtime. */
  private abilityLeases: number = 0;
  /** A successor never starts platform hosts before its predecessor is closed. */
  private readonly predecessorClose: Promise<void>;
  /** Fixed at process-owner construction; never a persisted user setting. */
  private readonly optionalEntryMemoryEnabled: boolean;
  private readonly fixtures: ReaderPublicFixtureBridge;

  private constructor(context: common.UIAbilityContext, predecessorClose: Promise<void> = Promise.resolve(),
    disableOptionalEntryMemory: boolean = false, mangaOfflineScope?: MangaOfflineProbeScope,
    mangaReadingScope?: MangaOfflineProbeScope, mangaSelectionMode?: MangaProbeSelectionMode,
    publicFixture?: ReaderPublicFixtureScope) {
    this.predecessorClose = predecessorClose;
    this.optionalEntryMemoryEnabled = !disableOptionalEntryMemory;
    this.fixtures = new ReaderPublicFixtureBridge(publicFixture,
      (): boolean => this.state === 'ready' && ReaderRuntimeOwner.isCurrent(this));
    this.mangaProbes = new ReaderMangaProbeRegistry((): ReadingBodyImageHost => ReadingBodyImageHost.instance,
      (label: string, state: string): void => hilog.info(LOG_DOMAIN, 'Reader', label, state),
      mangaOfflineScope, mangaReadingScope, mangaSelectionMode);
    this.host = new ReaderHostRegistry(context, this.mangaProbes.network, publicFixture,
      (): boolean => this.fixtures.searchHttpReady());
    this.ttsHost = new HarmonyTtsHostRouter(
      new HarmonySystemTtsHost(),
      new HarmonyHttpTtsHost(this),
      new HarmonyTtsMediaSession(context),
      new HarmonyTtsBackgroundSession(context),
      (): boolean => AppStorage.get<boolean>('readerAppForeground') !== false,
    );
    this.images = new ReaderRuntimeImageResources(context, {
      request: (method: string, params?: JsonObject, options?: BookRequestOptions): Promise<ReaderCoreResultEvent> =>
        this.request(method, params, options),
      requestTimeoutMs: DEFAULT_CORE_REQUEST_TIMEOUT_MS,
      captureMangaContentValidity: (sourceId: string, bookId: string): (() => boolean) =>
        this.captureMangaImageContentValidity(sourceId, bookId),
      downloadStorage: (): SharedDownloadStorageGateway | undefined => this.downloadStorageGateway,
      retired: (): boolean => this.state === 'closing' || this.state === 'closed',
    }, this.mangaProbes);
    this.mangaProbes.bindReadingBody();
  }

  static install(context: common.UIAbilityContext, disableOptionalEntryMemory: boolean = false,
    mangaOfflineScope?: MangaOfflineProbeScope, mangaReadingScope?: MangaOfflineProbeScope,
    mangaSelectionMode?: MangaProbeSelectionMode, publicFixture?: ReaderPublicFixtureScope): ReaderRuntimeOwner {
    const current = ReaderRuntimeOwner.instance;
    if (current === undefined || current.state === 'closing' || current.state === 'closed') {
      const predecessorClose = current?.closeTask ?? Promise.resolve();
      ReaderRuntimeOwner.instance = new ReaderRuntimeOwner(context, predecessorClose, disableOptionalEntryMemory,
        mangaOfflineScope, mangaReadingScope, mangaSelectionMode, publicFixture);
      if (disableOptionalEntryMemory) ReaderRuntimeOwner.instance.releaseOptionalReadingEntryMemory();
    } else current.mangaProbes.network?.release('ability-reinstalled');
    ReaderRuntimeOwner.instance.abilityLeases += 1;
    return ReaderRuntimeOwner.instance;
  }

  /** Identity-only admission for late callbacks. Teardown means false; callers
   * that require an installed owner still use the throwing current() getter. */
  static isCurrent(owner: ReaderRuntimeOwner): boolean {
    return ReaderRuntimeOwner.instance === owner;
  }

  isCurrentPublicFixture(fixture: ReaderPublicFixtureScope): boolean {
    return this.fixtures.isCurrent(fixture);
  }

  confirmPublicSearchHttpFixture(fixture: ReaderPublicFixtureScope): void {
    this.fixtures.confirmSearchHttp(fixture);
  }

  selectMangaOfflineProbe(sourceId: string, bookId: string, manga: boolean): void {
    this.mangaProbes.network?.select(sourceId, bookId, manga);
  }
  mangaOfflineProbeFor(sourceId: string, bookId: string): boolean { return this.mangaProbes.network?.matches(sourceId, bookId) === true; }
  mangaOfflineProbeProtectsAutomaticCatalog(sourceId: string, bookId: string): boolean {
    return this.mangaProbes.network?.protectsAutomaticCatalog(sourceId, bookId) === true;
  }
  subscribeMangaOfflineProbe(listener: (state: string) => void): () => void {
    return this.mangaProbes.network?.subscribe(listener) ?? ((): void => {});
  }
  finishMangaOfflineProbe(sourceId: string, bookId: string): void { this.mangaProbes.network?.finish(sourceId, bookId); }
  releaseMangaOfflineProbe(): void { this.mangaProbes.network?.release('ability-background'); }

  static current(): ReaderRuntimeOwner {
    if (ReaderRuntimeOwner.instance === undefined) {
      throw new Error('ReaderRuntimeOwner must be installed by EntryAbility');
    }
    return ReaderRuntimeOwner.instance;
  }

  /** Theme preferences share platform storage with the previous Ability.
   * Loading a successor snapshot is subject to the same close boundary as
   * native startup; a rejected close never silently admits new writes. */
  async waitForPredecessorClose(): Promise<void> {
    await this.predecessorClose;
    if (this.state === 'closing' || this.state === 'closed') {
      throw new Error('Reader Host was closed before successor admission');
    }
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
        (method: string, params: JsonObject, options: BookRequestOptions): Promise<ReaderCoreResultEvent> =>
          this.requestDirect(method, params, options),
        (capability: string): boolean => this.supportsCoreCapability(capability),
        this,
      );
    }
    return this.bookCoordinator;
  }

  getDownloadCoordinator(): SharedDownloadCoordinator {
    if (this.downloadCoordinator === undefined) this.downloadCoordinator = new SharedDownloadCoordinator(this,
      (): boolean => ReaderRuntimeOwner.isCurrent(this) && this.state === 'ready');
    return this.downloadCoordinator;
  }

  getDownloadStorageGateway(): SharedDownloadStorageGateway {
    if (this.downloadStorageGateway === undefined)
      this.downloadStorageGateway = new SharedDownloadStorageGateway(this, this.images.storage);
    return this.downloadStorageGateway;
  }

  waitForDownloadStorageIdle(): Promise<void> {
    return this.downloadStorageGateway?.waitForActiveMutation() ?? Promise.resolve();
  }

  releaseLegacyDownloadProtection(sourceId: string, bookId: string, chapterIndexes?: number[]): Promise<void> {
    return this.getDownloadStorageGateway().confirmExplicitDeletion(sourceId, bookId, chapterIndexes);
  }

  setDownloadReadingProtection(sourceId?: string, bookId?: string, chapterIndex?: number): void {
    if (this.state !== 'ready' || !ReaderRuntimeOwner.isCurrent(this)) return;
    if (chapterIndex !== undefined && (!Number.isSafeInteger(chapterIndex) || chapterIndex < 0))
      throw new Error('DOWNLOAD_READING_PROTECTION_INVALID');
    const previous = this.downloadReadingProtection;
    if (previous?.sourceId === sourceId && previous?.bookId === bookId && previous?.chapterIndex === chapterIndex) return;
    this.downloadReadingProtection = sourceId === undefined || bookId === undefined ? undefined : { sourceId, bookId, chapterIndex };
    this.downloadProtectionRevision += 1;
  }

  captureDownloadStorageValidity(): () => boolean {
    const revision = this.downloadProtectionRevision;
    const coordinator = this.getDownloadCoordinator();
    const signature = (): string => coordinator.ownershipSignature();
    const before = signature();
    return (): boolean => this.state === 'ready' && ReaderRuntimeOwner.isCurrent(this) &&
      revision === this.downloadProtectionRevision && before === signature();
  }

  protectsDownloadStorageChapter(chapter: ReadingTextStorageChapter): boolean {
    const reading = this.downloadReadingProtection;
    return reading !== undefined && reading.sourceId === chapter.sourceId && reading.bookId === chapter.bookId &&
      (reading.chapterIndex === undefined || reading.chapterIndex === chapter.chapterIndex);
  }

  async readDownloadStorageBindings(): Promise<{ retainedChapters: ReadingTextStorageChapter[]; protectedChapters: ReadingTextStorageChapter[]; }> {
    const coordinator = this.getDownloadCoordinator();
    await coordinator.restore();
    const retainedChapters: ReadingTextStorageChapter[] = [], protectedChapters: ReadingTextStorageChapter[] = [];
    for (const job of coordinator.jobs()) {
      if (job.book.contentKind !== 'manga') {
        for (const chapterIndex of job.retainedIndexes) retainedChapters.push({ sourceId: job.sourceId, bookId: job.bookId, chapterIndex });
        for (const chapter of job.preservedRetentions) retainedChapters.push({ sourceId: job.sourceId, bookId: job.bookId, chapterIndex: chapter.chapterIndex });
      }
      if (job.status === 'queued' || job.status === 'downloading') for (const chapterIndex of job.requestedIndexes)
        protectedChapters.push({ sourceId: job.sourceId, bookId: job.bookId, chapterIndex });
    }
    const reading = this.downloadReadingProtection;
    if (reading !== undefined) {
      if (reading.chapterIndex !== undefined) protectedChapters.push({ ...reading, chapterIndex: reading.chapterIndex });
      else {
        const data = (await this.request('cache.book.status', { sourceId: reading.sourceId, bookId: reading.bookId,
          includeGlobalStats: false, includeChapterStates: true })).data;
        if (data['sourceId'] !== reading.sourceId || data['bookId'] !== reading.bookId || !Array.isArray(data['chapters']))
          throw new Error('DOWNLOAD_READING_PROTECTION_UNAVAILABLE');
        for (const raw of data['chapters']) {
          const index = (raw as JsonObject)['chapterIndex'];
          if (typeof index !== 'number' || !Number.isSafeInteger(index) || index < 0)
            throw new Error('DOWNLOAD_READING_PROTECTION_UNAVAILABLE');
          protectedChapters.push({ sourceId: reading.sourceId, bookId: reading.bookId, chapterIndex: index });
        }
      }
    }
    return { retainedChapters, protectedChapters };
  }

  /** Bounded operational facts only. Never accepts source/query/body values
   * or owns pagination; consumers publish after their normal receipt checks. */
  observeSourceSearchPage(route: 'search' | 'switch', requestedPage: number,
    decodedCount: number, matchedCount: number): void {
    if (this.state !== 'ready' || (route !== 'search' && route !== 'switch') ||
      !Number.isSafeInteger(requestedPage) || requestedPage < 2 || requestedPage > 0xffffffff ||
      !Number.isSafeInteger(decodedCount) || decodedCount < 1 || decodedCount > 65536 ||
      !Number.isSafeInteger(matchedCount) || matchedCount < 1 || matchedCount > decodedCount) return;
    if (route === 'search') {
      if (this.searchPageEvidenceCount >= 8) return;
      this.searchPageEvidenceCount += 1;
    } else {
      if (this.switchPageEvidenceCount >= 8) return;
      this.switchPageEvidenceCount += 1;
    }
    try {
      hilog.info(LOG_DOMAIN, 'ReaderSourcePageEvidence',
        'route=%{public}s requestedPage=%{public}d decoded=%{public}d matched=%{public}d',
        route, requestedPage, decodedCount, matchedCount);
    } catch (_) { /* A diagnostic failure cannot change a business receipt. */ }
  }

  async request(method: string, params: JsonObject = {}, options: BookRequestOptions = {}): Promise<ReaderCoreResultEvent> {
    if (this.state === 'closing' && this.runtime !== undefined &&
      (method === 'manga.cache.materialization.abort' || method === 'manga.session.release')) return this.runtime.request(method, params, options);
    return this.bookAcquisitions().request(method, params, options);
  }

  async requestBook(method: string, params: JsonObject = {}, options: RequestOptions = {},
    priority: 'foreground' | 'background' = 'foreground'): Promise<ReaderCoreResultEvent> {
    if (this.state === 'closing' && this.runtime !== undefined &&
      (method === 'manga.cache.materialization.abort' || method === 'manga.session.release')) return this.runtime.request(method, params, options);
    return this.bookAcquisitions().request(method, params, options, priority);
  }

  allowOptionalMangaPreparation(): boolean {
    return this.state === 'ready' && this.preparationForeground && this.preparationNetwork?.allowed() === true;
  }

  /** Deep text preparation may observe the same network lifecycle without
   * importing or owning the network host. The returned disposer is idempotent
   * and keeps the callback out of the runtime after its route retires. */
  observeDeepReadingPrefetchNetwork(advance: () => void): () => void {
    if (this.state === 'closing' || this.state === 'closed') return (): void => {};
    const observers = this.deepReadingPrefetchObservers ??= new Set<() => void>();
    observers.add(advance);
    return (): void => { observers.delete(advance); };
  }

  deepReadingPrefetchNetworkAllowed(): boolean {
    return this.state === 'ready' && this.preparationForeground && this.preparationNetwork?.deepAllowed() === true;
  }

  canDeepReadingPrefetchWrite(current: () => boolean): Promise<boolean> {
    return this.getDownloadStorageGateway().canPrefetchTextChapter(
      (): boolean => current() && this.deepReadingPrefetchNetworkAllowed(),
    );
  }

  readPreparedEntry(params: JsonObject): JsonObject {
    const trace = ReaderStartupTrace.current();
    const entryId = trace?.currentEntryId() ?? 0;
    const traceStartedAt = trace?.begin('reader.prepared-storage', entryId) ?? -1;
    const runtime = this.runtime;
    if (this.state !== 'ready' || runtime === undefined ||
      !this.supportsCoreCapability('reading.entry.firstFrame.v1')) {
      trace?.end('reader.prepared-storage', traceStartedAt, 'unavailable.runtimeClosed', entryId);
      return { kind: 'unavailable', sourceId: params['sourceId'], bookId: params['bookId'], reason: 'runtimeClosed' };
    }
    // This facade must not start the runtime, join the request queue, wait on
    // an acquisition, or opportunistically populate optional entry memory.
    const started = Date.now();
    let result: JsonObject;
    try {
      result = runtime.readPreparedEntry(params);
    } catch (error) {
      trace?.end('reader.prepared-storage', traceStartedAt, 'failed', entryId);
      throw error;
    }
    trace?.end('reader.prepared-storage', traceStartedAt,
      `${String(result['kind'] ?? '')}.${String(result['reason'] ?? '')}`, entryId);
    hilog.info(LOG_DOMAIN, 'Reader', 'PERF reader-entry prepared-storage kind=%{public}s reason=%{public}s elapsedMs=%{public}d',
      String(result['kind'] ?? ''), String(result['reason'] ?? ''), Math.max(0, Date.now() - started));
    return result;
  }

  readingEntryPreparations(): ReadingEntryPreparation {
    if (this.entryPreparations === undefined)
      this.entryPreparations = new ReadingEntryPreparation(this, this.optionalEntryMemoryEnabled);
    return this.entryPreparations;
  }

  optionalReadingEntryMemoryEnabled(): boolean { return this.optionalEntryMemoryEnabled; }

  isMangaPreparationForeground(): boolean {
    return this.state === 'ready' && this.preparationForeground;
  }

  /**
   * Debug/VM maintenance entry point. It reclaims rebuildable reading
   * cache data and idle display derivatives; Core-owned downloads, manifests,
   * bookshelf state, reading progress and active display leases stay intact.
   */
  async clearRebuildableCachesForVerification(): Promise<{ ordinaryBytes: number; derivedDisplayFiles: number;
    removedContentBytes: number; deletedBytes: number; deletedFiles: number }> {
    if (this.state !== 'ready') throw new Error('READER_RUNTIME_NOT_READY');
    const cleanup = await this.getDownloadStorageGateway().cleanup();
    if (cleanup.cleanupError !== undefined) throw new Error(cleanup.cleanupError);
    return { ordinaryBytes: cleanup.automaticBytes ?? 0, derivedDisplayFiles: cleanup.deletedFiles,
      removedContentBytes: cleanup.removedContentBytes, deletedBytes: cleanup.deletedBytes, deletedFiles: cleanup.deletedFiles };
  }

  /** Download-page cache action. Keep the Core receipt and Host cleanup in the
   * Runtime owner so UI surfaces cannot bypass the durable cache policy. */
  async clearDownloadRebuildableCache(): Promise<JsonObject> {
    if (this.state !== 'ready') throw new Error('READER_RUNTIME_NOT_READY');
    const cleanup = await this.getDownloadStorageGateway().cleanup();
    return { scope: 'cache', removedContentBytes: cleanup.removedContentBytes,
      deletedBytes: cleanup.deletedBytes, deletedFiles: cleanup.deletedFiles,
      ...(cleanup.cleanupError === undefined ? {} : { cleanupError: cleanup.cleanupError }) };
  }

  clearTextRebuildableCache(evidence: ReaderWriteEvidence, current: () => boolean): Promise<SharedDownloadCleanupResult> {
    if (this.state !== 'ready') throw new Error('READER_RUNTIME_NOT_READY');
    return this.getDownloadStorageGateway().cleanupSettingsText(evidence, current);
  }
  readSettingsTextCleanup(): Promise<SettingsTextCleanupJournal | undefined> {
    if (this.state !== 'ready') throw new Error('READER_RUNTIME_NOT_READY');
    return this.getDownloadStorageGateway().readSettingsTextCleanup();
  }
  reconcileSettingsTextCleanup(current: () => boolean): Promise<SharedDownloadCleanupResult | undefined> {
    if (this.state !== 'ready') throw new Error('READER_RUNTIME_NOT_READY');
    return this.getDownloadStorageGateway().reconcileSettingsTextCleanup(current);
  }

  async configureDownloadStorage(limitMb: number, cleanupAfterDays: number): Promise<SharedDownloadStoragePolicyResult> {
    if (this.state !== 'ready') throw new Error('READER_RUNTIME_NOT_READY');
    return this.getDownloadStorageGateway().configurePolicy({ capacityBytes: limitMb * 1024 * 1024, expiryDays: cleanupAfterDays });
  }

  async controlDownloadTask(action: 'pause' | 'resume' | 'cancel', sourceId: string, bookId: string,
    chapterIndex: number): Promise<JsonObject> {
    if (this.state !== 'ready') throw new Error('READER_RUNTIME_NOT_READY');
    const method = action === 'pause' ? 'cache.download.pause' : action === 'resume' ? 'cache.download.resume' : 'cache.download.cancel';
    const result = await this.request(method, { sourceId, bookId, chapterIndex, now: Date.now() });
    if (result.data['sourceId'] !== sourceId || result.data['bookId'] !== bookId || result.data['chapterIndex'] !== chapterIndex)
      throw new Error('cache.download task identity mismatch');
    return result.data;
  }

  async clearDownloadBook(sourceId: string, bookId: string): Promise<JsonObject> {
    if (this.state !== 'ready') throw new Error('READER_RUNTIME_NOT_READY');
    const result = await this.request('cache.clear', { scope: 'book', sourceId, bookId });
    if (result.data['scope'] !== 'book') throw new Error('cache.clear book returned an unexpected scope');
    return result.data;
  }

  async mangaStorageSummary(): Promise<DownloadStorageSummary> {
    if (this.state !== 'ready') throw new Error('READER_RUNTIME_NOT_READY');
    return this.getDownloadStorageGateway().summary();
  }

  /** Called by the app shell; no disk or network work runs in this UI turn. */
  setReadingPreparationContext(foreground: boolean, catalogAllowed: boolean): void {
    if (this.state === 'closing' || this.state === 'closed') return;
    const changed = this.preparationForeground !== foreground;
    this.preparationForeground = foreground;
    this.preparationCatalogAllowed = catalogAllowed;
    if (this.preparationNetwork === undefined) {
      this.preparationNetwork = new ReaderPreparationNetworkHost((): void => {
        this.bookCoordinator?.visibilityChanged();
        MangaChapterPreparationCoordinator.forRuntime(this).networkChanged();
        this.wakeReadingPreparations();
        this.deepReadingPrefetchObservers?.forEach((observer: () => void): void => {
          try { observer(); } catch (_) { /* Network notification cannot break the owner. */ }
        });
      });
      this.preparationNetwork.setForeground(foreground);
    } else if (changed) this.preparationNetwork.setForeground(foreground);
    if (changed) MangaChapterPreparationCoordinator.forRuntime(this).networkChanged();
    this.bookCoordinator?.visibilityChanged();
    this.wakeReadingPreparations();
    if (foreground && this.state === 'ready') {
      void this.getReadingRecordGateway().recover();
      this.recoverReadingProgressInBackground();
      void this.images.storage.maintainMangaStorage('expiry').catch((error: Error): void => {
        hilog.warn(LOG_DOMAIN, 'Reader', 'Manga cache maintenance: %{private}s', error.message);
      });
    }
  }

  /** A real user open authorizes this book's current/nearby missing chapters.
   * The intent write is deferred; it never gates the synchronous first page. */
  noteReadingPreparationIntent(sourceId: string, bookId: string): void {
    if (sourceId === 'local' || !this.supportsCoreCapability('reading.preparation.v1')) return;
    const epoch = this.preparationIntentEpoch;
    setTimeout((): void => {
      if (this.state !== 'ready' || epoch !== this.preparationIntentEpoch) return;
      void this.request('reading.preparation', { action: 'begin', sourceId, bookId, reason: 'read' })
        .then((): void => this.wakeReadingPreparations())
        .catch((error: Error): void => {
          hilog.warn(LOG_DOMAIN, 'Reader', 'Reading preparation intent: %{private}s', error.message);
        });
    }, 0);
  }

  private wakeReadingPreparations(): void {
    if (this.state !== 'ready' || !this.preparationForeground || this.preparationWakeTimer >= 0 ||
      !this.supportsCoreCapability('reading.preparation.v1')) return;
    this.preparationWakeTimer = setTimeout((): void => {
      this.preparationWakeTimer = -1;
      const allowed = (): boolean => this.state === 'ready' && this.preparationForeground &&
        this.preparationNetwork?.allowed() === true;
      if (!allowed()) return;
      void this.bookAcquisitions().resumeReadingPreparations(allowed,
        (): boolean => this.preparationCatalogAllowed).catch((error: Error): void => {
          if (this.state === 'ready') hilog.warn(LOG_DOMAIN, 'Reader', 'Shelf preparation: %{private}s', error.message);
        });
    }, 250);
  }

  releaseOptionalReadingEntryMemory(): void {
    this.entryPreparations?.releaseOptionalMemory();
    releaseReadingEntryMemory(this);
  }

  captureReadingContentValidity(sourceId: string, bookId: string): () => boolean {
    const valid = this.readingEntryPreparations().captureContentValidity(sourceId, bookId);
    return (): boolean => this.state !== 'closing' && this.state !== 'closed' && valid();
  }

  captureMangaImageContentValidity(sourceId: string, bookId: string): () => boolean {
    const valid = this.readingEntryPreparations().captureMangaImageContentValidity(sourceId, bookId);
    return (): boolean => this.state !== 'closing' && this.state !== 'closed' && valid();
  }

  clearOfflineChapterImages(sourceId: string, bookId: string, chapterIndex: number, manga: boolean = false): Promise<void> {
    // Manga originals are removed only by their existing exact retention/grant
    // transaction. The text ordinal must never authorize manga file deletion.
    return manga ? Promise.resolve() : this.images.storage.clearChapter(sourceId, bookId, chapterIndex);
  }

  waitForReadingContentIdle(sourceId: string, bookId: string): Promise<void> {
    return this.readingEntryPreparations().waitForContentIdle(sourceId, bookId);
  }

  private async requestDirect(method: string, params: JsonObject = {}, options: BookRequestOptions = {}): Promise<ReaderCoreResultEvent> {
    const preparationEffect=readerRuleMutationEffects(method,params).method;
    if (preparationEffect === 'cache.clear' || preparationEffect === 'bookshelf.remove' || preparationEffect === 'bookshelf.removeBatch' ||
      preparationEffect === 'source.delete' || preparationEffect === 'manga.sourceSwitch.commit' || preparationEffect === 'source.switch.begin' || preparationEffect === 'source.switch.commit' ||
      preparationEffect === 'source.switch.abort' || preparationEffect === 'runtime.storage.apply' || preparationEffect === 'runtime.storage.restore')
      this.preparationIntentEpoch += 1;
    const preparations = this.readingEntryPreparations();
    const invalidatesPreparation = preparations.beginRequest(method, params);
    // Content mutation revokes aliases before physical cache maintenance or
    // restore can wait for live display files. Ordinary progress stays valid.
    this.images.retireInvalidDisplaySessions();
    try {
      await this.start();
      const runtime = this.runtime;
      if (runtime === undefined) {
        throw new Error('Reader Core runtime did not become ready');
      }
      if (method === 'chapter.content' || method === 'manga.chapter.get' || method === 'manga.entry.get' ||
        method === 'reading.entry.prepare') await this.downloadStorageGateway?.waitForActiveMutation();
      // Non-scheduled writes can wait on startup/preparation fences. Recheck
      // their captured authority at the last synchronous dispatch boundary.
      // Scheduler requests already strip these hooks after their own admission.
      if (this.state !== 'ready' ||
        options.canContinue?.() === false || options.canDispatch?.() === false) {
        throw new ReaderCoreNotDispatchedError('Reader Core request was not dispatched');
      }
      options.onDispatch?.();
      if (preparationEffect === 'runtime.storage.apply' || preparationEffect === 'runtime.storage.restore') {
        // Content validity was invalidated before startup/request admission.
        // Finish the old display and eviction owners before Core replaces
        // their tokens, then reconcile Host's pending physical removals.
        await MangaChapterPreparationCoordinator.forRuntime(this).close();
        await this.images.waitForIdle();
        return await this.images.storage.withMangaStorageRestore(() => runtime.request(method, params, {
          ...options, timeoutMs: options.timeoutMs ?? DEFAULT_CORE_REQUEST_TIMEOUT_MS,
        }));
      }
      let result: ReaderCoreResultEvent;
      if (method === 'source.check.run' || method === 'source.check.ephemeral.run') {
        const requestId = runtime.send(method, params);
        const release = this.host.registerSourceCheck(requestId, options.onSourceCheckStage);
        try {
          result = await runtime.waitForResult(requestId, {
            ...options, timeoutMs: options.timeoutMs ?? DEFAULT_CORE_REQUEST_TIMEOUT_MS,
          });
        } finally { release(); }
      } else {
        const probe = this.mangaProbes.beginRequest(method, params, (): number => runtime.send(method, params),
          options, DEFAULT_CORE_REQUEST_TIMEOUT_MS);
        if (probe !== undefined) {
          try {
            result = await runtime.waitForResult(probe.requestId, probe.waitOptions());
          } finally { probe.settle(); }
        } else {
          result = await runtime.request(method, params, options.timeoutMs !== undefined ? options : {
            timeoutMs: DEFAULT_CORE_REQUEST_TIMEOUT_MS,
            pollMs: options.pollMs,
            hostRequest: options.hostRequest,
            shouldCancel: options.shouldCancel,
          });
        }
      }
      if (method === 'cache.clear') {
        if (result.data['scope'] !== params['scope']) throw new Error('cache.clear did not confirm its requested scope');
        const scope = params['scope'] === 'book' ? {
          sourceId: params['sourceId'] as string, bookId: params['bookId'] as string,
        } : undefined;
        // Core owns the logical grant and Host owns physical bytes. The Host
        // returns the actual post-unlink receipt so UI feedback uses the same
        // scope and physical-byte accounting as the cleanable preview.
        // A chapter ordinal is not global manga deletion authority. Exact
        // chapter-image handoff is owned by ReadingOfflineGateway below.
        const cleanup = params['scope'] === 'chapter' ? { deletedBytes: 0, deletedFiles: 0 } :
          await this.images.storage.clearMangaRebuildableCache(scope);
        result.data['deletedBytes'] = cleanup.deletedBytes;
        result.data['deletedFiles'] = cleanup.deletedFiles;
      }
      if (method === 'cache.storage.cleanup') {
        if (!Array.isArray(result.data['removedChapters'])) throw new Error('DOWNLOAD_STORAGE_SCOPE_UNAVAILABLE');
        const removed = result.data['removedChapters'].map(raw => {
          const chapter = raw as JsonObject;
          if (typeof chapter['sourceId'] !== 'string' || !(chapter['sourceId'] as string).trim() ||
            typeof chapter['bookId'] !== 'string' || !(chapter['bookId'] as string).trim() ||
            typeof chapter['chapterIndex'] !== 'number' || !Number.isSafeInteger(chapter['chapterIndex']) ||
            (chapter['chapterIndex'] as number) < 0) throw new Error('DOWNLOAD_STORAGE_SCOPE_INVALID');
          return { sourceId: chapter['sourceId'] as string, bookId: chapter['bookId'] as string,
            chapterIndex: chapter['chapterIndex'] as number };
        });
        // Exact optional-entry cache invalidation must not revoke another
        // protected chapter's display/download resource epoch in the book.
        preparations.invalidateCachedChapters(removed);
      }
      return result;
    } catch (error) {
      const admissionFailure = coreAdmissionFailureSummary(error, method);
      if (admissionFailure !== undefined)
        hilog.warn(LOG_DOMAIN, 'Reader', 'Core command not admitted: %{public}s', admissionFailure);
      if (!this.reservationQuarantineDiagnosticLogged && admissionFailure?.endsWith(
        ' code=BUSY reason=runtime result reservation contract failed; drain and recreate') === true) {
        this.reservationQuarantineDiagnosticLogged = true;
        try {
          // SDK owns this bounded, literal-method-only metadata. Never log
          // params, returned data, native wire strings or retry a possible write.
          hilog.warn(LOG_DOMAIN, 'Reader', 'Core reservation quarantine terminals: %{public}s',
            JSON.stringify(this.runtime?.recentTerminalMetadata ?? []));
        } catch (_) { /* Diagnostics must preserve the original admission error. */ }
      }
      const responseFailure = httpResponseFailureSummary(error);
      if (responseFailure !== undefined)
        // This helper admits only stage, hostname and status; URL paths,
        // credentials, query strings and response bodies never reach this log.
        hilog.warn(LOG_DOMAIN, 'Reader', 'Source response rejected: %{public}s', responseFailure);
      throw error;
    } finally {
      if (invalidatesPreparation) preparations.finishRequest(method, params);
      const effectMethod = readerRuleMutationEffects(method, params).method;
      if (effectMethod === 'reading.progress.update' || effectMethod === 'bookshelf.add' || effectMethod === 'source.update' ||
        effectMethod === 'source.supply' || effectMethod === 'replace.persist' || effectMethod === 'replace.undo' ||
        effectMethod === 'reader.chinese-conversion.put') this.wakeReadingPreparations();
    }
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
  async openSourceLogin(sourceId: string, loginUrl: string, sourceName: string,
    isCurrent?: () => boolean, clearReport?: () => Promise<boolean>): Promise<void> {
    const clearSession = clearReport === undefined ? undefined : async (): Promise<ArkWebLoginClearOutcome> => {
      let cookiesCleared = false;
      try {
        await this.clearSourceCookieSession(sourceId);
        cookiesCleared = true;
      } catch (_) { /* The outcome separates a failed credential write from the report write. */ }
      let report: 'cleared' | 'unsupported' | 'failed' = 'failed';
      try { report = await clearReport() ? 'cleared' : 'unsupported'; } catch (_) {}
      return { cookiesCleared, report };
    };
    await ArkWebExecutor.instance.openInteractive(
      sourceLoginPageUrl(sourceId, loginUrl),
      sourceId,
      `${sourceName} · 登录 / 验证`,
      isCurrent,
      clearSession,
    );
  }

  loadReadingImage(
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
    return this.images.loadReadingImage(sourceId, bookId, chapterIndex, contentVersion, imageUrl, baseUrl, allowNetwork,
      isCurrent, resourceRef, mangaPosition, expectedSourceVersion, mangaPreview, mangaDecodeRevision, mangaDisplaySessionId);
  }

  readMangaImageForSave(identity: ReadingImageCacheIdentity, sourceRuleVersion: string,
    allowNetwork: boolean, current: () => boolean): Promise<Uint8Array | undefined> {
    return this.images.readMangaImageForSave(identity, sourceRuleVersion, allowNetwork, current);
  }

  prefetchReadingImage(
    identity: ReadingImageCacheIdentity,
    isCurrent?: () => boolean,
    expectedSourceVersion?: string,
    allowNetwork: boolean = true,
    priority: MangaImagePriority = 'download',
  ): Promise<void> {
    return this.images.prefetchReadingImage(identity, isCurrent, expectedSourceVersion, allowNetwork, priority);
  }

  beginMangaDisplaySession(scope: MangaDisplaySessionScope, isCurrent: () => boolean): number {
    return this.images.beginMangaDisplaySession(scope, isCurrent);
  }

  endMangaDisplaySession(sessionId: number): void {
    return this.images.endMangaDisplaySession(sessionId);
  }

  tryAcquireMangaPreparedImage(sessionId: number, scope: MangaDisplaySessionScope, resourceRef: string,
    mangaPosition: number, isCurrent: () => boolean): ReadingBodyImagePayload | undefined {
    return this.images.tryAcquireMangaPreparedImage(sessionId, scope, resourceRef, mangaPosition, isCurrent);
  }

  markOfflineImageChapterComplete(
    chapter: ReadingImageChapterIdentity,
    resources: ReadingImageCacheIdentity[],
    isCurrent?: () => boolean,
  ): Promise<void> {
    return this.images.markOfflineImageChapterComplete(chapter, resources, isCurrent);
  }

  isOfflineImageChapterComplete(chapter: ReadingImageChapterIdentity, manga: boolean = false,
    isCurrent?: () => boolean): Promise<boolean> {
    return this.images.isOfflineImageChapterComplete(chapter, manga, isCurrent);
  }

  isOfflineImageChapterMaterialized(
    sourceId: string,
    bookId: string,
    chapterIndex: number,
  ): Promise<boolean> {
    return this.images.isOfflineImageChapterMaterialized(sourceId, bookId, chapterIndex);
  }

  clearOfflineBookImages(sourceId: string, bookId: string, manga: boolean = false): Promise<void> {
    return this.images.clearOfflineBookImages(sourceId, bookId, manga);
  }

  listMangaDownloadChapters(sourceId: string, bookId: string, isCurrent?: () => boolean):
    Promise<Array<{ sourceId: string; bookId: string; chapterId: string; }>> {
    return this.images.listMangaDownloadChapters(sourceId, bookId, isCurrent);
  }

  listMangaDownloadVersions(chapter: { sourceId: string; bookId: string; chapterId: string; },
    isCurrent?: () => boolean): Promise<string[]> {
    return this.images.listMangaDownloadVersions(chapter, isCurrent);
  }

  deleteMangaDownload(chapter: { sourceId: string; bookId: string; chapterId: string; },
    manifestVersion: string, isCurrent?: () => boolean): Promise<boolean> {
    return this.images.deleteMangaDownload(chapter, manifestVersion, isCurrent);
  }

  releaseReadingImage(fileUri: string, pixelMap?: image.PixelMap): void {
    return this.images.releaseReadingImage(fileUri, pixelMap);
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

  async readLibraryBackupIdentity(): Promise<{ libraryId: string; writerInstanceId: string } | undefined> {
    const filesDir = this.host.getContext().filesDir;
    const directory = this.fixtures.dataDirectory(filesDir);
    if (directory === undefined) throw new Error('Reader library identity directory unavailable');
    return readLibraryBackupIdentityAsync(directory, (): boolean => ReaderRuntimeOwner.isCurrent(this) && this.state === 'ready');
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

  async selectLocalBookInputs(canOpenPicker: () => boolean): Promise<LocalBookPreparation[]> {
    if (this.state === 'closing' || this.state === 'closed') {
      throw new Error('Reader Host is no longer available after teardown');
    }
    return this.host.selectLocalBookInputs(canOpenPicker);
  }

  async prepareSystemLocalBookInput(uri: string, admitFileName?: (fileName: string) => boolean): Promise<LocalBookPreparation> {
    if (this.state === 'closing' || this.state === 'closed') {
      throw new Error('Reader Host is no longer available after teardown');
    }
    return this.host.prepareSystemLocalBookInput(uri, admitFileName);
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

  async retainedLocalBookSourcePath(bookId: string, isCurrent: () => boolean): Promise<string | undefined> {
    return this.host.retainedLocalBookSourcePath(bookId, isCurrent);
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
    this.readingRecordGateway?.stopBackground();
    this.mangaProbes.network?.release('runtime-close');
    this.preparationForeground = false;
    this.preparationNetwork?.close();
    this.deepReadingPrefetchObservers?.clear();
    if (this.preparationWakeTimer >= 0) clearTimeout(this.preparationWakeTimer);
    this.preparationWakeTimer = -1;
    this.entryPreparations?.close();
    this.bookCoordinator?.close();
    if (this.closeTask !== undefined) {
      return this.closeTask;
    }
    if (this.state === 'closed') {
      return;
    }
    this.state = 'closing';
    ReadingBodyImageHost.instance.setMangaMetadataInspector(undefined);
    this.closeTask = this.closeDownloadsAndRuntime();
    return this.closeTask;
  }

  private async closeDownloadsAndRuntime(): Promise<void> {
    let downloadFailure: unknown;
    try { await this.downloadCoordinator?.close(); }
    catch (error) { downloadFailure = error; }
    try { await this.downloadStorageGateway?.waitForActiveMutation(); }
    finally {
      // Already dispatched transactions own their exact file handoff. Close
      // physical admission only after those finite owners have settled.
      this.images.storage.close();
      await this.closeRuntime();
    }
    if (downloadFailure !== undefined) throw downloadFailure;
  }

  private async closeRuntime(): Promise<void> {
    try {
      // An owner can retire before start() is called. Preserve the whole
      // predecessor chain so a third Ability cannot overtake the first one.
      await this.predecessorClose;
      if (this.startup !== undefined) {
        try {
          await this.startup;
        } catch (_) {
          // Startup has already closed its candidate runtime on failure.
        }
      }
      // `close()` sets state=closing first, so the supply loop stops after its
      // current local Core request. Wait for that request before closing Core.
      const drained = await Promise.allSettled([this.sourceSupplyTask, this.importFinalizeTask, this.images.waitForIdle(),
        MangaChapterPreparationCoordinator.forRuntime(this).close(), this.downloadCoordinator?.close(),
        this.downloadStorageGateway?.waitForActiveMutation()]);
      for (const result of drained) if (result.status === 'rejected')
        hilog.warn(LOG_DOMAIN, 'Reader', '%{private}s', `Runtime teardown drain failed: ${errorMessageOf(result.reason)}`);
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
      try {
        await this.ttsHost.close();
      } finally {
        const runtime = this.runtime;
        this.runtime = undefined;
        if (runtime !== undefined) {
          try {
            await runtime.request('runtime.storage.flush', {}, { timeoutMs: 30000 });
          } finally {
            this.host?.setResponseAssetBridge(undefined);
            runtime.close();
          }
        }
      }
    } finally {
      this.images.retireAllDisplaySessions();
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
    const trace = ReaderStartupTrace.current();
    const startedAt = trace?.begin('startup.predecessor-close') ?? -1;
    await this.waitForPredecessorClose();
    trace?.end('startup.predecessor-close', startedAt);
    if (this.state !== 'starting') {
      throw new Error('Reader Core runtime was closed before successor startup');
    }
    await this.startRuntime();
  }

  private async startRuntime(): Promise<void> {
    // Host file-existence checks are independent of native database open and
    // capability negotiation. Start them together, but consume the result
    // before the existing restore/source-switch/ready barrier.
    const legacyMigration = ReaderStartupTrace.measure('startup.legacy-marker',
      (): Promise<boolean> => this.host.needsLegacySnapshotMigration());
    // Native open can fail first. Keep an early marker failure observed while
    // retaining its original rejection for the admission barrier below.
    void legacyMigration.catch((): void => {});
    let runtime: ReaderCoreRuntime;
    let admittedBuild: CoreBuildIdentity;
    const isCurrent = (): boolean => this.state === 'starting' && ReaderRuntimeOwner.isCurrent(this);
    try {
      const filesDir = this.host.getContext().filesDir;
      const dataDirectory = this.fixtures.dataDirectory(filesDir);
      if (dataDirectory === undefined) throw new Error('PUBLIC_FIXTURE_STORAGE_NOT_ISOLATED');
      const storageProbe = await ReaderStartupTrace.measure('startup.storage-admission',
        (): Promise<ReaderCoreStorageProbe> => probeReaderCoreStorageAsync(dataDirectory, isCurrent));
      if (!isCurrent()) throw new Error('Reader Core startup cancelled after storage admission');
      admittedBuild = requireCoreBuildIdentity(storageProbe.buildIdentity);
      await requireStorageProbeIdentity(storageProbe, isCurrent,
        (): Promise<string> => this.host.readBundledRawFileText('reader-core-storage-identity.v1.json'));
      const startupConfig: JsonObject = { dataDirectory: dataDirectory };
      // Core owns the explicit migration plan and revalidates it on open.
      if (storageProbe.observation.requiresMigration && storageProbe.observation.explicitMigration !== null) {
        startupConfig['storageMigration'] = storageProbe.observation.explicitMigration;
      }
      runtime = await ReaderStartupTrace.measure('startup.native-open',
        (): Promise<ReaderCoreRuntime> => createReaderCoreRuntimeAsync(startupConfig, isCurrent));
    } catch (error) {
      if (this.state === 'starting') this.state = 'new';
      throw error;
    }
    // The host may stream negotiated binary responses into Core-owned assets;
    // the bridge is installed only after the runtime owns its native handle.
    try {
      this.host.setResponseAssetBridge(runtime.assetBridge());
      runtime.setCapabilityRouter(this.host.createCapabilityRouter());
      ReadingBodyImageHost.instance.setMangaMetadataInspector((bytes: Uint8Array, digest: string, current: () => boolean): Promise<MangaImageMetadataProof> =>
        MangaImageMetadataHost.instance.inspect(bytes, digest,
          (params: JsonObject): Promise<ReaderCoreResultEvent> => runtime.request('manga.resource.inspect', params,
            { timeoutMs: 15000, shouldCancel: (): boolean => !current() }), current));
      const hostCapabilities: JsonObject = {
        capabilities: [
          'persistence.get',
          'persistence.put',
          'http.execute',
          'manga.resource.transfer',
          'cookie.get',
          'cookie.set',
          'webview.evaluateJavaScript',
        ],
        platform: 'harmonyos',
      };
      await ReaderStartupTrace.measure('startup.host-capabilities', (): Promise<ReaderCoreResultEvent> =>
        runtime.request('runtime.setHostCapabilities', hostCapabilities, { timeoutMs: 5000 }));
      // Build identity and the Host migration marker are independent reads.
      // Settle them together before the optional restore barrier.
      const startupReads = await Promise.all([
        ReaderStartupTrace.measure('startup.core-info', (): Promise<ReaderCoreResultEvent> =>
          runtime.request('core.info', {}, { timeoutMs: 5000 })),
        legacyMigration,
      ]);
      const coreInfo = startupReads[0];
      const capabilities = coreInfo.data['capabilities'];
      this.coreCapabilities.clear();
      if (Array.isArray(capabilities)) {
        for (const capability of capabilities) {
          if (typeof capability === 'string') this.coreCapabilities.add(capability);
        }
      }
      const buildIdentity = requireCoreBuildIdentity(coreInfo.data['buildIdentity']);
      if (buildIdentity.buildId !== admittedBuild.buildId) {
        throw new Error('Reader Core build changed after storage admission');
      }
      const storageFormat = requireCoreStorageFormat(coreInfo.data['storageFormat']);
      const sqliteUserVersion = coreInfo.data['sqliteUserVersion'];
      if (typeof sqliteUserVersion === 'number' && Number.isSafeInteger(sqliteUserVersion) &&
        sqliteUserVersion > 0 && sqliteUserVersion <= 0x7fffffff) {
        buildIdentity.sqliteUserVersion = sqliteUserVersion;
      }
      if (this.supportsCoreCapability('host.http.timeout.v1')) {
        hostCapabilities['extensions'] = ['http.execute.timeoutMs.v1'];
        await runtime.request('runtime.setHostCapabilities', hostCapabilities, { timeoutMs: 5000 });
      }
      hilog.info(LOG_DOMAIN, 'Reader', 'Core build identity: %{public}s', JSON.stringify(buildIdentity));
      this.legacySnapshotRecovery = 'none';
      if (startupReads[1]) {
        // Portable export/restore support is not permission to replay this old
        // Host file into a current Library47 store. Keep its original data and
        // migration marker intact; any explicit import remains Core-owned.
        const operation = storageFormat?.capabilities;
        if (operation === undefined || storageFormat?.format !== 'legacy' || !operation.legacyHostImport) {
          this.legacySnapshotRecovery = operation === undefined ? 'storageCapabilityUnavailable' :
            storageFormat?.format === 'library47' ? 'automaticImportDeferred' : 'unsupportedStorageFormat';
          hilog.warn(LOG_DOMAIN, 'Reader', 'Legacy snapshot migration deferred: %{public}s', this.legacySnapshotRecovery);
        } else {
          await ReaderStartupTrace.measure('startup.legacy-restore', (): Promise<ReaderCoreResultEvent> =>
            runtime.request('runtime.storage.restore', {}, { timeoutMs: 30000 }));
          await ReaderStartupTrace.measure('startup.legacy-marker-write', (): Promise<void> =>
            this.host.markLegacySnapshotMigrated());
        }
      }
      // A source switch is not admitted to the restored route until its first
      // canonical target progress atomically finalizes the Core transaction.
      // Recover before publishing this runtime so a cold-start page can never
      // observe the tentative shelf identity or retain a UI-owned journal.
      const recovery = await ReaderStartupTrace.measure('startup.source-switch-recovery', (): Promise<ReaderCoreResultEvent> =>
        runtime.request('source.switch.recover', {}, { timeoutMs: 30000 }));
      const recoveredCount = requireSourceSwitchRecoveryCount(recovery.data['recovered']);
      hilog.info(LOG_DOMAIN, 'Reader', 'Core source-switch startup recovery count: %{public}d', recoveredCount);
      // `close()` may have begun while Host capability setup/restore awaited.
      // Never publish a ready runtime after teardown has claimed this owner.
      if (!isCurrent()) {
        throw new Error('Reader Core runtime was closed during startup');
      }
      this.runtime = runtime;
      this.state = 'ready';
      void this.getReadingRecordGateway().recover();
      this.recoverReadingProgressInBackground();
      ReaderStartupTrace.current()?.mark('startup.runtime-published', 'ready');
      // Legacy completed queue rows carry ambiguous old intent. Persist their
      // protection before restoring new accepted ranges or automatic cleanup.
      // This background work never gates the initial usable page.
      void this.getDownloadStorageGateway().restoreLegacyProtection().then(() => this.getDownloadCoordinator().restore())
        .then((): Promise<void> => this.state === 'ready' ? this.getDownloadStorageGateway().maintainAutomaticStorage() : Promise.resolve())
        .catch((error: Error): void => {
          if (this.state === 'ready') hilog.warn(LOG_DOMAIN, 'Reader', 'Download recovery: %{private}s', errorMessageOf(error));
        });
      this.scheduleImportFinalizeCleanup(runtime);
      // A 1,951-record collection must not hold the first frame or turn a
      // single malformed/dead source into an application startup failure.
      if (!this.fixtures.allowsBundledSources()) return;
      this.sourceSupplyTask = new ReaderBundledBookSourceInstaller(this.host, {
        request: (method: string, params: JsonObject, options?: BookRequestOptions): Promise<ReaderCoreResultEvent> =>
          this.request(method, params, options),
        supportsCapability: (capability: string): boolean => this.supportsCoreCapability(capability),
        ready: (): boolean => this.state === 'ready',
        retired: (): boolean => this.state === 'closing' || this.state === 'closed',
      }, BUNDLED_RAW_FILE_SHA256).install(runtime)
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
      this.host.setResponseAssetBridge(undefined);
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

  private scheduleImportFinalizeCleanup(runtime: ReaderCoreRuntime): void {
    // These receipts already confirmed the library commit. Removing rollback
    // journals is cleanup; it does not own the first readable storage state.
    this.importFinalizeTask = new Promise<void>((resolve): void => {
      setTimeout(resolve, 0);
    }).then(async (): Promise<void> => {
      if (this.state !== 'ready') return;
      await this.recoverPendingLocalImportFinalizes(runtime);
    }).catch((error: Error): void => {
      hilog.warn(LOG_DOMAIN, 'Reader', 'Import finalize cleanup deferred: %{private}s', errorMessageOf(error));
    });
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
      // A close leaves undispatched receipts durable for the next owner.
      if (this.state !== 'ready') break;
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

}
