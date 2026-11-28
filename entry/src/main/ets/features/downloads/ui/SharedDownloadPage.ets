import { readerLayoutCarrierResponseRegion } from '../../../ui/layout/ReaderPageNativeAttributes';
import hilog from '@ohos.hilog';
import inputMethod from '@ohos.inputMethod';
import type { ReaderRecoveryView } from '../../../ui/feedback/ReaderRecoveryView';
import { ReaderTransientFeedback, READER_FEEDBACK_BRIEF_MS } from '../../../ui/feedback/ReaderTransientFeedback';
import { consumeReaderControlKeyboardBack } from '../../../ui/foundation/ReaderKeyboardBack';
import { ReaderPageState } from '../../../ui/feedback/ReaderPageState';
import { readerAppColor } from '../../../ui/foundation/ReaderThemeRegistry';
import { ReaderFrameStyle, readerFrameStyle } from '../../../ui/layout/ReaderFrameStyle';
import { ReaderScrollLayout, readerScrollLayout } from '../../../ui/layout/ReaderScrollLayout';
import { ReaderPageScaffold } from '../../../ui/layout/ReaderPageScaffold';
import { DOWNLOAD_HEADER_HEIGHT } from '../../../ui/foundation/ReaderHeaderMetrics';
import { ReaderRaisedShape, resolveReaderRaisedShape } from '../../../ui/layout/ReaderRaisedShape';
import { readerPageAreaLength, readerPresentedHeaderBottom } from '../../../ui/layout/ReaderPageShell';
import { ReaderMeasurementStore } from '../../../ui/layout/ReaderMeasurements';
import { ReaderPageGeometry, ReaderPageGeometryInput, applyReaderStandardFloatingHeader, readerPageSafeLeft, readerPageSafeRight, resolveReaderPageGeometry } from '../../../ui/layout/ReaderPageGeometry';
import { prepareSharedDownloadFonts } from '../../../ui/foundation/ReaderFonts';
import { DOWNLOAD_VISUAL, downloadVisualColor, sharedDownloadContentInsets } from './SharedDownloadVisualSpec';
import { TYPE_DOWNLOAD_CONTROL, TYPE_DOWNLOAD_META, TYPE_DOWNLOAD_TAG, TYPE_DOWNLOAD_BOOK_TITLE, TYPE_DOWNLOAD_CHAPTER_TITLE } from './DownloadTypography';
import { ReaderWindowCoordinator } from '../../../app/ReaderWindowCoordinator';
import { ReaderWindowMetricsSnapshot, readerStableInteractiveSafeBottom } from '../../../ui/foundation/ReaderWindowMetrics';
import type { DownloadBookView, DownloadChapterView, SharedDownloadFilters, DownloadReadingTarget, DownloadStorageSummary, DownloadStoragePolicyView } from '../presentation/SharedDownloadProjection';
import { type ReaderNavigationPreferences } from '../../../app/HarmonyCapabilityPolicy';
import { defaultNavigationPreferences } from '../../../ui/surfaces/ReaderSurfaceMaterial';
import { readerSurfaceElevation } from '../../../ui/surfaces/ReaderSurfaceSpecs';
import { readerAvailableWindowHeight } from '../../../ui/foundation/ReaderSurfaceResolvers';
import type { SharedDownloadReadingControl, SharedDownloadReadingFocus, SharedDownloadUiAction, SharedDownloadUiIntent, SharedDownloadViewState } from '../presentation/SharedDownloadUiContract';
import type { SharedDownloadExpectedChapter } from '../application/SharedDownloadCoordinator';
import { SharedDownloadBookList, SharedDownloadBookListOwner, SharedDownloadBookListPaint, SharedDownloadIdleFrame,
  SharedDownloadHeader, SharedDownloadManageHeaderAction, SharedDownloadSelectionDock,
  sharedDownloadChapterUnit, sharedDownloadFocusKey, sharedDownloadFontScale, sharedDownloadControlHeight,
  type SharedDownloadFrameView, type SharedDownloadBookListView, type SharedDownloadFilterField, type DownloadChoice } from './SharedDownloadBookList';
import { SharedDownloadChapterList, SharedDownloadChapterListOwner, SharedDownloadChapterListPaint,
  type SharedDownloadChapterListView } from './SharedDownloadChapterList';
import { SharedDownloadSheets, SharedDownloadSheetsOwner, SharedDownloadSheetsPaint, DownloadOperationsHeader,
  DownloadOperationsBody, DownloadStorageCleanupIcon, DownloadConfirmationSurface, DownloadConfirmationSurfaceBody,
  type SharedDownloadSheetsView } from './SharedDownloadSheets';

/** Native implementation of the user-approved shared-download-demo.html layout. */
@Component
export struct SharedDownloadPage {

  @Prop embeddedWide: boolean = false;
  private readonly transientFeedback: ReaderTransientFeedback = new ReaderTransientFeedback();
  @StorageProp('readerAppScheme') @Watch('syncOverlayChrome') private appThemeScheme: string = 'day';
  @StorageProp('readerSystemScheme') @Watch('syncOverlayChrome') private systemScheme: string = 'day';
  @StorageProp('readerNavigationAppearancePreferences') @Watch('syncOverlayChrome')
  private appearancePreferences: ReaderNavigationPreferences = defaultNavigationPreferences();
  @StorageProp('readerAppForeground') @Watch('onInputEligibilityChanged') private appForeground: boolean = true;
  @StorageProp('readerWindowMetricsRevision') @Watch('onListGeometryChanged') private readerWindowMetricsRevision: number = 0;
  @Prop @Watch('onBooksChanged') books: DownloadBookView[] = [];
  @Prop storageSummary: DownloadStorageSummary = {};
  @Prop storagePolicy: DownloadStoragePolicyView | undefined = undefined;
  @Prop storagePolicyBusy: boolean = false;
  @Prop storageCleanupBusy: boolean = false;
  @Prop @Watch('onLoadingChanged') loading: boolean = false;
  @Prop reduceMotion: boolean = false;
  @Prop @Watch('onInputEligibilityChanged') covered: boolean = false;
  @Prop @Watch('onErrorChanged') error: string = '';
  @Prop batchRecovery: ReaderRecoveryView = { message: '', visible: false, canRetry: false, generation: 0 };
  @Prop @Watch('onPresentationIdentityChanged') presentationIdentity: string = '';
  @Prop initialViewState: SharedDownloadViewState = {
    query: '', type: 'all', state: 'all', sourceId: 'all', sort: 'recent', direction: 'desc',
  };

