import deviceInfo from '@ohos.deviceInfo';
import hilog from '@ohos.hilog';
import { FrameCallback } from '@kit.ArkUI';
import type { JsonObject } from '@reader/core-harmony';
import { ReaderWindowCoordinator } from '../../app/ReaderWindowCoordinator';
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
import { readerBrightnessControlPercent, readerBrightnessWindowValue } from '../reading/ReaderBrightnessCurve';

interface MangaViewportAnchor { ordinal: number; y: number; x?: number; }
interface MangaConfirmedPosition { controller: MangaSessionController; manifest: MangaManifest; identity: string; anchor: MangaViewportAnchor; }

class MangaLayoutFrame extends FrameCallback {
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
  directoryTargetProof: JsonObject | undefined = undefined;
  remoteSession: RemoteReadingSession | undefined = undefined;
  remoteBookSeed: RemoteReadingBookSeed | undefined = undefined;
  onRemoteSessionReady: (session: RemoteReadingSession) => void = (): void => {};
  onChapterCommitted: (index: number, title: string) => void = (): void => {};
  offline: boolean = false;
  onSaveFailure: (message: string) => void = (_message: string): void => {};
  onBack: () => void = (): void => {};
  onDirectory: () => void = (): void => {};
  @Prop bookTitle: string = '';
  @Prop inBookshelf: boolean = true;
  onDetail: () => void = (): void => {};
  onToggleShelf: () => void = (): void => {};
  onDownloadChapter: () => void = (): void => {};
  onSelectDirectoryTarget: (chapterIndex: number, proof?: JsonObject) => void = (_index: number, _proof?: JsonObject): void => {};
  onSwitchSource: () => void = (): void => {};
  onLoginSource: () => Promise<void> = async (): Promise<void> => {};
  @Prop mangaBackgroundColor: string = '#111111';
  @Prop mangaForegroundColor: string = '#eeeeee';
  @Prop errorColor: string = '#ffb4ab';
  onExitRequestHandler: (exit: () => void) => void = (): void => {};
  onChapter: (direction: number) => void = (_direction: number): void => {};
  @State private error: string = '';
  @State private offlineProbeStatus: string = '';
  private detachOfflineProbe: (() => void) | undefined;
  @State private title: string = '';
  @State private recovering: boolean = false;
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
  private mounted: boolean = false;
  private chapterCommitted: boolean = false;
  private readonly reportedErrorCodes: Set<string> = new Set<string>();
  @State private viewportWidth: number = 1;
  @State private viewportHeight: number = 1;
  @State private fitPreference: 'source' | 'width' | 'contain' = 'source';
  @State private loggingIn: boolean = false;
  private loginGeneration: number = 0;
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
  @State private controlsVisible: boolean = false;
  @State private panel: string = '';
  @State private chapterEnd: boolean = false;
  @State private displayedPage: number = 0;
  @State private backgroundPreference: 'paper' | 'white' | 'ink' = 'paper';
  @State private showPageNumbers: boolean = true;
  @State private directoryQuery: string = '';
  @State private directoryAscending: boolean = true;
  @State private directoryRevision: number = 0;
  @State private brightnessPercent: number = 50;
  @State private automaticBrightness: boolean = true;
  private brightnessOwner: number = 0;
  private brightnessGeneration: number = 0;
  private seekingPage: number | undefined;
  @State private stageWidth: number = 1;
  @State private stageHeight: number = 1;

