import type { ReaderControlVerificationSession } from './ReaderControlVerificationSession';
import inputMethod from '@ohos.inputMethod';
import type { ReaderControlTemporaryInputKind } from './ReaderControlSessionState';
import { readerControlKeyboardVisible } from '../../../ui/foundation/ReaderKeyboardBack';
import { ReaderEditingVisibility } from '../../../ui/layout/ReaderEditingVisibility';
import { ReaderEditingScrollBinding } from '../../../ui/layout/ReaderEditingScrollBinding';
import { readerControlDirectoryMinimumFacts, measureReaderDirectoryMinimum, type ReaderDirectoryMinimumFacts, type ReaderDirectoryMinimumProfile } from './ReaderControlDirectoryMinimum';
import { readerControlModuleProfileMatches, readerControlModuleFactsMatch, readerControlModuleFactsGeometryKey, type ReaderControlPreparedModuleProfile, type ReaderControlModuleFacts } from './ReaderControlMinimumMeasurement';
import type { ReaderDirectoryTargetProof } from '../application/ReaderDirectoryTargetProof';
import hilog from '@ohos.hilog';
import { DEBUG } from '../../../../../../build/default/generated/profile/default/BuildProfile';
import { type ReaderDirectoryNavigationPortFactory, readerDirectoryScopeKey } from '../application/ReaderDirectoryNavigation';
import { ReaderActionAccessibility, readerActionTouchRegion } from '../../../ui/controls/ReaderActionAccessibility';
import { ReaderPressFeedback } from '../../../ui/foundation/ReaderPressFeedback';
import { TYPE_READER_BOOKMARK_CHAPTER, TYPE_READER_BOOKMARK_EXCERPT, TYPE_READER_DIRECTORY_CURRENT_TITLE,
  TYPE_READER_DIRECTORY_POSITION, TYPE_READER_DIRECTORY_TAB_COMPACT, TYPE_SEARCH_DIRECTORY_INPUT } from '../../../ui/foundation/ReaderTypography';

import type { RemoteReadingPositionScope } from '../application/RemoteReadingPositionMigration';
import { readerAppColor } from '../../../ui/foundation/ReaderThemeRegistry';
import { FrameCallback, LengthMetrics } from '@kit.ArkUI';
import { sampleReaderControlMotionPresentation, type ReaderControlMotionPresentation } from './ReaderControlMotionPresentation';
import type { LocalReadingTocEntry } from '../application/LocalReadingFlowGateway';
import type { ReaderBookIdentity, ReaderBookmarkRowModel } from '../presentation/ReaderBookmarkProjection';
import { ReaderDirectoryDataPublication, sameReaderDirectoryData, snapshotReaderDirectoryData } from '../presentation/ReaderDirectoryDataSnapshot';
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
import { readerPageAreaLength } from '../../../ui/layout/ReaderPageShell';
import { ReaderDirectoryChapterRow } from './ReaderDirectoryChapterRow';
import { readerWindowMetrics } from '../../../ui/foundation/ReaderWindowEnvironment';
import { readerReadableFontScale, readerScaledControlHeight } from '../../../ui/foundation/ReaderSurfaceResolvers';
import { resolveReaderControlDirectoryGeometry, type ReaderControlDirectoryGeometry } from './ReaderControlDirectoryGeometry';
import { ReaderDirectoryNavigationSurface } from './ReaderDirectoryNavigationSurface';
import type { ReaderControlModuleMeasurer, ReaderControlCandidateWidths, ReaderControlModuleMinimum } from './ReaderLayoutGeometry';

import { sampleReaderControlBookmark, type ReaderControlBookmarkNaturalSize } from './ReaderControlBookmarkGeometry';
import { readerDirectorySignalScrollCommand, readerDirectorySignalScrollIntent } from '../presentation/ReaderDirectoryViewport';
import { TOK_SPACE_SM } from '../../../ui/foundation/ReaderTokens';
import { DIRECTORY_TOOL_SIZE, readerDirectoryToolbarBudget } from '../presentation/ReaderFullDirectoryBudget';
import { readerCompactSearchHeight } from '../../../ui/foundation/ReaderSearchControlGeometry';

interface ReaderControlDirectoryScrollFacts {
  offsetVp?: number;
  beforeOffsetVp?: number;
  tab: string;
  presentation: number;
}

interface ControlDirectoryRowAdmission {
  revision: number;
  chapter: LocalReadingTocEntry | undefined;
  bookmark: string;
}