  isOpeningCurrent: (() => boolean) | undefined = undefined;

  takeReadingFocus: () => SharedDownloadReadingFocus | undefined = (): SharedDownloadReadingFocus | undefined => undefined;
  onViewStateChanged: (state: SharedDownloadViewState) => void = (_state: SharedDownloadViewState): void => {};
  onBack: () => void = (): void => {};
  onRefresh: () => void = (): void => {};
  onRefreshBatchRecovery: (generation: number) => void = (_generation: number): void => {};
  onRefreshStorage: () => void = (): void => {};
  onOpenBook: (book: DownloadBookView) => void = (_book: DownloadBookView): void => {};
  onIntent: (intent: SharedDownloadUiIntent) => void = (_intent: SharedDownloadUiIntent): void => {};
  onReadTarget: (target: DownloadReadingTarget, current: () => boolean, control: SharedDownloadReadingControl) => void =
    (_target: DownloadReadingTarget, _current: () => boolean, _control: SharedDownloadReadingControl): void => {};
  onTemporaryBackBridge: (handler: (() => boolean) | undefined, identity: string, blocksSettingsSwitch?: () => boolean) => void =
    (_handler: (() => boolean) | undefined, _identity: string): void => {};
  @State @Watch('onListFilterChanged') private query: string = '';
  @State @Watch('onListFilterChanged') private bookType: string = 'all';
  @State @Watch('onListFilterChanged') private stateFilter: string = 'all';
  @State @Watch('onListFilterChanged') private sourceFilter: string = 'all';
  @State @Watch('onListFilterChanged') private sortField: string = 'recent';
  @State @Watch('onListFilterChanged') private sortDirection: string = 'desc';
  @State @Watch('onDetailChanged') private detailKey: string = '';
  @State private managing: boolean = false;
  @State private managementGeneration: number = 0;
  @State @Watch('onSheetChanged') private sheet: string = '';
  @State @Watch('onConfirmationChanged') private confirmation: string = '';
  @State private fontsReady: boolean = false;
  @State private fontsFailed: boolean = false;
  @State @Watch('onListGeometryChanged') private pageWidth: number = 0;
  @State private pageOriginX: number = 0;
  @State private pageOriginY: number = 0;
  @State @Watch('onListGeometryChanged') private pageHeight: number = 0;
  @State private measurementRevision: number = 0;
  @State private storageDockShape: ReaderRaisedShape | undefined = undefined;
  @State private selectionDockShape: ReaderRaisedShape | undefined = undefined;
  private readonly measurements: ReaderMeasurementStore = new ReaderMeasurementStore();
  private mountedIdentity: string = '';
  private mounted: boolean = false;
  private fontPreparationGeneration: number = 0;
  private presentationGeneration: number = 0;
  private managingTriggerKey: string = 'manage';
  private focusGeneration: number = 0;
  @State private bookPaint: SharedDownloadBookListPaint = new SharedDownloadBookListPaint();
  @State private chapterPaint: SharedDownloadChapterListPaint = new SharedDownloadChapterListPaint();
  @State private sheetsPaint: SharedDownloadSheetsPaint = new SharedDownloadSheetsPaint();
  private readonly frameView: SharedDownloadFrameView = {
    mount: {
      mounted: (): boolean => this.mounted,
      mountedIdentity: (): string => this.mountedIdentity,
      presentationGeneration: (): number => this.presentationGeneration,
      fontsReady: (): boolean => this.fontsReady,
      fontPreparationGeneration: (): number => this.fontPreparationGeneration,
      detailKey: (): string => this.detailKey,
      managing: (): boolean => this.managing,
      pageWidth: (): number => this.pageWidth,
      pageHeight: (): number => this.pageHeight,
      pageOriginX: (): number => this.pageOriginX,
      pageOriginY: (): number => this.pageOriginY,
      readerWindowMetricsRevision: (): number => this.readerWindowMetricsRevision,
    },
    layout: {
      pageViewportWidth: (): number => this.pageViewportWidth(),
      availableHeight: (): number => this.availableHeight(),
      leftInset: (): number => this.leftInset(),
      rightInset: (): number => this.rightInset(),
      contentLeftInset: (): number => this.contentLeftInset(),
      contentRightInset: (): number => this.contentRightInset(),
      contentTop: (): number => this.contentTop(),
      bottomInset: (): number => this.bottomInset(),
      scrollLayout: (): ReaderScrollLayout => this.scrollLayout(),
      fixedSelectionDockVisible: (): boolean => this.fixedSelectionDockVisible(),
      dockMaterialRadius: (selection: boolean): number => this.dockMaterialRadius(selection),
      raisedDockAreaChangeHandler: (selection: boolean): ((_old: Area, area: Area) => void) =>
        this.raisedDockAreaChangeHandler(selection),
    },
    scheme: (): string => this.appThemeScheme,
    getUIContext: (): UIContext => this.getUIContext(),
    metrics: (): ReaderWindowMetricsSnapshot => this.currentMetrics(),
    fontScale: (): number => sharedDownloadFontScale(this.currentMetrics()),
    presentationIsCurrent: (generation?: number): boolean => this.presentationIsCurrent(generation),
    uiInputIsCurrent: (generation?: number): boolean => this.uiInputIsCurrent(generation),
    syncOverlayFocus: (preferred?: string, managing?: boolean, readingReturn?: SharedDownloadReadingFocus): void =>
      this.syncOverlayFocus(preferred, managing, readingReturn),
  };

