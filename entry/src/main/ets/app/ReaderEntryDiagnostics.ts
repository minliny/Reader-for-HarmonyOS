import type { Want } from '@kit.AbilityKit';
import { hilog } from '@kit.PerformanceAnalysisKit';
import type { JsonObject } from '@reader/core-harmony';
import type { ReaderRuntimeOwner } from './ReaderRuntimeOwner';
import type { MangaOfflineProbeScope, MangaProbeSelectionMode } from './MangaOfflineNetworkProbe';
import { readerControlVerificationColdStartPage, readerDisableOptionalEntryMemory,
  readerRebuildableCacheClearEnabled, readerMangaOfflineProbeScope, readerMangaReadingProbeScope,
  readerMangaProbeSelectionMode, type ReaderColdStartPage } from './ReaderControlVerificationLaunch';
import { readerVerifyRequest, READER_VERIFY_STORAGE_KEY, type ReaderVerifyRequest } from './ReaderVerificationProtocol';
import { ReaderEventLoopProbe, readerEventLoopProbeEnabled, type ReaderEventLoopSample } from './ReaderEventLoopProbe';
import { ReaderCapacityProbe, readerCapacityProbeEnabled, type ReaderCapacityQueryOptions } from './ReaderCapacityProbe';
import { ReaderMangaPlatformDiagnostic } from './ReaderMangaPlatformDiagnostic';
import { probeReaderAtomicSnapshot, type ReaderAtomicSnapshotSample } from './ReaderAtomicSnapshotProbe';
import { probeReaderAssetInventory, type ReaderAssetInventorySample } from './ReaderAssetInventoryProbe';

const DOMAIN = 0x5244;

/** Cold diagnostic composition. Ordinary entry/recovery owns no probe instance.
 * This adapter never owns the Runtime, window, restore transaction or file Want. */
export class ReaderEntryDiagnostics {
  readonly coldStartPage: ReaderColdStartPage;
  readonly verifyRequest: ReaderVerifyRequest | undefined;
  readonly disableOptionalEntryMemory: boolean;
  readonly offlineScope: MangaOfflineProbeScope | undefined;
  readonly readingScope: MangaOfflineProbeScope | undefined;
  readonly selectionMode: MangaProbeSelectionMode | undefined;
  private readonly debug: boolean;
  private readonly mode: string;
  private readonly capacityRequested: boolean;
  private readonly atomicRequested: boolean;
  private readonly assetInventoryRequested: boolean;
  private readonly now: () => number;
  private eventLoop: ReaderEventLoopProbe | undefined = undefined;
  private capacity: ReaderCapacityProbe | undefined = undefined;
  private manga: ReaderMangaPlatformDiagnostic | undefined = undefined;

