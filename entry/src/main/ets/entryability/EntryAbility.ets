import { prepareReaderShelfFonts, prepareReaderFontFamily } from '../ui/foundation/ReaderFonts';
import { readerAppearanceSnapshotFontFamily } from '../features/reading/ui/ReaderAppearanceRenderStyle';
import { setReaderAppearanceFont, type ReaderAppearanceSnapshot } from '../features/reading/application/ReaderAppearanceState';
import { ReaderCustomFontHost } from '../app/ReaderCustomFontHost';
import { ReaderSettingsGateway } from '../features/reading/application/ReaderSettingsGateway';
import { SyncGateway } from '../features/sync/application/SyncGateway';
import { LocalConfigurationReset } from '../features/settings/application/LocalConfigurationReset';
import { ReaderThemeHost } from '../app/ReaderThemeHost';
import { ReaderNavigationAppearancePreferences } from '../app/ReaderNavigationAppearancePreferences';
import { AbilityConstant, ConfigurationConstant, type Configuration, UIAbility, Want } from '@kit.AbilityKit';
import contextConstant from '@ohos.app.ability.contextConstant';
import fileIo from '@ohos.file.fs';
import { window } from '@kit.ArkUI';
import { hilog } from '@kit.PerformanceAnalysisKit';
import { ReaderRuntimeOwner } from '../app/ReaderRuntimeOwner';
import { errorMessageOf, localReadFailureSummary } from '../app/ErrorMessage';
import { ReaderStartupContentOwner } from '../app/ReaderStartupContentOwner';
import { installMangaAtomicPayloadReader } from '../platform/reading-resources/MangaAtomicPayloadReader';
import { ReaderSystemFileOpenHost } from '../app/composition/system-open/ReaderSystemFileOpenHost';
import { ReaderWindowCoordinator } from '../app/ReaderWindowCoordinator';
import { ReaderDocumentPickerActivity } from '../platform/ReaderDocumentPickerActivity';
import { readerControlVerificationColdStartPage, readerDisableOptionalEntryMemory, readerRebuildableCacheClearEnabled, readerMangaOfflineProbeScope, readerMangaReadingProbeScope, readerMangaProbeSelectionMode } from '../app/ReaderControlVerificationLaunch';
import { ReaderEventLoopProbe, ReaderEventLoopSample, readerEventLoopProbeEnabled } from '../app/ReaderEventLoopProbe';
import { probeReaderAtomicSnapshot, type ReaderAtomicSnapshotSample } from '../app/ReaderAtomicSnapshotProbe';
import { probeReaderAssetInventory, type ReaderAssetInventorySample } from '../app/ReaderAssetInventoryProbe';
import { probeReaderCoreCopy, readerCoreCopyOnlyEnabled, type ReaderCoreCopyProbeSample } from '../app/diagnostics/ReaderCoreCopyProbe';
import { ReaderMangaPlatformDiagnostic } from '../app/ReaderMangaPlatformDiagnostic';
import { ReaderStartupTrace, type ReaderStartupSample } from '../app/ReaderStartupTrace';
import { ReaderCapacityProbe, type ReaderCapacityQueryOptions } from '../app/ReaderCapacityProbe';
import type { JsonObject } from '@reader/core-harmony';
import { readerMotionNowMs } from '../ui/foundation/ReaderMotionClock';
import { DEBUG, BUILD_MODE_NAME } from '../../../../build/default/generated/profile/default/BuildProfile';
import { WebDavCredentialStore } from '../features/sync/application/WebDavCredentialStore';
import { ReaderFrameworkCapture } from '../app/diagnostics/ReaderFrameworkCapture';
import { ReaderAppearancePixelProbe } from '../app/diagnostics/ReaderAppearancePixelProbe';
import { ReaderUIVerificationProbe } from '../app/diagnostics/ReaderUIVerificationProbe';
import { bindReaderNamedPublicStorage, buildReaderPublicFixtureDirectory, isReaderNamedPublicFixture,
  READER_PUBLIC_FIXTURE_PARAMETER, readerHostCacheDirectory, readerHostFilesDirectory, selectReaderPublicFixture,
  type ReaderPublicFixtureId, type ReaderPublicFixtureScope } from '../app/diagnostics/ReaderPublicFixtureScope';
import { prepareReaderPublicLongBook, prepareReaderPublicScrolledBooks } from '../app/diagnostics/ReaderPublicLongBook';
import { prepareReaderPublicSingleSource } from '../app/diagnostics/ReaderPublicSingleSource';
import { prepareReaderPublicSourceRecipe } from '../app/diagnostics/ReaderPublicSourceRecipe';
import { readerPublicSearchHttpFixtureMode } from '../app/diagnostics/ReaderPublicSearchHttpFixture';
import { CookieSessionStore } from '../platform/network/CookieSessionStore';
import { ArkWebExecutor } from '../platform/network/ArkWebExecutor';
const DOMAIN = 0x5244;