  private readonly bookListView: SharedDownloadBookListView = {
    frame: this.frameView,
    input: {
      books: (): DownloadBookView[] => this.books,
      embeddedWide: (): boolean => this.embeddedWide,
      loading: (): boolean => this.loading,
      error: (): string => this.error,
    },
    chrome: {
      headerTop: (): number => this.headerTop(),
      resolvedHeaderHeight: (): number => this.resolvedHeaderHeight(),
      dockLeftInset: (): number => this.dockLeftInset(),
      dockRightInset: (): number => this.dockRightInset(),
      canEnterManaging: (): boolean => this.canEnterManaging(),
      headerHeightChangeHandler: (): ((height: number) => void) => this.headerHeightChangeHandler(),
      back: (): void => this.back(),
      selectionLabel: (): string => this.selectionLabel(),
      allSelected: (): boolean => this.allSelected(),
      manageSelectAllAction: (generation: number): (() => void) => this.manageSelectAllAction(generation),
      managementGeneration: (): number => this.managementGeneration,
      renderManageAction: (): void => this.renderManageHeaderAction(),
    },
    chapters: {
      cancelChapterScrollRestore: (): void => this.chapterList.cancelChapterScrollRestore(),
      captureChapterOffset: (): number | undefined => this.chapterList.captureChapterOffset(),
      restoreManagementPosition: (offset: number): void => this.chapterList.restoreManagementPosition(offset),
      retireReadingReturnFocus: (): void => this.chapterList.retireReadingReturnFocus(),
      currentChapter: (): DownloadChapterView | undefined => this.chapterList.currentChapter(),
      locateCurrent: (): void => this.chapterList.locateCurrent(),
      selectedChapterActionAvailable: (action: SharedDownloadUiAction): boolean => this.chapterList.selectedChapterActionAvailable(action),
      selectedCount: (): number => this.chapterList.selectedCount(),
    },
    actions: {
      modalBlocking: (): boolean => this.sheets.modalBlocking(),
      openTool: (kind: 'filter' | 'sort' | 'settings', trigger: string): void => this.sheets.openSheet(kind, trigger),
      openBookActions: (bookKey: string): void => this.sheets.openBookActions(bookKey),
      activateBookStatus: (book: DownloadBookView): void => this.sheets.activateBookStatus(book),
      canRemoveBooks: (books: DownloadBookView[]): boolean => this.sheets.canRemoveBooks(books),
      runSelectedChapters: (action: 'download' | 'pause'): void => this.sheets.runSelectedChapters(action),
      openSelectionActions: (chapters: boolean): void => this.sheets.openSelectionActions(chapters),
    },
    filters: (): SharedDownloadFilters => this.currentFilters(),
    setFilter: (field: SharedDownloadFilterField, value: string): void => this.editFilter(field, value),
    focusGeneration: (): number => this.focusGeneration,
    advanceFocusGeneration: (): number => ++this.focusGeneration,
    setManaging: (managing: boolean, trigger?: string): void => this.setManaging(managing, trigger),
    openBook: (book: DownloadBookView, generation?: number): void => this.openBook(book, generation),
    publishViewState: (): void => this.publishViewState(),
    onRefresh: (): void => this.onRefresh(),
    onRefreshStorage: (): void => this.onRefreshStorage(),
    onIntent: (intent: SharedDownloadUiIntent): void => this.onIntent(intent),
  };

  private readonly chapterListView: SharedDownloadChapterListView = {
    frame: this.frameView,
    input: {
      appForeground: (): boolean => this.appForeground,
      covered: (): boolean => this.covered,
      embeddedWide: (): boolean => this.embeddedWide,
      loading: (): boolean => this.loading,
      reduceMotion: (): boolean => this.reduceMotion,
    },
    books: {
      detail: (): DownloadBookView | undefined => this.bookList.detail(),
      bookGetter: (book: DownloadBookView): (() => DownloadBookView) => this.bookList.bookGetter(book),
      findCurrentBook: (book: DownloadBookView): DownloadBookView | undefined => this.bookList.findCurrentBook(book),
      eventBook: (book: () => DownloadBookView, generation?: number): DownloadBookView | undefined => this.bookList.eventBook(book, generation),
      cancelManagingScroll: (): void => this.bookList.cancelManagingScroll(),
      onListTouch: (event: TouchEvent): void => this.bookList.onListTouch(event),
      onListWillScroll: (offset: number, source: ScrollSource, generation: number, bookKey: string): void =>
        this.bookList.onListWillScroll(offset, source, generation, bookKey),
    },
    actions: {
      modalBlocking: (): boolean => this.sheets.modalBlocking(),
      available: (action: SharedDownloadUiAction, books: DownloadBookView[], proofs: SharedDownloadExpectedChapter[]): boolean =>
        this.sheets.actionAvailable(action, books, proofs),
      runChapterAction: (bookKey: string, proof: SharedDownloadExpectedChapter, action: 'download' | 'pause'): void =>
        this.sheets.runChapterAction(bookKey, proof, action),
      openChapterActions: (bookKey: string, proof: SharedDownloadExpectedChapter, trigger: string): void =>
        this.sheets.openChapterActions(bookKey, proof, trigger),
    },
    onOpenBook: (book: DownloadBookView): void => this.onOpenBook(book),
    onReadTarget: (target: DownloadReadingTarget, current: () => boolean, control: SharedDownloadReadingControl): void =>
      this.onReadTarget(target, current, control),
    publishViewState: (): void => this.publishViewState(),
  };

  private readonly sheetsView: SharedDownloadSheetsView = {
    frame: this.frameView,
    input: {
      appForeground: (): boolean => this.appForeground,
      appearancePreferences: (): ReaderNavigationPreferences => this.appearancePreferences,
      batchRecovery: (): ReaderRecoveryView => this.batchRecovery,
      books: (): DownloadBookView[] => this.books,
      covered: (): boolean => this.covered,
      loading: (): boolean => this.loading,
      reduceMotion: (): boolean => this.reduceMotion,
      systemScheme: (): string => this.systemScheme,
      storagePolicy: (): DownloadStoragePolicyView | undefined => this.storagePolicy,
      storagePolicyBusy: (): boolean => this.storagePolicyBusy,
      storageSummary: (): DownloadStorageSummary => this.storageSummary,
      storageCleanupBusy: (): boolean => this.storageCleanupBusy,
    },
    books: {
      detail: (): DownloadBookView | undefined => this.bookList.detail(),
      visibleSelectedBooks: (): DownloadBookView[] => this.bookList.visibleSelectedBooks(),
      retireSearchInput: (): void => this.bookList.retireSearchInput(),
      retireEmptyBookSelection: (): void => this.bookList.retireEmptyBookSelection(),
      deferSelectionCloseAfterRemoval: (): void => this.bookList.deferSelectionCloseAfterRemoval(),
      sourceChoices: (): DownloadChoice[] => this.bookList.sourceChoices(),
      sortChoices: (): DownloadChoice[] => this.bookList.sortChoices(),
      stateChoices: (): DownloadChoice[] => this.bookList.stateChoices(),
    },
    chapters: {
      invalidateReadingHandoff: (): void => this.chapterList.invalidateReadingHandoff(),
      selectedCount: (): number => this.chapterList.selectedCount(),
      selectionProofs: (): SharedDownloadExpectedChapter[] => this.chapterList.selectedChapterProofs(),
    },
    sheetSlots: {
      operationsHeader: (opening: number): void => this.renderOperationsHeader(opening),
      operationsBody: (opening: number): void => this.renderOperationsBody(opening),
      storageCleanupIcon: (): void => this.renderStorageCleanupIcon(),
      confirmationSurface: (opening: number, width: number, height: number): void =>
        this.renderConfirmationSurface(opening, width, height),
      confirmationBody: (opening: number, viewportHeight: number): void => this.renderConfirmationSurfaceBody(opening, viewportHeight),
    },
    modal: { sheet: (): string => this.sheet, confirmation: (): string => this.confirmation },
    setSheet: (kind: string): void => { this.sheet = kind; },
    setConfirmation: (kind: string): void => { this.confirmation = kind; },
    filters: (): SharedDownloadFilters => this.currentFilters(),
    setFilter: (field: SharedDownloadFilterField, value: string): void => this.editFilter(field, value),
    measurementGeneration: (): number => this.measurementGeneration(),
    onRefreshBatchRecovery: (generation: number): void => this.onRefreshBatchRecovery(generation),
    onIntent: (intent: SharedDownloadUiIntent): void => this.onIntent(intent),
  };

