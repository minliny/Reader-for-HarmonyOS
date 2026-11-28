import { ReaderEditingVisibility } from '../../../ui/layout/ReaderEditingVisibility';
import { ReaderEditingScrollBinding } from '../../../ui/layout/ReaderEditingScrollBinding';
import { ReaderEditableTarget, ReaderEditableInputModifier } from '../../../ui/layout/ReaderEditableTarget';
import { READER_LAYOUT_DEBUG_BUILD, READER_LAYOUT_INVARIANT_PROPERTY, readerLayoutInvariantChanged } from '../../../ui/foundation/ReaderLayoutInvariantSignals';
import { READER_SHEET_CLOSE_MS } from '../../../ui/foundation/ProductMotionTiming';
import type { LayoutInvariantTag } from '../../../ui/layout/LayoutInvariantEvaluator';
import { ReaderPageState } from '../../../ui/feedback/ReaderPageState';
import { ReaderRecoveryNotice } from '../../../ui/feedback/ReaderRecoveryNotice';
import { ReaderDialogSurface } from '../../../ui/surfaces/ReaderDialogSurface';
import { ReaderDialogViewport } from '../../../ui/surfaces/ReaderDialogViewport';
import { MESSAGE_TITLE, MESSAGE_BODY } from '../../../ui/foundation/ReaderMessageStyle';
import type { ReaderRecoveryView } from '../../../ui/feedback/ReaderRecoveryView';
import type { ReaderNavigationPreferences } from '../../../app/HarmonyCapabilityPolicy';
import { readerAppColor } from '../../../ui/foundation/ReaderThemeRegistry';
import { ReaderButton } from '../../../ui/controls/ReaderButton';
import { readerPageAreaLength } from '../../../ui/layout/ReaderPageShell';
import { readerPageSafeLeft, readerPageSafeRight } from '../../../ui/layout/ReaderPageGeometry';
import { DOWNLOAD_VISUAL, downloadVisualColor, sharedDownloadSheetMaxHeight } from './SharedDownloadVisualSpec';
import { TYPE_DOWNLOAD_CONTROL, TYPE_DOWNLOAD_META, TYPE_DOWNLOAD_SHEET_TITLE, TYPE_DOWNLOAD_META_LINE, TYPE_DOWNLOAD_STORAGE_TOTAL, TYPE_DOWNLOAD_STORAGE_VALUE } from './DownloadTypography';
import { TYPE_APP_ROW_LABEL, TYPE_DOWNLOAD_BODY } from '../../../ui/foundation/ReaderTypography';
import { ReaderWindowCoordinator, ReaderWindowChromeStyle } from '../../../app/ReaderWindowCoordinator';
import { ReaderInsetsVp, ReaderRectVp, readerStableInteractiveSafeBottom } from '../../../ui/foundation/ReaderWindowMetrics';
import type { DownloadBookView, DownloadChapterView, SharedDownloadFilters, DownloadStoragePolicyView, DownloadStorageSummary } from '../presentation/SharedDownloadProjection';
import { formatDownloadStorageBytes, canCleanDownloadStorage } from '../presentation/SharedDownloadProjection';
import { readerScrimmedOpaqueColor } from '../../../ui/surfaces/ReaderScrimColor';
import { ReaderInlineSelect } from '../../../ui/controls/ReaderInlineSelect';
import { ReaderChoiceRow } from '../../../ui/controls/ReaderChoiceRow';
import { ReaderActionMenuSurface, ReaderMenuActionView } from '../../../ui/surfaces/ReaderActionMenuSurface';
import { readerActionIcon } from '../../../ui/foundation/ReaderActionIconResources';
import { isReaderRealtimeBlurEnabled, resolveReaderModalScrimSpec } from '../../../app/HarmonyCapabilityPolicy';
import { ReaderModalScrimModifier, readerSurfaceMaterialDecision } from '../../../ui/surfaces/ReaderSurfaceMaterial';
import { ReaderBoundedSurface } from '../../../ui/surfaces/ReaderBoundedSurface';
import { ReaderBoundedSurfaceHeader } from '../../../ui/surfaces/ReaderBoundedSurfaceHeader';
import { resolveDialogSpec, resolveDrawerSpec, readerSurfaceElevation } from '../../../ui/surfaces/ReaderSurfaceSpecs';
import { readerDynamicSurfaceWidth, readerSurfaceMaxHeight } from '../../../ui/foundation/ReaderSurfaceResolvers';
import { motionAnimateParam } from '../../../ui/foundation/MotionSpec';
import { readerMotionReducedFadeParam } from '../../../ui/foundation/ReaderMotionPolicy';
import type { SharedDownloadUiAction, SharedDownloadUiBookTarget, SharedDownloadUiIntent } from '../presentation/SharedDownloadUiContract';
import type { SharedDownloadExpectedChapter } from '../application/SharedDownloadCoordinator';
import { chooseSharedDownloadRange, editSharedDownloadRangeBound, observeSharedDownloadRangeCatalog,
  openSharedDownloadRangeDraft, resetSharedDownloadRangeDraft, sharedDownloadCustomRangeProof,
  type SharedDownloadRangeDraft } from '../application/SharedDownloadRangeDraft';
import { SharedDownloadActionButton, sharedDownloadChapterUnit, sharedDownloadFocusKey, sharedDownloadVisualIcon, type DownloadChoice,
  sharedDownloadPrimaryInk, sharedDownloadSelectWidth, sharedDownloadControlHeight,
  sharedDownloadChapterProof, sharedDownloadChapterIsRunning, sharedDownloadCurrentChapter, type SharedDownloadFilterField, type SharedDownloadFrameView } from './SharedDownloadBookList';

export interface SharedDownloadSheetFacts {
  readonly appForeground: () => boolean;
  readonly appearancePreferences: () => ReaderNavigationPreferences;
  readonly batchRecovery: () => ReaderRecoveryView;
  readonly books: () => DownloadBookView[];
  readonly covered: () => boolean;
  readonly loading: () => boolean;
  readonly reduceMotion: () => boolean;
  readonly systemScheme: () => string;
  readonly storagePolicy: () => DownloadStoragePolicyView | undefined;
  readonly storagePolicyBusy: () => boolean;
  readonly storageSummary: () => DownloadStorageSummary;
  readonly storageCleanupBusy: () => boolean;
}

export interface SharedDownloadModal {
  readonly sheet: () => string;
  readonly confirmation: () => string;
}

/** Native BuilderParam callbacks close over the mounted lexical page. */
export interface SharedDownloadSheetSlots {
  readonly operationsHeader: (opening: number) => void;
  readonly operationsBody: (opening: number) => void;
  readonly storageCleanupIcon: () => void;
  readonly confirmationSurface: (opening: number, width: number, height: number) => void;
  readonly confirmationBody: (opening: number, viewportHeight: number) => void;
}

export interface SharedDownloadSheetBooks {
  readonly detail: () => DownloadBookView | undefined;
  readonly visibleSelectedBooks: () => DownloadBookView[];
  readonly retireSearchInput: () => void;
  readonly retireEmptyBookSelection: () => void;
  readonly deferSelectionCloseAfterRemoval: () => void;
  readonly sourceChoices: () => DownloadChoice[];
  readonly sortChoices: () => DownloadChoice[];
  readonly stateChoices: () => DownloadChoice[];
}

export interface SharedDownloadSheetChapters {
  readonly selectedCount: () => number;
  readonly invalidateReadingHandoff: () => void;
  readonly selectionProofs: () => SharedDownloadExpectedChapter[];
}

export interface SharedDownloadSheetsView {
  readonly frame: SharedDownloadFrameView;
  readonly input: SharedDownloadSheetFacts;
  readonly books: SharedDownloadSheetBooks;
  readonly chapters: SharedDownloadSheetChapters;
  readonly modal: SharedDownloadModal;
  readonly sheetSlots: SharedDownloadSheetSlots;
  readonly setSheet: (kind: string) => void;
  readonly setConfirmation: (kind: string) => void;
  readonly filters: () => SharedDownloadFilters;
  readonly setFilter: (field: SharedDownloadFilterField, value: string) => void;
  readonly measurementGeneration: () => number;
  readonly onRefreshBatchRecovery: (generation: number) => void;
  readonly onIntent: (intent: SharedDownloadUiIntent) => void;
}

@Observed
export class SharedDownloadSheetsPaint {
  @Track filterSourceOptions: DownloadChoice[] = [];
  @Track actionBookKeys: string[] = [];
  @Track actionChapters: SharedDownloadExpectedChapter[] = [];
  @Track rangeDraft: SharedDownloadRangeDraft = openSharedDownloadRangeDraft();
  @Track rangeBookOptions: DownloadChoice[] = [];
  @Track sheetTitleMeasuredHeight: number = DOWNLOAD_VISUAL.sheetTitleHeight;
  @Track operationsHeaderMeasuredHeight: number = 0;
  @Track dialogActionsMeasuredHeight: number = DOWNLOAD_VISUAL.buttonHeight;
  @Track sheetFooterMeasuredHeight: number = DOWNLOAD_VISUAL.buttonHeight + DOWNLOAD_VISUAL.sheetFooterTop + DOWNLOAD_VISUAL.sheetFooterBottom + DOWNLOAD_VISUAL.borderWidth;
  @Track sheetExitPending: boolean = false;
  @Track sheetOpeningGeneration: number = 0;
  @Track confirmationGeneration: number = 0;
}

/** Owns native modal attachments, entry/exit receipts, input leases and the staged action arguments. */
export class SharedDownloadSheetsOwner {
  readonly view: SharedDownloadSheetsView;
  readonly paint: () => SharedDownloadSheetsPaint;

  constructor(view: SharedDownloadSheetsView, paint: () => SharedDownloadSheetsPaint) {
    this.view = view;
    this.paint = paint;
  }

  readonly rangeEditingHost: ReaderEditingVisibility = new ReaderEditingVisibility();

  readonly rangeScroll: ReaderEditingScrollBinding = new ReaderEditingScrollBinding();

  readonly rangeScroller: Scroller = new Scroller();

  readonly rangeStartController: TextInputController = new TextInputController();

  readonly rangeEndController: TextInputController = new TextInputController();

  readonly rangeStartTarget: ReaderEditableTarget = new ReaderEditableTarget();

  readonly rangeEndTarget: ReaderEditableTarget = new ReaderEditableTarget();

  private overlayChromeClaimed: boolean = false;

  private overlayChromeRequestGeneration: number = 0;

  private sheetWasVisible: boolean = false;

  sheetMaskReady: boolean = false;
  private sheetActorGeneration: number = 0;

  sheetActorAttachment: number = 0;

  sheetActorOwner: number = -1;
  private sheetActors: string[] = [];
  private previousConfirmation: string = '';

  sheetTriggerKey: string = '';

  sheetLayoutTag(): LayoutInvariantTag {
    return { role: 'modal-overlay', id: 'download-sheet', active: this.view.modal.sheet().length > 0,
      closeDurationMs: READER_SHEET_CLOSE_MS, intercepts: this.view.modal.sheet().length > 0 || this.paint().sheetExitPending };
  }

  isOperationsSheet(): boolean { return this.view.modal.sheet() === 'book-actions' || this.view.modal.sheet() === 'chapter-actions'; }

  operationsSheetUsesNativeMaterial(): boolean {
    return this.isOperationsSheet() &&
      readerSurfaceMaterialDecision('modalSheet', this.view.input.appearancePreferences(), this.view.frame.scheme(), this.view.input.systemScheme()).native;
  }

  sheetScrimColor(): string {
    return readerAppColor(this.isOperationsSheet() ? resolveDrawerSpec('reader-action-sheet').scrimRole :
      'app.scrim.warmModal', this.view.frame.scheme());
  }

  operationsSurfaceWidth(): number {
    return readerDynamicSurfaceWidth(resolveDrawerSpec('reader-action-sheet').maxWidth,
      Math.max(0, this.view.frame.layout.pageViewportWidth() - this.sheetSafeLeft() - this.sheetSafeRight()));
  }

