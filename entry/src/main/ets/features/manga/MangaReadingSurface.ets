import deviceInfo from '@ohos.deviceInfo';
import hilog from '@ohos.hilog';
import curves from '@ohos.curves';
import inputMethod from '@ohos.inputMethod';
import { FrameCallback } from '@kit.ArkUI';
import type { JsonObject } from '@reader/core-harmony';
import { ReaderWindowCoordinator, ReaderWindowChromeStyle, ReaderWindowPolicy } from '../../app/ReaderWindowCoordinator';
import { readerInteractiveSafeInsets, type ReaderInsetsVp } from '../common/ReaderWindowMetrics';
import { mangaUserError } from './MangaUserError';
import type { ReaderSettingsGateway } from '../reading/ReaderSettingsGateway';
import type { ReadingGatewayRuntime } from '../reading/ReadingGatewayRuntime';
import { RemoteReadingFlowGateway, type RemoteReadingBookSeed, type RemoteReadingSession, type RemoteReadingTocEntry } from '../reading/RemoteReadingFlowGateway';
import { MangaSessionGateway } from './MangaSessionGateway';
import type { MangaManifest } from './MangaContract';
import { MangaSessionController, MangaTileRequest } from './MangaSessionController';
import { PhotoViewScaleModel } from './vendor/photoview/PhotoViewScaleModel';
import { MangaStripProjection, MangaStripRow } from './MangaStripProjection';
import { ReaderIconButton } from '../common/ReaderIconButton';
import { ReaderDirectoryNavigationSurface } from '../reading/ReaderDirectoryNavigationSurface';
import type { LocalReadingTocEntry } from '../reading/LocalReadingFlowGateway';
import type { RemoteReadingPositionScope } from '../reading/RemoteReadingPositionMigration';
import { mangaUsesPersistentDirectory, mangaDirectoryColumnWidth } from './MangaLayoutPolicy';
import { MangaBookPresentation } from './MangaBookPresentation';
import { MangaReadingDirectoryFallback } from './MangaReadingDirectoryFallback';
import { MangaDownloadOperationsPanel } from './MangaDownloadOperationsPanel';
import type { MangaDownloadAction, MangaDownloadActionId } from './MangaDownloadActionsGateway';
import { readerBrightnessControlPercent, readerBrightnessWindowValue } from '../reading/ReaderBrightnessCurve';
import { TOK_BORDER_W } from '../common/ReaderTokens';
import { READER_FONT_NOTO_SERIF_SC_BOLD, READER_FONT_NOTO_SANS_SC_UI_REGULAR, READER_FONT_NOTO_SANS_SC_UI_600,
  READER_FONT_NOTO_SANS_SC_UI_900 } from '../common/ReaderFontFamilies';
import { prepareMangaSheetFonts } from '../common/ReaderFonts';

interface MangaViewportAnchor { ordinal: number; y: number; x?: number; }
interface MangaConfirmedPosition { controller: MangaSessionController; manifest: MangaManifest; identity: string; anchor: MangaViewportAnchor; }

class MangaLayoutFrame extends FrameCallback {
  private readonly action: () => void;
  constructor(action: () => void) { super(); this.action = action; }
  onFrame(_time: number): void { this.action(); }
  onIdle(_remaining: number): void {}
}

/** Sheet admission has its own frame fence; it does not own image layout. */
class MangaSheetFrame extends FrameCallback {
  private readonly action: () => void;
  constructor(action: () => void) { super(); this.action = action; }
  onFrame(_time: number): void { this.action(); }
  onIdle(_remaining: number): void {}
}

class MangaStripDataSource implements IDataSource {
  readonly projection: MangaStripProjection = new MangaStripProjection();
  private listeners: DataChangeListener[] = [];
  totalCount(): number { return this.projection.totalCount(); }
  getData(index: number): MangaStripRow { return this.projection.row(index); }
  registerDataChangeListener(listener: DataChangeListener): void { this.listeners.push(listener); }
  unregisterDataChangeListener(listener: DataChangeListener): void {
    this.listeners = this.listeners.filter((item: DataChangeListener): boolean => item !== listener);
  }
  notify(structure: boolean, first: number, last: number): void {
    for (const listener of this.listeners) {
      if (structure) listener.onDataReloaded();
      else for (let index = first; index <= Math.min(last, this.totalCount() - 1); index++) listener.onDataChange(index);
    }
  }
}

/** Native virtual list; a tile is a temporary presentation of one logical page. */
@Component
export struct MangaReadingSurface {
  @StorageLink('readerWindowMetricsRevision') private windowMetricsRevision: number = 0;
  settingsGateway: ReaderSettingsGateway | undefined = undefined;
  runtime: ReadingGatewayRuntime | undefined = undefined;
  sourceId: string = '';
  bookId: string = '';
  chapterIndex: number | undefined = undefined;
  startAtChapterFirst: boolean = false;
  directoryTargetProof: JsonObject | undefined = undefined;
  @Prop remoteSession: RemoteReadingSession | undefined = undefined;
  remoteBookSeed: RemoteReadingBookSeed | undefined = undefined;
  onRemoteSessionReady: (session: RemoteReadingSession) => void = (): void => {};
  onChapterCommitted: (index: number, title: string) => void = (): void => {};
  offline: boolean = false;
  onSaveFailure: (message: string) => void = (_message: string): void => {};
  onBack: () => void = (): void => {};
  onDirectory: () => void = (): void => {};
  @Prop bookTitle: string = '';
  @Prop inBookshelf: boolean = true;
  @Prop reduceMotion: boolean = false;
  @Prop @Watch('onWindowChromeChanged') windowChromeActive: boolean = false;
  @Prop @Watch('onWindowChromeChanged') windowChromeOverlayActive: boolean = false;
  isReaderIdentityCurrent: () => boolean = (): boolean => true;
  retainPreparationOnDisappear: () => boolean = (): boolean => false;
  private windowChromeOwned: boolean = false;
  onDetail: () => void = (): void => {};
  onToggleShelf: () => void = (): void => {};
  onDownloadChapter: () => void = (): void => {};
  onDownloadBook: () => void = (): void => {};
  @Prop downloadEnabled: boolean = false;
  @Prop directoryProjection: LocalReadingTocEntry[] = [];
  onLoadDownloadActions: (chapterIndex?: number) => Promise<MangaDownloadAction[]> = async (): Promise<MangaDownloadAction[]> => [];
  onDownloadAction: (action: MangaDownloadActionId, chapterIndex?: number) => Promise<void> = async (): Promise<void> => {};
  @State private downloadActions: MangaDownloadAction[] = [];
  @State private downloadActionsLoading: boolean = false;
  @State private downloadActionsFailure: string = '';
  private downloadActionsChapterIndex: number | undefined = undefined;
  private downloadActionsGeneration: number = 0;
  onSelectDirectoryTarget: (chapterIndex: number, proof?: JsonObject) => void = (_index: number, _proof?: JsonObject): void => {};
  onSwitchSource: () => void = (): void => {};
  onLoginSource: () => Promise<void> = async (): Promise<void> => {};
  @Prop mangaBackgroundColor: string = '#111111';
  @Prop mangaForegroundColor: string = '#eeeeee';
  @Prop errorColor: string = '#ffb4ab';
  onExitRequestHandler: (exit: (intent?: 'navigation') => void) => void = (): void => {};
  onChapter: (direction: number) => void = (_direction: number): void => {};
  @State @Watch('onWindowChromeChanged') private error: string = '';
  @State private offlineProbeStatus: string = '';
  private detachOfflineProbe: (() => void) | undefined;
  @State private title: string = '';
  @State @Watch('onWindowChromeChanged') private recovering: boolean = false;
  @State private opened: boolean = false;
  private controller: MangaSessionController | undefined;
  private readonly data: MangaStripDataSource = new MangaStripDataSource();
  private readonly scroller: ListScroller = new ListScroller();
  private readonly horizontalScroller: Scroller = new Scroller();
  private readonly scalePolicy: PhotoViewScaleModel = new PhotoViewScaleModel();
  @State private zoom: number = 1;
  @State private horizontal: boolean = false;
  @State private horizontalPage: number = 0;
  @State private horizontalPageCount: number = 0;
  private pinchStartScale: number = 1;
  private pinchAnchor: MangaViewportAnchor | undefined;
  private first: number = 0;
  private last: number = 0;
  private viewportRangeObserved: boolean = false;
  private viewportObservationPending: boolean = false;
  private viewportObservationGeneration: number = 0;
  private readonly publishedRowKeys: Map<number, string> = new Map<number, string>();
  private mounted: boolean = false;
  private chapterCommitted: boolean = false;
  private readonly reportedErrorCodes: Set<string> = new Set<string>();
  @State private viewportWidth: number = 1;
  @State private viewportHeight: number = 1;
  @State private fitPreference: 'source' | 'width' | 'contain' = 'source';
  @State private loggingIn: boolean = false;
  @State @Watch('onWindowChromeChanged') private loginRequiredForControls: boolean = false;
  private loginGeneration: number = 0;
  @State @Watch('onWindowChromeChanged') private openingRetry: boolean = false;
  private layoutGeneration: number = 0;
  private viewportGeneration: number = 0;
  private presentationGeneration: number = 0;
  private visibleAnchor: MangaViewportAnchor | undefined;
  private confirmedPosition: MangaConfirmedPosition | undefined;
  private appliedLayoutGeneration: number = -1;
  private publishedManifestVersion: string = '';
  private restoringAnchor: boolean = false;
  private pendingTurnOrdinal: number | undefined;
  private mountedTurnRowKey: string = '';
  private exiting: boolean = false;
  @StorageLink('readerAppScheme') private appThemeScheme: string = 'day';
  @State @Watch('onWindowChromeChanged') private controlsVisible: boolean = false;
  @State @Watch('onWindowChromeChanged') private panel: string = '';
  @State private panelOffset: number = 0;
  @State private panelScrimOpacity: number = 0;
  @State private panelPhase: string = 'closed';
  private panelGeneration: number = 0;
  private panelActionGeneration: number = 0;
  private panelCloseTask: Promise<boolean> | undefined;
  private panelCloseResolve: ((closed: boolean) => void) | undefined;
  @State private panelFontsReady: boolean = false;
  private panelFontGeneration: number = 0;
  @State @Watch('onWindowChromeChanged') private chapterEnd: boolean = false;
  @State private displayedPage: number = 0;
  @State @Watch('onWindowChromeChanged') private backgroundPreference: 'paper' | 'white' | 'ink' = 'paper';
  @State private showPageNumbers: boolean = true;
  @State private directoryQuery: string = '';
  @State private directoryAscending: boolean = true;
  @State private directoryRevision: number = 0;
  @State private directoryOpenRevision: number = 0;
  @State private brightnessPercent: number = 50;
  @State private automaticBrightness: boolean = true;
  private brightnessOwner: number = 0;
  private brightnessGeneration: number = 0;
  private seekingPage: number | undefined;
  @State private stageWidth: number = 1;
  @State private stageHeight: number = 1;