  private readonly bookList = new SharedDownloadBookListOwner(this.bookListView, (): SharedDownloadBookListPaint => this.bookPaint);
  private readonly chapterList = new SharedDownloadChapterListOwner(this.chapterListView,
    (): SharedDownloadChapterListPaint => this.chapterPaint);
  private readonly sheets = new SharedDownloadSheetsOwner(this.sheetsView, (): SharedDownloadSheetsPaint => this.sheetsPaint);

  private currentFilters(): SharedDownloadFilters {
    return { query: this.query, type: this.bookType as 'all' | 'novel' | 'manga',
      state: this.stateFilter as 'all' | 'downloading' | 'downloaded' | 'none', sourceId: this.sourceFilter,
      sort: this.sortField as 'recent' | 'title' | 'progress' | 'size', direction: this.sortDirection as 'asc' | 'desc' };
  }

  private editFilter(field: SharedDownloadFilterField, value: string): void {
      switch (field) {
        case 'query': this.query = value; break;
        case 'type': this.bookType = value; break;
        case 'state': this.stateFilter = value; break;
        case 'sourceId': this.sourceFilter = value; break;
        case 'sort': this.sortField = value; break;
        case 'direction': this.sortDirection = value; break;
      }

  }

  private onListGeometryChanged(): void { this.bookList.onListGeometryChanged(); }
  private onListFilterChanged(): void { this.bookList.onListFilterChanged(); }
  private onSheetChanged(): void { this.sheets.onSheetChanged(); }
  private onConfirmationChanged(): void { this.sheets.onConfirmationChanged(); }
  private syncOverlayChrome(): void { this.sheets.syncOverlayChrome(); }

  aboutToAppear(): void {
    this.bookList.cancelListScrollRestore();
    this.chapterList.cancelChapterScrollRestore();
    this.presentationGeneration += 1;
    this.measurements.clear();
    this.storageDockShape = undefined;
    this.selectionDockShape = undefined;
    this.mountedIdentity = this.presentationIdentity;
    this.query = this.initialViewState.query;
    this.bookType = this.initialViewState.type;
    this.stateFilter = this.initialViewState.state;
    this.sourceFilter = this.initialViewState.sourceId;
    this.sortField = this.initialViewState.sort;
    this.sortDirection = this.initialViewState.direction;
    this.detailKey = this.initialViewState.detailKey ?? '';
    this.bookList.beginOpening(this.initialViewState.listScroll ?? 0);
    this.chapterList.initializePosition(this.initialViewState.chapterScroll ?? 0, this.detailKey.length > 0);
    this.mounted = true;
    this.sheets.onSheetChanged();
    this.chapterList.acceptReturnFocus(this.takeReadingFocus());
    this.prepareFonts();
    this.onErrorChanged();
    this.onTemporaryBackBridge((): boolean => this.consumeBack(), this.mountedIdentity,
      (): boolean => this.presentationIsCurrent() && this.confirmation.length > 0);
  }

  aboutToDisappear(): void {
    this.bookList.cancelListScrollRestore();
    this.chapterList.cancelChapterScrollRestore();
    this.transientFeedback.reset();
    this.fontPreparationGeneration += 1;
    this.publishViewState();
    // The scene may retire before ArkUI destroys its child. Release chrome
    // already acquired by this mount even though its input lease has ended.
    const restoreChrome = this.sheets.ownsOverlayChrome() && this.mounted && this.presentationIdentity === this.mountedIdentity;
    this.presentationGeneration += 1;
    this.sheets.retireAttachment();
    this.focusGeneration += 1;
    this.chapterList.retireReadingReturnFocus();
    this.sheets.resetExitPaint(true);
    this.chapterList.discardMeasuredPosition();
    this.chapterList.releaseOldFontFrame();
    this.mounted = false;
    this.measurements.clear();
    this.bookList.cancelManagingScroll();
    this.sheets.releaseUnmountedChrome(restoreChrome);
    this.onTemporaryBackBridge(undefined, this.mountedIdentity);
  }

  build() {
    ReaderPageScaffold({
      frameStyle: this.frameStyle(),
      geometry: this.pageGeometry(),
      headerVisible: this.embeddedWide,
      content: (): void => { this.pageContent(); },
      header: (): void => { this.topBar(); },
      footer: (): void => { this.fixedDock(); },
      overlayContent: (): void => { this.pageOverlays(); },
    }).onAreaChange((_old: Area, area: Area): void => {
      const width = readerPageAreaLength(area.width);
      if (Number.isFinite(width) && width > 0 && Math.abs(width - this.pageWidth) > 0.5) this.pageWidth = width;
      const originX = readerPageAreaLength(area.globalPosition.x);
      if (Number.isFinite(originX) && Math.abs(originX - this.pageOriginX) > 0.1) this.pageOriginX = originX;
      const originY = readerPageAreaLength(area.globalPosition.y);
      if (Number.isFinite(originY) && Math.abs(originY - this.pageOriginY) > 0.1) this.pageOriginY = originY;
      const height = readerPageAreaLength(area.height);
      if (Number.isFinite(height) && height > 0 && Math.abs(height - this.pageHeight) > 0.5) this.pageHeight = height;
    });
  }

  @Builder
  private topBar() { SharedDownloadHeader({ owner: this.bookList }); }

  @Builder
  private renderManageHeaderAction() { SharedDownloadManageHeaderAction({ owner: this.bookList }); }

  @Builder
  private pageOverlays() { SharedDownloadSheets({ owner: this.sheets }); }

  @Builder
  private renderOperationsHeader(opening: number) {
    DownloadOperationsHeader(this.sheets, { opening });
  }

