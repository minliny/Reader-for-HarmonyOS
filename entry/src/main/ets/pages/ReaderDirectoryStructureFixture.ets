// DEBUG component fixture only. The parent awaits checked production fonts.
// This file owns no Runtime/Core/Host, real navigation, user records or network.
import { DEBUG, BUILD_MODE_NAME } from '../../../../build/default/generated/profile/default/BuildProfile';
import { hilog } from '@kit.PerformanceAnalysisKit';
import { ReaderFullDirectory } from '../features/reading/ui/ReaderFullDirectory';
import { BookDirectoryPage } from '../features/reading/ui/BookDirectoryPage';
import { ReaderControlDirectoryContent } from '../features/reading/ui/ReaderControlDirectoryContent';
import { readerWindowMetrics } from '../ui/foundation/ReaderWindowEnvironment';
import { resolveReaderControlLayout, type ReaderControlLayoutSnapshot, type ReaderControlModuleMeasurer } from '../features/reading/ui/ReaderLayoutGeometry';
import { ReaderControlGeometry } from '../features/reading/ui/ReaderControlGeometry';
import { readerControlMotionBounds, sampleReaderControlMotionComposition,
  type ReaderControlMotionFrame } from '../features/reading/ui/ReaderControlMotionGeometry';
import { readerReadableFontScale } from '../ui/foundation/ReaderSurfaceResolvers';
import { readerPageAreaLength } from '../ui/layout/ReaderPageShell';
import type { LocalReadingTocEntry } from '../features/reading/application/LocalReadingFlowGateway';
import type { ReaderDirectoryChapterStartBookmarkRequest } from '../features/reading/presentation/ReaderDirectoryMarkerState';
import type { MangaDownloadAction, MangaDownloadActionId } from '../features/manga/application/MangaDownloadActionsGateway';
import type { ReaderBookIdentity } from '../features/reading/presentation/ReaderBookmarkProjection';
import { readingDirectoryRecovery, type ReadingDirectoryRecovery } from '../features/reading/presentation/ReadingDirectoryRecovery';
import type { ReaderDirectoryNavigationPortFactory } from '../features/reading/application/ReaderDirectoryNavigation';
import { readerDirectoryFixtureEntries, ReaderDirectoryFixturePort, readerDirectoryFixtureCopyEntry,
  nextReaderDirectoryFixtureInstanceId } from './ReaderDirectoryStructureFixtureData';

export type ReaderDirectoryFixtureMode = 'text' | 'manga' | 'control';
interface ReaderDirectoryFixtureObservation {
  kind: string;
  mode: string;
  flatCatalog: boolean;
  sourceSwitchCandidate: boolean;
  targetSelectionBusy: boolean;
  fixtureInstanceId: number;
  presentation: number;
  bookId: string;
  viewId: string;
  actualWidthVp: number;
  actualHeightVp: number;
  systemFontScale: number;
  chapterIndex: number;
  intentCount: number;
  initialRequestedControlHeightVp: number;
  requestedControlHeightVp: number;
  actualControlWidthVp: number;
  actualControlHeightVp: number;
}

@Component
export struct ReaderDirectoryStructureFixture {
  @StorageLink('readerWindowMetricsRevision') @Watch('onMetricsChanged') private windowMetricsRevision: number = 0;
  @Prop @Watch('resetFixture') mode: ReaderDirectoryFixtureMode = 'text';
  @Prop @Watch('resetFixture') fontsReady: boolean = false;
  @Prop @Watch('resetFixture') flatCatalog: boolean = false;
  @Prop @Watch('resetFixture') sourceSwitchCandidate: boolean = false;
  @Prop @Watch('resetFixture') emptyRetry: boolean = false;
  @Prop catalogContext: 'detail' | 'reader' = 'detail';
  @Prop controlExpanded: boolean = true;
  @Prop controlViewportHeight: number = 0;
  onBack: () => void = (): void => {};
  onAction: (kind: string, chapterIndex: number) => void = (_kind: string, _chapterIndex: number): void => {};
  @State private entries: LocalReadingTocEntry[] = [];
  @State private currentChapterIndex: number = 21;
  @State private targetSelectionBusy: boolean = false;
  @State private controlTab: string = 'directory';
  @State private actualWidth: number = 0;
  @State private actualHeight: number = 0;
  @State private localControlViewportHeight: number = 0;
  @State private presentation: number = 0;
  private readonly fixtureInstanceId: number = nextReaderDirectoryFixtureInstanceId();
  private intentCount: number = 0;
  private mounted: boolean = false;
  private nextBookmarkTime: number = 1793671200000;
  private fixturePort: ReaderDirectoryFixturePort | undefined = undefined;
  private navigationFactory: ReaderDirectoryNavigationPortFactory | undefined = undefined;
  @State private controlMinimumKey: string = '';
  private controlMinimumRevision: number = 0;
  private controlMinimumMeasurer: ReaderControlModuleMeasurer | undefined = undefined;
  private actualControlWidth: number = 0;
  private actualControlHeight: number = 0;