export default class EntryAbility extends UIAbility {
  private static dataMode: 'normal' | ReaderPublicFixtureId | undefined = undefined;
  private publicFixture: ReaderPublicFixtureScope | undefined = undefined;
  private fixtureAdmissionRejected: boolean = false;
  private windowStageGeneration: number = 0;
  private readonly frameworkCapture: ReaderFrameworkCapture = new ReaderFrameworkCapture();
  private cancelAppearancePixelProbe: (() => void) | undefined = undefined;
  private activeWindowStage: window.WindowStage | undefined = undefined;
  private coreCopyProbeGeneration: number = 0;
  private coreCopyOnly: boolean = false;
  private startupContent: ReaderStartupContentOwner | undefined = undefined;
  private coldStartPage: string = 'pages/Index';
  private runtimeOwner: ReaderRuntimeOwner | undefined = undefined;
  private themeReady: Promise<void> = Promise.resolve();
  private recoveryReady: Promise<void> = Promise.resolve();
  private bookshelfModeReady: Promise<void> = Promise.resolve();
  private shelfFontsReady: Promise<void> = Promise.resolve();
  private eventLoopProbe: ReaderEventLoopProbe | undefined = undefined;
  private capacityProbe: ReaderCapacityProbe | undefined = undefined;
  private mangaPlatformDiagnostic: ReaderMangaPlatformDiagnostic | undefined = undefined;
  private preparedReadingFontOwner: ReaderRuntimeOwner | undefined = undefined;
  private preparedReadingFontSnapshot: ReaderAppearanceSnapshot | undefined = undefined;