  @Builder
  private renderOperationsBody(opening: number) {
    DownloadOperationsBody(this.sheets, { opening });
  }

  @Builder
  private renderStorageCleanupIcon() { DownloadStorageCleanupIcon({ owner: this.sheets }); }

  @Builder
  private renderConfirmationSurface(opening: number, width: number, height: number) {
    DownloadConfirmationSurface(this.sheets, { opening, width, height });
  }

  @Builder
  private renderConfirmationSurfaceBody(opening: number, viewportHeight: number) {
    DownloadConfirmationSurfaceBody(this.sheets, { opening, viewportHeight });
  }

  @Builder
  private pageContent() {
    Stack({ alignContent: Alignment.TopStart }) {
      this.pageBody();
    }.width('100%').height('100%').enabled(!this.sheets.modalBlocking())
      .accessibilityLevel(this.sheets.modalBlocking() ? 'no-hide-descendants' : 'auto')
      .hitTestBehavior(this.sheets.modalBlocking() ? HitTestMode.None : HitTestMode.Default);
  }

  @Builder
  private pageBody() {
    if (!this.fontsReady) {
      Column() {
        ReaderPageState({ title: this.fontsFailed ? '阅读字体暂不可用' : '正在准备下载管理…',
          loading: !this.fontsFailed, actionLabel: this.fontsFailed ? '重试' : '',
          onAction: (): void => { if (this.uiInputIsCurrent()) this.prepareFonts(); } });
      }.width('100%').padding({ left: this.leftInset(), right: this.rightInset(), top: this.contentTop() });
    } else if (this.bookList.detail() !== undefined) {
      SharedDownloadChapterList(this.chapterList, { chromeOwner: this.bookList, book: this.bookList.bookGetter(this.bookList.detail() as DownloadBookView), ownerGeneration: this.presentationGeneration });
    } else {
      SharedDownloadBookList(this.bookList, { ownerGeneration: this.presentationGeneration });
    }
  }

  @Builder
  private fixedDock() {
    if (this.fixedSelectionDockVisible()) {
      Column() { SharedDownloadSelectionDock({ owner: this.bookList }); }.width('100%').enabled(!this.sheets.modalBlocking())
        .accessibilityLevel(this.sheets.modalBlocking() ? 'no-hide-descendants' : 'auto')
        .hitTestBehavior(this.sheets.modalBlocking() ? HitTestMode.None : HitTestMode.Default)
        .responseRegion(readerLayoutCarrierResponseRegion());
    }
  }

  private lastErrorFeedback: string = '';
  private lastChapterFeedback: string = '';

  private onLoadingChanged(): void {
    this.chapterList.restoreChapterOffset();
    this.bookList.retireEmptyBookSelection();
  }

  private onErrorChanged(): void {
    if (!this.error) {
      this.lastErrorFeedback = '';
      this.bookList.retireEmptyBookSelection();
      return;
    }
    if (!this.mounted || !this.presentationIsCurrent() || this.books.length === 0 || !this.error || this.error === this.lastErrorFeedback) return;
    this.lastErrorFeedback = this.error;
    try { this.transientFeedback.show(() => this.getUIContext(), { message: this.error, duration: READER_FEEDBACK_BRIEF_MS }, (): boolean => this.mounted && this.presentationIsCurrent()); } catch (_) {}
  }

  private onBooksChanged(): void {
    this.onErrorChanged();
    this.bookList.retainCurrentBookSelection();
    this.bookList.retireEmptyBookSelection();
    this.sheets.syncRangeCatalog();
    this.chapterList.restoreChapterOffset();
    const book = this.bookList.detail();
    this.chapterList.retainSelection(book);
    if (book?.projectionStatus !== 'unavailable') { this.lastChapterFeedback = ''; return; }
    if (!this.mounted || !this.presentationIsCurrent() || book.chapters.length === 0) return;
    const message = book.projectionError ?? '章节下载情况暂不可用';
    const identity = JSON.stringify([book.key, message]);
    if (identity === this.lastChapterFeedback) return;
    this.lastChapterFeedback = identity;
    try { this.transientFeedback.show(() => this.getUIContext(), { message, duration: READER_FEEDBACK_BRIEF_MS }, (): boolean => this.mounted && this.presentationIsCurrent()); } catch (_) {}
  }

  private raisedDockShapeIdentity(selection: boolean): string {
    return JSON.stringify(['download-dock', selection, this.mountedIdentity, this.presentationGeneration,
      this.detailKey, this.managing, this.readerWindowMetricsRevision, this.pageViewportWidth(), this.frameView.fontScale()]);
  }

  private currentRaisedDockShape(selection: boolean): ReaderRaisedShape | undefined {
    // A same-box input change need not cause another Native area callback.
    // Keep adopted geometry while rejecting stale callbacks independently.
    if (!this.presentationIsCurrent()) return undefined;
    return selection ? this.selectionDockShape : this.storageDockShape;
  }

  private dockMaterialRadius(selection: boolean): number {
    return this.currentRaisedDockShape(selection)?.radius ?? resolveReaderRaisedShape(this.raisedDockShapeIdentity(selection),
      this.currentMetrics().windowRect.width - this.dockLeftInset() - this.dockRightInset(),
      this.resolvedDockHeight(), DOWNLOAD_VISUAL.dockRadius)?.radius ?? 0;
  }

  private raisedDockAreaChangeHandler(selection: boolean): (_old: Area, area: Area) => void {
    const identity = this.raisedDockShapeIdentity(selection);
    return (_old: Area, area: Area): void => this.recordRaisedDockSurface(selection, area, identity);
  }

  private recordRaisedDockSurface(selection: boolean, area: Area, identity: string): void {
    if (!this.presentationIsCurrent() || identity !== this.raisedDockShapeIdentity(selection) ||
      selection !== (this.managing || this.bookList.detail() !== undefined)) return;
    const width = readerPageAreaLength(area.width);
    const height = readerPageAreaLength(area.height);
    const shape = resolveReaderRaisedShape(identity, width, height, DOWNLOAD_VISUAL.dockRadius);
    if (shape === undefined) return;
    const previous = selection ? this.selectionDockShape : this.storageDockShape;
    if (previous === undefined || previous.identity !== identity || Math.abs(previous.width - width) > .1 || Math.abs(previous.height - height) > .1) {
      if (selection) this.selectionDockShape = shape;
      else this.storageDockShape = shape;
    }
    this.recordDockHeight(height, identity);
  }

  private presentationIsCurrent(generation: number = this.presentationGeneration): boolean {
    return this.mounted && generation === this.presentationGeneration &&
      this.presentationIdentity === this.mountedIdentity && (this.isOpeningCurrent?.() ?? true);
  }