  operationsBottomInset(): number {
    const safe = readerStableInteractiveSafeBottom(this.view.frame.metrics());
    return this.view.modal.sheet() === 'book-actions' ? Math.max(20, safe) : safe;
  }

  operationsHeaderHeight(): number {
    const spec = resolveDrawerSpec('reader-action-sheet');
    return Math.max(this.paint().operationsHeaderMeasuredHeight,
      spec.handleZone + Math.max(spec.titleHeight, spec.titleLineHeight * this.view.frame.fontScale()));
  }

  operationsActions(): ReaderMenuActionView[] {
    const books = this.actionBooks();
    const deletion = books.some((book: DownloadBookView): boolean => book.sourceId !== 'local') ? [
      new ReaderMenuActionView('deleteLocal', '删除本地内容', this.actionAvailable('deleteLocal', books),
        readerActionIcon('trash', this.view.frame.scheme()), '删除本地内容', '', '', '', 'danger'),
    ] : [];
    if (this.view.modal.sheet() === 'book-actions') {
      if (this.view.frame.mount.managing() && this.view.frame.mount.detailKey().length === 0) {
        return [
          new ReaderMenuActionView('cancel', '取消下载任务', this.actionAvailable('cancel'), readerActionIcon('close', this.view.frame.scheme())),
          ...deletion,
        ];
      }
      const complete = books.length > 0 && books.every((book: DownloadBookView): boolean => book.projectionStatus === 'ready' &&
        book.totalChapters !== undefined && book.totalChapters > 0 && book.downloadedChapters === book.totalChapters &&
        book.chapters.filter((chapter: DownloadChapterView): boolean => chapter.navigable).length === book.totalChapters &&
        book.chapters.filter((chapter: DownloadChapterView): boolean => chapter.navigable).every((chapter: DownloadChapterView): boolean => chapter.localComplete));
      const cancel = !complete && this.actionAvailable('cancel');
      return [
        new ReaderMenuActionView(cancel ? 'cancel' : 'download', complete ? '已下载' : cancel ? '取消下载' : '下载',
          !complete && this.actionAvailable(cancel ? 'cancel' : 'download'), readerActionIcon(complete ? 'check' : cancel ? 'close' : 'download', this.view.frame.scheme())),
        ...deletion,
      ];
    }
    // Chapter actions retain their established download/pause/cancel entries.
    const running = this.selectedIsRunning();
    return [
      new ReaderMenuActionView(running ? 'pause' : 'download', running ? '暂停' : '下载',
        this.actionAvailable(running ? 'pause' : 'download'), readerActionIcon(running ? 'pause' : 'download', this.view.frame.scheme())),
      new ReaderMenuActionView('cancel', '取消下载任务', this.actionAvailable('cancel'), readerActionIcon('close', this.view.frame.scheme())),
      ...deletion,
    ];
  }

  performOperationsAction(id: string, ownerGeneration: number, opening: number): void {
    if (!this.view.frame.uiInputIsCurrent(ownerGeneration) || !this.sheetOpeningIsCurrent(opening) || !this.isOperationsSheet()) return;
    const action = this.operationsActions().find((item: ReaderMenuActionView): boolean => item.id === id);
    if (action === undefined || !action.enabled) return;
    if (id === 'pause') this.sendAction('pause');
    else if (id === 'download') {
      if (this.view.modal.sheet() === 'book-actions') {
        this.prepareRange(this.paint().actionBookKeys[0] ?? ''); this.view.setSheet('range');
      } else this.sendAction('download');
    } else if (id === 'cancel' || id === 'deleteLocal') {
      this.view.setConfirmation(id);
    }
  }

  mountRangeEditing(start: boolean, opening: number, revision: number): void {
    if (!this.view.frame.mount.mounted() || opening !== this.paint().sheetOpeningGeneration || revision !== this.paint().rangeDraft.revision || this.view.modal.sheet() !== 'range') return;
    const target = start ? this.rangeStartTarget : this.rangeEndTarget;
    target.mount(this.view.frame.getUIContext(), this.rangeEditingHost, start ? this.rangeStartController : this.rangeEndController,
      (): boolean => this.sheetOpeningIsCurrent(opening) && revision === this.paint().rangeDraft.revision &&
        this.paint().rangeDraft.catalog !== undefined && !this.paint().rangeDraft.catalogChanged,
      (): number => DOWNLOAD_VISUAL.controlLineHeight * this.view.frame.fontScale(), this.rangeInputId(start, opening, revision));
  }

  rangeInputId(start: boolean, opening: number, revision: number): string {
    return `${start ? this.rangeStartTarget.id : this.rangeEndTarget.id}:${opening}:${revision}`;
  }

  confirmationActionAvailable(): boolean {
    if (this.view.modal.confirmation() === 'cleanup') return this.storageCleanupAvailable();
    if (this.view.modal.confirmation() === 'cancel') return this.actionAvailable('cancel');
    return this.view.modal.confirmation() === 'deleteLocal' && this.actionAvailable('deleteLocal');
  }

  confirmationTitle(): string {
    if (this.view.modal.confirmation() === 'cleanup') return '清理临时缓存？';
    const books = this.removalActionBooks(this.view.modal.confirmation() === 'cancel' ? 'cancel' : 'deleteLocal');
    const label = this.view.modal.confirmation() === 'cancel' ? '取消任务' : '删除内容';
    if (this.paint().actionChapters.length > 0)
      return `确认${label} · ${this.paint().actionChapters.length}${sharedDownloadChapterUnit(books[0])}？`;
    const title = this.view.modal.confirmation() === 'cancel' ? '取消下载任务？' : '删除本地内容？';
    return `${title}（${books.length}本书）`;
  }

  confirmationCopy(): string {
    if (this.view.modal.confirmation() === 'cleanup')
      return `将清理 ${formatDownloadStorageBytes(this.view.input.storageSummary().cleanableBytes)} 的临时缓存。保留下载、正在阅读和下载的内容不受影响，书架与阅读记录保留。`;
    if (this.paint().actionChapters.length > 0)
      return this.view.modal.confirmation() === 'cancel' ? '仅取消所选章节的剩余下载，已下载内容保留。' :
        '仅删除所选章节的本地内容，并取消这些章节的剩余下载。书架和阅读记录保留。';
    return this.view.modal.confirmation() === 'cancel' ? '已下载的内容会保留，可以继续阅读。' :
      '删除所选书籍的本地内容，之后阅读需要重新获取。书架与阅读记录保留。';
  }

  storageCleanupAvailable(): boolean {
    return !this.view.input.storageCleanupBusy() && canCleanDownloadStorage(this.view.input.storageSummary());
  }

  storageCleanLabel(): string {
    if (this.view.input.storageCleanupBusy()) return '正在清理临时缓存…';
    if (formatDownloadStorageBytes(this.view.input.storageSummary().cleanableBytes).length === 0) return '清理临时缓存';
    return canCleanDownloadStorage(this.view.input.storageSummary()) ?
      `清理临时缓存 · ${formatDownloadStorageBytes(this.view.input.storageSummary().cleanableBytes)}` : '暂无可清理的临时缓存';
  }

  openStorageCleanup(generation: number = this.view.frame.mount.presentationGeneration(), opening: number = this.paint().sheetOpeningGeneration): void {
    if (!this.view.frame.presentationIsCurrent(generation) || !this.sheetOpeningIsCurrent(opening) ||
      this.view.modal.sheet() !== 'settings' || !this.storageCleanupAvailable()) return;
    this.view.setConfirmation('cleanup');
  }

  confirmStorageCleanup(generation: number = this.view.frame.mount.presentationGeneration()): void {
    if (!this.view.frame.uiInputIsCurrent(generation) || this.view.modal.confirmation() !== 'cleanup' || !this.storageCleanupAvailable()) return;
    this.view.setConfirmation(''); this.sendAction('cleanup');
  }

  modalBlocking(): boolean {
    return this.view.modal.sheet().length > 0 || this.view.modal.confirmation().length > 0 || this.paint().sheetExitPending;
  }

  sheetOpeningIsCurrent(opening: number): boolean {
    return this.view.frame.uiInputIsCurrent() && this.view.modal.sheet().length > 0 &&
      this.paint().sheetOpeningGeneration === opening && this.view.modal.confirmation().length === 0;
  }

  confirmationIsCurrent(opening: number, generation: number): boolean {
    return this.view.frame.uiInputIsCurrent(generation) && this.view.modal.confirmation().length > 0 &&
      this.paint().confirmationGeneration === opening;
  }

  openSheet(kind: string, trigger: string): void {
    if (!this.view.frame.uiInputIsCurrent() || this.modalBlocking()) return;
    if (kind === 'filter') this.paint().filterSourceOptions = this.view.books.sourceChoices();
    this.sheetTriggerKey = trigger;
    this.view.setSheet(kind);
  }

  onSheetChanged(): void {
    this.view.books.retireSearchInput();
    this.view.chapters.invalidateReadingHandoff();
    this.paint().sheetOpeningGeneration += 1;
    const visible = this.view.modal.sheet().length > 0;
    if (visible !== this.sheetWasVisible) {
      this.sheetWasVisible = visible;
      this.sheetMaskReady = false;
      if (visible) {
        this.sheetActorAttachment = ++this.sheetActorGeneration;
        this.sheetActorOwner = this.view.frame.mount.presentationGeneration();
        this.sheetActors = [];
        this.paint().sheetExitPending = false;
      } else {
        this.paint().sheetExitPending = this.sheetActors.length > 0;
        if (!this.paint().sheetExitPending) this.retireSheetActors();
      }
    }
    this.syncOverlayChrome();
    this.view.books.retireEmptyBookSelection();
    this.view.frame.syncOverlayFocus();
    if (READER_LAYOUT_DEBUG_BUILD) readerLayoutInvariantChanged();
  }

  onConfirmationChanged(): void {
    this.view.books.retireSearchInput();
    this.view.chapters.invalidateReadingHandoff();
    this.paint().confirmationGeneration += 1;
    const returnToCleanup = this.previousConfirmation === 'cleanup' &&
      this.view.modal.confirmation().length === 0 && this.view.modal.sheet() === 'settings';
    this.previousConfirmation = this.view.modal.confirmation();
    this.syncOverlayChrome();
    this.view.frame.syncOverlayFocus(returnToCleanup ? 'storage-clean' : '');
  }

  sheetActorIsCurrent(attachment: number, ownerGeneration: number): boolean {
    return attachment > 0 && attachment === this.sheetActorAttachment && ownerGeneration === this.sheetActorOwner &&
      this.view.frame.presentationIsCurrent(ownerGeneration);
  }

  onSheetActorAppeared(attachment: number, ownerGeneration: number, part: string, opening: number = -1): void {
    if (!this.sheetActorIsCurrent(attachment, ownerGeneration) || this.view.modal.sheet().length === 0 || this.paint().sheetExitPending ||
      (opening >= 0 && opening !== this.paint().sheetOpeningGeneration) || this.sheetActors.includes(part)) return;
    this.sheetActors = [...this.sheetActors, part];
  }

  onSheetActorTransitionFinished(attachment: number, ownerGeneration: number, part: string, transitionIn: boolean): void {
    if (!this.sheetActorIsCurrent(attachment, ownerGeneration) || !this.sheetActors.includes(part)) return;
    if (transitionIn) {
      if (part === 'scrim' && this.view.modal.sheet().length > 0) this.sheetMaskReady = true;
      return;
    }
    this.sheetActors = this.sheetActors.filter((candidate: string): boolean => candidate !== part);
    if (this.paint().sheetExitPending && this.sheetActors.length === 0) this.onSheetExitFinished(attachment, ownerGeneration);
  }

  private onSheetExitFinished(attachment: number, ownerGeneration: number): void {
    if (!this.sheetActorIsCurrent(attachment, ownerGeneration) || !this.paint().sheetExitPending ||
      this.view.modal.sheet().length > 0 || this.sheetActors.length > 0) return;
    this.retireSheetActors();
    this.paint().sheetExitPending = false;
    this.syncOverlayChrome();
    this.view.books.retireEmptyBookSelection();
    this.view.frame.syncOverlayFocus();
    if (READER_LAYOUT_DEBUG_BUILD) readerLayoutInvariantChanged();
  }