  onCreate(want: Want, _launchParam: AbilityConstant.LaunchParam): void {
    try {
      this.admitPublicFixture(want.parameters);
    } catch (_) {
      this.fixtureAdmissionRejected = true;
      hilog.error(DOMAIN, 'Reader', 'Public UI fixture directory could not be isolated');
      void this.context.terminateSelf().catch((): void => {});
      return;
    }
    // Fixture starts always take the ordinary Index route and cannot arm
    // independent privileged startup diagnostics or accept an external file.
    const parameters = this.publicFixture === undefined ? want.parameters : undefined;
    const coreCopyProbeGeneration = ++this.coreCopyProbeGeneration;
    this.coreCopyOnly = readerCoreCopyOnlyEnabled(DEBUG, BUILD_MODE_NAME, parameters?.readerCoreCopyProbe,
      parameters?.readerCoreCopyOnly, parameters?.readerCoreCopyMode, parameters?.readerCoreCopyId);
    if (this.coreCopyOnly) {
      hilog.info(DOMAIN, 'Reader', 'READER_CORE_COPY_ONLY mainRuntime=disabled');
      void probeReaderCoreCopy(DEBUG, BUILD_MODE_NAME, true, parameters?.readerCoreCopyMode,
        parameters?.readerCoreCopyId, this.context.filesDir,
        (): boolean => this.coreCopyOnly && this.coreCopyProbeGeneration === coreCopyProbeGeneration,
        (sample: ReaderCoreCopyProbeSample): void => hilog.info(DOMAIN, 'Reader',
          'READER_CORE_COPY phase=%{public}s code=%{public}s count=%{public}d', sample.phase, sample.code, sample.count))
        .catch((): void => {});
      return;
    }
    ReaderUIVerificationProbe.configure(DEBUG === true && BUILD_MODE_NAME === 'debug', this.publicFixture?.id);
    installMangaAtomicPayloadReader();
    const trace = ReaderStartupTrace.install(readerMotionNowMs, (sample: ReaderStartupSample): void => {
      hilog.info(DOMAIN, 'Reader', 'READER_STARTUP %{public}s', JSON.stringify(sample));
    }, DEBUG === true && BUILD_MODE_NAME === 'debug', parameters?.readerTtsTrace === true);
    trace.mark('ability.create');
    // Diagnostics require a cold start, debug build, and exact primitive
    // boolean parameters. Warm file Wants use the guarded import/exit queue.
    this.coldStartPage = readerControlVerificationColdStartPage(
      DEBUG,
      BUILD_MODE_NAME,
      parameters?.readerControlMotionVerification,
      parameters?.readerOpenSourcePilot,
      parameters?.readerStartupMainLoadFailure,
    );
    if (readerEventLoopProbeEnabled(DEBUG, BUILD_MODE_NAME, parameters?.readerEventLoopProbe)) {
      this.eventLoopProbe = new ReaderEventLoopProbe(readerMotionNowMs,
        (sample: ReaderEventLoopSample): void => {
          hilog.info(DOMAIN, 'Reader', 'READER_EVENT_LOOP %{public}s', JSON.stringify(sample));
        });
    }
    AppStorage.setOrCreate('readerAppForeground', true);
    ReaderDocumentPickerActivity.setForeground(true);
    if (this.publicFixture !== undefined) {
      CookieSessionStore.configurePublicFixture(this.publicFixture);
      ArkWebExecutor.instance.disableForPublicFixture();
    }
    WebDavCredentialStore.instance.attachContext(this.context, this.publicFixture);
    this.bookshelfModeReady = trace.measure('startup.bookshelf-mode',
      (): Promise<'cover' | 'list'> => WebDavCredentialStore.instance.loadBookshelfViewMode())
      .then((mode): void => {
        if (mode !== null) {
          AppStorage.setOrCreate('readerBookshelfViewMode', mode);
        }
      }).catch((): void => {});
    this.shelfFontsReady = trace.measure('startup.shelf-fonts', (): Promise<void> => prepareReaderShelfFonts());
    void this.shelfFontsReady.catch((error: Error): void => {
      hilog.error(DOMAIN, 'Reader', 'Shelf font preparation failed: %{private}s', error.message);
    });
    // Selection diagnostics have no inferred identity. Conflicting diagnostic
    // flags reject both selection modes; exact Want scope semantics stay intact.
    const mangaSelectFlag = parameters?.readerMangaOfflineProbeSelectManga === true ||
      parameters?.readerMangaReadingProbeSelectManga === true;
    const mangaSelectionMode = this.coldStartPage === 'pages/Index' ? readerMangaProbeSelectionMode(DEBUG, BUILD_MODE_NAME,
      parameters?.readerMangaOfflineProbeSelectManga, parameters?.readerMangaReadingProbeSelectManga,
      [parameters?.readerMangaOfflineProbe, parameters?.readerMangaReadingProbe,
        parameters?.readerControlMotionVerification, parameters?.readerOpenSourcePilot,
        parameters?.readerEventLoopProbe, parameters?.readerDisableOptionalEntryMemory]) : undefined;
    this.mangaPlatformDiagnostic = ReaderMangaPlatformDiagnostic.install(mangaSelectionMode,
      parameters?.readerMangaRecordedJankR31 === true);
    const owner = ReaderRuntimeOwner.install(this.context,
      readerDisableOptionalEntryMemory(DEBUG, BUILD_MODE_NAME, parameters?.readerDisableOptionalEntryMemory),
      this.coldStartPage === 'pages/Index' ? readerMangaOfflineProbeScope(DEBUG, BUILD_MODE_NAME,
        parameters?.readerMangaOfflineProbe, parameters?.readerMangaOfflineSourceId,
        parameters?.readerMangaOfflineBookId, mangaSelectFlag ? true : parameters?.readerMangaReadingProbe) : undefined,
      this.coldStartPage === 'pages/Index' ? readerMangaReadingProbeScope(DEBUG, BUILD_MODE_NAME,
        parameters?.readerMangaReadingProbe, parameters?.readerMangaOfflineSourceId,
        parameters?.readerMangaOfflineBookId, mangaSelectFlag ? true : parameters?.readerMangaOfflineProbe) : undefined,
      mangaSelectionMode, this.publicFixture);
    this.runtimeOwner = owner;
    ReaderNavigationAppearancePreferences.attach(this.context);
    if (DEBUG === true && BUILD_MODE_NAME === 'debug' && parameters?.readerCapacityTrace === true) {
      this.capacityProbe = ReaderCapacityProbe.create(DEBUG, BUILD_MODE_NAME, parameters?.readerCapacityTrace,
        async (method: string, params: JsonObject, options: ReaderCapacityQueryOptions): Promise<JsonObject> => (await owner.request(method, params, options)).data,
        (): boolean => this.runtimeOwner === owner && ReaderRuntimeOwner.isCurrent(owner));
    }
    this.themeReady = trace.measure('startup.theme', (): Promise<void> => ReaderThemeHost.install(owner,
      this.context.config.colorMode === ConfigurationConstant.ColorMode.COLOR_MODE_DARK ? 'night' : 'day'))
      .catch((error: Error): void => {
        hilog.error(DOMAIN, 'Reader', 'Theme restoration failed: %{private}s', error.message);
      });
    const sync = new SyncGateway(owner);
    ReaderThemeHost.setRecoveryBarrier(async (): Promise<void> => {
      await Promise.all([this.themeReady, this.bookshelfModeReady, owner.start()]);
      if (this.runtimeOwner !== owner) throw new Error('CONFIGURATION_OWNER_CHANGED');
      await sync.recoverInterruptedRestore();
      await LocalConfigurationReset.recover(owner);
    });
    const coreReady = trace.measure('startup.core', (): Promise<void> => owner.start());
    const fixture = this.publicFixture;
    const requiresFixtureSeed = fixture !== undefined && isReaderNamedPublicFixture(fixture.id);
    let dataReady = coreReady;
    if (fixture?.id === 'empty-sources' && want.parameters?.readerPublicFixtureBook === 'long-directory') {
      dataReady = coreReady.then(async (): Promise<void> => {
        await prepareReaderPublicLongBook(owner, fixture);
        hilog.info(DOMAIN, 'Reader', 'Public UI fixture long-directory book verified');
      });
    } else if (fixture !== undefined && requiresFixtureSeed) {
      dataReady = coreReady.then(async (): Promise<void> => {
        if (fixture.id === 'search-detail-scroll-corpus') {
          await prepareReaderPublicScrolledBooks(owner, fixture);
          hilog.info(DOMAIN, 'Reader', 'Public UI fixture empty Source and eight scroll books verified');
          return;
        }
        if (fixture.id === 'single-reserved') await prepareReaderPublicSingleSource(owner, fixture);
        else await prepareReaderPublicSourceRecipe(owner, fixture);
        await prepareReaderPublicLongBook(owner, fixture);
        if (readerPublicSearchHttpFixtureMode(fixture.id) !== undefined) owner.confirmPublicSearchHttpFixture(fixture);
        hilog.info(DOMAIN, 'Reader', 'Public UI fixture source and long-directory book verified: %{public}s', fixture.id);
      });
    }
    this.recoveryReady = Promise.all([this.themeReady, this.bookshelfModeReady, dataReady])
      .then(async (): Promise<void> => {
        if (this.runtimeOwner === owner) {
          await trace.measure('startup.sync-recovery', (): Promise<boolean> => sync.recoverInterruptedRestore());
          await trace.measure('startup.configuration-recovery', (): Promise<boolean> => LocalConfigurationReset.recover(owner));
          if (this.runtimeOwner !== owner) return;
          // Reader-only fonts can prepare after confirmed recovery without
          // withholding the bookshelf. The reader still checks the native
          // receipt before it admits text layout.
          void trace.measure('startup.selected-font-final',
            (): Promise<void> => this.prepareSelectedReadingFont(owner))
            .catch((error: Error): void => {
              hilog.error(DOMAIN, 'Reader', 'Selected reading font preparation failed: %{private}s', error.message);
            });
          await trace.measure('startup.reading-settings', async (): Promise<void> => {
            await new ReaderSettingsGateway(owner).loadAfterConfigurationRecovery(
              (): boolean => this.runtimeOwner === owner);
          });
        }
      }).catch((error: Error): void => {
        // The persistent receipt/journal remains pending; opening the UI permits retry.
        hilog.error(DOMAIN, 'Reader', 'Core or confirmed restore recovery failed summary=%{public}s detail=%{private}s',
          localReadFailureSummary(error), errorMessageOf(error));
        if (requiresFixtureSeed) throw error;
      });
    if (requiresFixtureSeed) void this.recoveryReady.catch((): void => {});
    // Method-level probes may execute onCreate without private helpers; the
    // production class still owns the concrete scheduler below.
    if (this.publicFixture === undefined) this.scheduleRebuildableCacheClear?.(want, owner);
    ReaderSystemFileOpenHost.install(owner, this.recoveryReady);
    if (this.publicFixture === undefined) ReaderSystemFileOpenHost.receive(want);
    // This diagnostic is an explicit cold debug Want only. Normal starts and
    // warm external files perform no synthetic filesystem work.
    if (DEBUG === true && BUILD_MODE_NAME === 'debug' && parameters?.readerAtomicSnapshotProbe === true) {
      void this.recoveryReady.then((): Promise<void> => probeReaderAtomicSnapshot(DEBUG, BUILD_MODE_NAME,
        true, this.context.filesDir, (): boolean => this.runtimeOwner === owner && ReaderRuntimeOwner.isCurrent(owner),
        readerMotionNowMs, (sample: ReaderAtomicSnapshotSample): void => {
          hilog.info(DOMAIN, 'Reader', 'READER_ATOMIC_SNAPSHOT %{public}s', JSON.stringify(sample));
        })).catch((): void => {});
    }
    if (DEBUG === true && BUILD_MODE_NAME === 'debug' && parameters?.readerAssetInventoryProbe === true) {
      void this.recoveryReady.then((): Promise<void> => probeReaderAssetInventory(DEBUG, BUILD_MODE_NAME,
        true, (): boolean => this.runtimeOwner === owner && ReaderRuntimeOwner.isCurrent(owner), readerMotionNowMs,
        (sample: ReaderAssetInventorySample): void => {
          hilog.info(DOMAIN, 'Reader', 'READER_ASSET_INVENTORY %{public}s', JSON.stringify(sample));
        })).catch((): void => {});
    }
    if (DEBUG === true && BUILD_MODE_NAME === 'debug' && parameters?.readerCoreCopyProbe === true) {
      void this.recoveryReady.then((): Promise<void> => probeReaderCoreCopy(DEBUG, BUILD_MODE_NAME,
        true, parameters?.readerCoreCopyMode, parameters?.readerCoreCopyId, this.context.filesDir,
        (): boolean => this.coreCopyProbeGeneration === coreCopyProbeGeneration &&
          this.runtimeOwner === owner && ReaderRuntimeOwner.isCurrent(owner),
        (sample: ReaderCoreCopyProbeSample): void => {
          hilog.info(DOMAIN, 'Reader', 'READER_CORE_COPY phase=%{public}s code=%{public}s count=%{public}d',
            sample.phase, sample.code, sample.count);
        })).catch((): void => {});
    }
  }

