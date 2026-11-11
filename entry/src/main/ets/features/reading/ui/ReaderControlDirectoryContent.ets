import type { ReaderDirectoryTargetProof } from '../application/ReaderDirectoryTargetProof';
import hilog from '@ohos.hilog';
import { DEBUG } from '../../../../../../build/default/generated/profile/default/BuildProfile';
import { TYPE_READER_DIRECTORY_CURRENT_TITLE, TYPE_READER_DIRECTORY_POSITION, TYPE_READER_DIRECTORY_TAB_COMPACT } from '../../../ui/foundation/ReaderTypography';
import { readerDirectoryScopeKey } from '../application/ReaderDirectoryNavigation';
import type { RemoteReadingPositionScope } from '../application/RemoteReadingPositionMigration';
import { readerAppColor } from '../../../ui/foundation/ReaderThemeRegistry';
import { FrameCallback, LengthMetrics } from '@kit.ArkUI';
import { sampleReaderControlMotionPresentation, type ReaderControlMotionPresentation } from './ReaderControlMotionPresentation';
import type { LocalReadingTocEntry } from '../application/LocalReadingFlowGateway';
import type { ReaderBookIdentity } from '../presentation/ReaderBookmarkProjection';
import { readerControlDirectorySnapshot, ReaderControlDirectoryPosition,
  type ReaderControlDirectoryRow, type ReaderControlDirectorySnapshot } from './ReaderControlDirectoryModel';
import type { ReaderDirectoryChapterStartBookmarkRequest } from '../presentation/ReaderDirectoryMarkerState';
import { ReaderBookmarkRow } from './ReaderBookmarkRow';
import { ReaderBookmarkEmptyState } from './ReaderBookmarkEmptyState';
import { ReaderBookmarkLoadingState } from './ReaderBookmarkLoadingState';
import { ReaderBookmarkErrorState } from './ReaderBookmarkErrorState';
import { ReaderRecoveryAction } from '../../../ui/feedback/ReaderRecoveryAction';
import { ReaderPageState } from '../../../ui/feedback/ReaderPageState';
import { MESSAGE_BODY } from '../../../ui/foundation/ReaderMessageStyle';
import { ReaderDirectoryToolbar } from './ReaderDirectoryToolbar';
import { ReaderDirectoryChapterRow } from './ReaderDirectoryChapterRow';
import { ReaderDirectoryNavigationSurface } from './ReaderDirectoryNavigationSurface';
import type { ReaderControlModuleMeasurer, ReaderControlCandidateWidths, ReaderControlModuleMinimum } from './ReaderLayoutGeometry';
import { measureReaderDirectoryMinimum, type ReaderDirectoryMinimumFacts,
  type ReaderDirectoryMinimumProfile } from './ReaderControlDirectoryMinimum';
import type { ReaderControlBookmarkNaturalSize } from './ReaderControlBookmarkGeometry';
import { readerDirectorySignalScrollCommand, readerDirectorySignalScrollIntent } from '../presentation/ReaderDirectoryViewport';
import { TOK_LINE, TOK_READ_ACTIVE_SOFT, TOK_READ_INK, TOK_READ_MUTED,
  TOK_READ_PRIMARY, TOK_SURFACE_PANEL_SOFT, TOK_SPACE_SM } from '../../../ui/foundation/ReaderTokens';

class ControlDirectoryDataSource implements IDataSource {
  private rows: ReaderControlDirectoryRow[] = [];
  private signatures: string[] = [];
  private listeners: DataChangeListener[] = [];
  totalCount(): number { return this.rows.length; }
  getData(index: number): ReaderControlDirectoryRow { return this.rows[index]; }
  registerDataChangeListener(listener: DataChangeListener): void { this.listeners.push(listener); }
  unregisterDataChangeListener(listener: DataChangeListener): void {
    this.listeners = this.listeners.filter((value: DataChangeListener): boolean => value !== listener);
  }
  replace(rows: ReaderControlDirectoryRow[]): void {
    // Values can change while row identity remains stable. Notify changed
    // rows individually; use a reload only for a structural key change.
    const signatures = rows.map((row: ReaderControlDirectoryRow): string => JSON.stringify(row));
    const structural = rows.length !== this.rows.length ||
      rows.some((row: ReaderControlDirectoryRow, index: number): boolean => row.key !== this.rows[index].key);
    const previous = this.signatures;
    this.rows = rows; this.signatures = signatures;
    if (structural) {
      for (const listener of this.listeners) listener.onDataReloaded();
    } else {
      for (let index = 0; index < rows.length; index += 1) {
        if (signatures[index] === previous[index]) continue;
        for (const listener of this.listeners) listener.onDataChange(index);
      }
    }
  }
}

class ControlDirectoryFrame extends FrameCallback {
  private action: () => void;
  constructor(action: () => void) { super(); this.action = action; }
  onFrame(_time: number): void { this.action(); }
  onIdle(_remaining: number): void {}
}

/** Control-only content. The shell owns its viewport; there is no standalone
 * page mode, hidden data sentinel, fixed Full mount box or alternate List tree.
 * Business data updates and visual progress are separate inputs.
 */