  aboutToAppear(): void {
    this.mounted = true;
    this.backgroundPreference = this.settingsGateway?.current()?.mangaBackground ?? (this.appThemeScheme === 'night' ? 'ink' : 'paper');
    if (this.runtime === undefined) {
      this.error = 'MANGA_RESOURCE_HOST_UNAVAILABLE';
      this.onWindowChromeChanged();
      return;
    }
    const presentationRevision = MangaBookPresentation.revision;
    MangaBookPresentation.useOwner(this.runtime);
    if (MangaBookPresentation.revision !== presentationRevision)
      AppStorage.setOrCreate('readerMangaPresentationRevision', MangaBookPresentation.revision);
    this.horizontal = this.settingsGateway?.current()?.mangaDirection === 'horizontal';
    this.fitPreference = this.settingsGateway?.current()?.mangaFit ?? 'source';
    this.showPageNumbers = this.settingsGateway?.current()?.mangaPageNumbers !== false;
    this.loadBrightness();
    this.onExitRequestHandler((intent?: 'navigation'): void => {
      if (this.mounted) void this.handleBack(intent);
    });
    const controller = new MangaSessionController(this.runtime);
    this.controller = controller;
    controller.onChange = (): void => this.publish();
    this.onWindowChromeChanged();
    this.open(controller);
  }
  aboutToDisappear(): void {
    // Withdraw before resetting watched state: disposal cannot reissue reader policy.
    this.mounted = false;
    this.restoreAppWindowChrome();
    this.invalidatePanelMotion();
    this.panel = ''; this.panelPhase = 'closed'; this.panelOffset = 0; this.panelScrimOpacity = 0;
    this.panelFontGeneration++; this.panelFontsReady = false;
    const brightnessOwner = this.brightnessOwner; this.brightnessOwner = 0; this.brightnessGeneration++;
    if (brightnessOwner > 0) void ReaderWindowCoordinator.brightness().release(brightnessOwner).catch((): void => {});
    this.layoutGeneration++; this.viewportGeneration++; this.loginGeneration++; this.presentationGeneration++;
    this.viewportObservationGeneration++; this.viewportObservationPending = false;
    this.confirmedPosition = undefined;
    this.pendingTurnOrdinal = undefined; this.mountedTurnRowKey = '';
    const retainPreparation = this.retainPreparationOnDisappear();
    if (this.controller !== undefined) {
      this.controller.onChange = undefined;
      void this.controller.close(retainPreparation ? 'chapter' : 'exit').catch((): void => {});
    }
    // Same-book chapter remounts keep the book-wide probe; only its old view subscriber leaves.
    if (!retainPreparation) this.runtime?.finishMangaOfflineProbe?.(this.sourceId, this.bookId);
    this.detachOfflineProbe?.(); this.detachOfflineProbe = undefined;
  }
  private async open(controller: MangaSessionController): Promise<void> {
    try {
      this.detachOfflineProbe = this.offline ? this.runtime?.subscribeMangaOfflineProbe?.((state: string): void => {
        if (this.mounted) this.offlineProbeStatus = state;
      }) : undefined;
      const current = (): boolean => this.mounted && this.controller === controller;
      let index = this.chapterIndex;
      const startAtChapterFirst = this.startAtChapterFirst && index !== undefined;
      let session = this.remoteSession;
      if (this.runtime !== undefined) {
        await controller.awaitPendingProgress(this.sourceId, this.bookId);
        if (!current()) return;
        let prepared = await new MangaSessionGateway(this.runtime).entry(this.sourceId, this.bookId, index, current, this.directoryTargetProof);
        if (!current()) return;
        if (prepared !== null) {
          let catalogRecoveryAttempted = false;
          this.horizontalPage = startAtChapterFirst ? 0 : prepared.targetOrdinal;
          await controller.setPreviewMode(this.fitPreference === 'contain' || (this.fitPreference === 'source' && prepared.chapter.manifest.displayHints?.fit === 'contain'));
          await controller.openPrepared(prepared, this.offline, startAtChapterFirst);
          if (!current()) return;
          const preparedTargetOrdinal = startAtChapterFirst ? 0 : prepared.targetOrdinal;
          const target = prepared.chapter.manifest.pages.find(page => page.ordinal === preparedTargetOrdinal);
          const missingResource = target !== undefined && !prepared.chapter.resources.some(resource => resource.resourceRef === target.resourceRef);
          const failed = !this.offline && prepared.chapter.cached && missingResource ?
            controller.visiblePages().find(page => page.ordinal === preparedTargetOrdinal && page.status === 'failed') : undefined;
          if (failed?.error === 'REMOTE_READING_IMAGE_NOT_DOWNLOADED' || failed?.error === 'READING_IMAGE_REPROCESS_REQUIRED') {
            try {
              catalogRecoveryAttempted = true;
              // Cached pixels keep their fast/offline path. A missing old
              // resource may only renew through one fresh canonical catalog;
              // the normal controller open then preserves progress/recovery.
              const refreshed = await this.acquireCatalog(current, true);
              if (!current()) return;
              if (refreshed !== undefined && refreshed.contentKind === 'manga' &&
                refreshed.identity.sourceId === this.sourceId && refreshed.identity.bookId === this.bookId) {
                session = refreshed;
                if (refreshed.sourceVersion === prepared.chapter.manifest.sourceRuleVersion) {
                  // Restored same-version manifests may also omit expiring
                  // descriptors. Reuse the bounded refresh and exact Core
                  // anchor mapping; cacheFirst would return that same cache.
                  await controller.refreshChapter(preparedTargetOrdinal);
                  if (!current()) return;
                } else prepared = null;
              }
            } catch (_error) {
              if (!current()) return;
              // Disabled/deleted/unavailable sources cannot retire the old
              // cached entry or replace its specific image failure.
            }
          }
          if (prepared !== null) {
            const presentationRevision = MangaBookPresentation.revision;
            MangaBookPresentation.admitEntry(this.sourceId, this.bookId, prepared);
            if (MangaBookPresentation.revision !== presentationRevision)
              AppStorage.setOrCreate('readerMangaPresentationRevision', MangaBookPresentation.revision);
            this.opened = true; this.recovering = controller.recoveryRequired;
            this.publish();
            const saved = controller.savedLocation;
            const target = controller.displayedOrdinal;
            this.restore(target, !this.recovering && saved !== null && saved.pageId === controller.pageAt(target)?.pageId ? saved.y : 0,
              !this.recovering && saved !== null && saved.pageId === controller.pageAt(target)?.pageId ? saved.x : 0);
            // Catalog acquisition is optional background work after readable pixels.
            if (session !== undefined && session.identity.sourceId === this.sourceId && session.identity.bookId === this.bookId && session.contentKind === 'manga') {
              this.configureAdjacentChapter(session, controller); this.onRemoteSessionReady(session);
            }
            else if (this.remoteBookSeed !== undefined && !catalogRecoveryAttempted) {
              void this.acquireCatalog(current).then((catalog: RemoteReadingSession | undefined): void => {
                if (catalog !== undefined && current() && catalog.identity.sourceId === this.sourceId && catalog.identity.bookId === this.bookId && catalog.contentKind === 'manga') {
                  this.configureAdjacentChapter(catalog, controller); this.onRemoteSessionReady(catalog);
                }
              }).catch((): void => {});
            }
            return;
          }
        }
      }
      if (session === undefined && this.remoteBookSeed !== undefined) {
        session = await this.acquireCatalog(current);
      }
      if (!current()) return;
      if (session !== undefined) {
        if (session.identity.sourceId !== this.sourceId || session.identity.bookId !== this.bookId || session.contentKind !== 'manga') throw new Error('MANGA_SESSION_IDENTITY_MISMATCH');
        this.onRemoteSessionReady(session);
      }
      if (index === undefined && this.runtime !== undefined) {
        const progress = await new MangaSessionGateway(this.runtime).progress(this.sourceId, this.bookId, current);
        index = session?.entries.find(entry => entry.url === progress.location?.chapter.chapterId &&
          (entry.navigable !== false || entry.resumeOnly === true))?.index ??
          session?.entries.find(entry => entry.navigable !== false && entry.url.trim().length > 0)?.index;
      }
      if (!current()) return;
      if (index === undefined) throw new Error('MANGA_CATALOG_REQUIRED');
      await controller.open(this.sourceId, this.bookId, index, this.offline, this.chapterIndex === undefined, this.directoryTargetProof, startAtChapterFirst);
      if (!this.mounted || this.controller !== controller) return;
      await controller.setPreviewMode(this.effectiveFit() === 'contain', controller.displayedOrdinal);
      if (!this.mounted || this.controller !== controller) return;
      this.opened = true; this.recovering = controller.recoveryRequired;
      if (session !== undefined) this.configureAdjacentChapter(session, controller);
      this.publish();
      const saved = controller.savedLocation;
      if (!this.recovering && saved !== null && saved.chapter.chapterId === controller.chapter?.manifest.chapter.chapterId) {
        const ordinal = saved.pageOrdinalFallback;
        if (ordinal >= 0 && controller.pageAt(ordinal)?.pageId === saved.pageId) {
          if (this.horizontal) {
            this.horizontalPage = ordinal;
            this.data.projection.publish(controller.chapter!.manifest, (index: number) => controller.pageGeometry(index), ordinal, controller.totalPages, (pageOrdinal: number) => controller.pageAt(pageOrdinal));
            this.refreshLoginRequiredForControls();
            this.data.notify(true, 0, 0);
          }
          this.restore(ordinal, saved.y, saved.x);
        }
      } else this.updateViewport();
    } catch (error) {
      if (this.mounted) this.error = error instanceof Error ? error.message : '漫画加载失败';
      if (this.offline) { controller.close(); this.runtime?.finishMangaOfflineProbe?.(this.sourceId, this.bookId); }
    }
  }

  private async acquireCatalog(current: () => boolean, forceRefresh: boolean = false): Promise<RemoteReadingSession | undefined> {
    if (this.runtime === undefined || this.remoteBookSeed === undefined) return undefined;
    if (this.offline) {
      // Already admitted manga identity; only read Core's durable catalog. A
      // missing/invalid cached catalog must never fall through to online acquire.
      const cached = await new RemoteReadingFlowGateway(this.runtime).openCachedSession(this.remoteBookSeed, current);
      cached.contentKind = 'manga';
      return cached;
    }
    return this.runtime.bookAcquisitions?.().acquireBook(this.remoteBookSeed, { isCurrent: current, forceRefresh });
  }
  private configureAdjacentChapter(session: RemoteReadingSession, controller: MangaSessionController): void {
    const chapter = controller.chapter;
    if (chapter === undefined || this.offline || session.acquisitionMode === 'offline' || session.requiresContextRefresh === true ||
      session.contentKind !== 'manga' || session.identity.sourceId !== chapter.manifest.chapter.sourceId ||
      session.identity.bookId !== chapter.manifest.chapter.bookId ||
      (session.sourceVersion !== undefined && session.sourceVersion !== chapter.manifest.sourceRuleVersion) ||
      this.runtime?.hasCurrentCatalogProjection?.(session) === false) {
      controller.configureNextChapter(); return;
    }
    const matching = session.entries.filter(entry => entry.index === chapter.chapterIndex && entry.url === chapter.manifest.chapter.chapterId);
    if (matching.length !== 1) { controller.configureNextChapter(); return; }
    const position = session.entries.indexOf(matching[0]);
    const next = session.entries.slice(position + 1).find(entry => entry.navigable !== false && entry.url.trim().length > 0 && entry.url !== chapter.manifest.chapter.chapterId);
    controller.configureNextChapter(next?.index, next?.url);
  }