  retireAttachment(): void {
    this.overlayChromeRequestGeneration += 1;
    this.retireSheetActors();
  }

  resetExitPaint(disappearing: boolean): void {
    if (disappearing) this.sheetWasVisible = false;
    this.sheetMaskReady = false;
    this.paint().sheetExitPending = false;
  }

  ownsOverlayChrome(): boolean { return this.overlayChromeClaimed; }

  releaseUnmountedChrome(restore: boolean): void {
    this.overlayChromeClaimed = false;
    if (restore) ReaderWindowCoordinator.requestAppChrome();
  }

  releaseReplacedChrome(): void {
    if (this.overlayChromeClaimed) ReaderWindowCoordinator.requestAppChrome();
    this.overlayChromeClaimed = false;
  }

  openBookActions(bookKey: string): void {
    this.stageAction(bookKey, []);
    this.openSheet('book-actions', 'book-menu:' + bookKey);
  }

  activateBookStatus(book: DownloadBookView): void {
    this.stageAction(book.key, []);
    if (book.statusAction === 'pause') this.sendAction('pause');
    else {
      this.prepareRange(book.key);
      this.openSheet('range', 'book-status:' + book.key);
    }
  }

  runChapterAction(bookKey: string, proof: SharedDownloadExpectedChapter, action: 'download' | 'pause'): void {
    this.stageAction(bookKey, [proof]);
    this.sendAction(action);
  }

  openChapterActions(bookKey: string, proof: SharedDownloadExpectedChapter, trigger: string): void {
    this.stageAction(bookKey, [proof]);
    this.openSheet('chapter-actions', trigger);
  }

  runSelectedChapters(action: 'download' | 'pause'): void {
    if (this.captureSelection(true)) this.sendAction(action);
  }

  openSelectionActions(chapters: boolean): void {
    if (this.captureSelection(chapters)) this.openSheet(chapters ? 'chapter-actions' : 'book-actions', 'selection-more');
  }

  canRemoveBooks(books: DownloadBookView[]): boolean {
    return this.actionAvailable('cancel', books, []) || this.actionAvailable('deleteLocal', books, []);
  }

  private stageAction(bookKey: string, chapters: SharedDownloadExpectedChapter[]): void {
    this.paint().actionBookKeys = [bookKey];
    this.paint().actionChapters = chapters;
  }

  private retireSheetActors(): void {
    this.sheetActorGeneration += 1;
    this.sheetActorAttachment = 0;
    this.sheetActorOwner = -1;
    this.sheetActors = [];
  }

  syncOverlayChrome(): void {
    if (!this.view.frame.presentationIsCurrent()) return;
    const identity = this.view.frame.mount.mountedIdentity();
    const generation = this.view.frame.mount.presentationGeneration();
    const requestGeneration = ++this.overlayChromeRequestGeneration;
    // sheet -> confirmation is one visible overlay transition. Read final
    // state after synchronous Watch callbacks, without exposing App chrome.
    void Promise.resolve().then((): void => {
      if (!this.view.frame.presentationIsCurrent(generation) || this.view.frame.mount.mountedIdentity() !== identity ||
        requestGeneration !== this.overlayChromeRequestGeneration) return;
      if (this.paint().sheetExitPending && this.view.modal.sheet().length === 0 && this.view.modal.confirmation().length === 0) return;
      if (this.view.modal.sheet().length > 0 || this.view.modal.confirmation().length > 0) {
        ReaderWindowCoordinator.requestOverlayChrome(this.overlayWindowChrome());
        this.overlayChromeClaimed = true;
      } else if (this.overlayChromeClaimed) {
        ReaderWindowCoordinator.requestAppChrome();
        this.overlayChromeClaimed = false;
      }
    });
  }

  private overlayWindowChrome(): ReaderWindowChromeStyle {
    const scheme = this.view.frame.scheme();
    const hasSheet = this.view.modal.sheet().length > 0;
    const operationsSheet = this.isOperationsSheet();
    const sheetVisible = hasSheet && (!operationsSheet || this.view.modal.confirmation().length === 0);
    const scrim = resolveReaderModalScrimSpec(this.view.input.appearancePreferences(), scheme,
      hasSheet ? this.sheetScrimColor() : downloadVisualColor('scrim', scheme),
      hasSheet && this.operationsSheetUsesNativeMaterial()).scrimColor;
    const pageInk = downloadVisualColor('ink', scheme);
    const statusPaper = readerScrimmedOpaqueColor(downloadVisualColor('paper', scheme), scrim);
    const statusInk = readerScrimmedOpaqueColor(pageInk, scrim);
    let navigationPaper = statusPaper;
    let navigationInk = statusInk;
    if (sheetVisible) {
      const drawer = resolveDrawerSpec('reader-action-sheet');
      const operationsRole = isReaderRealtimeBlurEnabled(this.view.input.appearancePreferences()) ? drawer.surfaceRole : 'TOK_SURFACE_SOLID';
      navigationPaper = readerAppColor(operationsSheet ? operationsRole : 'app.surface.menuSolid', scheme);
      navigationInk = operationsSheet ? readerAppColor(drawer.inkRole, scheme) : pageInk;
    }
    const style = new ReaderWindowChromeStyle(statusPaper, scheme === 'night' ? 'light' : 'dark', statusInk);
    style.navigationUnderlayColor = navigationPaper;
    style.navigationContentColor = navigationInk;
    return style;
  }

  private removalActionBooks(action: 'cancel' | 'deleteLocal'): DownloadBookView[] {
    const books = this.actionBooks().filter((book: DownloadBookView): boolean =>
      action !== 'deleteLocal' || book.sourceId !== 'local');
    if (!this.view.frame.mount.managing() || this.view.frame.mount.detailKey().length > 0) return books;
    return books.filter((book: DownloadBookView): boolean => this.actionAvailable(action, [book], []));
  }

  actionBooks(): DownloadBookView[] {
    if (!this.view.frame.mount.managing() || this.view.frame.mount.detailKey().length > 0)
      return this.view.input.books().filter((book: DownloadBookView): boolean => this.paint().actionBookKeys.includes(book.key));
    const books = this.view.books.visibleSelectedBooks().filter((book: DownloadBookView): boolean => this.paint().actionBookKeys.includes(book.key));
    return books.length === this.paint().actionBookKeys.length ? books : [];
  }

  private captureSelection(chapters: boolean): boolean {
    const book = this.view.books.detail();
    const visible = chapters ? [] : this.view.books.visibleSelectedBooks()
      .map((entry: DownloadBookView): string => entry.key);
    if (chapters ? book === undefined || this.view.chapters.selectedCount() === 0 :
      this.view.frame.mount.detailKey().length > 0 || visible.length === 0) return false;
    this.paint().actionBookKeys = book === undefined ? visible : [book.key];
    this.paint().actionChapters = chapters ? this.view.chapters.selectionProofs() : [];
    return true;
  }

  private actionChapterRows(book: DownloadBookView, proofs: SharedDownloadExpectedChapter[] = this.paint().actionChapters): DownloadChapterView[] {
    const expected = new Map<number, string>();
    proofs.forEach((chapter: SharedDownloadExpectedChapter): void => {
      if (chapter.chapterId.length > 0) expected.set(chapter.chapterIndex, chapter.chapterId);
    });
    return book.chapters.filter((chapter: DownloadChapterView): boolean => chapter.navigable &&
      (proofs.length === 0 || expected.get(chapter.index) === chapter.chapterId));
  }

  private selectedIsRunning(): boolean {
    return this.actionBooks().some((book: DownloadBookView): boolean =>
      this.actionChapterRows(book).some((chapter: DownloadChapterView): boolean => sharedDownloadChapterIsRunning(chapter)));
  }

  actionAvailable(action: SharedDownloadUiAction, books: DownloadBookView[] = this.actionBooks(),
    proofs: SharedDownloadExpectedChapter[] = this.paint().actionChapters): boolean {
    return books.some((book: DownloadBookView): boolean => {
      if (book.projectionStatus !== 'ready' || (action === 'deleteLocal' && book.sourceId === 'local')) return false;
      const chapters = this.actionChapterRows(book, proofs);
      if (proofs.length > 0 && chapters.length !== proofs.length) return false;
      if (action === 'download') return chapters.some((chapter: DownloadChapterView): boolean => !chapter.localComplete && chapter.queueState !== 'unknown');
      if (action === 'pause') return chapters.some((chapter: DownloadChapterView): boolean => sharedDownloadChapterIsRunning(chapter));
      if (action === 'cancel') return chapters.some((chapter: DownloadChapterView): boolean => sharedDownloadChapterIsRunning(chapter) || chapter.queueState === 'paused' || chapter.queueState === 'failed');
      return chapters.some((chapter: DownloadChapterView): boolean => chapter.localComplete || (chapter.cachedBytes ?? 0) > 0);
    });
  }

  sourceFilterLabel(): string {
    return this.paint().filterSourceOptions.find((choice: DownloadChoice): boolean => choice.id === this.view.filters().sourceId)?.label ?? '全部书源';
  }

  sheetTitle(): string {
    if (this.view.modal.sheet() === 'filter') return '筛选'; if (this.view.modal.sheet() === 'sort') return '排序';
    if (this.view.modal.sheet() === 'settings') return '存储管理'; if (this.view.modal.sheet() === 'range') return '下载范围';
    return this.view.modal.sheet() === 'chapter-actions' ? `章节操作 · 已选 ${this.paint().actionChapters.length}${sharedDownloadChapterUnit(this.actionBooks()[0])}`
      : this.actionBooks().length === 1 ? this.actionBooks()[0].title : `书籍操作 · 已选 ${this.actionBooks().length} 本`;
  }

  prepareRange(bookKey: string): void {
    const books = this.actionBooks();
    const titleCounts = new Map<string, number>();
    for (const book of books) titleCounts.set(book.title, (titleCounts.get(book.title) ?? 0) + 1);
    const reserved = new Set<string>(books.map((book: DownloadBookView): string => book.title));
    // Freeze labels for this opening so a live list reorder or removal never
    // turns a previously displayed option into another book.
    this.paint().rangeBookOptions = books.map((book: DownloadBookView): DownloadChoice => {
      if (titleCounts.get(book.title) === 1) return { id: book.key, label: book.title };
      const base = `${book.title} · ${book.sourceLabel.trim() || '同名书籍'}`;
      let label = base;
      let ordinal = 2;
      while (reserved.has(label)) {
        label = `${base} (${ordinal})`;
        ordinal += 1;
      }
      reserved.add(label);
      return { id: book.key, label };
    });
    this.paint().rangeDraft = resetSharedDownloadRangeDraft(this.paint().rangeDraft, bookKey, 'all');
    this.syncRangeCatalog();
  }

  availableRangeBooks(): DownloadChoice[] {
    const currentKeys = new Set<string>(this.actionBooks().map((book: DownloadBookView): string => book.key));
    return this.paint().rangeBookOptions.filter((choice: DownloadChoice): boolean => currentKeys.has(choice.id));
  }

  resetRangeDraft(bookKey: string): void {
    this.paint().rangeDraft = resetSharedDownloadRangeDraft(this.paint().rangeDraft, bookKey);
    this.syncRangeCatalog();
  }

  selectRangeChoice(choice: string): void {
    const draft = this.paint().rangeDraft;
    const next = chooseSharedDownloadRange(draft, choice);
    if (next === draft) return;
    this.paint().rangeDraft = next;
    this.syncRangeCatalog();
  }

  updateRangeBound(value: string, start: boolean, opening: number, revision: number): void {
    if (!this.sheetOpeningIsCurrent(opening) || this.view.modal.sheet() !== 'range') return;
    this.paint().rangeDraft = editSharedDownloadRangeBound(this.paint().rangeDraft, revision, start, value);
  }

  rangeBook(): DownloadBookView | undefined {
    return this.actionBooks().find((book: DownloadBookView): boolean => book.key === this.paint().rangeDraft.bookKey);
  }