@Component
export struct ReaderControlDirectoryContent {
  @StorageLink('readerAppScheme') private appThemeScheme: string = 'day';
  @StorageLink('readerWindowMetricsRevision') @Watch('publishMinimumMeasurer') private minimumMetricsRevision: number = 0;
  @Prop @Watch('publishMinimumMeasurer') minimumIdentity: string = '';
  @Prop @Watch('onProgressChanged') minimumKey: string = '';
  onMinimumMeasurerReady: (identity: string, measurer: ReaderControlModuleMeasurer | undefined) => void =
    (_identity: string, _measurer: ReaderControlModuleMeasurer | undefined): void => {};

  @Prop @Watch('refreshData') entries: LocalReadingTocEntry[] = [];
  @Prop @Watch('refreshData') catalogComplete: boolean = true;
  @Prop @Watch('refreshData') catalogLoading: boolean = false;
  @Prop @Watch('refreshData') catalogLoadFailed: boolean = false;
  @Prop @Watch('refreshData') catalogChapterCount: number = 0;
  @Prop @Watch('refreshData') catalogCurrentPosition: number = -1;
  @Prop @Watch('refreshData') catalogReadableChapterCount: number = 0;
  @Prop @Watch('refreshData') catalogReadablePosition: number = -1;
  onRequireCompleteCatalog: () => void = (): void => {};
  @Prop @Watch('refreshData') currentChapterIndex: number = -1;
  @Prop @Watch('openList') tab: string = 'directory';
  @Prop @Watch('openList') sessionKey: string = '';
  @Prop @Watch('refreshData') bookmarkIdentity: ReaderBookIdentity | undefined = undefined;
  @Prop @Watch('onProgressChanged') progress: number = 0;
  @Prop @Watch('onInputChanged') interactionEnabled: boolean = true;
  @Prop availableWidth: number = 286;
  @Prop availableHeight: number = 190;
  @Prop chapterDownloadEnabled: boolean = false;
  @Prop mangaSearch: boolean = false;
  @Prop chapterStartBookmarkCreationEnabled: boolean = false;
  @Prop @Watch('publishMinimumMeasurer') bookmarkLoadFailed: boolean = false;
  @Prop @Watch('publishMinimumMeasurer') bookmarkLoadMessage: string = '';
  onTabChange: (tab: string) => void = (_tab: string): void => {};
  onSelectChapter: (index: number) => void = (_index: number): void => {};
  onSelectNavigationTarget: (chapterIndex: number, chapterOffsetScalar: number, positionScope?: RemoteReadingPositionScope, directoryTargetProof?: ReaderDirectoryTargetProof) => void =
    (_chapterIndex: number, _chapterOffsetScalar: number, _positionScope?: RemoteReadingPositionScope, _directoryTargetProof?: ReaderDirectoryTargetProof): void => {};
  onSelectBookmark: ((id: string, index: number, offset: number, positionScope?: RemoteReadingPositionScope) => void) | undefined = undefined;
  onDownloadChapter: (index: number) => void = (_index: number): void => {};
  onDeleteBookmarks: (times: number[]) => void = (_times: number[]): void => {};
  onCreateChapterStartBookmark: (request: ReaderDirectoryChapterStartBookmarkRequest) => void =
    (_request: ReaderDirectoryChapterStartBookmarkRequest): void => {};
  onRetryBookmarkLoad: () => void = (): void => {};
  @State private draft: string = '';
  @State private ascending: boolean = true;
  @State private snapshot: ReaderControlDirectorySnapshot =
    readerControlDirectorySnapshot([], 'directory', '', true, -1);
  @State private navigationInteracted: boolean = false;
  @State private navigationActive: boolean = false;
  @State private query: string = '';
  private pendingCatalogAction: string = '';
  private scroller: Scroller = new Scroller();
  private dataSource: ControlDirectoryDataSource = new ControlDirectoryDataSource();
  private placement: ReaderControlDirectoryPosition = new ReaderControlDirectoryPosition();
  private mounted: boolean = false;
  private lifecycle: number = 0;
  private positionQueued: boolean = false;
  private positionTicket: number = -1;
  private previousRowHeight: number = 32;
  private leadingRow: number | undefined = undefined;
  private leadingKey: string | undefined = undefined;
  private leadingFraction: number = 0;
  private correctionQueued: boolean = false;
  private cachedPaint: ReaderControlMotionPresentation | undefined = undefined;
  private paintProgress: number = -1;
  private minimumProfiles: Map<string, ReaderDirectoryMinimumProfile> = new Map<string, ReaderDirectoryMinimumProfile>();
  private minimumProfileTicket: string = '';
  private minimumMeasurer: ReaderControlModuleMeasurer | undefined = undefined;
  private registeredMinimumIdentity: string = '';
  private minimumFactsSignature: string = '';

  aboutToAppear(): void { this.mounted = true; this.lifecycle += 1; this.openList(); }
  aboutToDisappear(): void {
    const identity = this.registeredMinimumIdentity;
    this.minimumMeasurer = undefined;
    if (identity.length > 0) this.onMinimumMeasurerReady(identity, undefined);
    this.mounted = false; this.lifecycle += 1; this.positionQueued = false; this.correctionQueued = false;
  }