  private admitPublicFixture(parameters: Record<string, Object> | undefined): void {
    const selection = selectReaderPublicFixture(DEBUG, BUILD_MODE_NAME, parameters);
    if (selection.kind === 'rejected') throw new Error('PUBLIC_FIXTURE_SELECTION_REJECTED');
    const mode = selection.kind === 'fixture' ? selection.id : 'normal';
    if (EntryAbility.dataMode !== undefined && EntryAbility.dataMode !== mode) {
      throw new Error('PUBLIC_FIXTURE_REQUIRES_COLD_PROCESS');
    }
    if (selection.kind === 'fixture') {
      if (this.context.area !== contextConstant.AreaMode.EL2) throw new Error('PUBLIC_FIXTURE_ORIGINAL_AREA_UNKNOWN');
      const original = [this.context.filesDir, this.context.cacheDir, this.context.preferencesDir, this.context.databaseDir];
      const area = mode === 'empty-shelf' ? contextConstant.AreaMode.EL3 : contextConstant.AreaMode.EL4;
      const partition = `/el${area + 1}/`;
      this.context.area = area;
      const isolated = [this.context.filesDir, this.context.cacheDir, this.context.preferencesDir, this.context.databaseDir];
      if (this.context.area !== area || isolated.some(path =>
        !path.startsWith('/data/') || !path.includes(partition) || original.includes(path)) ||
        buildReaderPublicFixtureDirectory(this.context.filesDir, selection.id) === undefined) {
        throw new Error('PUBLIC_FIXTURE_STORAGE_NOT_ISOLATED');
      }
      if (isReaderNamedPublicFixture(selection.id)) {
        bindReaderNamedPublicStorage(selection.id, this.context.filesDir, this.context.cacheDir);
        this.prepareNamedFixtureDirectory(this.context.filesDir, readerHostFilesDirectory(this.context.filesDir));
        this.prepareNamedFixtureDirectory(this.context.cacheDir, readerHostCacheDirectory(this.context.cacheDir));
      }
      this.publicFixture = selection;
      hilog.info(DOMAIN, 'Reader', 'Public UI fixture scope: %{public}s', selection.id);
    }
    EntryAbility.dataMode = mode;
  }