  private publish(): void {
    const chapter = this.controller?.chapter;
    if (!this.mounted || chapter === undefined) return;
    this.recovering = this.controller?.recoveryRequired === true;
    const preparationError = this.controller?.preparationError;
    if (preparationError !== undefined) this.error = preparationError;
    else if (this.error === 'MANGA_CHAPTER_CACHE_CAPACITY' || this.error === 'MANGA_CHAPTER_PREPARATION_FAILED') this.error = '';
    const manifestChanged = this.publishedManifestVersion !== chapter.manifest.manifestVersion;
    if (manifestChanged && this.controller !== undefined) {
      this.publishedManifestVersion = chapter.manifest.manifestVersion;
      this.layoutGeneration++; this.viewportGeneration++;
      this.viewportRangeObserved = false;
      // Manifest layout is separate from newer user presentation intent.
      this.confirmedPosition = undefined;
      this.pendingTurnOrdinal = undefined; this.mountedTurnRowKey = '';
      this.recovering = this.controller.recoveryRequired;
      const ordinal = this.controller.displayedOrdinal;
      const saved = this.recovering ? null : this.controller.savedLocation;
      const exact = saved !== null && saved.manifestVersion === chapter.manifest.manifestVersion &&
        saved.pageOrdinalFallback === ordinal && saved.pageId === this.controller.pageAt(ordinal)?.pageId;
      this.horizontalPage = ordinal;
      this.visibleAnchor = { ordinal, y: exact ? saved!.y : 0, x: exact ? saved!.x : 0 };
    } else this.rememberVisible();
    const anchor = this.visibleAnchor;
    try {
      const changed = this.data.projection.publish(chapter.manifest, (index: number) => this.controller?.pageGeometry(index), this.horizontal ? this.horizontalPage : undefined, this.controller?.totalPages ?? chapter.manifest.pages.length, (ordinal: number) => this.controller?.pageAt(ordinal));
      // Controller facts are plain fields. Publish the admitted chapter count
      // as ArkUI state even when a new chapter starts at the same ordinal 0.
      this.horizontalPageCount = this.controller?.totalPages ?? 0;
      this.title = this.displayChapterTitle(chapter.chapterIndex, chapter.chapterTitle);
      this.displayedPage = anchor?.ordinal ?? this.controller?.displayedOrdinal ?? 0;
      this.notifyPublishedRows(changed);
      if (this.mountedTurnRowKey.length > 0 && this.data.totalCount() > 0) this.confirmMountedTurn(this.data.getData(0));
      if (changed && this.opened && anchor !== undefined && this.data.projection.affectsAnchor(anchor.ordinal))
        this.restore(anchor.ordinal, anchor.y, anchor.x ?? 0);
    } catch (error) { this.error = error instanceof Error ? error.message : '漫画布局失败'; }
  }
  private notifyPublishedRows(structure: boolean): void {
    // Image/auth facts are plain controller fields, not an observed UI property.
    this.refreshLoginRequiredForControls();
    const next = new Map<number, string>();
    const changed: number[] = [];
    for (let index = this.first; index <= this.requestedLast(); index++) {
      const key = this.rowRenderKey(this.data.getData(index));
      next.set(index, key);
      if (this.publishedRowKeys.get(index) !== key) changed.push(index);
    }
    // Commit before native notifications can report the same visible range.
    // Only the bounded viewport is retained; offscreen rows read current facts
    // when ArkUI mounts them, without a chapter-wide notification scan.
    this.publishedRowKeys.clear();
    next.forEach((key: string, index: number): void => { this.publishedRowKeys.set(index, key); });
    if (structure) this.data.notify(true, this.first, this.requestedLast());
    else for (const index of changed) this.data.notify(false, index, index);
  }
  private positionIdentity(ordinal: number): string {
    const manifest = this.controller?.chapter?.manifest;
    const page = this.controller?.pageAt(ordinal);
    if (manifest === undefined || page === undefined) return '';
    return JSON.stringify([manifest.chapter.sourceId, manifest.chapter.bookId, manifest.chapter.chapterId,
      manifest.manifestVersion, page.pageId]);
  }
  private rememberVisible(allowRestore: boolean = false): boolean {
    if (this.restoringAnchor && (!allowRestore || this.appliedLayoutGeneration !== this.layoutGeneration)) return false;
    if (this.data.totalCount() <= this.first) return false;
    const row = this.data.getData(this.first);
    try {
      const rect = this.scroller.getItemRect(this.first);
      // A frame callback can precede the new layout. Never combine a new scale
      // or fit with the previous native rectangle (allow only vp rounding).
      if (!Number.isFinite(rect.width) || !Number.isFinite(rect.height) ||
        Math.abs(rect.width - this.viewportWidth * this.zoom) > 1 ||
        Math.abs(rect.height - this.rowDisplayHeight(row)) > 1) return false;
      const y = this.data.projection.position(this.first, -rect.y - this.rowDisplayTop(row), this.rowDisplayWidth(row));
      this.visibleAnchor = { ordinal: row.ordinal, y, x: this.visibleX(row) };
      const identity = this.positionIdentity(row.ordinal);
      const manifest = this.controller?.chapter?.manifest;
      if (identity.length === 0 || this.controller === undefined || manifest === undefined) return false;
      this.confirmedPosition = { controller: this.controller, manifest, identity, anchor: this.visibleAnchor };
      this.displayedPage = row.ordinal;
      if (this.seekingPage === row.ordinal) this.seekingPage = undefined;
      return true;
    } catch (_error) {
      // Unknown geometry must not erase an already measured intra-image anchor.
      if (this.visibleAnchor?.ordinal !== row.ordinal) this.visibleAnchor = { ordinal: row.ordinal, y: 0 };
      return false;
    }
  }
  private resizeViewport(width: number, height: number = this.viewportHeight): void {
    if (!Number.isFinite(width) || width <= 0 || !Number.isFinite(height) || height <= 0 || (width === this.viewportWidth && height === this.viewportHeight)) return;
    // The new layout's rectangles cannot reconstruct the old clipped position.
    // Use the logical coordinate captured while the previous width was active.
    const anchor = this.visibleAnchor;
    this.viewportWidth = width; this.viewportHeight = height;
    if (this.opened && anchor !== undefined) this.restore(anchor.ordinal, anchor.y, anchor.x ?? 0);
  }
  private restore(ordinal: number, y: number, x: number = 0): void {
    this.visibleAnchor = { ordinal, y, x };
    this.restoringAnchor = true;
    this.appliedLayoutGeneration = -1;
    const generation = ++this.layoutGeneration;
    setTimeout((): void => {
      if (!this.mounted || generation !== this.layoutGeneration) return;
      const index = this.data.projection.index(ordinal, y);
      // Seed before scrolling: a synchronous onScrollIndex owns the measured
      // range, and restoring the same first row must not erase its visible tail.
      if (this.first !== index) this.last = index;
      this.first = index;
      this.refreshLoginRequiredForControls();
      this.scroller.scrollToIndex(index, false, ScrollAlign.START);
      const row = this.data.getData(index);
      if (row.known) this.scroller.scrollBy(0, Math.max(0, y * row.sourceHeight - row.sourceY) * this.rowDisplayWidth(row) / row.width + (y > 0 ? this.rowDisplayTop(row) : 0));
      this.horizontalScroller.scrollTo({ xOffset: x * this.rowDisplayWidth(row) + this.rowDisplayLeft(row), yOffset: 0, animation: false });
      this.appliedLayoutGeneration = generation;
      this.updateViewport();
      this.finishLayout(generation);
    }, 0);
  }
  private finishLayout(generation: number): void {
    this.getUIContext().postFrameCallback(new MangaLayoutFrame((): void => {
      if (!this.mounted || generation !== this.layoutGeneration) return;
      this.onViewportScroll();
    }));
  }
  private onViewportScroll(): void {
    this.refreshLoginRequiredForControls();
    if (this.visibleAnchor !== undefined) this.displayedPage = this.visibleAnchor.ordinal;
    if (!this.restoringAnchor) { this.rememberVisible(); return; }
    if (this.appliedLayoutGeneration !== this.layoutGeneration || !this.measureVisibleWindow()) return;
    if (this.rememberVisible(true)) this.restoringAnchor = false;
  }
  private queueViewportObservation(): void {
    if (!this.mounted || this.viewportObservationPending) return;
    this.viewportObservationPending = true;
    const generation = ++this.viewportObservationGeneration;
    // Native input/scroll callbacks can arrive from both nested scrollers in
    // one frame. Observe only the latest layout after those callbacks finish.
    this.getUIContext().postFrameCallback(new MangaLayoutFrame((): void => {
      if (generation !== this.viewportObservationGeneration) return;
      this.viewportObservationPending = false;
      if (this.mounted) this.onViewportScroll();
    }));
  }
  private flushViewportObservation(): void {
    this.viewportObservationGeneration++; this.viewportObservationPending = false;
    this.onViewportScroll();
  }
  private onViewportTouch(): void {
    this.seekingPage = undefined;
    this.presentationGeneration++;
    this.pendingTurnOrdinal = undefined; this.mountedTurnRowKey = '';
    const generation = ++this.layoutGeneration;
    if (this.restoringAnchor) {
      // Cancel the queued scroll, but do not declare the new geometry stable.
      this.appliedLayoutGeneration = generation;
      this.finishLayout(generation);
    }
  }
  private requestedLast(): number {
    return Math.min(this.data.totalCount() - 1, this.last + 1, this.first + 7);
  }
  private onRowAppear(index: number): void {
    if (!this.mounted || index < 0 || index >= this.data.totalCount()) return;
    const row = this.data.getData(index);
    if (this.seekingPage !== undefined && row.ordinal !== this.seekingPage) return;
    if (this.horizontal && this.pendingTurnOrdinal === row.ordinal && row.tileIndex === 0) {
      this.mountedTurnRowKey = row.key;
      this.confirmMountedTurn(row);
    }
    if (!row.known || this.controller?.tile(row.ordinal, row.tileIndex) !== undefined) return;
    // A native List item can mount before its range callback reports the new
    // layout (especially while restoring an anchor). Demand the mounted tile
    // directly so it cannot remain a spinner with no pending decode.
    if (index < this.first || index > this.first + 7) {
      this.first = index; this.last = index;
      this.refreshLoginRequiredForControls();
    }
    else this.last = Math.max(this.last, index);
    void this.updateViewport();
  }
  private confirmMountedTurn(row: MangaStripRow): void {
    const controller = this.controller;
    const manifest = controller?.chapter?.manifest;
    if (!this.mounted || !this.horizontal || controller === undefined || manifest === undefined || !row.known ||
      row.tileIndex !== 0 || row.ordinal !== this.horizontalPage || row.ordinal !== this.pendingTurnOrdinal ||
      row.key !== this.mountedTurnRowKey || controller.tile(row.ordinal, 0)?.image === undefined) return;
    const identity = this.positionIdentity(row.ordinal);
    if (identity.length === 0) return;
    // The selected ListItem has mounted with its decoded image. It is safe to
    // retain the page start while native geometry is still settling; a later
    // measured rectangle may refine the x/y coordinate.
    const anchor: MangaViewportAnchor = { ordinal: row.ordinal, y: 0, x: 0 };
    this.visibleAnchor = anchor;
    this.confirmedPosition = { controller, manifest, identity, anchor };
    this.pendingTurnOrdinal = undefined; this.mountedTurnRowKey = '';
  }
  private measureVisibleWindow(): boolean {
    if (this.viewportHeight <= 1 || this.data.totalCount() === 0) return false;
    try {
      const first = this.scroller.getItemIndex(0.5, 0.5);
      if (!Number.isSafeInteger(first) || first < 0 || first >= this.data.totalCount()) return false;
      let last = this.scroller.getItemIndex(0.5, this.viewportHeight - 0.5);
      if (!Number.isSafeInteger(last) || last < first || last >= this.data.totalCount()) {
        // A short chapter can end above the bottom probe. Only inspect the
        // existing bounded tile window; never scan the chapter to find an end.
        last = first;
        for (let index = first + 1; index <= Math.min(this.data.totalCount() - 1, first + 7); index++) {
          const rect = this.scroller.getItemRect(index);
          if (!Number.isFinite(rect.y) || !Number.isFinite(rect.height) || rect.height <= 0 ||
            rect.y >= this.viewportHeight || rect.y + rect.height <= 0) break;
          last = index;
        }
      }
      if (this.first === first && this.last === last) return true;
      this.first = first; this.last = last;
      this.refreshLoginRequiredForControls();
      this.updateViewport();
      return true;
    } catch (_error) { return false; /* Unmounted geometry leaves the last observed range intact. */ }
  }
  private async updateViewport(): Promise<void> {
    const controller = this.controller;
    // The initial projection can mount rows while openPrepared() is still
    // admitting the saved page. Native callbacks must not supersede that
    // selection before the opening transaction completes.
    if (!this.mounted || !this.opened || controller === undefined || this.data.totalCount() === 0) return;
    // Error-card ownership follows the actual viewport even when no image
    // geometry or tile lease changes can produce a Controller publication.
    this.notifyPublishedRows(false);
    const generation = ++this.viewportGeneration;
    const row = this.data.getData(Math.min(this.first, this.data.totalCount() - 1));
    try {
      // A tall viewport may display more than the metadata prefetch window of
      // three pages. Keep its exact existing tiles until the new window commits.
      const retained: MangaTileRequest[] = [];
      for (let index = this.first; index <= this.requestedLast(); index++) {
        const item = this.data.getData(index);
        if (item.known) retained.push({ ordinal: item.ordinal, tileIndex: item.tileIndex });
      }
      await controller.setVisible(row.ordinal, retained);
      if (!this.mounted || generation !== this.viewportGeneration) return;
      const requested: MangaTileRequest[] = [];
      for (let index = this.first; index <= this.requestedLast(); index++) {
        const item = this.data.getData(index);
        if (item.known) requested.push({ ordinal: item.ordinal, tileIndex: item.tileIndex });
      }
      await controller.setTileWindow(requested);
      if (this.mounted && generation === this.viewportGeneration && !this.chapterCommitted &&
        controller.tile(row.ordinal, row.tileIndex)?.image !== undefined && controller.chapter !== undefined) {
        this.chapterCommitted = true;
        this.onChapterCommitted(controller.chapter.chapterIndex,
          this.displayChapterTitle(controller.chapter.chapterIndex, controller.chapter.chapterTitle));
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : '图片加载失败';
      // A newer controller selection can cancel this window before its own
      // viewport callback runs. Cancellation is not a failure of visible pixels.
      if (message !== 'MANGA_SESSION_CANCELLED' && this.mounted && generation === this.viewportGeneration)
        this.error = message;
    }
  }
  private async saveVisible(): Promise<void> {
    if (!this.opened || this.recovering || this.controller === undefined || this.data.totalCount() <= this.first) return;
    try {
      if (!this.restoringAnchor && !this.rememberVisible()) return;
      const confirmed = this.confirmedPosition;
      if (confirmed === undefined || confirmed.controller !== this.controller ||
        confirmed.manifest !== this.controller.chapter?.manifest ||
        confirmed.identity !== this.positionIdentity(confirmed.anchor.ordinal) ||
        (this.horizontal && confirmed.anchor.ordinal !== this.horizontalPage)) return;
      const anchor = confirmed.anchor;
      const presentationGeneration = this.presentationGeneration;
      await this.controller.savePosition(anchor.ordinal, anchor.x ?? 0, anchor.y).then((): void => {
        const controller = confirmed.controller;
        const chapter = controller.chapter;
        const location = controller.savedLocation;
        if (chapter !== undefined && chapter.manifest === confirmed.manifest && location !== undefined && location !== null) {
          const presentationRevision = MangaBookPresentation.revision;
          MangaBookPresentation.admitConfirmedLocation(this.sourceId, this.bookId, location, chapter, controller.totalPages, controller.pageAt(location.pageOrdinalFallback));
          if (MangaBookPresentation.revision !== presentationRevision)
            AppStorage.setOrCreate('readerMangaPresentationRevision', MangaBookPresentation.revision);
        }
      }).catch((error: Error): void => {
        if (error.message !== 'MANGA_POSITION_NOT_VISIBLE') {
          // The old page's content fence may be revoked while a later image is
          // already mounted. Do not attribute that cancellation to the new page.
          if (error.message === 'MANGA_SESSION_CANCELLED' &&
            (!this.mounted || this.controller !== confirmed.controller ||
              this.presentationGeneration !== presentationGeneration || this.confirmedPosition !== confirmed ||
              (this.horizontal && this.horizontalPage !== anchor.ordinal))) {
            // The CAS receipt may still be uncertain. Keep the owner's failure
            // record even though the old page cannot own the current banner.
            this.onSaveFailure(error.message);
            return;
          }
          if (this.mounted) this.error = error.message;
          this.onSaveFailure(error.message);
        }
      });
    } catch (_error) { /* Geometry has not been admitted; never replace the saved anchor. */ }
  }
  private effectiveFit(): 'width' | 'contain' {
    if (this.fitPreference === 'width' || this.fitPreference === 'contain') return this.fitPreference;
    return this.controller?.chapter?.manifest.displayHints?.fit === 'contain' ? 'contain' : 'width';
  }
  private rowDisplayWidth(row: MangaStripRow): number {
    return this.zoom * (this.effectiveFit() === 'contain' && row.known && this.viewportHeight > 1 ?
      Math.min(this.viewportWidth, this.viewportHeight * row.width / row.sourceHeight) : this.viewportWidth);
  }
  private rowDisplayHeight(row: MangaStripRow): number {
    const height = this.rowDisplayWidth(row) * row.height / row.width;
    return this.effectiveFit() === 'contain' ? Math.max(height, this.viewportHeight * this.zoom) : height;
  }
  private rowDisplayTop(row: MangaStripRow): number { return (this.rowDisplayHeight(row) - this.rowDisplayWidth(row) * row.height / row.width) / 2; }
  private rowDisplayLeft(row: MangaStripRow): number { return (this.viewportWidth * this.zoom - this.rowDisplayWidth(row)) / 2; }
  private visibleX(row: MangaStripRow): number {
    return Math.max(0, Math.min(1, (this.horizontalScroller.currentOffset().xOffset - this.rowDisplayLeft(row)) / this.rowDisplayWidth(row)));
  }
  private async changeFit(requestedFit?: 'source' | 'width' | 'contain'): Promise<void> {
    this.pendingTurnOrdinal = undefined; this.mountedTurnRowKey = '';
    this.rememberVisible();
    const anchor = this.visibleAnchor;
    // Freeze the accepted old tile before preview mode releases its lease.
    // The existing controller lane owns this write even if the view exits.
    void this.saveVisible();
    const generation = ++this.presentationGeneration;
    this.layoutGeneration++; this.appliedLayoutGeneration = -1; this.restoringAnchor = true;
    const chapter = this.controller?.chapter;
    this.fitPreference = requestedFit ?? (this.fitPreference === 'source' ? 'width' : this.fitPreference === 'width' ? 'contain' : 'source');
    this.settingsGateway?.updateMangaFit(this.fitPreference).catch((error: Error): void => { if (this.mounted) this.error = error.message; });
    const controller = this.controller;
    try { await controller?.setPreviewMode(this.effectiveFit() === 'contain', anchor?.ordinal ?? this.horizontalPage); }
    catch (error) { if (this.mounted) this.error = error instanceof Error ? error.message : '漫画布局失败'; }
    if (!this.mounted || this.controller !== controller || controller?.chapter !== chapter || generation !== this.presentationGeneration) return;
    if (anchor !== undefined) this.restore(anchor.ordinal, anchor.y, anchor.x ?? 0);
  }
  private loginRequired(): boolean {
    if (this.offline) return false;
    const errors = [this.error];
    if (this.data.totalCount() > this.first) errors.push(this.imageError(this.data.getData(this.first)));
    return errors.some(code => code === 'READING_IMAGE_AUTH_REQUIRED' || code === 'READING_IMAGE_ACCESS_DENIED');
  }
  private async loginAndRetry(): Promise<void> {
    if (this.loggingIn || !this.loginRequired() || this.controller === undefined || this.data.totalCount() <= this.first) return;
    const controller = this.controller;
    const row = this.data.getData(this.first);
    const manifestVersion = controller.chapter?.manifest.manifestVersion;
    const first = this.first;
    const generation = ++this.loginGeneration;
    this.loggingIn = true;
    try {
      await this.onLoginSource();
      if (!this.mounted || generation !== this.loginGeneration || this.controller !== controller || this.first !== first || controller.chapter?.manifest.manifestVersion !== manifestVersion) return;
      await (row.known ? controller.retryTile(row.ordinal, row.tileIndex) : controller.retry(row.ordinal));
      if (this.mounted && generation === this.loginGeneration && this.controller === controller) { this.error = ''; await this.updateViewport(); }
    } catch (error) { if (this.mounted && generation === this.loginGeneration) this.error = error instanceof Error ? error.message : '漫画登录失败'; }
    finally { if (this.mounted && generation === this.loginGeneration) this.loggingIn = false; }
  }
  private async refreshImages(): Promise<void> {
    this.pendingTurnOrdinal = undefined; this.mountedTurnRowKey = '';
    const controller = this.controller;
    if (controller === undefined) return;
    const generation = ++this.presentationGeneration;
    const chapter = controller.chapter;
    const preserveNewerPosition = (): boolean => {
      const manifest = controller.chapter?.manifest;
      return generation !== this.presentationGeneration && manifest !== undefined && chapter !== undefined &&
        manifest.manifestVersion === chapter.manifest.manifestVersion &&
        manifest.chapter.sourceId === chapter.manifest.chapter.sourceId &&
        manifest.chapter.bookId === chapter.manifest.chapter.bookId &&
        manifest.chapter.chapterId === chapter.manifest.chapter.chapterId;
    };
    await this.saveVisible();
    if (!this.mounted || this.controller !== controller || controller.chapter !== chapter || generation !== this.presentationGeneration) return;
    await controller.refreshChapter();
    if (!this.mounted || this.controller !== controller) return;
    if (controller.replacementRecoveryRequired) {
      // The old chapter remains displayed until the existing recovery action
      // explicitly selects the complete new chapter. Keep its pixels/anchor.
      this.error = ''; this.recovering = true;
      return;
    }
    if (preserveNewerPosition()) return;
    await controller.setPreviewMode(this.effectiveFit() === 'contain', controller.displayedOrdinal);
    if (!this.mounted || this.controller !== controller || preserveNewerPosition()) return;
    this.error = ''; this.recovering = controller.recoveryRequired;
    const saved = !this.recovering ? controller.savedLocation : null;
    const ordinal = controller.displayedOrdinal;
    this.horizontalPage = ordinal;
    this.visibleAnchor = undefined;
    this.publish();
    this.restore(ordinal, saved?.y ?? 0, saved?.x ?? 0);
  }
  private displayError(code: string): string {
    if (code === 'MANGA_CHAPTER_CACHE_CAPACITY') return '整章加载已暂停，缓存空间不足，可清理缓存或下载保留。';
    if (code === 'MANGA_CHAPTER_PREPARATION_FAILED') return '整章加载暂未完成，已加载的内容仍可阅读。';
    const message = mangaUserError(code);
    if (message !== code && !this.reportedErrorCodes.has(code)) {
      this.reportedErrorCodes.add(code);
      hilog.warn(0x5244, 'Reader', 'Manga image unavailable: %{public}s', code);
    }
    return message;
  }
  private imageError(row: MangaStripRow): string {
    return this.controller?.tile(row.ordinal, row.tileIndex)?.error ??
      this.controller?.visiblePages().find(page => page.ordinal === row.ordinal)?.error ?? 'MANGA_IMAGE_FAILED';
  }
  private rowHasError(row: MangaStripRow): boolean {
    return this.controller?.tile(row.ordinal, row.tileIndex)?.error !== undefined ||
      this.controller?.visiblePages().some(page => page.ordinal === row.ordinal && page.status === 'failed') === true;
  }
  /** Keep a failed viewport readable: one visible error card owns the retry. */
  private primaryErrorRowKey(): string {
    const start = Math.max(0, this.first);
    const end = Math.min(this.data.totalCount() - 1, this.requestedLast());
    for (let candidate = start; candidate <= end; candidate++) {
      const row = this.data.getData(candidate);
      if (this.rowHasError(row)) return row.key;
    }
    return '';
  }
  private isPrimaryErrorRow(row: MangaStripRow): boolean {
    return this.rowHasError(row) && this.primaryErrorRowKey() === row.key;
  }
  private displayChapterTitle(index: number, title: string): string {
    const normalized = typeof title === 'string' ? title.trim() : '';
    if (normalized.length > 0 && !/^第\s*话$/.test(normalized)) return normalized;
    return `第${Math.max(1, index + 1)}话`;
  }
  private rowRenderKey(row: MangaStripRow): string {
    const tile = this.controller?.tile(row.ordinal, row.tileIndex);
    const pageError = this.controller?.visiblePages().find(page => page.ordinal === row.ordinal)?.error;
    // LazyForEach retains the old branch for an unchanged key, even after a
    // data notification. Keep logical page identity separate from presentation,
    // as ReaderContinuousReadingStage does for decoded inline images.
    return JSON.stringify([row.key, row.known, row.width, row.height, row.sourceY, row.sourceHeight,
      tile?.image?.fileUri ?? '', tile?.image?.revision ?? '', tile?.error ?? pageError ?? '',
      this.isPrimaryErrorRow(row)]);
  }
  private async handleBack(intent?: 'navigation'): Promise<void> {
    if (intent !== 'navigation') {
      if (this.panel.length > 0 || this.panelPhase === 'preparing') { void this.closePanel(); return; }
      if (this.chapterEnd) { this.chapterEnd = false; return; }
      if (this.zoom > 1) { this.changeZoom(1); return; }
    }
    if (this.exiting) return;
    this.exiting = true;
    try {
      if (!await this.performPanelAction(async (): Promise<void> => {
        await this.controller?.close();
        this.onBack();
      })) this.exiting = false;
    } catch (error) {
      this.exiting = false;
      if (this.mounted) this.error = error instanceof Error ? error.message : '漫画退出未完成';
    }
  }
  private changeZoom(scale: number): void {
    if (!Number.isFinite(scale) || scale <= 0) return;
    this.presentationGeneration++;
    this.pendingTurnOrdinal = undefined; this.mountedTurnRowKey = '';
    if (this.pinchAnchor === undefined) this.rememberVisible();
    const anchor = this.pinchAnchor ?? this.visibleAnchor;
    this.scalePolicy.setScale(scale, false);
    this.zoom = this.scalePolicy.scale;
    if (anchor !== undefined) this.restore(anchor.ordinal, anchor.y, anchor.x ?? 0);
  }
  private toggleDirection(): void {
    this.presentationGeneration++;
    this.pendingTurnOrdinal = undefined; this.mountedTurnRowKey = '';
    this.rememberVisible();
    const anchor = this.visibleAnchor;
    this.horizontalPage = anchor?.ordinal ?? 0;
    this.horizontal = !this.horizontal;
    this.settingsGateway?.updateMangaDirection(this.horizontal).catch((error: Error): void => { if (this.mounted) this.error = error.message; });
    this.first = 0; this.last = 0;
    const chapter = this.controller?.chapter;
    if (chapter === undefined) return;
    this.data.projection.publish(chapter.manifest, (index: number) => this.controller?.pageGeometry(index), this.horizontal ? this.horizontalPage : undefined, this.controller?.totalPages ?? chapter.manifest.pages.length, (ordinal: number) => this.controller?.pageAt(ordinal));
    this.refreshLoginRequiredForControls();
    this.data.notify(true, 0, 0);
    if (anchor !== undefined) this.restore(anchor.ordinal, anchor.y, anchor.x ?? 0);
  }
  private async turnPage(direction: number): Promise<void> {
    const controller = this.controller;
    const chapter = controller?.chapter;
    if (controller === undefined || chapter === undefined || !this.horizontal) return;
    const next = this.horizontalPage + direction;
    if (next < 0 || next >= controller.totalPages) return;
    const generation = ++this.presentationGeneration;
    const previous = this.horizontalPage;
    await this.saveVisible();
    if (!this.mounted || this.controller !== controller || controller.chapter !== chapter ||
      generation !== this.presentationGeneration || !this.horizontal || this.horizontalPage !== previous) return;
    this.horizontalPage = next;
    this.pendingTurnOrdinal = next; this.mountedTurnRowKey = '';
    this.visibleAnchor = undefined;
    this.first = 0; this.last = 0;
    this.data.projection.publish(chapter.manifest, (index: number) => controller.pageGeometry(index), next, controller.totalPages, (ordinal: number) => controller.pageAt(ordinal));
    this.refreshLoginRequiredForControls();
    this.data.notify(true, 0, 0);
    this.restore(next, 0);
  }
  private async openDirectory(): Promise<void> {
    await this.openPanel('directory');
  }
  private async openSourceSwitch(): Promise<void> {
    await this.performPanelAction((): void => this.onSwitchSource());
  }
  private retry(row: MangaStripRow): void {
    const controller = this.controller;
    const chapter = controller?.chapter;
    const generation = this.presentationGeneration;
    const previousError = this.error;
    const previousRowError = this.imageError(row);
    const current = (): boolean => this.mounted && this.controller === controller &&
      controller?.chapter === chapter && generation === this.presentationGeneration;
    const task = row.known ? controller?.retryTile(row.ordinal, row.tileIndex) : controller?.retry(row.ordinal);
    task?.then(async (): Promise<void> => {
      if (!current()) return;
      await this.updateViewport();
      // A successful tile retry replaces the failed presentation. Clear only
      // the global error that belongs to this same failed tile; unrelated
      // settings/save errors remain visible to the reader.
      if (current() && this.error === previousError && !this.rowHasError(row) &&
        (previousError.length === 0 || previousError === previousRowError)) this.error = '';
    }).catch((error: Error): void => { if (current() && error.message !== 'MANGA_SESSION_CANCELLED') this.error = error.message; });
  }
  private async retryOpen(): Promise<void> {
    const controller = this.controller;
    if (controller === undefined || this.opened || this.offline || this.openingRetry) return;
    this.openingRetry = true;
    this.error = '';
    controller.close('chapter');
    try {
      if (this.mounted && this.controller === controller) await this.open(controller);
    } finally {
      if (this.mounted && this.controller === controller) this.openingRetry = false;
    }
  }
  private async confirmRecovery(): Promise<void> {
    const controller = this.controller;
    if (!this.recovering || controller === undefined || this.data.totalCount() <= this.first) return;
    const ordinal = this.data.getData(this.first).ordinal;
    const generation = this.presentationGeneration;
    const current = (): boolean => this.mounted && this.controller === controller &&
      generation === this.presentationGeneration;
    try {
      if (controller.replacementRecoveryRequired) {
        await controller.confirmReplacement();
        if (!current()) return;
        this.visibleAnchor = undefined; this.publish(); this.restore(0, 0, 0);
      } else await controller.selectPage(ordinal);
      if (!current()) return;
      // A signed-image retry may replace the manifest during confirmation.
      // The controller retains recovery until that newer identity is proven.
      this.recovering = controller.recoveryRequired;
      if (!this.recovering) await this.saveVisible();
    } catch (error) {
      const message = error instanceof Error ? error.message : '漫画加载失败';
      if (current() && message !== 'MANGA_SESSION_CANCELLED') this.error = message;
    }
  }
  private toggleControls(): void {
    if (this.panel.length > 0 || this.chapterEnd) return;
    this.controlsVisible = !this.controlsVisible;
  }
  private controlsPresentedForWindow(): boolean {
    return !this.chapterEnd && (this.controlsVisible || this.error.length > 0 || this.openingRetry ||
      this.recovering || this.loginRequiredForControls || this.panel.length > 0);
  }
  private refreshLoginRequiredForControls(): void {
    if (!this.mounted) return;
    const required = this.loginRequired();
    if (required !== this.loginRequiredForControls) this.loginRequiredForControls = required;
  }
  private onWindowChromeChanged(): void {
    if (!this.mounted || this.isReaderIdentityCurrent?.() === false) return;
    this.refreshLoginRequiredForControls();
    this.applyWindowChrome();
    this.applyWindowPolicyForChromeOwner();
  }
  private applyWindowChrome(): void {
    if (!this.mounted || this.isReaderIdentityCurrent?.() === false) return;
    if (!this.windowChromeActive) { this.restoreAppWindowChrome(); return; }
    this.windowChromeOwned = true;
    // Keep the manga surface immersive while controls are hidden, but paint an
    // opaque paper-colored native band whenever the controls/chapter-end or an
    // overlay is presented. The content remains full-window in both states.
    const presented = this.controlsPresentedForWindow() || this.chapterEnd || this.windowChromeOverlayActive;
    const style = new ReaderWindowChromeStyle(this.paperColor(),
      this.backgroundPreference === 'ink' ? 'light' : 'dark', this.inkColor(), '', !presented);
    if (this.windowChromeOverlayActive) ReaderWindowCoordinator.requestOverlayChrome(style);
    else ReaderWindowCoordinator.requestReaderChrome(style);
  }
  private applyWindowPolicyForChromeOwner(): void {
    if (!this.mounted || this.isReaderIdentityCurrent?.() === false) return;
    if (!this.windowChromeActive) { this.restoreAppWindowChrome(); return; }
    this.windowChromeOwned = true;
    const presented = this.controlsPresentedForWindow() || this.chapterEnd || this.windowChromeOverlayActive;
    // Manga retains the existing default orientation/awake semantics. These
    // runtime visibility requests never write reading settings/preferences.
    void ReaderWindowCoordinator.requestReaderWindowPolicy(
      new ReaderWindowPolicy('system', false, !presented, !presented, true))
      .catch((error: Error): void => {
        hilog.warn(0x5244, 'Reader', 'Manga system bars: %{private}s', error.message);
      });
  }
  private restoreAppWindowChrome(): void {
    const owned = this.windowChromeOwned;
    this.windowChromeOwned = false;
    if (!owned || this.isReaderIdentityCurrent?.() === false) return;
    ReaderWindowCoordinator.requestAppChrome();
    void ReaderWindowCoordinator.requestAppWindowPolicy()
      .catch((error: Error): void => {
        hilog.warn(0x5244, 'Reader', 'Manga window restore: %{private}s', error.message);
      });
  }
  private pageOrdinal(): number {
    return this.horizontal ? this.horizontalPage : this.displayedPage;
  }
  private async seekPage(ordinal: number): Promise<void> {
    const controller = this.controller;
    const chapter = controller?.chapter;
    if (controller === undefined || chapter === undefined || !this.opened ||
      !Number.isSafeInteger(ordinal) || ordinal < 0 || ordinal >= controller.totalPages) return;
    if (this.horizontal) { await this.turnPage(ordinal - this.horizontalPage); return; }
    const generation = ++this.presentationGeneration;
    await this.saveVisible();
    if (!this.mounted || this.controller !== controller || controller.chapter !== chapter || generation !== this.presentationGeneration) return;
    // Freeze the explicit seek anchor before async geometry publication.
    // Existing publish/restore fencing must not re-adopt the old native row.
    this.seekingPage = ordinal;
    this.visibleAnchor = { ordinal, x: 0, y: 0 };
    this.restoringAnchor = true;
    this.appliedLayoutGeneration = -1;
    this.layoutGeneration++;
    this.first = this.data.projection.index(ordinal, 0); this.last = this.first;
    this.notifyPublishedRows(false);
    try { await controller.setVisible(ordinal); }
    catch (error) {
      const message = error instanceof Error ? error.message : '图片加载失败';
      if (this.mounted && generation === this.presentationGeneration && message !== 'MANGA_SESSION_CANCELLED') { this.seekingPage = undefined; this.error = message; }
      return;
    }
    if (!this.mounted || this.controller !== controller || controller.chapter !== chapter || generation !== this.presentationGeneration) return;
    this.restore(ordinal, 0, 0);
  }
  private async stepPage(direction: number): Promise<void> {
    const ordinal = this.pageOrdinal() + direction;
    if (ordinal >= this.horizontalPageCount) { await this.openChapterEnd(); return; }
    await this.seekPage(ordinal);
  }
  private adjacentChapter(direction: number): RemoteReadingTocEntry | undefined {
    const current = this.controller?.chapter;
    const session = this.remoteSession;
    if (current === undefined || session?.contentKind !== 'manga' ||
      session.identity.sourceId !== this.sourceId || session.identity.bookId !== this.bookId ||
      session.requiresContextRefresh === true) return undefined;
    const position = session.entries.findIndex((entry: RemoteReadingTocEntry): boolean =>
      entry.index === current.chapterIndex && entry.url === current.manifest.chapter.chapterId);
    if (position < 0) return undefined;
    const entries = direction > 0 ? session.entries.slice(position + 1) : session.entries.slice(0, position).reverse();
    return entries.find((entry: RemoteReadingTocEntry): boolean => entry.navigable !== false &&
      entry.url.trim().length > 0 && entry.url !== current.manifest.chapter.chapterId);
  }
  private async openChapterEnd(): Promise<void> {
    if (!this.opened || this.pageOrdinal() + 1 !== this.horizontalPageCount ||
      this.confirmedPosition?.anchor.ordinal !== this.pageOrdinal()) return;
    await this.performPanelAction((): void => { this.chapterEnd = true; });
  }
  private async selectAdjacentChapter(direction: number): Promise<void> {
    if (this.adjacentChapter(direction) === undefined) return;
    await this.performPanelAction((): void => { this.chapterEnd = false; this.onChapter(direction); });
  }
  private async selectDirectoryTarget(index: number, proof?: JsonObject, fromCatalog: boolean = false): Promise<void> {
    if (fromCatalog) {
      if (!this.persistentDirectory() || (this.panelPhase !== 'closed' && this.panelPhase !== 'open')) return;
    } else if (this.panelPhase !== 'open' || this.panel !== 'directory') return;
    await this.performPanelAction((): void => { this.chapterEnd = false; this.onSelectDirectoryTarget(index, proof); });
  }
  private async openPanel(panel: string): Promise<void> {
    if (!this.mounted) return;
    this.invalidatePanelMotion();
    const generation = this.panelGeneration;
    this.panelPhase = 'preparing';
    // Saving still belongs to the existing position owner, and does not delay
    // the presentation while storage is slow. Its failure receipt is retained.
    void this.saveVisible();
    await this.dismissPanelKeyboard();
    if (!await this.preparePanelFonts()) {
      if (this.mounted && generation === this.panelGeneration) this.panelPhase = 'closed';
      return;
    }
    if (!this.mounted || generation !== this.panelGeneration) return;
    this.controlsVisible = true; this.chapterEnd = false;
    if (panel === 'directory') { this.directoryQuery = ''; this.directoryOpenRevision += 1; }
    this.panel = panel;
    this.panelPhase = 'opening';
    this.panelOffset = this.panelTravel(); this.panelScrimOpacity = 0;
    if (this.reduceMotion) { this.panelOffset = 0; this.panelScrimOpacity = 1; this.panelPhase = 'open'; return; }
    this.getUIContext().postFrameCallback(new MangaSheetFrame((): void => {
      if (!this.mounted || generation !== this.panelGeneration || this.panelPhase !== 'opening') return;
      // onFrame runs before that frame's build/layout. Keep the screen-out
      // endpoint through this whole frame, then animate in the following one.
      this.getUIContext().postFrameCallback(new MangaSheetFrame((): void => {
        if (!this.mounted || generation !== this.panelGeneration || this.panelPhase !== 'opening') return;
        this.getUIContext().animateTo({ duration: 160, curve: Curve.EaseInOut }, (): void => { this.panelScrimOpacity = 1; });
        this.settlePanel(generation);
      }));
    }));
  }
  private async showDetail(): Promise<void> {
    await this.performPanelAction((): void => this.onDetail());
  }
  private invalidatePanelMotion(): void {
    this.panelGeneration++; this.panelActionGeneration++;
    const resolve = this.panelCloseResolve;
    this.panelCloseResolve = undefined; this.panelCloseTask = undefined;
    if (resolve !== undefined) resolve(false);
  }
  private async dismissPanelKeyboard(): Promise<void> {
    try {
      this.getUIContext().getFocusController().clearFocus();
      await inputMethod.getController().hideTextInput();
    }
    catch (error) {
      hilog.warn(0x5244, 'Reader', 'Manga sheet keyboard dismissal: %{private}s', error instanceof Error ? error.message : 'unavailable');
    }
  }
  private async preparePanelFonts(): Promise<boolean> {
    if (!this.mounted) return false;
    if (this.panelFontsReady) return true;
    const generation = ++this.panelFontGeneration;
    try {
      const ready = await prepareMangaSheetFonts();
      if (!this.mounted || generation !== this.panelFontGeneration) return false;
      this.panelFontsReady = ready;
      if (!ready) hilog.warn(0x5244, 'Reader', 'Manga sheet static font receipt unavailable');
      return ready;
    } catch (error) {
      if (this.mounted && generation === this.panelFontGeneration)
        hilog.warn(0x5244, 'Reader', 'Manga sheet font preparation: %{private}s', error instanceof Error ? error.message : 'unavailable');
      return false;
    }
  }
  private panelTravel(): number {
    return (this.widePanel() ? Number(this.panelWidth()) : this.panelHeight()) + 36;
  }
  private settlePanel(generation: number): void {
    this.getUIContext().animateTo({ curve: curves.interpolatingSpring(0, 0.9, 500, 43), onFinish: (): void => {
      if (this.mounted && generation === this.panelGeneration && this.panelPhase === 'opening') this.panelPhase = 'open';
    } }, (): void => { this.panelOffset = 0; });
  }
  private closePanel(): Promise<boolean> {
    if (!this.mounted) return Promise.resolve(false);
    if (this.panelPhase === 'closing' && this.panelCloseTask !== undefined) return this.panelCloseTask;
    const generation = ++this.panelGeneration;
    if (this.panel.length === 0) { this.panelPhase = 'closed'; return Promise.resolve(true); }
    this.panelPhase = 'closing';
    void this.dismissPanelKeyboard();
    if (this.reduceMotion) {
      this.panel = ''; this.panelOffset = 0; this.panelScrimOpacity = 0; this.panelPhase = 'closed';
      return Promise.resolve(true);
    }
    this.panelCloseTask = new Promise<boolean>((resolve): void => {
      this.panelCloseResolve = resolve;
      this.getUIContext().animateTo({ duration: 160, curve: Curve.EaseInOut }, (): void => { this.panelScrimOpacity = 0; });
      this.getUIContext().animateTo({ curve: curves.interpolatingSpring(0, 1.05, 250, 30), onFinish: (): void => {
        if (!this.mounted || generation !== this.panelGeneration) { resolve(false); return; }
        this.panel = ''; this.panelOffset = 0; this.panelPhase = 'closed';
        this.panelCloseResolve = undefined; this.panelCloseTask = undefined;
        resolve(true);
      } }, (): void => { this.panelOffset = this.panelTravel(); });
    });
    return this.panelCloseTask;
  }
  private async performPanelAction(action: () => void | Promise<void>): Promise<boolean> {
    if (!this.mounted || this.panelPhase === 'closing') return false;
    const request = ++this.panelActionGeneration;
    const controller = this.controller; const chapter = controller?.chapter;
    const saving = this.saveVisible();
    const closing = this.closePanel(); const generation = this.panelGeneration;
    const closed = await closing;
    await saving;
    if (!closed || !this.mounted || generation !== this.panelGeneration || request !== this.panelActionGeneration ||
      this.controller !== controller || controller?.chapter !== chapter || this.panel.length > 0) return false;
    await action(); return true;
  }
  private beginPanelDrag(): void {
    if (this.widePanel() || this.panelPhase !== 'open') return;
    this.panelGeneration++; this.panelPhase = 'dragging';
  }
  private updatePanelDrag(offset: number): void {
    if (this.panelPhase !== 'dragging' || !Number.isFinite(offset)) return;
    const target = Math.max(0, offset);
    if (this.reduceMotion || target === this.panelOffset) { this.panelOffset = target; return; }
    this.getUIContext().animateTo({ curve: curves.interpolatingSpring(0, 0.9, 500, 43) },
      (): void => { this.panelOffset = target; });
  }
  private finishPanelDrag(offset: number, velocity: number): void {
    if (this.panelPhase !== 'dragging') return;
    if (Math.max(0, offset) > 96 || velocity > 550) { void this.closePanel(); return; }
    this.panelPhase = 'opening';
    if (this.reduceMotion) { this.panelOffset = 0; this.panelPhase = 'open'; return; }
    this.settlePanel(this.panelGeneration);
  }
  private paperColor(): string {
    return this.backgroundPreference === 'ink' ? '#1C1E1A' : this.backgroundPreference === 'white' ? '#FFFFFF' : '#F8F4EC';
  }
  private surfaceColor(): string { return this.backgroundPreference === 'ink' ? '#282C25' : '#FFFCF8'; }
  private inkColor(): string { return this.backgroundPreference === 'ink' ? '#EAE7DE' : '#1F1B17'; }
  private mutedColor(): string { return this.backgroundPreference === 'ink' ? '#ABA99F' : '#756F69'; }
  private faintColor(): string { return this.backgroundPreference === 'ink' ? '#767D71' : '#A39C90'; }
  private lineColor(): string { return this.backgroundPreference === 'ink' ? '#3B4036' : '#E7E0D5'; }
  private softSurfaceColor(): string { return this.backgroundPreference === 'ink' ? '#30342D' : '#F0ECE3'; }
  private greenColor(): string { return this.backgroundPreference === 'ink' ? '#324C37' : '#1F3528'; }
  private accentColor(): string { return this.backgroundPreference === 'ink' ? '#B9CEB1' : '#425D45'; }
  private isSheetChoiceSelected(kind: string): boolean {
    if (kind === 'vertical') return !this.horizontal;
    if (kind === 'horizontal') return this.horizontal;
    if (kind === 'sun') return this.backgroundPreference === 'paper';
    return this.backgroundPreference === 'ink';
  }
  private choiceIcon(kind: string): Resource {
    const selected = this.isSheetChoiceSelected(kind);
    const night = this.backgroundPreference === 'ink';
    if (kind === 'vertical') return selected ? $r('app.media.manga_sheet_vertical_active') : night ? $r('app.media.manga_sheet_vertical_theme_night') : $r('app.media.manga_sheet_vertical');
    if (kind === 'horizontal') return selected ? $r('app.media.manga_sheet_horizontal_active') : night ? $r('app.media.manga_sheet_horizontal_theme_night') : $r('app.media.manga_sheet_horizontal');
    if (kind === 'sun') return selected ? $r('app.media.manga_sheet_sun_active') : night ? $r('app.media.manga_sheet_sun_theme_night') : $r('app.media.manga_sheet_sun');
    return selected ? $r('app.media.manga_sheet_moon_active') : night ? $r('app.media.manga_sheet_moon_theme_night') : $r('app.media.manga_sheet_moon');
  }
  private persistentDirectory(): boolean {
    return mangaUsesPersistentDirectory(this.stageWidth, this.stageHeight, deviceInfo.deviceType === 'tablet');
  }
  private directoryColumnWidth(): number { return mangaDirectoryColumnWidth(this.stageWidth); }
  private widePanel(): boolean { return this.persistentDirectory() || this.viewportWidth >= 600 || this.viewportWidth > this.viewportHeight; }
  private panelWidth(): number | string {
    if (!this.widePanel()) return '100%';
    return this.stageWidth <= 700 ? Math.min(320, this.stageWidth * 0.85) :
      Math.max(240, Math.min(this.persistentDirectory() ? 340 : 320, this.stageWidth * 0.45));
  }
  private panelContentInset(): number { return this.widePanel() ? this.stageWidth <= 700 ? 16 : 20 : 18; }
  // The demo snap is a maximum, not a forced empty sheet height.
  private panelHeight(): number {
    const snap = this.panel === 'directory' ? 0.78 : this.panel === 'mode' || this.panel === 'settings' ? 0.67 : 0.5;
    return this.widePanel() ? this.viewportHeight : Math.max(260, Math.round(this.viewportHeight * snap));
  }
  private panelContentHeight(): number {
    const insets = this.panelInsets(this.windowMetricsRevision);
    return Math.max(1, this.panelHeight() - insets.bottom - (this.widePanel() ? insets.top : 0));
  }
  private panelInsets(revision: number): ReaderInsetsVp {
    const insets = this.interactiveInsets(revision);
    // A right-side sheet does not touch the window's left cutout band.
    if (this.widePanel()) {
      insets.left = Math.max(0, insets.left - Math.max(0, this.viewportWidth - Number(this.panelWidth())));
    }
    return insets;
  }
  private panelTitle(): string {
    return this.panel === 'directory' ? '章节目录' : this.panel === 'mode' ? '阅读方式' : this.panel === 'settings' ? '漫画阅读设置' :
      this.panel === 'downloads' ? this.downloadActionsChapterIndex === undefined ? '本书下载' : '本话下载' : '更多';
  }
  private chapterEndLabel(): string {
    const title = this.title.trim();
    const separator = title.indexOf(' · ');
    return separator > 0 ? title.slice(0, separator) : title || '本话';
  }
  private chapterEndTypeLabel(): string {
    return this.title.includes('卷') ? '本卷已读完' : '本话已读完';
  }
  private adjacentLabel(): string {
    const entry = this.adjacentChapter(1);
    return entry === undefined ? '' : entry.title.includes('卷') ? `下一卷 · ${entry.title}` : `下一话 · ${entry.title}`;
  }
  private adjacentActionLabel(): string {
    const entry = this.adjacentChapter(1);
    return entry === undefined || !entry.title.includes('卷') ? '继续阅读下一话' : '继续阅读下一卷';
  }
  private directoryEntries(): LocalReadingTocEntry[] {
    const projection: Map<number, LocalReadingTocEntry> = new Map();
    for (const row of this.directoryProjection ?? []) projection.set(row.index, row);
    return (this.remoteSession?.entries ?? []).map((entry: RemoteReadingTocEntry): LocalReadingTocEntry => {
      const row = projection.get(entry.index);
      return { index: entry.index, title: entry.title, level: entry.level, navigable: entry.navigable,
        downloadState: row?.title === entry.title ? row.downloadState : 'unknown' };
    });
  }

  private async openDownloadActions(chapterIndex?: number): Promise<void> {
    if (!this.mounted || !this.downloadEnabled || !this.isReaderIdentityCurrent()) return;
    const generation = ++this.downloadActionsGeneration;
    this.downloadActionsChapterIndex = chapterIndex;
    this.downloadActions = []; this.downloadActionsFailure = ''; this.downloadActionsLoading = true;
    await this.openPanel('downloads');
    const current = (): boolean => this.mounted && !this.exiting && this.isReaderIdentityCurrent() &&
      generation === this.downloadActionsGeneration && this.panel === 'downloads';
    if (!current()) return;
    try {
      const actions = await this.onLoadDownloadActions(chapterIndex);
      if (current()) this.downloadActions = actions;
    } catch (_) {
      if (current()) this.downloadActionsFailure = '下载状态暂时无法读取，请重试';
    } finally {
      if (current()) this.downloadActionsLoading = false;
    }
  }

  private performDownloadAction(action: MangaDownloadActionId): void {
    if (!this.mounted || !this.downloadEnabled || this.exiting || this.panel !== 'downloads' || !this.isReaderIdentityCurrent() ||
      this.downloadActionsLoading || !this.downloadActions.some(item => item.id === action)) return;
    const chapterIndex = this.downloadActionsChapterIndex;
    void this.performPanelAction((): Promise<void> => this.onDownloadAction(action, chapterIndex)).catch((): void => {
      // Index owns operation feedback; the current reading content remains.
    });
  }
  private loadBrightness(): void {
    this.brightnessOwner = ReaderWindowCoordinator.brightness().claim();
    const owner = this.brightnessOwner;
    void ReaderWindowCoordinator.brightness().read(owner).then((result): void => {
      if (!this.mounted || owner !== this.brightnessOwner || !result.applied) return;
      this.automaticBrightness = result.value < 0;
      if (result.value >= 0) this.brightnessPercent = readerBrightnessControlPercent(result.value);
    }).catch((error: Error): void => { if (this.mounted) this.error = error.message; });
  }
  private setBrightness(percent: number, automatic: boolean = false): void {
    if (this.brightnessOwner === 0 || !this.mounted) return;
    const owner = this.brightnessOwner;
    const generation = ++this.brightnessGeneration;
    this.automaticBrightness = automatic;
    this.brightnessPercent = Math.max(1, Math.min(100, percent));
    void ReaderWindowCoordinator.brightness().request(owner, automatic ? -1 : readerBrightnessWindowValue(this.brightnessPercent))
      .catch((error: Error): void => { if (this.mounted && owner === this.brightnessOwner && generation === this.brightnessGeneration) this.error = error.message; });
  }
  // The demo's slider starts at 20. A prior lower platform preference remains
  // owned by brightness storage until the user actually changes this control.
  private displayedBrightnessPercent(): number {
    return Math.max(20, Math.min(100, this.brightnessPercent));
  }
  private setBackground(background: 'paper' | 'white' | 'ink'): void {
    this.backgroundPreference = background;
    this.settingsGateway?.updateMangaPreferences({ mangaBackground: background })
      .catch((error: Error): void => { if (this.mounted) this.error = error.message; });
  }
  private setPageNumbers(enabled: boolean): void {
    this.showPageNumbers = enabled;
    this.settingsGateway?.updateMangaPreferences({ mangaPageNumbers: enabled })
      .catch((error: Error): void => { if (this.mounted) this.error = error.message; });
  }
  private async resetMangaPreferences(): Promise<void> {
    if (this.horizontal) this.toggleDirection();
    await this.changeFit('width');
    this.showPageNumbers = true;
    this.setBrightness(78);
    await this.settingsGateway?.updateMangaPreferences({ mangaDirection: 'vertical', mangaFit: 'width', mangaPageNumbers: true });
  }
  private windowInteractiveInsets(_revision: number): ReaderInsetsVp {
    const metrics = ReaderWindowCoordinator.metrics();
    const insets = readerInteractiveSafeInsets(metrics);
    // Native visibility can resolve before avoidAreaChange. Use the same
    // geometry's measured status band for interactive overlays, never Canvas.
    if (this.controlsPresentedForWindow() || this.chapterEnd || this.windowChromeOverlayActive) {
      insets.top = Math.max(insets.top, metrics.statusBarRect.top + metrics.statusBarRect.height);
    }
    return insets;
  }
  private interactiveInsets(revision: number): ReaderInsetsVp {
    const insets = this.windowInteractiveInsets(revision);
    // The persistent directory owns the window's left edge. Do not apply that
    // same cutout twice to the adjacent image/control column.
    if (this.persistentDirectory()) insets.left = Math.max(0, insets.left - this.directoryColumnWidth());
    return insets;
  }
  build() {
    Column() {
      Row() {
        if (this.persistentDirectory()) { this.tabletDirectory(); }
        Stack({ alignContent: Alignment.Center }) {
        this.imageViewport();
        if (this.opened && this.showPageNumbers && !this.controlsVisible && !this.chapterEnd) {
          Stack({ alignContent: Alignment.BottomEnd }) {
            Text(`${this.pageOrdinal() + 1} / ${this.horizontalPageCount}`)
              .fontSize(11).fontColor(this.mutedColor()).padding({ left: 10, right: 10, top: 5, bottom: 5 })
              .backgroundColor(this.surfaceColor()).borderRadius(12).margin(12)
              .hitTestBehavior(HitTestMode.None);
          }.width('100%').height('100%').hitTestBehavior(HitTestMode.None)
            .padding(this.interactiveInsets(this.windowMetricsRevision));
        }
        if (this.controlsPresentedForWindow()) {
          // Stack owns child placement. Component align() only aligns its
          // own content and cannot position an intrinsic floating bar.
          Stack({ alignContent: Alignment.Top }) {
            this.topControls();
          }.width('100%').height('100%').hitTestBehavior(HitTestMode.Transparent)
            .padding(this.interactiveInsets(this.windowMetricsRevision));
          Stack({ alignContent: Alignment.Bottom }) {
            this.bottomControls();
          }.width('100%').height('100%').hitTestBehavior(HitTestMode.Transparent)
            .padding(this.interactiveInsets(this.windowMetricsRevision));
        }
        if (this.chapterEnd) { this.chapterEndContent(); }
        if (this.panel.length > 0) { this.panelOverlay(); }
        }.layoutWeight(1).height('100%');
      }.width('100%').height('100%').onAreaChange((_old: Area, area: Area): void => {
        const width = Number(area.width), height = Number(area.height);
        if (Number.isFinite(width) && width > 0) this.stageWidth = width;
        if (Number.isFinite(height) && height > 0) this.stageHeight = height;
      });
    }.width('100%').height('100%').backgroundColor(this.paperColor())
      // Both drawing and child layout fill the window. System-bar visibility
      // changes only overlay insets, never image fit, row geometry or scroll.
      .expandSafeArea([SafeAreaType.SYSTEM, SafeAreaType.CUTOUT],
        [SafeAreaEdge.TOP, SafeAreaEdge.BOTTOM, SafeAreaEdge.START, SafeAreaEdge.END])
      .ignoreLayoutSafeArea([LayoutSafeAreaType.SYSTEM], [LayoutSafeAreaEdge.ALL]);
  }
  @Builder
  private tabletDirectory() {
    Column() {
      if (this.panelFontsReady) {
        Column({ space: 3 }) {
          Text(this.bookTitle).fontFamily(READER_FONT_NOTO_SERIF_SC_BOLD).fontWeight(700)
            .fontSize(this.stageWidth <= 700 ? 16 : 18).lineHeight(26).fontColor(this.inkColor());
          Text('章节目录').fontFamily(READER_FONT_NOTO_SANS_SC_UI_REGULAR).fontWeight(400)
            .fontSize(10).lineHeight(17).fontColor(this.mutedColor());
        }.width('100%').height(80).alignItems(HorizontalAlign.Start)
          .padding({ top: 20, left: this.stageWidth <= 700 ? 13 : 19, right: this.stageWidth <= 700 ? 13 : 19, bottom: 16 })
          .border({ width: { bottom: 1 }, color: this.lineColor() });
        this.directoryBody(true);
      }
    }.width(this.directoryColumnWidth()).height('100%').backgroundColor(this.surfaceColor())
      .padding({ left: this.windowInteractiveInsets(this.windowMetricsRevision).left,
        top: this.windowInteractiveInsets(this.windowMetricsRevision).top,
        bottom: this.windowInteractiveInsets(this.windowMetricsRevision).bottom })
      .border({ width: { right: 1 }, color: this.lineColor() })
      .onAppear((): void => { void this.preparePanelFonts(); });
  }
  @Builder
  private imageViewport() {
    Scroll(this.horizontalScroller) {
      List({ scroller: this.scroller, space: 0 }) {
        LazyForEach(this.data, (row: MangaStripRow, index: number) => {
          ListItem() {
            if (this.controller?.tile(row.ordinal, row.tileIndex)?.image !== undefined) {
              Image(this.controller?.tile(row.ordinal, row.tileIndex)?.image?.fileUri)
                .width(this.rowDisplayWidth(row)).height(this.rowDisplayWidth(row) * row.height / row.width).objectFit(ImageFit.Fill).draggable(false)
            } else {
              Column() {
              if (this.rowHasError(row)) {
                if (this.isPrimaryErrorRow(row)) {
                  Text(this.displayError(this.imageError(row))).fontColor(this.errorColor).maxLines(4)
                  Button('重试').onClick((): void => this.retry(row))
                } else {
                  // The adjacent failed row keeps its measured slot, while the
                  // viewport exposes a single actionable error for this load.
                  Blank()
                }
                } else { LoadingProgress().width(24).height(24) }
              }.width(this.rowDisplayWidth(row)).height(this.rowDisplayWidth(row) * row.height / row.width).justifyContent(FlexAlign.Center)
            }
          }.width('100%').height(this.rowDisplayHeight(row)).align(Alignment.Center)
            .onAppear((): void => this.onRowAppear(index))
        }, (row: MangaStripRow): string => this.rowRenderKey(row))
      }.height('100%').width(this.viewportWidth * this.zoom).cachedCount(0).scrollBar(BarState.Off)
        .onScroll((): void => { this.queueViewportObservation(); })
        .onScrollIndex((first: number, last: number): void => {
          if (this.seekingPage !== undefined && first >= 0 && first < this.data.totalCount() &&
            this.data.getData(first).ordinal !== this.seekingPage) return;
          const unchanged = this.first === first && this.last === last;
          this.first = first; this.last = last;
          this.refreshLoginRequiredForControls();
          if (this.restoringAnchor) {
            if (!unchanged) this.notifyPublishedRows(false);
            // scrollToIndex can synchronously report its range while native
            // layout is applying. Its existing finishLayout frame confirms it;
            // later native range changes share the observation frame instead.
            if (this.appliedLayoutGeneration === this.layoutGeneration) this.queueViewportObservation();
            return;
          }
          if (unchanged && this.viewportRangeObserved) return;
          this.viewportRangeObserved = true;
          this.layoutGeneration++; this.updateViewport();
        })
        .onTouch((event: TouchEvent): void => { if (event.type === TouchType.Down) this.onViewportTouch(); })
        .onScrollStop((): void => { this.flushViewportObservation(); this.saveVisible(); })
    }.height('100%').width('100%').scrollable(ScrollDirection.Horizontal).scrollBar(BarState.Off)
      .onAreaChange((_old: Area, area: Area): void => { this.resizeViewport(Number(area.width), Number(area.height)); })
      .onScroll((): void => { this.queueViewportObservation(); })
      .onScrollStop((): void => { this.flushViewportObservation(); this.saveVisible(); })
      .parallelGesture(GestureGroup(GestureMode.Exclusive, PinchGesture({ fingers: 2 })
        .onActionStart((): void => { this.rememberVisible(); this.pinchAnchor = this.visibleAnchor; this.pinchStartScale = this.zoom; })
        .onActionUpdate((event: GestureEvent): void => { this.changeZoom(this.pinchStartScale * event.scale); })
        .onActionEnd((): void => { this.pinchAnchor = undefined; this.saveVisible(); })
        .onActionCancel((): void => { this.pinchAnchor = undefined; }),
        SwipeGesture({ direction: SwipeDirection.Horizontal }).onAction((event: GestureEvent): void => {
          if (this.horizontal && this.zoom === 1) {
            if (this.horizontalPage + 1 === this.horizontalPageCount && Math.abs(event.angle) > 90) void this.openChapterEnd();
            else this.turnPage(Math.abs(event.angle) > 90 ? 1 : -1);
          }
        }),
        TapGesture({ count: 1, distanceThreshold: 6 }).onAction((): void => this.toggleControls())));
  }
  @Builder
  private topControls() {
    Column({ space: 8 }) {
      Row() {
        Row() { this.iconAction((this.backgroundPreference === 'ink' ? $r('app.media.book_detail_back_theme_night') : $r('app.media.book_detail_back')), '返回', (): void => { void this.handleBack(); }); Blank().width(44); }.width(88);
          Column({ space: 1 }) {
          Text(this.bookTitle || this.remoteSession?.book.title || this.remoteBookSeed?.title || '漫画阅读')
            .fontFamily('ReaderNotoSerifSCBold').fontWeight(FontWeight.Bold).fontSize(17).fontColor(this.inkColor())
            .maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis });
          Text(this.title).fontSize(11).fontColor(this.mutedColor()).maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis });
        }.layoutWeight(1).alignItems(HorizontalAlign.Center);
        Row() {
          Column({ space: 2 }) {
            Image((this.backgroundPreference === 'ink' ? $r('app.media.reader_directory_switch_theme_night') : $r('app.media.reader_directory_switch')))
              .width(18).height(18);
            Text('换源').fontSize(10).fontColor(this.inkColor()).maxLines(1);
          }.width(44).height(42).justifyContent(FlexAlign.Center).alignItems(HorizontalAlign.Center)
            .accessibilityText('换源').onClick((): void => { void this.openSourceSwitch(); });
          this.iconAction((this.backgroundPreference === 'ink' ? $r('app.media.reader_directory_more_theme_night') : $r('app.media.reader_directory_more')), '更多', (): void => { void this.openPanel('more'); });
        }.width(88).justifyContent(FlexAlign.End);
      }.height(52).width('100%').backgroundColor(this.surfaceColor())
        .border({ width: TOK_BORDER_W, color: this.lineColor() }).borderRadius(18).clip(true)
        .shadow({ radius: this.appThemeScheme === 'night' ? 0 : 18,
          color: this.appThemeScheme === 'night' ? '#22000000' : '#1A594632', offsetX: 0, offsetY: 5 });
      if (this.recovering) {
        Button(this.controller?.replacementRecoveryRequired === true ? '内容已更新，从新版首图开始' : '内容已更新，确认从当前页继续').fontSize(12).height(44)
          .onClick((): void => { void this.confirmRecovery(); });
      }
      if (this.error.length > 0) { Text(this.displayError(this.error)).fontSize(12).fontColor(this.errorColor).maxLines(3).padding(8).backgroundColor(this.surfaceColor()).borderRadius(12); }
      if ((this.error.length > 0 || this.openingRetry) && !this.opened && !this.offline) {
        Button(this.openingRetry ? '重试中' : '重试').height(44).enabled(!this.openingRetry)
          .onClick((): void => { void this.retryOpen(); });
      }
      if (this.loginRequiredForControls) { Button(this.loggingIn ? '登录处理中' : '登录书源后重试').height(44).enabled(!this.loggingIn).onClick((): void => { void this.loginAndRetry(); }); }
      if (this.offlineProbeStatus.length > 0) { Text(this.offlineProbeStatus).fontSize(10).maxLines(4).fontColor(this.mutedColor()).id('reader-manga-offline-probe-status'); }
    }.width('100%').padding({ left: 16, right: 16, top: 10 });
  }
  @Builder
  private iconAction(icon: Resource, label: string, action: () => void) {
    ReaderIconButton({ icon, specId: 'manga-reader-action', accessibilityLabel: label, onTap: action });
  }
  @Builder
  private bottomControls() {
    Column({ space: 4 }) {
      Row({ space: 10 }) {
        Button('‹').height(28).width(28).fontSize(20).fontColor(this.mutedColor()).backgroundColor(Color.Transparent)
          .enabled(this.opened && this.pageOrdinal() > 0).onClick((): void => { void this.stepPage(-1); });
        Column({ space: 3 }) {
          Slider({ value: this.pageOrdinal() + 1, min: 1, max: Math.max(1, this.horizontalPageCount), step: 1 })
            .height(24).layoutWeight(1).selectedColor(this.backgroundPreference === 'ink' ? '#ABC39E' : this.greenColor())
            .blockColor(this.backgroundPreference === 'ink' ? '#ABC39E' : this.greenColor()).trackColor(this.lineColor())
            .enabled(this.opened && this.horizontalPageCount > 1)
            .onChange((value: number, mode: SliderChangeMode): void => { if (mode === SliderChangeMode.End) void this.seekPage(Math.round(value) - 1); });
          Row() {
            Text(this.opened ? `${this.pageOrdinal() + 1} / ${this.horizontalPageCount}` : '—')
              .fontSize(10).fontColor(this.mutedColor());
            if (this.opened) {
              Text(' 页').fontSize(10).fontColor(this.mutedColor());
            }
          }.width('100%').justifyContent(FlexAlign.Center).height(16);
        }.layoutWeight(1);
        Button('›').height(28).width(28).fontSize(20).fontColor(this.mutedColor()).backgroundColor(Color.Transparent)
          .enabled(this.opened).onClick((): void => { void this.stepPage(1); });
      }.width('100%').height(48).alignItems(VerticalAlign.Top);
      Row() {
        this.footerAction((this.backgroundPreference === 'ink' ? $r('app.media.reader_directory_directory_theme_night') : $r('app.media.reader_directory_directory')), '目录', 'directory');
        this.footerAction((this.backgroundPreference === 'ink' ? $r('app.media.reader_appearance_header_theme_night') : $r('app.media.reader_appearance_header')), '阅读方式', 'mode');
        this.footerAction((this.backgroundPreference === 'ink' ? $r('app.media.reader_settings_header_theme_night') : $r('app.media.reader_settings_header')), '设置', 'settings');
      }.width('100%').height(55).border({ width: { top: 1 }, color: this.lineColor() });
    }.width(Math.max(1, this.viewportWidth - 32 - this.interactiveInsets(this.windowMetricsRevision).left -
      this.interactiveInsets(this.windowMetricsRevision).right)).padding({ left: 14, right: 14, top: 13, bottom: 11 })
      .backgroundColor(this.surfaceColor()).borderRadius(24)
      .border({ width: TOK_BORDER_W, color: this.lineColor() }).clip(true)
      .margin({ left: 16, right: 16, bottom: 12 })
      .shadow({ radius: this.appThemeScheme === 'night' ? 8 : 18,
        color: this.appThemeScheme === 'night' ? '#44000000' : '#1A594632', offsetX: 0, offsetY: -4 })
      .constraintSize({ maxWidth: 560 });
  }
  @Builder
  private footerAction(icon: Resource, label: string, panel: string) {
    Column({ space: 4 }) {
      Image(icon).width(22).height(22);
      Text(label).fontSize(11).fontColor(this.inkColor());
    }.layoutWeight(1).height(58).justifyContent(FlexAlign.Center).onClick((): void => { void this.openPanel(panel); }).accessibilityText(label);
  }
  @Builder
  private panelOverlay() {
    Stack({ alignContent: this.widePanel() ? Alignment.End : Alignment.Bottom }) {
      Column().width('100%').height('100%').backgroundColor(this.widePanel() ? Color.Transparent : '#57000000')
        .opacity(this.widePanel() ? 1 : this.panelScrimOpacity)
        .onClick((): void => { void this.closePanel(); });
      Stack({ alignContent: Alignment.TopEnd }) {
        Column() {
          if (this.widePanel()) {
            Column() {
            Row({ space: 12 }) {
              Text(this.panelTitle()).fontSize(15).fontFamily(READER_FONT_NOTO_SANS_SC_UI_600).fontWeight(600)
                .fontColor(this.inkColor()).lineHeight(24).layoutWeight(1);
              Row() {
                Image(this.backgroundPreference === 'ink' ? $r('app.media.manga_sheet_close_theme_night') : $r('app.media.manga_sheet_close')).width(18).height(18);
              }.width(34).height(34).justifyContent(FlexAlign.Center)
                .onClick((): void => { void this.closePanel(); }).accessibilityText('关闭宽屏面板');
            }.width('100%').height(66)
              .border({ width: { bottom: 1 }, color: this.lineColor() });
            }.width('100%').height(66).padding({ left: this.panelContentInset(), right: this.panelContentInset() }).margin({ bottom: 17 });
          } else {
            Row() {
              Column().width(42).height(5).borderRadius(3)
                .backgroundColor(this.backgroundPreference === 'ink' ? '#565E50' : '#C9C9C4');
            }.width('100%').height(30).justifyContent(FlexAlign.Center)
              .gesture(PanGesture({ fingers: 1, direction: PanDirection.Vertical, distance: 1 })
                .onActionStart((): void => this.beginPanelDrag())
                .onActionUpdate((event: GestureEvent): void => this.updatePanelDrag(event.offsetY))
                .onActionEnd((event: GestureEvent): void => this.finishPanelDrag(event.offsetY, event.velocityY))
                .onActionCancel((): void => this.finishPanelDrag(0, 0)));
            Text(this.panelTitle()).fontSize(18).fontFamily(READER_FONT_NOTO_SANS_SC_UI_900).fontWeight(900).fontColor(this.inkColor())
              .width('100%').padding({ left: 18, right: 52, bottom: 14 }).lineHeight(26);
          }
          if (this.panel === 'directory') { this.directoryPanel(); }
          else {
            Scroll() {
              Column({ space: 24 }) {
                if (this.panel === 'mode') { this.modePanel(); }
                else if (this.panel === 'settings') { this.settingsPanel(); }
                else if (this.panel === 'downloads') {
                  MangaDownloadOperationsPanel({ actions: this.downloadActions, loading: this.downloadActionsLoading,
                    failureMessage: this.downloadActionsFailure, panelInkColor: this.inkColor(), panelPaperColor: this.paperColor(),
                    onAction: (action: MangaDownloadActionId): void => this.performDownloadAction(action),
                    onRetry: (): void => { void this.openDownloadActions(this.downloadActionsChapterIndex); } });
                }
                else { this.morePanel(); }
              }.width('100%').padding({ left: this.panelContentInset(), right: this.panelContentInset(), bottom: this.widePanel() ? 22 : 24 });
            }.width('100%').constraintSize({ maxHeight: Math.max(1, this.panelContentHeight() - (this.widePanel() ? 83 : 70)) })
              .layoutWeight(this.widePanel() ? 1 : 0).scrollBar(BarState.Off);
          }
        }.width('100%').height(this.widePanel() ? this.panelContentHeight() : undefined)
          .constraintSize({ minHeight: this.widePanel() ? 0 : Math.min(260, this.panelContentHeight()),
            maxHeight: this.panelContentHeight() });
        if (!this.widePanel()) {
          Row() {
            Image(this.backgroundPreference === 'ink' ? $r('app.media.manga_sheet_close_theme_night') : $r('app.media.manga_sheet_close')).width(18).height(18);
          }.width(36).height(36).justifyContent(FlexAlign.Center).borderRadius(12)
            .margin({ top: 24, right: 12 }).onClick((): void => { void this.closePanel(); }).accessibilityText('关闭面板');
        }
      }.width(this.panelWidth()).padding({
        left: this.panelInsets(this.windowMetricsRevision).left,
        right: this.panelInsets(this.windowMetricsRevision).right,
        top: this.widePanel() ? this.panelInsets(this.windowMetricsRevision).top : 0,
        bottom: this.panelInsets(this.windowMetricsRevision).bottom,
      }).backgroundColor(this.surfaceColor())
        .border(this.widePanel() ? { width: { left: 1 }, color: this.lineColor() } : undefined)
        .borderRadius({ topLeft: this.widePanel() ? 0 : 22, topRight: this.widePanel() ? 0 : 22, bottomLeft: 0, bottomRight: 0 }).clip(true)
        .shadow({ radius: this.widePanel() ? 32 : 48,
          color: this.widePanel() ? '#11000000' : this.backgroundPreference === 'ink' ? '#66000000' : '#33000000',
          offsetX: this.widePanel() ? -14 : 0, offsetY: this.widePanel() ? 0 : -16 })
        .translate({ x: this.widePanel() ? this.panelOffset : 0, y: this.widePanel() ? 0 : this.panelOffset })
        .enabled(this.panelPhase === 'open' || this.panelPhase === 'dragging');
    }.width('100%').height('100%');
  }
  @Builder
  private directoryPanel() {
    Column() {
      if (!this.widePanel()) { this.directoryTools(); }
      this.directoryBody(false);
    }.layoutWeight(this.widePanel() ? 1 : 0).width('100%')
      .padding({ left: this.widePanel() ? this.panelContentInset() - 8 : 18,
        right: this.widePanel() ? this.panelContentInset() - 8 : 18, bottom: this.widePanel() ? 22 : 24 });
  }
  @Builder
  private directoryTools() {
      Row({ space: 9 }) {
        Image(this.backgroundPreference === 'ink' ? $r('app.media.manga_sheet_search_theme_night') : $r('app.media.manga_sheet_search')).width(17).height(17);
        TextInput({ text: this.directoryQuery, placeholder: '搜索章名或序号' }).height(42).fontSize(13)
            .fontFamily(READER_FONT_NOTO_SANS_SC_UI_REGULAR).fontWeight(400).defaultFocus(false).layoutWeight(1)
            .padding(0).fontColor(this.inkColor()).placeholderColor(this.faintColor()).backgroundColor(Color.Transparent)
            .onChange((text: string): void => { this.directoryQuery = text; });
        if (this.directoryQuery.length > 0) {
          Row() { Image(this.backgroundPreference === 'ink' ? $r('app.media.manga_sheet_close_theme_night') : $r('app.media.manga_sheet_close')).width(18).height(18); }
            .width(26).height(36).justifyContent(FlexAlign.Center).accessibilityText('清除目录搜索')
            .onClick((): void => { this.directoryQuery = ''; });
        }
      }.width('100%').height(44).padding({ left: 11, right: 11 }).borderRadius(12)
        .border({ width: 1, color: this.lineColor() }).backgroundColor(this.surfaceColor()).margin({ bottom: 17 });
      Row() {
        Row({ space: 5 }) {
          Image(this.backgroundPreference === 'ink' ? $r('app.media.manga_sheet_locate_theme_night') : $r('app.media.manga_sheet_locate')).width(15).height(15);
          Text('定位当前条目').fontSize(11).fontFamily(READER_FONT_NOTO_SANS_SC_UI_REGULAR).fontWeight(400).fontColor(this.accentColor());
        }.height(38).onClick((): void => { this.directoryQuery = ''; this.directoryRevision += 1; }).accessibilityText('定位当前条目');
        Blank();
        Row({ space: 5 }) {
          Text(this.directoryAscending ? '正序' : '倒序').fontSize(11).fontFamily(READER_FONT_NOTO_SANS_SC_UI_REGULAR).fontWeight(400).fontColor(this.accentColor());
          Image(this.backgroundPreference === 'ink' ? $r('app.media.manga_sheet_vertical_accent_theme_night') : $r('app.media.manga_sheet_vertical_accent')).width(15).height(15);
        }.height(38).onClick((): void => { this.directoryAscending = !this.directoryAscending; }).accessibilityText('切换目录排序');
      }.width('100%').margin({ top: 6, bottom: 29 });
  }
  @Builder
  private directoryBody(catalog: boolean) {
    ReaderDirectoryNavigationSurface({
      sourceId: this.sourceId, bookId: this.bookId, query: catalog ? '' : this.directoryQuery, ascending: this.directoryAscending,
      currentChapterIndex: this.controller?.chapter?.chapterIndex ?? -1,
      openRevision: catalog ? this.publishedManifestVersion : `${this.publishedManifestVersion}:${this.directoryOpenRevision}`,
      locateCurrentRevision: this.directoryRevision, mangaDisplay: true,
      mangaScheme: this.backgroundPreference === 'ink' ? 'night' : 'day', rowHeight: 58, listPaddingX: 0, listPaddingY: 0,
      chapterEntries: this.directoryEntries(), mangaRowMinHeight: this.widePanel() ? 50 : 58,
      mangaCurrentOpenInset: !catalog && this.widePanel() ? 7 : 50,
      mangaCatalogDisplay: catalog, mangaCatalogNarrow: catalog && this.stageWidth <= 700,
      interactionEnabled: catalog ? this.panelPhase === 'closed' || this.panelPhase === 'open' : this.panelPhase === 'open',
      chapterStartBookmarkCreationEnabled: false, chapterDownloadEnabled: this.downloadEnabled,
      chapterDownloadActionsEnabled: this.downloadEnabled,
      onDownloadChapter: (index: number): void => { void this.openDownloadActions(index); },
      onClearSearch: (): void => { this.directoryQuery = ''; },
      fallbackBuilder: (): void => { this.directoryFallback(catalog); },
      onSelectTarget: (chapterIndex: number, _offset: number, _scope?: RemoteReadingPositionScope, proof?: JsonObject): void => {
        void this.selectDirectoryTarget(chapterIndex, proof, catalog);
      },
    }).width('100%').height(catalog || this.widePanel() ? undefined : Math.min(330, Math.max(0, this.panelContentHeight() - 228)))
      .layoutWeight(catalog || this.widePanel() ? 1 : 0);
  }
  @Builder
  private directoryFallback(catalog: boolean = false) {
    MangaReadingDirectoryFallback({
      sourceId: this.sourceId, bookId: this.bookId, entries: this.directoryEntries(),
      query: catalog ? '' : this.directoryQuery, ascending: this.directoryAscending,
      currentChapterIndex: this.controller?.chapter?.chapterIndex ?? -1,
      locateCurrentRevision: this.directoryRevision,
      mangaScheme: this.backgroundPreference === 'ink' ? 'night' : 'day',
      rowHeight: this.widePanel() ? 50 : 58, mangaCatalogDisplay: catalog, mangaCatalogNarrow: catalog && this.stageWidth <= 700,
      currentOpenInset: !catalog && this.widePanel() ? 7 : 50,
      chapterDownloadEnabled: this.downloadEnabled,
      onDownloadChapter: (index: number): void => { void this.openDownloadActions(index); },
      onSelectChapter: (index: number): void => { void this.selectDirectoryTarget(index, undefined, catalog); },
      onOpenFullDirectory: (): void => { void this.performPanelAction((): void => this.onDirectory()); },
      onClearSearch: (): void => { this.directoryQuery = ''; },
    }).enabled(catalog ? this.panelPhase === 'closed' || this.panelPhase === 'open' : this.panelPhase === 'open');
  }
  @Builder
  private modePanel() {
    Column({ space: 12 }) {
      this.sectionTitle('阅读模式');
      Row({ space: 8 }) {
        this.sheetChoice('vertical', '竖向连续', (): void => { if (this.horizontal) this.toggleDirection(); });
        this.sheetChoice('horizontal', '横向分页', (): void => { if (!this.horizontal) this.toggleDirection(); });
      }.width('100%');
    }.width('100%');
    Column() {
      Text('图片适配').fontSize(13).fontFamily(READER_FONT_NOTO_SANS_SC_UI_600).fontWeight(600).lineHeight(21).fontColor(this.inkColor()).width('100%').margin({ bottom: 12 });
      this.fitLine('跟随书源', 'source', (): void => { void this.changeFit('source'); });
      this.fitLine('适合屏幕', 'width', (): void => { void this.changeFit('width'); });
      this.fitLine('完整图片', 'contain', (): void => { void this.changeFit('contain'); });
    }.width('100%');
  }
  @Builder
  private sectionTitle(label: string) {
    Text(label).fontSize(13).fontFamily(READER_FONT_NOTO_SANS_SC_UI_600).fontWeight(600).lineHeight(21).fontColor(this.inkColor()).width('100%');
  }
  @Builder
  private sheetChoice(kind: string, label: string, action: () => void) {
    Row({ space: 6 }) {
      Image(this.choiceIcon(kind)).width(18).height(18);
      Text(label).fontSize(12).fontFamily(READER_FONT_NOTO_SANS_SC_UI_REGULAR).fontWeight(400).lineHeight(18).fontColor(this.isSheetChoiceSelected(kind) ? '#FFFAF4' : this.mutedColor());
    }.layoutWeight(1).height(43).padding(8).justifyContent(FlexAlign.Center)
      .backgroundColor(this.isSheetChoiceSelected(kind) ? this.greenColor() : this.softSurfaceColor()).borderRadius(12)
      .border({ width: 1, color: this.isSheetChoiceSelected(kind) ? this.greenColor() : this.lineColor() }).onClick(action)
      .accessibilityText(`${label}，${this.isSheetChoiceSelected(kind) ? '已选择' : '未选择'}`);
  }
  @Builder
  private fitLine(label: string, fit: string, action: () => void) {
    Row({ space: 12 }) {
      Text(label).fontSize(12).fontFamily(READER_FONT_NOTO_SANS_SC_UI_REGULAR).fontWeight(400).lineHeight(18).fontColor(this.inkColor()).layoutWeight(1);
      if (this.fitPreference === fit) { Image(this.backgroundPreference === 'ink' ? $r('app.media.manga_sheet_check_theme_night') : $r('app.media.manga_sheet_check')).width(18).height(18); }
    }.width('100%').height(46).border({ width: { bottom: 1 }, color: this.lineColor() }).onClick(action)
      .accessibilityText(`${label}，${this.fitPreference === fit ? '已选择' : '未选择'}`);
  }
  @Builder
  private option(label: string, selected: boolean, action: () => void, widthPercent: number = 100) {
    Button(label).height(48).width(`${widthPercent}%`).fontSize(13).fontFamily(selected ? READER_FONT_NOTO_SANS_SC_UI_600 : READER_FONT_NOTO_SANS_SC_UI_REGULAR).fontWeight(selected ? 600 : 400)
      .fontColor(selected ? '#FFFFFF' : this.inkColor()).backgroundColor(selected ? '#1F3528' : this.paperColor())
      .borderRadius(14).onClick(action);
  }
  @Builder
  private settingsPanel() {
    Column({ space: 12 }) {
      this.sectionTitle('阅读底色');
      Row({ space: 8 }) {
        this.sheetChoice('sun', '暖纸', (): void => this.setBackground('paper'));
        this.sheetChoice('moon', '深墨', (): void => this.setBackground('ink'));
      }.width('100%');
    }.width('100%');
    Column() {
      Row() {
        Text('亮度').fontSize(13).fontFamily(READER_FONT_NOTO_SANS_SC_UI_600).fontWeight(600).lineHeight(21).fontColor(this.inkColor()).layoutWeight(1);
        Text(`${Math.round(this.brightnessPercent)}%`).fontSize(11).fontFamily(READER_FONT_NOTO_SANS_SC_UI_REGULAR).fontWeight(400).fontColor(this.mutedColor());
      }.width('100%').margin({ bottom: 10 });
      Slider({ value: this.displayedBrightnessPercent(), min: 20, max: 100, step: 1 }).width('100%').height(24)
        .selectedColor(this.backgroundPreference === 'ink' ? '#ABC39E' : this.greenColor())
        .blockColor(this.backgroundPreference === 'ink' ? '#ABC39E' : this.greenColor()).trackColor(this.lineColor())
        .onChange((value: number): void => this.setBrightness(value)).accessibilityText('阅读亮度');
      Row() {
        Text('常驻页码').fontSize(12).fontFamily(READER_FONT_NOTO_SANS_SC_UI_REGULAR).fontWeight(400).lineHeight(18).fontColor(this.inkColor()).layoutWeight(1);
        Toggle({ type: ToggleType.Switch, isOn: this.showPageNumbers }).width(38).height(23).selectedColor(this.greenColor())
          .switchStyle({ pointRadius: 8.5, pointColor: this.showPageNumbers ? '#FFFAF4' : this.surfaceColor(), unselectedColor: this.backgroundPreference === 'ink' ? '#4D5447' : '#D7D0C3', trackBorderRadius: 11.5 })
          .onChange((enabled: boolean): void => this.setPageNumbers(enabled)).accessibilityText('常驻页码');
      }.width('100%').height(46).border({ width: { bottom: 1 }, color: this.lineColor() })
        .hitTestBehavior(HitTestMode.Block).onClick((): void => this.setPageNumbers(!this.showPageNumbers))
        .accessibilityGroup(true).accessibilityText(`常驻页码，${this.showPageNumbers ? '已启用' : '已关闭'}`);
    }.width('100%');
    Text('恢复默认').fontSize(12).fontFamily(READER_FONT_NOTO_SANS_SC_UI_REGULAR).fontWeight(400).lineHeight(18).fontColor(this.accentColor()).width('100%').height(36)
      .textAlign(TextAlign.Center).onClick((): void => { this.resetMangaPreferences().catch((error: Error): void => { if (this.mounted) this.error = error.message; }); });
  }
  @Builder
  private morePanel() {
    this.option('更换书源', false, (): void => { void this.openSourceSwitch(); });
    Button(this.title.includes('卷') ? '重新打开本卷' : '重新打开本话').fontFamily(READER_FONT_NOTO_SANS_SC_UI_REGULAR).fontWeight(400).width('100%').height(48).enabled(this.opened && !this.offline).fontColor(this.inkColor()).backgroundColor(this.paperColor())
      .onClick((): void => { void this.performPanelAction((): Promise<void> => this.refreshImages())
        .catch((error: Error): void => { if (this.mounted) this.error = error.message; }); });
    this.option('漫画详情', false, (): void => { void this.showDetail(); });
    if (this.downloadEnabled) {
      this.option('下载本话', false, (): void => { void this.performPanelAction((): void => this.onDownloadChapter()); });
      this.option('下载全部章节', false, (): void => { void this.performPanelAction((): void => this.onDownloadBook()); });
      this.option('下载管理', false, (): void => { void this.openDownloadActions(); });
    }
    this.option(this.inBookshelf ? '移出书架' : '加入书架', false, (): void => { void this.performPanelAction((): void => this.onToggleShelf()); });
  }
  @Builder
  private chapterEndContent() {
    Stack({ alignContent: Alignment.Bottom }) {
      Column() {
        Blank().layoutWeight(1);
        Column({ space: 10 }) {
          Image(this.backgroundPreference === 'ink' ? $r('app.media.reader_directory_marker_check_theme_night') : $r('app.media.reader_directory_marker_check'))
            .width(24).height(24);
          Text(this.chapterEndTypeLabel()).fontSize(11).lineHeight(19).fontColor(this.mutedColor()).textAlign(TextAlign.Center);
          Text(`${this.chapterEndLabel()} 完`).fontFamily('ReaderNotoSerifSCBold').fontWeight(FontWeight.Bold)
            .fontSize(23).fontColor(this.inkColor()).textAlign(TextAlign.Center);
          if (this.adjacentChapter(1) !== undefined) {
            Text(this.adjacentLabel()).fontSize(13).fontColor(this.mutedColor()).maxLines(2).textAlign(TextAlign.Center);
            Row({ space: 12 }) {
              Button(this.adjacentActionLabel()).layoutWeight(1).height(44).fontSize(13)
                .fontColor('#FFFFFF').backgroundColor('#1F3528').borderRadius(16)
                .onClick((): void => { void this.selectAdjacentChapter(1); });
              Button('返回目录').layoutWeight(1).height(44).fontSize(13).fontColor(this.inkColor())
                .backgroundColor(this.paperColor()).borderRadius(16)
                .onClick((): void => { void this.openPanel('directory'); });
            }.width('100%');
          } else {
            Text('已读到本书末尾').fontSize(13).fontColor(this.mutedColor()).textAlign(TextAlign.Center);
            Button('返回目录').height(44).width(220).fontSize(13).fontColor(this.inkColor())
              .backgroundColor(this.paperColor()).borderRadius(16).onClick((): void => { void this.openPanel('directory'); });
          }
        }.width('100%').padding(20).backgroundColor(this.surfaceColor()).borderRadius(20)
          .border({ width: TOK_BORDER_W, color: this.lineColor() })
          .shadow({ radius: this.appThemeScheme === 'night' ? 0 : 16,
            color: this.appThemeScheme === 'night' ? '#44000000' : '#1A594632', offsetX: 0, offsetY: 4 });
      }.width('100%').height('100%').padding({
        left: 12 + this.interactiveInsets(this.windowMetricsRevision).left,
        right: 12 + this.interactiveInsets(this.windowMetricsRevision).right,
        top: this.interactiveInsets(this.windowMetricsRevision).top,
        bottom: 48 + this.interactiveInsets(this.windowMetricsRevision).bottom,
      });
      Stack({ alignContent: Alignment.BottomEnd }) {
        Text(`${this.pageOrdinal() + 1} / ${this.horizontalPageCount}`)
          .fontSize(11).fontColor(this.backgroundPreference === 'ink' ? '#EAE7DE' : '#FFFCF8')
          .padding({ left: 10, right: 10, top: 5, bottom: 5 }).backgroundColor('#66251F1B').borderRadius(12)
          .margin({ right: 12, bottom: 12 }).hitTestBehavior(HitTestMode.None);
      }.width('100%').height('100%').hitTestBehavior(HitTestMode.None)
        .padding(this.interactiveInsets(this.windowMetricsRevision));
    }.width('100%').height('100%');
  }
}