  private minimumFacts(): ReaderDirectoryMinimumFacts {
    const representative = this.snapshot.rows[Math.max(0, this.snapshot.targetRow)] ?? this.snapshot.rows[0];
    const incomplete = this.tab === 'directory' && !this.catalogComplete;
    const status = incomplete ? this.snapshot.catalogState === 'failed' ? '目录加载失败，已保留当前条目' :
      this.snapshot.catalogState === 'loading' ? '正在加载完整目录' : '目录尚未加载完整' : '';
    const action = incomplete && this.snapshot.catalogState !== 'loading' ?
      this.snapshot.catalogState === 'failed' ? '重试加载目录' : '加载完整目录' : '';
    return { tab: this.tab, title: representative?.chapter?.title ?? representative?.bookmark?.chapterTitle ?? '',
      excerpt: representative?.bookmark?.excerpt ?? '', currentTitle: this.snapshot.currentTitle,
      currentPosition: this.snapshot.currentPosition, hasRows: this.snapshot.rows.length > 0,
      loading: this.snapshot.loading || incomplete && this.snapshot.catalogState === 'loading',
      bookmarkError: this.tab === 'bookmarks' && this.bookmarkLoadFailed,
      message: this.tab === 'bookmarks' ? this.bookmarkLoadFailed ?
        this.bookmarkLoadMessage.trim().length === 0 || this.bookmarkLoadMessage === '书签载入失败，请稍后重试' ? '请稍后重试。' : this.bookmarkLoadMessage :
        this.snapshot.loading ? '书签载入中…' : '在阅读页面下拉，收藏当前位置。' : incomplete ? status :
          this.snapshot.loading ? '目录载入中…' : '没有匹配的章节',
      action: this.tab === 'bookmarks' ? this.bookmarkLoadFailed ? '重试' : this.snapshot.loading ? '' : '返回目录' : action,
      catalogStatus: status, catalogAction: action };
  }

  private publishMinimumMeasurer(): void {
    if (!this.mounted || this.minimumIdentity.length === 0) return;
    const identity = this.minimumIdentity, facts = this.minimumFacts();
    const signature = JSON.stringify([identity, this.minimumMetricsRevision, facts]);
    // Props may deliver fresh object copies after a measured layout returns.
    // Only actual identity/font/display-fact changes invalidate the provider.
    if (this.minimumMeasurer !== undefined && this.registeredMinimumIdentity === identity &&
      this.minimumFactsSignature === signature) return;
    const context = this.getUIContext();
    const cache = new Map<string, ReaderDirectoryMinimumProfile>();
    let measurer: ReaderControlModuleMeasurer;
    measurer = (widths: ReaderControlCandidateWidths, key: string): ReaderControlModuleMinimum | undefined => {
      if (!this.mounted || identity !== this.minimumIdentity || this.minimumMeasurer !== measurer) return undefined;
      let profile = cache.get(key);
      if (profile === undefined) {
        profile = measureReaderDirectoryMinimum(context, widths, facts);
        if (profile === undefined) return undefined;
        cache.set(key, profile);
      }
      const ticket = key.slice(0, key.lastIndexOf('|'));
      if (ticket !== this.minimumProfileTicket) {
        const selected = this.minimumProfiles.get(this.minimumKey);
        this.minimumProfiles.clear();
        if (selected !== undefined) this.minimumProfiles.set(this.minimumKey, selected);
        this.minimumProfileTicket = ticket;
      }
      this.minimumProfiles.set(key, profile);
      return { module: 'directory', quick: profile.quick.minimum, full: profile.full.minimum };
    };
    this.registeredMinimumIdentity = identity;
    this.minimumFactsSignature = signature;
    this.minimumMeasurer = measurer;
    this.onMinimumMeasurerReady(identity, measurer);
  }

  private selectedMinimum(): ReaderDirectoryMinimumProfile | undefined {
    return this.minimumKey.length > 0 ? this.minimumProfiles.get(this.minimumKey) : undefined;
  }
  private tabHeight(): number {
    const profile = this.selectedMinimum();
    return profile === undefined ? this.value(31, 36) : this.value(profile.quick.tabHeightVp, profile.full.tabHeightVp);
  }
  private tabGrowth(): number { return this.tabHeight() - this.value(31, 36); }
  private toolbarHeight(): number { return this.selectedMinimum()?.full.toolbarHeightVp ?? 52; }
  private footerHeight(): number { return this.selectedMinimum()?.full.footerHeightVp ?? 48; }
  private bookmarkNaturalSize(): ReaderControlBookmarkNaturalSize | undefined {
    const profile = this.selectedMinimum();
    return profile === undefined ? undefined : { titleHeightVp: this.value(profile.quick.bookmark.titleHeightVp, profile.full.bookmark.titleHeightVp),
      excerptHeightVp: this.value(profile.quick.bookmark.excerptHeightVp, profile.full.bookmark.excerptHeightVp) };
  }