  aboutToAppear(): void { this.mounted = true; this.resetFixture(); }
  aboutToDisappear(): void { this.mounted = false; this.presentation += 1; this.fixturePort?.close(); }

  private admitted(): boolean {
    return this.mounted && DEBUG === true && BUILD_MODE_NAME === 'debug' && this.fontsReady;
  }

  private resetFixture(): void {
    this.presentation += 1;
    this.fixturePort?.close(); this.fixturePort = undefined;
    this.actualControlWidth = 0; this.actualControlHeight = 0;
    this.localControlViewportHeight = this.initialRequestedControlHeight();
    this.entries = this.admitted() ? readerDirectoryFixtureEntries(this.mode === 'manga') : [];
    if (this.sourceSwitchCandidate) {
      this.entries = this.entries.map((entry: LocalReadingTocEntry): LocalReadingTocEntry => ({
        index: entry.index, title: entry.title, level: entry.level, navigable: entry.navigable,
        downloadState: 'unknown',
      }));
    }
    this.currentChapterIndex = this.sourceSwitchCandidate ? -1 : 21;
    this.targetSelectionBusy = false;
    this.controlTab = 'directory';
    this.intentCount = 0;
    this.nextBookmarkTime = 1793671200000;
    this.navigationFactory = undefined;
    this.controlMinimumMeasurer = undefined; this.controlMinimumKey = ''; this.controlMinimumRevision += 1;
    if (this.admitted()) {
      const presentation = this.presentation, identity = this.identity();
      const port = new ReaderDirectoryFixturePort(identity.sourceId, identity.bookId,
        `${this.openingIdentity()}:${this.mode}`, (): LocalReadingTocEntry[] => this.entries,
        (): boolean => this.current(presentation),
        (kind: string, index: number): void => { if (this.current(presentation)) this.record(kind, index); }, this.flatCatalog, this.emptyRetry);
      this.fixturePort = port;
      this.navigationFactory = (): ReaderDirectoryFixturePort => {
        if (!this.current(presentation)) throw new Error('directory fixture factory has retired');
        return port;
      };
    }
    if (this.admitted()) this.record('mount');
  }

  private openingIdentity(): string { return `directory-fixture:${this.fixtureInstanceId}:${this.presentation}`; }

  private identity(): ReaderBookIdentity {
    const bookId = `${this.mode}:${this.fixtureInstanceId}:${this.presentation}`;
    return { sourceId: 'directory-native-fixture', bookId: bookId,
      libraryBookId: `directory-native-fixture:${bookId}`,
      bookName: '目录原生夹具 · 山海行记', bookAuthor: '内存样本' };
  }

  private memoryRecovery(): ReadingDirectoryRecovery {
    const identity = this.identity();
    return readingDirectoryRecovery(this.openingIdentity(), {
      sourceId: identity.sourceId, sourceName: '内存目录样本', bookId: identity.bookId,
      title: identity.bookName, author: identity.bookAuthor,
    }, undefined, undefined, this.admitted());
  }

  private current(presentation: number): boolean { return this.admitted() && presentation === this.presentation; }

  private record(kind: string, chapterIndex: number = -1): void {
    const observation: ReaderDirectoryFixtureObservation = { kind: kind, mode: this.mode, flatCatalog: this.flatCatalog,
      sourceSwitchCandidate: this.sourceSwitchCandidate, targetSelectionBusy: this.targetSelectionBusy,
      fixtureInstanceId: this.fixtureInstanceId, bookId: this.identity().bookId,
      viewId: `${this.openingIdentity()}:${this.mode}`,
      presentation: this.presentation, actualWidthVp: this.actualWidth, actualHeightVp: this.actualHeight,
      systemFontScale: readerWindowMetrics().systemFontScale,
      chapterIndex: chapterIndex, intentCount: this.intentCount,
      initialRequestedControlHeightVp: this.initialRequestedControlHeight(),
      requestedControlHeightVp: this.requestedControlHeight(),
      actualControlWidthVp: this.actualControlWidth, actualControlHeightVp: this.actualControlHeight };
    hilog.info(0x5244, 'ReaderDirectoryFixture', 'READER_DIRECTORY_FIXTURE %{public}s', JSON.stringify(observation));
  }