  private prepareNamedFixtureDirectory(sandbox: string, root: string): void {
    const parent = `${sandbox}/reader-public-ui-fixtures`;
    for (const path of [sandbox, parent, root]) {
      if (path !== sandbox && !fileIo.accessSync(path)) fileIo.mkdirSync(path);
      if (!fileIo.lstatSync(path).isDirectory()) throw new Error('PUBLIC_FIXTURE_STORAGE_NOT_ISOLATED');
    }
  }

  onNewWant(want: Want, _launchParam: AbilityConstant.LaunchParam): void {
    if (this.coreCopyOnly || this.fixtureAdmissionRejected || this.publicFixture !== undefined ||
        want.parameters?.[READER_PUBLIC_FIXTURE_PARAMETER] !== undefined) return;
    this.frameworkCapture.start(DEBUG, BUILD_MODE_NAME, want.parameters?.readerFrameworkCaptureSeconds, this.context.cacheDir);
    if (DEBUG && BUILD_MODE_NAME === 'debug' && want.parameters?.readerAppearancePixelProbe === true &&
      want.parameters?.readerFrameworkCaptureSeconds === undefined && want.action !== 'ohos.want.action.viewData' &&
      this.coldStartPage === 'pages/Index' && ReaderUIVerificationProbe.enabled()) {
      const stage = this.activeWindowStage;
      const generation = this.windowStageGeneration;
      if (stage !== undefined) {
        try {
          const win = stage.getMainWindowSync();
          const windowId = win.getWindowProperties().id;
          const cancel = ReaderAppearancePixelProbe.arm(win, generation, this.context.cacheDir, (): boolean =>
            this.activeWindowStage === stage && this.windowStageGeneration === generation &&
            ReaderWindowCoordinator.diagnosticWindowId() === windowId && ReaderUIVerificationProbe.enabled());
          if (cancel !== undefined) this.cancelAppearancePixelProbe = cancel;
        } catch (_) {
          hilog.warn(DOMAIN, 'ReaderAppearancePixel', 'Could not bind current Reader window');
        }
      }
    }
    const focusTrace = want.parameters?.readerToggleFocusTrace;
    if (DEBUG && BUILD_MODE_NAME === 'debug') {
      if (typeof focusTrace === 'boolean') AppStorage.setOrCreate('readerToggleFocusTrace', focusTrace);
      else if (focusTrace === 'buffered') {
        AppStorage.setOrCreate<string[]>('readerToggleFocusBuffer', []);
        AppStorage.setOrCreate('readerToggleFocusTrace', 'buffered');
      } else if (focusTrace === 'flush') {
        AppStorage.setOrCreate('readerToggleFocusTrace', false);
        const events = AppStorage.get<string[]>('readerToggleFocusBuffer') ?? [];
        AppStorage.setOrCreate<string[]>('readerToggleFocusBuffer', []);
        events.forEach((event: string): void => {
          hilog.info(DOMAIN, 'ReaderToggleFocus', 'READER_TOGGLE_FOCUS %{public}s', event);
        });
      }
    }
    // Never reload the window or route directly; Index saves the active
    // reading session before presenting a successfully imported file.
    this.scheduleRebuildableCacheClear?.(want, this.runtimeOwner);
    ReaderSystemFileOpenHost.receive(want);
  }