  private openList(): void {
    if (!this.mounted) return;
    this.pendingCatalogAction = '';
    this.placement.open(`${this.sessionKey}:${this.tab}`);
    this.leadingRow = undefined;
    this.leadingKey = undefined;
    this.previousRowHeight = this.rowHeight();
    this.navigationInteracted = false;
    this.navigationActive = false;
    this.refreshData();
  }

  private refreshData(): void {
    if (!this.mounted) return;
    const next = readerControlDirectorySnapshot(this.entries, this.tab, this.query,
      this.ascending, this.currentChapterIndex, this.bookmarkIdentity, {
        complete: this.catalogComplete, chapterCount: this.catalogChapterCount,
        loading: this.catalogLoading, loadFailed: this.catalogLoadFailed,
        currentPosition: this.catalogCurrentPosition, readableChapterCount: this.catalogReadableChapterCount,
        readablePosition: this.catalogReadablePosition }, this.mangaSearch);
    if (this.leadingKey !== undefined) {
      const index = next.rows.findIndex((row: ReaderControlDirectoryRow): boolean => row.key === this.leadingKey);
      this.leadingRow = index < 0 ? undefined : index + this.leadingFraction;
    }
    this.dataSource.replace(next.rows);
    this.snapshot = next;
    this.publishMinimumMeasurer();
    if (!this.navigationActive) this.queuePosition();
    if (this.leadingRow !== undefined) this.queueLeadingCorrection();
    if (this.catalogComplete && this.pendingCatalogAction.length > 0) {
      const lifecycle = this.lifecycle, key = this.sessionKey;
      this.getUIContext().postFrameCallback(new ControlDirectoryFrame((): void => {
        if (!this.mounted || lifecycle !== this.lifecycle || key !== this.sessionKey || !this.catalogComplete) return;
        const action = this.pendingCatalogAction;
        this.pendingCatalogAction = '';
        if (action === 'search') this.search();
        else if (action === 'sort') this.sort();
        else if (action === 'top') this.scrollCatalogEdge(false);
        else if (action === 'bottom') this.scrollCatalogEdge(true);
      }));
    }
  }

  private queuePosition(): void {
    if (!this.mounted || this.navigationActive) return;
    const lifecycle = this.lifecycle;
    const ticket = this.placement.ticket();
    if (this.positionQueued && this.positionTicket === ticket) return;
    this.positionQueued = true;
    this.positionTicket = ticket;
    this.getUIContext().postFrameCallback(new ControlDirectoryFrame((): void => {
      if (!this.mounted || lifecycle !== this.lifecycle || this.positionTicket !== ticket) return;
      this.positionQueued = false;
      if (this.navigationActive) return;
      const offset = this.placement.offset(this.snapshot, this.listHeight(), this.rowHeight(), ticket);
      if (offset === undefined) return;
      try {
        this.scroller.scrollToIndex(this.snapshot.targetRow, false, ScrollAlign.CENTER);
        this.placement.commit(ticket);
      } catch (_error) { /* First layout will retry this same request. */ }
    }));
  }

  private onProgressChanged(): void {
    if (!this.mounted) return;
    const nextHeight = this.rowHeight();
    if (nextHeight === this.previousRowHeight) return;
    if (this.leadingRow === undefined) this.captureLeadingRow();
    this.previousRowHeight = nextHeight;
    this.queueLeadingCorrection();
  }

  private queueLeadingCorrection(): void {
    // With the first row at zero, changing row height cannot change its anchor.
    if (!this.mounted || this.leadingRow === undefined || this.leadingRow === 0) return;
    if (this.correctionQueued) return;
    this.correctionQueued = true;
    const lifecycle = this.lifecycle;
    this.getUIContext().postFrameCallback(new ControlDirectoryFrame((): void => {
      if (!this.mounted || lifecycle !== this.lifecycle) return;
      this.correctionQueued = false;
      if (this.leadingRow === undefined) return;
      try {
        const index = Math.floor(this.leadingRow);
        const height = this.rowHeight();
        const offset = this.leadingFraction * height;
        if (!this.leadingAnchorIsAligned()) {
          this.scroller.scrollToIndex(index, false, ScrollAlign.START,
            { extraOffset: LengthMetrics.vp(offset) });
        }
      } catch (_error) { /* The next mounted frame can restore the anchor. */ }
      if (this.interactionEnabled && (this.progress === 0 || this.progress === 1) &&
        this.leadingAnchorIsAligned()) {
        this.leadingRow = undefined; this.leadingKey = undefined;
      }
    }));
  }

  private leadingAnchorIsAligned(): boolean {
    if (this.leadingRow === undefined) return false;
    try {
      const height = this.rowHeight();
      const rect = this.scroller.getItemRect(Math.floor(this.leadingRow));
      const tolerance = 0.5 / this.getUIContext().vp2px(1);
      return Number.isFinite(rect.y) && Number.isFinite(rect.height) && rect.height > 0 &&
        Math.abs(rect.height - height) <= tolerance &&
        Math.abs(rect.y + this.leadingFraction * height) <= tolerance;
    } catch (_error) { return false; }
  }