  static forColdStart(debug: boolean, mode: string, want: Want, now: () => number): ReaderEntryDiagnostics | undefined {
    const verifyRequest = readerVerifyRequest(debug, mode, want.parameters?.readerVerifyScene,
      want.parameters?.readerVerifyWidth, want.parameters?.readerVerifyRun,
      [want.parameters?.readerControlMotionVerification, want.parameters?.readerOpenSourcePilot,
        want.parameters?.readerStartupMainLoadFailure, want.parameters?.readerEventLoopProbe,
        want.parameters?.readerDisableOptionalEntryMemory, want.parameters?.readerMangaOfflineProbe,
        want.parameters?.readerMangaReadingProbe, want.parameters?.readerAtomicSnapshotProbe,
        want.parameters?.readerAssetInventoryProbe, want.parameters?.readerCapacityTrace]);
    const page = readerControlVerificationColdStartPage(debug, mode,
      want.parameters?.readerControlMotionVerification, want.parameters?.readerOpenSourcePilot,
      want.parameters?.readerStartupMainLoadFailure, want.parameters?.readerVerifyScene);
    const selectedPage: ReaderColdStartPage =
      page === 'pages/ReaderPageStructureVerification' && verifyRequest === undefined ? 'pages/Index' : page;
    if (debug === true && mode === 'debug') {
      try {
        hilog.info(DOMAIN, 'Reader', 'READER_COLD_ROUTE %{public}s', JSON.stringify({
          generatedDebug: debug, generatedBuildMode: mode, selectedPage,
          verifySceneType: typeof want.parameters?.readerVerifyScene,
          verifySceneAccepted: verifyRequest !== undefined,
          motionType: typeof want.parameters?.readerControlMotionVerification,
          motionExactTrue: want.parameters?.readerControlMotionVerification === true,
          rendererType: typeof want.parameters?.readerOpenSourcePilot,
          rendererExactTrue: want.parameters?.readerOpenSourcePilot === true,
          mainLoadFailureType: typeof want.parameters?.readerStartupMainLoadFailure,
          mainLoadFailureExactTrue: want.parameters?.readerStartupMainLoadFailure === true,
        }));
      } catch (_error) { /* Diagnostic delivery cannot change route admission. */ }
    }
    if (debug !== true || mode !== 'debug') return undefined;
    const selectFlag = want.parameters?.readerMangaOfflineProbeSelectManga === true ||
      want.parameters?.readerMangaReadingProbeSelectManga === true;
    const selection = selectedPage === 'pages/Index' ? readerMangaProbeSelectionMode(debug, mode,
      want.parameters?.readerMangaOfflineProbeSelectManga, want.parameters?.readerMangaReadingProbeSelectManga,
      [want.parameters?.readerMangaOfflineProbe, want.parameters?.readerMangaReadingProbe,
        want.parameters?.readerControlMotionVerification, want.parameters?.readerOpenSourcePilot,
        want.parameters?.readerEventLoopProbe, want.parameters?.readerDisableOptionalEntryMemory]) : undefined;
    const offline = selectedPage === 'pages/Index' ? readerMangaOfflineProbeScope(debug, mode,
      want.parameters?.readerMangaOfflineProbe, want.parameters?.readerMangaOfflineSourceId,
      want.parameters?.readerMangaOfflineBookId, selectFlag ? true : want.parameters?.readerMangaReadingProbe) : undefined;
    const reading = selectedPage === 'pages/Index' ? readerMangaReadingProbeScope(debug, mode,
      want.parameters?.readerMangaReadingProbe, want.parameters?.readerMangaOfflineSourceId,
      want.parameters?.readerMangaOfflineBookId, selectFlag ? true : want.parameters?.readerMangaOfflineProbe) : undefined;
    const disableMemory = readerDisableOptionalEntryMemory(debug, mode, want.parameters?.readerDisableOptionalEntryMemory);
    if (selectedPage === 'pages/Index' && !disableMemory && offline === undefined && reading === undefined && selection === undefined &&
      !readerEventLoopProbeEnabled(debug, mode, want.parameters?.readerEventLoopProbe) &&
      !readerCapacityProbeEnabled(debug, mode, want.parameters?.readerCapacityTrace) &&
      want.parameters?.readerAtomicSnapshotProbe !== true && want.parameters?.readerAssetInventoryProbe !== true) return undefined;
    return new ReaderEntryDiagnostics(debug, mode, want, now, selectedPage, verifyRequest, disableMemory, offline, reading, selection);
  }

  private constructor(debug: boolean, mode: string, want: Want, now: () => number, page: ReaderColdStartPage,
    verifyRequest: ReaderVerifyRequest | undefined,
    disableMemory: boolean, offline: MangaOfflineProbeScope | undefined, reading: MangaOfflineProbeScope | undefined,
    selection: MangaProbeSelectionMode | undefined) {
    this.debug = debug; this.mode = mode; this.now = now;
    this.capacityRequested = want.parameters?.readerCapacityTrace === true;
    this.atomicRequested = want.parameters?.readerAtomicSnapshotProbe === true;
    this.assetInventoryRequested = want.parameters?.readerAssetInventoryProbe === true;
    this.coldStartPage = page; this.verifyRequest = verifyRequest; this.disableOptionalEntryMemory = disableMemory;
    this.offlineScope = offline; this.readingScope = reading; this.selectionMode = selection;
    if (verifyRequest !== undefined) AppStorage.setOrCreate(READER_VERIFY_STORAGE_KEY, verifyRequest);
    else AppStorage.delete(READER_VERIFY_STORAGE_KEY);
    if (readerEventLoopProbeEnabled(debug, mode, want.parameters?.readerEventLoopProbe)) {
      this.eventLoop = new ReaderEventLoopProbe(now, (sample: ReaderEventLoopSample): void => {
        hilog.info(DOMAIN, 'Reader', 'READER_EVENT_LOOP %{public}s', JSON.stringify(sample));
      });
    }
    this.manga = ReaderMangaPlatformDiagnostic.install(selection, want.parameters?.readerMangaRecordedJankR31 === true);
  }