  syncRangeCatalog(): void {
    if (!this.view.frame.presentationIsCurrent() || this.view.modal.sheet() !== 'range' || this.paint().rangeDraft.catalogChanged) return;
    this.paint().rangeDraft = observeSharedDownloadRangeCatalog(this.paint().rangeDraft, this.rangeBook());
  }

  rangeEligible(): boolean {
    if (this.actionBooks().length === 0) return false;
    const draft = this.paint().rangeDraft;
    if (draft.choice === 'all') return this.actionAvailable('download');
    const book = this.rangeBook();
    if (book === undefined) return false;
    if (draft.choice === 'forward') return sharedDownloadCurrentChapter(book) !== undefined;
    return sharedDownloadCustomRangeProof(draft, book) !== undefined;
  }

  sendRange(): void {
    if (!this.view.frame.uiInputIsCurrent() || !this.rangeEligible()) return;
    const draft = this.paint().rangeDraft;
    const targets: SharedDownloadUiBookTarget[] = [];
    for (const book of this.actionBooks()) {
      if (draft.choice === 'all') {
        targets.push({ sourceId: book.sourceId, bookId: book.bookId });
        continue;
      }
      if (book.key !== draft.bookKey) continue;
      let proof: SharedDownloadExpectedChapter[] | undefined;
      if (draft.choice === 'forward') {
        const current = sharedDownloadCurrentChapter(book)?.index;
        proof = book.chapters.filter((chapter: DownloadChapterView): boolean =>
          chapter.navigable && current !== undefined && chapter.index >= current)
          .map((chapter: DownloadChapterView): SharedDownloadExpectedChapter => sharedDownloadChapterProof(chapter));
      } else {
        proof = sharedDownloadCustomRangeProof(draft, book);
        if (proof === undefined) return;
      }
      targets.push({ sourceId: book.sourceId, bookId: book.bookId,
        chapterIndices: proof.map((chapter: SharedDownloadExpectedChapter): number => chapter.chapterIndex),
        expectedChapters: proof });
    }
    this.view.setSheet('');
    this.view.onIntent({ action: 'download', scope: 'books', books: targets });
  }

  sendAction(action: 'download' | 'pause' | 'cancel' | 'deleteLocal' | 'cleanup'): void {
    if (!this.view.frame.uiInputIsCurrent()) return;
    const storage = action === 'cleanup';
    const scoped = !storage && this.paint().actionChapters.length > 0;
    if (scoped && !this.actionAvailable(action)) return;
    const books = storage ? [] : (action === 'cancel' || action === 'deleteLocal') ?
      this.removalActionBooks(action) : this.actionBooks();
    const targets = books.map((book: DownloadBookView): SharedDownloadUiBookTarget => ({
      sourceId: book.sourceId, bookId: book.bookId,
      chapterIndices: scoped ? this.paint().actionChapters.map((chapter: SharedDownloadExpectedChapter): number => chapter.chapterIndex) : undefined,
      expectedChapters: scoped ? this.paint().actionChapters.slice() : undefined,
    }));
    if (!storage && targets.length === 0) return;
    if (this.view.frame.mount.managing() && this.view.frame.mount.detailKey().length === 0 && (action === 'cancel' || action === 'deleteLocal'))
      this.view.books.deferSelectionCloseAfterRemoval();
    this.view.setSheet('');
    this.view.onIntent({ action, scope: storage ? 'storage' : scoped ? 'chapters' : 'books', books: targets });
  }

  private limitChoices(): number[] {
    const capacity = this.view.input.storagePolicy()?.capacityBytes;
    if (capacity === undefined) return [];
    const current = capacity / (1024 * 1024);
    const choices = [512, 1024, 2048, 4096];
    if (!choices.includes(current)) choices.push(current);
    return choices;
  }

  limitLabels(): string[] {
    const labels = this.limitChoices().map((limit: number): string => formatDownloadStorageBytes(limit * 1024 * 1024));
    const last = labels.length - 1;
    if (last >= 0 && labels.indexOf(labels[last]) !== last) labels[last] += '（当前）';
    return labels;
  }

  private dayChoices(): number[] {
    const current = this.view.input.storagePolicy()?.expiryDays;
    if (current === undefined) return [];
    const choices = [3, 7, 14, 30];
    if (!choices.includes(current)) choices.push(current);
    return choices;
  }

  dayLabels(): string[] { return this.dayChoices().map((days: number): string => `${days} 天`); }

  limitIndex(): number { return this.limitChoices().indexOf((this.view.input.storagePolicy()?.capacityBytes ?? -1) / (1024 * 1024)); }

  daysIndex(): number { return this.dayChoices().indexOf(this.view.input.storagePolicy()?.expiryDays ?? -1); }

  changeStoragePolicy(opening: number, kind: 'capacity' | 'expiry', value: string): void {
    if (!this.sheetOpeningIsCurrent(opening) || this.view.modal.sheet() !== 'settings') return;
    const policy = this.view.input.storagePolicy();
    if (policy === undefined || this.view.input.storagePolicyBusy()) return;
    if (kind === 'capacity') {
      const limit = this.limitChoices()[this.limitLabels().indexOf(value)];
      if (limit !== undefined && limit * 1024 * 1024 !== policy.capacityBytes)
        this.view.onIntent({ action: 'configureStorage', scope: 'storage', books: [], cacheLimitMb: limit });
    } else {
      const days = this.dayChoices()[this.dayLabels().indexOf(value)];
      if (days !== undefined && days !== policy.expiryDays)
        this.view.onIntent({ action: 'configureStorage', scope: 'storage', books: [], cleanupAfterDays: days });
    }
  }

  storageSelectWidth(): number {
    const available = Math.max(0, this.view.frame.metrics().windowRect.width - DOWNLOAD_VISUAL.sheetBodySide * 2 - DOWNLOAD_VISUAL.storageSettingsGap);
    return Math.min(DOWNLOAD_VISUAL.storageSelectWidth * this.view.frame.fontScale(), available / 2);
  }

  sheetSafeLeft(): number { return readerPageSafeLeft(this.view.frame.metrics(), this.view.frame.mount.pageOriginX(), true); }

  sheetSafeRight(): number {
    return readerPageSafeRight(this.view.frame.metrics(), this.view.frame.mount.pageOriginX(), this.view.frame.layout.pageViewportWidth(), true);
  }

  sheetMaxHeight(): number { return sharedDownloadSheetMaxHeight(this.view.frame.layout.availableHeight(), 0, 0); }

  sheetHasFooter(): boolean { return ['filter', 'sort', 'range', 'settings'].includes(this.view.modal.sheet()); }

  sheetFooterBottomInset(): number {
    return Math.max(this.view.modal.sheet() === 'settings' ? DOWNLOAD_VISUAL.storageFooterBottom : DOWNLOAD_VISUAL.sheetFooterBottom,
      readerStableInteractiveSafeBottom(this.view.frame.metrics()));
  }

  sheetBodyBottomInset(): number {
    if (this.view.modal.sheet() === 'settings') return 0;
    return this.sheetHasFooter() ? DOWNLOAD_VISUAL.sheetBodyBottom :
      Math.max(DOWNLOAD_VISUAL.sheetBodyBottom, readerStableInteractiveSafeBottom(this.view.frame.metrics()));
  }

  private sheetChromeHeight(): number {
    const grip = DOWNLOAD_VISUAL.gripTop + DOWNLOAD_VISUAL.gripHeight + DOWNLOAD_VISUAL.gripBottom;
    const title = Math.max(DOWNLOAD_VISUAL.sheetTitleHeight, this.paint().sheetTitleMeasuredHeight);
    const footer = this.sheetHasFooter() ? Math.max(this.paint().sheetFooterMeasuredHeight,
      sharedDownloadControlHeight(this.view.frame.fontScale(), DOWNLOAD_VISUAL.buttonHeight, DOWNLOAD_VISUAL.controlLineHeight,
        DOWNLOAD_VISUAL.buttonPaddingY * 2) + (this.view.modal.sheet() === 'settings' ? DOWNLOAD_VISUAL.storageFooterTop : DOWNLOAD_VISUAL.sheetFooterTop) +
          this.sheetFooterBottomInset() + (this.view.modal.sheet() === 'settings' ? 0 : DOWNLOAD_VISUAL.borderWidth)) : 0;
    return grip + title + footer;
  }

  sheetChromeOverflow(): boolean { return this.sheetChromeHeight() >= this.sheetMaxHeight(); }

  sheetBodyMaxHeight(): number { return readerSurfaceMaxHeight(this.sheetMaxHeight(), this.sheetChromeHeight()); }

  dialogChromeHeight(): number {
    const button = Math.max(this.paint().dialogActionsMeasuredHeight,
      sharedDownloadControlHeight(this.view.frame.fontScale(), DOWNLOAD_VISUAL.buttonHeight, DOWNLOAD_VISUAL.controlLineHeight, DOWNLOAD_VISUAL.buttonPaddingY * 2));
    const spec = resolveDialogSpec('download-confirmation');
    return 2 * (spec.padding + (spec.hasBorder ? 1 : 0)) + Math.max(spec.actionHeight, button);
  }

  confirmationHost(): ReaderRectVp | undefined {
    return this.view.frame.mount.pageWidth() > 0 && this.view.frame.mount.pageHeight() > 0 ?
      new ReaderRectVp(this.view.frame.mount.pageOriginX(), this.view.frame.mount.pageOriginY(), this.view.frame.mount.pageWidth(), this.view.frame.mount.pageHeight()) : undefined;
  }

  private recordSheetTitleHeight(height: number): void {
    if (Number.isFinite(height) && height > 0 && Math.abs(height - this.paint().sheetTitleMeasuredHeight) > 0.5) this.paint().sheetTitleMeasuredHeight = height;
  }

  sheetAreaHandler(slot: 'title' | 'footer' | 'operations-header', opening: number): (_old: Area, area: Area) => void {
    const presentation = this.view.frame.mount.presentationGeneration(), layout = this.view.measurementGeneration(), sheet = this.view.modal.sheet();
    return (_old: Area, area: Area): void => {
      if (!this.view.frame.presentationIsCurrent(presentation) || opening !== this.paint().sheetOpeningGeneration ||
        layout !== this.view.measurementGeneration() || sheet.length === 0 || sheet !== this.view.modal.sheet()) return;
      const height = readerPageAreaLength(area.height);
      if (slot === 'title') this.recordSheetTitleHeight(height);
      else if (slot === 'footer') this.recordSheetFooterHeight(height);
      else if (Number.isFinite(height) && height > 0) {
        if (slot === 'operations-header' && Math.abs(height - this.paint().operationsHeaderMeasuredHeight) > .5)
          this.paint().operationsHeaderMeasuredHeight = height;
      }
    };
  }

  confirmationAreaHandler(opening: number, presentation: number): (_old: Area, area: Area) => void {
    const layout = this.view.measurementGeneration(), confirmation = this.view.modal.confirmation();
    return (_old: Area, area: Area): void => {
      if (!this.view.frame.presentationIsCurrent(presentation) || opening !== this.paint().confirmationGeneration ||
        layout !== this.view.measurementGeneration() || confirmation.length === 0 || confirmation !== this.view.modal.confirmation()) return;
      const height = readerPageAreaLength(area.height);
      if (Number.isFinite(height) && height > 0 && Math.abs(height - this.paint().dialogActionsMeasuredHeight) > 0.5)
        this.paint().dialogActionsMeasuredHeight = height;
    };
  }

  private recordSheetFooterHeight(height: number): void {
    if (Number.isFinite(height) && height > 0 && Math.abs(height - this.paint().sheetFooterMeasuredHeight) > 0.5) this.paint().sheetFooterMeasuredHeight = height;
  }
}

interface SharedDownloadSheetsOwnerSlot {
  readonly owner: SharedDownloadSheetsOwner;
}