  private captureLeadingRow(): void {
    try {
      // Lazy List's total offset includes estimates for offscreen row heights.
      // Dividing it by the current animated height invents a different row
      // after deep scrolling. Read the actual visible item and its local rect.
      const index = this.scroller.getItemIndex(this.availableWidth / 2, 0.5);
      if (index < 0 || index >= this.snapshot.rows.length) return;
      const rect = this.scroller.getItemRect(index);
      if (!Number.isFinite(rect.y) || !Number.isFinite(rect.height) || rect.height <= 0) return;
      this.leadingFraction = Math.max(0, Math.min(0.999999, -rect.y / rect.height));
      this.leadingRow = index + this.leadingFraction;
      this.leadingKey = this.snapshot.rows[index]?.key;
    } catch (_error) { /* No mounted List during loading and empty states. */ }
  }

  private presentation(): ReaderControlMotionPresentation {
    if (this.cachedPaint === undefined || this.paintProgress !== this.progress) {
      this.paintProgress = this.progress;
      this.cachedPaint = sampleReaderControlMotionPresentation(this.progress);
    }
    return this.cachedPaint;
  }
  private onInputChanged(): void {
    if (!this.mounted || this.snapshot.rows.length === 0) return;
    if (!this.interactionEnabled) {
      if (this.leadingRow === undefined) this.captureLeadingRow();
      // Native input is disabled and onWillScroll rejects inertia. Do not
      // round-trip an estimated absolute offset to "stop" the virtual List.
    } else if ((this.progress === 0 || this.progress === 1) && this.leadingAnchorIsAligned()) {
      // A larger Full viewport can clamp the native List before the desired
      // trailing row. Keep that semantic intent through the endpoint so a
      // later collapse can restore it; real user scrolling still invalidates it.
      this.leadingRow = undefined; this.leadingKey = undefined;
    }
  }

  private cancelPendingPlacement(): void {
    this.placement.userScroll(); this.leadingRow = undefined; this.leadingKey = undefined;
  }
  private userScroll(): void {
    this.cancelPendingPlacement();
    this.navigationInteracted = true;
  }
  private value(quick: number, full: number): number { return quick + (full - quick) * this.progress; }
  private rowHeight(): number {
    const profile = this.selectedMinimum();
    return profile === undefined ? this.tab === 'bookmarks' ? this.value(54, 74) : this.value(32, 40) :
      this.value(profile.quick.rowHeightVp, profile.full.rowHeightVp);
  }
  private listTop(): number {
    const profile = this.selectedMinimum();
    return profile === undefined ? this.tab === 'bookmarks' ? this.value(47, 99) : this.value(48, 99) :
      this.value(profile.quick.listTopVp, profile.full.listTopVp);
  }
  private listHeight(): number { return Math.max(0, this.availableHeight - this.listTop() -
    (this.tab === 'bookmarks' ? 1 : 1 + this.footerHeight() * this.progress)); }
  private rowPadding(): number { return this.tab === 'bookmarks' ? this.value(15, 10) : this.value(16, 10); }
  private rowWidth(): number { return Math.max(0, this.availableWidth - 2 - this.rowPadding() * 2); }
  private placeholder(): string { return this.tab === 'bookmarks' ? '搜索书签内容' : '搜索章节名称'; }

  private search(): void {
    if (this.deferCatalogAction('search')) return;
    this.query = this.draft.trim(); this.cancelPendingPlacement(); this.refreshData();
    this.scroller.scrollEdge(Edge.Top);
  }
  private sort(): void {
    if (this.deferCatalogAction('sort')) return;
    this.ascending = !this.ascending; this.cancelPendingPlacement(); this.refreshData();
    this.scroller.scrollEdge(Edge.Top);
  }

  private deferCatalogAction(action: string): boolean {
    if (this.tab !== 'directory' || this.catalogComplete) return false;
    this.pendingCatalogAction = action;
    this.onRequireCompleteCatalog();
    return true;
  }

  private scrollCatalogEdge(bottom: boolean): void {
    if (this.deferCatalogAction(bottom ? 'bottom' : 'top')) return;
    const localBookId = this.tab === 'directory' && this.bookmarkIdentity !== undefined ?
      readerDirectoryScopeKey(this.bookmarkIdentity.sourceId, this.bookmarkIdentity.bookId) : undefined;
    if (localBookId !== undefined) readerDirectorySignalScrollIntent(localBookId);
    this.userScroll(); this.scroller.scrollEdge(bottom ? Edge.Bottom : Edge.Top);
    if (localBookId !== undefined) readerDirectorySignalScrollCommand(localBookId);
  }