  private onMetricsChanged(): void { if (this.admitted()) this.record('system-metrics'); }

  private initialRequestedControlHeight(): number {
    if (this.mode !== 'control' || !this.controlExpanded || !this.admitted()) return 0;
    return this.controlViewportHeight === 122 || this.controlViewportHeight === 168 || this.controlViewportHeight === 190 ?
      this.controlViewportHeight : 0;
  }

  private requestedControlHeight(): number {
    const initial = this.initialRequestedControlHeight();
    if (initial === 0) return 0;
    return this.localControlViewportHeight === 122 || this.localControlViewportHeight === 168 ||
      this.localControlViewportHeight === 190 || this.localControlViewportHeight === 320 ? this.localControlViewportHeight : initial;
  }

  private controlHeight(): number {
    const requested = this.requestedControlHeight();
    return requested > 0 ? requested : this.controlFrame().content.height;
  }

  private controlLeft(): number {
    return this.actualWidth - this.controlLayout().fullPanelRightGap - this.controlLayout().fullPanelWidth + this.controlFrame().content.x;
  }

  private controlTop(): number {
    return this.controlLayout().viewportHeight - this.controlLayout().dockBottomGap - this.controlFrame().shell.height +
      this.controlFrame().content.y - this.controlFrame().shell.y;
  }

  private viewportHudFontScale(): number {
    // Bind these diagnostic budgets to the existing published metrics owner.
    const _revision = this.windowMetricsRevision;
    return readerReadableFontScale(readerWindowMetrics().systemFontScale);
  }

  private viewportHudButtonWidth(): number {
    return Math.max(56, 24 * this.viewportHudFontScale() + 12);
  }

  private viewportHudHeight(): number {
    return Math.max(44, 18 * this.viewportHudFontScale() + 8);
  }

  private viewportHudWidth(): number { return this.viewportHudButtonWidth() * 4 + 24; }

  private viewportHudVisible(): boolean {
    if (this.initialRequestedControlHeight() === 0 || !(this.actualWidth > 0) || !(this.actualHeight > 0)) return false;
    const layout = this.controlLayout(), top = layout.topBarTop, bottom = top + this.viewportHudHeight();
    return this.controlFrame().content.width >= this.viewportHudWidth() && top >= 0 &&
      bottom + 8 <= this.controlTop() && bottom <= layout.viewportHeight - layout.dockBottomGap;
  }

  private changeControlViewport(presentation: number, height: number): void {
    if (!this.current(presentation) || !this.viewportHudVisible() ||
      (height !== 122 && height !== 168 && height !== 190 && height !== 320)) return;
    if (height === this.requestedControlHeight()) return;
    this.localControlViewportHeight = height;
    this.record('control-viewport-request');
  }

  private measureControl(presentation: number, area: Area): void {
    if (!this.current(presentation) || this.mode !== 'control') return;
    const width = readerPageAreaLength(area.width), height = readerPageAreaLength(area.height);
    if (!(width > 0) || !(height > 0) || !Number.isFinite(width) || !Number.isFinite(height) ||
      (width === this.actualControlWidth && height === this.actualControlHeight)) return;
    this.actualControlWidth = width; this.actualControlHeight = height;
    this.record('actual-control-area');
    this.refreshControlMinimum();
  }

  private admitControlMinimum(presentation: number, identity: string,
    measurer: ReaderControlModuleMeasurer | undefined): void {
    if (!this.current(presentation) || identity !== `${this.openingIdentity()}:${this.controlTab}`) return;
    if (this.controlMinimumMeasurer === measurer) return;
    this.controlMinimumMeasurer = measurer;
    this.controlMinimumRevision += 1;
    this.refreshControlMinimum();
  }