  private scheduleRebuildableCacheClear(want: Want, owner: ReaderRuntimeOwner | undefined): void {
    if (owner === undefined || !readerRebuildableCacheClearEnabled(DEBUG, BUILD_MODE_NAME,
      want.parameters?.readerClearRebuildableCache)) return;
    void this.recoveryReady.then(async (): Promise<void> => {
      if (this.runtimeOwner !== owner || !ReaderRuntimeOwner.isCurrent(owner)) return;
      try {
        const result = await owner.clearRebuildableCachesForVerification();
        hilog.info(DOMAIN, 'Reader', 'READER_VM_CACHE_CLEAR %{public}s', JSON.stringify({
          result: 'completed', ordinaryBytes: result.ordinaryBytes, derivedDisplayFiles: result.derivedDisplayFiles,
          remainingAutomaticBytes: result.ordinaryBytes, removedContentBytes: result.removedContentBytes,
          deletedBytes: result.deletedBytes, deletedFiles: result.deletedFiles,
          preserved: ['downloads', 'manifests', 'bookshelf', 'progress', 'active-leases'],
        }));
      } catch (error) {
        hilog.error(DOMAIN, 'Reader', 'READER_VM_CACHE_CLEAR %{public}s', JSON.stringify({
          result: 'failed', error: (error as Error).message,
        }));
      }
    }).catch((error: Error): void => {
      hilog.error(DOMAIN, 'Reader', 'READER_VM_CACHE_CLEAR %{public}s', JSON.stringify({
        result: 'recovery-failed', error: error.message,
      }));
    });
  }