  @Builder
  private tabButton(tab: string, title: string) {
    Button({ type: ButtonType.Normal, stateEffect: false }) {
    Stack({ alignContent: Alignment.Bottom }) {
      Row({ space: 5 }) {
        if (tab === 'directory') {
          Image(this.tab === tab ? (this.appThemeScheme === 'night' ? $r('app.media.rc_list_theme_night') : $r('app.media.rc_list')) :
            (this.appThemeScheme === 'night' ? $r('app.media.reader_directory_directory_theme_night') : $r('app.media.reader_directory_directory'))).width(15).height(15);
        } else {
          Image(this.tab === tab ? (this.appThemeScheme === 'night' ? $r('app.media.reader_directory_marker_bookmark_active_theme_night') : $r('app.media.reader_directory_marker_bookmark_active')) :
            (this.appThemeScheme === 'night' ? $r('app.media.reader_directory_marker_bookmark_theme_night') : $r('app.media.reader_directory_marker_bookmark'))).width(15).height(15);
        }
        Text(title).fontFamily(TYPE_READER_DIRECTORY_TAB_COMPACT.fontFamily).fontWeight(TYPE_READER_DIRECTORY_TAB_COMPACT.fontWeight).fontSize(TYPE_READER_DIRECTORY_TAB_COMPACT.fontSizeFp).lineHeight(TYPE_READER_DIRECTORY_TAB_COMPACT.lineHeightFp as number)
          .fontColor(this.tab === tab ? readerAppColor('TOK_READ_PRIMARY', this.appThemeScheme) : readerAppColor('TOK_READ_MUTED', this.appThemeScheme));
      }.width('100%').height(this.tabHeight()).justifyContent(FlexAlign.Center)
        .opacity(this.presentation().contentOpacity).blur(this.presentation().contentBlur);
      if (this.tab === tab) {
        Row().width('52%').height(2).borderRadius(999).backgroundColor(readerAppColor('TOK_READ_PRIMARY', this.appThemeScheme));
      }
    }.width('100%').height(this.tabHeight());
    }.width(Math.max(0, (this.availableWidth - this.value(32, 18)) / 2)).height(this.tabHeight()).padding(0)
      .borderRadius(8).backgroundColor(this.tab === tab ? readerAppColor('TOK_READ_ACTIVE_SOFT', this.appThemeScheme) : Color.Transparent)
      .accessibilityText(title).onClick((): void => {
        if (DEBUG) hilog.info(0xD004, 'ReaderControlDiagnostic',
          'stage=directory-tab tab=%{public}d current=%{public}s input=%{public}s',
          tab === 'bookmarks' ? 1 : 0, String(this.tab === tab), String(this.interactionEnabled));
        this.onTabChange(tab);
      });
  }

  @Builder
  private directoryToolbar() {
    Stack({ alignContent: Alignment.TopStart }) {
      ReaderDirectoryToolbar({
        naturalFieldHeightVp: this.selectedMinimum()?.full.fieldHeightVp ?? 0,
        naturalInputHeightVp: this.selectedMinimum()?.full.inputHeightVp ?? 0,
        naturalToolbarHeightVp: this.selectedMinimum() === undefined ? 0 : this.toolbarHeight() - 2,
        text: this.draft, placeholder: this.placeholder(), ascending: this.ascending,
        showChapterTools: this.tab === 'directory',
        onTextChange: (value: string): void => { this.draft = value; },
        onSearch: (): void => this.search(),
        onTop: (): void => this.scrollCatalogEdge(false),
        onBottom: (): void => this.scrollCatalogEdge(true),
        onToggleSort: (): void => this.sort(),
      });
      Row().width('100%').height(1).backgroundColor(readerAppColor('TOK_LINE', this.appThemeScheme))
        .position({ x: 0, y: this.value(63, this.toolbarHeight() - 1) }).opacity(this.progress);
    }.width(Math.max(0, this.availableWidth - 2)).height(this.toolbarHeight());
  }

  @Builder
  private chapterRow(entry: LocalReadingTocEntry) {
    ReaderDirectoryChapterRow({
      entry: entry, rowHeight: this.rowHeight(), currentChapterIndex: this.currentChapterIndex,
      chapterDownloadEnabled: this.chapterDownloadEnabled,
      chapterStartBookmarkCreationEnabled: this.chapterStartBookmarkCreationEnabled,
      onSelectChapter: (index: number): void => this.onSelectChapter(index),
      onDownloadChapter: (index: number): void => this.onDownloadChapter(index),
      onDeleteBookmarks: (times: number[]): void => this.onDeleteBookmarks(times),
      onCreateChapterStartBookmark: (request: ReaderDirectoryChapterStartBookmarkRequest): void =>
        this.onCreateChapterStartBookmark(request),
    });
  }

  @Builder
  private flatList() {
    List({ scroller: this.scroller }) {
      LazyForEach(this.dataSource, (row: ReaderControlDirectoryRow) => {
        ListItem() {
          if (row.chapter !== undefined) {
            this.chapterRow(row.chapter);
          } else if (row.bookmark !== undefined) {
            ReaderBookmarkRow({ row: row.bookmark, embeddedInControl: true,
              naturalSize: this.bookmarkNaturalSize(),
              motionProgress: this.progress, availableWidth: this.rowWidth(),
              onSelectBookmark: (id: string, chapter: number, offset: number, positionScope?: RemoteReadingPositionScope): void => {
                if (this.onSelectBookmark !== undefined) this.onSelectBookmark(id, chapter, offset, positionScope);
              } });
          }
        }.width('100%').height(this.rowHeight());
      }, (row: ReaderControlDirectoryRow): string => row.key);
    }.width('100%').height('100%').padding({ left: this.rowPadding(), right: this.rowPadding() })
      .scrollBar(BarState.Off).edgeEffect(EdgeEffect.Spring).cachedCount(4)
      .enableScrollInteraction(this.interactionEnabled)
      .onWillScroll((offset: number, _state: ScrollState, source: ScrollSource): ScrollResult =>
        ({ offsetRemain: this.interactionEnabled || source === ScrollSource.SCROLLER ? offset : 0 }))
      .onWillStartDragging((): void => this.userScroll())
      .onAreaChange((): void => this.queuePosition());
  }