  aboutToAppear(): void {
    if (this.runtime === undefined) { this.error = 'MANGA_RESOURCE_HOST_UNAVAILABLE'; return; }
    this.mounted = true;
    const presentationRevision = MangaBookPresentation.revision;
    MangaBookPresentation.useOwner(this.runtime);
    if (MangaBookPresentation.revision !== presentationRevision)
      AppStorage.setOrCreate('readerMangaPresentationRevision', MangaBookPresentation.revision);
    this.horizontal = this.settingsGateway?.current()?.mangaDirection === 'horizontal';
    this.fitPreference = this.settingsGateway?.current()?.mangaFit ?? 'source';
    this.backgroundPreference = this.settingsGateway?.current()?.mangaBackground ?? (this.appThemeScheme === 'night' ? 'ink' : 'paper');
    this.showPageNumbers = this.settingsGateway?.current()?.mangaPageNumbers !== false;
    this.loadBrightness();
    this.onExitRequestHandler((): void => {
      if (this.mounted) void this.handleBack();
    });
    const controller = new MangaSessionController(this.runtime);
    this.controller = controller;
    controller.onChange = (): void => this.publish();
    this.open(controller);
  }
  aboutToDisappear(): void {
    const brightnessOwner = this.brightnessOwner; this.brightnessOwner = 0; this.brightnessGeneration++;
    if (brightnessOwner > 0) void ReaderWindowCoordinator.brightness().release(brightnessOwner).catch((): void => {});
    this.mounted = false; this.layoutGeneration++; this.viewportGeneration++; this.loginGeneration++; this.presentationGeneration++;
    this.confirmedPosition = undefined;
    this.pendingTurnOrdinal = undefined; this.mountedTurnRowKey = '';
    if (this.controller !== undefined) { this.controller.onChange = undefined; this.controller.close(); }
    this.runtime?.finishMangaOfflineProbe?.(this.sourceId, this.bookId);
    this.detachOfflineProbe?.(); this.detachOfflineProbe = undefined;
  }
  private async open(controller: MangaSessionController): Promise<void> {
    try {
      this.detachOfflineProbe = this.offline ? this.runtime?.subscribeMangaOfflineProbe?.((state: string): void => {
        if (this.mounted) this.offlineProbeStatus = state;
      }) : undefined;
      const current = (): boolean => this.mounted && this.controller === controller;
      let index = this.chapterIndex;
      let session = this.remoteSession;
      if (this.runtime !== undefined) {
        await controller.awaitPendingProgress(this.sourceId, this.bookId);
        if (!current()) return;
        const prepared = await new MangaSessionGateway(this.runtime).entry(this.sourceId, this.bookId, index, current, this.directoryTargetProof);
        if (!current()) return;
        if (prepared !== null) {
          this.horizontalPage = prepared.targetOrdinal;
          await controller.setPreviewMode(this.fitPreference === 'contain' || (this.fitPreference === 'source' && prepared.chapter.manifest.displayHints?.fit === 'contain'));
          await controller.openPrepared(prepared, this.offline);
          if (!current()) return;
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
          else if (this.remoteBookSeed !== undefined) {
            void this.acquireCatalog(current).then((catalog: RemoteReadingSession | undefined): void => {
              if (catalog !== undefined && current() && catalog.identity.sourceId === this.sourceId && catalog.identity.bookId === this.bookId && catalog.contentKind === 'manga') {
                this.configureAdjacentChapter(catalog, controller); this.onRemoteSessionReady(catalog);
              }
            }).catch((): void => {});
          }
          return;
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
      await controller.open(this.sourceId, this.bookId, index, this.offline, this.chapterIndex === undefined, this.directoryTargetProof);
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

  private async acquireCatalog(current: () => boolean): Promise<RemoteReadingSession | undefined> {
    if (this.runtime === undefined || this.remoteBookSeed === undefined) return undefined;
    if (this.offline) {
      // Already admitted manga identity; only read Core's durable catalog. A
      // missing/invalid cached catalog must never fall through to online acquire.
      const cached = await new RemoteReadingFlowGateway(this.runtime).openCachedSession(this.remoteBookSeed, current);
      cached.contentKind = 'manga';
      return cached;
    }
    return this.runtime.bookAcquisitions?.().acquireBook(this.remoteBookSeed, { isCurrent: current });
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
    const manifestChanged = this.publishedManifestVersion !== chapter.manifest.manifestVersion;
    if (manifestChanged && this.controller !== undefined) {
      this.publishedManifestVersion = chapter.manifest.manifestVersion;
      this.layoutGeneration++; this.viewportGeneration++;
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
      this.title = chapter.chapterTitle;
      this.displayedPage = anchor?.ordinal ?? this.controller?.displayedOrdinal ?? 0;
      this.data.notify(changed, this.first, this.requestedLast());
      if (this.mountedTurnRowKey.length > 0 && this.data.totalCount() > 0) this.confirmMountedTurn(this.data.getData(0));
      if (changed && this.opened && anchor !== undefined) this.restore(anchor.ordinal, anchor.y, anchor.x ?? 0);
    } catch (error) { this.error = error instanceof Error ? error.message : '漫画布局失败'; }
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
    if (this.visibleAnchor !== undefined) this.displayedPage = this.visibleAnchor.ordinal;
    if (!this.restoringAnchor) { this.rememberVisible(); return; }
    if (this.appliedLayoutGeneration !== this.layoutGeneration || !this.measureVisibleWindow()) return;
    if (this.rememberVisible(true)) this.restoringAnchor = false;
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
    if (index < this.first || index > this.first + 7) { this.first = index; this.last = index; }
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
      this.first = first; this.last = last; this.updateViewport();
      return true;
    } catch (_error) { return false; /* Unmounted geometry leaves the last observed range intact. */ }
  }
  private async updateViewport(): Promise<void> {
    const controller = this.controller;
    // The initial projection can mount rows while openPrepared() is still
    // admitting the saved page. Native callbacks must not supersede that
    // selection before the opening transaction completes.
    if (!this.mounted || !this.opened || controller === undefined || this.data.totalCount() === 0) return;
    const generation = ++this.viewportGeneration;
    const row = this.data.getData(Math.min(this.first, this.data.totalCount() - 1));
    try {
      await controller.setVisible(row.ordinal);
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
        this.onChapterCommitted(controller.chapter.chapterIndex, controller.chapter.chapterTitle);
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
    if (!this.mounted || this.controller !== controller || preserveNewerPosition()) return;
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
  private rowRenderKey(row: MangaStripRow): string {
    const tile = this.controller?.tile(row.ordinal, row.tileIndex);
    const pageError = this.controller?.visiblePages().find(page => page.ordinal === row.ordinal)?.error;
    // LazyForEach retains the old branch for an unchanged key, even after a
    // data notification. Keep logical page identity separate from presentation,
    // as ReaderContinuousReadingStage does for decoded inline images.
    return JSON.stringify([row.key, row.known, row.width, row.height, row.sourceY, row.sourceHeight,
      tile?.image?.fileUri ?? '', tile?.image?.revision ?? '', tile?.error ?? pageError ?? '']);
  }
  private async handleBack(): Promise<void> {
    if (this.panel.length > 0) { this.panel = ''; return; }
    if (this.chapterEnd) { this.chapterEnd = false; return; }
    if (this.zoom > 1) { this.changeZoom(1); return; }
    if (this.exiting) return;
    this.exiting = true;
    await this.saveVisible();
    if (this.mounted) this.onBack();
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
    this.data.notify(true, 0, 0);
    this.restore(next, 0);
  }
  private async openDirectory(): Promise<void> {
    await this.saveVisible();
    if (this.mounted) { this.controlsVisible = true; this.panel = this.persistentDirectory() ? '' : 'directory'; this.directoryRevision += 1; }
  }
  private async openSourceSwitch(): Promise<void> {
    await this.saveVisible();
    if (this.mounted) this.onSwitchSource();
  }
  private retry(row: MangaStripRow): void {
    const task = row.known ? this.controller?.retryTile(row.ordinal, row.tileIndex) : this.controller?.retry(row.ordinal);
    task?.then((): void => { this.updateViewport(); }).catch((error: Error): void => { if (this.mounted) this.error = error.message; });
  }
  private toggleControls(): void {
    if (this.panel.length > 0 || this.chapterEnd) return;
    this.controlsVisible = !this.controlsVisible;
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
    await this.saveVisible();
    if (this.mounted) { this.panel = ''; this.chapterEnd = true; }
  }
  private async selectAdjacentChapter(direction: number): Promise<void> {
    if (this.adjacentChapter(direction) === undefined) return;
    await this.saveVisible();
    if (this.mounted) { this.panel = ''; this.chapterEnd = false; this.onChapter(direction); }
  }
  private async selectDirectoryTarget(index: number, proof?: JsonObject): Promise<void> {
    await this.saveVisible();
    if (this.mounted) { this.panel = ''; this.chapterEnd = false; this.onSelectDirectoryTarget(index, proof); }
  }
  private async openPanel(panel: string): Promise<void> {
    await this.saveVisible();
    if (this.mounted) {
      this.controlsVisible = true; this.chapterEnd = false; this.panel = panel;
      if (panel === 'directory') {
        this.directoryQuery = ''; this.directoryRevision += 1;
        if (this.persistentDirectory()) this.panel = '';
      }
    }
  }
  private async showDetail(): Promise<void> {
    await this.saveVisible();
    if (this.mounted) { this.panel = ''; this.onDetail(); }
  }
  private paperColor(): string {
    return this.backgroundPreference === 'ink' ? '#1C1E1A' : this.backgroundPreference === 'white' ? '#FFFFFF' : '#F8F4EC';
  }
  private surfaceColor(): string { return this.backgroundPreference === 'ink' ? '#282C25' : '#FFFCF8'; }
  private inkColor(): string { return this.backgroundPreference === 'ink' ? '#EAE7DE' : '#1F1B17'; }
  private mutedColor(): string { return this.backgroundPreference === 'ink' ? '#ABA99F' : '#756F69'; }
  private lineColor(): string { return this.backgroundPreference === 'ink' ? '#45483F' : '#E7E0D5'; }
  private persistentDirectory(): boolean {
    return mangaUsesPersistentDirectory(this.stageWidth, this.stageHeight, deviceInfo.deviceType === 'tablet');
  }
  private directoryColumnWidth(): number { return mangaDirectoryColumnWidth(this.stageWidth); }
  private widePanel(): boolean { return this.viewportWidth >= 600 || this.viewportWidth > this.viewportHeight; }
  private panelWidth(): number | string { return this.widePanel() ? Math.min(360, this.viewportWidth * 0.45) : '100%'; }
  private panelHeight(): number { return this.widePanel() ? this.viewportHeight : Math.min(this.viewportHeight * 0.78, 620); }
  private panelTitle(): string {
    return this.panel === 'directory' ? '章节目录' : this.panel === 'mode' ? '阅读方式' : this.panel === 'settings' ? '漫画设置' : '更多';
  }
  private directoryEntries(): LocalReadingTocEntry[] {
    return (this.remoteSession?.entries ?? []).map((entry: RemoteReadingTocEntry): LocalReadingTocEntry =>
      ({ index: entry.index, title: entry.title, level: entry.level, navigable: entry.navigable, downloadState: 'unknown' }));
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
    await this.changeFit('source');
    this.backgroundPreference = 'paper'; this.showPageNumbers = true;
    this.setBrightness(this.brightnessPercent, true);
    await this.settingsGateway?.updateMangaPreferences({ mangaDirection: 'vertical', mangaFit: 'source', mangaBackground: 'paper', mangaPageNumbers: true });
  }
  private interactiveInsets(_revision: number): ReaderInsetsVp {
    return readerInteractiveSafeInsets(ReaderWindowCoordinator.metrics());
  }
  build() {
    Column() {
      Row() {
        if (this.persistentDirectory()) { this.tabletDirectory(); }
        Stack({ alignContent: Alignment.Center }) {
        this.imageViewport();
        if (this.opened && this.showPageNumbers && !this.controlsVisible && !this.chapterEnd) {
          Text(`${this.pageOrdinal() + 1} / ${this.horizontalPageCount}`)
            .fontSize(11).fontColor(this.mutedColor()).padding({ left: 10, right: 10, top: 5, bottom: 5 })
            .backgroundColor(this.surfaceColor()).borderRadius(12).align(Alignment.BottomEnd).margin(12)
            .hitTestBehavior(HitTestMode.None);
        }
        if ((this.controlsVisible || this.error.length > 0 || this.recovering || this.loginRequired()) && !this.chapterEnd) {
          this.topControls();
          this.bottomControls();
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
      // The image viewport keeps one owner; floating controls never resize it.
      .padding(this.interactiveInsets(this.windowMetricsRevision));
  }
  @Builder
  private tabletDirectory() {
    Column() {
      Row() {
        Text('章节目录').fontFamily('ReaderNotoSerifSCBold').fontWeight(FontWeight.Bold).fontSize(19).fontColor(this.inkColor());
      }.width('100%').height(60).padding({ left: 20, right: 20 }).border({ width: { bottom: 1 }, color: this.lineColor() });
      this.directoryPanel();
    }.width(this.directoryColumnWidth()).height('100%').backgroundColor(this.surfaceColor())
      .border({ width: { right: 1 }, color: this.lineColor() });
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
                if (this.controller?.tile(row.ordinal, row.tileIndex)?.error !== undefined ||
                  this.controller?.visiblePages().some(page => page.ordinal === row.ordinal && page.status === 'failed')) {
                  Text(this.displayError(this.imageError(row))).fontColor(this.errorColor).maxLines(4)
                  Button('重试').onClick((): void => this.retry(row))
                } else { LoadingProgress().width(24).height(24) }
              }.width(this.rowDisplayWidth(row)).height(this.rowDisplayWidth(row) * row.height / row.width).justifyContent(FlexAlign.Center)
            }
          }.width('100%').height(this.rowDisplayHeight(row)).align(Alignment.Center)
            .onAppear((): void => this.onRowAppear(index))
        }, (row: MangaStripRow): string => this.rowRenderKey(row))
      }.height('100%').width(this.viewportWidth * this.zoom).cachedCount(0)
        .onScroll((): void => { this.onViewportScroll(); })
        .onScrollIndex((first: number, last: number): void => {
          if (this.seekingPage !== undefined && first >= 0 && first < this.data.totalCount() &&
            this.data.getData(first).ordinal !== this.seekingPage) return;
          this.first = first; this.last = last;
          if (!this.restoringAnchor) { this.layoutGeneration++; this.updateViewport(); }
          else this.onViewportScroll();
        })
        .onTouch((event: TouchEvent): void => { if (event.type === TouchType.Down) this.onViewportTouch(); })
        .onScrollStop((): void => { this.onViewportScroll(); this.saveVisible(); })
    }.height('100%').width('100%').scrollable(ScrollDirection.Horizontal)
      .onAreaChange((_old: Area, area: Area): void => { this.resizeViewport(Number(area.width), Number(area.height)); })
      .onScroll((): void => { this.onViewportScroll(); })
      .onScrollStop((): void => { this.onViewportScroll(); this.saveVisible(); })
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
        TapGesture({ count: 1 }).onAction((): void => this.toggleControls())));
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
        }.layoutWeight(1);
        Row() {
          this.iconAction((this.backgroundPreference === 'ink' ? $r('app.media.reader_directory_switch_theme_night') : $r('app.media.reader_directory_switch')), '换源', (): void => { void this.openSourceSwitch(); });
          this.iconAction((this.backgroundPreference === 'ink' ? $r('app.media.reader_directory_more_theme_night') : $r('app.media.reader_directory_more')), '更多', (): void => { void this.openPanel('more'); });
        }.width(88);
      }.height(52).width('100%').backgroundColor(this.surfaceColor()).borderRadius(18);
      if (this.recovering) {
        Button('内容已更新，确认从当前页继续').fontSize(12).height(44).onClick((): void => {
          if (this.data.totalCount() > this.first) {
            const row = this.data.getData(this.first);
            this.controller?.selectPage(row.ordinal).then((): void => { this.recovering = false; this.saveVisible(); });
          }
        });
      }
      if (this.error.length > 0) { Text(this.displayError(this.error)).fontSize(12).fontColor(this.errorColor).maxLines(3).padding(8).backgroundColor(this.surfaceColor()).borderRadius(12); }
      if (this.loginRequired()) { Button(this.loggingIn ? '登录处理中' : '登录书源后重试').height(44).enabled(!this.loggingIn).onClick((): void => { void this.loginAndRetry(); }); }
      if (this.offlineProbeStatus.length > 0) { Text(this.offlineProbeStatus).fontSize(10).maxLines(4).fontColor(this.mutedColor()).id('reader-manga-offline-probe-status'); }
    }.width('100%').padding({ left: 16, right: 16, top: 10 }).align(Alignment.Top);
  }
  @Builder
  private iconAction(icon: Resource, label: string, action: () => void) {
    ReaderIconButton({ icon, boxSize: 44, iconSize: 22, radius: 22, onTap: action }).accessibilityText(label);
  }
  @Builder
  private bottomControls() {
    Column({ space: 4 }) {
      Row({ space: 4 }) {
        Button('‹').height(44).width(44).fontSize(24).fontColor(this.inkColor()).backgroundColor(Color.Transparent)
          .enabled(this.opened && this.pageOrdinal() > 0).onClick((): void => { void this.stepPage(-1); });
        Slider({ value: this.pageOrdinal() + 1, min: 1, max: Math.max(1, this.horizontalPageCount), step: 1 })
          .layoutWeight(1).selectedColor('#2D4A3E').trackColor(this.lineColor()).enabled(this.opened && this.horizontalPageCount > 1)
          .onChange((value: number, mode: SliderChangeMode): void => { if (mode === SliderChangeMode.End) void this.seekPage(Math.round(value) - 1); });
        Text(this.opened ? `${this.pageOrdinal() + 1} / ${this.horizontalPageCount}` : '—')
          .fontSize(12).fontColor(this.mutedColor()).width(60).textAlign(TextAlign.Center);
        Button('›').height(44).width(44).fontSize(24).fontColor(this.inkColor()).backgroundColor(Color.Transparent)
          .enabled(this.opened).onClick((): void => { void this.stepPage(1); });
      }.width('100%').height(44);
      Row() {
        this.footerAction((this.backgroundPreference === 'ink' ? $r('app.media.reader_directory_directory_theme_night') : $r('app.media.reader_directory_directory')), '目录', 'directory');
        this.footerAction((this.backgroundPreference === 'ink' ? $r('app.media.reader_settings_header_theme_night') : $r('app.media.reader_settings_header')), '阅读方式', 'mode');
        this.footerAction((this.backgroundPreference === 'ink' ? $r('app.media.reader_settings_nav_active_theme_night') : $r('app.media.reader_settings_nav_active')), '设置', 'settings');
      }.width('100%').height(62).border({ width: { top: 1 }, color: this.lineColor() });
    }.width(Math.max(1, this.viewportWidth - 32)).padding({ left: 8, right: 8, top: 4, bottom: 4 })
      .backgroundColor(this.surfaceColor()).borderRadius(24).margin({ left: 16, right: 16, bottom: 12 })
      .align(Alignment.Bottom).constraintSize({ maxWidth: 560 });
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
      Column().width('100%').height('100%').backgroundColor('#52000000').onClick((): void => { this.panel = ''; });
      Column() {
        Row() {
          Text(this.panelTitle()).fontFamily('ReaderNotoSerifSCBold').fontWeight(FontWeight.Bold).fontSize(19).fontColor(this.inkColor()).layoutWeight(1);
          this.iconAction((this.backgroundPreference === 'ink' ? $r('app.media.reader_directory_back_theme_night') : $r('app.media.reader_directory_back')), '关闭面板', (): void => { this.panel = ''; });
        }.width('100%').height(60).padding({ left: 20, right: 8 }).border({ width: { bottom: 1 }, color: this.lineColor() });
        if (this.panel === 'directory') { this.directoryPanel(); }
        else {
          Scroll() {
            Column({ space: 20 }) {
              if (this.panel === 'mode') { this.modePanel(); }
              else if (this.panel === 'settings') { this.settingsPanel(); }
              else { this.morePanel(); }
            }.width('100%').padding(20);
          }.layoutWeight(1).width('100%').scrollBar(BarState.Off);
        }
      }.width(this.panelWidth()).height(this.panelHeight()).backgroundColor(this.surfaceColor()).borderRadius(this.widePanel() ? 18 : 24);
    }.width('100%').height('100%');
  }
  @Builder
  private directoryPanel() {
    Column({ space: 10 }) {
      TextInput({ text: this.directoryQuery, placeholder: '搜索话／卷名称' }).height(44).fontSize(13)
        .fontColor(this.inkColor()).backgroundColor(this.paperColor()).onChange((text: string): void => { this.directoryQuery = text; });
      Row() {
        Button('定位当前').fontSize(12).height(40).onClick((): void => { this.directoryQuery = ''; this.directoryRevision += 1; });
        Blank();
        Button(this.directoryAscending ? '正序' : '倒序').fontSize(12).height(40).onClick((): void => { this.directoryAscending = !this.directoryAscending; });
      }.width('100%');
      ReaderDirectoryNavigationSurface({
        sourceId: this.sourceId, bookId: this.bookId, query: this.directoryQuery, ascending: this.directoryAscending,
        currentChapterIndex: this.controller?.chapter?.chapterIndex ?? -1, openRevision: `${this.publishedManifestVersion}:${this.directoryRevision}`,
        locateCurrentRevision: this.directoryRevision, mangaDisplay: true, mangaScheme: this.backgroundPreference === 'ink' ? 'night' : 'day', rowHeight: 58, listPaddingX: 0, listPaddingY: 0, chapterEntries: this.directoryEntries(),
        chapterStartBookmarkCreationEnabled: false, chapterDownloadEnabled: false,
        fallbackBuilder: (): void => { this.directoryFallback(); },
        onSelectTarget: (chapterIndex: number, _offset: number, _scope?: RemoteReadingPositionScope, proof?: JsonObject): void => {
          void this.selectDirectoryTarget(chapterIndex, proof);
        },
      }).layoutWeight(1).width('100%');
    }.layoutWeight(1).width('100%').padding({ left: 20, right: 20, top: 12, bottom: 12 });
  }
  @Builder
  private directoryFallback() {
    Column({ space: 12 }) {
      Text('当前目录结构暂不可用').fontSize(13).fontColor(this.mutedColor());
      Button('打开完整目录').height(44).onClick((): void => { this.panel = ''; this.onDirectory(); });
    }.width('100%').padding(20);
  }
  @Builder
  private modePanel() {
    Text('阅读方向').fontSize(13).fontColor(this.mutedColor()).width('100%');
    Row({ space: 8 }) {
      this.option('竖向连续', !this.horizontal, (): void => { if (this.horizontal) this.toggleDirection(); }, 47);
      this.option('横向单图', this.horizontal, (): void => { if (!this.horizontal) this.toggleDirection(); }, 47);
    }.width('100%');
    Text('图片适配').fontSize(13).fontColor(this.mutedColor()).width('100%');
    Column({ space: 8 }) {
      this.option('跟随书源', this.fitPreference === 'source', (): void => { void this.changeFit('source'); });
      this.option('适合宽度', this.fitPreference === 'width', (): void => { void this.changeFit('width'); });
      this.option('完整图片', this.fitPreference === 'contain', (): void => { void this.changeFit('contain'); });
    }.width('100%');
    Row({ space: 8 }) {
      Button('−').width(44).height(44).onClick((): void => this.changeZoom(this.zoom - 0.5));
      Button(`${Math.round(this.zoom * 100)}%`).layoutWeight(1).height(44).onClick((): void => this.changeZoom(1));
      Button('+').width(44).height(44).onClick((): void => this.changeZoom(this.zoom + 0.5));
    }.width('100%');
  }
  @Builder
  private option(label: string, selected: boolean, action: () => void, widthPercent: number = 100) {
    Button(label).height(48).width(`${widthPercent}%`).fontSize(13).fontWeight(selected ? FontWeight.Bold : FontWeight.Regular)
      .fontColor(selected ? '#FFFFFF' : this.inkColor()).backgroundColor(selected ? '#1F3528' : this.paperColor())
      .borderRadius(14).onClick(action);
  }
  @Builder
  private settingsPanel() {
    Text('阅读底色').fontSize(13).fontColor(this.mutedColor()).width('100%');
    Row({ space: 8 }) {
      this.option('暖纸', this.backgroundPreference === 'paper', (): void => this.setBackground('paper'), 31);
      this.option('素白', this.backgroundPreference === 'white', (): void => this.setBackground('white'), 31);
      this.option('深墨', this.backgroundPreference === 'ink', (): void => this.setBackground('ink'), 31);
    }.width('100%');
    Row() {
      Text('亮度').fontSize(13).fontColor(this.inkColor()); Blank();
      Text(this.automaticBrightness ? '跟随系统' : `${Math.round(this.brightnessPercent)}%`).fontSize(12).fontColor(this.mutedColor());
    }.width('100%');
    Slider({ value: this.brightnessPercent, min: 1, max: 100, step: 1 }).width('100%').selectedColor('#2D4A3E')
      .onChange((value: number): void => this.setBrightness(value));
    Row() {
      Text('跟随系统亮度').fontSize(13).fontColor(this.inkColor()).layoutWeight(1);
      Toggle({ type: ToggleType.Switch, isOn: this.automaticBrightness }).selectedColor('#1F3528')
        .onChange((enabled: boolean): void => this.setBrightness(this.brightnessPercent, enabled));
    }.width('100%').height(44);
    Row() {
      Text('始终显示页码').fontSize(13).fontColor(this.inkColor()).layoutWeight(1);
      Toggle({ type: ToggleType.Switch, isOn: this.showPageNumbers }).selectedColor('#1F3528')
        .onChange((enabled: boolean): void => this.setPageNumbers(enabled));
    }.width('100%').height(44);
    Button('恢复漫画默认设置').width('100%').height(44).fontSize(13).fontColor(this.mutedColor()).backgroundColor(this.paperColor())
      .onClick((): void => { this.resetMangaPreferences().catch((error: Error): void => { if (this.mounted) this.error = error.message; }); });
  }
  @Builder
  private morePanel() {
    this.option('更换书源', false, (): void => { this.panel = ''; void this.openSourceSwitch(); });
    Button('缓存本章').width('100%').height(48).enabled(this.opened && !this.offline).fontColor(this.inkColor()).backgroundColor(this.paperColor())
      .onClick((): void => { this.panel = ''; this.onDownloadChapter(); });
    Button('重新获取本章图片').width('100%').height(48).enabled(this.opened && !this.offline).fontColor(this.inkColor()).backgroundColor(this.paperColor())
      .onClick((): void => { this.panel = ''; this.refreshImages().catch((error: Error): void => { if (this.mounted) this.error = error.message; }); });
    this.option('漫画详情', false, (): void => { void this.showDetail(); });
    this.option(this.inBookshelf ? '移出书架' : '加入书架', false, (): void => { this.panel = ''; this.onToggleShelf(); });
  }
  @Builder
  private chapterEndContent() {
    Column({ space: 18 }) {
      Text('本篇完').fontFamily('ReaderNotoSerifSCBold').fontWeight(FontWeight.Bold).fontSize(28).fontColor(this.inkColor());
      Text(this.title).fontSize(14).fontColor(this.mutedColor()).maxLines(2).textAlign(TextAlign.Center);
      if (this.adjacentChapter(1) !== undefined) {
        Text(`接下来 · ${this.adjacentChapter(1)?.title ?? ''}`).fontSize(14).fontColor(this.mutedColor()).maxLines(2).textAlign(TextAlign.Center);
        Button('继续阅读').height(48).width(220).fontColor('#FFFFFF').backgroundColor('#1F3528').borderRadius(16)
          .onClick((): void => { void this.selectAdjacentChapter(1); });
      }
      Button('返回目录').height(44).width(220).fontColor(this.inkColor()).backgroundColor(this.surfaceColor()).borderRadius(16)
        .onClick((): void => { void this.openPanel('directory'); });
      Button('返回正文').height(44).width(220).fontColor(this.mutedColor()).backgroundColor(Color.Transparent)
        .onClick((): void => { this.chapterEnd = false; });
    }.width('100%').height('100%').padding(24).justifyContent(FlexAlign.Center).backgroundColor(this.paperColor());
  }
}