  private refreshControlMinimum(): void {
    if (!this.admitted() || this.mode !== 'control' || this.controlMinimumMeasurer === undefined || this.actualControlWidth <= 0) return;
    const key = `${this.openingIdentity()}:${this.controlTab}:${this.controlMinimumRevision}|${this.actualControlWidth}`;
    if (key === this.controlMinimumKey) return;
    const minimum = this.controlMinimumMeasurer({ panelWidthVp: this.actualControlWidth,
      quickContentWidthVp: this.actualControlWidth, fullContentWidthVp: this.actualControlWidth }, key);
    if (minimum !== undefined) this.controlMinimumKey = key;
  }

  private measure(area: Area): void {
    if (!this.admitted()) return;
    const width = readerPageAreaLength(area.width), height = readerPageAreaLength(area.height);
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return;
    if (Math.abs(width - this.actualWidth) < .01 && Math.abs(height - this.actualHeight) < .01) return;
    this.actualWidth = width; this.actualHeight = height;
    this.record('actual-area');
  }

  private intent(presentation: number, kind: string, chapterIndex: number = -1): void {
    if (!this.current(presentation)) return;
    const entry = this.entries.find((candidate: LocalReadingTocEntry): boolean => candidate.index === chapterIndex);
    if (chapterIndex >= 0 && (entry === undefined || entry.navigable === false)) return;
    this.intentCount += 1;
    if (kind === 'select-chapter' || kind === 'select-bookmark') this.currentChapterIndex = chapterIndex;
    if (kind === 'download-chapter' && entry !== undefined) {
      this.entries = this.entries.map((candidate: LocalReadingTocEntry): LocalReadingTocEntry =>
        {
        if (candidate.index !== chapterIndex) return candidate;
        const copy = readerDirectoryFixtureCopyEntry(candidate); copy.downloadState = 'queued'; return copy;
      });
    }
    if (kind === 'download-book' || kind === 'clear-offline') {
      this.entries = this.entries.map((candidate: LocalReadingTocEntry): LocalReadingTocEntry =>
        {
        if (candidate.navigable === false) return candidate;
        const copy = readerDirectoryFixtureCopyEntry(candidate); copy.downloadState = kind === 'download-book' ? 'queued' : 'missing'; return copy;
      });
    }
    this.record(kind, chapterIndex);
    this.onAction(kind, chapterIndex);
  }

  private leave(presentation: number): void {
    if (!this.current(presentation)) return;
    this.record('back');
    this.onBack();
  }

  private selectSourceSwitchTarget(presentation: number, chapterIndex: number): void {
    if (!this.current(presentation) || !this.sourceSwitchCandidate || this.targetSelectionBusy) return;
    const entry = this.entries.find((candidate: LocalReadingTocEntry): boolean => candidate.index === chapterIndex);
    if (entry === undefined || entry.navigable === false) return;
    this.targetSelectionBusy = true;
    this.intentCount += 1;
    this.record('select-target-chapter', chapterIndex);
    this.onAction('select-target-chapter', chapterIndex);
  }

  private deleteBookmarks(presentation: number, times: number[]): void {
    if (!this.current(presentation)) return;
    this.entries = this.entries.map((entry: LocalReadingTocEntry): LocalReadingTocEntry =>
      { const copy = readerDirectoryFixtureCopyEntry(entry);
        copy.bookmarks = entry.bookmarks?.filter((bookmark): boolean => !times.includes(bookmark.time)); return copy; });
    this.intent(presentation, 'delete-bookmarks');
  }

  private createBookmark(presentation: number, request: ReaderDirectoryChapterStartBookmarkRequest): void {
    if (!this.current(presentation)) return;
    const entry = this.entries.find((candidate: LocalReadingTocEntry): boolean => candidate.index === request.chapterIndex);
    if (entry === undefined || entry.navigable === false || request.chapterTitle !== entry.title) return;
    const time = this.nextBookmarkTime++;
    this.entries = this.entries.map((candidate: LocalReadingTocEntry): LocalReadingTocEntry =>
      {
        if (candidate.index !== entry.index) return candidate;
        const copy = readerDirectoryFixtureCopyEntry(candidate);
        copy.bookmarks = (copy.bookmarks ?? []).concat([{ time: time, chapterIndex: entry.index, chapterOffset: 0,
          chapterTitle: entry.title, content: '内存章首书签', bookText: 'Fixture only; no persistence.' }]);
        return copy;
      });
    this.intent(presentation, 'create-bookmark', entry.index);
  }

  private controlLayout(): ReaderControlLayoutSnapshot {
    const metrics = readerWindowMetrics();
    return resolveReaderControlLayout(this.actualWidth, this.actualHeight, false, metrics);
  }