  @Builder
  private catalogStatus() {
    Row({ space: 6 }) {
      Text(this.snapshot.catalogState === 'failed' ? '目录加载失败，已保留当前条目' :
        this.snapshot.catalogState === 'loading' ? '正在加载完整目录' : '目录尚未加载完整')
        .layoutWeight(1).fontFamily(MESSAGE_BODY.fontFamily).fontWeight(MESSAGE_BODY.fontWeight)
        .fontSize(MESSAGE_BODY.fontSizeFp).lineHeight(MESSAGE_BODY.lineHeightFp as number)
        .fontColor(readerAppColor('TOK_READ_MUTED', this.appThemeScheme));
      if (this.snapshot.catalogState !== 'loading') {
        ReaderRecoveryAction({ label: this.snapshot.catalogState === 'failed' ? '重试加载目录' : '加载完整目录',
          actionEnabled: this.interactionEnabled,
          onReconcile: (): void => this.onRequireCompleteCatalog() });
      }
    }.width('100%').padding({ left: 8, right: 8, top: 2, bottom: 2 });
  }

  @Builder
  private flatCatalog() {
    Column() {
      if (this.tab === 'directory' && this.catalogComplete === false && this.snapshot.rows.length > 0) this.catalogStatus();
      Stack() {
        if (this.snapshot.rows.length === 0) {
          ReaderPageState({ padded: false,
            loading: this.catalogComplete === false && this.snapshot.catalogState === 'loading',
            message: this.catalogComplete !== false ? '没有匹配的章节' :
              this.snapshot.catalogState === 'failed' ? '目录加载失败' :
              this.snapshot.catalogState === 'loading' ? '正在加载完整目录' : '目录尚未加载完整',
            actionLabel: this.catalogComplete === false && this.snapshot.catalogState !== 'loading' ?
              (this.snapshot.catalogState === 'failed' ? '重试加载目录' : '加载完整目录') : '',
            actionEnabled: this.interactionEnabled,
            mutedColor: readerAppColor('TOK_READ_MUTED', this.appThemeScheme),
            onAction: (): void => { if (this.interactionEnabled) this.onRequireCompleteCatalog(); } });
        } else {
          this.flatList();
        }
      }.width('100%').layoutWeight(1);
    }.width('100%').height('100%');
  }

  @Builder
  private listBody() {
    if (this.tab === 'bookmarks' && this.bookmarkLoadFailed) {
      ReaderBookmarkErrorState({ message: this.bookmarkLoadMessage,
        onRetry: (): void => this.onRetryBookmarkLoad() });
    } else if (this.snapshot.loading && !(this.tab === 'directory' && this.catalogComplete === false)) {
      if (this.tab === 'bookmarks') {
        ReaderBookmarkLoadingState();
      } else {
        Column() {
          ReaderPageState({ loading: true, message: '目录载入中…', padded: false,
            mutedColor: readerAppColor('TOK_READ_MUTED', this.appThemeScheme) });
        }.width('100%').height('100%').justifyContent(FlexAlign.Center);
      }
    } else if (this.snapshot.rows.length === 0 && this.tab === 'bookmarks') {
      ReaderBookmarkEmptyState({ onReturnToDirectory: (): void => this.onTabChange('directory') });
    } else if (this.snapshot.rows.length === 0 && !this.navigationActive &&
      !(this.tab === 'directory' && this.bookmarkIdentity !== undefined)) {
      this.flatCatalog();
    } else {
      if (this.tab === 'directory' && this.bookmarkIdentity !== undefined) {
        ReaderDirectoryNavigationSurface({
          sourceId: this.bookmarkIdentity.sourceId, bookId: this.bookmarkIdentity.bookId, query: this.query, ascending: this.ascending,
          currentChapterIndex: this.currentChapterIndex, openRevision: this.sessionKey,
          interacted: this.navigationInteracted, rowHeight: this.rowHeight(),
          listPaddingX: this.rowPadding(), listPaddingY: 0,
          edgeEffectMode: EdgeEffect.Spring, interactionEnabled: this.interactionEnabled,
          showLoadStatus: this.catalogComplete,
          chapterEntries: this.entries,
          chapterDownloadEnabled: this.chapterDownloadEnabled,
          chapterStartBookmarkCreationEnabled: this.chapterStartBookmarkCreationEnabled,
          scroller: this.scroller, fallbackBuilder: (): void => { this.flatCatalog(); },
          onSelectTarget: (chapterIndex: number, chapterOffsetScalar: number, positionScope?: RemoteReadingPositionScope, directoryTargetProof?: ReaderDirectoryTargetProof): void => {
            this.onSelectNavigationTarget(chapterIndex, chapterOffsetScalar, positionScope, directoryTargetProof);
          },
          onUserScrollIntent: (): void => this.userScroll(),
          onFirstLayout: (): void => this.queuePosition(),
          onTreeStateChange: (active: boolean): void => { this.navigationActive = active; },
          onDeleteBookmarks: (times: number[]): void => this.onDeleteBookmarks(times),
          onDownloadChapter: (chapterIndex: number): void => this.onDownloadChapter(chapterIndex),
          onCreateChapterStartBookmark: (request: ReaderDirectoryChapterStartBookmarkRequest): void =>
            this.onCreateChapterStartBookmark(request),
        });
      } else {
        this.flatCatalog();
      }
    }
  }