@Builder
export function SharedDownloadSheets($$: SharedDownloadSheetsOwnerSlot) {
  if ($$.owner.view.input.batchRecovery().visible && $$.owner.view.input.appForeground() && !$$.owner.view.input.covered() && !$$.owner.modalBlocking()) {
    Column() {
      ReaderRecoveryNotice({ view: $$.owner.view.input.batchRecovery(), layoutWidthVp: Math.max(0, $$.owner.view.frame.layout.pageViewportWidth() - $$.owner.view.frame.layout.leftInset() - $$.owner.view.frame.layout.rightInset()), maxHeightVp: Math.max(0, $$.owner.view.frame.layout.availableHeight() - $$.owner.view.frame.layout.contentTop() - $$.owner.view.frame.layout.bottomInset()), tag: '下载待处理', actionLabel: '刷新列表', busy: $$.owner.view.input.loading(),
        onReconcile: (generation: number): void => {
          if ($$.owner.view.frame.uiInputIsCurrent() && !$$.owner.modalBlocking() &&
            $$.owner.view.input.batchRecovery().visible && generation === $$.owner.view.input.batchRecovery().generation) $$.owner.view.onRefreshBatchRecovery(generation);
        } });
    }.width('100%').padding({ left: $$.owner.view.frame.layout.leftInset(), right: $$.owner.view.frame.layout.rightInset(), top: $$.owner.view.frame.layout.contentTop() })
      .hitTestBehavior(HitTestMode.Transparent);
  }
  if ($$.owner.view.modal.sheet().length > 0 || $$.owner.paint().sheetExitPending) {
    // Keep an empty carrier until its actually mounted Native actors exit.
    ForEach([$$.owner.sheetActorAttachment], (attachment: number): void => {
      Stack() { DownloadSheetOverlay($$.owner, { attachment: attachment, ownerGeneration: $$.owner.sheetActorOwner }); }.width('100%').height('100%')
        .customProperty(READER_LAYOUT_INVARIANT_PROPERTY, READER_LAYOUT_DEBUG_BUILD ? $$.owner.sheetLayoutTag() : undefined)
        .enabled($$.owner.view.modal.confirmation().length === 0)
        .accessibilityLevel($$.owner.view.modal.confirmation().length > 0 ? 'no-hide-descendants' : 'auto')
        .hitTestBehavior($$.owner.view.modal.confirmation().length > 0 ? HitTestMode.None : HitTestMode.Transparent);
    }, (attachment: number): string => attachment.toString());
  }
  if ($$.owner.view.modal.confirmation().length > 0) {
    ForEach([$$.owner.paint().confirmationGeneration], (opening: number): void => { DownloadConfirmationOverlay($$.owner, { opening: opening }); },
      (opening: number): string => opening.toString());
  }
}

interface DownloadSheetOverlayInput {
  readonly attachment: number;
  readonly ownerGeneration: number;
}

@Builder
function DownloadSheetOverlay(owner: SharedDownloadSheetsOwner, input: DownloadSheetOverlayInput) {
  Stack({ alignContent: Alignment.Bottom }) {
    if (owner.view.modal.sheet().length > 0) {
      Stack().width('100%').height('100%')
        .attributeModifier(new ReaderModalScrimModifier(owner.view.input.appearancePreferences(), owner.view.frame.scheme(),
          owner.sheetScrimColor(), owner.operationsSheetUsesNativeMaterial()))
        .expandSafeArea([SafeAreaType.SYSTEM], [SafeAreaEdge.TOP, SafeAreaEdge.BOTTOM])
        .accessibilityLevel('no')
        .onClick((): void => {
          if (owner.view.frame.uiInputIsCurrent() && owner.sheetActorIsCurrent(input.attachment, input.ownerGeneration) &&
            owner.sheetMaskReady && owner.view.modal.confirmation().length === 0)
            owner.view.setSheet('');
        })
        .onAppear((): void => owner.onSheetActorAppeared(input.attachment, input.ownerGeneration, 'scrim'))
        .transition(TransitionEffect.OPACITY.animation(owner.view.input.reduceMotion() ?
          readerMotionReducedFadeParam() : motionAnimateParam('app.sheet.scrim')),
          (transitionIn: boolean): void => owner.onSheetActorTransitionFinished(input.attachment, input.ownerGeneration, 'scrim', transitionIn));
      ForEach([owner.paint().sheetOpeningGeneration], (opening: number): void => {
        if (owner.isOperationsSheet()) DownloadOperationsSurface(owner, { opening: opening, attachment: input.attachment, ownerGeneration: input.ownerGeneration });
        else DownloadSheetSurface(owner, { opening: opening, attachment: input.attachment, ownerGeneration: input.ownerGeneration });
      }, (opening: number): string => opening.toString());
    }
  }.width('100%').height('100%');
}

interface DownloadSheetSurfaceInput {
  readonly opening: number;
  readonly attachment: number;
  readonly ownerGeneration: number;
}

@Builder
function DownloadSheetSurface(owner: SharedDownloadSheetsOwner, input: DownloadSheetSurfaceInput) {
  Column({ space: 0 }) {
    DownloadSheetContent(owner, { opening: input.opening });
  }.width('100%').constraintSize({ maxHeight: owner.sheetMaxHeight() })
    .padding({ left: owner.sheetSafeLeft(), right: owner.sheetSafeRight() })
    .backgroundColor(readerAppColor('app.surface.menuSolid', owner.view.frame.scheme()))
    .borderRadius({ topLeft: DOWNLOAD_VISUAL.sheetRadius, topRight: DOWNLOAD_VISUAL.sheetRadius }).clip(true)
    .border({ width: { top: DOWNLOAD_VISUAL.borderWidth }, color: readerAppColor('app.border.modalHighlight', owner.view.frame.scheme()) })
    .shadow(readerSurfaceElevation('sheet', owner.view.frame.scheme()))
    .hitTestBehavior(HitTestMode.Default)
    .onAppear((): void => owner.onSheetActorAppeared(input.attachment, input.ownerGeneration, 'sheet:' + input.opening, input.opening))
    .transition(owner.view.input.reduceMotion() ? TransitionEffect.OPACITY.animation(readerMotionReducedFadeParam()) : TransitionEffect.asymmetric(
      TransitionEffect.move(TransitionEdge.BOTTOM).animation(motionAnimateParam('app.sheet.open')),
      TransitionEffect.move(TransitionEdge.BOTTOM).animation(motionAnimateParam('app.sheet.close'))),
      (transitionIn: boolean): void => owner.onSheetActorTransitionFinished(input.attachment, input.ownerGeneration, 'sheet:' + input.opening, transitionIn));
}

interface DownloadOperationsSurfaceInput {
  readonly opening: number;
  readonly attachment: number;
  readonly ownerGeneration: number;
}

@Builder
function DownloadOperationsSurface(owner: SharedDownloadSheetsOwner, input: DownloadOperationsSurfaceInput) {
  Column() {
    ReaderBoundedSurface({ specId: 'reader-action-sheet', surfaceWidth: owner.operationsSurfaceWidth(),
      maxSurfaceHeight: owner.sheetMaxHeight(), scheme: owner.view.frame.scheme() === 'night' ? 'night' : 'day',
      safeInsets: new ReaderInsetsVp(0, 0, 0, owner.operationsBottomInset()),
      header: (): void => owner.view.sheetSlots.operationsHeader(input.opening),
      body: (): void => owner.view.sheetSlots.operationsBody(input.opening) })
      .hitTestBehavior(HitTestMode.Default);
  }.opacity(owner.view.modal.confirmation().length > 0 ? 0 : 1)
    .animation(owner.view.input.reduceMotion() ? readerMotionReducedFadeParam() : motionAnimateParam('app.sheet.scrim'))
    .width('100%')
    .padding({ left: owner.sheetSafeLeft(), right: owner.sheetSafeRight() })
    .onAppear((): void => owner.onSheetActorAppeared(input.attachment, input.ownerGeneration, 'operations:' + input.opening, input.opening))
    .transition(owner.view.input.reduceMotion() ? TransitionEffect.OPACITY.animation(readerMotionReducedFadeParam()) : TransitionEffect.asymmetric(
      TransitionEffect.move(TransitionEdge.BOTTOM).animation(motionAnimateParam('app.sheet.open')),
      TransitionEffect.move(TransitionEdge.BOTTOM).animation(motionAnimateParam('app.sheet.close'))),
      (transitionIn: boolean): void => owner.onSheetActorTransitionFinished(input.attachment, input.ownerGeneration, 'operations:' + input.opening, transitionIn));
}

interface DownloadOperationsHeaderInput {
  readonly opening: number;
}

@Builder
export function DownloadOperationsHeader(owner: SharedDownloadSheetsOwner, input: DownloadOperationsHeaderInput) {
  Column() {
    ReaderBoundedSurfaceHeader({ specId: 'reader-action-sheet', title: owner.sheetTitle(),
      surfaceWidth: owner.operationsSurfaceWidth(), scheme: owner.view.frame.scheme() === 'night' ? 'night' : 'day',
      closeFocusId: sharedDownloadFocusKey('sheet'),
      onClose: (): void => { if (owner.sheetOpeningIsCurrent(input.opening)) owner.view.setSheet(''); } });
  }.width('100%').onAreaChange(owner.sheetAreaHandler('operations-header', input.opening));
}

interface DownloadOperationsBodyInput {
  readonly opening: number;
}

@Builder
export function DownloadOperationsBody(owner: SharedDownloadSheetsOwner, input: DownloadOperationsBodyInput) {
  Scroll() {
    Column() { DownloadOperationsSheet(owner, { ownerGeneration: owner.view.frame.mount.presentationGeneration(), opening: input.opening }); }.width('100%')
      .padding({ left: resolveDrawerSpec('reader-action-sheet').contentInset,
        right: resolveDrawerSpec('reader-action-sheet').contentInset,
        bottom: owner.view.modal.sheet() === 'book-actions' ? 0 : resolveDrawerSpec('reader-action-sheet').contentInset })
  }.width('100%')
    .constraintSize({ maxHeight: Math.max(1,
      owner.sheetMaxHeight() - owner.operationsHeaderHeight() - owner.operationsBottomInset()) }).scrollBar(BarState.Auto);
}

interface DownloadSheetContentInput {
  readonly opening: number;
}

@Builder
function DownloadSheetContent(owner: SharedDownloadSheetsOwner, input: DownloadSheetContentInput) {
  if (!owner.sheetChromeOverflow()) DownloadEditingSheetHeader(owner, { opening: input.opening });
  Scroll(owner.rangeScroller) {
    Column({ space: 0 }) {
      if (owner.sheetChromeOverflow()) DownloadEditingSheetHeader(owner, { opening: input.opening });
      DownloadSheetBody(owner, { opening: input.opening });
      if (owner.sheetChromeOverflow()) DownloadEditingSheetFooter(owner, { opening: input.opening });
    }.width('100%');
  }.width('100%').constraintSize({ maxHeight: owner.sheetChromeOverflow() ? owner.sheetMaxHeight() : owner.sheetBodyMaxHeight() })
    .id(owner.rangeScroll.idFor(`${input.opening}`)).scrollBar(BarState.Auto)
    .onAppear((): void => {
      if (owner.view.frame.mount.mounted() && input.opening === owner.paint().sheetOpeningGeneration)
        owner.rangeScroll.mount(owner.view.frame.getUIContext(), owner.rangeEditingHost, owner.rangeScroller, (): number => 0, `${input.opening}`);
    })
    .onDisAppear((): void => owner.rangeScroll.unmount(`${input.opening}`))
    .onAreaChange((): void => owner.rangeEditingHost.refresh());
  if (!owner.sheetChromeOverflow()) DownloadEditingSheetFooter(owner, { opening: input.opening });
}

interface DownloadEditingSheetHeaderInput {
  readonly opening: number;
}

