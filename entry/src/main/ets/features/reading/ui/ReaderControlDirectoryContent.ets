import { readerControlDirectoryMinimumFacts, measureReaderDirectoryMinimum, type ReaderDirectoryMinimumFacts, type ReaderDirectoryMinimumProfile } from './ReaderControlDirectoryMinimum';
import { readerControlModuleProfileMatches, readerControlModuleFactsMatch, readerControlModuleFactsGeometryKey, type ReaderControlPreparedModuleProfile, type ReaderControlModuleFacts } from './ReaderControlMinimumMeasurement';
import type { ReaderDirectoryTargetProof } from '../application/ReaderDirectoryTargetProof';
import hilog from '@ohos.hilog';
import { DEBUG } from '../../../../../../build/default/generated/profile/default/BuildProfile';
import { type ReaderDirectoryNavigationPortFactory, readerDirectoryScopeKey } from '../application/ReaderDirectoryNavigation';
import { ReaderActionAccessibility, readerActionTouchRegion } from '../../../ui/controls/ReaderActionAccessibility';
import { TYPE_READER_DIRECTORY_CURRENT_TITLE, TYPE_READER_DIRECTORY_POSITION, TYPE_READER_DIRECTORY_TAB_COMPACT } from '../../../ui/foundation/ReaderTypography';

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
import { EMPTY_READING_DIRECTORY_RECOVERY, type ReadingDirectoryRecovery } from '../presentation/ReadingDirectoryRecovery';
import { ReaderPageState } from '../../../ui/feedback/ReaderPageState';
import { MESSAGE_BODY } from '../../../ui/foundation/ReaderMessageStyle';
import { ReaderDirectoryToolbar } from './ReaderDirectoryToolbar';
import { ReaderSearchField } from '../../../ui/controls/ReaderSearchField';
import { readerPageAreaLength } from '../../../ui/layout/ReaderPageShell';
import { ReaderDirectoryChapterRow } from './ReaderDirectoryChapterRow';
import { readerWindowMetrics } from '../../../ui/foundation/ReaderWindowEnvironment';
import { readerReadableFontScale, readerScaledControlHeight } from '../../../ui/foundation/ReaderSurfaceResolvers';
import { resolveReaderControlDirectoryGeometry, type ReaderControlDirectoryGeometry } from './ReaderControlDirectoryGeometry';
import { ReaderDirectoryNavigationSurface } from './ReaderDirectoryNavigationSurface';
import type { ReaderControlModuleMeasurer, ReaderControlCandidateWidths, ReaderControlModuleMinimum } from './ReaderLayoutGeometry';

import type { ReaderControlBookmarkNaturalSize } from './ReaderControlBookmarkGeometry';
import { readerDirectorySignalScrollCommand, readerDirectorySignalScrollIntent } from '../presentation/ReaderDirectoryViewport';
import { TOK_LINE, TOK_READ_ACTIVE_SOFT, TOK_READ_INK, TOK_READ_MUTED,
  TOK_READ_PRIMARY, TOK_SURFACE_PANEL_SOFT, TOK_SPACE_SM } from '../../../ui/foundation/ReaderTokens';