class ControlDirectoryDataSource implements IDataSource {
  private rows: ReaderControlDirectoryRow[] = [];
  private admitted: Map<string, ControlDirectoryRowAdmission> = new Map<string, ControlDirectoryRowAdmission>();
  private revision: number = 0;
  private listeners: DataChangeListener[] = [];
  totalCount(): number { return this.rows.length; }
  getData(index: number): ReaderControlDirectoryRow { return this.rows[index]; }
  rowKey(row: ReaderControlDirectoryRow): string {
    return `${row.key}:${this.admitted.get(row.key)?.revision ?? 0}`;
  }
  registerDataChangeListener(listener: DataChangeListener): void { this.listeners.push(listener); }
  unregisterDataChangeListener(listener: DataChangeListener): void {
    this.listeners = this.listeners.filter((value: DataChangeListener): boolean => value !== listener);
  }
  replace(rows: ReaderControlDirectoryRow[]): void {
    // Values can change while row identity remains stable. Notify changed
    // rows individually; use a reload only for a structural key change.
    const structural = rows.length !== this.rows.length ||
      rows.some((row: ReaderControlDirectoryRow, index: number): boolean => row.key !== this.rows[index].key);
    const admitted = new Map<string, ControlDirectoryRowAdmission>();
    const changed: number[] = [];
    rows.forEach((row: ReaderControlDirectoryRow, index: number): void => {
      const previous = this.admitted.get(row.key);
      const bookmark = controlDirectoryBookmarkSignature(row.bookmark);
      const sameChapter = previous?.chapter === undefined || row.chapter === undefined ? previous?.chapter === row.chapter :
        sameReaderDirectoryData([previous.chapter], [row.chapter]);
      if (previous !== undefined && sameChapter && previous.bookmark === bookmark) {
        admitted.set(row.key, previous);
      } else {
        admitted.set(row.key, { revision: ++this.revision,
          chapter: row.chapter === undefined ? undefined : snapshotReaderDirectoryData([row.chapter])[0], bookmark });
        changed.push(index);
      }
    });
    this.rows = rows;
    this.admitted = admitted;
    if (structural) {
      for (const listener of this.listeners) listener.onDataReloaded();
    } else {
      for (const index of changed) {
        for (const listener of this.listeners) listener.onDataChange(index);
      }
    }
  }
}