@Builder
function DownloadEditingSheetHeader(owner: SharedDownloadSheetsOwner, input: DownloadEditingSheetHeaderInput) {
  Rect().width(DOWNLOAD_VISUAL.gripWidth).height(DOWNLOAD_VISUAL.gripHeight)
    .fill(downloadVisualColor('line', owner.view.frame.scheme())).radius(DOWNLOAD_VISUAL.gripRadius)
    .margin({ top: DOWNLOAD_VISUAL.gripTop, bottom: DOWNLOAD_VISUAL.gripBottom });
  Row() {
    Text(owner.sheetTitle()).fontFamily(TYPE_DOWNLOAD_SHEET_TITLE.fontFamily).fontWeight(TYPE_DOWNLOAD_SHEET_TITLE.fontWeight)
      .fontSize(TYPE_DOWNLOAD_SHEET_TITLE.fontSizeFp).lineHeight(TYPE_DOWNLOAD_SHEET_TITLE.lineHeightFp as number).halfLeading(true)
      .fontColor(downloadVisualColor('ink', owner.view.frame.scheme())).layoutWeight(1).wordBreak(WordBreak.BREAK_WORD);
    Button({ type: ButtonType.Normal }) {
      Image(sharedDownloadVisualIcon('close', owner.view.frame.scheme())).width(DOWNLOAD_VISUAL.moreIconSize).height(DOWNLOAD_VISUAL.moreIconSize);
    }.id(sharedDownloadFocusKey('sheet')).height(DOWNLOAD_VISUAL.headerIconHeight).width(DOWNLOAD_VISUAL.headerIconWidth).padding(0).borderRadius(0).backgroundColor(Color.Transparent)
      .responseRegion({ x: (DOWNLOAD_VISUAL.headerIconWidth - DOWNLOAD_VISUAL.touchTarget) / 2, y: 0, width: DOWNLOAD_VISUAL.touchTarget, height: DOWNLOAD_VISUAL.touchTarget }).accessibilityText('关闭面板')
      .onClick((): void => { if (owner.sheetOpeningIsCurrent(input.opening)) owner.view.setSheet(''); });
  }.constraintSize({ minHeight: DOWNLOAD_VISUAL.sheetTitleHeight }).width('100%')
    .padding({ left: DOWNLOAD_VISUAL.sheetTitleLeft, right: DOWNLOAD_VISUAL.sheetTitleRight })
    .onAreaChange(owner.sheetAreaHandler('title', input.opening));
}

interface DownloadEditingSheetFooterInput {
  readonly opening: number;
}

@Builder
function DownloadEditingSheetFooter(owner: SharedDownloadSheetsOwner, input: DownloadEditingSheetFooterInput) {
  if (owner.sheetHasFooter()) {
    if (owner.view.modal.sheet() === 'settings') {
      Row() { DownloadClearStorageButton(owner, { ownerGeneration: owner.view.frame.mount.presentationGeneration(), opening: owner.paint().sheetOpeningGeneration }); }
        .width('100%').padding({ left: DOWNLOAD_VISUAL.storageFooterSide, right: DOWNLOAD_VISUAL.storageFooterSide,
          top: DOWNLOAD_VISUAL.storageFooterTop, bottom: owner.sheetFooterBottomInset() })
        .onAreaChange(owner.sheetAreaHandler('footer', input.opening));
    } else {
      Row() {
      SharedDownloadActionButton(owner.view.frame, { modalBlocking: (): boolean => owner.modalBlocking(), label: (): string => owner.view.modal.sheet() === 'range' ? '开始下载' : '完成', primary: true, enabled: (): boolean => owner.view.modal.sheet() !== 'range' || owner.rangeEligible(), action: (): void => {
          if (!owner.sheetOpeningIsCurrent(input.opening)) return;
          if (owner.view.modal.sheet() === 'range') owner.sendRange(); else owner.view.setSheet('');
        }, focusTarget: '', inSheet: true, ownerGeneration: owner.view.frame.mount.presentationGeneration() });
    }.width('100%').padding({ left: DOWNLOAD_VISUAL.sheetFooterSide, right: DOWNLOAD_VISUAL.sheetFooterSide,
      top: DOWNLOAD_VISUAL.sheetFooterTop, bottom: owner.sheetFooterBottomInset() })
      .border({ width: { top: DOWNLOAD_VISUAL.borderWidth }, color: downloadVisualColor('line', owner.view.frame.scheme()) })
      .onAreaChange(owner.sheetAreaHandler('footer', input.opening));
    }
  }
}

interface DownloadSheetBodyInput {
  readonly opening: number;
}

@Builder
function DownloadSheetBody(owner: SharedDownloadSheetsOwner, input: DownloadSheetBodyInput) {
  Column({ space: 0 }) {
    if (owner.view.modal.sheet() === 'filter') {
      ForEach([input.opening], (filterOpening: number): void => { DownloadFilterSheet(owner, { opening: filterOpening }); },
        (filterOpening: number): string => filterOpening.toString());
    }
    else if (owner.view.modal.sheet() === 'sort') { DownloadSortSheet({ owner }); }
    else if (owner.view.modal.sheet() === 'settings') { DownloadSettingsSheet(owner, { opening: owner.paint().sheetOpeningGeneration }); }
    else if (owner.view.modal.sheet() === 'range') { DownloadRangeSheet(owner, { opening: input.opening }); }
  }.width('100%').padding({ left: owner.view.modal.sheet() === 'settings' ? DOWNLOAD_VISUAL.storageBodySide : DOWNLOAD_VISUAL.sheetBodySide,
    right: owner.view.modal.sheet() === 'settings' ? DOWNLOAD_VISUAL.storageBodySide : DOWNLOAD_VISUAL.sheetBodySide,
    top: owner.view.modal.sheet() === 'settings' ? DOWNLOAD_VISUAL.storageBodyTop : 0,
    bottom: owner.sheetBodyBottomInset() });
}

interface DownloadFilterSheetInput {
  readonly opening: number;
}

@Builder
function DownloadFilterSheet(owner: SharedDownloadSheetsOwner, input: DownloadFilterSheetInput) {
  Row({ space: DOWNLOAD_VISUAL.settingsGap }) {
    Text('下载状态').fontFamily(TYPE_APP_ROW_LABEL.fontFamily).fontWeight(TYPE_APP_ROW_LABEL.fontWeight)
      .fontSize(TYPE_APP_ROW_LABEL.fontSizeFp).lineHeight(TYPE_APP_ROW_LABEL.lineHeightFp as number).halfLeading(true)
      .fontColor(downloadVisualColor('ink', owner.view.frame.scheme())).layoutWeight(1);
    ReaderInlineSelect({ reduceMotion: owner.view.input.reduceMotion(),
      value: owner.view.books.stateChoices().find((choice: DownloadChoice): boolean => choice.id === owner.view.filters().state)?.label ?? '全部状态',
      options: owner.view.books.stateChoices().map((choice: DownloadChoice): string => choice.label),
      selectedIndex: Math.max(0, owner.view.books.stateChoices().findIndex((choice: DownloadChoice): boolean => choice.id === owner.view.filters().state)),
      controlWidth: sharedDownloadSelectWidth(owner.view.frame, owner.view.books.stateChoices().find((choice: DownloadChoice): boolean => choice.id === owner.view.filters().state)?.label ?? '全部状态', DOWNLOAD_VISUAL.settingsSelectMaxWidth, '下载状态'),
      onSelect: (_index: number, value: string): void => {
        if (!owner.sheetOpeningIsCurrent(input.opening) || owner.view.modal.sheet() !== 'filter') return;
        const choice = owner.view.books.stateChoices().find((option: DownloadChoice): boolean => option.label === value);
        if (choice === undefined) return;
        owner.view.setFilter('state', choice.id);
      },
    });
  }.width('100%').constraintSize({ minHeight: DOWNLOAD_VISUAL.settingsHeight })
    .border({ width: { bottom: DOWNLOAD_VISUAL.borderWidth }, color: downloadVisualColor('line', owner.view.frame.scheme()) });
  Row({ space: DOWNLOAD_VISUAL.settingsGap }) {
    Text('书源').fontFamily(TYPE_APP_ROW_LABEL.fontFamily).fontWeight(TYPE_APP_ROW_LABEL.fontWeight)
      .fontSize(TYPE_APP_ROW_LABEL.fontSizeFp).lineHeight(TYPE_APP_ROW_LABEL.lineHeightFp as number).halfLeading(true)
      .fontColor(downloadVisualColor('ink', owner.view.frame.scheme())).layoutWeight(1);
    ReaderInlineSelect({ reduceMotion: owner.view.input.reduceMotion(),
      value: owner.sourceFilterLabel(),
      menuKind: 'source',
      options: owner.paint().filterSourceOptions.map((choice: DownloadChoice): string => choice.label),
      selectedIndex: Math.max(0, owner.paint().filterSourceOptions.findIndex((choice: DownloadChoice): boolean => choice.id === owner.view.filters().sourceId)),
      controlWidth: sharedDownloadSelectWidth(owner.view.frame, owner.sourceFilterLabel(), DOWNLOAD_VISUAL.settingsSelectMaxWidth, '书源'),
      onSelect: (_index: number, value: string): void => {
        if (!owner.sheetOpeningIsCurrent(input.opening) || owner.view.modal.sheet() !== 'filter') return;
        const choice = owner.paint().filterSourceOptions.find((option: DownloadChoice): boolean => option.label === value);
        if (choice === undefined || (choice.id !== 'all' &&
          !owner.view.input.books().some((book: DownloadBookView): boolean => book.sourceId === choice.id))) return;
        owner.view.setFilter('sourceId', choice.id);
      },
    });
  }.width('100%').constraintSize({ minHeight: DOWNLOAD_VISUAL.settingsHeight })
    .border({ width: { bottom: DOWNLOAD_VISUAL.borderWidth }, color: downloadVisualColor('line', owner.view.frame.scheme()) });
}

@Builder
function DownloadSortSheet($$: SharedDownloadSheetsOwnerSlot) {
  ForEach($$.owner.view.books.sortChoices(), (choice: DownloadChoice) => {
    DownloadChoiceRow($$.owner, { optionId: choice.id, label: choice.label, selected: (): boolean => $$.owner.view.filters().sort === choice.id, action: (): void => { $$.owner.view.setFilter('sort', choice.id); }, ownerGeneration: $$.owner.view.frame.mount.presentationGeneration(), sheetId: $$.owner.view.modal.sheet(), sheetGeneration: $$.owner.paint().sheetOpeningGeneration });
  }, (choice: DownloadChoice): string => choice.id);
}

interface DownloadChoiceRowInput {
  readonly optionId: string;
  readonly label: string;
  readonly selected: () => boolean;
  readonly action: () => void;
  readonly ownerGeneration: number;
  readonly sheetId: string;
  readonly sheetGeneration: number;
}

@Builder
function DownloadChoiceRow(owner: SharedDownloadSheetsOwner, input: DownloadChoiceRowInput) {
  ReaderChoiceRow({ specId: 'download-radio', optionId: input.optionId, label: input.label, selected: input.selected(), scheme: owner.view.frame.scheme(),
    groupId: `shared-download-${input.sheetId}-${input.sheetGeneration}`,
    onChoose: (id: string): void => {
      if (id === input.optionId && owner.view.frame.presentationIsCurrent(input.ownerGeneration) &&
        input.sheetId === owner.view.modal.sheet() && owner.sheetOpeningIsCurrent(input.sheetGeneration)) input.action();
    } });
}

interface DownloadOperationsSheetInput {
  readonly ownerGeneration: number;
  readonly opening: number;
}

@Builder
function DownloadOperationsSheet(owner: SharedDownloadSheetsOwner, input: DownloadOperationsSheetInput) {
  ReaderActionMenuSurface({ variant: 'grouped', actions: owner.operationsActions(), scheme: owner.view.frame.scheme() === 'night' ? 'night' : 'day',
    actionIdPrefix: 'reader-download:sheet-action:',
    onAction: (id: string): void => owner.performOperationsAction(id, input.ownerGeneration, input.opening) });
}

interface DownloadSettingsSheetInput {
  readonly opening: number;
}