  private uiInputIsCurrent(generation: number = this.presentationGeneration): boolean {
    return this.presentationIsCurrent(generation) && this.appForeground && !this.covered;
  }

  private syncOverlayFocus(preferred: string = '', expectedManaging: boolean = this.managing,
    readingReturn?: SharedDownloadReadingFocus): void {
    if (!this.uiInputIsCurrent()) return;
    const generation = this.presentationGeneration;
    const focusGeneration = ++this.focusGeneration;
    const detailKey = this.detailKey;
    const returning = this.sheet.length === 0 && this.confirmation.length === 0;
    if (returning && this.sheetsPaint.sheetExitPending) return;
    const target = preferred.length > 0 ? preferred :
      this.confirmation.length > 0 ? 'confirm-cancel' : this.sheet.length > 0 ? 'sheet' : this.sheets.sheetTriggerKey;
    if (target.length === 0 && readingReturn === undefined) return;
    try {
      this.getUIContext().postFrameCallback(new SharedDownloadIdleFrame(this.getUIContext(), (): void => {
        if (!this.uiInputIsCurrent(generation) || focusGeneration !== this.focusGeneration ||
          detailKey !== this.detailKey || expectedManaging !== this.managing || (returning && this.sheets.modalBlocking())) return;
        if (readingReturn !== undefined) {
          if (!this.chapterList.consumeReturnFocus(readingReturn)) return;
        }
        if (returning) this.sheets.sheetTriggerKey = '';
        const resolved = readingReturn === undefined ? target : this.chapterList.chapterReadingFocusTarget(readingReturn);
        const currentTarget = !resolved.startsWith('chapter-menu:') || (!this.managing &&
          this.bookList.detail()?.chapters.some((chapter: DownloadChapterView): boolean =>
            chapter.navigable && this.chapterList.chapterMenuFocusKey(chapter) === resolved) === true);
        const targets: string[] = currentTarget ? [resolved] : [];
        if (returning) {
          if (readingReturn === undefined && this.books.length > 0 && target !== 'manage') targets.push('manage');
          if (resolved !== 'page-back') targets.push('page-back');
        } else if (this.confirmation.length === 0 && this.sheet.length > 0 && target !== 'sheet') {
          targets.push('sheet');
        }
        for (const candidate of targets) {
          try {
            this.getUIContext().getFocusController().requestFocus(sharedDownloadFocusKey(candidate));
            return;
          } catch (_missingOrDisabledTarget) {}
        }
      }));
    } catch (_unmounted) {}
  }

  private onPresentationIdentityChanged(): void {
    this.bookList.cancelListScrollRestore();
    this.chapterList.cancelChapterScrollRestore();
    if (!this.mounted || this.presentationIdentity === this.mountedIdentity) return;
    this.presentationGeneration += 1;
    this.bookList.cancelManagingScroll();
    this.sheets.retireAttachment();
    this.focusGeneration += 1;
    this.chapterList.retireReadingReturnFocus();
    this.sheets.resetExitPaint(false);
    this.bookList.resetRemovalClosure();
    this.chapterList.discardMeasuredPosition();
    this.chapterList.releaseOldFontFrame();
    this.sheets.releaseReplacedChrome();
  }

  private openBook(snapshot: DownloadBookView, generation: number = this.presentationGeneration): void {
    const book = this.bookList.eventBook(this.bookList.bookGetter(snapshot), generation);
    if (book === undefined) return;
    this.bookList.cancelListScrollRestore();
    this.chapterList.cancelChapterScrollRestore();
    if (this.managing) { this.bookList.toggleBookSelection(book.key); return; }
    this.bookList.captureListOffset();
    this.bookList.cancelManagingScroll();
    this.chapterList.initializePosition(0);
    this.detailKey = book.key; this.chapterList.resetSelection(); this.onOpenBook(book);
  }

  private back(): void {
    if (!this.uiInputIsCurrent()) return;
    this.onBack();
  }

  private consumeBack(): boolean {
    if (!this.presentationIsCurrent()) return false;
    this.chapterList.retireReadingReturnFocus();
    const generation = this.presentationGeneration;
    if (consumeReaderControlKeyboardBack(this.currentMetrics(), {
      hideTextInput: (): Promise<void> => inputMethod.getController().hideTextInput(),
      onFailure: (error: Error): void => {
        if (this.presentationIsCurrent(generation)) {
          hilog.warn(0x5244, 'Reader', 'Download keyboard dismissal: %{private}s', error.message);
        }
      },
    })) return true;
    if (this.confirmation.length > 0) { this.confirmation = ''; return true; }
    if (this.sheet.length > 0) { this.sheet = ''; return true; }
    if (this.sheetsPaint.sheetExitPending) return true;
    if (this.managing) { this.setManaging(false); return true; }
    if (this.detailKey.length > 0) {
      const trigger = 'book-title:' + this.detailKey;
      const offset = this.bookList.listOffset;
      this.bookList.cancelManagingScroll();
      this.chapterList.cancelChapterScrollRestore();
      this.chapterList.discardMeasuredPosition();
      this.detailKey = ''; this.chapterList.resetSelection();
      this.bookList.restoreListOffset(offset, trigger);
      return true;
    }
    this.publishViewState();
    return false;
  }

  private canEnterManaging(): boolean {
    const book = this.bookList.detail();
    return book === undefined ? this.books.length > 0 :
      book.projectionStatus === 'ready' && book.chapters.some((chapter: DownloadChapterView): boolean =>
        chapter.navigable && chapter.chapterId.length > 0);
  }

  private setManaging(managing: boolean, triggerKey: string = 'manage'): void {
    if (this.managing === managing || !this.presentationIsCurrent() || !this.fontsReady || this.sheets.modalBlocking() ||
      (managing && !this.canEnterManaging())) return;
    this.bookList.cancelListScrollRestore();
    this.chapterList.cancelChapterScrollRestore();
    const offset = this.bookList.captureManagingOffset();
    this.bookList.cancelManagingScroll();
    this.bookList.retireSearchInput();
    this.chapterList.invalidateReadingHandoff();
    this.managementGeneration += 1;
    this.managing = managing;
    this.bookList.resetRemovalClosure();
    if (managing) {
      this.managingTriggerKey = triggerKey;
      if (triggerKey === 'manage') this.focusGeneration += 1;
      else this.syncOverlayFocus('select-all', managing);
    }
    this.bookList.resetSelection();
    this.chapterList.resetSelection();
    this.bookList.restoreManagementPosition(offset, managing);
    if (!managing) {
      const returnFocus = this.managingTriggerKey;
      this.managingTriggerKey = 'manage';
      this.syncOverlayFocus(returnFocus, managing);
    }
  }