function controlDirectoryBookmarkSignature(bookmark: ReaderBookmarkRowModel | undefined): string {
  if (bookmark === undefined) return '';
  const scope = bookmark.positionScope;
  return JSON.stringify([bookmark.bookmarkId, bookmark.identityStatus, bookmark.positionStatus,
    bookmark.chapterIndex, bookmark.chapterOffset, bookmark.chapterTitle, bookmark.excerpt, bookmark.positionLabel,
    bookmark.timeLabel, scope?.sourceId, scope?.bookId, scope?.chapterIndex, scope?.bodyVersion, scope?.processingVersion]);
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
  private readonly editingHost: ReaderEditingVisibility = new ReaderEditingVisibility();
  private readonly editingScroll: ReaderEditingScrollBinding = new ReaderEditingScrollBinding();
  private readonly editingScroller: Scroller = new Scroller();
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

  entries: LocalReadingTocEntry[] = [];
  directoryPublication: ReaderDirectoryDataPublication | undefined = undefined;
  @Prop @Watch('refreshData') directoryEntriesRevision: number = 0;
  private currentDirectoryEntries(): LocalReadingTocEntry[] {
    return this.directoryPublication?.entriesAt(this.directoryEntriesRevision) ?? this.entries;
  }
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
  editorInputCurrent?: () => boolean;
  onTemporaryLayerChange: (active: boolean, kind?: ReaderControlTemporaryInputKind, endEditing?: () => void | Promise<void>) => void =
    (_active: boolean, _kind?: ReaderControlTemporaryInputKind, _endEditing?: () => void | Promise<void>): void => {};
  @Prop @Watch('dismissDirectoryEditing') dismissTemporaryRevision: number = 0;
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
  @State private locateCurrentRevision: number = 0;
  @State private query: string = '';
  private flatRefreshTimer: number = -1;
  private pendingFlatTop: boolean = false;
  private readonly fallbackDirectory: ReaderDirectoryDataPublication = new ReaderDirectoryDataPublication();
  private fallbackDirectoryRevision: number = 0;
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
    if (this.tab === 'directory' && this.navigationActive) return this.snapshot;
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
    if (!this.navigationActive && rows !== this.displayedRows) {
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
  verificationSession: ReaderControlVerificationSession | undefined = undefined;
  private verificationScrollBefore: number | undefined = undefined;
  private verificationScrollPresentation: number = -1;
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
    this.cancelFlatRefresh();
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
    this.onTemporaryLayerChange(false);
    this.directoryKeyboardWasVisible = false; this.directoryRestoreKeyboard = true;
    this.directoryKeyboardVisible = undefined; this.directoryKeyboardTransferPending = false;
  }

  private currentInputEnabled(): boolean {
    return (!this.preparedMinimumRequired || this.presentationPrepared()?.ownerCurrent?.() === true) &&
      this.interactionEnabled && (this.inputCurrent?.() ?? true);
  }
  private currentEditorInputEnabled(): boolean {
    // Subscribe the native ancestor to the local interaction Prop while the
    // temporary editor keeps its existing live input scope during reflow.
    const inputEnabled = this.currentInputEnabled();
    return this.mounted && (!this.preparedMinimumRequired || this.presentationPrepared()?.ownerCurrent?.() === true) &&
      (this.editorInputCurrent?.() ?? inputEnabled);
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
    this.editingHost.refresh();
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
        this.directoryQueryHeight(), TYPE_SEARCH_DIRECTORY_INPUT.fontSizeFp * 6 * this.fontScale()).height + 2;
  }
  private footerHeight(): number { return this.selectedMinimum()?.full.footerHeightVp ?? 48; }
  private bookmarkNaturalSize(): ReaderControlBookmarkNaturalSize | undefined {
    const profile = this.selectedMinimum();
    if (profile !== undefined) return {
      titleHeightVp: this.value(profile.quick.bookmark.titleHeightVp, profile.full.bookmark.titleHeightVp),
      excerptHeightVp: this.value(profile.quick.bookmark.excerptHeightVp, profile.full.bookmark.excerptHeightVp),
    };
    const scale = this.fontScale();
    if (scale <= 1) return undefined;
    return {
      titleHeightVp: (TYPE_READER_BOOKMARK_CHAPTER.lineHeightFp as number) * scale,
      excerptHeightVp: (TYPE_READER_BOOKMARK_EXCERPT.lineHeightFp as number) * 2 * scale,
    };
  }

  private showBookmarkExcerpt(): boolean {
    if (this.progress !== 1) return true;
    const minimumTabs = Math.max(44, 6 + this.tabHeight());
    const bookmark = sampleReaderControlBookmark(this.progress, this.rowWidth(), this.bookmarkNaturalSize());
    return this.availableHeight - minimumTabs >= bookmark.card.height;
  }

  private openList(): void {
    if (!this.mounted) return;
    this.lifecycle += 1; this.layoutRestoreTicket += 1; this.layoutPresentation += 1;
    this.layoutRestorePending = false; this.layoutRestoreQueued = false;
    this.leadingPrefixOffset = undefined; this.directoryInputFocused = false;
    this.onTemporaryLayerChange(false);
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
    this.pendingFlatTop = false;
    this.refreshData(true, false);
  }

  private cancelFlatRefresh(): void {
    if (this.flatRefreshTimer < 0) return;
    clearTimeout(this.flatRefreshTimer);
    this.flatRefreshTimer = -1;
  }

  private refreshData(immediate: boolean = false, treeActive: boolean = this.navigationActive): void {
    if (!this.mounted) return;
    this.cancelFlatRefresh();
    if (this.directoryPublication === undefined)
      this.fallbackDirectoryRevision = this.fallbackDirectory.publish(this.entries);
    if (this.tab === 'directory' && treeActive) {
      this.pendingFlatTop = false;
      this.refreshTreeDirectoryHeader();
      return;
    }
    if (immediate) { this.publishFlatData(); return; }
    const lifecycle = this.lifecycle;
    this.flatRefreshTimer = setTimeout((): void => {
      this.flatRefreshTimer = -1;
      if (this.mounted && lifecycle === this.lifecycle && !this.navigationActive) this.publishFlatData();
    }, 150);
  }

  private directoryChapterEntry(index: number): LocalReadingTocEntry | undefined {
    return this.directoryPublication === undefined ? this.fallbackDirectory.entryAt(this.fallbackDirectoryRevision, index) :
      this.directoryPublication.entryAt(this.directoryEntriesRevision, index);
  }

  private refreshTreeDirectoryHeader(): void {
    const publication = this.directoryPublication ?? this.fallbackDirectory;
    const revision = this.directoryPublication === undefined ? this.fallbackDirectoryRevision : this.directoryEntriesRevision;
    const current = publication.entryAt(revision, this.currentChapterIndex);
    const representative = current ?? publication.entriesAt(revision)[0];
    const count = this.catalogComplete ? publication.readableCountAt(revision) : this.catalogReadableChapterCount;
    const rank = this.catalogComplete ? publication.readableRankAt(revision, this.currentChapterIndex) : this.catalogReadablePosition;
    const catalogState: 'ready' | 'partial' | 'loading' | 'failed' = this.catalogComplete ? 'ready' :
      this.catalogLoading ? 'loading' : this.catalogLoadFailed ? 'failed' : 'partial';
    const title = current?.title ?? '';
    const position = rank !== undefined && rank >= 0 && rank < count ? `${rank + 1} / ${count}` : '';
    const before = this.snapshot;
    if (!before.loading && before.catalogState === catalogState && before.currentTitle === title &&
      before.currentPosition === position && before.rows.length <= 1 &&
      before.rows[0]?.chapter === representative && before.targetRow === 0) return;
    const rows: ReaderControlDirectoryRow[] = representative === undefined ? [] :
      [{ key: `chapter:${representative.index}`, chapter: representative, bookmark: undefined }];
    this.snapshot = { rows, loading: false, catalogState, bookmarkFilteredEmpty: false,
      currentTitle: title, currentPosition: position, targetRow: 0 };
    this.publishMinimumMeasurer();
  }

  private publishFlatData(): void {
    const next = readerControlDirectorySnapshot(this.currentDirectoryEntries(), this.tab, this.query,
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
    if (this.pendingFlatTop) {
      this.pendingFlatTop = false;
      try { this.scroller.scrollEdge(Edge.Top); } catch (_) {}
    }
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
    if (!this.currentEditorInputEnabled()) {
      this.directoryInputFocused = false; this.layoutRestoreTicket += 1;
      this.onTemporaryLayerChange(false);
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
    if (this.verificationSession?.observing() === true && this.verificationScrollBefore === undefined) {
      const offset = this.verificationOffset();
      if (offset !== undefined) {
        this.verificationScrollBefore = offset;
        this.verificationScrollPresentation = this.layoutPresentation;
        const facts: ReaderControlDirectoryScrollFacts = {
          offsetVp: offset, tab: this.tab, presentation: this.layoutPresentation,
        };
        this.verificationSession.effect('directory-scroll', 'started', facts);
      }
    }
    this.cancelPendingPlacement();
    this.navigationInteracted = true;
  }
  private verificationOffset(): number | undefined {
    try {
      const offset = this.scroller.currentOffset().yOffset;
      return Number.isFinite(offset) ? offset : undefined;
    } catch (_) {
      return undefined;
    }
  }

  private observeDirectoryScrollSettled(): void {
    const before = this.verificationScrollBefore;
    const presentation = this.verificationScrollPresentation;
    this.verificationScrollBefore = undefined;
    this.verificationScrollPresentation = -1;
    if (before === undefined || presentation !== this.layoutPresentation) return;
    const facts: ReaderControlDirectoryScrollFacts = {
      beforeOffsetVp: before, offsetVp: this.verificationOffset(), tab: this.tab, presentation: presentation,
    };
    this.verificationSession?.effect('directory-scroll', 'settled', facts);
  }

  private value(quick: number, full: number): number { return quick + (full - quick) * this.progress; }
  private fontScale(): number {
    return !Number.isFinite(this.minimumMetricsRevision) || this.minimumMetricsRevision < 0 ? 1 :
      readerReadableFontScale(readerWindowMetrics().systemFontScale);
  }
  private contentGeometry(): ReaderControlDirectoryGeometry {
    const profile = this.selectedMinimum();
    return resolveReaderControlDirectoryGeometry(this.progress, this.tab, this.availableHeight,
      this.tabHeight(), this.rowHeight(), profile === undefined ? undefined : {
        listTop: this.value(profile.quick.listTopVp, profile.full.listTopVp),
        toolbarHeight: this.toolbarHeight(), footerHeight: this.footerHeight() }, this.toolbarHeight());
  }
  private toolbarInteractive(): boolean {
    return this.mounted && this.currentInputEnabled() && this.progress === 1 &&
      this.availableHeight > 0;
  }
  private queryInteractive(): boolean {
    // Zero editing capacity must not disable/remount the live native editor
    // or discard IME composition. Its clipped slot has no touchable pixels;
    // the visibility owner reports insufficient space and Back still exits.
    return this.currentEditorInputEnabled() && this.progress === 1;
  }
  private tabsInteractive(): boolean {
    return this.mounted && this.currentInputEnabled() &&
      (this.shortContent || this.availableHeight >= this.contentGeometry().tabBottom);
  }
  private rowHeight(): number {
    if (this.tab === 'bookmarks') {
      return sampleReaderControlBookmark(this.progress, this.rowWidth(), this.bookmarkNaturalSize(), this.showBookmarkExcerpt()).card.height;
    }
    const profile = this.selectedMinimum();
    if (profile !== undefined) return Math.max(44, this.value(profile.quick.rowHeightVp, profile.full.rowHeightVp));
    return readerScaledControlHeight(44, 20, this.fontScale());
  }
  private editingPrefixHeight(): number {
    const nominal = this.contentGeometry().nominalListTop;
    const minimumTabs = this.tab === 'bookmarks' ? Math.max(44, this.contentGeometry().tabBottom) : 44;
    return this.shortContent ? Math.min(Math.max(0, this.availableHeight),
      Math.max(Math.min(minimumTabs, this.availableHeight), this.availableHeight - this.rowHeight())) :
      Math.min(Math.max(0, this.availableHeight), nominal);
  }
  private listTop(): number { return this.editingPrefixHeight(); }
  private listHeight(): number { return Math.max(0, this.availableHeight - this.listTop() -
    (this.shortContent ? 0 : this.contentGeometry().footerReservation)); }
  private rowPadding(): number { return this.tab === 'bookmarks' ? this.value(15, 10) : this.value(16, 10); }
  private rowWidth(): number { return Math.max(0, this.availableWidth - 2 - this.rowPadding() * 2); }
  private placeholder(): string { return this.tab === 'bookmarks' ? '搜索书签内容' : '搜索章节名称'; }

  private bookmarkWriteEnabled(): boolean {
    return this.bookmarkRecovery.bookmarkWriteEnabled === true;
  }
  private headerCount(): number { return 0; }
  private currentContent(presentation: number): boolean {
    return this.mounted && presentation === (this.layoutPresentation ?? 0);
  }
  private directoryFocusId(): string {
    return `reader-control-directory-query:${this.sessionKey}:${this.tab}`;
  }
  private onGeometryChanged(): void { this.syncContentLayout(); }

  private syncContentLayout(): void {
    if (!this.currentEditorInputEnabled() || (this.progress !== 0 && this.progress !== 1)) return;
    if (this.directoryInputFocused) {
      const keyboardVisible = readerControlKeyboardVisible(readerWindowMetrics());
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
    const presentationKey = `${this.sessionKey}:${this.tab}`;
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
    this.layoutRestorePending = true;
  }

  private directoryQueryHeight(): number {
    return Math.max(readerCompactSearchHeight(DIRECTORY_TOOL_SIZE, TYPE_SEARCH_DIRECTORY_INPUT.lineHeightFp as number, this.fontScale()),
      this.selectedMinimum()?.full.fieldHeightVp ?? 0);
  }


  private prefixHeight(): number { return 0; }

  private onDirectoryFocus(presentation: number, id: string, focused: boolean): void {
    if (!this.currentContent(presentation) || id !== this.directoryFocusId()) return;
    if (focused && !this.queryInteractive()) return;
    this.directoryInputFocused = focused;
    this.onTemporaryLayerChange(focused, 'inlineEditor', (): Promise<void> => this.endDirectoryNavigationEditing());
    if (!focused) this.directoryKeyboardTransferPending = false;
  }
  private onDirectoryKeyboardRestoreSettled(presentation: number, id: string, requested: boolean): void {
    if (!this.currentContent(presentation) || id !== this.directoryFocusId()) return;
    this.directoryKeyboardTransferPending = false;
    this.directoryKeyboardVisible = readerControlKeyboardVisible(readerWindowMetrics());
    if (!requested) {
      this.dismissDirectoryEditing();
    }
  }
  private async endDirectoryNavigationEditing(): Promise<void> {
    if (!this.mounted) return;
    this.dismissDirectoryEditing();
    try { await inputMethod.getController().hideTextInput(); } catch (_) {}
  }
  private dismissDirectoryEditing(): void {
    if (!this.mounted) return;
    this.directoryInputFocused = false;
    this.directoryRestoreKeyboard = false;
    this.directoryKeyboardTransferPending = false;
    this.onTemporaryLayerChange(false);
  }
  private onDirectoryEditingRequested(presentation: number, id: string): void {
    if (!this.currentContent(presentation) || !this.queryInteractive() || id !== this.directoryFocusId()) return;
    // A new explicit edit can open the keyboard after Back. Layout-only
    // restoration continues to use the previously observed hidden policy.
    this.directoryRestoreKeyboard = true;
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
        if (this.directoryInputFocused) {
          this.editingHost.refresh();
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
        // Geometry does not re-focus or re-open an already mounted input.
      } catch (_error) { /* Native first layout owns retries; no polling. */ }
    }));
  }
  private clearSearch(presentation: number): void {
    if (!this.currentContent(presentation) || !this.toolbarInteractive()) return;
    this.clearAppliedSearch();
  }
  private clearAppliedSearch(): void {
    this.draft = ''; this.query = ''; this.cancelPendingPlacement();
    this.navigationInteracted = false;
    if (this.tab === 'directory' && this.currentChapterIndex >= 0) {
      const revision = this.locateCurrentRevision + 1;
      this.locateCurrentRevision = revision;
      this.placement.open(`${this.sessionKey}:${this.tab}:${revision}`);
    }
    this.refreshData();
    this.editingHost.refresh();
  }
  private tabWidth(): number {
    return this.shortContent ? Math.max(44, (this.rowWidth() - 6) / 2) :
      Math.max(0, (this.availableWidth - this.value(32, 18)) / 2);
  }

  private search(): void {
    if (this.deferCatalogAction('search')) return;
    const query = this.draft.trim();
    if (query === this.query) return;
    if (query.length === 0) { this.clearAppliedSearch(); return; }
    this.pendingFlatTop = !this.navigationActive;
    this.query = query; this.cancelPendingPlacement(); this.refreshData();
  }
  private sort(): void {
    if (this.deferCatalogAction('sort')) return;
    this.pendingFlatTop = !this.navigationActive;
    this.ascending = !this.ascending; this.cancelPendingPlacement(); this.refreshData();
  }

  private deferCatalogAction(action: string): boolean {
    if (this.tab !== 'directory' || this.catalogComplete || this.navigationActive) return false;
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
  private tabButton(tab: string, title: string, presentation: () => number = (): number => this.layoutPresentation ?? 0) {
    Button({ type: ButtonType.Normal, stateEffect: false }) {
    Stack({ alignContent: Alignment.Bottom }) {
      Row({ space: 5 }) {
        if (tab === 'directory') {
          Image(this.tab === tab ? (this.appThemeScheme === 'night' ? $r('app.media.rc_list_theme_night') : $r('app.media.rc_list')) :
            (this.appThemeScheme === 'night' ? $r('app.media.reader_directory_directory_theme_night') : $r('app.media.reader_directory_directory'))).width(15).height(15);
        } else {
          Image(this.tab === tab ? (this.appThemeScheme === 'night' ? $r('app.media.reader_page_bookmark_filled_theme_night') : $r('app.media.reader_page_bookmark_filled')) :
            (this.appThemeScheme === 'night' ? $r('app.media.reader_directory_marker_bookmark_theme_night') : $r('app.media.reader_directory_marker_bookmark'))).width(15).height(15);
        }
        Text(title).fontFamily(TYPE_READER_DIRECTORY_TAB_COMPACT.fontFamily).fontWeight(TYPE_READER_DIRECTORY_TAB_COMPACT.fontWeight)
          .fontSize(TYPE_READER_DIRECTORY_TAB_COMPACT.fontSizeFp).lineHeight(TYPE_READER_DIRECTORY_TAB_COMPACT.lineHeightFp as number).halfLeading(true)
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
      .id('reader-control-directory-tab-' + tab)
      .accessibilityText(title)
      .responseRegion({ x: 0, y: 0, width: this.tabWidth(), height: this.tabHeight() })
      .attributeModifier(new ReaderActionAccessibility(title, this.tabsInteractive(), this.tab === tab, true,
        new ReaderPressFeedback(Color.Transparent, this.appThemeScheme, 8, 8, this.tabsInteractive()), 'nativeButton'))
      .onClick((): void => {
        if (!this.currentContent(presentation()) || !this.tabsInteractive()) return;
        if (DEBUG) hilog.info(0xD004, 'ReaderControlDiagnostic',
          'stage=directory-tab tab=%{public}d current=%{public}s input=%{public}s',
          tab === 'bookmarks' ? 1 : 0, String(this.tab === tab), String(this.currentInputEnabled()));
        this.onTabChange(tab);
      });
  }

  @Builder
  private directoryToolbar(presentation: number = this.layoutPresentation ?? 0) {
    Stack({ alignContent: Alignment.TopStart }) {
      ReaderDirectoryToolbar({ editingHost: this.editingHost,
        variant: 'full-directory', actionEnabled: this.toolbarInteractive(),
        naturalFieldHeightVp: this.selectedMinimum()?.full.fieldHeightVp ?? 0,
        naturalInputHeightVp: this.selectedMinimum()?.full.inputHeightVp ?? 0,
        inputMinimumWidthVp: this.selectedMinimum()?.full.inputMinimumWidthVp ?? TYPE_SEARCH_DIRECTORY_INPUT.fontSizeFp * 6 * this.fontScale(),
        availableWidthVp: Math.max(0, this.availableWidth - 2),
        naturalToolbarHeightVp: this.selectedMinimum() === undefined ? 0 : this.toolbarHeight() - 2,
        text: this.draft, placeholder: this.placeholder(), ascending: this.ascending,
        showChapterTools: this.tab === 'directory',
        directoryFocusId: this.directoryFocusId(), directoryFocusAllowed: this.queryInteractive(),
        directoryFocusRevision: this.directoryInputFocused ? this.directoryFocusRevision : 0,
        directoryKeyboardOnFocus: this.directoryRestoreKeyboard,
        directoryFocusCurrent: (id: string): boolean => this.currentContent(presentation) && this.queryInteractive() && id === this.directoryFocusId(),
        onDirectoryFocusChanged: (id: string, focused: boolean): void => this.onDirectoryFocus(presentation, id, focused),
        onDirectoryEditingRequested: (id: string): void => this.onDirectoryEditingRequested(presentation, id),
        onDirectoryKeyboardBack: (_id: string): void => {
          this.verificationSession?.backConsumerForLatestLayer('keyboard');
        },
        onDirectoryKeyboardRestoreSettled: (id: string, requested: boolean): void => this.onDirectoryKeyboardRestoreSettled(presentation, id, requested),
        onTextChange: (value: string): void => {
          if (!this.currentContent(presentation) || !this.queryInteractive()) return;
          this.draft = value;
          if (this.tab === 'bookmarks' || this.catalogComplete || this.navigationActive) this.search();
          else if (value.trim().length === 0 && this.query.length > 0) this.clearAppliedSearch();
        },
        onSearch: (): void => { if (this.currentContent(presentation) && this.toolbarInteractive()) this.search(); },
        onTop: (): void => { if (this.currentContent(presentation) && this.toolbarInteractive()) this.scrollCatalogEdge(false); },
        onBottom: (): void => { if (this.currentContent(presentation) && this.toolbarInteractive()) this.scrollCatalogEdge(true); },
        onToggleSort: (): void => { if (this.currentContent(presentation) && this.toolbarInteractive()) this.sort(); },
      });
      Row().width('100%').height(1).backgroundColor(readerAppColor('TOK_LINE', this.appThemeScheme))
        .position({ x: 0, y: this.value(63, this.toolbarHeight() - 1) }).opacity(this.progress);
    }.width(Math.max(0, this.availableWidth - 2)).height(this.contentGeometry().toolbarHeight);
  }

  @Builder
  private chapterRow(entry: LocalReadingTocEntry, presentation: number) {
    ReaderDirectoryChapterRow({
      entry: entry, rowHeight: this.rowHeight(), currentChapterIndex: this.currentChapterIndex,
      selectionFocusId: this.verificationSession?.observing() === true && entry.navigable !== false &&
        entry.index !== this.currentChapterIndex ? `reader-control-directory-chapter:${entry.index}` : '',
      chapterDownloadEnabled: this.chapterDownloadEnabled,
      bookmarkActionsEnabled: this.bookmarkWriteEnabled(),
      chapterStartBookmarkCreationEnabled: this.chapterStartBookmarkCreationEnabled && this.bookmarkWriteEnabled(),
      canActOnEntry: (current: LocalReadingTocEntry): boolean =>
        sameReaderDirectoryData([current], [entry]) && this.flatChapterIsCurrent(entry, presentation),
      onSelectChapter: (index: number): void => {
        if (index === entry.index && this.flatChapterIsCurrent(entry, presentation)) this.onSelectChapter(index);
      },
      onDownloadChapter: (index: number): void => {
        if (index === entry.index && this.flatChapterIsCurrent(entry, presentation)) this.onDownloadChapter(index);
      },
      onDeleteBookmarks: (times: number[]): void => {
        if (this.bookmarkWriteEnabled() && this.flatChapterIsCurrent(entry, presentation)) this.onDeleteBookmarks(times);
      },
      onCreateChapterStartBookmark: (request: ReaderDirectoryChapterStartBookmarkRequest): void =>
        { if (this.bookmarkWriteEnabled() && this.flatChapterIsCurrent(entry, presentation)) this.onCreateChapterStartBookmark(request); },
    });
  }

  private flatChapterIsCurrent(entry: LocalReadingTocEntry, presentation: number): boolean {
    return !this.navigationActive && this.chapterIsCurrent(entry, presentation);
  }

  private directoryInputCurrent(presentation: number): boolean {
    return this.currentContent(presentation) && this.currentInputEnabled() && this.tab === 'directory';
  }

  private chapterIsCurrent(entry: LocalReadingTocEntry, presentation: number): boolean {
    if (!this.directoryInputCurrent(presentation) || entry.navigable === false) return false;
    const current = this.directoryChapterEntry(entry.index);
    return current !== undefined && sameReaderDirectoryData([entry], [current]);
  }

  private flatBookmarkIsCurrent(bookmark: ReaderBookmarkRowModel, presentation: number): boolean {
    return this.currentContent(presentation) && this.currentInputEnabled() && this.tab === 'bookmarks' &&
      this.displaySnapshot().rows.some((row: ReaderControlDirectoryRow): boolean =>
        row.bookmark?.bookmarkId === bookmark.bookmarkId && JSON.stringify(row.bookmark) === JSON.stringify(bookmark));
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
      .attributeModifier(new ReaderActionAccessibility(title, this.toolbarInteractive(), false, true,
        new ReaderPressFeedback(Color.Transparent, this.appThemeScheme, 8, 8, this.toolbarInteractive()), 'nativeButton'))
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
    Column() {}.width('100%').height(0);
  }

  private localState(): boolean {
    return (this.tab === 'bookmarks' && (this.displayBookmarkFailed() || this.displaySnapshot().rows.length === 0)) ||
      (this.displaySnapshot().loading && !(this.tab === 'directory' && this.displayCatalogComplete() === false)) ||
      (this.displaySnapshot().rows.length === 0 && !this.navigationActive && !(this.tab === 'directory' && this.bookmarkIdentity !== undefined));
  }

  @Builder
  private flatResultRow(row: ReaderControlDirectoryRow, presentation: number) {
    if (row.chapter !== undefined) {
      this.chapterRow(row.chapter, presentation);
    } else if (row.bookmark !== undefined) {
      ReaderBookmarkRow({ row: row.bookmark, embeddedInControl: true,
        showExcerpt: this.showBookmarkExcerpt(),
        naturalSize: this.bookmarkNaturalSize(),
        motionProgress: this.progress, availableWidth: this.rowWidth(),
        onSelectBookmark: (id: string, chapter: number, offset: number, positionScope?: RemoteReadingPositionScope): void => {
          if (this.flatBookmarkIsCurrent(row.bookmark!, presentation) &&
            id === row.bookmark!.bookmarkId && chapter === row.bookmark!.chapterIndex && offset === row.bookmark!.chapterOffset &&
            this.onSelectBookmark !== undefined) this.onSelectBookmark(id, chapter, offset, positionScope);
        } });
    }
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
          // The parent List builder may outlive a tab or session opening.
          // Each newly materialized row captures the opening that owns it.
          this.flatResultRow(row, this.layoutPresentation);
        }.width('100%').height(this.rowHeight());
      // Keep row identity through geometry-only layout changes and retire it
      // for a new opening or changed row data.
      }, (row: ReaderControlDirectoryRow): string => `${this.layoutPresentation}:${this.dataSource.rowKey(row)}`);
      }
    }.width('100%').height('100%').padding({ left: this.rowPadding(), right: this.rowPadding() })
      .scrollBar(BarState.Off).edgeEffect(EdgeEffect.Spring).cachedCount(4)
      .enableScrollInteraction(this.currentInputEnabled())
      .onWillScroll((offset: number, _state: ScrollState, source: ScrollSource): ScrollResult =>
        ({ offsetRemain: this.currentInputEnabled() || source === ScrollSource.SCROLLER ? offset : 0 }))
      .onWillStartDragging((): void => this.userScroll())
      .onScrollStop((): void => this.observeDirectoryScrollSettled())
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
  private flatCatalog(allowPrefix: boolean = false, presentation: number = this.layoutPresentation ?? 0) {
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

  private bookmarkEmptyAction(presentation: number, filtered: boolean): void {
    if (!this.currentContent(presentation) || !this.currentInputEnabled() || this.tab !== 'bookmarks' ||
      this.bookmarkLoadFailed || this.snapshot.loading || this.snapshot.rows.length !== 0 ||
      this.snapshot.bookmarkFilteredEmpty !== filtered) return;
    if (filtered) this.clearAppliedSearch();
    else this.onTabChange('directory');
  }

  @Builder
  private listBody(allowPrefix: boolean = false, presentation: number = this.layoutPresentation ?? 0) {
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
      ReaderBookmarkEmptyState({ filtered: this.displaySnapshot().bookmarkFilteredEmpty, compact: this.shortContent,
        actionGeneration: presentation,
        onAction: (expected: number, filtered: boolean): void => this.bookmarkEmptyAction(expected, filtered) });
    } else if (this.displaySnapshot().rows.length === 0 && !this.navigationActive &&
      !(this.tab === 'directory' && this.bookmarkIdentity !== undefined)) {
      this.flatCatalog(allowPrefix, presentation);
    } else {
      if (this.tab === 'directory' && this.bookmarkIdentity !== undefined) {
        ReaderDirectoryNavigationSurface({
          inputCurrent: (): boolean => this.directoryInputCurrent(presentation),
          chapterInputCurrent: (chapter: LocalReadingTocEntry): boolean => this.chapterIsCurrent(chapter, presentation),
          verificationChapterActions: this.verificationSession?.observing() === true,
            navigationPortFactory: this.navigationPortFactory,
          headerCount: this.headerCount(), prefixHeight: this.prefixHeight(), prefixIdentity: `${this.sessionKey}:${this.tab}:control-directory-prefix`,
          prefixRevealRevision: this.prefixRevealRevision, prefixBuilder: (): void => { this.shortHeader(); },
          sourceId: this.bookmarkIdentity.sourceId, bookId: this.bookmarkIdentity.bookId, query: this.query, ascending: this.ascending,
          currentChapterIndex: this.currentChapterIndex, openRevision: this.sessionKey,
          interacted: this.navigationInteracted, locateCurrentRevision: this.locateCurrentRevision, rowHeight: this.rowHeight(),
          listPaddingX: this.rowPadding(), listPaddingY: 0,
          edgeEffectMode: EdgeEffect.Spring, interactionEnabled: this.currentInputEnabled(),
          showLoadStatus: this.displayCatalogComplete(),
          directoryPublication: this.directoryPublication, directoryEntriesRevision: this.directoryEntriesRevision,
          chapterDownloadEnabled: this.chapterDownloadEnabled,
          bookmarkActionsEnabled: this.bookmarkWriteEnabled(),
          chapterStartBookmarkCreationEnabled: this.chapterStartBookmarkCreationEnabled && this.bookmarkWriteEnabled(),
          scroller: this.scroller, fallbackBuilder: (): void => { this.flatCatalog(true, presentation); },
          onSelectTarget: (chapterIndex: number, chapterOffsetScalar: number, positionScope?: RemoteReadingPositionScope, directoryTargetProof?: ReaderDirectoryTargetProof): void => {
            if (this.directoryInputCurrent(presentation))
              this.onSelectNavigationTarget(chapterIndex, chapterOffsetScalar, positionScope, directoryTargetProof);
          },
          onUserScrollIntent: (): void => { if (this.directoryInputCurrent(presentation)) this.userScroll(); },
          onObservedScrollSettled: (): void => {
            if (this.currentContent(presentation)) this.observeDirectoryScrollSettled();
          },
          onFirstLayout: (): void => { if (this.currentContent(presentation)) this.onListLayout(); },
          onClearSearch: (): void => { if (this.directoryInputCurrent(presentation)) this.clearSearch(presentation); },
          onTreeStateChange: (active: boolean): void => {
            if (!this.currentContent(presentation)) return;
            this.navigationActive = active;
            this.leadingRow = undefined; this.leadingKey = undefined; this.leadingPrefixOffset = undefined;
            this.correctionQueued = false;
            this.refreshData(true, active);
          },
          onDeleteBookmarks: (times: number[]): void => {
            if (this.directoryInputCurrent(presentation) && this.bookmarkWriteEnabled()) this.onDeleteBookmarks(times);
          },
          onDownloadChapter: (chapterIndex: number): void => {
            if (this.directoryInputCurrent(presentation)) this.onDownloadChapter(chapterIndex);
          },
          onCreateChapterStartBookmark: (request: ReaderDirectoryChapterStartBookmarkRequest): void =>
            { if (this.directoryInputCurrent(presentation) && this.bookmarkWriteEnabled()) this.onCreateChapterStartBookmark(request); },
        });
      } else {
        this.flatCatalog(allowPrefix, presentation);
      }
    }
  }

  build() {
    if (!this.preparedMinimumRequired || this.presentationPrepared() !== undefined) {
    Stack({ alignContent: Alignment.TopStart }) {
      Scroll(this.editingScroller) {
        Stack({ alignContent: Alignment.TopStart }) {
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
      Stack({ alignContent: Alignment.TopStart }) {
        ForEach([this.layoutPresentation], (presentation: number): void => {
          this.directoryToolbar(presentation);
        }, (presentation: number): string => presentation.toString());
      }
        .width(Math.max(0, this.availableWidth - 2)).height(this.toolbarHeight())
        .position({ x: 1, y: this.contentGeometry().toolbarTop }).clip(true)
        .opacity(this.progress * this.presentation().contentOpacity).blur(this.presentation().contentBlur)
        .enabled(this.queryInteractive())
        .accessibilityLevel(this.queryInteractive() ? 'auto' : 'no-hide-descendants')
        .hitTestBehavior(this.queryInteractive() ? HitTestMode.Default : HitTestMode.None);
      if (this.shortContent) {
        Flex({ wrap: FlexWrap.Wrap }) {
          this.shortTool('clear', '清除搜索', this.layoutPresentation);
          if (this.tab === 'directory' && !this.displayCatalogComplete()) this.shortTool('load', '加载完整目录', this.layoutPresentation);
        }.width('100%').position({ x: 0, y: this.contentGeometry().nominalListTop });
      }
        }.width(this.availableWidth).height(this.contentGeometry().nominalListTop + (this.shortContent ? 49 : 0));
      }.width(this.availableWidth).height(this.editingPrefixHeight())
        .id(this.editingScroll.id).scrollBar(BarState.Off).clip(true)
        .onAppear((): void => this.editingScroll.mount(this.getUIContext(), this.editingHost, this.editingScroller))
        .onDisAppear((): void => this.editingScroll.unmount())
        .onAreaChange((): void => this.editingHost.refresh());
      Stack({ alignContent: Alignment.TopStart }) {
        ForEach([this.layoutPresentation], (presentation: number): void => {
          this.listBody(false, presentation);
        }, (presentation: number): string => presentation.toString());
      }
        .id('reader-control-directory-body-' + this.tab)
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
    }.width(this.availableWidth).height(this.availableHeight).clip(true)
      .id('reader-control-module-directory');

    }
  }
}
