import { WebDavCredentialStore } from '../features/sync/WebDavCredentialStore';
import { ReaderLibraryRestoreJournal, type ReaderLibraryRestoreIdentity, type ReaderLibraryRestoreCoreFact } from './ReaderLibraryRestoreJournal';
import { ReaderThemeHost } from './ReaderThemeHost';
import { ReaderSettingsGateway } from '../features/reading/ReaderSettingsGateway';
import { ReaderTtsPreferencesGateway } from '../features/reading/ReaderTtsPreferencesGateway';
import { SettingsGateway } from '../features/settings/SettingsGateway';
import { supplyBundledSources } from './IncrementalBundledSourceSupply';
import { BookAcquisitionCoordinator } from './BookAcquisitionCoordinator';
import { readerRuleMutationEffects } from './ReaderRuleMutationEffects';
import { BookRequestNotDispatchedError as ReaderCoreNotDispatchedError, type BookRequestOptions } from './BookRequestScheduler';
export { BookRequestNotDispatchedError as ReaderCoreNotDispatchedError } from './BookRequestScheduler';
import common from '@ohos.app.ability.common';
import { hilog } from '@kit.PerformanceAnalysisKit';
import {
  createReaderCoreRuntimeAsync,
  ReaderCoreRequestError,
  probeReaderCoreStorageAsync,
  type ReaderCoreStorageProbe,
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
import { errorMessageOf, httpResponseFailureSummary, coreAdmissionFailureSummary, localReadFailureSummary } from './ErrorMessage';
import { HarmonySystemTtsHost } from './HarmonySystemTtsHost';
import { HarmonyHttpTtsHost } from './HarmonyHttpTtsHost';
import { HarmonyTtsHostRouter } from './HarmonyTtsHostRouter';
import { HarmonyTtsMediaSession } from './HarmonyTtsMediaSession';
import { HarmonyTtsBackgroundSession } from './HarmonyTtsBackgroundSession';
import { LocalEpubResourceHost } from './LocalEpubResourceHost';
import { ReadingBodyImageHost, type ReadingBodyImagePayload, type MangaImageMetadataProof } from './ReadingBodyImageHost';
import { MangaImageDecodeHost } from './MangaImageDecodeHost';
import { MangaImageMetadataHost } from './MangaImageMetadataHost';
import {
  ReadingImageDiskCache,
  type ReadingImageCacheIdentity,
  type ReadingImageChapterIdentity,
} from './ReadingImageDiskCache';
import { canonicalReadingImageBaseUrl } from '../common/ReadingImageIdentity';
import { ArkWebExecutor } from './ArkWebExecutor';
import { sourceLoginPageUrl } from './SourceLoginPageProjection';
import type { SourceHttpDiagnosticRecord } from './HttpExecuteHost';
import {
  BundledSourceLedger,
  canonicalRulePayloadJson,
  decideBundledUpgrade,
  hasBuiltinMarker,
  isUserModifiedBuiltinCopy,
  mergeBundledDefaultStateCorrection,
  sha256Hex,
} from './BundledBookSourceSupply';
import { image } from '@kit.ImageKit';
import { ReaderAppearanceStore } from '../features/reading/ReaderAppearanceStore';
import { ReaderAppearancePreferences } from './ReaderAppearancePreferences';
import { ReadingEntryPreparation } from '../features/reading/ReadingEntryPreparation';
import { releaseReadingEntryMemory } from '../features/reading/ReadingEntryHandoff';
import { ReaderPreparationNetworkHost } from './ReaderPreparationNetworkHost';
import { ReaderStartupTrace } from './ReaderStartupTrace';
import { MangaOfflineNetworkProbe, type MangaOfflineProbeScope, type MangaProbeSelectionMode } from './MangaOfflineNetworkProbe';
import { MangaChapterPreparationCoordinator } from '../features/manga/MangaChapterPreparationCoordinator';
import type { MangaStorageChapter, MangaStorageGrant } from './ReadingImageDiskCache';
import type { MangaDisplaySessionScope } from '../features/reading/ReadingGatewayRuntime';
import { SharedDownloadCoordinator } from '../features/downloads/SharedDownloadCoordinator';
import type { ReaderWriteEvidence } from './ReaderWriteEvidence';
import { SharedDownloadStorageGateway, type SettingsTextCleanupJournal, type SharedDownloadCleanupResult } from '../features/downloads/SharedDownloadStorageGateway';
import type { ReadingTextStorageChapter } from './ReadingImageDiskCache';
import type { DownloadStorageSummary } from '../features/downloads/SharedDownloadProjection';
import { ReadingRecordGateway } from '../features/reading/ReadingRecordGateway';
import { ReadingProgressJournal } from '../features/reading/ReadingProgressJournal';
import { ReadingProgressIntentFile } from '../features/reading/ReadingProgressIntentFile';
import { recoverReadingProgress } from '../features/reading/ReadingSessionFlowGateway';

type RuntimeState = 'new' | 'starting' | 'ready' | 'closing' | 'closed';

/** One manga operation may publish its display before its own byte copies drain. */
type MangaImageWork = { drain?: Promise<void> };
type MangaImagePriority = 'foreground' | 'chapter' | 'background' | 'download';
type MangaImageQueuedWork = { priority: MangaImagePriority; run: () => Promise<void> };
type MangaPreparedDisplayPage = { intrinsicHeight: number; tileHeight: number; regions: Map<number, ReadingBodyImagePayload>; };
type MangaDisplaySession = { scope: MangaDisplaySessionScope; current: () => boolean;
  aliases: Map<string, MangaPreparedDisplayPage>; files: Map<string, ReadingBodyImagePayload>;
  fileAliasCounts: Map<string, number>; };

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
const BUNDLED_RAW_FILE_SHA256 = '72bbd10c370041f467579e6baa08635c2a86f7fa0b819536104bd07d7ad6c459';
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

export type ReaderSourceSwitchRecoveryState = 'idle' | 'recovering' | 'resolved' | 'pending';

/** Observable convergence of interrupted source switches. `pending` means the
 * blanket rollback did not finish; the durable shelf still opens and every
 * original book/progress row remains untouched. */
export interface ReaderSourceSwitchRecoveryStatus {
  state: ReaderSourceSwitchRecoveryState;
  busy: boolean;
  canRetry: boolean;
  generation: number;
  recovered: number;
  message: string;
}

const SOURCE_SWITCH_RECOVERY_GRACE_MS = 5000;
const SOURCE_SWITCH_RECOVERY_PENDING_MESSAGE =
  '上次换源尚未完成恢复，书架、书籍信息和阅读进度均已保留。可重试恢复，或打开相关书籍核对换源结果。';

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
  private readonly mangaOfflineProbe: MangaOfflineNetworkProbe | undefined;
  private mangaReadingProbeBodyDetach: (() => void) | undefined;
  private mangaReadingProbeReleaseDetach: (() => void) | undefined;
  private mangaReadingProbeImageScope: MangaOfflineProbeScope | undefined;
  private mangaReadingProbeForeignImages: number = 0;
  private runtime: ReaderCoreRuntime | undefined = undefined;
  private appearanceStore: ReaderAppearanceStore | undefined = undefined;
  private startup: Promise<void> | undefined = undefined;
  /** Serializes background storage flushes with teardown. */
  private flushTail: Promise<void> = Promise.resolve();
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
  private closeTask: Promise<void> | undefined = undefined;
  /** Background source seeding never gates page availability. */
  private sourceSupplyTask: Promise<void> = Promise.resolve();
  private importFinalizeTask: Promise<void> = Promise.resolve();
  private state: RuntimeState = 'new';
  private reservationQuarantineDiagnosticLogged: boolean = false;
  private coreCapabilities: Set<string> = new Set<string>();
  private downloadCoordinator: SharedDownloadCoordinator | undefined;
  private downloadStorageGateway: SharedDownloadStorageGateway | undefined;
  private downloadReadingProtection: { sourceId: string; bookId: string; chapterIndex?: number; } | undefined;
  private downloadProtectionRevision: number = 0;
  private readingRecordGateway: ReadingRecordGateway | undefined;
  private readingProgressJournal: ReadingProgressJournal | undefined;
  /** Startup rollback of interrupted source switches is convergence, never a
   * prerequisite for publishing the durable shelf. */
  private sourceSwitchRecoveryStatus: ReaderSourceSwitchRecoveryStatus = {
    state: 'idle', busy: false, canRetry: false, generation: 0, recovered: 0, message: '' };
  private sourceSwitchRecoveryTask: Promise<void> | undefined = undefined;
  private readonly sourceSwitchRecoveryListeners: Set<(status: ReaderSourceSwitchRecoveryStatus) => void> =
    new Set<(status: ReaderSourceSwitchRecoveryStatus) => void>();

  sourceSwitchRecovery(): ReaderSourceSwitchRecoveryStatus { return this.sourceSwitchRecoveryStatus; }

  subscribeSourceSwitchRecovery(listener: (status: ReaderSourceSwitchRecoveryStatus) => void): () => void {
    this.sourceSwitchRecoveryListeners.add(listener);
    return (): void => { this.sourceSwitchRecoveryListeners.delete(listener); };
  }

  /** Explicit user retry only: an automatic loop would repeatedly roll back a
   * switch the reader may be resuming and cannot prove why it failed. */
  async retrySourceSwitchRecovery(): Promise<void> {
    const runtime = this.runtime;
    if (runtime === undefined || this.state !== 'ready' || this.sourceSwitchRecoveryTask !== undefined ||
      this.sourceSwitchRecoveryStatus.state !== 'pending') return;
    this.publishSourceSwitchRecovery('recovering', true, false, this.sourceSwitchRecoveryStatus.recovered, '');
    await this.trackSourceSwitchRecovery(runtime);
  }

  /** One application-owned duration outbox, independent of reading routes. */
  getReadingRecordGateway(): ReadingRecordGateway {
    if (this.readingRecordGateway === undefined) this.readingRecordGateway = new ReadingRecordGateway(this);
    return this.readingRecordGateway;
  }

  getReadingProgressJournal(): ReadingProgressJournal {
    if (this.readingProgressJournal === undefined) this.readingProgressJournal = new ReadingProgressJournal(
      new ReadingProgressIntentFile(this.getUIAbilityContext().filesDir, (): boolean => ReaderRuntimeOwner.isCurrent(this)));
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
  private libraryRestoreHandoff: (() => Promise<void>) | undefined;
  private libraryRestoreCapturedHandoff: (() => Promise<void>) | undefined;
  private libraryRestoreHandoffInFlight: boolean = false;
  private libraryRestoreTask: Promise<JsonObject> | undefined;
  private libraryRestoreSettled: boolean = false;
  private libraryRestoreCloseSucceeded: boolean = false;
  private libraryRestoreApplyDispatched: boolean = false;
  private libraryRestoreStartupFact: ReaderLibraryRestoreCoreFact | undefined;
  private libraryRestoreSealed: boolean = false;
  private hostIoQuiescence: Promise<void> | undefined;
  private downloadCloseTask: Promise<void> | undefined;
  private platformStorageInitialized: boolean = false;
  private bookCoordinator: BookAcquisitionCoordinator | undefined = undefined;
  private entryPreparations: ReadingEntryPreparation | undefined = undefined;
  private preparationNetwork: ReaderPreparationNetworkHost | undefined;
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

  private constructor(context: common.UIAbilityContext, predecessorClose: Promise<void> = Promise.resolve(),
    disableOptionalEntryMemory: boolean = false, mangaOfflineScope?: MangaOfflineProbeScope,
    mangaReadingScope?: MangaOfflineProbeScope, mangaSelectionMode?: MangaProbeSelectionMode) {
    this.predecessorClose = predecessorClose;
    this.optionalEntryMemoryEnabled = !disableOptionalEntryMemory;
    let probe: MangaOfflineNetworkProbe | undefined = undefined;
    const conflictingScope = mangaOfflineScope !== undefined && mangaReadingScope !== undefined;
    const conflictingSelection = mangaSelectionMode !== undefined && (mangaOfflineScope !== undefined || mangaReadingScope !== undefined);
    if (!conflictingScope && !conflictingSelection) {
      if (mangaSelectionMode !== undefined) {
        const label = mangaSelectionMode === 'offline' ? 'MANGA_OFFLINE_PROBE %{public}s' : 'MANGA_READING_PROBE %{public}s';
        probe = new MangaOfflineNetworkProbe(undefined,
          (state: string): void => hilog.info(LOG_DOMAIN, 'Reader', label, state), mangaSelectionMode, true);
      } else if (mangaOfflineScope !== undefined) {
        probe = new MangaOfflineNetworkProbe(mangaOfflineScope,
          (state: string): void => hilog.info(LOG_DOMAIN, 'Reader', 'MANGA_OFFLINE_PROBE %{public}s', state));
      } else if (mangaReadingScope !== undefined) {
        probe = new MangaOfflineNetworkProbe(mangaReadingScope,
          (state: string): void => hilog.info(LOG_DOMAIN, 'Reader', 'MANGA_READING_PROBE %{public}s', state), 'reading');
      }
    }
    this.mangaOfflineProbe = probe;
    this.host = new ReaderHostRegistry(context, this.mangaOfflineProbe);
    this.ttsHost = new HarmonyTtsHostRouter(
      new HarmonySystemTtsHost(),
      new HarmonyHttpTtsHost(this),
      new HarmonyTtsMediaSession(context),
      new HarmonyTtsBackgroundSession(context),
      (): boolean => AppStorage.get<boolean>('readerAppForeground') !== false,
    );
    this.localEpubResourceHost = new LocalEpubResourceHost(context);
    this.readingImageDiskCache = new ReadingImageDiskCache(context);

  }

  registerLibraryRestoreHandoff(handler: () => Promise<void>): () => void {
    if (!ReaderRuntimeOwner.isCurrent(this) || this.state !== 'ready' || this.closeTask !== undefined)
      throw new Error('LIBRARY_RESTORE_HANDOFF_RETIRED');
    this.libraryRestoreHandoff = handler;
    return (): void => { if (this.libraryRestoreHandoff === handler) this.libraryRestoreHandoff = undefined; };
  }

  private canCommitOriginalLibrarySync(immutableLog: boolean = true): boolean {
    return this.canConfigureBackupStorage() && this.abilityLeases === 1 && this.libraryRestoreHandoff !== undefined &&
      this.supportsCoreCapability('library.metadataRestore.status.v1') &&
      this.supportsCoreCapability(immutableLog ? 'library.sync.log.v2' : 'library.sync.v1');
  }

  canRecoverLibraryRestoreFailure(): boolean {
    return this.libraryRestoreSettled && this.libraryRestoreCloseSucceeded && this.state === 'closed' &&
      ReaderRuntimeOwner.instance === undefined && !this.libraryRestoreHandoffInFlight &&
      this.libraryRestoreCapturedHandoff !== undefined && this.libraryRestoreHandoff === this.libraryRestoreCapturedHandoff;
  }

  async recoverAfterLibraryRestoreFailure(): Promise<void> {
    const handoff = this.libraryRestoreCapturedHandoff;
    if (!this.canRecoverLibraryRestoreFailure() || handoff === undefined) throw new Error('LIBRARY_RESTORE_HANDOFF_UNAVAILABLE');
    await this.performLibraryRestoreHandoff(handoff);
  }

  private async performLibraryRestoreHandoff(handoff: () => Promise<void>): Promise<void> {
    if (this.libraryRestoreHandoffInFlight || this.libraryRestoreHandoff !== handoff)
      throw new Error('LIBRARY_RESTORE_HANDOFF_RETIRED');
    this.libraryRestoreHandoffInFlight = true;
    try {
      await handoff();
      if (this.libraryRestoreHandoff === handoff) this.libraryRestoreHandoff = undefined;
    } finally { this.libraryRestoreHandoffInFlight = false; }
  }

  pendingLibraryRestoreStartupFact(): ReaderLibraryRestoreCoreFact | undefined {
    if (!ReaderRuntimeOwner.isCurrent(this) || this.state !== 'ready') return undefined;
    return this.libraryRestoreStartupFact;
  }

  acknowledgeLibraryRestoreStartupFact(identity: ReaderLibraryRestoreIdentity): void {
    const fact = this.pendingLibraryRestoreStartupFact();
    if (fact?.operationId === identity.operationId && fact.packageSha256 === identity.packageSha256)
      this.libraryRestoreStartupFact = undefined;
  }

  applyLibrarySyncCommit(operationId: string, planToken: string, remoteRevision: string, publishSha256: string): Promise<JsonObject> {
    if (this.libraryRestoreTask !== undefined) return Promise.reject(new Error('LIBRARY_RESTORE_BUSY'));
    const operation = this.applyLibrarySyncCommitOwned(operationId, planToken, remoteRevision, publishSha256);
    this.libraryRestoreTask = operation;
    void operation.finally((): void => {
      this.libraryRestoreSettled = true;
      if (this.libraryRestoreTask === operation && this.state === 'ready' && this.closeTask === undefined)
        this.libraryRestoreTask = undefined;
    }).catch((): void => {});
    return operation;
  }

  /** The immutable log owner supplies a typed complete-readback proof. It
   * shares the exact same Runtime/restore retirement transaction as CAS. */
  applyLibraryLogSyncCommit(operationId: string, planToken: string, readbackProof: JsonObject, publishSha256: string): Promise<JsonObject> {
    if (this.libraryRestoreTask !== undefined) return Promise.reject(new Error('LIBRARY_RESTORE_BUSY'));
    const operation = this.applyLibrarySyncCommitOwned(operationId, planToken, '', publishSha256, readbackProof);
    this.libraryRestoreTask = operation;
    void operation.finally((): void => {
      this.libraryRestoreSettled = true;
      if (this.libraryRestoreTask === operation && this.state === 'ready' && this.closeTask === undefined)
        this.libraryRestoreTask = undefined;
    }).catch((): void => {});
    return operation;
  }

  private async applyLibrarySyncCommitOwned(operationId: string, planToken: string,
    remoteRevision: string, publishSha256: string, readbackProof?: JsonObject): Promise<JsonObject> {
    const protocolVersion = readbackProof === undefined ? 1 : 2;
    const runtime = this.runtime;
    const admitted = (): boolean => ReaderRuntimeOwner.isCurrent(this) && this.state === 'ready' && this.closeTask === undefined;
    if (runtime === undefined || !admitted() || !this.canCommitOriginalLibrarySync(readbackProof !== undefined) ||
      !this.supportsCoreCapability(readbackProof === undefined ? 'library.sync.v1' : 'library.sync.log.v2')) throw new Error('LIBRARY_SYNC_HANDOFF_UNAVAILABLE');
    if (!/^library-sync-[0-9a-f]{32}$/.test(operationId) || typeof planToken !== 'string' || planToken.length < 1 || planToken.length > 256 ||
      !/^[0-9a-f]{64}$/.test(publishSha256)) throw new Error('LIBRARY_SYNC_COMMIT_IDENTITY_INVALID');
    if (readbackProof === undefined) {
      if (typeof remoteRevision !== 'string' || remoteRevision.length > 1024 || !/^"[\x21\x23-\x7e\x80-\xff]*"$/.test(remoteRevision))
        throw new Error('LIBRARY_SYNC_COMMIT_IDENTITY_INVALID');
    } else {
      const objectId = readbackProof['objectId'], bytes = readbackProof['bytes'];
      const match = typeof objectId === 'string' ? /^reader-sync-log-v2-[0-9a-f]{64}-([0-9a-f]{32})-([0-9a-f]{64})\.reader$/.exec(objectId) : null;
      if (readbackProof['kind'] !== 'immutableReadbackV2' || readbackProof['sha256'] !== publishSha256 || match === null ||
        `library-sync-${match[1]}` !== operationId || match[2] !== publishSha256 || typeof bytes !== 'number' ||
        !Number.isSafeInteger(bytes) || bytes < 1 || bytes > 24 * 1024 * 1024)
        throw new Error('LIBRARY_LOG_COMMIT_IDENTITY_INVALID');
    }
    const identity: ReaderLibraryRestoreIdentity = { operationId, packageSha256: publishSha256 };
    await ReaderThemeHost.prepareUserChange();
    // The receipt is queried before any second commit can be dispatched. A
    // matching current library is not used as this original operation's ACK.
    const observed = this.decodeLibraryRestoreCoreFact((await runtime.request('library.package.restore.status', {
      operationId: identity.operationId, packageSha256: identity.packageSha256 },
      { timeoutMs: 5000 })).data, identity);
    if (!admitted() || !this.canCommitOriginalLibrarySync(readbackProof !== undefined)) throw new Error('LIBRARY_SYNC_HANDOFF_UNAVAILABLE');
    const handoff = this.libraryRestoreHandoff;
    this.libraryRestoreCapturedHandoff = handoff;
    const owns = (): boolean => ReaderRuntimeOwner.isCurrent(this) && this.state !== 'closed';
    const journal = new ReaderLibraryRestoreJournal(this.host.getContext().filesDir, owns);
    let resolveClosed: (() => void) | undefined, rejectClosed: ((error: Error) => void) | undefined;
    this.closeTask = new Promise<void>((resolve, reject): void => { resolveClosed = resolve; rejectClosed = reject; });
    void this.closeTask.catch((): void => {});
    let result: JsonObject | undefined, operationFailure: Error | undefined;
    try {
      await journal.prepare(identity);
      await this.retireRuntimeDomains(true);
      await ReaderThemeHost.sealForLibraryRestore(this);
      await this.requireLibraryRestoreHostSettings();
      const drains = await Promise.allSettled([this.sourceSupplyTask, this.importFinalizeTask, this.mangaImageTail,
        MangaChapterPreparationCoordinator.forRuntime(this).close(), this.downloadCloseTask,
        this.downloadStorageGateway?.waitForActiveMutation(), this.flushTail, this.ttsHost.close()]);
      for (const drain of drains) if (drain.status === 'rejected') throw drain.reason;
      this.readingImageDiskCache.close();
      await this.quiesceHostFilesForLibraryRestore();
      if (!owns() || this.runtime !== runtime) throw new Error('LIBRARY_SYNC_RUNTIME_RETIRED');
      await journal.markMayApply(identity);
      this.libraryRestoreApplyDispatched = true;
      if (observed.status === 'missing') {
        try {
          const response = await runtime.request(readbackProof === undefined ? 'library.sync.commit' : 'library.sync.log.commit',
            readbackProof === undefined ? { operationId, planToken, remoteRevision, publishSha256 } :
              { operationId, planToken, publishSha256, readbackProof }, { timeoutMs: 60000 });
          const data = response.data;
          if (data['protocolVersion'] !== protocolVersion || data['operationId'] !== operationId ||
            !['committed', 'needsRebase'].includes(data['status'] as string)) throw new Error('LIBRARY_SYNC_COMMIT_REPLY_INVALID');
          result = data;
        } catch (_) { /* Exact durable receipt lookup below; never repeat commit. */ }
      }
      const fact = this.decodeLibraryRestoreCoreFact((await runtime.request('library.package.restore.status', {
        operationId: identity.operationId, packageSha256: identity.packageSha256 },
        { timeoutMs: 5000 })).data, identity);
      if (fact.status !== 'missing') {
        await journal.markCoreCommitted(fact);
        result = { ...(result ?? {}), protocolVersion, operationId, status: 'committed' };
      } else if (result?.['status'] === 'needsRebase') {
        const cleared = await journal.reconcile(async (original): Promise<ReaderLibraryRestoreCoreFact> =>
          this.decodeLibraryRestoreCoreFact((await runtime.request('library.package.restore.status', {
            operationId: original.operationId, packageSha256: original.packageSha256 },
            { timeoutMs: 5000 })).data, original));
        if (cleared?.status !== 'missing') throw new Error('LIBRARY_SYNC_COMMIT_FACT_CHANGED');
      } else {
        result = { protocolVersion, operationId, status: 'pending', commitUnconfirmed: true };
      }
    } catch (error) { operationFailure = error as Error; }
    finally {
      try {
        if (this.state !== 'closing' && this.state !== 'closed') await this.retireRuntimeDomains();
        await this.closeRuntime(); this.libraryRestoreCloseSucceeded = true; resolveClosed?.();
      } catch (error) { rejectClosed?.(error as Error); operationFailure = operationFailure ?? error as Error; }
    }
    // Success, deterministic rebase and unknown ACK all retire the old writer.
    // The successor resolves the shared restore journal before enabling IO.
    let restartRequired = true;
    if (this.libraryRestoreCloseSucceeded && handoff !== undefined && this.libraryRestoreHandoff === handoff) {
      try { await this.performLibraryRestoreHandoff(handoff); restartRequired = false; }
      catch (_) { /* Same-handler recovery remains available on this closed owner. */ }
    }
    if (operationFailure !== undefined)
      return { protocolVersion, operationId, status: 'pending', commitUnconfirmed: true, restartRequired };
    return { ...(result ?? { protocolVersion, operationId, status: 'pending', commitUnconfirmed: true }), restartRequired };
  }

  private decodeLibraryRestoreCoreFact(data: JsonObject, identity: ReaderLibraryRestoreIdentity): ReaderLibraryRestoreCoreFact {
    const operationId = data['operationId'], packageSha256 = data['packageSha256'], status = data['status'];
    if (Object.keys(data).length !== 3 || operationId !== identity.operationId || packageSha256 !== identity.packageSha256 ||
      (status !== 'missing' && status !== 'committedCurrent' && status !== 'committedHistorical'))
      throw new Error('LIBRARY_RESTORE_CORE_FACT_INVALID');
    return { operationId: identity.operationId, packageSha256: identity.packageSha256, status };
  }

  canConfigureBackupStorage(): boolean {
    return ReaderRuntimeOwner.isCurrent(this) && this.state === 'ready' && this.closeTask === undefined && !this.libraryRestoreSealed;
  }

  private async requireLibraryRestoreHostSettings(): Promise<void> {
    const appearance = this.getAppearanceStore();
    await appearance.load();
    await Promise.all([appearance.flush(), WebDavCredentialStore.instance.awaitDurableBookshelfWrites((): boolean => ReaderRuntimeOwner.isCurrent(this)),
      new ReaderSettingsGateway(this).awaitDurableWrites(),
      new ReaderTtsPreferencesGateway(this).awaitDurableWrites(),
      new SettingsGateway(this.getUIAbilityContext()).awaitDurableWrites((): boolean => ReaderRuntimeOwner.isCurrent(this))]);
  }

  private initializePlatformStorage(): void {
    if (this.platformStorageInitialized) return;
    ReadingBodyImageHost.setDisplayCacheDir(this.host.getContext().cacheDir);
    this.bindMangaStorage();
    if (this.mangaOfflineProbe?.mode === 'reading') this.bindMangaReadingProbe();
    this.platformStorageInitialized = true;
  }

  private async negotiateCoreCapabilities(runtime: ReaderCoreRuntime, coreInfo: JsonObject): Promise<void> {
    this.coreCapabilities.clear();
    const advertised = coreInfo['capabilities'];
    if (Array.isArray(advertised)) for (const capability of advertised) {
      if (typeof capability === 'string' && capability !== 'library.sync.v1' && capability !== 'library.sync.log.v2') this.coreCapabilities.add(capability);
    }
    const current = (): boolean => ReaderRuntimeOwner.isCurrent(this) && this.state === 'starting';
    if (!current()) throw new Error('Reader Core runtime was closed during capability negotiation');
    let result: ReaderCoreResultEvent;
    try {
      result = await runtime.request('library.sync.capabilities', {}, { timeoutMs: 5000, shouldCancel: (): boolean => !current() });
    } catch (error) {
      // Only the SDK's correlated protocol rejection proves absence. A
      // timeout, malformed reply or initialization error must stay visible.
      if (current() && error instanceof ReaderCoreRequestError && error.event.protocolVersion === 1 &&
        error.event.type === 'error' && error.event.error.code === 'UNKNOWN_METHOD') return;
      throw error;
    }
    if (!current()) throw new Error('Reader Core runtime was closed during capability negotiation');
    const value = result.data;
    if (value['protocolVersion'] !== 1 || typeof value['metadata'] !== 'boolean' || typeof value['durable'] !== 'boolean')
      throw new Error('LIBRARY_SYNC_CAPABILITIES_INVALID');
    if (value['metadata'] === true && value['durable'] === true) this.coreCapabilities.add('library.sync.v1');
    let logResult: ReaderCoreResultEvent;
    try {
      logResult = await runtime.request('library.sync.log.capabilities', {}, { timeoutMs: 5000, shouldCancel: (): boolean => !current() });
    } catch (error) {
      if (current() && error instanceof ReaderCoreRequestError && error.event.protocolVersion === 1 &&
        error.event.type === 'error' && error.event.error.code === 'UNKNOWN_METHOD') return;
      throw error;
    }
    if (!current()) throw new Error('Reader Core runtime was closed during capability negotiation');
    const log = logResult.data;
    if (log['protocolVersion'] !== 2 || typeof log['metadata'] !== 'boolean' || typeof log['durable'] !== 'boolean' ||
      typeof log['immutableLog'] !== 'boolean') throw new Error('LIBRARY_LOG_CAPABILITIES_INVALID');
    if (log['metadata'] === true && log['durable'] === true && log['immutableLog'] === true) this.coreCapabilities.add('library.sync.log.v2');
  }
  private async reconcileLibraryRestoreBeforeReady(runtime: ReaderCoreRuntime): Promise<boolean> {
    const current = (): boolean => ReaderRuntimeOwner.isCurrent(this) && this.state === 'starting';
    const journal = new ReaderLibraryRestoreJournal(this.host.getContext().filesDir, current);
    const fact = await journal.reconcile(async (identity: ReaderLibraryRestoreIdentity): Promise<ReaderLibraryRestoreCoreFact> => {
      if (!this.supportsCoreCapability('library.metadataRestore.status.v1'))
        throw new Error('LIBRARY_RESTORE_CORE_QUERY_UNAVAILABLE');
      const response = await runtime.request('library.package.restore.status', {
        operationId: identity.operationId, packageSha256: identity.packageSha256,
      }, { timeoutMs: 5000, shouldCancel: (): boolean => !current() });
      if (!current()) throw new Error('LIBRARY_RESTORE_RUNTIME_RETIRED');
      const data = response.data;
      const fact = this.decodeLibraryRestoreCoreFact(data, identity);
      // A pending intent also keeps the original local settings' actual flush
      // facts ahead of replacement writer/file-output activation.
      await this.requireLibraryRestoreHostSettings();
      // A selected SQL commit supersedes the legacy Host snapshot. Establish
      // that marker before clearing the journal, including lost-clear-ACK retry.
      if (fact.status !== 'missing') await this.host.markLegacySnapshotMigrated();
      if (!current()) throw new Error('LIBRARY_RESTORE_RUNTIME_RETIRED');
      return fact;
    });
    if (fact !== undefined) this.libraryRestoreStartupFact = { ...fact };
    return fact !== undefined && fact.status !== 'missing';
  }

  private quiesceHostFilesForLibraryRestore(): Promise<void> {
    if (this.hostIoQuiescence !== undefined) return this.hostIoQuiescence;
    const starts: Array<() => Promise<void>> = [
      (): Promise<void> => this.host.quiesceForLibraryRestore(),
      (): Promise<void> => this.readingImageDiskCache.quiesceForLibraryRestore(),
    ];
    let releaseFailure: unknown;
    if (this.platformStorageInitialized) {
      // Release display consumers before sealing the shared display owner;
      // their actual removal promises remain part of that owner's drain.
      try {
        for (const sessionId of this.mangaDisplaySessions.keys()) this.endMangaDisplaySession(sessionId);
        ReadingBodyImageHost.instance.releaseAllDisplayFiles();
      } catch (error) { releaseFailure = error; }
      starts.push((): Promise<void> => ReadingBodyImageHost.instance.quiesceForLibraryRestore());
    }
    // Close every admission in this turn before waiting on any one owner.
    // A synchronous failure must not leave the remaining owners open.
    const pending = starts.map((start: () => Promise<void>): Promise<void> => {
      try { return start(); } catch (error) { return Promise.reject(error); }
    });
    this.hostIoQuiescence = Promise.allSettled(pending).then((results): void => {
      if (releaseFailure !== undefined) throw releaseFailure;
      for (const result of results) if (result.status === 'rejected') throw result.reason;
    });
    return this.hostIoQuiescence;
  }

  private retireRuntimeDomains(strict: boolean = false): Promise<void> {
    if (strict) this.libraryRestoreSealed = true;
    if (this.downloadCloseTask === undefined) this.downloadCloseTask = this.downloadCoordinator?.close();
    void this.downloadCloseTask?.catch((): void => {});
    this.readingRecordGateway?.stopBackground();
    this.mangaOfflineProbe?.release('runtime-close');
    this.preparationForeground = false;
    this.preparationNetwork?.close();
    if (this.preparationWakeTimer >= 0) clearTimeout(this.preparationWakeTimer);
    this.preparationWakeTimer = -1;
    this.entryPreparations?.close();
    this.bookCoordinator?.close();
    this.state = 'closing';
    ReadingBodyImageHost.instance.setMangaMetadataInspector(undefined);
    return Promise.resolve();
  }

  private bindMangaStorage(): void {
    const selector = (chapter: MangaStorageChapter): JsonObject => ({ chapter: { sourceId: chapter.sourceId,
      bookId: chapter.bookId, chapterId: chapter.chapterId }, manifestVersion: chapter.contentVersion });
    const projectGrant = (value: JsonObject): MangaStorageGrant => {
      const chapter = value['chapter'] as JsonObject;
      return { sourceId: chapter['sourceId'] as string, bookId: chapter['bookId'] as string,
        chapterId: chapter['chapterId'] as string, contentVersion: value['manifestVersion'] as string, grantToken: value['token'] as string };
    };
    this.readingImageDiskCache.setMangaStorageAuthority({
      classify: async (chapter) => (await this.request('manga.cache.classify', selector(chapter))).data['status'] as
        'cache' | 'download' | 'protected' | 'unknown' | 'missing',
      classifyBatch: async (chapters) => {
        const response = await this.request('manga.cache.classifyBatch', { versions: chapters.map((chapter) => ({
          ...selector(chapter), manifestVersion: chapter.contentVersion,
        })) });
        const results = response.data['results'];
        if (!Array.isArray(results) || results.length !== chapters.length) throw new Error('MANGA_CACHE_CLASSIFY_BATCH_INVALID');
        return results.map((result: JsonObject) => result['status'] as 'cache' | 'download' | 'protected' | 'unknown' | 'missing');
      },
      policy: async (chapter) => {
        const data = (await this.request('manga.cache.classify', selector(chapter))).data;
        const lastReadAt = data['lastReadAt'];
        if (typeof data['inUse'] !== 'boolean' || (lastReadAt !== null && !Number.isSafeInteger(lastReadAt)))
          throw new Error('MANGA_CACHE_POLICY_UNAVAILABLE');
        return { status: data['status'] as 'cache' | 'download' | 'protected' | 'unknown' | 'missing',
          inUse: data['inUse'] as boolean, lastReadAt: lastReadAt as number | null };
      },
      policyBatch: async (chapters) => {
        const response = await this.request('manga.cache.classifyBatch', { versions: chapters.map((chapter) => ({
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
      candidates: async (reason, scope) => {
        const data = (await this.request('manga.cache.evict', { nowSeconds: Math.floor(Date.now() / 1000),
          ttlSeconds: reason === 'expiry' ? 7 * 24 * 60 * 60 : 0 })).data;
        return (data['candidates'] as JsonObject[]).map(value => {
          const chapter = value['chapter'] as JsonObject;
          return { sourceId: chapter['sourceId'] as string, bookId: chapter['bookId'] as string,
            chapterId: chapter['chapterId'] as string, contentVersion: value['manifestVersion'] as string };
        }).filter(chapter => scope === undefined || (chapter.sourceId === scope.sourceId && chapter.bookId === scope.bookId));
      },
      claim: async (chapter, expiry) => {
        const grant = (await this.request('manga.cache.eviction.claim', { ...selector(chapter), ...(expiry ?? {}) })).data['grant'];
        return grant === null ? undefined : projectGrant(grant as JsonObject);
      },
      complete: async (grant, removed): Promise<void> => { await this.request('manga.cache.eviction.complete', { token: grant.grantToken, removed }); },
      pending: async () => ((await this.request('manga.cache.eviction.pending')).data['grants'] as JsonObject[]).map(projectGrant),
    });
    const body = ReadingBodyImageHost.instance;
    body.configureMangaDisplayCache(this.host.getContext().filesDir);
    this.readingImageDiskCache.setMangaExternalStorage({
      inventory: () => body.mangaDisplayInventory(),
      remove: (grant, files) => body.removeMangaDisplay(grant, files),
      removeDerived: (chapter, files, current) => body.removeMangaDerived(chapter, files, current),
    });
    body.setMangaDisplayReserve((chapter, bytes, priority) =>
      this.readingImageDiskCache.reserveExternalWrite(chapter, bytes, priority === 'foreground' ? 'foreground' : 'background', 'derived'));
  }

  static install(context: common.UIAbilityContext, disableOptionalEntryMemory: boolean = false,
    mangaOfflineScope?: MangaOfflineProbeScope, mangaReadingScope?: MangaOfflineProbeScope,
    mangaSelectionMode?: MangaProbeSelectionMode): ReaderRuntimeOwner {
    const current = ReaderRuntimeOwner.instance;
    if (current === undefined || current.state === 'closing' || current.state === 'closed') {
      const predecessorClose = current?.closeTask ?? Promise.resolve();
      ReaderRuntimeOwner.instance = new ReaderRuntimeOwner(context, predecessorClose, disableOptionalEntryMemory, mangaOfflineScope, mangaReadingScope, mangaSelectionMode);
      if (disableOptionalEntryMemory) ReaderRuntimeOwner.instance.releaseOptionalReadingEntryMemory();
    } else current.mangaOfflineProbe?.release('ability-reinstalled');
    ReaderRuntimeOwner.instance.abilityLeases += 1;
    return ReaderRuntimeOwner.instance;
  }

  /** Identity-only admission for late callbacks. Teardown means false; callers
   * that require an installed owner still use the throwing current() getter. */
  static isCurrent(owner: ReaderRuntimeOwner): boolean {
    return ReaderRuntimeOwner.instance === owner;
  }

  selectMangaOfflineProbe(sourceId: string, bookId: string, manga: boolean): void {
    this.mangaOfflineProbe?.select(sourceId, bookId, manga);
  }
  mangaOfflineProbeFor(sourceId: string, bookId: string): boolean { return this.mangaOfflineProbe?.matches(sourceId, bookId) === true; }
  mangaOfflineProbeProtectsAutomaticCatalog(sourceId: string, bookId: string): boolean {
    return this.mangaOfflineProbe?.protectsAutomaticCatalog(sourceId, bookId) === true;
  }
  subscribeMangaOfflineProbe(listener: (state: string) => void): () => void {
    return this.mangaOfflineProbe?.subscribe(listener) ?? ((): void => {});
  }
  finishMangaOfflineProbe(sourceId: string, bookId: string): void { this.mangaOfflineProbe?.finish(sourceId, bookId); }
  releaseMangaOfflineProbe(): void { this.mangaOfflineProbe?.release('ability-background'); }

  private bindMangaReadingProbe(): void {
    const probe = this.mangaOfflineProbe;
    if (probe?.mode !== 'reading') return;
    const body = ReadingBodyImageHost.instance;
    try {
      this.mangaReadingProbeBodyDetach = body.attachDiagnosticObserver((event): void => {
        const scope = this.mangaReadingProbeImageScope;
        if (scope !== undefined && this.mangaReadingProbeForeignImages === 0 && probe.observesReading(scope.sourceId, scope.bookId))
          probe.observeBody(event);
      }, true, 'debug');
      probe.bodyObserverAttached(body.diagnosticState(true, 'debug'));
      this.mangaReadingProbeReleaseDetach = probe.subscribe((): void => {
        if (!probe.readingSamplingEnabled()) this.detachMangaReadingProbe();
      });
    } catch (_) {
      this.mangaReadingProbeBodyDetach?.(); this.mangaReadingProbeBodyDetach = undefined;
      probe.bodyObserverUnavailable();
    }
  }

  private detachMangaReadingProbe(): void {
    const detach = this.mangaReadingProbeBodyDetach, unsubscribe = this.mangaReadingProbeReleaseDetach;
    this.mangaReadingProbeBodyDetach = undefined; this.mangaReadingProbeReleaseDetach = undefined;
    detach?.(); unsubscribe?.();
    if (detach !== undefined) {
      try { this.mangaOfflineProbe?.observeBodyState(ReadingBodyImageHost.instance.diagnosticState(true, 'debug')); } catch (_) {}
    }
  }

  /** Debug-only attribution around the existing operation. It owns no image
   * work, and cannot change the lane, priority, current fence or returned value. */
  private async observeMangaReadingImageWork<T>(sourceId: string, bookId: string, manga: boolean,
    run: () => Promise<T>, work?: MangaImageWork): Promise<T> {
    const probe = this.mangaOfflineProbe;
    if (probe?.mode !== 'reading' || !probe.readingSamplingEnabled()) return run();
    const target = manga && probe?.observesReading(sourceId, bookId) === true;
    if (!target) {
      this.mangaReadingProbeForeignImages++;
      if (this.mangaReadingProbeImageScope !== undefined) probe?.markReadingCoverageIncomplete('body-scope-overlap');
      try { return await run(); } finally { this.mangaReadingProbeForeignImages--; }
    }
    if (this.mangaReadingProbeForeignImages > 0) probe?.markReadingCoverageIncomplete('body-scope-overlap');
    const scope: MangaOfflineProbeScope = { sourceId, bookId };
    this.mangaReadingProbeImageScope = scope;
    const finish = (): void => {
      if (this.mangaReadingProbeImageScope !== scope) return;
      this.mangaReadingProbeImageScope = undefined;
      try { probe?.observeBodyState(ReadingBodyImageHost.instance.diagnosticState(true, 'debug')); } catch (_) {}
    };
    try { return await run(); }
    finally {
      // The original allocating lane already drains this promise. Observation
      // follows that lifetime without delaying early display publication.
      if (work?.drain === undefined) finish();
      else void work.drain.catch((): void => {}).finally(finish);
    }
  }

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
      this.downloadStorageGateway = new SharedDownloadStorageGateway(this, this.readingImageDiskCache);
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

  async configureDownloadStorage(limitMb: number, cleanupAfterDays: number): Promise<{ maintenanceMessage?: string; }> {
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
      });
      this.preparationNetwork.setForeground(foreground);
    } else if (changed) this.preparationNetwork.setForeground(foreground);
    if (changed) MangaChapterPreparationCoordinator.forRuntime(this).networkChanged();
    this.bookCoordinator?.visibilityChanged();
    this.wakeReadingPreparations();
    if (foreground && this.state === 'ready') {
      void this.getReadingRecordGateway().recover();
      this.recoverReadingProgressInBackground();
      void this.readingImageDiskCache.maintainMangaStorage('expiry').catch((error: Error): void => {
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
    return manga ? Promise.resolve() : this.readingImageDiskCache.clearChapter(sourceId, bookId, chapterIndex);
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
    for (const [sessionId, session] of this.mangaDisplaySessions ?? []) {
      if (!session.current()) this.endMangaDisplaySession(sessionId);
    }
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
      if (method === 'runtime.storage.apply' || method === 'runtime.storage.restore') {
        // Content validity was invalidated before startup/request admission.
        // Finish the old display and eviction owners before Core replaces
        // their tokens, then reconcile Host's pending physical removals.
        await MangaChapterPreparationCoordinator.forRuntime(this).close();
        await this.mangaImageTail;
        return await this.readingImageDiskCache.withMangaStorageRestore(() => runtime.request(method, params, {
          ...options, timeoutMs: options.timeoutMs ?? DEFAULT_CORE_REQUEST_TIMEOUT_MS,
        }));
      }
      const probe = this.mangaOfflineProbe;
      let result: ReaderCoreResultEvent;
      if (probe?.ownsCommand(method, params) === true && probe.assertCapacity()) {
        // SDK request is send + waitForResult. Register before any Host dispatch;
        // the Registry uses this exact id, never a URL or source-only guess.
        const requestId = runtime.send(method, params);
        probe.track(requestId, method);
        try {
          let waitOptions: RequestOptions;
          if (probe.mode === 'reading') {
            waitOptions = options.timeoutMs !== undefined ? options : {
              timeoutMs: DEFAULT_CORE_REQUEST_TIMEOUT_MS, pollMs: options.pollMs,
              hostRequest: options.hostRequest, shouldCancel: options.shouldCancel,
            };
          } else {
            waitOptions = { ...options,
              timeoutMs: options.timeoutMs ?? DEFAULT_CORE_REQUEST_TIMEOUT_MS,
              shouldCancel: (): boolean => options.shouldCancel?.() === true ||
                (method !== 'reading.progress.update' && !probe.current(requestId)),
            };
          }
          result = await runtime.waitForResult(requestId, waitOptions);
        } finally { probe.settle(requestId); }
      } else {
        result = await runtime.request(method, params, options.timeoutMs !== undefined ? options : {
          timeoutMs: DEFAULT_CORE_REQUEST_TIMEOUT_MS,
          pollMs: options.pollMs,
          hostRequest: options.hostRequest,
          shouldCancel: options.shouldCancel,
        });
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
          await this.readingImageDiskCache.clearMangaRebuildableCache(scope);
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
  async openSourceLogin(sourceId: string, loginUrl: string, sourceName: string): Promise<void> {
    await ArkWebExecutor.instance.openInteractive(
      sourceLoginPageUrl(sourceId, loginUrl),
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
    resourceRef?: string,
    mangaPosition?: number,
    expectedSourceVersion?: string,
    mangaPreview?: boolean,
    mangaDecodeRevision?: string,
    mangaDisplaySessionId?: number,
  ): Promise<ReadingBodyImagePayload> {
    this.assertReadingImageCurrent(isCurrent);
    if (resourceRef === undefined && imageUrl.trim().toLowerCase().startsWith('data:image/')) {
      await this.downloadStorageGateway?.waitForActiveMutation();
      this.assertReadingImageCurrent(isCurrent);
      const embedded = await (this.mangaOfflineProbe?.readingSamplingEnabled() === true ?
        this.observeMangaReadingImageWork(sourceId, bookId, false, () => ReadingBodyImageHost.instance.loadDataUri(imageUrl, isCurrent)) :
        ReadingBodyImageHost.instance.loadDataUri(imageUrl, isCurrent));
      return this.admitReadingImage(embedded, isCurrent);
    }
    if (sourceId === 'local' && (imageUrl.startsWith('reader-local-epub://') || imageUrl.startsWith('reader-local-mobi://'))) {
      await this.downloadStorageGateway?.waitForActiveMutation();
      this.assertReadingImageCurrent(isCurrent);
      const localImage = await (this.mangaOfflineProbe?.readingSamplingEnabled() === true ?
        this.observeMangaReadingImageWork(sourceId, bookId, false, () => this.localEpubResourceHost.load(imageUrl, isCurrent)) :
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
    const cacheCurrent = this.readingImageDiskCache.captureValidity(identity.sourceId, identity.bookId, isCurrent);
    // Once displayed, an original belongs to its exact content/storage owner,
    // rather than the temporary viewport that requested it. Capture before
    // queueing so rule changes, book clear, restore and teardown still revoke
    // its pending write; ordinary scrolling must not discard fetched bytes.
    const persistCurrent = resourceRef === undefined ? cacheCurrent :
      this.readingImageDiskCache.captureValidity(identity.sourceId, identity.bookId,
        this.captureMangaImageContentValidity(identity.sourceId, identity.bookId));
    // Capture both owners before the storage wait so clear/restore cannot
    // authorize an already queued request under a successor generation.
    await this.downloadStorageGateway?.waitForActiveMutation();
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
      if (this.mangaOfflineProbe?.readingSamplingEnabled() === true) return this.runMangaImageWork(cacheCurrent,
        (work: MangaImageWork): Promise<ReadingBodyImagePayload> => this.observeMangaReadingImageWork(sourceId, bookId, resourceRef !== undefined,
          (): Promise<ReadingBodyImagePayload> => this.loadReadingImageOwned(identity, allowNetwork, cacheCurrent,
            mangaPosition, expectedSourceVersion, mangaPreview, work, persistCurrent), work));
      return this.runMangaImageWork(cacheCurrent, (work: MangaImageWork): Promise<ReadingBodyImagePayload> =>
        this.loadReadingImageOwned(identity, allowNetwork, cacheCurrent, mangaPosition, expectedSourceVersion, mangaPreview, work, persistCurrent));
    }
    if (this.mangaOfflineProbe?.readingSamplingEnabled() === true) return this.observeMangaReadingImageWork(sourceId, bookId, false,
      (): Promise<ReadingBodyImagePayload> => this.loadReadingImageOwned(identity, allowNetwork, cacheCurrent,
        mangaPosition, expectedSourceVersion, mangaPreview));
    return this.loadReadingImageOwned(identity, allowNetwork, cacheCurrent, mangaPosition, expectedSourceVersion, mangaPreview);
  }

  /** Called only after the manga lane is acquired, or by the unchanged novel path. */
  private async loadReadingImageOwned(identity: ReadingImageCacheIdentity, allowNetwork: boolean,
    cacheCurrent: () => boolean, mangaPosition?: number, expectedSourceVersion?: string, mangaPreview?: boolean,
    work?: MangaImageWork, persistCurrent: () => boolean = cacheCurrent): Promise<ReadingBodyImagePayload> {
    let cachedBytes: Uint8Array | undefined;
    try { cachedBytes = await this.readingImageDiskCache.loadResource(identity, cacheCurrent); }
    catch (error) {
      // A previous Host's transformed payload is retained for recovery. Only
      // online preparation may replace its usability, in a new profile path.
      if (!allowNetwork || !(error instanceof Error)) throw error;
      if (error.message === 'MANGA_CACHE_RESOURCE_CORRUPT') {
        await this.readingImageDiskCache.removeResource(identity, cacheCurrent);
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
        await this.readingImageDiskCache.removeResource(identity, cacheCurrent);
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
    const stored = this.readingImageDiskCache.storeResource(identity, bytes, persistCurrent)
      .catch((error: Error): void => {
        hilog.error(LOG_DOMAIN, 'Reader', 'Reader body image cache write failed: %{private}s', error.message);
      });
    // The first image can paint now; only this operation's retained cache bytes
    // keep the manga lane occupied. Unrelated disk-cache writes are not joined.
    if (work !== undefined) work.drain = stored;
    return admitted;
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
      this.captureMangaImageContentValidity(ownedIdentity.sourceId, ownedIdentity.bookId);
    const cacheCurrent = this.readingImageDiskCache.captureValidity(ownedIdentity.sourceId, ownedIdentity.bookId,
      (): boolean => isCurrent?.() !== false && contentCurrent?.() !== false);
    await this.downloadStorageGateway?.waitForActiveMutation();
    this.assertReadingImageCurrent(cacheCurrent);
    if (ownedIdentity.resourceRef !== undefined) {
      // Capture the cache generation before waiting: a queued request cannot
      // become current again after a book clear or owner teardown.
      if (this.mangaOfflineProbe?.readingSamplingEnabled() === true) return this.runMangaImageWork(cacheCurrent,
        (): Promise<void> => this.observeMangaReadingImageWork(ownedIdentity.sourceId, ownedIdentity.bookId, true,
          (): Promise<void> => this.prefetchReadingImageOwned(ownedIdentity, cacheCurrent, expectedSourceVersion, allowNetwork, priority)), priority);
      return this.runMangaImageWork(cacheCurrent, (): Promise<void> =>
        this.prefetchReadingImageOwned(ownedIdentity, cacheCurrent, expectedSourceVersion, allowNetwork, priority), priority);
    }
    if (this.mangaOfflineProbe?.readingSamplingEnabled() === true) return this.observeMangaReadingImageWork(
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
    try { cachedBytes = await this.readingImageDiskCache.loadResource(identity, cacheCurrent); }
    catch (error) {
      // A previous Host's transformed payload is retained for recovery. Only
      // online preparation may replace its usability, in a new profile path.
      if (!allowNetwork || !(error instanceof Error)) throw error;
      if (error.message === 'MANGA_CACHE_RESOURCE_CORRUPT') {
        await this.readingImageDiskCache.removeResource(identity, cacheCurrent);
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
        await this.readingImageDiskCache.removeResource(identity, cacheCurrent);
      }
    }
    if (!allowNetwork) throw new Error('REMOTE_READING_IMAGE_NOT_DOWNLOADED');
    const bytes = await this.prepareReadingImageBytes(identity, cacheCurrent, expectedSourceVersion);
    if (identity.resourceRef === undefined) await ReadingBodyImageHost.instance.validateBytes(bytes, cacheCurrent);
    else await ReadingBodyImageHost.instance.prepareMangaDisplay(bytes, this.mangaStorageChapter(identity), cacheCurrent, priority, onPrepared);
    this.assertReadingImageCurrent(cacheCurrent);
    await this.readingImageDiskCache.storeResource(identity, bytes, cacheCurrent);
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
    const contentCurrent = this.captureMangaImageContentValidity(scope.sourceId, scope.bookId);
    const storageCurrent = this.readingImageDiskCache.captureValidity(scope.sourceId, scope.bookId, contentCurrent);
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
      }, (params: JsonObject): Promise<ReaderCoreResultEvent> => this.request('manga.resource.prepare', params,
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
    const current = this.readingImageDiskCache.captureValidity(chapter.sourceId, chapter.bookId, isCurrent);
    if (resources.some(resource => resource.resourceRef !== undefined)) {
      const ownedChapter: ReadingImageChapterIdentity = { ...chapter, priority: 'background' };
      const ownedResources: ReadingImageCacheIdentity[] = resources.map(resource => ({ ...resource, priority: 'background' }));
      // Acquire the image lane before the existing per-book mutation lock.
      // Digest reads own encoded bytes too; DiskCache never reenters this lane.
      return this.runMangaImageWork(current, (): Promise<void> =>
        this.readingImageDiskCache.markChapterComplete(ownedChapter, ownedResources, current));
    }
    await this.readingImageDiskCache.markChapterComplete(chapter, resources, current);
  }

  async isOfflineImageChapterComplete(chapter: ReadingImageChapterIdentity, manga: boolean = false,
    isCurrent?: () => boolean): Promise<boolean> {
    if (manga) {
      if (chapter.mangaDecodeRevision !== 'identity-v1' && chapter.mangaDecodeRevision !== 'bytes-v1') throw new Error('MANGA_CACHE_PROFILE_REQUIRED');
      const ownedChapter: ReadingImageChapterIdentity = { ...chapter };
      const current = this.readingImageDiskCache.captureValidity(chapter.sourceId, chapter.bookId, isCurrent);
      return this.runMangaImageWork(current, async (): Promise<boolean> => {
        const complete = await this.readingImageDiskCache.isChapterComplete(ownedChapter);
        this.assertReadingImageCurrent(current);
        return complete;
      });
    }
    return this.readingImageDiskCache.isChapterComplete(chapter);
  }

  async isOfflineImageChapterMaterialized(
    sourceId: string,
    bookId: string,
    chapterIndex: number,
  ): Promise<boolean> {
    return this.readingImageDiskCache.isChapterMaterialized(sourceId, bookId, chapterIndex);
  }

  async clearOfflineBookImages(sourceId: string, bookId: string, manga: boolean = false): Promise<void> {
    for (const [sessionId, session] of this.mangaDisplaySessions ?? []) {
      if (session.scope.sourceId === sourceId && session.scope.bookId === bookId) this.endMangaDisplaySession(sessionId);
    }
    await this.readingImageDiskCache.clearBook(sourceId, bookId, manga);
  }

  async listMangaDownloadChapters(sourceId: string, bookId: string, isCurrent?: () => boolean):
    Promise<Array<{ sourceId: string; bookId: string; chapterId: string; }>> {
    return this.readingImageDiskCache.listMangaDownloadChapters(sourceId, bookId, isCurrent);
  }

  async listMangaDownloadVersions(chapter: { sourceId: string; bookId: string; chapterId: string; },
    isCurrent?: () => boolean): Promise<string[]> {
    return this.readingImageDiskCache.listMangaDownloadVersions(chapter, isCurrent);
  }

  async deleteMangaDownload(chapter: { sourceId: string; bookId: string; chapterId: string; },
    manifestVersion: string, isCurrent?: () => boolean): Promise<boolean> {
    return this.readingImageDiskCache.deleteMangaVersion({ ...chapter, contentVersion: manifestVersion }, isCurrent);
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

  async prepareSystemLocalBookInput(uri: string): Promise<LocalBookPreparation> {
    if (this.state === 'closing' || this.state === 'closed') {
      throw new Error('Reader Host is no longer available after teardown');
    }
    return this.host.prepareSystemLocalBookInput(uri);
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
    this.mangaOfflineProbe?.release('runtime-close');
    this.preparationForeground = false;
    this.preparationNetwork?.close();
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
      this.readingImageDiskCache.close();
      await this.closeRuntime();
    }
    if (downloadFailure !== undefined) throw downloadFailure;
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
    let ttsCloseTask: Promise<void> | undefined = undefined;
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
      const drained = await Promise.allSettled([this.sourceSupplyTask, this.importFinalizeTask, this.mangaImageTail,
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
        ttsCloseTask = this.ttsHost.close();
        await ttsCloseTask;
      } finally {
        await this.quiesceHostFilesForLibraryRestore();
        const runtime = this.runtime;
        this.runtime = undefined;
        if (runtime !== undefined) {
          try {
            // The selected apply may have committed while its ACK was lost.
            // Retire that captured Core directly; no late old-owner flush may
            // borrow the replacement metadata writer's authority.
            if (!this.libraryRestoreApplyDispatched)
              await runtime.request('runtime.storage.flush', {}, { timeoutMs: 30000 });
          } finally {
            this.host?.setResponseAssetBridge(undefined);
            runtime.close();
          }
        }
      }
    } finally {
      try {
        // Earlier domain/flush failure must still stop audio and physical IO.
        if (ttsCloseTask === undefined) ttsCloseTask = this.ttsHost.close();
        await ttsCloseTask;
      } finally {
        try {
          await this.quiesceHostFilesForLibraryRestore();
        } finally {
          const runtime = this.runtime;
          this.runtime = undefined;
          this.host.setResponseAssetBridge(undefined);
          runtime?.close();
          this.state = 'closed';
          if (ReaderRuntimeOwner.instance === this) ReaderRuntimeOwner.instance = undefined;
        }
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

  private async requireStorageProbeIdentity(probe: ReaderCoreStorageProbe, current: () => boolean): Promise<void> {
    const raw = await this.host.readBundledRawFileText('reader-core-storage-identity.v1.json');
    if (!current() || raw.length > 4096) throw new Error('STORAGE_BOOTSTRAP_IDENTITY_RETIRED');
    const expected = JSON.parse(raw) as JsonObject;
    const hashes = ['buildId', 'contractSha256', 'coreInputFingerprint'];
    if (Object.keys(expected).length !== 5 || expected['format'] !== 'reader.storage-bootstrap-identity' || expected['version'] !== 1 ||
      !hashes.every((key: string): boolean => typeof expected[key] === 'string' && /^[0-9a-f]{64}$/.test(expected[key] as string)) ||
      expected['buildId'] !== probe.buildIdentity['buildId'] || expected['contractSha256'] !== probe.contractSha256 ||
      expected['coreInputFingerprint'] !== probe.coreInputFingerprint) throw new Error('STORAGE_BOOTSTRAP_IDENTITY_MISMATCH');
    if (!current()) throw new Error('STORAGE_BOOTSTRAP_IDENTITY_RETIRED');
    // Only compiled identity and admission classification are diagnostic data.
    // This does not claim that Host has hashed the loaded Native library.
    const receipt = JSON.stringify({ schemaVersion: 1, buildId: expected['buildId'], contractSha256: expected['contractSha256'],
      coreInputFingerprint: expected['coreInputFingerprint'], matched: true });
    hilog.info(LOG_DOMAIN, 'Reader', 'Storage bootstrap identity: %{public}s', receipt);
    ReaderStartupTrace.current()?.mark('startup.storage-identity', 'matched');
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
    let storageProbe: ReaderCoreStorageProbe;
    const isCurrent = (): boolean => this.state === 'starting' && ReaderRuntimeOwner.isCurrent(this);
    try {
      storageProbe = await ReaderStartupTrace.measure('startup.storage-admission',
        (): Promise<ReaderCoreStorageProbe> => probeReaderCoreStorageAsync(
          `${this.host.getContext().filesDir}/reader-core`, isCurrent));
      if (!isCurrent()) throw new Error('Reader Core startup cancelled after storage admission');
      this.requireCoreBuildIdentity(storageProbe.buildIdentity);
      await this.requireStorageProbeIdentity(storageProbe, isCurrent);
      const startupConfig: JsonObject = { dataDirectory: `${this.host.getContext().filesDir}/reader-core` };
      // Core owns the maintenance plan and revalidates it before migration.
      // Forward its exact observation only after the existing identity gates.
      if (storageProbe.observation.requiresMigration && storageProbe.observation.explicitMigration !== null) {
        startupConfig['storageMigration'] = storageProbe.observation.explicitMigration;
      }
      runtime = await ReaderStartupTrace.measure('startup.native-open', (): Promise<ReaderCoreRuntime> => createReaderCoreRuntimeAsync(startupConfig, isCurrent));
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
      await this.negotiateCoreCapabilities(runtime, coreInfo.data);
      const buildIdentity = this.requireCoreBuildIdentity(coreInfo.data['buildIdentity']);
      if (buildIdentity.buildId !== storageProbe.buildIdentity['buildId']) {
        throw new Error('Reader Core build changed after storage admission');
      }
      if (this.supportsCoreCapability('host.http.timeout.v1')) {
        hostCapabilities['extensions'] = ['http.execute.timeoutMs.v1'];
        await runtime.request('runtime.setHostCapabilities', hostCapabilities, { timeoutMs: 5000 });
      }
      hilog.info(LOG_DOMAIN, 'Reader', 'Core build identity: %{public}s', JSON.stringify(buildIdentity));
      const restoredMetadata = await ReaderStartupTrace.measure('startup.library-restore-reconciliation',
        (): Promise<boolean> => this.reconcileLibraryRestoreBeforeReady(runtime));
      if (!isCurrent()) throw new Error('Reader Core startup cancelled after restore reconciliation');
      this.initializePlatformStorage();
      await this.host.beginLocalBookStageRecovery();
      if (startupReads[1] && !restoredMetadata) {
        await ReaderStartupTrace.measure('startup.legacy-restore', (): Promise<ReaderCoreResultEvent> =>
          runtime.request('runtime.storage.restore', {}, { timeoutMs: 30000 }));
        await ReaderStartupTrace.measure('startup.legacy-marker-write', (): Promise<void> =>
          this.host.markLegacySnapshotMigrated());
      }
      // Recovery remains convergence, not readiness: a stale, conflicting or
      // slow journal must never deny the durable shelf. Wait only a bounded
      // grace, then publish while the attempt stays observable for an explicit
      // retry and a later shelf refresh.
      await ReaderStartupTrace.measure('startup.source-switch-grace',
        (): Promise<void> => this.recoverSourceSwitchAtStartup(runtime));
      // `close()` may have begun while Host capability setup/restore awaited.
      // Never publish a ready runtime after teardown has claimed this owner.
      if (this.state !== 'starting') {
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
    if (this.supportsCoreCapability('source.supply.v1')) {
      return supplyBundledSources({
        digest: BUNDLED_RAW_FILE_SHA256,
        read: (file: string): Promise<string> => this.host.readBundledRawFileText(file),
        request: (params: JsonObject): Promise<ReaderCoreResultEvent> => this.request('source.supply', params, { timeoutMs: 30000 }),
        legacyIds: async (): Promise<string[]> => (await BundledSourceLedger.load(this.host.getContext())).persistedSourceIds(),
        current: (): boolean => this.state === 'ready',
        failure: (sourceId: string, error: Error): void => {
          hilog.error(LOG_DOMAIN, 'Reader', 'Incremental bundled source failed: %{private}s %{private}s', sourceId, errorMessageOf(error));
        },
      });
    }
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
          await this.importBundledSource(sourceId, bundled);
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
          bundledVersion, bundledFingerprint, existing, storedActualFingerprint, bundled);
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
        const importedSource: JsonObject =
          mergeBundledDefaultStateCorrection(bundled, existing, storedActualFingerprint) ?? { ...bundled };
        delete importedSource['readerBuiltinWithdrawn'];
        delete importedSource['readerTestBuiltinWithdrawn'];
        const metadataCorrection = (bundled['provenance'] as JsonObject | undefined)?.['metadataCorrection'] as JsonObject | undefined;
        const contentCorrection = (bundled['provenance'] as JsonObject | undefined)?.['contentCorrection'] as JsonObject | undefined;
        if (metadataCorrection?.['preserveExploreRules'] === true || contentCorrection?.['preserveExploreRules'] === true) {
          // These targeted revisions do not own discovery rules. They are
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
        await this.importBundledSource(sourceId, importedSource);
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
      await this.importBundledSource(entry.sourceId, retired);
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
    sourceId: string,
    bookSource: JsonObject,
  ): Promise<void> {
    // Supply runs after ready and can overlap the shelf. Use the same source
    // registry/projection and reading-entry fences as a user source import.
    const imported = await this.request('source.import', {
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

  private async recoverSourceSwitchAtStartup(runtime: ReaderCoreRuntime): Promise<void> {
    this.publishSourceSwitchRecovery('recovering', true, false, 0, '');
    await this.waitForSourceSwitchRecoveryGrace(this.trackSourceSwitchRecovery(runtime));
  }

  private trackSourceSwitchRecovery(runtime: ReaderCoreRuntime): Promise<void> {
    const task = this.dispatchSourceSwitchRecovery(runtime);
    this.sourceSwitchRecoveryTask = task;
    void task.then((): void => {
      if (this.sourceSwitchRecoveryTask === task) this.sourceSwitchRecoveryTask = undefined;
    });
    return task;
  }

  private async dispatchSourceSwitchRecovery(runtime: ReaderCoreRuntime): Promise<void> {
    try {
      const recovery = await ReaderStartupTrace.measure('startup.source-switch-recovery',
        (): Promise<ReaderCoreResultEvent> => runtime.request('source.switch.recover', {}, { timeoutMs: 30000 }));
      const recoveredCount = this.requireSourceSwitchRecoveryCount(recovery.data['recovered']);
      hilog.info(LOG_DOMAIN, 'Reader', 'Core source-switch startup recovery count: %{public}d', recoveredCount);
      if (this.state !== 'ready' && this.state !== 'starting') return;
      this.publishSourceSwitchRecovery('resolved', false, false, recoveredCount, '');
    } catch (error) {
      if (this.state !== 'ready' && this.state !== 'starting') return;
      hilog.warn(LOG_DOMAIN, 'Reader',
        'Source-switch startup recovery remains pending summary=%{public}s detail=%{private}s',
        localReadFailureSummary(error), errorMessageOf(error));
      this.publishSourceSwitchRecovery('pending', false, true, 0, SOURCE_SWITCH_RECOVERY_PENDING_MESSAGE);
    }
  }

  private async waitForSourceSwitchRecoveryGrace(task: Promise<void>): Promise<void> {
    let timer: number = -1;
    const grace = new Promise<void>((resolve): void => {
      timer = setTimeout(resolve, SOURCE_SWITCH_RECOVERY_GRACE_MS);
    });
    try {
      await Promise.race([task, grace]);
    } finally {
      if (timer >= 0) clearTimeout(timer);
    }
  }

  private publishSourceSwitchRecovery(state: ReaderSourceSwitchRecoveryState, busy: boolean,
    canRetry: boolean, recovered: number, message: string): void {
    this.sourceSwitchRecoveryStatus = { state, busy, canRetry, recovered, message,
      generation: this.sourceSwitchRecoveryStatus.generation + 1 };
    const snapshot = this.sourceSwitchRecoveryStatus;
    for (const listener of this.sourceSwitchRecoveryListeners) {
      try { listener(snapshot); } catch (_) {}
    }
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