@Builder
function DownloadSettingsSheet(owner: SharedDownloadSheetsOwner, input: DownloadSettingsSheetInput) {
  DownloadStorageSummaryContent({ owner });
  Column({ space: 0 }) {
    Text('自动保存设置').width('100%').fontFamily(TYPE_DOWNLOAD_META_LINE.fontFamily).fontWeight(TYPE_DOWNLOAD_META_LINE.fontWeight)
      .fontSize(TYPE_DOWNLOAD_META_LINE.fontSizeFp).lineHeight(TYPE_DOWNLOAD_META_LINE.lineHeightFp as number).halfLeading(true)
      .fontColor(downloadVisualColor('muted', owner.view.frame.scheme()))
      .margin({ top: DOWNLOAD_VISUAL.storageSettingsTitleTop });
  Row({ space: DOWNLOAD_VISUAL.storageSettingsGap }) {
    Text('空间上限').layoutWeight(1).fontFamily(TYPE_APP_ROW_LABEL.fontFamily).fontWeight(TYPE_APP_ROW_LABEL.fontWeight)
      .fontSize(TYPE_APP_ROW_LABEL.fontSizeFp).lineHeight(TYPE_APP_ROW_LABEL.lineHeightFp as number).halfLeading(true)
      .fontColor(downloadVisualColor('ink', owner.view.frame.scheme()));
    ReaderInlineSelect({ reduceMotion: owner.view.input.reduceMotion(),
      value: owner.limitLabels()[owner.limitIndex()] ?? '暂不可用',
      options: owner.limitLabels(),
      selectedIndex: owner.limitIndex(),
      controlWidth: owner.storageSelectWidth(),
      actionEnabled: owner.view.input.storagePolicy() !== undefined && !owner.view.input.storagePolicyBusy(),
      onSelect: (_index: number, value: string): void => owner.changeStoragePolicy(input.opening, 'capacity', value),
    });
  }.width('100%').constraintSize({ minHeight: DOWNLOAD_VISUAL.storageSettingsHeight })
    .border({ width: { bottom: DOWNLOAD_VISUAL.borderWidth }, color: downloadVisualColor('line', owner.view.frame.scheme()) });
  Row({ space: DOWNLOAD_VISUAL.storageSettingsGap }) {
    Text('多久未阅读后清理').layoutWeight(1).fontFamily(TYPE_APP_ROW_LABEL.fontFamily).fontWeight(TYPE_APP_ROW_LABEL.fontWeight)
      .fontSize(TYPE_APP_ROW_LABEL.fontSizeFp).lineHeight(TYPE_APP_ROW_LABEL.lineHeightFp as number).halfLeading(true)
      .fontColor(downloadVisualColor('ink', owner.view.frame.scheme()));
    ReaderInlineSelect({ reduceMotion: owner.view.input.reduceMotion(),
      value: owner.dayLabels()[owner.daysIndex()] ?? '暂不可用',
      options: owner.dayLabels(),
      selectedIndex: owner.daysIndex(),
      controlWidth: owner.storageSelectWidth(),
      actionEnabled: owner.view.input.storagePolicy() !== undefined && !owner.view.input.storagePolicyBusy(),
      onSelect: (_index: number, value: string): void => owner.changeStoragePolicy(input.opening, 'expiry', value),
    });
  }.width('100%').constraintSize({ minHeight: DOWNLOAD_VISUAL.storageSettingsHeight })
    .border({ width: { bottom: DOWNLOAD_VISUAL.borderWidth }, color: downloadVisualColor('line', owner.view.frame.scheme()) });
  }.width('100%').border({ width: { top: DOWNLOAD_VISUAL.borderWidth }, color: downloadVisualColor('line', owner.view.frame.scheme()) });
}

@Builder
function DownloadStorageSummaryContent($$: SharedDownloadSheetsOwnerSlot) {
  // Empty native Text has a different fallback baseline from Chromium.
  // Preserve the same numeric actor and the approved empty line box.
  Flex({ direction: FlexDirection.Row, alignItems: formatDownloadStorageBytes($$.owner.view.input.storageSummary().totalBytes).length === 0 ? ItemAlign.Start : ItemAlign.Baseline }) {
    Text('已下载内容').layoutWeight(1).fontFamily(TYPE_DOWNLOAD_BODY.fontFamily).fontWeight(TYPE_DOWNLOAD_BODY.fontWeight)
      .fontSize(TYPE_DOWNLOAD_BODY.fontSizeFp).lineHeight(TYPE_DOWNLOAD_BODY.lineHeightFp as number).halfLeading(true)
      .fontColor(downloadVisualColor('ink', $$.owner.view.frame.scheme())).margin({ right: DOWNLOAD_VISUAL.storageSummaryGap,
        top: formatDownloadStorageBytes($$.owner.view.input.storageSummary().totalBytes).length === 0 ? DOWNLOAD_VISUAL.storageUnknownSummaryLabelTop * $$.owner.view.frame.fontScale() : 0 });
    Text(formatDownloadStorageBytes($$.owner.view.input.storageSummary().totalBytes))
      .fontFeature('"tnum" 1')
      .fontFamily(TYPE_DOWNLOAD_STORAGE_TOTAL.fontFamily).fontWeight(TYPE_DOWNLOAD_STORAGE_TOTAL.fontWeight)
      .fontSize(TYPE_DOWNLOAD_STORAGE_TOTAL.fontSizeFp).lineHeight(TYPE_DOWNLOAD_STORAGE_TOTAL.lineHeightFp as number).halfLeading(true)
      .constraintSize({ minHeight: (TYPE_DOWNLOAD_STORAGE_TOTAL.lineHeightFp as number) * $$.owner.view.frame.fontScale() })
      .fontColor(downloadVisualColor('ink', $$.owner.view.frame.scheme())).textAlign(TextAlign.End);
  }.width('100%').constraintSize({ minHeight: formatDownloadStorageBytes($$.owner.view.input.storageSummary().totalBytes).length === 0 ?
    DOWNLOAD_VISUAL.storageUnknownSummaryMinHeight * $$.owner.view.frame.fontScale() : 0 });
  Column({ space: DOWNLOAD_VISUAL.storageBreakdownGap }) {
    DownloadStorageRetentionRow($$.owner, { label: '保留下载', caption: '长期保留，仅手动删除', bytes: (): number | undefined => $$.owner.view.input.storageSummary().retainedBytes });
    DownloadStorageRetentionRow($$.owner, { label: '自动保存', caption: '阅读时保存，按设置自动清理', bytes: (): number | undefined => $$.owner.view.input.storageSummary().automaticBytes });
  }.width('100%').margin({ top: DOWNLOAD_VISUAL.storageBreakdownTop });
  Row({ space: DOWNLOAD_VISUAL.storageFreeGap }) {
    Text('设备可用空间').layoutWeight(1).fontFamily(TYPE_DOWNLOAD_META.fontFamily).fontWeight(TYPE_DOWNLOAD_META.fontWeight)
      .fontSize(TYPE_DOWNLOAD_META.fontSizeFp).lineHeight(TYPE_DOWNLOAD_META.lineHeightFp as number).halfLeading(true)
      .fontColor(downloadVisualColor('muted', $$.owner.view.frame.scheme()));
    Text(formatDownloadStorageBytes($$.owner.view.input.storageSummary().availableBytes))
      .fontFeature('"tnum" 1')
      .fontFamily(TYPE_DOWNLOAD_META.fontFamily).fontWeight(TYPE_DOWNLOAD_META.fontWeight)
      .fontSize(TYPE_DOWNLOAD_META.fontSizeFp).lineHeight(TYPE_DOWNLOAD_META.lineHeightFp as number).halfLeading(true)
      .constraintSize({ minHeight: (TYPE_DOWNLOAD_META.lineHeightFp as number) * $$.owner.view.frame.fontScale() })
      .fontColor(downloadVisualColor('muted', $$.owner.view.frame.scheme())).textAlign(TextAlign.End);
  }.width('100%').margin({ top: DOWNLOAD_VISUAL.storageFreeTop, bottom: DOWNLOAD_VISUAL.storageFreeBottom });
}

interface DownloadStorageRetentionRowInput {
  readonly label: string;
  readonly caption: string;
  readonly bytes: () => number | undefined;
}

@Builder
function DownloadStorageRetentionRow(owner: SharedDownloadSheetsOwner, input: DownloadStorageRetentionRowInput) {
  Row({ space: DOWNLOAD_VISUAL.storageRowGap }) {
    Column({ space: DOWNLOAD_VISUAL.storageCaptionGap }) {
      Text(input.label).width('100%').fontFamily(TYPE_DOWNLOAD_BODY.fontFamily).fontWeight(TYPE_DOWNLOAD_BODY.fontWeight)
        .fontSize(TYPE_DOWNLOAD_BODY.fontSizeFp).lineHeight(TYPE_DOWNLOAD_BODY.lineHeightFp as number).halfLeading(true)
        .fontColor(downloadVisualColor('ink', owner.view.frame.scheme()));
      Text(input.caption).width('100%').fontFamily(TYPE_DOWNLOAD_META_LINE.fontFamily).fontWeight(TYPE_DOWNLOAD_META_LINE.fontWeight)
        .fontSize(TYPE_DOWNLOAD_META_LINE.fontSizeFp).lineHeight(TYPE_DOWNLOAD_META_LINE.lineHeightFp as number).halfLeading(true)
        .fontColor(downloadVisualColor('muted', owner.view.frame.scheme()));
    }.layoutWeight(1);
    Text(formatDownloadStorageBytes(input.bytes()))
      .fontFeature('"tnum" 1')
      .fontFamily(TYPE_DOWNLOAD_STORAGE_VALUE.fontFamily).fontWeight(TYPE_DOWNLOAD_STORAGE_VALUE.fontWeight)
      .fontSize(TYPE_DOWNLOAD_STORAGE_VALUE.fontSizeFp).lineHeight(TYPE_DOWNLOAD_STORAGE_VALUE.lineHeightFp as number).halfLeading(true)
      .constraintSize({ minHeight: (TYPE_DOWNLOAD_STORAGE_VALUE.lineHeightFp as number) * owner.view.frame.fontScale() })
      .fontColor(downloadVisualColor('ink', owner.view.frame.scheme())).textAlign(TextAlign.End);
  }.width('100%').alignItems(VerticalAlign.Top);
}

interface DownloadClearStorageButtonInput {
  readonly ownerGeneration: number;
  readonly opening: number;
}

@Builder
function DownloadClearStorageButton(owner: SharedDownloadSheetsOwner, input: DownloadClearStorageButtonInput) {
  ReaderButton({ scheme: owner.view.frame.scheme(), variant: 'tonal', visualSize: 'large', layout: 'full',
    label: owner.storageCleanLabel(), focusId: sharedDownloadFocusKey('storage-clean'), actionEnabled: owner.storageCleanupAvailable(),
    leading: (): void => owner.view.sheetSlots.storageCleanupIcon(),
    onAction: (): void => owner.openStorageCleanup(input.ownerGeneration, input.opening) });
}

@Builder
export function DownloadStorageCleanupIcon($$: SharedDownloadSheetsOwnerSlot) {
  Image(sharedDownloadVisualIcon($$.owner.storageCleanupAvailable() ? 'trash' : 'trash_disabled', $$.owner.view.frame.scheme()))
    .width(DOWNLOAD_VISUAL.storageActionIconSize).height(DOWNLOAD_VISUAL.storageActionIconSize);
}

interface DownloadRangeSheetInput {
  readonly opening: number;
}

