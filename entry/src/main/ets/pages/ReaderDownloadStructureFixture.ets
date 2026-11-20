// DEBUG component fixture only: no Runtime/Host, user shelf or file/network port.
import { DEBUG, BUILD_MODE_NAME } from '../../../../build/default/generated/profile/default/BuildProfile';
import { hilog } from '@kit.PerformanceAnalysisKit';
import { SharedDownloadPage } from '../features/downloads/SharedDownloadPage';
import type { SharedDownloadUiIntent, SharedDownloadUiBookTarget, SharedDownloadViewState } from '../features/downloads/SharedDownloadPage';
import type { DownloadBookView, DownloadChapterView, DownloadContentKind, DownloadReadingTarget,
  DownloadStorageSummary, DownloadStoragePolicyView } from '../features/downloads/SharedDownloadProjection';
import { createDownloadBookView, projectDownloadBookAvailability, downloadChapterStateLabel } from '../features/downloads/SharedDownloadProjection';
import type { LocalReadingDownloadState } from '../features/reading/LocalReadingFlowGateway';
import { prepareSharedDownloadFonts } from '../features/common/ReaderFonts';
import { ReaderPageState } from '../features/common/ReaderPageState';
import { readerPageAreaLength } from '../features/common/ReaderPageShell';
import { ReaderWindowCoordinator } from '../app/ReaderWindowCoordinator';

interface DownloadFixtureObservation {
  kind: string;
  generation: number;
  actualWidthVp: number;
  actualHeightVp: number;
  systemFontScale: number;
  intentCount: number;
}

@Component
export struct ReaderDownloadStructureFixture {
  @Prop @Watch('onParentFontsChanged') fontsReady: boolean = false;
  onBack: () => void = (): void => {};
  onAction: (kind: string) => void = (_kind: string): void => {};
  onTemporaryBackBridge: (handler: (() => boolean) | undefined, identity: string) => void =
    (_handler: (() => boolean) | undefined, _identity: string): void => {};
  @StorageLink('readerWindowMetricsRevision') @Watch('onMetricsChanged') private metricsRevision: number = 0;
  @State private fixtureGeneration: number = 0;
  @State private downloadFontsReady: boolean = false;
  @State private fontFailed: boolean = false;
  @State private books: DownloadBookView[] = [];
  @State private storagePolicy: DownloadStoragePolicyView = { capacityBytes: 2147483648, expiryDays: 7 };
  private storageSummary: DownloadStorageSummary = { totalBytes: 251658240, retainedBytes: 167772160,
    automaticBytes: 83886080, cleanableBytes: 41943040, availableBytes: 2147483648 };
  private mounted: boolean = false;
  private fontAttempt: number = 0;
  private intentCount: number = 0;
  private actualWidth: number = 0;
  private actualHeight: number = 0;
  private childBack: (() => boolean) | undefined;
  private childBackIdentity: string = '';
  private publishedBackIdentity: string = '';
  private lastViewState: SharedDownloadViewState | undefined;

  aboutToAppear(): void {
    this.mounted = true;
    this.fixtureGeneration += 1;
    this.books = this.createBooks();
    this.storagePolicy = { capacityBytes: 2147483648, expiryDays: 7 };
    void this.prepareFonts();
  }

  aboutToDisappear(): void {
    this.clearBackBridge();
    this.mounted = false;
    this.fontAttempt += 1;
    this.fixtureGeneration += 1;
    this.downloadFontsReady = false;
  }

  private debugBuild(): boolean { return DEBUG === true && BUILD_MODE_NAME === 'debug'; }

  private active(generation: number): boolean {
    return this.mounted && this.debugBuild() && this.fontsReady && generation === this.fixtureGeneration;
  }

  private current(generation: number): boolean { return this.active(generation) && this.downloadFontsReady; }

  private onParentFontsChanged(): void {
    this.clearBackBridge();
    this.fixtureGeneration += 1;
    void this.prepareFonts();
  }

  private async prepareFonts(): Promise<void> {
    const attempt = ++this.fontAttempt;
    const generation = this.fixtureGeneration;
    this.downloadFontsReady = false;
    this.fontFailed = false;
    if (!this.active(generation)) return;
    try {
      const ready = await prepareSharedDownloadFonts();
      if (!this.active(generation) || attempt !== this.fontAttempt) return;
      this.downloadFontsReady = ready === true;
      this.fontFailed = ready !== true;
      this.record(ready === true ? 'fonts-checked' : 'fonts-not-ready');
    } catch (error) {
      if (!this.active(generation) || attempt !== this.fontAttempt) return;
      this.fontFailed = true;
      this.record('fonts-failed');
    }
  }