  bindOwner(owner: ReaderRuntimeOwner, current: () => boolean): void {
    if (readerCapacityProbeEnabled(this.debug, this.mode, this.capacityRequested)) {
      this.capacity = ReaderCapacityProbe.create(this.debug, this.mode, this.capacityRequested,
        async (method: string, params: JsonObject, options: ReaderCapacityQueryOptions): Promise<JsonObject> =>
          (await owner.request(method, params, options)).data, current);
    }
  }

  afterRecovery(recovery: Promise<void>, filesDir: string, current: () => boolean): void {
    if (this.atomicRequested) {
      void recovery.then((): Promise<void> => probeReaderAtomicSnapshot(this.debug, this.mode,
        true, filesDir, current, this.now, (sample: ReaderAtomicSnapshotSample): void => {
          hilog.info(DOMAIN, 'Reader', 'READER_ATOMIC_SNAPSHOT %{public}s', JSON.stringify(sample));
        })).catch((): void => {});
    }
    if (this.assetInventoryRequested) {
      void recovery.then((): Promise<void> => probeReaderAssetInventory(this.debug, this.mode,
        true, current, this.now, (sample: ReaderAssetInventorySample): void => {
          hilog.info(DOMAIN, 'Reader', 'READER_ASSET_INVENTORY %{public}s', JSON.stringify(sample));
        })).catch((): void => {});
    }
  }

  start(): void { this.startEventLoop(); this.capacity?.start(); }
  startEventLoop(): void { this.eventLoop?.start(); }
  stop(reason: string): void { this.eventLoop?.stop(reason); this.capacity?.stop(); }
  close(): void { this.manga?.stop(); this.manga = undefined; this.stop('destroyed'); }

  /** Explicit warm cache maintenance stays independent of cold route/probe
   * admission. It awaits the same recovery and exact Runtime identity. */
  static scheduleCacheClear(debug: boolean, mode: string, want: Want, owner: ReaderRuntimeOwner | undefined,
    recovery: Promise<void>, current: () => boolean): void {
    if (owner === undefined || !readerRebuildableCacheClearEnabled(debug, mode, want.parameters?.readerClearRebuildableCache)) return;
    void recovery.then(async (): Promise<void> => {
      if (!current()) return;
      try {
        const result = await owner.clearRebuildableCachesForVerification();
        hilog.info(DOMAIN, 'Reader', 'READER_VM_CACHE_CLEAR %{public}s', JSON.stringify({
          result: 'completed', ordinaryBytes: result.ordinaryBytes, derivedDisplayFiles: result.derivedDisplayFiles,
          remainingAutomaticBytes: result.ordinaryBytes, removedContentBytes: result.removedContentBytes,
          deletedBytes: result.deletedBytes, deletedFiles: result.deletedFiles,
          preserved: ['downloads', 'manifests', 'bookshelf', 'progress', 'active-leases'],
        }));
      } catch (error) {
        hilog.error(DOMAIN, 'Reader', 'READER_VM_CACHE_CLEAR %{public}s', JSON.stringify({ result: 'failed', error: (error as Error).message }));
      }
    }).catch((error: Error): void => {
      hilog.error(DOMAIN, 'Reader', 'READER_VM_CACHE_CLEAR %{public}s', JSON.stringify({ result: 'recovery-failed', error: error.message }));
    });
  }
}