  private controlFrame(): ReaderControlMotionFrame {
    const layout = this.controlLayout(), expanded = layout.widthClass === 'expanded';
    const fullHeight = Math.min(Math.max(0, layout.fullPanelHeight), expanded ? 852 : 736);
    const quickHeight = Math.min(fullHeight, new ReaderControlGeometry(expanded).sheetH);
    return sampleReaderControlMotionComposition(
      { visibilityProgress: 1, expansionProgress: this.controlExpanded ? 1 : 0 },
      readerControlMotionBounds(layout.fullPanelWidth, fullHeight, layout.dockBottomGap, quickHeight, layout.contentBudget));
  }

  @Builder
  private textContent(presentation: number) {
    ReaderFullDirectory({ bookTitle: '目录原生夹具 · 山海行记',
      chapterTitle: this.entries[this.currentChapterIndex]?.title ?? '',
      catalogContext: this.catalogContext, sourceId: this.identity().sourceId, bookId: this.identity().bookId,
      isOpeningCurrent: (): boolean => this.current(presentation),
      bookmarkIdentity: this.identity(), navigationPortFactory: this.navigationFactory,
      directoryRecovery: this.memoryRecovery(),
      entries: this.entries, currentChapterIndex: this.currentChapterIndex,
      chapterStartBookmarkCreationEnabled: true,
      onSelectChapter: (index: number): void => this.intent(presentation, 'select-chapter', index),
      onSelectNavigationTarget: (index: number): void => this.intent(presentation, 'select-chapter', index),
      onSelectBookmark: (_id: string, index: number): void => this.intent(presentation, 'select-bookmark', index),
      onDownloadChapter: (index: number): void => this.intent(presentation, 'download-chapter', index),
      onDownloadBook: (): void => this.intent(presentation, 'download-book'),
      onClearBookOffline: (): void => this.intent(presentation, 'clear-offline'),
      onDeleteBookmarks: (times: number[]): void => this.deleteBookmarks(presentation, times),
      onCreateChapterStartBookmark: (request: ReaderDirectoryChapterStartBookmarkRequest): void => this.createBookmark(presentation, request),
      onRetryCatalog: (): void => this.intent(presentation, 'retry-catalog'),
      onSwitchSource: (): void => this.intent(presentation, 'switch-source'),
      onExit: (): void => this.leave(presentation) });
  }

  @Builder
  private sourceSwitchContent(presentation: number) {
    BookDirectoryPage({ sourceId: this.identity().sourceId, bookId: this.identity().bookId,
      navigationPortFactory: this.navigationFactory, isOpeningCurrent: (): boolean => this.current(presentation),
      bookTitle: '目录原生夹具 · 山海画卷', entries: this.entries,
      currentChapterIndex: -1, currentPageOrdinal: -1, currentPageTotal: -1,
      catalogMessage: '请选择目标章节继续换源', selectionBusy: this.targetSelectionBusy,
      onSelectChapter: (index: number): void => this.selectSourceSwitchTarget(presentation, index),
      onSelectNavigationTarget: (index: number): void => this.selectSourceSwitchTarget(presentation, index),
      onBack: (): void => this.leave(presentation) });
  }

  @Builder
  private mangaContent(presentation: number) {
    BookDirectoryPage({ sourceId: this.identity().sourceId, bookId: this.identity().bookId,
      navigationPortFactory: this.navigationFactory, isOpeningCurrent: (): boolean => this.current(presentation),
      bookTitle: '目录原生夹具 · 山海画卷', entries: this.entries,
      currentChapterIndex: this.currentChapterIndex, currentPageOrdinal: 7, currentPageTotal: 24,
      mangaDownloadEnabled: true,
      onLoadDownloadActions: async (index?: number): Promise<MangaDownloadAction[]> => {
        if (!this.current(presentation)) return [];
        this.record('download-menu', index ?? -1);
        return [{ id: index === undefined ? 'downloadBook' : 'downloadChapter', label: index === undefined ? '下载全部章节' : '下载本话' },
          { id: 'clearCache', label: '清除普通阅读缓存' }];
      },
      onDownloadAction: async (action: MangaDownloadActionId, index?: number): Promise<void> => {
        this.intent(presentation, action === 'downloadBook' ? 'download-book' : action === 'clearCache' ? 'clear-offline' : 'download-chapter', index ?? -1);
      },
      onSelectChapter: (index: number): void => this.intent(presentation, 'select-chapter', index),
      onSelectNavigationTarget: (index: number): void => this.intent(presentation, 'select-chapter', index),
      onRetryCatalog: (): void => this.intent(presentation, 'retry-catalog'),
      onBack: (): void => this.leave(presentation) });
  }