  private createBooks(): DownloadBookView[] {
    const result: DownloadBookView[] = [];
    const queueStates: LocalReadingDownloadState[] = ['completed', 'missing', 'queued', 'paused',
      'inProgress', 'cached', 'failed', 'cancelled', 'unknown'];
    for (let bookIndex = 0; bookIndex < 12; bookIndex += 1) {
      const kind: DownloadContentKind = bookIndex % 2 === 0 ? 'novel' : 'manga';
      const sourceId = `fixture-download-${bookIndex % 3}.example.invalid`;
      const bookId = `memory-book-${bookIndex}`;
      const title = `${bookIndex + 1} · ${kind === 'novel' ? '长篇小说 · 山海之间与非常漫长的旅程' : '漫画 · 星海旅行与长标题章节'} / Long Memory Fixture Title`;
      const view = createDownloadBookView({ sourceId, sourceName: '内存夹具书源', bookId,
        title, author: 'Fixture · 测试作者', contentKind: kind === 'manga' ? 'manga' : 'text',
        addedAt: bookIndex + 1, lastReadAt: bookIndex + 2,
        readingPosition: { chapterIndex: 2, chapterOffset: 0, updatedAt: 1 } });
      const chapters: DownloadChapterView[] = [];
      for (let index = 0; index < 18; index += 1) {
        const state: LocalReadingDownloadState = bookIndex === 0 ? 'completed' :
          bookIndex === 1 ? 'missing' : queueStates[index % queueStates.length];
        const complete = state === 'completed' || state === 'cached';
        chapters.push({ key: JSON.stringify([sourceId, bookId, index]), sourceId, bookId, index,
          title: `第${index + 1}章 · ${index % 3 === 0 ? '很长的中文章节标题与 English Chapter Description' : '内存章节'}`,
          chapterId: `fixture-chapter-${index}`, navigable: true, localComplete: complete,
          stateLabel: downloadChapterStateLabel(state, complete), queueState: state,
          cachedBytes: kind === 'novel' && complete ? 8192 : undefined,
          mangaManifestVersion: kind === 'manga' ? 'fixture-v1' : undefined,
          mangaTotalPages: kind === 'manga' ? 12 : undefined,
          mangaSavedPages: kind === 'manga' ? complete ? 12 : 3 : undefined });
      }
      result.push(projectDownloadBookAvailability(view, chapters, chapters.length,
        kind === 'novel' ? chapters.filter((chapter: DownloadChapterView): boolean => chapter.localComplete).length * 8192 : undefined));
    }
    return result;
  }

  private record(kind: string): void {
    const observation: DownloadFixtureObservation = { kind, generation: this.fixtureGeneration,
      actualWidthVp: this.actualWidth, actualHeightVp: this.actualHeight,
      systemFontScale: ReaderWindowCoordinator.metrics().systemFontScale, intentCount: this.intentCount };
    hilog.info(0x5244, 'ReaderPageStructure', 'READER_DOWNLOAD_FIXTURE %{public}s', JSON.stringify(observation));
  }

  private recordAction(generation: number, kind: string): void {
    if (!this.current(generation)) return;
    this.intentCount += 1;
    this.record(kind);
    this.onAction(`download-fixture:${kind}`);
  }

  private intent(generation: number, intent: SharedDownloadUiIntent): void {
    if (!this.current(generation)) return;
    if (intent.books.some((target: SharedDownloadUiBookTarget): boolean => !this.books.some((book: DownloadBookView): boolean =>
      book.sourceId === target.sourceId && book.bookId === target.bookId && (target.chapterIndices === undefined ||
        target.chapterIndices.every((index: number): boolean => book.chapters.some((chapter: DownloadChapterView): boolean => chapter.index === index)))))) return;
    if (intent.action === 'configureStorage' && intent.cacheLimitMb !== undefined && intent.cleanupAfterDays !== undefined &&
      Number.isFinite(intent.cacheLimitMb) && intent.cacheLimitMb >= 0 && Number.isSafeInteger(intent.cleanupAfterDays) && intent.cleanupAfterDays > 0) {
      this.storagePolicy = { capacityBytes: Math.round(intent.cacheLimitMb * 1024 * 1024), expiryDays: intent.cleanupAfterDays };
    }
    // No queue/file/retention owner is called, even for destructive captions.
    this.recordAction(generation, `intent-${intent.action}-${intent.scope}`);
  }