  private allSelected(): boolean {
    const book = this.bookList.detail();
    if (book === undefined) {
      const visible = this.bookList.visibleBooks().length;
      return visible > 0 && this.bookList.visibleSelectedBooks().length === visible;
    }
    const chapters = book.chapters.filter((chapter: DownloadChapterView): boolean => chapter.navigable && chapter.chapterId.length > 0);
    return chapters.length > 0 && chapters.every((chapter: DownloadChapterView): boolean => this.chapterList.chapterSelected(chapter));
  }

  private manageSelectAllAction(management: number): () => void {
    const presentation = this.presentationGeneration;
    const bookKey = this.detailKey;
    return (): void => {
      if (!this.uiInputIsCurrent(presentation) || !this.managing || management !== this.managementGeneration ||
        bookKey !== this.detailKey || this.sheets.modalBlocking()) return;
      this.toggleAll();
    };
  }

  private toggleAll(): void {
    const book = this.bookList.detail();
    if (book !== undefined) this.chapterList.selectChapters(this.allSelected() ? [] : book.chapters);
    else this.bookList.toggleVisibleSelection(this.allSelected());
  }

  private selectionLabel(): string {
    const book = this.bookList.detail();
    if (book !== undefined) return this.managing ? `已选 ${this.chapterList.selectedCount()}${sharedDownloadChapterUnit(book)}` : this.bookList.downloadCount(book, false);
    return `已选 ${this.bookList.visibleSelectedBooks().length} / ${this.bookList.visibleBooks().length} 本书`;
  }

  private onInputEligibilityChanged(): void {
    this.bookList.cancelListScrollRestore();
    this.chapterList.cancelChapterScrollRestore();
    this.bookList.retireSearchInput();
    this.chapterList.invalidateReadingHandoff();
    if (!this.appForeground || this.covered) this.focusGeneration += 1;
  }

  private onDetailChanged(): void {
    this.bookList.cancelListScrollRestore();
    this.chapterList.cancelChapterScrollRestore();
    this.bookList.retireSearchInput();
    this.chapterList.invalidateReadingHandoff();
    this.publishViewState();
  }

  private publishViewState(): void {
    if (!this.mounted) return;
    if (this.detailKey.length === 0) this.bookList.captureListOffset();
    else this.chapterList.captureVisiblePosition();
    this.onViewStateChanged({ query: this.query, type: this.bookType as 'all' | 'novel' | 'manga',
      state: this.stateFilter as 'all' | 'downloading' | 'downloaded' | 'none', sourceId: this.sourceFilter,
      sort: this.sortField as 'recent' | 'title' | 'progress' | 'size', direction: this.sortDirection as 'asc' | 'desc',
      listScroll: this.bookList.listOffset, chapterScroll: this.chapterList.chapterOffset, detailKey: this.detailKey });
  }

  private prepareFonts(): void {
    this.bookList.cancelListScrollRestore();
    const identity = this.mountedIdentity;
    const generation = ++this.fontPreparationGeneration;
    this.chapterList.releaseOldFontFrame();
    this.fontsFailed = false;
    prepareSharedDownloadFonts().then((ready: boolean): void => {
      if (!this.mounted || this.mountedIdentity !== identity || generation !== this.fontPreparationGeneration) return;
      this.fontsReady = ready; this.fontsFailed = !ready;
      if (ready) {
        if (this.detailKey.length > 0) this.chapterList.restoreChapterOffset();
        else this.bookList.restoreListOffset();
      }
    }).catch((_error: Error): void => {
      if (this.mounted && this.mountedIdentity === identity && generation === this.fontPreparationGeneration) this.fontsFailed = true;
    });
  }

  private frameStyle(): ReaderFrameStyle {
    const pageBackground = readerAppColor('TOK_PAPER', this.appThemeScheme);
    return readerFrameStyle({ backgroundColor: pageBackground, headerBackground: pageBackground,
      headerTransparent: this.embeddedWide, footerBackground: pageBackground });
  }

  private currentMetrics(): ReaderWindowMetricsSnapshot {
    // StorageLink is the reactive bridge to the coordinator-owned immutable
    // snapshot. Reading it inside the render callback records this dependency.
    void this.readerWindowMetricsRevision;
    return ReaderWindowCoordinator.metrics();
  }

  private headerTop(): number {
    // Index already applies readerContentSafeTop to App routes. Add only the
    // approved gap inside that content frame; never count the status bar twice.
    return this.embeddedWide ? this.pageGeometry().header.top : DOWNLOAD_VISUAL.headerTopGap;
  }

  private resolvedHeaderHeight(): number {
    return this.measurements.readForGeneration('download:header', this.measurementGeneration(), DOWNLOAD_HEADER_HEIGHT);
  }

  private resolvedDockHeight(): number {
    return this.measurements.readForGeneration(this.raisedDockShapeIdentity(this.managing || this.bookList.detail() !== undefined),
      this.measurementGeneration(), this.dockFallbackHeight());
  }

  private dockFallbackHeight(): number {
    if (!this.managing && this.bookList.detail() === undefined)
      return DOWNLOAD_VISUAL.dockPaddingY * 2 + DOWNLOAD_VISUAL.headerIconHeight + DOWNLOAD_VISUAL.borderWidth * 2;
    const scale = this.frameView.fontScale();
    // Both summary text and its management controls may occupy their own line.
    // The actual inner dock Area replaces this conservative first-frame budget.
    const summaryText = (TYPE_DOWNLOAD_CONTROL.lineHeightFp as number) * scale * 2;
    const summaryControls = this.managing ? sharedDownloadControlHeight(this.frameView.fontScale(), DOWNLOAD_VISUAL.touchTarget,
      (TYPE_DOWNLOAD_CONTROL.lineHeightFp as number), DOWNLOAD_VISUAL.textActionPaddingY * 2) : 0;
    const summary = summaryText + summaryControls;
    const actions = sharedDownloadControlHeight(this.frameView.fontScale(), DOWNLOAD_VISUAL.buttonHeight,
      DOWNLOAD_VISUAL.controlLineHeight, DOWNLOAD_VISUAL.buttonPaddingY * 2);
    return DOWNLOAD_VISUAL.selectionPadding * 2 + summary + DOWNLOAD_VISUAL.selectionSummaryBottom +
      actions + DOWNLOAD_VISUAL.borderWidth * 2;
  }

