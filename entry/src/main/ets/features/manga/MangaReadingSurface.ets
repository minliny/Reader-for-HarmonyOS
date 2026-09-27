import hilog from '@ohos.hilog';
import type { JsonObject } from '@reader/core-harmony';
import { mangaUserError } from './MangaUserError';
import type { ReaderSettingsGateway } from '../reading/ReaderSettingsGateway';
import type { ReadingGatewayRuntime } from '../reading/ReadingGatewayRuntime';
import { RemoteReadingFlowGateway, type RemoteReadingBookSeed, type RemoteReadingSession } from '../reading/RemoteReadingFlowGateway';
import { MangaSessionGateway } from './MangaSessionGateway';
import { MangaSessionController, MangaTileRequest } from './MangaSessionController';
import { PhotoViewScaleModel } from './vendor/photoview/PhotoViewScaleModel';
import { MangaStripProjection, MangaStripRow } from './MangaStripProjection';

interface MangaViewportAnchor { ordinal: number; y: number; x?: number; }

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
  private visibleAnchor: MangaViewportAnchor | undefined;
  private publishedManifestVersion: string = '';
  private restoringAnchor: boolean = false;

  aboutToAppear(): void {
    if (this.runtime === undefined) { this.error = 'MANGA_RESOURCE_HOST_UNAVAILABLE'; return; }
    this.mounted = true;
    this.horizontal = this.settingsGateway?.current()?.mangaDirection === 'horizontal';
    this.fitPreference = this.settingsGateway?.current()?.mangaFit ?? 'source';
    this.onExitRequestHandler((): void => {
      if (this.mounted) this.handleBack();
    });
    const controller = new MangaSessionController(this.runtime);
    this.controller = controller;
    controller.onChange = (): void => this.publish();
    this.open(controller);
  }
  aboutToDisappear(): void {
    this.mounted = false; this.layoutGeneration++; this.viewportGeneration++; this.loginGeneration++;
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
      this.title = chapter.chapterTitle;
      this.data.notify(changed, this.first, this.last);
      if (changed && this.opened && anchor !== undefined) this.restore(anchor.ordinal, anchor.y, anchor.x ?? 0);
    } catch (error) { this.error = error instanceof Error ? error.message : '漫画布局失败'; }
  }
  private rememberVisible(): void {
    if (this.restoringAnchor) return;
    if (this.data.totalCount() <= this.first) return;
    const row = this.data.getData(this.first);
    try {
      const y = this.data.projection.position(this.first, -this.scroller.getItemRect(this.first).y - this.rowDisplayTop(row), this.rowDisplayWidth(row));
      this.visibleAnchor = { ordinal: row.ordinal, y, x: this.visibleX(row) };
    } catch (_error) {
      // Unknown geometry must not erase an already measured intra-image anchor.
      if (this.visibleAnchor?.ordinal !== row.ordinal) this.visibleAnchor = { ordinal: row.ordinal, y: 0 };
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
    const generation = ++this.layoutGeneration;
    setTimeout((): void => {
      if (!this.mounted || generation !== this.layoutGeneration) return;
      const index = this.data.projection.index(ordinal, y);
      this.scroller.scrollToIndex(index, false, ScrollAlign.START);
      const row = this.data.getData(index);
      if (row.known) this.scroller.scrollBy(0, Math.max(0, y * row.sourceHeight - row.sourceY) * this.rowDisplayWidth(row) / row.width + (y > 0 ? this.rowDisplayTop(row) : 0));
      this.horizontalScroller.scrollTo({ xOffset: x * this.rowDisplayWidth(row) + this.rowDisplayLeft(row), yOffset: 0, animation: false });
      this.first = index; this.last = index; this.restoringAnchor = false; this.updateViewport();
    }, 0);
  }
  private async updateViewport(): Promise<void> {
    const controller = this.controller;
    if (!this.mounted || controller === undefined || this.data.totalCount() === 0) return;
    const generation = ++this.viewportGeneration;
    const row = this.data.getData(Math.min(this.first, this.data.totalCount() - 1));
    try {
      await controller.setVisible(row.ordinal);
      if (!this.mounted || generation !== this.viewportGeneration) return;
      const requested: MangaTileRequest[] = [];
      for (let index = this.first; index <= Math.min(this.data.totalCount() - 1, this.last + 1, this.first + 7); index++) {
        const item = this.data.getData(index);
        if (item.known) requested.push({ ordinal: item.ordinal, tileIndex: item.tileIndex });
      }
      await controller.setTileWindow(requested);
      if (this.mounted && generation === this.viewportGeneration && !this.chapterCommitted &&
        controller.tile(row.ordinal, row.tileIndex)?.image !== undefined && controller.chapter !== undefined) {
        this.chapterCommitted = true;
        this.onChapterCommitted(controller.chapter.chapterIndex, controller.chapter.chapterTitle);
      }
    } catch (error) { if (this.mounted && generation === this.viewportGeneration) this.error = error instanceof Error ? error.message : '图片加载失败'; }
  }
  private async saveVisible(): Promise<void> {
    if (!this.opened || this.recovering || this.controller === undefined || this.data.totalCount() <= this.first) return;
    try {
      const row = this.data.getData(this.first);
      const y = this.data.projection.position(this.first, -this.scroller.getItemRect(this.first).y - this.rowDisplayTop(row), this.rowDisplayWidth(row));
      await this.controller.savePosition(row.ordinal, this.visibleX(row), y).catch((error: Error): void => {
        if (error.message !== 'MANGA_POSITION_NOT_VISIBLE') {
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
  private async changeFit(): Promise<void> {
    this.rememberVisible();
    const anchor = this.visibleAnchor;
    this.fitPreference = this.fitPreference === 'source' ? 'width' : this.fitPreference === 'width' ? 'contain' : 'source';
    this.settingsGateway?.updateMangaFit(this.fitPreference).catch((error: Error): void => { if (this.mounted) this.error = error.message; });
    const controller = this.controller;
    try { await controller?.setPreviewMode(this.effectiveFit() === 'contain', anchor?.ordinal ?? this.horizontalPage); }
    catch (error) { if (this.mounted) this.error = error instanceof Error ? error.message : '漫画布局失败'; }
    if (!this.mounted || this.controller !== controller) return;
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
    const controller = this.controller;
    if (controller === undefined) return;
    await this.saveVisible();
    await controller.refreshChapter();
    if (!this.mounted || this.controller !== controller) return;
    await controller.setPreviewMode(this.effectiveFit() === 'contain', controller.displayedOrdinal);
    if (!this.mounted || this.controller !== controller) return;
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
  private handleBack(): void {
    if (this.zoom > 1) { this.changeZoom(1); return; }
    void this.saveVisible();
    this.onBack();
  }
  private changeZoom(scale: number): void {
    if (!Number.isFinite(scale) || scale <= 0) return;
    if (this.pinchAnchor === undefined) this.rememberVisible();
    const anchor = this.pinchAnchor ?? this.visibleAnchor;
    this.scalePolicy.setScale(scale, false);
    this.zoom = this.scalePolicy.scale;
    if (anchor !== undefined) this.restore(anchor.ordinal, anchor.y, anchor.x ?? 0);
  }
  private toggleDirection(): void {
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
    await this.saveVisible();
    if (!this.mounted || this.controller !== controller) return;
    this.horizontalPage = next;
    this.visibleAnchor = undefined;
    this.first = 0; this.last = 0;
    this.data.projection.publish(chapter.manifest, (index: number) => controller.pageGeometry(index), next, controller.totalPages, (ordinal: number) => controller.pageAt(ordinal));
    this.data.notify(true, 0, 0);
    this.restore(next, 0);
  }
  private async openDirectory(): Promise<void> {
    await this.saveVisible();
    if (this.mounted) this.onDirectory();
  }
  private async openSourceSwitch(): Promise<void> {
    await this.saveVisible();
    if (this.mounted) this.onSwitchSource();
  }
  private retry(row: MangaStripRow): void {
    const task = row.known ? this.controller?.retryTile(row.ordinal, row.tileIndex) : this.controller?.retry(row.ordinal);
    task?.then((): void => { this.updateViewport(); }).catch((error: Error): void => { if (this.mounted) this.error = error.message; });
  }
  build() {
    Column() {
      Row() {
        Button('返回').onClick((): void => this.handleBack())
        Text(this.title).maxLines(1).layoutWeight(1).fontColor(this.mangaForegroundColor)
      }.width('100%')
      if (this.offlineProbeStatus.length > 0) {
        Text(this.offlineProbeStatus).fontSize(10).maxLines(4).fontColor(this.mangaForegroundColor).id('reader-manga-offline-probe-status')
      }
      Row() {
        Button('目录与下载').onClick((): void => { void this.openDirectory(); })
        Button('换源').onClick((): void => { void this.openSourceSwitch(); })
      }.width('100%').justifyContent(FlexAlign.SpaceBetween)
      if (this.recovering) {
        Button('章节内容已更新，确认从当前页继续').onClick((): void => {
          const row = this.data.getData(this.first);
          this.controller?.selectPage(row.ordinal).then((): void => { this.recovering = false; this.saveVisible(); });
        })
      }
      if (this.error.length > 0) { Text(this.displayError(this.error)).fontColor(this.errorColor).maxLines(3) }
      if (this.loginRequired()) { Button(this.loggingIn ? '登录处理中' : '登录书源后重试').enabled(!this.loggingIn).onClick((): void => { void this.loginAndRetry(); }) }
      if (this.opened && !this.offline) {
        Button('重新获取本章图片').onClick((): void => {
          this.refreshImages().catch((error: Error): void => { if (this.mounted) this.error = error.message; });
        })
      }
      Row() {
        Button(this.horizontal ? '切换纵向' : '切换横向').onClick((): void => this.toggleDirection())
        Button('缩小').onClick((): void => this.changeZoom(this.zoom - 0.5))
        Button(`${Math.round(this.zoom * 100)}%`).onClick((): void => this.changeZoom(1))
        Button('放大').onClick((): void => this.changeZoom(this.zoom + 0.5))
      }.width('100%')
      Button(this.fitPreference === 'source' ? '尺寸：跟随书源' : this.fitPreference === 'width' ? '尺寸：适合宽度' : '尺寸：完整图片').onClick((): void => { void this.changeFit(); })
      Scroll(this.horizontalScroller) {
      List({ scroller: this.scroller, space: 0 }) {
        LazyForEach(this.data, (row: MangaStripRow) => {
          ListItem() {
            if (this.controller?.tile(row.ordinal, row.tileIndex)?.image !== undefined) {
              Image(this.controller?.tile(row.ordinal, row.tileIndex)?.image?.fileUri)
                .width(this.rowDisplayWidth(row)).height(this.rowDisplayWidth(row) * row.height / row.width).objectFit(ImageFit.Fill)
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
        }, (row: MangaStripRow): string => row.key)
      }.height('100%').width(this.viewportWidth * this.zoom).cachedCount(0)
        .onScroll((): void => { this.rememberVisible(); })
        .onScrollIndex((first: number, last: number): void => {
          this.layoutGeneration++; this.first = first; this.last = last; this.updateViewport();
        })
        .onScrollStop((): void => { this.saveVisible(); })
      }.layoutWeight(1).width('100%').scrollable(ScrollDirection.Horizontal)
        .onAreaChange((_old: Area, area: Area): void => { this.resizeViewport(Number(area.width), Number(area.height)); })
        .onScroll((): void => { this.rememberVisible(); })
        .onScrollStop((): void => { this.saveVisible(); })
        .parallelGesture(GestureGroup(GestureMode.Exclusive, PinchGesture({ fingers: 2 })
          .onActionStart((): void => { this.rememberVisible(); this.pinchAnchor = this.visibleAnchor; this.pinchStartScale = this.zoom; })
          .onActionUpdate((event: GestureEvent): void => { this.changeZoom(this.pinchStartScale * event.scale); })
          .onActionEnd((): void => { this.pinchAnchor = undefined; this.saveVisible(); })
          .onActionCancel((): void => { this.pinchAnchor = undefined; }),
          SwipeGesture({ direction: SwipeDirection.Horizontal }).onAction((event: GestureEvent): void => {
            if (this.horizontal && this.zoom === 1) this.turnPage(Math.abs(event.angle) > 90 ? 1 : -1);
          })))
      if (this.horizontal) {
        Row() {
          Button('上一图').enabled(this.horizontalPage > 0).onClick((): void => { this.turnPage(-1); })
          Text(`${this.horizontalPage + 1} / ${this.controller?.totalPages ?? 0}`).fontColor(this.mangaForegroundColor)
          Button('下一图').enabled(this.horizontalPage + 1 < (this.controller?.totalPages ?? 0)).onClick((): void => { this.turnPage(1); })
        }.width('100%').justifyContent(FlexAlign.SpaceBetween)
      }
      Row() {
        Button('上一章').onClick((): void => { this.saveVisible().then((): void => this.onChapter(-1)); })
        Button('下一章').onClick((): void => { this.saveVisible().then((): void => this.onChapter(1)); })
      }.width('100%').justifyContent(FlexAlign.SpaceBetween)
    }.width('100%').height('100%').backgroundColor(this.mangaBackgroundColor)
  }
}