import { readerDirectoryToolbarBudget } from '../presentation/ReaderFullDirectoryBudget';

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
  @StorageLink('readerWindowMetricsRevision') @Watch('onWindowMetricsChanged') private minimumMetricsRevision: number = 0;
  @Prop @Watch('onPreparedMinimumChanged') preparedMinimum: ReaderControlPreparedModuleProfile | undefined = undefined;
  @Prop preparedMinimumRequired: boolean = false;
  onMinimumFactsChanged: (identity: string, facts: ReaderControlModuleFacts) => void =
    (_identity: string, _facts: ReaderControlModuleFacts): void => {};
  @Prop @Watch('publishMinimumMeasurer') minimumIdentity: string = '';
  @Prop @Watch('onPreparedMinimumChanged') minimumKey: string = '';
  onMinimumMeasurerReady: (identity: string, measurer: ReaderControlModuleMeasurer | undefined) => void =
    (_identity: string, _measurer: ReaderControlModuleMeasurer | undefined): void => {};

  @Prop @Watch('refreshData') entries: LocalReadingTocEntry[] = [];
  navigationPortFactory: ReaderDirectoryNavigationPortFactory | undefined = undefined;
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
  inputCurrent?: () => boolean;
  @Prop @Watch('onGeometryChanged') availableWidth: number = 286;
  @Prop @Watch('onGeometryChanged') availableHeight: number = 190;
  @Prop chapterDownloadEnabled: boolean = false;
  @Prop mangaSearch: boolean = false;
  @Prop chapterStartBookmarkCreationEnabled: boolean = false;
  @Prop @Watch('publishMinimumMeasurer') bookmarkLoadFailed: boolean = false;
  @Prop @Watch('publishMinimumMeasurer') bookmarkLoadMessage: string = '';
  @Prop bookmarkRecovery: ReadingDirectoryRecovery = EMPTY_READING_DIRECTORY_RECOVERY;
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
  private adoptedPrepared: ReaderControlPreparedModuleProfile | undefined = undefined;
  private presentationPrepared(): ReaderControlPreparedModuleProfile | undefined {
    const current = this.preparedMinimum;
    if (current !== undefined && current.identity === this.minimumIdentity && current.key === this.minimumKey &&
      readerControlModuleProfileMatches(current.moduleData, 'directory') && readerControlModuleFactsMatch(current.facts, 'directory')) return current;
    const adopted = this.adoptedPrepared;
    return this.preparedMinimumRequired && adopted !== undefined &&
      readerControlModuleProfileMatches(adopted.moduleData, 'directory') && readerControlModuleFactsMatch(adopted.facts, 'directory') ? adopted : undefined;
  }
  private preparedProfile(): ReaderDirectoryMinimumProfile | undefined {
    return this.presentationPrepared()?.moduleData.directory;
  }
  private currentMinimumProfile(): ReaderDirectoryMinimumProfile | undefined {
    return this.preparedMinimumRequired ? this.preparedProfile() : this.preparedProfile() ?? this.minimumProfiles.get(this.minimumKey);
  }
  private displaySnapshot(): ReaderControlDirectorySnapshot {
    return this.displayedFacts()?.readViewSnapshot() ?? this.snapshot;
  }
  private displayCatalogComplete(): boolean { return this.displayedFacts()?.viewCatalogComplete ?? this.catalogComplete; }
  private displayBookmarkFailed(): boolean { return this.displayedFacts()?.viewBookmarkLoadFailed ?? this.bookmarkLoadFailed; }
  private displayBookmarkMessage(): string { return this.displayedFacts()?.viewBookmarkLoadMessage ?? this.bookmarkLoadMessage; }
  private displayedFacts(): ReaderDirectoryMinimumFacts | undefined {
    return this.preparedMinimumRequired && this.preparedProfile() !== undefined ? this.presentationPrepared()?.facts.directory : undefined;
  }
  private adoptedPreparedKey: string = '';
  private displayedRows: ReaderControlDirectoryRow[] | undefined = undefined;
  private onPreparedMinimumChanged(): void {
    if (!this.preparedMinimumRequired) { this.onProgressChanged(); return; }
    const prepared = this.preparedMinimum;
    if (prepared === undefined || prepared.identity !== this.minimumIdentity || prepared.key !== this.minimumKey ||
      !readerControlModuleProfileMatches(prepared.moduleData, 'directory') || !readerControlModuleFactsMatch(prepared.facts, 'directory')) return;
    this.adoptedPrepared = prepared;
    const rows = this.displaySnapshot().rows;
    if (rows !== this.displayedRows) {
      this.displayedRows = rows;
      this.dataSource.replace(rows);
    }
    const adopted = `${prepared.identity}|${prepared.key}`;
    if (adopted === this.adoptedPreparedKey) return;
    this.adoptedPreparedKey = adopted;
    this.onProgressChanged();
  }
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
  @State private shortContent: boolean = false;
  @State private layoutPresentation: number = 0;
  @State private prefixMeasuredHeight: number = 0;
  @State private prefixRevealRevision: number = 0;
  @State private directoryFocusRevision: number = 0;
  @State private directoryRestoreKeyboard: boolean = true;
  private directoryKeyboardWasVisible: boolean = false;
  private directoryKeyboardVisible: boolean | undefined = undefined;
  private directoryKeyboardTransferPending: boolean = false;
  private layoutKey: string = '';
  private presentationKey: string = '';
  @State private directoryInputFocused: boolean = false;
  private layoutRestorePending: boolean = false;
  private layoutRestoreQueued: boolean = false;
  private layoutRestoreTicket: number = 0;
  private leadingPrefixOffset: number | undefined = undefined;

  aboutToAppear(): void {
    this.mounted = true; this.lifecycle += 1; this.layoutPresentation += 1;
    this.syncContentLayout(); this.openList();

    if (this.preparedMinimumRequired) this.onPreparedMinimumChanged();
  }
  aboutToDisappear(): void {
    this.adoptedPrepared = undefined;
    this.adoptedPreparedKey = '';
    this.displayedRows = undefined;

    const identity = this.registeredMinimumIdentity;
    this.minimumMeasurer = undefined;
    if (identity.length > 0) this.onMinimumMeasurerReady(identity, undefined);
    this.mounted = false; this.lifecycle += 1; this.positionQueued = false; this.correctionQueued = false;
    this.layoutPresentation += 1; this.layoutRestorePending = false; this.layoutRestoreQueued = false;
    this.layoutRestoreTicket += 1;
    this.directoryInputFocused = false;
    this.directoryKeyboardWasVisible = false; this.directoryRestoreKeyboard = true;
    this.directoryKeyboardVisible = undefined; this.directoryKeyboardTransferPending = false;
  }

  private currentInputEnabled(): boolean {
    return (!this.preparedMinimumRequired || this.presentationPrepared()?.ownerCurrent?.() === true) &&
      this.interactionEnabled && (this.inputCurrent?.() ?? true);
  }

  private minimumFacts(): ReaderDirectoryMinimumFacts {
    return readerControlDirectoryMinimumFacts({ snapshot: this.snapshot, tab: this.tab,
      catalogComplete: this.catalogComplete, bookmarkLoadFailed: this.bookmarkLoadFailed, bookmarkLoadMessage: this.bookmarkLoadMessage });
  }

  private publishMinimumMeasurer(): void {
    if (!this.mounted || this.minimumIdentity.length === 0) return;
    const identity = this.minimumIdentity, facts = this.minimumFacts();
    if (this.preparedMinimumRequired) { this.onMinimumFactsChanged(identity, { module: 'directory', directory: facts }); return; }
    const signature = JSON.stringify([identity, this.minimumMetricsRevision, readerControlModuleFactsGeometryKey({ module: 'directory', directory: facts })]);
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
        const selected = this.currentMinimumProfile();
        this.minimumProfiles.clear();
        if (selected !== undefined) this.minimumProfiles.set(this.minimumKey, selected);
        this.minimumProfileTicket = ticket;
      }
      this.minimumProfiles.set(key, profile);
      if (key === this.minimumKey) this.syncContentLayout();
      return { module: 'directory', quick: profile.quick.minimum, full: profile.full.minimum };
    };
    this.registeredMinimumIdentity = identity;
    this.minimumFactsSignature = signature;
    this.minimumMeasurer = measurer;
    this.onMinimumMeasurerReady(identity, measurer);
  }

  private onWindowMetricsChanged(): void {
    this.publishMinimumMeasurer();
    this.onProgressChanged();
  }

  private selectedMinimum(): ReaderDirectoryMinimumProfile | undefined {
    return this.minimumKey.length > 0 ? this.currentMinimumProfile() : undefined;
  }
  private tabHeight(): number {
    const profile = this.selectedMinimum();
    return profile === undefined ? readerScaledControlHeight(this.value(31, 36),
      TYPE_READER_DIRECTORY_TAB_COMPACT.lineHeightFp as number, this.fontScale()) :
      this.value(profile.quick.tabHeightVp, profile.full.tabHeightVp);
  }
  private tabGrowth(): number { return this.tabHeight() - this.value(31, 36); }
  private toolbarHeight(): number {
    return this.selectedMinimum()?.full.toolbarHeightVp ??
      readerDirectoryToolbarBudget(this.availableWidth - 2, this.tab === 'directory',
        this.directoryQueryHeight(), 60 * this.fontScale()).height + 2;
  }
  private footerHeight(): number { return this.selectedMinimum()?.full.footerHeightVp ?? 48; }
  private bookmarkNaturalSize(): ReaderControlBookmarkNaturalSize | undefined {
    const profile = this.selectedMinimum();
    return profile === undefined ? undefined : { titleHeightVp: this.value(profile.quick.bookmark.titleHeightVp, profile.full.bookmark.titleHeightVp),
      excerptHeightVp: this.value(profile.quick.bookmark.excerptHeightVp, profile.full.bookmark.excerptHeightVp) };
  }

  private openList(): void {
    if (!this.mounted) return;
    this.lifecycle += 1; this.layoutRestoreTicket += 1; this.layoutPresentation += 1;
    this.layoutRestorePending = false; this.layoutRestoreQueued = false;
    this.leadingPrefixOffset = undefined; this.directoryInputFocused = false;
    this.directoryKeyboardWasVisible = false; this.directoryRestoreKeyboard = true;
    this.directoryKeyboardVisible = undefined; this.directoryKeyboardTransferPending = false;
    this.syncContentLayout();
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
    if (!this.preparedMinimumRequired) this.dataSource.replace(next.rows);
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
      const offset = this.placement.offset(this.displaySnapshot(), this.listHeight(), this.rowHeight(), ticket);
      if (offset === undefined) return;
      try {
        this.scroller.scrollToIndex(this.displaySnapshot().targetRow + this.headerCount(), false, ScrollAlign.CENTER);
        this.placement.commit(ticket);
      } catch (_error) { /* First layout will retry this same request. */ }
    }));
  }

  private onProgressChanged(): void {
    if (!this.mounted) return;
    this.syncContentLayout();
    const nextHeight = this.rowHeight();
    if (nextHeight === this.previousRowHeight) return;
    if (this.leadingRow === undefined) this.captureLeadingRow();
    this.previousRowHeight = nextHeight;
    this.queueLeadingCorrection();
  }

  private queueLeadingCorrection(): void {
    // With the first row at zero, changing row height cannot change its anchor.
    if (!this.mounted || this.navigationActive || this.leadingRow === undefined || this.leadingRow === 0) return;
    if (this.correctionQueued) return;
    this.correctionQueued = true;
    const lifecycle = this.lifecycle;
    this.getUIContext().postFrameCallback(new ControlDirectoryFrame((): void => {
      if (!this.mounted || this.navigationActive || lifecycle !== this.lifecycle) return;
      this.correctionQueued = false;
      if (this.leadingRow === undefined) return;
      try {
        const index = Math.floor(this.leadingRow) + this.headerCount();
        const height = this.rowHeight();
        const offset = this.leadingFraction * height;
        if (!this.leadingAnchorIsAligned()) {
          this.scroller.scrollToIndex(index, false, ScrollAlign.START,
            { extraOffset: LengthMetrics.vp(offset) });
        }
      } catch (_error) { /* The next mounted frame can restore the anchor. */ }
      if (this.currentInputEnabled() && (this.progress === 0 || this.progress === 1) &&
        this.leadingAnchorIsAligned()) {
        this.leadingRow = undefined; this.leadingKey = undefined;
      }
    }));
  }

  private leadingAnchorIsAligned(): boolean {
    if (this.navigationActive || this.leadingRow === undefined) return false;
    try {
      const height = this.rowHeight();
      const rect = this.scroller.getItemRect(Math.floor(this.leadingRow) + this.headerCount());
      const tolerance = 0.5 / this.getUIContext().vp2px(1);
      return Number.isFinite(rect.y) && Number.isFinite(rect.height) && rect.height > 0 &&
        Math.abs(rect.height - height) <= tolerance &&
        Math.abs(rect.y + this.leadingFraction * height) <= tolerance;
    } catch (_error) { return false; }
  }

  private captureLeadingRow(): void {
    if (this.navigationActive) return; // Tree rank/node anchors belong to NavigationList, never flat snapshot.rows.
    try {
      // Lazy List's total offset includes estimates for offscreen row heights.
      // Dividing it by the current animated height invents a different row
      // after deep scrolling. Read the actual visible item and its local rect.
      const nativeIndex = this.scroller.getItemIndex(this.availableWidth / 2, 0.5);
      if (this.headerCount() === 1 && nativeIndex === 0) {
        this.leadingPrefixOffset = Math.max(0, this.scroller.currentOffset().yOffset);
        this.leadingRow = undefined; this.leadingKey = undefined;
        return;
      }
      const index = nativeIndex - this.headerCount();
      if (index < 0 || index >= this.displaySnapshot().rows.length) return;
      const rect = this.scroller.getItemRect(nativeIndex);
      if (!Number.isFinite(rect.y) || !Number.isFinite(rect.height) || rect.height <= 0) return;
      this.leadingFraction = Math.max(0, Math.min(0.999999, -rect.y / rect.height));
      this.leadingRow = index + this.leadingFraction;
      this.leadingKey = this.displaySnapshot().rows[index]?.key;
      this.leadingPrefixOffset = undefined;
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
    this.syncContentLayout();
    if (!this.currentInputEnabled()) {
      this.directoryInputFocused = false; this.layoutRestoreTicket += 1;
      this.directoryKeyboardTransferPending = false;
      this.layoutRestorePending = false; this.layoutRestoreQueued = false;
    }
    if (!this.mounted || this.displaySnapshot().rows.length === 0) return;
    if (!this.currentInputEnabled()) {
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
    this.placement.userScroll(); this.leadingRow = undefined; this.leadingKey = undefined; this.leadingPrefixOffset = undefined;
    this.layoutRestoreTicket += 1; this.layoutRestorePending = false; this.layoutRestoreQueued = false;
  }
  private userScroll(): void {
    this.cancelPendingPlacement();
    this.navigationInteracted = true;
  }
  private value(quick: number, full: number): number { return quick + (full - quick) * this.progress; }
  private fontScale(): number {
    return !Number.isFinite(this.minimumMetricsRevision) || this.minimumMetricsRevision < 0 ? 1 :
      readerReadableFontScale(readerWindowMetrics().systemFontScale);
  }
  private queryGrowth(): number { return readerScaledControlHeight(32, 24, this.fontScale()) - 32; }
  private contentGeometry(): ReaderControlDirectoryGeometry {
    const profile = this.selectedMinimum();
    return resolveReaderControlDirectoryGeometry(this.progress, this.tab, this.availableHeight,
      this.tabHeight(), this.queryGrowth(), this.rowHeight(), profile === undefined ? undefined : {
        listTop: this.value(profile.quick.listTopVp, profile.full.listTopVp),
        toolbarHeight: this.toolbarHeight(), footerHeight: this.footerHeight() }, this.toolbarHeight());
  }
  private toolbarInteractive(): boolean {
    return this.mounted && this.currentInputEnabled() && this.progress === 1 &&
      (this.shortContent || this.contentGeometry().toolbarComplete);
  }
  private tabsInteractive(): boolean {
    return this.mounted && this.currentInputEnabled() &&
      (this.shortContent || this.availableHeight >= this.contentGeometry().tabBottom);
  }
  private rowHeight(): number {
    const profile = this.selectedMinimum();
    if (profile !== undefined) return this.value(profile.quick.rowHeightVp, profile.full.rowHeightVp);
    if (this.tab !== 'bookmarks') return readerScaledControlHeight(this.value(32, 40), 20, this.fontScale());
    const scale = this.fontScale();
    // Keep the conservative authored card/metadata budget until a current Native profile returns.
    const metadataGrowth = scale > 1 ? 14 * scale + 4 : 0;
    return Math.max(44, this.value(54, 74) * scale + metadataGrowth);
  }
  private listTop(): number { return this.shortContent ? 0 : this.contentGeometry().listTop; }
  private listHeight(): number { return this.shortContent ? Math.max(0, this.availableHeight) : this.contentGeometry().listHeight; }
  private rowPadding(): number { return this.tab === 'bookmarks' ? this.value(15, 10) : this.value(16, 10); }
  private rowWidth(): number { return Math.max(0, this.availableWidth - 2 - this.rowPadding() * 2); }
  private placeholder(): string { return this.tab === 'bookmarks' ? '搜索书签内容' : '搜索章节名称'; }

  private bookmarkWriteEnabled(): boolean {
    return this.bookmarkRecovery.bookmarkWriteEnabled === true;
  }
  private headerCount(): number { return this.shortContent ? 1 : 0; }
  private currentContent(presentation: number): boolean {
    return this.mounted && presentation === (this.layoutPresentation ?? 0);
  }
  private directoryFocusId(): string {
    return `reader-control-directory-query:${this.sessionKey}:${this.tab}:${this.layoutPresentation ?? 0}`;
  }
  private onGeometryChanged(): void { this.syncContentLayout(); }

  private syncContentLayout(): void {
    if (!this.mounted || !this.currentInputEnabled() || (this.progress !== 0 && this.progress !== 1)) return;
    if (this.directoryInputFocused) {
      const keyboardVisible = readerWindowMetrics().keyboardInsets.bottom > 0;
      if (keyboardVisible !== this.directoryKeyboardVisible) {
        if (keyboardVisible) {
          this.directoryKeyboardWasVisible = true; this.directoryRestoreKeyboard = true;
        } else if (this.directoryKeyboardWasVisible && !this.directoryKeyboardTransferPending) {
          // A same-input hidden edge preserves Back. A retiring input's
          // detach belongs to its pending layout transfer, not that intent.
          this.directoryRestoreKeyboard = false;
        }
        this.directoryKeyboardVisible = keyboardVisible;
      }
    }
    const short = this.progress === 1 && (this.contentGeometry().shortContentRequired ||
      this.selectedMinimum()?.full.minimum.fits === false);
    const presentationKey = `${this.sessionKey}:${this.tab}:${short ? 1 : 0}`;
    const key = `${this.sessionKey}:${this.tab}:${this.availableWidth}:${this.availableHeight}:${this.fontScale()}:${this.minimumKey}:${this.tabHeight()}:${this.toolbarHeight()}:${short ? 1 : 0}`;
    if (key === this.layoutKey) return;
    if (this.layoutKey.length > 0) this.captureLeadingRow();
    this.layoutKey = key;
    this.lifecycle += 1;
    if (presentationKey !== this.presentationKey) {
      this.directoryKeyboardTransferPending = this.directoryInputFocused && this.directoryRestoreKeyboard;
      this.presentationKey = presentationKey; this.layoutPresentation += 1;
    }
    this.layoutRestoreTicket += 1;
    this.positionQueued = false; this.correctionQueued = false; this.layoutRestoreQueued = false;
    this.shortContent = short;
    this.prefixMeasuredHeight = 0;
    this.layoutRestorePending = true;
  }

  private directoryQueryHeight(): number {
    return Math.max(readerScaledControlHeight(32, 24, this.fontScale()), this.selectedMinimum()?.full.fieldHeightVp ?? 0);
  }
  private shortHeaderHeight(): number {
    const input = Math.max(44, this.directoryQueryHeight());
    // Four action rows/lanes plus the informational summary. Native Area may
    // grow this positive first-frame allocation, never hide the clear control.
    return 24 + this.tabHeight() + input + this.shortToolsHeight() +
      (this.tab === 'directory' ? 6 + readerScaledControlHeight(48, 16, this.fontScale()) : 0);
  }
  private shortToolsHeight(): number {
    const count = this.tab === 'directory' ? (this.displayCatalogComplete() ? 5 : 6) : 2;
    return Math.ceil(count / Math.max(1, Math.floor(this.rowWidth() / 49))) * 49;
  }
  private prefixHeight(): number {
    return this.shortContent ? Math.max(this.shortHeaderHeight(), this.prefixMeasuredHeight) : 0;
  }
  private onPrefixArea(presentation: number, area: Area): void {
    if (!this.currentContent(presentation) || !this.shortContent) return;
    const height = readerPageAreaLength(area.height);
    const width = readerPageAreaLength(area.width);
    if (Number.isFinite(height) && Math.abs(height - this.shortHeaderHeight()) <= 1 &&
      Math.abs(width - this.rowWidth()) <= 1 && Math.abs(height - this.prefixMeasuredHeight) > .5) {
      this.prefixMeasuredHeight = height;
    }
  }
  private onDirectoryFocus(presentation: number, id: string, focused: boolean): void {
    if (!this.currentContent(presentation) || id !== this.directoryFocusId()) return;
    this.directoryInputFocused = focused;
    if (!focused) this.directoryKeyboardTransferPending = false;
  }
  private onDirectoryKeyboardRestoreSettled(presentation: number, id: string, requested: boolean): void {
    if (!this.currentContent(presentation) || id !== this.directoryFocusId()) return;
    this.directoryKeyboardTransferPending = false;
    this.directoryKeyboardVisible = readerWindowMetrics().keyboardInsets.bottom > 0;
    if (!requested) this.directoryRestoreKeyboard = false;
  }
  private onListLayout(): void {
    if (this.layoutRestorePending) { this.queueLayoutRestore(); return; }
    this.queuePosition();
  }
  private queueLayoutRestore(): void {
    if (!this.mounted || !this.layoutRestorePending || this.layoutRestoreQueued) return;
    this.layoutRestoreQueued = true;
    const lifecycle = this.lifecycle, presentation = this.layoutPresentation, ticket = this.layoutRestoreTicket;
    this.getUIContext().postFrameCallback(new ControlDirectoryFrame((): void => {
      if (!this.currentContent(presentation) || lifecycle !== this.lifecycle || ticket !== this.layoutRestoreTicket || !this.layoutRestorePending) return;
      this.layoutRestoreQueued = false; this.layoutRestorePending = false;
      try {
        if (this.directoryInputFocused && this.shortContent) {
          this.prefixRevealRevision += 1;
          this.scroller.scrollToIndex(0, false, ScrollAlign.START);
        } else if (this.navigationActive) {
          // Prefix/focus is UI-only. NavigationList preserves its exact node/rank/fraction.
        } else if (this.leadingRow !== undefined) {
          this.scroller.scrollToIndex(Math.floor(this.leadingRow) + this.headerCount(), false, ScrollAlign.START,
            { extraOffset: LengthMetrics.vp(this.leadingFraction * this.rowHeight()) });
        } else if (this.leadingPrefixOffset !== undefined) {
          if (this.shortContent) this.scroller.scrollTo({ xOffset: 0, yOffset: this.leadingPrefixOffset });
          else this.scroller.scrollEdge(Edge.Top); // Header anchor is UI, never chapter zero.
        } else {
          this.queuePosition();
        }
        if (this.directoryInputFocused) this.directoryFocusRevision += 1;
      } catch (_error) { /* Native first layout owns retries; no polling. */ }
    }));
  }
  private clearSearch(presentation: number): void {
    if (!this.currentContent(presentation) || !this.toolbarInteractive()) return;
    this.draft = ''; this.query = ''; this.cancelPendingPlacement(); this.refreshData();
    if (this.shortContent) { this.prefixRevealRevision += 1; this.scroller.scrollToIndex(0, false, ScrollAlign.START); }
  }
  private tabWidth(): number {
    return this.shortContent ? Math.max(44, (this.rowWidth() - 6) / 2) :
      Math.max(0, (this.availableWidth - this.value(32, 18)) / 2);
  }

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
  private tabButton(tab: string, title: string, presentation: number = this.layoutPresentation ?? 0) {
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
          .minFontScale(1).maxFontScale(this.fontScale())
          .fontColor(this.tab === tab ? readerAppColor('TOK_READ_PRIMARY', this.appThemeScheme) : readerAppColor('TOK_READ_MUTED', this.appThemeScheme));
      }.width('100%').height(this.tabHeight() - this.value(13, 8)).justifyContent(FlexAlign.Center)
        .opacity(this.presentation().contentOpacity).blur(this.presentation().contentBlur);
      if (this.tab === tab) {
        Row().width('52%').height(2).borderRadius(1).backgroundColor(readerAppColor('TOK_READ_PRIMARY', this.appThemeScheme));
      }
    }.width('100%').height(this.tabHeight() - this.value(13, 8))
      .borderRadius(8).backgroundColor(this.tab === tab ? readerAppColor('TOK_READ_ACTIVE_SOFT', this.appThemeScheme) : Color.Transparent)
      .hitTestBehavior(HitTestMode.None).accessibilityLevel('no-hide-descendants');
    }.width(this.tabWidth()).height(this.tabHeight()).padding(0)
      .borderRadius(8).backgroundColor(Color.Transparent)
      .accessibilityText(title)
      .responseRegion({ x: 0, y: 0, width: this.tabWidth(), height: this.tabHeight() })
      .attributeModifier(new ReaderActionAccessibility(title, this.tabsInteractive(), this.tab === tab, true, undefined, 'nativeButton'))
      .onClick((): void => {
        if (!this.currentContent(presentation) || !this.tabsInteractive()) return;
        if (DEBUG) hilog.info(0xD004, 'ReaderControlDiagnostic',
          'stage=directory-tab tab=%{public}d current=%{public}s input=%{public}s',
          tab === 'bookmarks' ? 1 : 0, String(this.tab === tab), String(this.currentInputEnabled()));
        this.onTabChange(tab);
      });
  }

  @Builder
  private directoryToolbar(presentation: number = this.layoutPresentation ?? 0) {
    Stack({ alignContent: Alignment.TopStart }) {
      ReaderDirectoryToolbar({
        variant: 'full-directory',
        naturalFieldHeightVp: this.selectedMinimum()?.full.fieldHeightVp ?? 0,
        naturalInputHeightVp: this.selectedMinimum()?.full.inputHeightVp ?? 0,
        inputMinimumWidthVp: this.selectedMinimum()?.full.inputMinimumWidthVp ?? 60 * this.fontScale(),
        availableWidthVp: Math.max(0, this.availableWidth - 2),
        naturalToolbarHeightVp: this.selectedMinimum() === undefined ? 0 : this.toolbarHeight() - 2,
        text: this.draft, placeholder: this.placeholder(), ascending: this.ascending,
        showChapterTools: this.tab === 'directory',
        directoryFocusId: this.directoryFocusId(), directoryFocusAllowed: this.toolbarInteractive(),
        directoryFocusRevision: this.directoryInputFocused ? this.directoryFocusRevision : 0,
        directoryKeyboardOnFocus: this.directoryRestoreKeyboard,
        directoryFocusCurrent: (id: string): boolean => this.mounted && this.toolbarInteractive() && id === this.directoryFocusId(),
        onDirectoryFocusChanged: (id: string, focused: boolean): void => this.onDirectoryFocus(this.layoutPresentation, id, focused),
        onDirectoryKeyboardRestoreSettled: (id: string, requested: boolean): void => this.onDirectoryKeyboardRestoreSettled(this.layoutPresentation, id, requested),
        onTextChange: (value: string): void => { if (this.mounted && this.toolbarInteractive()) this.draft = value; },
        onSearch: (): void => { if (this.mounted && this.toolbarInteractive()) this.search(); },
        onTop: (): void => { if (this.mounted && this.toolbarInteractive()) this.scrollCatalogEdge(false); },
        onBottom: (): void => { if (this.mounted && this.toolbarInteractive()) this.scrollCatalogEdge(true); },
        onToggleSort: (): void => { if (this.mounted && this.toolbarInteractive()) this.sort(); },
      });
      Row().width('100%').height(1).backgroundColor(readerAppColor('TOK_LINE', this.appThemeScheme))
        .position({ x: 0, y: this.value(63, this.toolbarHeight() - 1) }).opacity(this.progress);
    }.width(Math.max(0, this.availableWidth - 2)).height(this.contentGeometry().toolbarHeight);
  }

  @Builder
  private chapterRow(entry: LocalReadingTocEntry) {
    ReaderDirectoryChapterRow({
      entry: entry, rowHeight: this.rowHeight(), currentChapterIndex: this.currentChapterIndex,
      chapterDownloadEnabled: this.chapterDownloadEnabled,
      bookmarkActionsEnabled: this.bookmarkWriteEnabled(),
      chapterStartBookmarkCreationEnabled: this.chapterStartBookmarkCreationEnabled && this.bookmarkWriteEnabled(),
      onSelectChapter: (index: number): void => this.onSelectChapter(index),
      onDownloadChapter: (index: number): void => this.onDownloadChapter(index),
      onDeleteBookmarks: (times: number[]): void => { if (this.bookmarkWriteEnabled()) this.onDeleteBookmarks(times); },
      onCreateChapterStartBookmark: (request: ReaderDirectoryChapterStartBookmarkRequest): void =>
        { if (this.bookmarkWriteEnabled()) this.onCreateChapterStartBookmark(request); },
    });
  }

  @Builder
  private shortTool(kind: string, title: string, presentation: number) {
    Button({ type: ButtonType.Normal, stateEffect: false }) {
      Stack({ alignContent: Alignment.Center }) {
        if (kind === 'search') Image(this.appThemeScheme === 'night' ? $r('app.media.reader_directory_search_theme_night') : $r('app.media.reader_directory_search')).width(16).height(16);
        else if (kind === 'top') Image(this.appThemeScheme === 'night' ? $r('app.media.reader_directory_top_theme_night') : $r('app.media.reader_directory_top')).width(16).height(16);
        else if (kind === 'bottom') Image(this.appThemeScheme === 'night' ? $r('app.media.reader_directory_bottom_theme_night') : $r('app.media.reader_directory_bottom')).width(16).height(16);
        else if (kind === 'clear') Image(this.appThemeScheme === 'night' ? $r('app.media.search_clear_theme_night') : $r('app.media.search_clear')).width(14).height(14);
        else if (kind === 'load') Image(this.appThemeScheme === 'night' ? $r('app.media.reader_directory_search_theme_night') : $r('app.media.reader_directory_search')).width(16).height(16);
        else if (this.ascending) Image(this.appThemeScheme === 'night' ? $r('app.media.reader_directory_sort_ascending_theme_night') : $r('app.media.reader_directory_sort_ascending')).width(16).height(16);
        else Image(this.appThemeScheme === 'night' ? $r('app.media.reader_directory_sort_descending_theme_night') : $r('app.media.reader_directory_sort_descending')).width(16).height(16);
      }.width(32).height(32).borderRadius(8).backgroundColor(readerAppColor('TOK_SURFACE_PANEL_SOFT', this.appThemeScheme))
        .hitTestBehavior(HitTestMode.None).accessibilityLevel('no-hide-descendants');
    }.width(44).height(44).padding(0).margin({ right: 5, bottom: 5 }).borderRadius(8).backgroundColor(Color.Transparent)
      .attributeModifier(new ReaderActionAccessibility(title, this.toolbarInteractive(), false, true, undefined, 'nativeButton'))
      .onClick((): void => {
        if (!this.currentContent(presentation) || !this.toolbarInteractive()) return;
        if (kind === 'search') this.search();
        else if (kind === 'clear') this.clearSearch(presentation);
        else if (kind === 'load') this.onRequireCompleteCatalog();
        else if (kind === 'top' || kind === 'bottom') this.scrollCatalogEdge(kind === 'bottom');
        else this.sort();
      });
  }

  @Builder
  private shortHeader() {
    ForEach([this.layoutPresentation], (presentation: number): void => {
    Column({ space: 6 }) {
      Row({ space: 6 }) { this.tabButton('directory', '章节', presentation); this.tabButton('bookmarks', '书签', presentation); }
        .width('100%').height(this.tabHeight());
      ReaderSearchField({ variant: 'readerDirectory', mode: 'submit', text: this.draft,
        placeholder: this.placeholder(), accessibilityLabel: this.placeholder(),
        naturalFieldHeightVp: this.selectedMinimum()?.full.fieldHeightVp ?? 0,
        naturalInputHeightVp: this.selectedMinimum()?.full.inputHeightVp ?? 0,
        directoryFocusId: this.directoryFocusId(), directoryFocusAllowed: this.toolbarInteractive(),
        directoryFocusRevision: this.directoryInputFocused ? this.directoryFocusRevision : 0,
        directoryKeyboardOnFocus: this.directoryRestoreKeyboard,
        directoryFocusCurrent: (id: string): boolean => this.mounted && this.toolbarInteractive() && id === this.directoryFocusId(),
        onDirectoryFocusChanged: (id: string, focused: boolean): void => this.onDirectoryFocus(presentation, id, focused),
        onDirectoryKeyboardRestoreSettled: (id: string, requested: boolean): void => this.onDirectoryKeyboardRestoreSettled(presentation, id, requested),
        onTextChange: (value: string): void => { if (this.currentContent(presentation) && this.toolbarInteractive()) this.draft = value; },
        onSubmit: (): void => { if (this.currentContent(presentation) && this.toolbarInteractive()) this.search(); } });
      Flex({ wrap: FlexWrap.Wrap }) {
        this.shortTool('search', '搜索', presentation);
        if (this.tab === 'directory') { this.shortTool('top', '到顶部', presentation); this.shortTool('bottom', '到底部', presentation); this.shortTool('sort', '切换排序', presentation); }
        this.shortTool('clear', '清除搜索', presentation);
        if (this.tab === 'directory' && !this.displayCatalogComplete()) this.shortTool('load', '加载完整目录', presentation);
      }.width('100%').height(this.shortToolsHeight());
      if (this.tab === 'directory') {
        Text(`当前章节 ${this.displaySnapshot().currentTitle} ${this.displaySnapshot().currentPosition}`)
          .width('100%').fontFamily(TYPE_READER_DIRECTORY_CURRENT_TITLE.fontFamily)
          .fontSize(TYPE_READER_DIRECTORY_CURRENT_TITLE.fontSizeFp).minFontScale(1).maxFontScale(this.fontScale())
          .fontColor(readerAppColor('TOK_READ_MUTED', this.appThemeScheme))
          .height(readerScaledControlHeight(48, 16, this.fontScale())).maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis });
      }
    }.width(this.rowWidth()).height(this.shortHeaderHeight()).padding({ top: 6, bottom: 6 })
      .onAreaChange((_old: Area, area: Area): void => this.onPrefixArea(presentation, area));
    }, (presentation: number): string => `control-directory-prefix:${presentation}`);
  }

  private localState(): boolean {
    return (this.tab === 'bookmarks' && (this.displayBookmarkFailed() || this.displaySnapshot().rows.length === 0)) ||
      (this.displaySnapshot().loading && !(this.tab === 'directory' && this.displayCatalogComplete() === false)) ||
      (this.displaySnapshot().rows.length === 0 && !this.navigationActive && !(this.tab === 'directory' && this.bookmarkIdentity !== undefined));
  }

  @Builder
  private flatList(presentation: number = this.layoutPresentation ?? 0) {
    List({ scroller: this.scroller }) {
      if (this.headerCount() === 1) {
        ListItem() { this.shortHeader(); }.width('100%').constraintSize({ minHeight: this.prefixHeight() });
      }
      if (this.shortContent && this.localState()) {
        ListItem() { this.listBody(false, presentation); }.width('100%').constraintSize({ minHeight: Math.max(44, this.availableHeight) });
      } else {
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
      }
    }.width('100%').height('100%').padding({ left: this.rowPadding(), right: this.rowPadding() })
      .scrollBar(BarState.Off).edgeEffect(EdgeEffect.Spring).cachedCount(4)
      .enableScrollInteraction(this.currentInputEnabled())
      .onWillScroll((offset: number, _state: ScrollState, source: ScrollSource): ScrollResult =>
        ({ offsetRemain: this.currentInputEnabled() || source === ScrollSource.SCROLLER ? offset : 0 }))
      .onWillStartDragging((): void => this.userScroll())
      .onAreaChange((_old: Area, area: Area): void => {
        if (this.mounted && Math.abs(readerPageAreaLength(area.height) - this.listHeight()) <= 1 &&
          Math.abs(readerPageAreaLength(area.width) - Math.max(0, this.availableWidth - 2)) <= 1) this.onListLayout();
      });
  }

  private reconcileCatalog(presentation: number, sessionKey: string): void {
    if (this.currentContent(presentation) && sessionKey === this.sessionKey && this.currentInputEnabled() &&
      this.tab === 'directory' && !this.catalogComplete && !this.catalogLoading) this.onRequireCompleteCatalog();
  }

  @Builder
  private catalogStatus() {
    Row({ space: 6 }) {
      Text(this.displaySnapshot().catalogState === 'failed' ? '目录加载失败，已保留当前条目' :
        this.displaySnapshot().catalogState === 'loading' ? '正在加载完整目录' : '目录尚未加载完整')
        .layoutWeight(1).fontFamily(MESSAGE_BODY.fontFamily).fontWeight(MESSAGE_BODY.fontWeight)
        .fontSize(MESSAGE_BODY.fontSizeFp).lineHeight(MESSAGE_BODY.lineHeightFp as number)
        .fontColor(readerAppColor('TOK_READ_MUTED', this.appThemeScheme));
      if (this.displaySnapshot().catalogState !== 'loading') {
        ReaderRecoveryAction({ label: this.displaySnapshot().catalogState === 'failed' ? '重试加载目录' : '加载完整目录',
          generation: this.layoutPresentation, actionEnabled: this.currentInputEnabled(),
          onReconcile: (expected: number): void => this.reconcileCatalog(expected, this.sessionKey) });
      }
    }.width('100%').padding({ left: 8, right: 8, top: 2, bottom: 2 });
  }

  @Builder
  private flatCatalog(allowPrefix: boolean = true, presentation: number = this.layoutPresentation ?? 0) {
    if (this.shortContent && allowPrefix) { this.flatList(presentation); }
    else {
    Column() {
      if (this.tab === 'directory' && this.displayCatalogComplete() === false && this.displaySnapshot().rows.length > 0) this.catalogStatus();
      Stack() {
        if (this.displaySnapshot().rows.length === 0) {
          ReaderPageState({ padded: false,
            loading: this.displayCatalogComplete() === false && this.displaySnapshot().catalogState === 'loading',
            message: this.displayCatalogComplete() !== false ? '没有匹配的章节' :
              this.displaySnapshot().catalogState === 'failed' ? '目录加载失败' :
              this.displaySnapshot().catalogState === 'loading' ? '正在加载完整目录' : '目录尚未加载完整',
            actionLabel: this.displayCatalogComplete() === false && this.displaySnapshot().catalogState !== 'loading' ?
              (this.displaySnapshot().catalogState === 'failed' ? '重试加载目录' : '加载完整目录') : '',
            actionEnabled: this.currentInputEnabled(),
            actionGeneration: this.layoutPresentation,
            mutedColor: readerAppColor('TOK_READ_MUTED', this.appThemeScheme),
            onAction: (expected: number): void => this.reconcileCatalog(expected, this.sessionKey) });
        } else {
          this.flatList(presentation);
        }
      }.width('100%').layoutWeight(1);
    }.width('100%').height('100%');
    }
  }

  private retryCurrentBookmarks(): void {
    if (this.mounted && this.currentInputEnabled() && this.tab === 'bookmarks' &&
      this.bookmarkLoadFailed) this.onRetryBookmarkLoad();
  }

  private returnFromEmptyBookmarks(): void {
    if (this.mounted && this.currentInputEnabled() && this.tab === 'bookmarks' &&
      !this.bookmarkLoadFailed && !this.snapshot.loading && this.snapshot.rows.length === 0) this.onTabChange('directory');
  }

  @Builder
  private listBody(allowPrefix: boolean = true, presentation: number = this.layoutPresentation ?? 0) {
    if (allowPrefix && this.shortContent && this.localState()) { this.flatList(presentation); }
    else if (this.tab === 'bookmarks' && this.displayBookmarkFailed()) {
      ReaderBookmarkErrorState({ message: this.displayBookmarkMessage(),
        onRetry: (): void => this.retryCurrentBookmarks() });
    } else if (this.displaySnapshot().loading && !(this.tab === 'directory' && this.displayCatalogComplete() === false)) {
      if (this.tab === 'bookmarks') {
        ReaderBookmarkLoadingState();
      } else {
        Column() {
          ReaderPageState({ loading: true, message: '目录载入中…', padded: false,
            mutedColor: readerAppColor('TOK_READ_MUTED', this.appThemeScheme) });
        }.width('100%').height('100%').justifyContent(FlexAlign.Center);
      }
    } else if (this.displaySnapshot().rows.length === 0 && this.tab === 'bookmarks') {
      ReaderBookmarkEmptyState({ onReturnToDirectory: (): void => this.returnFromEmptyBookmarks() });
    } else if (this.displaySnapshot().rows.length === 0 && !this.navigationActive &&
      !(this.tab === 'directory' && this.bookmarkIdentity !== undefined)) {
      this.flatCatalog(allowPrefix, presentation);
    } else {
      if (this.tab === 'directory' && this.bookmarkIdentity !== undefined) {
        ReaderDirectoryNavigationSurface({
            navigationPortFactory: this.navigationPortFactory,
          headerCount: this.headerCount(), prefixHeight: this.prefixHeight(), prefixIdentity: `${this.sessionKey}:${this.tab}:control-directory-prefix`,
          prefixRevealRevision: this.prefixRevealRevision, prefixBuilder: (): void => { this.shortHeader(); },
          sourceId: this.bookmarkIdentity.sourceId, bookId: this.bookmarkIdentity.bookId, query: this.query, ascending: this.ascending,
          currentChapterIndex: this.currentChapterIndex, openRevision: this.sessionKey,
          interacted: this.navigationInteracted, rowHeight: this.rowHeight(),
          listPaddingX: this.rowPadding(), listPaddingY: 0,
          edgeEffectMode: EdgeEffect.Spring, interactionEnabled: this.currentInputEnabled(),
          showLoadStatus: this.displayCatalogComplete(),
          chapterEntries: this.entries,
          chapterDownloadEnabled: this.chapterDownloadEnabled,
          bookmarkActionsEnabled: this.bookmarkWriteEnabled(),
          chapterStartBookmarkCreationEnabled: this.chapterStartBookmarkCreationEnabled && this.bookmarkWriteEnabled(),
          scroller: this.scroller, fallbackBuilder: (): void => { this.flatCatalog(true, presentation); },
          onSelectTarget: (chapterIndex: number, chapterOffsetScalar: number, positionScope?: RemoteReadingPositionScope, directoryTargetProof?: ReaderDirectoryTargetProof): void => {
            this.onSelectNavigationTarget(chapterIndex, chapterOffsetScalar, positionScope, directoryTargetProof);
          },
          onUserScrollIntent: (): void => this.userScroll(),
          onFirstLayout: (): void => { if (this.mounted) this.onListLayout(); },
          onClearSearch: (): void => this.clearSearch(this.layoutPresentation),
          onTreeStateChange: (active: boolean): void => {
            if (!this.mounted) return;
            this.navigationActive = active;
            this.leadingRow = undefined; this.leadingKey = undefined; this.leadingPrefixOffset = undefined;
          },
          onDeleteBookmarks: (times: number[]): void => { if (this.bookmarkWriteEnabled()) this.onDeleteBookmarks(times); },
          onDownloadChapter: (chapterIndex: number): void => this.onDownloadChapter(chapterIndex),
          onCreateChapterStartBookmark: (request: ReaderDirectoryChapterStartBookmarkRequest): void =>
            { if (this.bookmarkWriteEnabled()) this.onCreateChapterStartBookmark(request); },
        });
      } else {
        this.flatCatalog(allowPrefix, presentation);
      }
    }
  }

  build() {
    if (!this.preparedMinimumRequired || this.presentationPrepared() !== undefined) {
    Stack({ alignContent: Alignment.TopStart }) {
      if (!this.shortContent) {
      Stack() { this.tabButton('directory', '章节'); }
        .position({ x: this.value(this.tab === 'bookmarks' ? 15 : 16, 9),
          y: this.contentGeometry().tabTop });
      Stack() { this.tabButton('bookmarks', '书签'); }
        .position({ x: this.value(this.tab === 'bookmarks' ? 142 : 143, 169) + (this.availableWidth - this.value(286, 338)) / 2,
          y: this.contentGeometry().tabTop });
      Row().width(this.tab === 'bookmarks' ? this.availableWidth + 52 * (1 - this.progress) - 2 :
        Math.max(0, this.availableWidth - this.value(22, 2))).height(1).backgroundColor(readerAppColor('TOK_LINE', this.appThemeScheme))
        .position({ x: this.tab === 'bookmarks' ? 1 : this.value(11, 1),
          y: this.contentGeometry().dividerTop })
        .opacity(this.tab === 'bookmarks' ? this.progress : 1);
      Stack({ alignContent: Alignment.TopStart }) { this.directoryToolbar(); }
        .width(Math.max(0, this.availableWidth - 2)).height(this.contentGeometry().toolbarViewportHeight)
        .position({ x: 1, y: this.contentGeometry().toolbarTop }).clip(true)
        .opacity(this.progress * this.presentation().contentOpacity).blur(this.presentation().contentBlur)
        .enabled(this.toolbarInteractive())
        .accessibilityLevel(this.toolbarInteractive() ? 'auto' : 'no-hide-descendants')
        .hitTestBehavior(this.toolbarInteractive() ? HitTestMode.Default : HitTestMode.None);
      }
      Stack({ alignContent: Alignment.TopStart }) { this.listBody(); }
        .width(Math.max(0, this.availableWidth - 2)).height(this.listHeight())
        .position({ x: 1, y: this.listTop() }).clip(true)
        .opacity(this.presentation().contentOpacity).blur(this.presentation().contentBlur);
      if (!this.shortContent && this.tab === 'directory' && this.contentGeometry().footerViewportHeight > 0) {
        Stack({ alignContent: Alignment.TopStart }) {
          Column({ space: 0 }) {
          Row().width('100%').height(1).backgroundColor(readerAppColor('TOK_LINE', this.appThemeScheme));
          Row({ space: 10 }) {
            Text('当前章节').fontFamily(TYPE_READER_DIRECTORY_POSITION.fontFamily as string).fontSize(TYPE_READER_DIRECTORY_POSITION.fontSizeFp).fontColor(readerAppColor('TOK_READ_MUTED', this.appThemeScheme))
              .flexShrink(0);
            Text(this.displaySnapshot().currentTitle).layoutWeight(1).fontFamily(TYPE_READER_DIRECTORY_CURRENT_TITLE.fontFamily)
              .fontWeight(TYPE_READER_DIRECTORY_CURRENT_TITLE.fontWeight).fontSize(TYPE_READER_DIRECTORY_CURRENT_TITLE.fontSizeFp).fontColor(readerAppColor('TOK_READ_INK', this.appThemeScheme))
              .maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis });
            Text(this.displaySnapshot().currentPosition).fontFamily(TYPE_READER_DIRECTORY_POSITION.fontFamily as string).fontSize(TYPE_READER_DIRECTORY_POSITION.fontSizeFp)
              .fontColor(readerAppColor('TOK_READ_MUTED', this.appThemeScheme)).flexShrink(0).maxLines(1).textAlign(TextAlign.End);
          }.width('100%').height(this.footerHeight() - 1).padding({ left: TOK_SPACE_SM, right: TOK_SPACE_SM, top: 1 })
            .backgroundColor(readerAppColor('TOK_SURFACE_PANEL_SOFT', this.appThemeScheme));
          }.width('100%').height(this.footerHeight())
            .position({ x: 0, y: this.contentGeometry().footerContentY });
        }.width(Math.max(0, this.availableWidth - 2)).height(this.contentGeometry().footerViewportHeight)
          .position({ x: 1, y: this.contentGeometry().footerTop }).clip(true)
          .opacity(this.progress * this.presentation().contentOpacity).blur(this.presentation().contentBlur)
          .hitTestBehavior(HitTestMode.None)
          .accessibilityLevel(this.progress === 0 ? 'no-hide-descendants' : 'auto');
      }
    }.width(this.availableWidth).height(this.availableHeight).clip(true);

    }
  }
}