  private async prepareSelectedReadingFont(owner: ReaderRuntimeOwner, reusePrepared: boolean = false): Promise<void> {
    const store = owner.getAppearanceStore();
    while (this.runtimeOwner === owner) {
      const snapshot = store.current();
      // Ordinary startup already checked this immutable native face. Reuse
      // only that acknowledged owner/choice, never a failed load or a result
      // inferred solely from the absence of a configuration recovery journal.
      if (reusePrepared && this.preparedReadingFontOwner === owner &&
        this.preparedReadingFontSnapshot !== undefined &&
        this.sameSelectedReadingFont(this.preparedReadingFontSnapshot, snapshot)) return;
      this.preparedReadingFontOwner = undefined;
      this.preparedReadingFontSnapshot = undefined;
      await prepareReaderFontFamily(readerAppearanceSnapshotFontFamily(snapshot));
      if (this.runtimeOwner !== owner) return;
      if (!this.sameSelectedReadingFont(snapshot, store.current())) continue;
      if (snapshot.font !== 'custom' || snapshot.customFont === undefined) {
        this.preparedReadingFontOwner = owner;
        this.preparedReadingFontSnapshot = snapshot;
        return;
      }
      const registered = await new ReaderCustomFontHost(this.context).registerPersisted(undefined, snapshot.customFont);
      if (this.runtimeOwner !== owner) return;
      if (!this.sameSelectedReadingFont(snapshot, store.current())) continue;
      if (registered) {
        this.preparedReadingFontOwner = owner;
        this.preparedReadingFontSnapshot = snapshot;
        return;
      }
      // Match the reader's existing missing/invalid custom-file recovery. A
      // checked native load error still rejects; it is never called ready.
      const commit = await store.change((current: ReaderAppearanceSnapshot): ReaderAppearanceSnapshot =>
        setReaderAppearanceFont(current, 'serif'),
        (current: ReaderAppearanceSnapshot): boolean => this.runtimeOwner === owner &&
          this.sameSelectedReadingFont(snapshot, current));
      await commit?.saved;
    }
  }

  private sameSelectedReadingFont(first: ReaderAppearanceSnapshot, second: ReaderAppearanceSnapshot): boolean {
    return first.font === second.font && (first.font !== 'custom' ||
      JSON.stringify(first.customFont) === JSON.stringify(second.customFont));
  }

  onWindowStageCreate(windowStage: window.WindowStage): void {
    if (this.coreCopyOnly || this.fixtureAdmissionRejected) return;
    this.activeWindowStage = windowStage;
    ReaderStartupTrace.current()?.mark('window.create');
    const generation = ++this.windowStageGeneration;
    this.startupContent?.close();
    let windowReady: Promise<boolean>;
    try {
      const win = windowStage.getMainWindowSync();
      windowReady = ReaderStartupTrace.measure('startup.window', (): Promise<boolean> => ReaderWindowCoordinator.install(win, this.context.config))
        .catch((error: Error): boolean => {
          hilog.error(DOMAIN, 'Reader', 'Window metrics setup failed: %{private}s', error.message);
          return false;
        });
    } catch (error) {
      hilog.error(DOMAIN, 'Reader', 'Main window access failed: %{private}s', (error as Error).message);
      windowReady = Promise.resolve(false);
    }
    // Window metrics can fall back to their existing zero-inset snapshot.
    // A bounded admission failure is displayed outside the not-yet-mounted Index.
    const admission = Promise.all([windowReady, this.recoveryReady, this.shelfFontsReady]).then((): void => {});
    this.startupContent = new ReaderStartupContentOwner(admission, {
      loadMain: (done: (code: number) => void): void => this.loadMainContent(windowStage, done),
      loadRecovery: (done: (code: number) => void): void => {
        windowStage.loadContent('pages/ReaderStartupRecovery', (error): void => done(error.code));
      },
      ready: (): void => { if (generation === this.windowStageGeneration) {
        this.eventLoopProbe?.start();
        this.capacityProbe?.start();
      } },
      unavailable: (): void => {
        hilog.error(DOMAIN, 'Reader', 'Startup recovery content could not be mounted; platform recovery remains unavailable');
      },
      exit: (): Promise<void> => this.context.terminateSelf(),
      observerFailed: (error: Error): void => hilog.warn(DOMAIN, 'Reader', 'Startup projection failed: %{private}s', error.message),
    });
    this.startupContent.start();
  }

  onWindowStageDestroy(): void {
    if (this.coreCopyOnly || this.fixtureAdmissionRejected) return;
    this.cancelAppearancePixelProbe?.();
    this.cancelAppearancePixelProbe = undefined;
    this.eventLoopProbe?.stop('window-destroyed');
    this.capacityProbe?.stop();
    this.startupContent?.close();
    this.startupContent = undefined;
    this.windowStageGeneration += 1;
    this.activeWindowStage = undefined;
    ReaderWindowCoordinator.destroyWindow();
  }