  private headerContentGap(): number {
    return DOWNLOAD_VISUAL.contentTop - DOWNLOAD_VISUAL.headerTopGap - DOWNLOAD_HEADER_HEIGHT;
  }

  private contentTop(): number {
    return readerPresentedHeaderBottom(this.headerTop(),
      Math.max(DOWNLOAD_HEADER_HEIGHT, this.resolvedHeaderHeight())) + this.headerContentGap();
  }

  private contentBottom(minimum: number): number {
    return Math.max(minimum, this.resolvedDockHeight() + this.bottomInset() + DOWNLOAD_VISUAL.dockBottom);
  }

  private scrollLayout(): ReaderScrollLayout {
    return readerScrollLayout(this.pageGeometry(), { mode: 'contentOffset' });
  }

  private pageGeometry(): ReaderPageGeometry {
    const metrics = this.currentMetrics();
    const fixedDock = this.fixedSelectionDockVisible();
    const input = new ReaderPageGeometryInput(metrics);
    input.viewportWidth = this.pageViewportWidth();
    input.viewportHeight = this.availableHeight();
    input.originX = this.embeddedWide ? this.pageOriginX : undefined;
    input.measurementRevision = this.measurementRevision;
    // Compact lists retain their in-flow header. An embedded pane shares the
    // floating header geometry of the other settings destinations.
    input.chromeMode = fixedDock || this.embeddedWide ? 'overlay' : 'inline';
    if (this.embeddedWide) {
      input.headerHeight = this.resolvedHeaderHeight();
      input.contentGap = this.headerContentGap();
      applyReaderStandardFloatingHeader(input);
    }
    input.footerHeight = fixedDock ? this.resolvedDockHeight() : 0;
    input.footerBottom = fixedDock ? this.bottomInset() : 0;
    input.footerInsetLeft = fixedDock ? this.dockLeftInset() : 0;
    input.footerInsetRight = fixedDock ? this.dockRightInset() : 0;
    input.contentEndInset = fixedDock ? this.contentBottom(0) : 0;
    return resolveReaderPageGeometry(input);
  }

  private safeLeft(): number { return readerPageSafeLeft(this.currentMetrics(), this.embeddedWide ? this.pageOriginX : undefined); }

  private safeRight(): number {
    return readerPageSafeRight(this.currentMetrics(), this.embeddedWide ? this.pageOriginX : undefined, this.pageWidth);
  }

  private leftInset(): number { return Math.max(8, this.safeLeft()); }

  private rightInset(): number { return Math.max(8, this.safeRight()); }

  private dockLeftInset(): number { return Math.max(30, this.safeLeft()); }

  private dockRightInset(): number { return Math.max(30, this.safeRight()); }

  private contentLeftInset(): number {
    return sharedDownloadContentInsets(this.safeLeft(), this.safeRight()).left;
  }

  private contentRightInset(): number {
    return sharedDownloadContentInsets(this.safeLeft(), this.safeRight()).right;
  }

  private bottomInset(): number { return Math.max(DOWNLOAD_VISUAL.dockBottom, readerStableInteractiveSafeBottom(this.currentMetrics())); }

  private pageViewportWidth(): number {
    return this.pageWidth > 0 ? this.pageWidth : this.currentMetrics().windowRect.width;
  }

  private availableHeight(): number {
    // UIContext owns keyboard OFFSET/RESIZE. Measured page height already
    // reflects any platform resize; never subtract keyboardInsets a second time.
    return readerAvailableWindowHeight(this.currentMetrics(), this.pageHeight);
  }

  private selectionDockMinimumContentHeight(): number {
    const scale = this.frameView.fontScale();
    if (this.bookList.detail() !== undefined) {
      return Math.max(DOWNLOAD_VISUAL.chapterHeight,
        Math.max(DOWNLOAD_VISUAL.touchTarget, (TYPE_DOWNLOAD_CHAPTER_TITLE.lineHeightFp as number) * scale) +
        (TYPE_DOWNLOAD_TAG.lineHeightFp as number) * scale + DOWNLOAD_VISUAL.sourceLineHeight * scale +
        DOWNLOAD_VISUAL.chapterPaddingY * 2 + DOWNLOAD_VISUAL.borderWidth);
    }
    const copy = Math.max(DOWNLOAD_VISUAL.bookTopHeight, (TYPE_DOWNLOAD_BOOK_TITLE.lineHeightFp as number) * scale) + DOWNLOAD_VISUAL.sourceTop +
      DOWNLOAD_VISUAL.sourceLineHeight * scale + Math.max(DOWNLOAD_VISUAL.statusHeight,
        (TYPE_DOWNLOAD_META.lineHeightFp as number) * scale) +
      DOWNLOAD_VISUAL.progressTop + DOWNLOAD_VISUAL.progressHeight;
    return Math.max(DOWNLOAD_VISUAL.coverHeight, DOWNLOAD_VISUAL.bookMinHeight, copy) +
      DOWNLOAD_VISUAL.bookPaddingY * 2 + DOWNLOAD_VISUAL.borderWidth;
  }

  private fixedSelectionDockVisible(): boolean {
    return this.fontsReady && this.managing &&
      this.contentBottom(0) + this.selectionDockMinimumContentHeight() <= this.availableHeight();
  }

  private measurementGeneration(): number {
    return Math.max(0, this.readerWindowMetricsRevision);
  }

  private headerHeightChangeHandler(): (height: number) => void {
    const presentation = this.presentationGeneration;
    const layout = this.measurementGeneration();
    const detail = this.detailKey;
    const managing = this.managing;
    return (height: number): void => {
      if (!this.presentationIsCurrent(presentation) || layout !== this.measurementGeneration() ||
        detail !== this.detailKey || managing !== this.managing) return;
      this.recordHeaderHeight(height);
    };
  }

  private recordHeaderHeight(height: number): void {
    if (!Number.isFinite(height) || height <= 0) return;
    if (this.measurements.record('download:header', height, this.measurementGeneration(), 0.5))
      this.measurementRevision += 1;
  }

  private recordDockHeight(height: number, identity: string = this.raisedDockShapeIdentity(this.managing || this.bookList.detail() !== undefined)): void {
    if (!this.presentationIsCurrent() || identity !== this.raisedDockShapeIdentity(this.managing || this.bookList.detail() !== undefined) ||
      !Number.isFinite(height) || height <= 0) return;
    if (this.measurements.record(identity, height, this.measurementGeneration(), 0.5))
      this.measurementRevision += 1;
    this.bookList.onManagementDockMeasured();
  }
}