@Builder
function DownloadRangeSheet(owner: SharedDownloadSheetsOwner, input: DownloadRangeSheetInput) {
  if (owner.paint().actionBookKeys.length > 1) {
    ReaderInlineSelect({ reduceMotion: owner.view.input.reduceMotion(),
      value: owner.availableRangeBooks().find((choice: DownloadChoice): boolean => choice.id === owner.paint().rangeDraft.bookKey)?.label ?? '',
      options: owner.availableRangeBooks().map((choice: DownloadChoice): string => choice.label),
      selectedIndex: Math.max(0, owner.availableRangeBooks().findIndex((choice: DownloadChoice): boolean => choice.id === owner.paint().rangeDraft.bookKey)),
      controlWidth: 0,
      onSelect: (_index: number, value: string): void => {
        if (!owner.sheetOpeningIsCurrent(input.opening) || owner.view.modal.sheet() !== 'range') return;
        const choice = owner.availableRangeBooks().find((option: DownloadChoice): boolean => option.label === value);
        if (choice !== undefined && choice.id !== owner.paint().rangeDraft.bookKey) owner.resetRangeDraft(choice.id);
      },
    }).width('100%').margin({ bottom: DOWNLOAD_VISUAL.rangeBookBottom });
  }
  DownloadChoiceRow(owner, { optionId: 'all', label: '全部章节', selected: (): boolean => owner.paint().rangeDraft.choice === 'all', action: (): void => owner.selectRangeChoice('all'), ownerGeneration: owner.view.frame.mount.presentationGeneration(), sheetId: owner.view.modal.sheet(), sheetGeneration: owner.paint().sheetOpeningGeneration });
  DownloadChoiceRow(owner, { optionId: 'forward', label: '从当前章节往后', selected: (): boolean => owner.paint().rangeDraft.choice === 'forward', action: (): void => owner.selectRangeChoice('forward'), ownerGeneration: owner.view.frame.mount.presentationGeneration(), sheetId: owner.view.modal.sheet(), sheetGeneration: owner.paint().sheetOpeningGeneration });
  DownloadChoiceRow(owner, { optionId: 'custom', label: '选择章节范围', selected: (): boolean => owner.paint().rangeDraft.choice === 'custom', action: (): void => owner.selectRangeChoice('custom'), ownerGeneration: owner.view.frame.mount.presentationGeneration(), sheetId: owner.view.modal.sheet(), sheetGeneration: owner.paint().sheetOpeningGeneration });
  if (owner.paint().rangeDraft.choice === 'custom') {
    ForEach([owner.paint().rangeDraft.revision], (revision: number): void => { DownloadRangeInputs(owner, { opening: input.opening, revision: revision }); },
      (revision: number): string => revision.toString());
    if (owner.paint().rangeDraft.catalogChanged) {
      ForEach([owner.paint().rangeDraft.revision], (revision: number): void => {
      ReaderPageState({ title: '目录已更新', message: '目录已变化，请按当前目录重新填写下载范围。',
        padded: false, actionLabel: '重新填写', actionEnabled: owner.rangeBook()?.projectionStatus === 'ready',
        onAction: (): void => {
          if (owner.sheetOpeningIsCurrent(input.opening) && owner.view.modal.sheet() === 'range' && owner.paint().rangeDraft.choice === 'custom' &&
            revision === owner.paint().rangeDraft.revision && owner.paint().rangeDraft.catalogChanged &&
            owner.rangeBook()?.projectionStatus === 'ready') owner.resetRangeDraft(owner.paint().rangeDraft.bookKey);
        } }).margin({ top: DOWNLOAD_VISUAL.rangeSelectionTop });
      }, (revision: number): string => `download-range-invalid:${revision}`);
    }
  }
}

interface DownloadRangeInputsInput {
  readonly opening: number;
  readonly revision: number;
}

@Builder
function DownloadRangeInputs(owner: SharedDownloadSheetsOwner, input: DownloadRangeInputsInput) {
  Row({ space: DOWNLOAD_VISUAL.actionGap }) {
    DownloadRangeBoundInput(owner, { start: true, opening: input.opening, revision: input.revision });
    Text('至').fontFamily(TYPE_DOWNLOAD_CONTROL.fontFamily).fontWeight(TYPE_DOWNLOAD_CONTROL.fontWeight).fontSize(TYPE_DOWNLOAD_CONTROL.fontSizeFp).lineHeight(TYPE_DOWNLOAD_CONTROL.lineHeightFp as number).halfLeading(true)
      .fontColor(downloadVisualColor('muted', owner.view.frame.scheme()));
    DownloadRangeBoundInput(owner, { start: false, opening: input.opening, revision: input.revision });
  }.width('100%').margin({ top: DOWNLOAD_VISUAL.rangeSelectionTop });
}

interface DownloadRangeBoundInputInput {
  readonly start: boolean;
  readonly opening: number;
  readonly revision: number;
}

@Builder
function DownloadRangeBoundInput(owner: SharedDownloadSheetsOwner, input: DownloadRangeBoundInputInput) {
  TextInput({ text: input.start ? owner.paint().rangeDraft.start : owner.paint().rangeDraft.end, placeholder: input.start ? '起始序号' : '结束序号',
    controller: input.start ? owner.rangeStartController : owner.rangeEndController })
    .attributeModifier(new ReaderEditableInputModifier(input.start ? owner.rangeStartTarget : owner.rangeEndTarget,
      owner.rangeInputId(input.start, input.opening, input.revision),
      (editing: boolean): void => (input.start ? owner.rangeStartTarget : owner.rangeEndTarget).edit(editing)))
    .onAppear((): void => owner.mountRangeEditing(input.start, input.opening, input.revision))
    .onDisAppear((): void => (input.start ? owner.rangeStartTarget : owner.rangeEndTarget).unmount(owner.rangeInputId(input.start, input.opening, input.revision)))
    .layoutWeight(1).type(InputType.Number)
    .enabled(owner.paint().rangeDraft.catalog !== undefined && !owner.paint().rangeDraft.catalogChanged)
    .height(sharedDownloadControlHeight(owner.view.frame.fontScale(), DOWNLOAD_VISUAL.searchHeight, DOWNLOAD_VISUAL.controlLineHeight, DOWNLOAD_VISUAL.searchPaddingY * 2))
    .fontFamily(TYPE_DOWNLOAD_CONTROL.fontFamily).fontWeight(TYPE_DOWNLOAD_CONTROL.fontWeight)
    .fontSize(TYPE_DOWNLOAD_CONTROL.fontSizeFp).lineHeight(TYPE_DOWNLOAD_CONTROL.lineHeightFp as number)
    .fontColor(downloadVisualColor('ink', owner.view.frame.scheme())).backgroundColor(downloadVisualColor('soft', owner.view.frame.scheme()))
    .onChange((value: string): void => owner.updateRangeBound(value, input.start, input.opening, input.revision));
}

interface DownloadConfirmationOverlayInput {
  readonly opening: number;
}

@Builder
function DownloadConfirmationOverlay(owner: SharedDownloadSheetsOwner, input: DownloadConfirmationOverlayInput) {
  Stack({ alignContent: Alignment.TopStart }) {
    // A nested confirmation keeps the sheet's existing backdrop in place.
    if (owner.view.modal.sheet().length === 0 && !owner.paint().sheetExitPending) {
      Stack().width('100%').height('100%')
        .attributeModifier(new ReaderModalScrimModifier(owner.view.input.appearancePreferences(), owner.view.frame.scheme(),
          downloadVisualColor('scrim', owner.view.frame.scheme())))
        .expandSafeArea([SafeAreaType.SYSTEM], [SafeAreaEdge.TOP, SafeAreaEdge.BOTTOM])
        .accessibilityLevel('no');
    }
    ReaderDialogViewport({ host: owner.confirmationHost(), edgeGapY: DOWNLOAD_VISUAL.dialogOuterSide,
      content: (width: number, height: number): void =>
        owner.view.sheetSlots.confirmationSurface(input.opening, width, height),
    });
  }.width('100%').height('100%').hitTestBehavior(HitTestMode.Default);
}

interface DownloadConfirmationSurfaceInput {
  readonly opening: number;
  readonly width: number;
  readonly height: number;
}

@Builder
export function DownloadConfirmationSurface(owner: SharedDownloadSheetsOwner, input: DownloadConfirmationSurfaceInput) {
  ReaderDialogSurface({ specId: 'download-confirmation',
    containerWidthVp: Math.max(0, input.width - 2 * DOWNLOAD_VISUAL.dialogOuterSide),
    body: (): void => owner.view.sheetSlots.confirmationBody(input.opening, input.height),
  }).clip(true);
}

interface DownloadConfirmationSurfaceBodyInput {
  readonly opening: number;
  readonly viewportHeight: number;
}

@Builder
export function DownloadConfirmationSurfaceBody(owner: SharedDownloadSheetsOwner, input: DownloadConfirmationSurfaceBodyInput) {
  DownloadConfirmationContent(owner, { wholeDocument: input.viewportHeight <= owner.dialogChromeHeight(), viewportHeight: input.viewportHeight, ownerGeneration: owner.view.frame.mount.presentationGeneration(), opening: input.opening });
}

interface DownloadConfirmationContentInput {
  readonly wholeDocument: boolean;
  readonly viewportHeight: number;
  readonly ownerGeneration: number;
  readonly opening: number;
}

@Builder
function DownloadConfirmationContent(owner: SharedDownloadSheetsOwner, input: DownloadConfirmationContentInput) {
  Column({ space: 0 }) {
    if (input.wholeDocument) {
      DownloadConfirmationBody({ owner });
    } else {
      Scroll() { DownloadConfirmationBody({ owner }); }.width('100%')
        .constraintSize({ maxHeight: readerSurfaceMaxHeight(input.viewportHeight, owner.dialogChromeHeight()) })
        .scrollBar(BarState.Auto);
    }
    Row({ space: DOWNLOAD_VISUAL.actionGap }) {
      DownloadConfirmationButton(owner, { label: (): string => '取消', danger: false, action: (): void => {
        if (owner.confirmationIsCurrent(input.opening, input.ownerGeneration)) owner.view.setConfirmation('');
      }, enabled: (): boolean => true });
      DownloadConfirmationButton(owner, { label: (): string => owner.view.modal.confirmation() === 'cleanup' ? `清理 ${formatDownloadStorageBytes(owner.view.input.storageSummary().cleanableBytes)}` :
        owner.view.modal.confirmation() === 'cancel' ? '取消任务' : '删除内容', danger: true, action: (): void => {
        if (!owner.confirmationIsCurrent(input.opening, input.ownerGeneration) || !owner.confirmationActionAvailable()) return;
        if (owner.view.modal.confirmation() === 'cleanup') { owner.confirmStorageCleanup(input.ownerGeneration); return; }
        const action = owner.view.modal.confirmation() === 'cancel' ? 'cancel' : 'deleteLocal';
        owner.view.setConfirmation(''); owner.sendAction(action);
      }, enabled: (): boolean => owner.confirmationActionAvailable() });
    }.width('100%').onAreaChange(owner.confirmationAreaHandler(input.opening, input.ownerGeneration));
  }.width('100%');
}

@Builder
function DownloadConfirmationBody($$: SharedDownloadSheetsOwnerSlot) {
  Column({ space: 0 }) {
    Text($$.owner.confirmationTitle())
      .fontFamily(MESSAGE_TITLE.fontFamily).fontWeight(MESSAGE_TITLE.fontWeight)
      .fontSize(MESSAGE_TITLE.fontSizeFp).lineHeight(MESSAGE_TITLE.lineHeightFp as number).halfLeading(true)
      .fontColor(readerAppColor('TOK_MESSAGE_INK', $$.owner.view.frame.scheme())).width('100%').margin({ bottom: 16 });
    Text($$.owner.confirmationCopy())
      .fontFamily(MESSAGE_BODY.fontFamily).fontWeight(MESSAGE_BODY.fontWeight)
      .fontSize(MESSAGE_BODY.fontSizeFp).lineHeight(MESSAGE_BODY.lineHeightFp as number).halfLeading(true)
      .fontColor(readerAppColor('TOK_MESSAGE_MUTED', $$.owner.view.frame.scheme())).width('100%').margin({ bottom: 28 });
  }.width('100%');
}

interface DownloadConfirmationButtonInput {
  readonly label: () => string;
  readonly danger: boolean;
  readonly action: () => void;
  readonly enabled: () => boolean;
}

@Builder
function DownloadConfirmationButton(owner: SharedDownloadSheetsOwner, input: DownloadConfirmationButtonInput) {
  ReaderButton({ scheme: owner.view.frame.scheme(), variant: input.danger ? 'danger' : 'subtle', visualSize: 'medium',
    label: input.label(), layout: 'equal', focusId: sharedDownloadFocusKey(input.danger ? 'confirm' : 'confirm-cancel'), preferDefaultFocus: !input.danger,
    actionEnabled: input.enabled(), onAction: (): void => { if (input.enabled()) input.action(); } });
}