  onConfigurationUpdate(newConfig: Configuration): void {
    if (this.coreCopyOnly || this.fixtureAdmissionRejected) return;
    if (newConfig.colorMode === ConfigurationConstant.ColorMode.COLOR_MODE_DARK ||
        newConfig.colorMode === ConfigurationConstant.ColorMode.COLOR_MODE_LIGHT) {
      void ReaderThemeHost.systemChanged(newConfig.colorMode === ConfigurationConstant.ColorMode.COLOR_MODE_DARK ? 'night' : 'day')
        .catch((error: Error): void => hilog.error(DOMAIN, 'Reader', 'System theme write failed: %{private}s', error.message));
    }
    // Configuration can change while Display density and window size stay fixed.
    const stage = this.activeWindowStage;
    if (stage !== undefined) {
      try { ReaderWindowCoordinator.refreshConfiguration(newConfig, stage.getMainWindowSync()); } catch (_error) {}
    }
  }

  onForeground(): void {
    if (this.coreCopyOnly || this.fixtureAdmissionRejected) return;
    AppStorage.setOrCreate('readerAppForeground', true);
    ReaderDocumentPickerActivity.setForeground(true);
    this.runtimeOwner?.setReadingPreparationContext(true, false);
    ReaderWindowCoordinator.reapplyChrome();
    ReaderWindowCoordinator.reapplyWindowPolicy();
  }

  onBackground(): void {
    if (this.coreCopyOnly || this.fixtureAdmissionRejected) return;
    this.cancelAppearancePixelProbe?.();
    this.cancelAppearancePixelProbe = undefined;
    AppStorage.setOrCreate('readerAppForeground', false);
    ReaderDocumentPickerActivity.setForeground(false);
    this.runtimeOwner?.setReadingPreparationContext(false, false);
    this.runtimeOwner?.releaseMangaOfflineProbe();
    this.eventLoopProbe?.stop('background');
    this.capacityProbe?.stop();
    this.runtimeOwner?.flush().catch((error: Error): void => {
      hilog.error(DOMAIN, 'Reader', 'Core storage flush failed: %{private}s', error.message);
    });
  }

  onMemoryLevel(_level: AbilityConstant.MemoryLevel): void {
    this.runtimeOwner?.releaseOptionalReadingEntryMemory();
  }

  onDestroy(): void {
    if (this.fixtureAdmissionRejected) return;
    this.frameworkCapture.close();
    this.cancelAppearancePixelProbe?.();
    this.cancelAppearancePixelProbe = undefined;
    this.coreCopyProbeGeneration += 1;
    if (this.coreCopyOnly) { this.coreCopyOnly = false; return; }
    this.mangaPlatformDiagnostic?.stop(); this.mangaPlatformDiagnostic = undefined;
    this.eventLoopProbe?.stop('destroyed');
    this.capacityProbe?.stop();
    this.startupContent?.close();
    this.startupContent = undefined;
    ReaderThemeHost.detach();
    ReaderNavigationAppearancePreferences.detach();
    this.windowStageGeneration += 1;
    this.activeWindowStage = undefined;
    ReaderWindowCoordinator.destroyWindow();
    AppStorage.setOrCreate('readerAppForeground', false);
    ReaderDocumentPickerActivity.setForeground(false);
    const owner = this.runtimeOwner;
    ReaderSystemFileOpenHost.detach(owner);
    this.runtimeOwner = undefined;
    owner?.release().catch((error: Error): void => {
      hilog.error(DOMAIN, 'Reader', 'Core close failed: %{private}s', error.message);
    });
  }

  private loadMainContent(windowStage: window.WindowStage, done?: (code: number) => void): void {
    const generation = this.windowStageGeneration;
    const trace = ReaderStartupTrace.current();
    const startedAt = trace?.begin('startup.load-content') ?? -1;
    trace?.mark('startup.admission-settled');
    const page = this.coldStartPage;
    // A debug fault is one real dispatch, never a synthetic error callback.
    // Consume before calling the platform so both callback failure and a
    // synchronous dispatch throw retry the actual Index on the next request.
    if (page === 'pages/__ReaderStartupMainLoadFailure') {
      this.coldStartPage = 'pages/Index';
      trace?.mark('startup.main-load-fault-request');
    }
    windowStage.loadContent(page, (error): void => {
      if (generation !== this.windowStageGeneration) return;
      // This is a platform callback, never evidence of a displayed shelf frame.
      trace?.end('startup.load-content', startedAt, error.code ? 'failed' : 'callback');
      if (error.code) {
        hilog.error(DOMAIN, 'Reader', 'Failed to load main page: %{private}s', JSON.stringify(error));
      } else if (done === undefined) {
        this.eventLoopProbe?.start();
      }
      done?.(error.code);
    });
  }
}