  private openBook(generation: number, book: DownloadBookView): void {
    if (!this.books.some((candidate: DownloadBookView): boolean => candidate.key === book.key &&
      candidate.sourceId === book.sourceId && candidate.bookId === book.bookId)) return;
    this.recordAction(generation, 'open-book');
  }

  private readTarget(generation: number, target: DownloadReadingTarget): void {
    if (!this.books.some((book: DownloadBookView): boolean => book.sourceId === target.sourceId && book.bookId === target.bookId &&
      (target.chapterIndex === undefined || book.chapters.some((chapter: DownloadChapterView): boolean =>
        chapter.index === target.chapterIndex && chapter.chapterId === target.chapterId)))) return;
    this.recordAction(generation, 'read-target');
  }

  private viewChanged(generation: number, state: SharedDownloadViewState): void {
    if (!this.current(generation)) return;
    this.lastViewState = { query: state.query, type: state.type, state: state.state, sourceId: state.sourceId,
      sort: state.sort, direction: state.direction, detailKey: state.detailKey,
      listScroll: state.listScroll, chapterScroll: state.chapterScroll };
    this.record('view-state');
  }

  private clearBackBridge(): void {
    const published = this.publishedBackIdentity;
    this.childBack = undefined; this.childBackIdentity = ''; this.publishedBackIdentity = '';
    if (published.length > 0) this.onTemporaryBackBridge(undefined, published);
  }

  private bindBack(generation: number, handler: (() => boolean) | undefined, identity: string): void {
    if (!this.current(generation)) return;
    if (handler === undefined) {
      if (identity === this.childBackIdentity) this.clearBackBridge();
      return;
    }
    this.clearBackBridge();
    this.childBack = handler; this.childBackIdentity = identity;
    this.publishedBackIdentity = `download-fixture-${generation}:${identity}`;
    this.onTemporaryBackBridge((): boolean => this.consumeBack(generation), this.publishedBackIdentity);
  }

  private consumeBack(generation: number = this.fixtureGeneration): boolean {
    return this.current(generation) && this.childBack !== undefined ? this.childBack() : false;
  }

  private back(generation: number): void {
    if (!this.current(generation) || this.consumeBack(generation)) return;
    this.recordAction(generation, 'back-to-menu');
    this.onBack();
  }

  private observeArea(generation: number, area: Area): void {
    if (!this.current(generation)) return;
    const width = readerPageAreaLength(area.width), height = readerPageAreaLength(area.height);
    if (!Number.isFinite(width) || width <= 0 || !Number.isFinite(height) || height <= 0 ||
      (width === this.actualWidth && height === this.actualHeight)) return;
    this.actualWidth = width; this.actualHeight = height;
    this.record('actual-area');
  }

  private onMetricsChanged(): void { if (this.current(this.fixtureGeneration)) this.record('window-metrics'); }

  @Builder
  private fontPreparationState() {
    ReaderPageState({ title: !this.debugBuild() ? '当前构建不提供组件验证' :
      this.fontFailed ? '下载字体准备失败' : '生产字体准备中',
      loading: this.debugBuild() && !this.fontFailed,
      actionLabel: this.debugBuild() && this.fontFailed ? '重试字体准备' : '',
      onAction: (): void => { if (this.mounted && this.debugBuild()) void this.prepareFonts(); } });
  }

  build() {
    if (this.current(this.fixtureGeneration)) {
      ForEach([this.fixtureGeneration], (generation: number): void => {
        SharedDownloadPage({ books: this.books, storageSummary: this.storageSummary,
          storagePolicy: this.storagePolicy, loading: false, error: '', pendingMessage: '',
          presentationIdentity: `download-fixture-${generation}`,
          onBack: (): void => this.back(generation),
          onRefresh: (): void => this.recordAction(generation, 'refresh'),
          onOpenBook: (book: DownloadBookView): void => this.openBook(generation, book),
          onIntent: (intent: SharedDownloadUiIntent): void => this.intent(generation, intent),
          onReadTarget: (target: DownloadReadingTarget): void => this.readTarget(generation, target),
          onViewStateChanged: (state: SharedDownloadViewState): void => this.viewChanged(generation, state),
          onTemporaryBackBridge: (handler: (() => boolean) | undefined, identity: string): void => this.bindBack(generation, handler, identity),
        }).width('100%').height('100%').id('reader-download-structure-fixture')
          .onAreaChange((_old: Area, area: Area): void => this.observeArea(generation, area));
      }, (generation: number): string => `download-fixture-${generation}`);
    } else { this.fontPreparationState(); }
  }
}