  @Builder
  private controlContent(presentation: number) {
    ReaderControlDirectoryContent({
      minimumIdentity: `${this.openingIdentity()}:${this.controlTab}`,
      minimumKey: this.controlMinimumKey,
      onMinimumMeasurerReady: (identity: string, measurer: ReaderControlModuleMeasurer | undefined): void =>
        this.admitControlMinimum(presentation, identity, measurer),
      entries: this.entries, currentChapterIndex: this.currentChapterIndex,
      bookmarkIdentity: this.identity(), navigationPortFactory: this.navigationFactory,
      bookmarkRecovery: this.memoryRecovery(),
      catalogComplete: true, catalogChapterCount: this.entries.length,
      catalogReadableChapterCount: this.entries.length, catalogReadablePosition: this.currentChapterIndex,
      progress: this.controlExpanded ? 1 : 0, interactionEnabled: true,
      availableWidth: this.controlFrame().content.width, availableHeight: this.controlHeight(),
      tab: this.controlTab, sessionKey: this.openingIdentity(),
      chapterDownloadEnabled: true, chapterStartBookmarkCreationEnabled: true,
      onTabChange: (tab: string): void => {
        if (!this.current(presentation)) return;
        this.controlTab = tab === 'bookmarks' ? 'bookmarks' : 'directory';
        this.intent(presentation, 'tab');
      },
      onSelectChapter: (index: number): void => this.intent(presentation, 'select-chapter', index),
      onSelectNavigationTarget: (index: number): void => this.intent(presentation, 'select-chapter', index),
      onSelectBookmark: (_id: string, index: number): void => this.intent(presentation, 'select-bookmark', index),
      onDownloadChapter: (index: number): void => this.intent(presentation, 'download-chapter', index),
      onDeleteBookmarks: (times: number[]): void => this.deleteBookmarks(presentation, times),
      onCreateChapterStartBookmark: (request: ReaderDirectoryChapterStartBookmarkRequest): void => this.createBookmark(presentation, request),
      onRequireCompleteCatalog: (): void => this.intent(presentation, 'require-catalog'),
      onRetryBookmarkLoad: (): void => this.intent(presentation, 'retry-bookmarks') })
      .width(this.controlFrame().content.width).height(this.controlHeight())
      .onAreaChange((_previous: Area, area: Area): void => this.measureControl(presentation, area))
      .position({ x: this.controlLeft(), y: this.controlTop() });
  }

  @Builder
  private viewportHud(presentation: number) {
    Row({ space: 8 }) {
      ForEach([122, 168, 190, 320], (height: number): void => {
        Text(height.toString()).fontSize(12).textAlign(TextAlign.Center)
          .width(this.viewportHudButtonWidth()).height(this.viewportHudHeight())
          .fontColor('#FFFFFF').backgroundColor('#3A3A3A').borderRadius(6)
          .focusable(false).focusOnTouch(false)
          .id(`reader-directory-viewport-${height}`)
          .accessibilityText(`Debug directory viewport ${height}vp`)
          .onClick((): void => this.changeControlViewport(presentation, height));
      }, (height: number): string => height.toString());
    }.width(this.viewportHudWidth()).height(this.viewportHudHeight())
      .focusable(false).focusOnTouch(false)
      .position({ x: this.controlLeft(), y: this.controlLayout().topBarTop });
  }

  build() {
    Stack({ alignContent: Alignment.TopStart }) {
      if (this.admitted()) {
        ForEach([this.presentation], (presentation: number): void => {
          if (this.mode === 'text') this.textContent(presentation);
          else if (this.mode === 'control') {
            this.controlContent(presentation);
            if (this.viewportHudVisible()) this.viewportHud(presentation);
          }
          else if (this.mode === 'manga') {
            if (this.sourceSwitchCandidate) this.sourceSwitchContent(presentation);
            else this.mangaContent(presentation);
          }
        }, (presentation: number): string => presentation.toString());
      }
    }.width('100%').height('100%')
      .onAreaChange((_previous: Area, current: Area): void => this.measure(current));
  }
}