  build() {
    Stack({ alignContent: Alignment.TopStart }) {
      Stack() { this.tabButton('directory', '章节'); }
        .position({ x: this.value(this.tab === 'bookmarks' ? 15 : 16, 9),
          y: this.value(this.tab === 'bookmarks' ? 12 : 13, 6) });
      Stack() { this.tabButton('bookmarks', '书签'); }
        .position({ x: this.value(this.tab === 'bookmarks' ? 142 : 143, 169) + (this.availableWidth - this.value(286, 338)) / 2,
          y: this.value(this.tab === 'bookmarks' ? 12 : 13, 6) });
      Row().width(this.tab === 'bookmarks' ? this.availableWidth + 52 * (1 - this.progress) - 2 :
        Math.max(0, this.availableWidth - this.value(22, 2))).height(1).backgroundColor(readerAppColor('TOK_LINE', this.appThemeScheme))
        .position({ x: this.tab === 'bookmarks' ? 1 : this.value(11, 1),
          y: (this.tab === 'bookmarks' ? this.value(50, 42) : this.value(44, 42)) + this.tabGrowth() })
        .opacity(this.tab === 'bookmarks' ? this.progress : 1);
      Stack({ alignContent: Alignment.TopStart }) { this.directoryToolbar(); }
        .position({ x: 1, y: this.value(61, 43) + this.tabGrowth() })
        .opacity(this.progress * this.presentation().contentOpacity).blur(this.presentation().contentBlur)
        .enabled(this.progress === 1).hitTestBehavior(this.progress === 1 ? HitTestMode.Default : HitTestMode.None);
      Stack({ alignContent: Alignment.TopStart }) { this.listBody(); }
        .width(Math.max(0, this.availableWidth - 2)).height(this.listHeight())
        .position({ x: 1, y: this.listTop() }).clip(true)
        .opacity(this.presentation().contentOpacity).blur(this.presentation().contentBlur);
      if (this.tab === 'directory') {
        Column({ space: 0 }) {
          Row().width('100%').height(1).backgroundColor(readerAppColor('TOK_LINE', this.appThemeScheme));
          Row({ space: 10 }) {
            Text('当前章节').fontFamily(TYPE_READER_DIRECTORY_POSITION.fontFamily as string).fontSize(TYPE_READER_DIRECTORY_POSITION.fontSizeFp).fontColor(readerAppColor('TOK_READ_MUTED', this.appThemeScheme))
              .flexShrink(0);
            Text(this.snapshot.currentTitle).layoutWeight(1).fontFamily(TYPE_READER_DIRECTORY_CURRENT_TITLE.fontFamily)
              .fontWeight(TYPE_READER_DIRECTORY_CURRENT_TITLE.fontWeight).fontSize(TYPE_READER_DIRECTORY_CURRENT_TITLE.fontSizeFp).fontColor(readerAppColor('TOK_READ_INK', this.appThemeScheme))
              .maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis });
            Text(this.snapshot.currentPosition).fontFamily(TYPE_READER_DIRECTORY_POSITION.fontFamily as string).fontSize(TYPE_READER_DIRECTORY_POSITION.fontSizeFp)
              .fontColor(readerAppColor('TOK_READ_MUTED', this.appThemeScheme)).flexShrink(0).maxLines(1).textAlign(TextAlign.End);
          }.width('100%').height(this.footerHeight() - 1).padding({ left: TOK_SPACE_SM, right: TOK_SPACE_SM, top: 1 })
            .backgroundColor(readerAppColor('TOK_SURFACE_PANEL_SOFT', this.appThemeScheme));
        }.width(Math.max(0, this.availableWidth - 2)).height(this.footerHeight())
          .position({ x: 1, y: this.availableHeight - this.footerHeight() - 1 + this.value(24, 0) })
          .opacity(this.progress * this.presentation().contentOpacity).blur(this.presentation().contentBlur)
          .hitTestBehavior(HitTestMode.None)
          .accessibilityLevel(this.progress === 0 ? 'no-hide-descendants' : 'auto');
      }
    }.width(this.availableWidth).height(this.availableHeight).clip(true);
  }
}
