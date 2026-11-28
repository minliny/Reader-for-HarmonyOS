import { ReaderPaperMaterial } from '../../../ui/foundation/ReaderPaperMaterial';
import { readerLayoutCarrierResponseRegion } from '../../../ui/layout/ReaderPageNativeAttributes';
import { common } from '@kit.AbilityKit';
import { ReaderDocumentSaveHost, type ReaderDocumentSaveResult } from '../../../platform/share/ReaderDocumentSaveHost';
import { readerDocumentSaveMessage } from '../../reading/ui/ReaderSharePresentation';
import { ReaderPostLayoutFrame } from '../../../ui/layout/ReaderPostLayoutFrame';
import { sourceSwitchTriggerFocusId } from '../../source/presentation/SourceSwitchSurfaceLifecycle';
import { ReaderPanelFrame } from '../../../ui/surfaces/ReaderPanelFrame';
import type { ReaderSurfaceMaterialDecision, ReaderSurfaceMaterialRole } from '../../../app/HarmonyCapabilityPolicy';
import { readerSurfaceMaterialDecision } from '../../../ui/surfaces/ReaderSurfaceMaterial';
import { ReaderReadingTopBar, readerReadingTopBarHeight, readerReadingTopBarFontsReady } from '../../../ui/chrome/ReaderReadingTopBar';
import { ReaderTransientFeedback, READER_FEEDBACK_BRIEF_MS } from '../../../ui/feedback/ReaderTransientFeedback';
import { MESSAGE_BODY } from '../../../ui/foundation/ReaderMessageStyle';
import { readerActionIcon } from '../../../ui/foundation/ReaderActionIconResources';
import { readerIsExpandedWidth } from '../../../ui/foundation/ReaderWidthClass';
import { ReaderRecoveryNotice } from '../../../ui/feedback/ReaderRecoveryNotice';
import { ReaderPressFeedback } from '../../../ui/foundation/ReaderPressFeedback';
import { mangaDirectoryColor } from './MangaDirectoryVisual';
import hilog from '@ohos.hilog';
import inputMethod from '@ohos.inputMethod';
import { ReaderWindowCoordinator } from '../../../app/ReaderWindowCoordinator';
import { ReaderThemeHost } from '../../../app/ReaderThemeHost';
import { diagnosticCodeOf } from '../../../app/LogPrivacy';
import { type ReaderInsetsVp } from '../../../ui/foundation/ReaderWindowMetrics';
import { MangaSessionController } from '../application/MangaSessionController';
import { ReaderIconButton } from '../../../ui/controls/ReaderIconButton';
import { ReaderButton } from '../../../ui/controls/ReaderButton';
import { ReaderToggle } from '../../../ui/controls/ReaderToggle';
import { MangaDownloadOperationsPanel } from './MangaDownloadOperationsPanel';
import type { MangaDownloadAction, MangaDownloadActionId } from '../application/MangaDownloadActionsGateway';
import { readerBrightnessControlPercent, readerBrightnessWindowValue } from '../../reading/ui/ReaderBrightnessCurve';
import { READER_FONT_NOTO_SANS_SC_UI_BOLD, READER_FONT_NOTO_SANS_SC_UI_REGULAR, READER_FONT_NOTO_SANS_SC_UI_MEDIUM } from '../../../ui/foundation/ReaderFontFamilies';
import { prepareMangaSheetFonts } from '../../../ui/foundation/ReaderFonts';
import { ReaderActionMenuSurface, ReaderMenuActionView } from '../../../ui/surfaces/ReaderActionMenuSurface';
import { ReaderBoundedSurface } from '../../../ui/surfaces/ReaderBoundedSurface';
import { ReaderBoundedSurfaceHeader } from '../../../ui/surfaces/ReaderBoundedSurfaceHeader';
import { resolveDrawerSpec } from '../../../ui/surfaces/ReaderSurfaceSpecs';
import { motionAnimateParam } from '../../../ui/foundation/MotionSpec';
import { readerMotionReducedFadeParam } from '../../../ui/foundation/ReaderMotionPolicy';
import { readerAppColor } from '../../../ui/foundation/ReaderThemeRegistry';
import { MangaDirectoryDrawer, MangaDirectorySheet } from './MangaDirectoryDrawer';
import type { RemoteReadingBookSeed, RemoteReadingSession, RemoteReadingTocEntry } from '../../reading/application/RemoteReadingFlowGateway';
import type { ReadingDirectoryRecovery } from '../../reading/presentation/ReadingDirectoryRecovery';
import type { ActionSheetSpecId } from '../../../ui/surfaces/ReaderSurfaceSpecs';
import type { ReaderSettingsGateway } from '../../reading/application/ReaderSettingsGateway';
import type { ReaderNavigationPreferences } from '../../../app/HarmonyCapabilityPolicy';
import type { MangaDirectorySheetControls } from './MangaDirectoryDrawer';
import type { MangaViewportChromeInput } from './MangaReadingViewportHost';
import type { MangaBoundaryChromeControls } from './MangaChapterBoundaryHost';

class MangaSheetFrame extends ReaderPostLayoutFrame {}
@Observed
export class MangaChromeRenderState {
  @Track savingPageImage: boolean = false;
  @Track downloadActions: MangaDownloadAction[] = [];
  @Track downloadActionsLoading: boolean = false;
  @Track downloadActionsFailure: string = '';
  @Track downloadActionsGeneration: number = 0;
  @Track panelOffset: number = 0;
  @Track panelScrimOpacity: number = 0;
  @Track panelOpacity: number = 1;
  @Track panelPhase: string = 'closed';
  @Track actionPanelPresentationGeneration: number = 0;
  @Track panelFontsReady: boolean = false;
  @Track panelFontsLoading: boolean = false;
  @Track panelFontsFailed: boolean = false;
  @Track showPageNumbers: boolean = true;
  @Track brightnessPercent: number = 50;
  @Track automaticBrightness: boolean = true;
  @Track actionHeaderMeasuredHeight: number = 0;
}

export interface MangaChromeBook {
  readonly sourceId: string;
  readonly bookId: string;
  readonly bookTitle: string;
  readonly controller: MangaSessionController | undefined;
  readonly remoteSession: RemoteReadingSession | undefined;
  readonly remoteBookSeed: RemoteReadingBookSeed | undefined;
  readonly offline: boolean;
  readonly directoryCurrentChapterIndex: number;
  readonly directoryRecovery: ReadingDirectoryRecovery;
  readonly downloadEnabled: boolean;
  readonly inBookshelf: boolean;
  readonly moreMenuVariant: ActionSheetSpecId;
  readonly isReaderIdentityCurrent: () => boolean;
  readonly inputCurrent: (() => boolean) | undefined;
  readonly settingsGateway: ReaderSettingsGateway | undefined;
}

export interface MangaChromeWindow {
  readonly setBackgroundPreference: (value: 'paper' | 'white' | 'ink') => void;
  readonly setPanel: (value: string) => void;
  readonly setControlsVisible: (value: boolean) => void;
  readonly getUIContext: () => UIContext;
  readonly appForeground: boolean;
  readonly appThemeScheme: string;
  readonly backgroundPreference: 'paper' | 'white' | 'ink';
  readonly controlsVisible: boolean;
  readonly interactionBlocked: boolean;
  readonly panel: string;
  readonly reduceMotion: boolean;
  readonly stageWidth: number;
  readonly stageHeight: number;
  readonly systemScheme: string;
  readonly windowChromeActive: boolean;
  readonly windowChromeOverlayActive: boolean;
  readonly windowInteractiveInsets: (_revision: number) => ReaderInsetsVp;
  readonly interactiveInsets: (revision: number) => ReaderInsetsVp;
  readonly windowMetricsRevision: number;
  readonly navigationPreferences: ReaderNavigationPreferences;
}

export interface MangaChromeChapter {
  readonly reportError: (value: string) => void;
  readonly setChapterEnd: (value: boolean) => void;
  readonly mounted: boolean;
  readonly exiting: boolean;
  readonly chapterEnd: boolean;
  readonly error: string;
  readonly loggingIn: boolean;
  readonly loginRequiredForControls: boolean;
  readonly opened: boolean;
  readonly openingRetry: boolean;
  readonly presentationGeneration: number;
  readonly recovering: boolean;
  readonly refreshing: boolean;
  readonly title: string;
  readonly offlineProbeStatus: string;
}

export interface MangaChromeActions {
  readonly confirmRecovery: () => Promise<void>;
  readonly handleBack: (intent?: 'navigation') => Promise<void>;
  readonly loginAndRetry: () => Promise<void>;
  readonly onContinueOffline: (generation: number, presentationId: string) => void;
  readonly onDetail: () => void;
  readonly onDownloadAction: (action: MangaDownloadActionId, chapterIndex?: number) => Promise<void>;
  readonly onDownloadBook: () => void;
  readonly onDownloadChapter: () => void;
  readonly onLoadDownloadActions: (chapterIndex?: number) => Promise<MangaDownloadAction[]>;
  readonly onOpenDownloads: () => void;
  readonly onReconcileOffline: (generation: number, presentationId: string) => void;
  readonly onSwitchSource: (focusId?: string) => void;
  readonly onToggleShelf: () => void;
  readonly openSourceSwitch: () => Promise<void>;
  readonly refreshImages: () => Promise<void>;
}

export interface MangaChromeNativeSlots {
  readonly topBarBack: () => void;
  readonly topBarActions: () => void;
  readonly actionPanelHeader: (opening: number) => void;
  readonly actionPanelBody: (opening: number) => void;
}

export interface MangaChromeDirectory {
  beginSheetOpening(): void;
  persistentDirectory(): boolean;
  settleSheetOpening(): void;
  directoryOuterIdentity(): string;
}

export interface MangaChromeReaderControls {
  clearPageSliderPreview(): void;
  saveVisible(preserveConfirmed?: boolean): Promise<boolean>;
  readonly horizontal: boolean;
  readonly viewportWidth: number;
  readonly viewportHeight: number;
  toggleDirection(persist?: boolean): void;
  changeFit(requestedFit?: 'source' | 'width' | 'contain', persist?: boolean): Promise<void>;
  pageOrdinal(): number;
  presentedPage(): number;
  readonly pageCount: number;
  stepPage(direction: number): Promise<void>;
  selectorTouchCancelled(): void;
  changePageSlider(value: number, mode: SliderChangeMode): void;
  readonly fit: 'source' | 'width' | 'contain';
}

export interface MangaChromeChapterNavigation {
  readonly busy: boolean;
  cancelBoundaryChapter(): Promise<void>;
  readonly boundaryDragging: boolean;
  readonly presentingCandidate: boolean;
  adjacentLabel(): string;
  finalBoundaryConfirmed(): boolean;
  chapterEndLabel(): string;
  adjacentChapter(direction: number): RemoteReadingTocEntry | undefined;
  resumeFromChapterEnd(): void;
  selectAdjacentChapter(direction: number, fromDirectory?: boolean): Promise<void>;
}

export interface MangaChromeMount {
  readonly book: MangaChromeBook;
  readonly window: MangaChromeWindow;
  readonly chapter: MangaChromeChapter;
  readonly actions: MangaChromeActions;
  readonly slots: MangaChromeNativeSlots;
  readonly directory: () => MangaChromeDirectory;
  readonly reader: () => MangaChromeReaderControls;
  readonly navigation: () => MangaChromeChapterNavigation;
}

/** Control and recovery presentation, sheet admission, focus, fonts and preference intents. */
export class MangaReaderChrome implements MangaDirectorySheetControls, MangaViewportChromeInput, MangaBoundaryChromeControls {
  private readonly transientFeedback: ReaderTransientFeedback;
  readonly scene: MangaChromeMount;
  private readonly readState: () => MangaChromeRenderState;

  constructor(scene: MangaChromeMount, readState: () => MangaChromeRenderState, transientFeedback: ReaderTransientFeedback) {
    this.scene = scene;
    this.readState = readState;
    this.transientFeedback = transientFeedback;
  }

  get state(): MangaChromeRenderState { return this.readState(); }

  loadInitialPreferences(): void {
    this.state.showPageNumbers = this.scene.book.settingsGateway?.current()?.mangaPageNumbers !== false;
    this.loadBrightness();
  }

  get showsPageNumbers(): boolean { return this.state.showPageNumbers; }

  get phase(): string { return this.state.panelPhase; }
  get panelFontsReady(): boolean { return this.state.panelFontsReady; }
  get panelFontsLoading(): boolean { return this.state.panelFontsLoading; }
  get panelFontsFailed(): boolean { return this.state.panelFontsFailed; }
  get panelOffset(): number { return this.state.panelOffset; }
  get panelOpacity(): number { return this.state.panelOpacity; }
  get actionPanelPresentationGeneration(): number { return this.state.actionPanelPresentationGeneration; }

  downloadActionsChapterIndex: number | undefined = undefined;
  panelGeneration: number = 0;
  private panelFocusGeneration: number = 0;
  private panelReturnFocusTarget: string = '';
  private panelActionGeneration: number = 0;
  private panelCloseTask: Promise<boolean> | undefined;
  private panelCloseResolve: ((closed: boolean) => void) | undefined;
  panelFontGeneration: number = 0;
  private panelFontTask: Promise<boolean> | undefined;
  private panelFontTaskIdentity: string = '';
  private brightnessOwner: number = 0;
  private brightnessGeneration: number = 0;
  releasePanel(): void {
    this.invalidatePanelMotion();
    this.scene.window.setPanel(''); this.state.panelPhase = 'closed'; this.state.panelOffset = 0; this.state.panelScrimOpacity = 0;
    this.panelReturnFocusTarget = '';
    this.panelFontGeneration++; this.state.panelFontsReady = false;
    this.state.panelFontsLoading = false; this.state.panelFontsFailed = false;
    this.panelFontTask = undefined; this.panelFontTaskIdentity = '';
  }

  invalidatePanelFocus(): void {
    this.panelFocusGeneration += 1;
  }

  dropForegroundPanelInput(): void {
    if (this.state.panelPhase === 'dragging') {
      this.state.panelOffset = 0;
      this.state.panelPhase = 'open';
    } else this.cancelPanelOpening();
  }

  releaseBrightness(): void {
    const owner = this.brightnessOwner; this.brightnessOwner = 0; this.brightnessGeneration++;
    if (owner > 0) void ReaderWindowCoordinator.brightness().release(owner).catch((): void => {});
  }

  refreshProgressVisible(): boolean {
    return this.scene.chapter.refreshing && this.scene.chapter.opened && this.readerPanelForeground() &&
      this.scene.window.panel.length === 0 && this.state.panelPhase === 'closed' &&
      !this.scene.chapter.chapterEnd && !this.scene.navigation().busy;
  }

  toggleControls(): void {
    if (this.scene.navigation().busy) { void this.scene.navigation().cancelBoundaryChapter().catch((): void => {}); return; }
    if (this.scene.window.panel.length > 0 || this.scene.chapter.chapterEnd) return;
    this.scene.window.setControlsVisible(!this.scene.window.controlsVisible);
    if (!this.scene.window.controlsVisible) this.scene.reader().clearPageSliderPreview();
  }
  controlsPresentedForWindow(): boolean {
    return !this.scene.chapter.chapterEnd && (this.scene.window.controlsVisible || (!this.scene.chapter.opened && this.scene.chapter.error.length > 0) || this.scene.chapter.openingRetry ||
      this.scene.chapter.loginRequiredForControls || this.scene.window.panel.length > 0);
  }
  phonePanelBackgroundEnabled(): boolean {
    return this.readerPanelInputEnabled() && !this.scene.chapter.chapterEnd && this.scene.window.panel !== 'directory' &&
      (this.widePanel() || this.scene.window.panel.length === 0 && this.state.panelPhase === 'closed');
  }
  async openPanel(panel: string, returnFocusTarget: string = '', focusSearch: boolean = false): Promise<void> {
    if (!this.readerPanelForeground()) return;
    this.scene.reader().clearPageSliderPreview();
    const sourceId = this.scene.book.sourceId, bookId = this.scene.book.bookId;
    const focusTarget = returnFocusTarget || (this.scene.window.panel.length > 0 ? this.panelReturnFocusTarget : '') ||
      this.panelTriggerFocusId(panel === 'downloads' ? 'directory' : panel);
    this.invalidatePanelMotion();
    this.panelReturnFocusTarget = focusTarget;
    const generation = this.panelGeneration;
    this.state.panelPhase = 'preparing';
    if (this.scene.navigation().busy || this.scene.navigation().boundaryDragging) await this.scene.navigation().cancelBoundaryChapter();
    if (!this.panelOpeningCurrent(generation)) return;
    // Saving still belongs to the existing position owner, and does not delay
    // the presentation while storage is slow. Its failure receipt is retained.
    void this.scene.reader().saveVisible();
    await this.dismissPanelKeyboard();
    if (!this.panelOpeningCurrent(generation)) return;
    const fontTask = this.preparePanelFonts();
    const fontGeneration = this.panelFontGeneration;
    const fontsReady = await fontTask;
    if (this.scene.book.sourceId !== sourceId || this.scene.book.bookId !== bookId) return;
    if (!fontsReady) {
      if (this.panelOpeningCurrent(generation)) {
        const failed = this.state.panelFontsFailed && !this.state.panelFontsLoading &&
          fontGeneration === this.panelFontGeneration;
        this.cancelPanelOpening();
        if (failed) {
          const cancelledGeneration = this.panelGeneration;
          this.transientFeedback.show(() => this.scene.window.getUIContext(), {
            message: '暂时无法打开面板，请重试', duration: READER_FEEDBACK_BRIEF_MS,
            key: JSON.stringify(['manga-panel-font', sourceId, bookId, fontGeneration]),
          }, (): boolean => this.readerPanelForeground() && this.scene.book.sourceId === sourceId && this.scene.book.bookId === bookId &&
            this.panelGeneration === cancelledGeneration && this.state.panelPhase === 'closed' && this.scene.window.panel.length === 0 &&
            fontGeneration === this.panelFontGeneration && this.state.panelFontsFailed && !this.state.panelFontsLoading);
        }
      }
      return;
    }
    if (!this.panelOpeningCurrent(generation)) return;
    this.scene.window.setControlsVisible(true); this.scene.chapter.setChapterEnd(false);
    if (panel === 'directory') this.scene.directory().beginSheetOpening();
    this.state.actionPanelPresentationGeneration = generation;
    this.scene.window.setPanel(panel);
    this.state.panelPhase = 'opening';
    this.state.panelOffset = this.scene.window.reduceMotion ? 0 : this.panelTravel();
    this.state.panelOpacity = this.scene.window.reduceMotion ? 0 : 1;
    this.state.panelScrimOpacity = 0;
    // The native surface must finish its first layout at the offscreen
    // endpoint before either animation changes the observed values.
    this.scene.window.getUIContext().postFrameCallback(new MangaSheetFrame(this.scene.window.getUIContext(), (): void => {
      if (this.state.panelPhase !== 'opening' || !this.panelOpeningCurrent(generation)) return;
      if (!this.scene.window.reduceMotion) {
        this.scene.window.getUIContext().animateTo(motionAnimateParam('app.sheet.scrim'),
          (): void => { this.state.panelScrimOpacity = 1; });
      }
      this.settlePanel(generation, true, focusSearch);
    }));
  }
  private panelOpeningCurrent(generation: number): boolean {
    if (!this.scene.chapter.mounted || generation !== this.panelGeneration) return false;
    if (this.readerPanelForeground()) return true;
    this.cancelPanelOpening();
    return false;
  }
  private cancelPanelOpening(): void {
    if (this.state.panelPhase !== 'preparing' && this.state.panelPhase !== 'opening') return;
    this.invalidatePanelMotion();
    this.state.panelPhase = 'closed';
    this.scene.window.setPanel('');
    this.state.panelOffset = 0;
    this.state.panelScrimOpacity = 0;
  }
  private async showDetail(): Promise<void> {
    await this.performPanelAction((): void => this.scene.actions.onDetail());
  }
  private invalidatePanelMotion(): void {
    this.panelGeneration++; this.panelActionGeneration++;
    this.panelFocusGeneration += 1;
    const resolve = this.panelCloseResolve;
    this.panelCloseResolve = undefined; this.panelCloseTask = undefined;
    if (resolve !== undefined) resolve(false);
  }
  private async dismissPanelKeyboard(): Promise<void> {
    try {
      this.scene.window.getUIContext().getFocusController().clearFocus();
      await inputMethod.getController().hideTextInput();
    }
    catch (error) {
      hilog.warn(0x5244, 'Reader', 'Manga sheet keyboard dismissal: %{private}s', error instanceof Error ? error.message : 'unavailable');
    }
  }
  async preparePanelFonts(): Promise<boolean> {
    if (!this.scene.chapter.mounted || this.scene.chapter.exiting || !this.scene.book.isReaderIdentityCurrent()) return false;
    if (this.state.panelFontsReady) return true;
    const sourceId = this.scene.book.sourceId, bookId = this.scene.book.bookId;
    const identity = JSON.stringify([sourceId, bookId]);
    if (this.panelFontTask !== undefined && this.panelFontTaskIdentity === identity) return this.panelFontTask;
    const generation = ++this.panelFontGeneration;
    this.state.panelFontsLoading = true; this.state.panelFontsFailed = false;
    const task = this.loadPanelFonts(generation, sourceId, bookId);
    this.panelFontTask = task; this.panelFontTaskIdentity = identity;
    try { return await task; }
    finally {
      if (this.panelFontTask === task) {
        this.panelFontTask = undefined; this.panelFontTaskIdentity = '';
      }
    }
  }
  private async loadPanelFonts(generation: number, sourceId: string, bookId: string): Promise<boolean> {
    const current = (): boolean => this.scene.chapter.mounted && !this.scene.chapter.exiting && generation === this.panelFontGeneration &&
      this.scene.book.sourceId === sourceId && this.scene.book.bookId === bookId && this.scene.book.isReaderIdentityCurrent();
    try {
      const ready = await prepareMangaSheetFonts();
      if (!current()) return false;
      this.state.panelFontsReady = ready; this.state.panelFontsFailed = !ready;
      if (!ready) hilog.warn(0x5244, 'Reader', 'Manga sheet static font receipt unavailable');
      return ready;
    } catch (error) {
      if (current()) {
        this.state.panelFontsFailed = true;
        hilog.warn(0x5244, 'Reader', 'Manga sheet font preparation: %{private}s', error instanceof Error ? error.message : 'unavailable');
      }
      return false;
    } finally {
      if (this.scene.chapter.mounted && generation === this.panelFontGeneration) this.state.panelFontsLoading = false;
    }
  }
  retryPanelFonts(generation: number): void {
    if (!this.readerPanelForeground() || !this.scene.directory().persistentDirectory() || generation !== this.panelFontGeneration ||
      this.state.panelFontsReady || this.state.panelFontsLoading) return;
    void this.preparePanelFonts();
  }
  private panelTravel(): number {
    return (this.widePanel() ? Number(this.panelWidth()) : this.panelHeight()) + 36;
  }
  private settlePanel(generation: number, focusOnOpen: boolean = false, focusSearch: boolean = false): void {
    const finish = (): void => {
      if (this.state.panelPhase === 'opening' && this.panelOpeningCurrent(generation)) {
        this.state.panelPhase = 'open';
        this.scene.directory().settleSheetOpening();
        if (focusOnOpen) this.requestPanelFocus(focusSearch ? `reader-manga-directory-query:${this.scene.directory().directoryOuterIdentity()}` :
          this.panelCloseFocusId(this.state.actionPanelPresentationGeneration), generation, true);
      }
    };
    if (this.scene.window.reduceMotion) {
      this.state.panelOffset = 0;
      if (!focusOnOpen) { finish(); return; }
      this.state.panelOpacity = 0;
      this.scene.window.getUIContext().animateTo(readerMotionReducedFadeParam(finish), (): void => {
        this.state.panelOpacity = 1;
        this.state.panelScrimOpacity = 1;
      });
    } else {
      this.scene.window.getUIContext().animateTo(motionAnimateParam('app.sheet.open', finish),
        (): void => { this.state.panelOffset = 0; this.state.panelOpacity = 1; });
    }
  }
  closePanel(restoreFocus: boolean = true): Promise<boolean> {
    if (!this.scene.chapter.mounted) return Promise.resolve(false);
    if (this.state.panelPhase === 'closing' && this.panelCloseTask !== undefined) return this.panelCloseTask;
    const generation = ++this.panelGeneration;
    this.panelFocusGeneration += 1;
    const focusTarget = this.panelReturnFocusTarget;
    if (this.scene.window.panel.length === 0) { this.state.panelPhase = 'closed'; return Promise.resolve(true); }
    this.state.panelPhase = 'closing';
    void this.dismissPanelKeyboard();
    const reduced = this.scene.window.reduceMotion;
    this.panelCloseTask = new Promise<boolean>((resolve): void => {
      this.panelCloseResolve = resolve;
      const finish = (): void => {
        if (!this.scene.chapter.mounted || generation !== this.panelGeneration) { resolve(false); return; }
        this.scene.window.setPanel(''); this.state.panelOffset = 0; this.state.panelPhase = 'closed';
        this.panelCloseResolve = undefined; this.panelCloseTask = undefined;
        if (restoreFocus) {
          this.panelReturnFocusTarget = '';
          this.requestPanelFocus(focusTarget, generation, false);
        }
        resolve(true);
      };
      if (reduced) {
        this.scene.window.getUIContext().animateTo(readerMotionReducedFadeParam(finish), (): void => {
          this.state.panelOpacity = 0;
          this.state.panelScrimOpacity = 0;
        });
      } else {
        this.scene.window.getUIContext().animateTo(motionAnimateParam('app.sheet.scrim'),
          (): void => { this.state.panelScrimOpacity = 0; });
        this.scene.window.getUIContext().animateTo(motionAnimateParam('app.sheet.close', finish),
          (): void => { this.state.panelOffset = this.panelTravel(); });
      }
    });
    return this.panelCloseTask;
  }
  async performPanelAction(action: () => void | Promise<void>, requireProgressSave?: () => boolean): Promise<boolean> {
    if (!this.scene.chapter.mounted || this.state.panelPhase === 'closing') return false;
    const request = ++this.panelActionGeneration;
    const focusTarget = this.panelReturnFocusTarget;
    const controller = this.scene.book.controller; const chapter = controller?.chapter;
    const saving = this.scene.reader().saveVisible(this.scene.chapter.exiting);
    const closing = this.closePanel(false); const generation = this.panelGeneration;
    const closed = await closing;
    const saved = await saving;
    if (saved === false && requireProgressSave?.() === true) return false;
    if (!closed || !this.scene.chapter.mounted || generation !== this.panelGeneration || request !== this.panelActionGeneration ||
      this.scene.book.controller !== controller || controller?.chapter !== chapter || this.scene.window.panel.length > 0) return false;
    const operation = action();
    if (generation === this.panelGeneration && this.scene.window.panel.length === 0) {
      this.panelReturnFocusTarget = '';
      this.requestPanelFocus(focusTarget, generation, false);
    }
    await operation; return true;
  }
  beginPanelDrag(): void {
    if (this.widePanel() || this.state.panelPhase !== 'open') return;
    this.panelGeneration++; this.state.panelPhase = 'dragging';
  }
  updatePanelDrag(offset: number): void {
    if (this.state.panelPhase !== 'dragging' || !Number.isFinite(offset)) return;
    const target = Math.max(0, offset);
    this.state.panelOffset = target;
  }
  finishPanelDrag(offset: number, velocity: number): void {
    if (this.state.panelPhase !== 'dragging') return;
    if (Math.max(0, offset) > 96 || velocity > 550) { void this.closePanel(); return; }
    this.state.panelPhase = 'opening';
    if (this.scene.window.reduceMotion) { this.state.panelOffset = 0; this.state.panelPhase = 'open'; return; }
    this.settlePanel(this.panelGeneration);
  }
  paperColor(): string {
    return readerAppColor('TOK_PAPER', this.chromeScheme());
  }
  chromeScheme(): 'day' | 'night' { return this.scene.window.backgroundPreference === 'ink' ? 'night' : 'day'; }
  surfaceMaterial(role: ReaderSurfaceMaterialRole): ReaderSurfaceMaterialDecision {
    return readerSurfaceMaterialDecision(role, this.scene.window.navigationPreferences, this.scene.window.appThemeScheme, this.scene.window.systemScheme);
  }
  floatingChromeScheme(role: ReaderSurfaceMaterialRole): 'day' | 'night' {
    // Native chrome follows the system. Unified chrome still follows the independently selected manga paper.
    return this.surfaceMaterial(role).native ? (this.scene.window.systemScheme === 'night' ? 'night' : 'day') : this.chromeScheme();
  }
  sheetScheme(): 'day' | 'night' { return this.floatingChromeScheme('modalSheet'); }
  private surfaceColor(): string { return mangaDirectoryColor('surface', this.chromeScheme()); }
  inkColor(scheme: 'day' | 'night' = this.chromeScheme()): string { return mangaDirectoryColor('ink', scheme); }
  mutedColor(scheme: 'day' | 'night' = this.chromeScheme()): string { return mangaDirectoryColor('muted', scheme); }
  lineColor(scheme: 'day' | 'night' = this.chromeScheme()): string { return mangaDirectoryColor('line', scheme); }
  softSurfaceColor(scheme: 'day' | 'night'): string { return mangaDirectoryColor('soft', scheme); }
  greenColor(scheme: 'day' | 'night' = this.chromeScheme()): string { return readerAppColor('TOK_PRIMARY_DARK', scheme); }
  accentColor(scheme: 'day' | 'night'): string { return mangaDirectoryColor('accent', scheme); }
  isSheetChoiceSelected(kind: string): boolean {
    if (kind === 'vertical') return !this.scene.reader().horizontal;
    if (kind === 'horizontal') return this.scene.reader().horizontal;
    if (kind === 'sun') return this.scene.window.backgroundPreference !== 'ink';
    return this.scene.window.backgroundPreference === 'ink';
  }
  choiceIcon(kind: string): Resource {
    const selected = this.isSheetChoiceSelected(kind);
    const night = this.sheetScheme() === 'night';
    if (kind === 'vertical') return selected ? $r('app.media.manga_sheet_vertical_active') : night ? $r('app.media.manga_sheet_vertical_theme_night') : $r('app.media.manga_sheet_vertical');
    if (kind === 'horizontal') return selected ? $r('app.media.manga_sheet_horizontal_active') : night ? $r('app.media.manga_sheet_horizontal_theme_night') : $r('app.media.manga_sheet_horizontal');
    if (kind === 'sun') return selected ? $r('app.media.manga_sheet_sun_active') : night ? $r('app.media.manga_sheet_sun_theme_night') : $r('app.media.manga_sheet_sun');
    return selected ? $r('app.media.manga_sheet_moon_active') : night ? $r('app.media.manga_sheet_moon_theme_night') : $r('app.media.manga_sheet_moon');
  }
  widePanel(): boolean { return this.scene.directory().persistentDirectory() || readerIsExpandedWidth(Math.max(this.scene.window.stageWidth, this.scene.reader().viewportWidth)); }
  panelWidth(): number | string {
    if (!this.widePanel()) return this.isActionPanel() ? Math.min(resolveDrawerSpec('reader-action-sheet').maxWidth, this.scene.window.stageWidth > 0 ? this.scene.window.stageWidth : this.scene.reader().viewportWidth) : '100%';
    if (this.scene.window.panel === 'directory') return 336;
    return this.scene.window.stageWidth <= 700 ? Math.min(320, this.scene.window.stageWidth * 0.85) :
      Math.max(240, Math.min(this.scene.directory().persistentDirectory() ? 340 : 320, this.scene.window.stageWidth * 0.45));
  }
  panelContentInset(): number {
    if (this.isActionPanel()) {
      const spec = resolveDrawerSpec('reader-action-sheet');
      return Number(this.panelWidth()) <= spec.compactViewportWidth ? spec.compactSideContentInset : spec.contentInset;
    }
    return this.widePanel() ? this.scene.window.stageWidth <= 700 ? 16 : 20 : 18;
  }
  // The demo snap is a maximum, not a forced empty sheet height.
  panelHeight(): number {
    const snap = this.scene.window.panel === 'directory' ? 0.78 : this.scene.window.panel === 'more' ? 0.75 : this.scene.window.panel === 'mode' || this.scene.window.panel === 'settings' ? 0.67 : 0.5;
    return this.widePanel() ? Math.max(this.scene.reader().viewportHeight, this.scene.window.stageHeight) : Math.min(this.scene.reader().viewportHeight, Math.max(260, Math.round(this.scene.reader().viewportHeight * snap)));
  }
  panelContentHeight(): number {
    const insets = this.panelInsets(this.scene.window.windowMetricsRevision);
    return Math.max(1, this.panelHeight() - insets.bottom - (this.widePanel() ? insets.top : 0));
  }
  panelInsets(revision: number): ReaderInsetsVp {
    const insets = this.scene.window.interactiveInsets(revision);
    // A right-side sheet does not touch the window's left cutout band.
    if (this.widePanel()) {
      insets.left = Math.max(0, insets.left - Math.max(0, this.scene.reader().viewportWidth - Number(this.panelWidth())));
    }
    return insets;
  }
  panelTitle(): string {
    return this.scene.window.panel === 'directory' ? '章节目录' : this.scene.window.panel === 'mode' ? '阅读方式' : this.scene.window.panel === 'settings' ? '漫画阅读设置' :
      this.scene.window.panel === 'downloads' ? this.downloadActionsChapterIndex === undefined ? '本书下载' : '本话下载' : '更多';
  }
  async openDownloadActions(chapterIndex?: number): Promise<void> {
    if (!this.scene.chapter.mounted || !this.scene.book.downloadEnabled || !this.scene.book.isReaderIdentityCurrent()) return;
    const generation = ++this.state.downloadActionsGeneration;
    this.downloadActionsChapterIndex = chapterIndex;
    this.state.downloadActions = []; this.state.downloadActionsFailure = ''; this.state.downloadActionsLoading = true;
    await this.openPanel('downloads');
    const current = (): boolean => this.scene.chapter.mounted && !this.scene.chapter.exiting && this.scene.book.isReaderIdentityCurrent() &&
      generation === this.state.downloadActionsGeneration && this.scene.window.panel === 'downloads' && this.state.panelPhase !== 'closing';
    if (!current()) return;
    try {
      const actions = await this.scene.actions.onLoadDownloadActions(chapterIndex);
      if (current()) this.state.downloadActions = actions;
    } catch (_) {
      if (current()) this.state.downloadActionsFailure = '下载状态暂时无法读取，请重试';
    } finally {
      if (current()) this.state.downloadActionsLoading = false;
    }
  }
  readerPanelInputEnabled(): boolean {
    return !this.scene.window.interactionBlocked && this.scene.chapter.mounted && !this.scene.chapter.exiting && this.scene.window.appForeground && this.scene.window.windowChromeActive;
  }
  readerPanelForeground(): boolean {
    return this.readerPanelInputEnabled() && !this.scene.window.windowChromeOverlayActive && this.scene.book.isReaderIdentityCurrent() &&
      (this.scene.book.inputCurrent?.() ?? true);
  }
  panelTriggerFocusId(panel: string): string {
    return `reader-manga:${JSON.stringify([this.scene.book.sourceId, this.scene.book.bookId])}:trigger:${panel}`;
  }
  panelCloseFocusId(opening: number): string {
    return `reader-manga:${JSON.stringify([this.scene.book.sourceId, this.scene.book.bookId])}:panel-close:${opening}`;
  }
  private requestPanelFocus(target: string, generation: number, opening: boolean): void {
    const sideDirectory = opening ? this.scene.window.panel === 'directory' : target === this.panelTriggerFocusId('directory');
    if ((this.widePanel() && !sideDirectory) || !this.readerPanelForeground() || target.length === 0) return;
    const request = ++this.panelFocusGeneration;
    const sourceId = this.scene.book.sourceId, bookId = this.scene.book.bookId;
    const controller = this.scene.book.controller, chapter = controller?.chapter;
    try {
      this.scene.window.getUIContext().postFrameCallback(new MangaSheetFrame(this.scene.window.getUIContext(), (): void => {
        if (!this.readerPanelForeground() || request !== this.panelFocusGeneration || generation !== this.panelGeneration ||
          sourceId !== this.scene.book.sourceId || bookId !== this.scene.book.bookId || this.scene.book.controller !== controller || controller?.chapter !== chapter) return;
        if (opening ? this.scene.window.panel.length === 0 || this.state.panelPhase !== 'open' :
          this.scene.window.panel.length > 0 || this.state.panelPhase !== 'closed' || !this.scene.window.controlsVisible || this.scene.chapter.chapterEnd) return;
        const targets = opening ? [target] : [target, this.panelTriggerFocusId('more')];
        for (const focusId of targets) {
          try { this.scene.window.getUIContext().getFocusController().requestFocus(focusId); return; }
          catch (_unavailableTrigger) {}
        }
      }));
    } catch (_retiredSurface) {}
  }
  ownsDownloadActions(generation: number): boolean {
    return generation === this.state.downloadActionsGeneration && this.scene.book.downloadEnabled && this.readerPanelForeground();
  }
  downloadPanelInputCurrent(opening: number, generation: number): boolean {
    return this.scene.window.panel === 'downloads' && this.state.panelPhase === 'open' &&
      this.panelInputCurrent(opening) && this.ownsDownloadActions(generation);
  }
  performDownloadAction(action: MangaDownloadActionId, generation: number): void {
    if (!this.ownsDownloadActions(generation) || this.scene.window.panel !== 'downloads' || this.state.panelPhase !== 'open' ||
      this.state.downloadActionsLoading || !this.state.downloadActions.some(item => item.id === action)) return;
    const chapterIndex = this.downloadActionsChapterIndex;
    void this.performPanelAction((): void | Promise<void> => {
      if (this.ownsDownloadActions(generation)) return this.scene.actions.onDownloadAction(action, chapterIndex);
    }).catch((): void => {
      // Index owns operation feedback; the current reading content remains.
    });
  }
  private loadBrightness(): void {
    this.brightnessOwner = ReaderWindowCoordinator.brightness().claim();
    const owner = this.brightnessOwner;
    const generation = this.brightnessGeneration;
    void ReaderWindowCoordinator.brightness().read(owner).then((result): void => {
      if (!this.scene.chapter.mounted || owner !== this.brightnessOwner || generation !== this.brightnessGeneration || !result.applied) return;
      this.state.automaticBrightness = result.value < 0;
      if (result.value >= 0) this.state.brightnessPercent = readerBrightnessControlPercent(result.value);
    }).catch((error: Error): void => { if (this.scene.chapter.mounted) this.scene.chapter.reportError(error.message); });
  }
  setBrightness(percent: number, automatic: boolean = false): void {
    if (this.brightnessOwner === 0 || !this.scene.chapter.mounted) return;
    const owner = this.brightnessOwner;
    const generation = ++this.brightnessGeneration;
    this.state.automaticBrightness = automatic;
    this.state.brightnessPercent = Math.max(1, Math.min(100, percent));
    void ReaderWindowCoordinator.brightness().request(owner, automatic ? -1 : readerBrightnessWindowValue(this.state.brightnessPercent))
      .catch((error: Error): void => { if (this.scene.chapter.mounted && owner === this.brightnessOwner && generation === this.brightnessGeneration) this.scene.chapter.reportError(error.message); });
  }
  changeBrightnessSlider(value: number, mode: SliderChangeMode, opening: number): void {
    if (!this.preferencePanelInputCurrent(opening, 'settings') || !Number.isFinite(value)) return;
    if (mode === SliderChangeMode.Begin || this.state.automaticBrightness && mode !== SliderChangeMode.Moving) return;
    if (this.state.automaticBrightness || value !== this.state.brightnessPercent) this.setBrightness(value);
  }
  synchronizePaper(): void {
    this.scene.window.setBackgroundPreference(this.scene.window.appThemeScheme === 'night' ? 'ink' : 'paper');
  }
  setBackground(background: 'paper' | 'ink', opening: number): void {
    const current = (): boolean => this.preferencePanelInputCurrent(opening, 'settings');
    if (!current()) return;
    void ReaderThemeHost.selectManga(background === 'ink' ? 'night' : 'day', current)
      .catch((error: Error): void => {
        if (current()) hilog.warn(0x5244, 'Reader', 'Manga theme selection: %{private}s', diagnosticCodeOf(error.message));
      });
  }
  setPageNumbers(enabled: boolean): void {
    this.state.showPageNumbers = enabled;
    this.scene.book.settingsGateway?.updateMangaPreferences({ mangaPageNumbers: enabled })
      .catch((error: Error): void => { if (this.scene.chapter.mounted) this.scene.chapter.reportError(error.message); });
  }
  async resetMangaPreferences(): Promise<void> {
    if (this.scene.chapter.exiting || this.scene.book.isReaderIdentityCurrent?.() === false) return;
    if (this.scene.reader().horizontal) this.scene.reader().toggleDirection(false);
    const layout = this.scene.reader().changeFit('width', false);
    this.state.showPageNumbers = true;
    this.setBrightness(this.state.brightnessPercent, true);
    const paper = ReaderThemeHost.selectManga(this.scene.window.appThemeScheme === 'night' ? 'night' : 'day',
      (): boolean => this.scene.chapter.mounted && !this.scene.chapter.exiting && this.scene.book.isReaderIdentityCurrent?.() !== false);
    // Queue the user's reset now. Waiting for preview mode would allow an
    // older reset to overwrite a newer page-number or layout choice.
    const saved = this.scene.book.settingsGateway?.updateMangaPreferences({ mangaDirection: 'vertical', mangaFit: 'width', mangaPageNumbers: true });
    await Promise.all([layout, saved, paper]);
  }
  topControlsWidth(): string {
    const insets = this.scene.window.interactiveInsets(this.scene.window.windowMetricsRevision);
    return `calc(100% - ${insets.left + insets.right}vp)`;
  }
  topControlsPosition(): Edges {
    const insets = this.scene.window.interactiveInsets(this.scene.window.windowMetricsRevision);
    return { left: insets.left, top: insets.top };
  }
  bottomControlsPosition(): Edges {
    const insets = this.scene.window.interactiveInsets(this.scene.window.windowMetricsRevision);
    return { left: (this.scene.reader().viewportWidth - this.dockWidth(insets) + insets.left - insets.right) / 2,
      bottom: insets.bottom + 12 };
  }
  recoveryOverlayIdentity(): string {
    return JSON.stringify([this.scene.book.sourceId, this.scene.book.bookId, this.scene.chapter.presentationGeneration]);
  }
  recoveryOverlayCurrent(identity: string): boolean {
    return this.scene.chapter.opened && this.scene.chapter.recovering && this.scene.reader().viewportWidth > 1 && this.scene.reader().viewportHeight > 1 && this.recoveryNoticeHeight() > 0 &&
      identity === this.recoveryOverlayIdentity() && this.readerPanelForeground() &&
      !this.scene.window.controlsVisible && this.scene.window.panel.length === 0 && this.state.panelPhase === 'closed' && !this.scene.chapter.chapterEnd &&
      !this.scene.chapter.openingRetry && !this.scene.chapter.loginRequiredForControls && !this.scene.navigation().busy;
  }
  private mangaTopBarRevision: number = -1;
  private mangaTopBarMeasuredHeight: number = 52;
  mangaTopBarHeight(): number {
    const ready = readerReadingTopBarFontsReady('manga');
    if (!ready || this.mangaTopBarRevision !== this.scene.window.windowMetricsRevision) {
      this.mangaTopBarMeasuredHeight = readerReadingTopBarHeight(this.scene.window.getUIContext(), 'manga', 52);
      this.mangaTopBarRevision = ready ? this.scene.window.windowMetricsRevision : -1;
    }
    return this.mangaTopBarMeasuredHeight;
  }
  controlFontScale(): number {
    this.scene.window.windowMetricsRevision;
    const scale = ReaderWindowCoordinator.metrics().systemFontScale;
    return Number.isFinite(scale) && scale > 0 ? scale : 1;
  }
  dockPageRowHeight(): number { return 44 + 3 + Math.max(16, 15 * this.controlFontScale()); }
  dockActionHeight(): number { return Math.max(58, 22 + 4 + 16.5 * this.controlFontScale() + 12); }
  dockHeight(): number { return this.dockPageRowHeight() + 4 + this.dockActionHeight() + 1 + 24; }
  dockWidth(insets: ReaderInsetsVp): number {
    return Math.min(560, Math.max(1, this.scene.reader().viewportWidth - 60 - insets.left - insets.right));
  }
  recoveryNoticeHeight(): number {
    const insets = this.scene.window.interactiveInsets(this.scene.window.windowMetricsRevision);
    const available = this.scene.reader().viewportHeight - insets.top - insets.bottom;
    return Math.max(0, Math.min(available / 3, available - 20));
  }
  bottomControlViewportHeight(): number {
    const insets = this.scene.window.interactiveInsets(this.scene.window.windowMetricsRevision);
    const top = this.mangaTopBarHeight() + 10 +
      (this.scene.chapter.loginRequiredForControls ? 52 : 0) + (this.scene.chapter.offlineProbeStatus.length > 0 ? 60 * this.controlFontScale() + 8 : 0);
    return Math.max(0, Math.min(this.dockHeight() + 12, this.scene.reader().viewportHeight - insets.top - insets.bottom - top));
  }
  sheetActionHeight(): number { return Math.max(44, 18 * this.controlFontScale() + 16); }
  isActionPanel(): boolean { return this.scene.window.panel === 'more' || this.scene.window.panel === 'downloads' || this.scene.window.panel === 'mode' || this.scene.window.panel === 'settings'; }
  actionHeaderHeight(): number {
    if (this.state.actionHeaderMeasuredHeight > 0) return this.state.actionHeaderMeasuredHeight;
    const spec = resolveDrawerSpec('reader-action-sheet');
    return this.widePanel() ? spec.sideHeaderHeight : spec.handleZone + spec.titleHeight;
  }
  actionPanelInsets(): ReaderInsetsVp {
    const insets = this.panelInsets(this.scene.window.windowMetricsRevision);
    return { left: insets.left, right: insets.right, top: this.widePanel() ? insets.top : 0, bottom: insets.bottom };
  }
  panelInputCurrent(opening: number): boolean {
    return opening === this.state.actionPanelPresentationGeneration && this.scene.window.panel.length > 0 &&
      (this.state.panelPhase === 'open' || this.state.panelPhase === 'dragging') && this.readerPanelForeground();
  }
  preferencePanelInputCurrent(opening: number, panel: 'mode' | 'settings'): boolean {
    return this.scene.window.panel === panel && this.state.panelPhase === 'open' && this.panelInputCurrent(opening);
  }
  moreActions(): ReaderMenuActionView[] {
    const refreshLabel = this.scene.chapter.title.includes('卷') ? '重新打开本卷' : '重新打开本话';
    const refreshSecondary = this.scene.chapter.refreshing ? '正在更新本章' : !this.scene.chapter.opened ? '章节尚未打开' : this.scene.book.offline ? '离线时不可用' : '';
    const scheme = this.sheetScheme();
    const canSaveImage = this.scene.chapter.opened && !this.scene.chapter.refreshing && !this.scene.chapter.chapterEnd && !this.state.savingPageImage &&
      !this.scene.navigation().presentingCandidate && this.scene.book.controller?.pageAt(this.scene.reader().pageOrdinal()) !== undefined;
    const actions: ReaderMenuActionView[] = [
      new ReaderMenuActionView('source', '更换书源', true, readerActionIcon('source', scheme), '更换书源',
        '阅读', '', '', 'default', true),
      new ReaderMenuActionView('refresh', refreshLabel, this.scene.chapter.opened && !this.scene.book.offline && !this.scene.chapter.refreshing,
        readerActionIcon('refresh', scheme), refreshLabel, '阅读', refreshSecondary),
      new ReaderMenuActionView('detail', '漫画详情', true, readerActionIcon('info', scheme), '漫画详情',
        '阅读', '', '', 'default', true),
      new ReaderMenuActionView('saveImage', '保存当前页图片', canSaveImage,
        readerActionIcon('download', scheme), '保存当前页图片', '图片'),
    ];
    if (this.scene.book.downloadEnabled) {
      const chapterOpened = this.scene.chapter.opened && this.scene.book.directoryCurrentChapterIndex >= 0;
      actions.push(
        new ReaderMenuActionView('downloadChapter', '下载本话', chapterOpened, readerActionIcon('download', scheme),
          '下载本话', '下载', chapterOpened ? '' : '章节尚未打开'),
        new ReaderMenuActionView('downloadBook', '下载全部章节', true, readerActionIcon('storage', scheme),
          '下载全部章节', '下载'),
        new ReaderMenuActionView('downloadManager', '下载管理', true, readerActionIcon('more', scheme),
          '下载管理', '下载', '', '', 'default', true),
      );
    }
    const shelfLabel = this.scene.book.inBookshelf ? '移出书架' : '加入书架';
    actions.push(new ReaderMenuActionView('shelf', shelfLabel, true,
      readerActionIcon(this.scene.book.inBookshelf ? 'trash' : 'import', scheme), shelfLabel, '书架', '', '',
      this.scene.book.inBookshelf ? 'danger' : 'default', this.scene.book.inBookshelf));
    return actions;
  }
  performMoreAction(id: string, generation: number): void {
    if (!this.readerPanelForeground() || generation !== this.state.actionPanelPresentationGeneration ||
      this.scene.window.panel !== 'more' || this.state.panelPhase !== 'open') return;
    const action = this.moreActions().find((item: ReaderMenuActionView): boolean => item.id === id);
    if (action === undefined || !action.enabled) return;
    if (id === 'source') { void this.performMorePanelAction(generation, (): void => this.scene.actions.onSwitchSource(this.panelTriggerFocusId('more'))); return; }
    if (id === 'refresh') {
      void this.performMorePanelAction(generation, (): Promise<void> => this.scene.actions.refreshImages());
      return;
    }
    if (id === 'detail') { void this.performMorePanelAction(generation, (): void => this.scene.actions.onDetail()); return; }
    if (id === 'saveImage') {
      const ordinal = this.scene.reader().pageOrdinal();
      const controller = this.scene.book.controller;
      if (controller !== undefined) {
        void this.performMorePanelAction(generation, (): Promise<void> => this.savePageImage(controller, ordinal));
      }
      return;
    }
    if (id === 'downloadChapter') { void this.performMorePanelAction(generation, (): void => this.scene.actions.onDownloadChapter()); return; }
    if (id === 'downloadBook') { void this.performMorePanelAction(generation, (): void => this.scene.actions.onDownloadBook()); return; }
    if (id === 'downloadManager') { void this.performMorePanelAction(generation, (): void => this.scene.actions.onOpenDownloads()); return; }
    if (id === 'shelf') { void this.performMorePanelAction(generation, (): void => this.scene.actions.onToggleShelf()); }
  }
  private async savePageImage(controller: MangaSessionController, ordinal: number): Promise<void> {
    const chapter = controller.chapter;
    const page = controller.pageAt(ordinal);
    if (!this.readerPanelForeground() || this.state.savingPageImage || chapter === undefined || page === undefined) return;
    const current = (): boolean => this.scene.chapter.mounted && !this.scene.chapter.exiting && this.scene.window.windowChromeActive &&
      !this.scene.window.windowChromeOverlayActive && this.scene.book.isReaderIdentityCurrent() && this.scene.book.controller === controller &&
      controller.chapter === chapter && controller.pageAt(ordinal)?.pageId === page.pageId &&
      !this.scene.navigation().presentingCandidate && this.scene.reader().pageOrdinal() === ordinal;
    if (!current()) return;
    const context = this.scene.window.getUIContext().getHostContext() as common.UIAbilityContext | undefined;
    this.state.savingPageImage = true;
    let result: ReaderDocumentSaveResult = 'failed';
    try {
      if (context !== undefined) {
        const bytes = await controller.readPageImageForSave(ordinal, current);
        if (bytes !== undefined && current()) {
          result = await new ReaderDocumentSaveHost(context).saveImage(bytes, `${this.scene.chapter.title} 第${ordinal + 1}页`, current);
        }
      }
    } catch (_) { /* The source image could not be read or saved. */ }
    finally { this.state.savingPageImage = false; }
    const message = readerDocumentSaveMessage(result, '当前页图片');
    if (message !== undefined) this.transientFeedback.show(() => this.scene.window.getUIContext(), { message }, current);
  }
  private performMorePanelAction(generation: number, action: () => void | Promise<void>): Promise<boolean> {
    return this.performPanelAction((): void | Promise<void> => {
      if (generation === this.state.actionPanelPresentationGeneration && this.readerPanelForeground()) return action();
    });
  }
  chapterEndActionLabel(): string {
    const next = this.scene.navigation().adjacentLabel();
    if (next.length > 0) return `点击进入下一话：${next}`;
    return this.scene.navigation().finalBoundaryConfirmed() ? '已读至最新一话 · 返回继续' : '返回继续阅读';
  }
}

interface MangaReaderChromeContentInput {
  readonly host: MangaReaderChrome;
}

@Builder
export function MangaReaderChromeContent($$: MangaReaderChromeContentInput) {
    Column() { MangaTopControls({host: $$.host }); }
      .width($$.host.topControlsWidth())
      .position($$.host.topControlsPosition())
      .hitTestBehavior(HitTestMode.Default).responseRegion(readerLayoutCarrierResponseRegion());
    if ($$.host.bottomControlViewportHeight() > 12) {
      Scroll() { MangaBottomControls({host: $$.host }); }
        .width($$.host.dockWidth($$.host.scene.window.interactiveInsets($$.host.scene.window.windowMetricsRevision)))
        .height($$.host.bottomControlViewportHeight() - 12)
        .position($$.host.bottomControlsPosition())
        .hitTestBehavior(HitTestMode.Default)
        .enableScrollInteraction($$.host.bottomControlViewportHeight() < $$.host.dockHeight() + 12)
        .scrollBar(BarState.Off).edgeEffect(EdgeEffect.None);
    }
  }

interface MangaTopControlsInput {
  readonly host: MangaReaderChrome;
}

@Builder
function MangaTopControls($$: MangaTopControlsInput) {
    Column({ space: 8 }) {
      ReaderReadingTopBar({ variant: 'manga', barHeight: $$.host.mangaTopBarHeight(), scheme: $$.host.floatingChromeScheme('chromeBar'),
        bookTitle: $$.host.scene.book.bookTitle || $$.host.scene.book.remoteSession?.book.title || $$.host.scene.book.remoteBookSeed?.title || '漫画阅读', subtitle: $$.host.scene.chapter.title,
        leading: $$.host.scene.slots.topBarBack, trailing: $$.host.scene.slots.topBarActions,
      });
      if ($$.host.scene.chapter.loginRequiredForControls) {
        ReaderButton({ scheme: $$.host.chromeScheme(), variant: 'primary',
          label: $$.host.scene.chapter.loggingIn ? '登录处理中' : '登录书源后重试', isBusy: $$.host.scene.chapter.loggingIn,
          actionEnabled: !$$.host.scene.chapter.loggingIn, controlHeight: 44,
          onAction: (): void => { void $$.host.scene.actions.loginAndRetry(); } });
      }
      if ($$.host.scene.chapter.offlineProbeStatus.length > 0) {
        Text($$.host.scene.chapter.offlineProbeStatus).fontFamily(READER_FONT_NOTO_SANS_SC_UI_REGULAR).fontWeight(400)
          .fontSize(10).maxLines(4).fontColor($$.host.mutedColor()).id('reader-manga-offline-probe-status');
      }
    }.width('100%').padding({ left: 8, right: 8, top: 10 })
      .hitTestBehavior(HitTestMode.Default).responseRegion(readerLayoutCarrierResponseRegion());
  }

interface MangaRefreshProgressInput {
  readonly host: MangaReaderChrome;
}

@Builder
export function MangaRefreshProgress($$: MangaRefreshProgressInput) {
    if ($$.host.refreshProgressVisible()) {
      Stack({ alignContent: Alignment.Bottom }) {
        Row({ space: 8 }) {
          LoadingProgress().width(16).height(16).color(readerAppColor('TOK_MESSAGE_INK', $$.host.chromeScheme()))
            .enableLoading(!$$.host.scene.window.reduceMotion).accessibilityLevel('no');
          Text('正在更新本章').fontFamily(MESSAGE_BODY.fontFamily).fontWeight(MESSAGE_BODY.fontWeight)
            .fontSize(MESSAGE_BODY.fontSizeFp).lineHeight(MESSAGE_BODY.lineHeightFp)
            .fontColor(readerAppColor('TOK_MESSAGE_INK', $$.host.chromeScheme()));
        }.padding({ left: 12, right: 12, top: 6, bottom: 6 })
          .margin({ bottom: $$.host.controlsPresentedForWindow() ? $$.host.bottomControlViewportHeight() + 10 : 12 })
          .backgroundColor(readerAppColor('TOK_MESSAGE_SURFACE', $$.host.chromeScheme())).borderRadius(12);
      }.width('100%').height('100%').padding($$.host.scene.window.interactiveInsets($$.host.scene.window.windowMetricsRevision))
        .hitTestBehavior(HitTestMode.None);
    }
  }

interface MangaRecoveryOverlayInput {
  readonly host: MangaReaderChrome;
}

@Builder
export function MangaRecoveryOverlay($$: MangaRecoveryOverlayInput) {
    if ($$.host.scene.chapter.recovering) {
      ForEach([$$.host.recoveryOverlayIdentity()], (identity: string): void => {
        Column() {
          ReaderRecoveryNotice({ tag: '内容更新', layoutWidthVp: Math.max(0, $$.host.scene.reader().viewportWidth - 16 -
            $$.host.scene.window.interactiveInsets($$.host.scene.window.windowMetricsRevision).left - $$.host.scene.window.interactiveInsets($$.host.scene.window.windowMetricsRevision).right),
            maxHeightVp: $$.host.recoveryNoticeHeight(),
            view: { visible: true, generation: $$.host.scene.chapter.presentationGeneration, canRetry: true,
              message: $$.host.scene.book.controller?.replacementRecoveryRequired === true ? '内容已更新，需从新版首图开始。' : '内容已更新，需确认阅读位置。' },
            actionLabel: $$.host.scene.book.controller?.replacementRecoveryRequired === true ? '从首图开始' : '从当前页继续',
            onReconcile: (): void => { if ($$.host.recoveryOverlayCurrent(identity)) void $$.host.scene.actions.confirmRecovery(); } });
        }.width(Math.max(0, $$.host.scene.reader().viewportWidth - 16 - $$.host.scene.window.interactiveInsets($$.host.scene.window.windowMetricsRevision).left -
          $$.host.scene.window.interactiveInsets($$.host.scene.window.windowMetricsRevision).right))
          .constraintSize({ maxHeight: $$.host.recoveryNoticeHeight() })
          .position({ x: 8 + $$.host.scene.window.interactiveInsets($$.host.scene.window.windowMetricsRevision).left,
            y: 10 + $$.host.scene.window.interactiveInsets($$.host.scene.window.windowMetricsRevision).top })
          .opacity($$.host.recoveryOverlayCurrent(identity) ? 1 : 0)
          .enabled($$.host.recoveryOverlayCurrent(identity))
          .accessibilityLevel($$.host.recoveryOverlayCurrent(identity) ? 'auto' : 'no-hide-descendants')
          .hitTestBehavior($$.host.recoveryOverlayCurrent(identity) ? HitTestMode.Default : HitTestMode.None)
          .onTouch((event: TouchEvent): void => event.stopPropagation())
          .zIndex(8);
      }, (identity: string): string => identity);
    }
  }

interface MangaTopBarBackContentInput {
  readonly host: MangaReaderChrome;
}

@Builder
export function MangaTopBarBackContent($$: MangaTopBarBackContentInput) {
    Row() {
      MangaIconAction($$.host, (): Resource => $$.host.floatingChromeScheme('chromeBar') === 'night' ? $r('app.media.book_detail_back_theme_night') :
        $r('app.media.book_detail_back'), '返回', (): void => { void $$.host.scene.actions.handleBack(); }, '');
      Blank().width(44);
    }.width(88);
  }

interface MangaTopBarActionsContentInput {
  readonly host: MangaReaderChrome;
}

@Builder
export function MangaTopBarActionsContent($$: MangaTopBarActionsContentInput) {
    Row() {
      Button({ type: ButtonType.Normal, stateEffect: false }) {
        Column({ space: 2 }) {
          Image($$.host.floatingChromeScheme('chromeBar') === 'night' ? $r('app.media.reader_directory_switch_theme_night') :
            $r('app.media.reader_directory_switch')).width(13).height(13);
          Text('换源').fontFamily(READER_FONT_NOTO_SANS_SC_UI_REGULAR).fontWeight(400).fontSize(10).lineHeight(15).halfLeading(true).fontColor($$.host.inkColor($$.host.floatingChromeScheme('chromeBar'))).maxLines(1);
        }.alignItems(HorizontalAlign.Center).accessibilityLevel('no-hide-descendants');
      }.width(44).height(Math.max(44, 20 + 15 * $$.host.controlFontScale())).padding(0)
        .attributeModifier(new ReaderPressFeedback(Color.Transparent, $$.host.floatingChromeScheme('chromeBar'), 10, 10, $$.host.readerPanelInputEnabled()))
        .id(sourceSwitchTriggerFocusId($$.host.scene.book.sourceId, $$.host.scene.book.bookId, 'manga-source'))
        .enabled($$.host.readerPanelInputEnabled()).accessibilityText('换源')
        .onClick((): void => { void $$.host.scene.actions.openSourceSwitch(); });
      MangaIconAction($$.host, (): Resource => $$.host.floatingChromeScheme('chromeBar') === 'night' ? $r('app.media.reader_directory_more_theme_night') :
        $r('app.media.reader_directory_more'), '更多', (): void => {
          void $$.host.openPanel('more', $$.host.panelTriggerFocusId('more'));
        }, $$.host.panelTriggerFocusId('more'));
    }.width(88).justifyContent(FlexAlign.End);
  }

@Builder
function MangaIconAction(host: MangaReaderChrome, icon: () => Resource, label: string, action: () => void, focusId: string) {
    ReaderIconButton({ icon: icon(), specId: 'manga-reader-action',
      scheme: host.floatingChromeScheme('chromeBar'), accessibilityLabel: label, focusId: focusId, onTap: action });
  }

interface MangaPageBadgeInput {
  readonly host: MangaReaderChrome;
}

@Builder
export function MangaPageBadge($$: MangaPageBadgeInput) {
    Stack({ alignContent: Alignment.BottomStart }) {
      Text(`${$$.host.scene.navigation().chapterEndLabel()} · ${$$.host.scene.reader().presentedPage()} / ${$$.host.scene.reader().pageCount}`)
        .fontFamily(READER_FONT_NOTO_SANS_SC_UI_REGULAR).fontWeight(400).fontSize(11).fontFeature('"tnum" 1').fontColor(readerAppColor('TOK_INK', $$.host.chromeScheme()))
        .padding({ left: 10, right: 10, top: 5, bottom: 5 }).constraintSize({ maxWidth: 230 })
        .maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis })
        .backgroundColor(readerAppColor('TOK_READ_ELEVATED', $$.host.chromeScheme())).borderRadius(12)
        .border({ width: 1, color: readerAppColor('TOK_LINE', $$.host.chromeScheme()) })
        .margin({ left: 12, bottom: $$.host.scene.window.controlsVisible ? $$.host.bottomControlViewportHeight() + 14 : 12 })
        .hitTestBehavior(HitTestMode.None);
    }.width('100%').height('100%').hitTestBehavior(HitTestMode.None)
      .padding($$.host.scene.window.interactiveInsets($$.host.scene.window.windowMetricsRevision));
  }

interface MangaBottomControlsInput {
  readonly host: MangaReaderChrome;
}

@Builder
function MangaBottomControls($$: MangaBottomControlsInput) {
    Column({ space: 4 }) {
      Row({ space: 10 }) {
        ReaderIconButton({ scheme: $$.host.floatingChromeScheme('floatingDock'), specId: 'manga-dock-step',
          icon: $$.host.floatingChromeScheme('floatingDock') === 'night' ? $r('app.media.rc_chevron_left_theme_night') :
            $r('app.media.rc_chevron_left'), accessibilityLabel: '上一页',
          actionEnabled: $$.host.scene.chapter.opened && $$.host.scene.reader().pageOrdinal() > 0, onTap: (): void => { void $$.host.scene.reader().stepPage(-1); } });
        Column({ space: 3 }) {
          Slider({ value: $$.host.scene.reader().presentedPage(), min: 1, max: Math.max(1, $$.host.scene.reader().pageCount), step: 1 })
            .attributeModifier(new ReaderPaperMaterial())
            .height(44).selectedColor(readerAppColor('TOK_ACCENT', $$.host.floatingChromeScheme('floatingDock')))
            .blockColor($$.host.greenColor($$.host.floatingChromeScheme('floatingDock'))).trackColor($$.host.lineColor($$.host.floatingChromeScheme('floatingDock')))
            .enabled($$.host.scene.chapter.opened && $$.host.scene.reader().pageCount > 1)
            .accessibilityText('漫画页码')
            .onTouch((event: TouchEvent): void => {
              if (event.type === TouchType.Cancel) $$.host.scene.reader().selectorTouchCancelled();
            })
            .onChange((value: number, mode: SliderChangeMode): void => {
              $$.host.scene.reader().changePageSlider(value, mode);
            });
          Row() {
            Text($$.host.scene.chapter.opened ? `${$$.host.scene.reader().presentedPage()} / ${$$.host.scene.reader().pageCount}` : '—')
              .fontFamily(READER_FONT_NOTO_SANS_SC_UI_REGULAR).fontWeight(400).fontSize(10).fontFeature('"tnum" 1').fontColor($$.host.mutedColor($$.host.floatingChromeScheme('floatingDock')));
            if ($$.host.scene.chapter.opened) {
              Text(' 页').fontFamily(READER_FONT_NOTO_SANS_SC_UI_REGULAR).fontWeight(400).fontSize(10).fontColor($$.host.mutedColor($$.host.floatingChromeScheme('floatingDock')));
            }
          }.width('100%').justifyContent(FlexAlign.Center).height(Math.max(16, 15 * $$.host.controlFontScale()));
        }.layoutWeight(1);
        ReaderIconButton({ scheme: $$.host.floatingChromeScheme('floatingDock'), specId: 'manga-dock-step',
          icon: $$.host.floatingChromeScheme('floatingDock') === 'night' ? $r('app.media.rc_chevron_right_theme_night') :
            $r('app.media.rc_chevron_right'), accessibilityLabel: '下一页',
          actionEnabled: $$.host.scene.chapter.opened, onTap: (): void => { void $$.host.scene.reader().stepPage(1); } });
      }.width('100%').height($$.host.dockPageRowHeight()).alignItems(VerticalAlign.Top);
      Row() {
        MangaFooterAction($$.host, (): Resource => ($$.host.floatingChromeScheme('floatingDock') === 'night' ? $r('app.media.reader_directory_directory_theme_night') : $r('app.media.reader_directory_directory')), '目录', 'directory');
        MangaFooterAction($$.host, (): Resource => ($$.host.floatingChromeScheme('floatingDock') === 'night' ? $r('app.media.reader_appearance_header_theme_night') : $r('app.media.reader_appearance_header')), '阅读方式', 'mode');
        MangaFooterAction($$.host, (): Resource => ($$.host.floatingChromeScheme('floatingDock') === 'night' ? $r('app.media.reader_settings_header_theme_night') : $r('app.media.reader_settings_header')), '设置', 'settings');
      }.width('100%').height($$.host.dockActionHeight() + 1).border({ width: { top: 1 }, color: $$.host.lineColor($$.host.floatingChromeScheme('floatingDock')) });
    }.width('100%').padding({ left: 14, right: 14, top: 13, bottom: 11 })
      .attributeModifier(new ReaderPanelFrame('manga-dock', $$.host.floatingChromeScheme('floatingDock'), false, undefined,
        $$.host.surfaceMaterial('floatingDock')))
      .hitTestBehavior(HitTestMode.Default)
      .onTouch((): void => {});
  }

@Builder
function MangaFooterAction(host: MangaReaderChrome, icon: () => Resource, label: string, panel: string) {
    Button({ type: ButtonType.Normal, stateEffect: false }) {
      Column() {
        Stack({ alignContent: Alignment.Center }) { Image(icon()).width(14).height(14); }
          .width(30).height(28).accessibilityLevel('no');
        Text(label).fontFamily(READER_FONT_NOTO_SANS_SC_UI_REGULAR).fontWeight(400).fontSize(12).lineHeight(18).halfLeading(true).fontColor(host.inkColor(host.floatingChromeScheme('floatingDock'))).maxLines(1);
      }.width('100%').justifyContent(FlexAlign.Center).accessibilityLevel('no-hide-descendants');
    }.id(host.panelTriggerFocusId(panel)).enabled(host.readerPanelInputEnabled())
      .layoutWeight(1).height(host.dockActionHeight()).padding(0)
      .attributeModifier(new ReaderPressFeedback(Color.Transparent, host.floatingChromeScheme('floatingDock'), 8, 8, host.readerPanelInputEnabled()))
      .onClick((): void => { void host.openPanel(panel, host.panelTriggerFocusId(panel)); }).accessibilityText(label);
  }

@Builder
export function MangaPanelOverlay(host: MangaReaderChrome, directory: MangaDirectoryDrawer, directoryIdentity: string, opening: number) {
    Stack({ alignContent: host.widePanel() ? Alignment.End : Alignment.Bottom }) {
      Column().width('100%').height('100%')
        .backgroundColor(host.widePanel() && host.scene.window.panel !== 'directory' ? Color.Transparent : host.scene.window.panel === 'directory' ?
          mangaDirectoryColor('scrim', host.chromeScheme()) :
          readerAppColor(resolveDrawerSpec('reader-action-sheet').scrimRole, host.chromeScheme()))
        .opacity(host.widePanel() && host.scene.window.panel !== 'directory' ? 1 : host.state.panelScrimOpacity)
        .accessibilityLevel('no')
        .onClick((): void => {
          // The opening touch and an unfinished handle gesture cannot also
          // become an outside dismissal while the surface is moving.
          if (host.state.panelPhase === 'open' && host.panelInputCurrent(opening)) void host.closePanel();
        });
      if (host.scene.window.panel === 'directory') { MangaDirectorySheet(directory, directoryIdentity, opening); }
      else { MangaActionPanelSurface(host, opening); }
    }.width('100%').height('100%')
      .accessibilityLevel((host.widePanel() && host.scene.window.panel !== 'directory') || host.state.panelPhase === 'open' || host.state.panelPhase === 'dragging' ?
        'auto' : 'no-hide-descendants');
  }

@Builder
function MangaActionPanelSurface(host: MangaReaderChrome, opening: number) {
    // Keep a native hit target alive while its children are waiting for the
    // opening/closing animation. A disabled whole surface exposes its scrim.
    Column() {
      ReaderBoundedSurface({ specId: 'reader-action-sheet', surfaceWidth: host.panelWidth(),
        surfaceHeight: host.widePanel() ? host.panelHeight() : 0, maxSurfaceHeight: host.panelHeight(),
        placement: host.widePanel() ? 'side' : 'bottom', scheme: host.sheetScheme(),
        safeInsets: host.actionPanelInsets(), header: (): void => { host.scene.slots.actionPanelHeader(opening); },
        body: (): void => { host.scene.slots.actionPanelBody(opening); },
      }).enabled(host.state.panelPhase === 'open' || host.state.panelPhase === 'dragging');
    }.width(host.panelWidth())
      .translate({ x: host.widePanel() ? host.state.panelOffset : 0, y: host.widePanel() ? 0 : host.state.panelOffset })
      .opacity(host.state.panelOpacity)
      .hitTestBehavior(host.widePanel() ? HitTestMode.Block : HitTestMode.Default);
  }

@Builder
export function MangaActionPanelHeader(host: MangaReaderChrome, opening: number) {
    ReaderBoundedSurfaceHeader({ specId: 'reader-action-sheet', title: host.panelTitle(), surfaceWidth: Number(host.panelWidth()),
      placement: host.widePanel() ? 'side' : 'bottom', scheme: host.sheetScheme(),
      actionEnabled: host.state.panelPhase === 'open' || host.state.panelPhase === 'dragging',
      closeFocusId: host.panelCloseFocusId(opening),
      onAreaChanged: (_old: Area, area: Area): void => {
        if (opening !== host.state.actionPanelPresentationGeneration || !host.isActionPanel()) return;
        const height = Number(area.height);
        if (Number.isFinite(height) && height > 0 && Math.abs(height - host.state.actionHeaderMeasuredHeight) > .5) host.state.actionHeaderMeasuredHeight = height;
      },
      onClose: (): void => { if (host.panelInputCurrent(opening)) void host.closePanel(); },
      onHandlePanStart: (): void => { if (host.panelInputCurrent(opening)) host.beginPanelDrag(); },
      onHandlePanUpdate: (offset: number): void => { if (host.panelInputCurrent(opening)) host.updatePanelDrag(offset); },
      onHandlePanEnd: (offset: number, velocity: number): void => {
        if (host.panelInputCurrent(opening)) host.finishPanelDrag(offset, velocity);
      },
    });
  }

@Builder
export function MangaActionPanelBody(host: MangaReaderChrome, opening: number) {
    Scroll() {
      Column() {
        if (host.scene.window.panel === 'downloads') {
          ForEach([host.state.downloadActionsGeneration], (generation: number): void => {
            MangaDownloadOperationsPanel({ reduceMotion: host.scene.window.reduceMotion,
              actions: host.state.downloadActions, loading: host.state.downloadActionsLoading,
              directoryRecovery: host.scene.book.directoryRecovery,
              recoveryActive: host.downloadPanelInputCurrent(opening, generation),
              onReconcileOffline: (expected: number, presentation: string): void => {
                if (host.downloadPanelInputCurrent(opening, generation)) host.scene.actions.onReconcileOffline(expected, presentation);
              },
              onContinueOffline: (expected: number, presentation: string): void => {
                if (host.downloadPanelInputCurrent(opening, generation)) host.scene.actions.onContinueOffline(expected, presentation);
              },
              failureMessage: host.state.downloadActionsFailure, panelScheme: host.sheetScheme(),
              onAction: (action: MangaDownloadActionId): void => host.performDownloadAction(action, generation),
              onRetry: (): void => {
                if (host.ownsDownloadActions(generation) && host.scene.window.panel === 'downloads' &&
                  host.state.panelPhase === 'open' && host.state.downloadActionsFailure.length > 0) {
                  void host.openDownloadActions(host.downloadActionsChapterIndex);
                }
              },
            });
          }, (generation: number): string => `downloads:${generation}`);
        } else if (host.scene.window.panel === 'mode') { MangaModePanel(host, opening); }
        else if (host.scene.window.panel === 'settings') { MangaSettingsPanel(host, opening); }
        else { MangaMorePanel(host, opening); }
      }.width('100%').padding({ left: host.panelContentInset(), right: host.panelContentInset(), bottom: resolveDrawerSpec('reader-action-sheet').contentInset });
    }.width('100%').constraintSize({ maxHeight: Math.max(1, host.panelContentHeight() - host.actionHeaderHeight()) })
      .layoutWeight(host.widePanel() ? 1 : 0).scrollBar(BarState.Auto).align(Alignment.Top);
  }

@Builder
function MangaModePanel(host: MangaReaderChrome, opening: number) {
    Column({ space: 12 }) {
      MangaSectionTitle(host, '阅读模式');
      Row({ space: 8 }) {
        MangaSheetChoice(host, 'vertical', '竖向连续', (): void => {
          if (host.preferencePanelInputCurrent(opening, 'mode') && host.scene.reader().horizontal) host.scene.reader().toggleDirection();
        });
        MangaSheetChoice(host, 'horizontal', '横向分页', (): void => {
          if (host.preferencePanelInputCurrent(opening, 'mode') && !host.scene.reader().horizontal) host.scene.reader().toggleDirection();
        });
      }.width('100%');
    }.width('100%');
    Column() {
      Text('图片适配').fontSize(13).fontFamily(READER_FONT_NOTO_SANS_SC_UI_BOLD).fontWeight(700).lineHeight(21).fontColor(host.inkColor(host.sheetScheme())).width('100%').margin({ bottom: 12 });
      MangaFitLine(host, '跟随书源', 'source', (): void => {
        if (host.preferencePanelInputCurrent(opening, 'mode')) void host.scene.reader().changeFit('source');
      });
      MangaFitLine(host, '适合屏幕', 'width', (): void => {
        if (host.preferencePanelInputCurrent(opening, 'mode')) void host.scene.reader().changeFit('width');
      });
      MangaFitLine(host, '完整图片', 'contain', (): void => {
        if (host.preferencePanelInputCurrent(opening, 'mode')) void host.scene.reader().changeFit('contain');
      });
    }.width('100%');
  }

@Builder
function MangaSectionTitle(host: MangaReaderChrome, label: string) {
    Text(label).fontSize(13).fontFamily(READER_FONT_NOTO_SANS_SC_UI_BOLD).fontWeight(700).lineHeight(21).fontColor(host.inkColor(host.sheetScheme())).width('100%');
  }

@Builder
function MangaSheetChoice(host: MangaReaderChrome, kind: string, label: string, action: () => void) {
    Button({ type: ButtonType.Normal, stateEffect: false }) {
    Row({ space: 6 }) {
      Image(host.choiceIcon(kind)).width(14).height(14);
      Text(label).layoutWeight(1).textAlign(TextAlign.Center).fontSize(12).fontFamily(READER_FONT_NOTO_SANS_SC_UI_REGULAR).fontWeight(400).lineHeight(18)
        .halfLeading(true).fontColor(host.isSheetChoiceSelected(kind) ? readerAppColor('TOK_ON_PRIMARY', host.sheetScheme()) : host.mutedColor(host.sheetScheme()));
    }.width('100%').justifyContent(FlexAlign.Center).accessibilityLevel('no-hide-descendants');
    }.layoutWeight(1).constraintSize({ minHeight: 44 }).padding(8)
      .attributeModifier(new ReaderPressFeedback(host.isSheetChoiceSelected(kind) ? host.greenColor(host.sheetScheme()) : host.softSurfaceColor(host.sheetScheme()),
        host.sheetScheme(), 12))
      .border({ width: 1, color: host.isSheetChoiceSelected(kind) ? host.greenColor(host.sheetScheme()) : host.lineColor(host.sheetScheme()) }).onClick(action)
      .accessibilityText(`${label}，${host.isSheetChoiceSelected(kind) ? '已选择' : '未选择'}`);
  }

@Builder
function MangaFitLine(host: MangaReaderChrome, label: string, fit: string, action: () => void) {
    Button({ type: ButtonType.Normal, stateEffect: false }) {
    Row({ space: 12 }) {
      Text(label).fontSize(12).fontFamily(READER_FONT_NOTO_SANS_SC_UI_REGULAR).fontWeight(400).lineHeight(18)
        .halfLeading(true).fontColor(host.inkColor(host.sheetScheme())).layoutWeight(1);
      if (host.scene.reader().fit === fit) { Image(host.sheetScheme() === 'night' ? $r('app.media.manga_sheet_check_theme_night') : $r('app.media.manga_sheet_check')).width(14).height(14); }
    }.width('100%').height('100%').accessibilityLevel('no-hide-descendants');
    }.width('100%').height(host.sheetActionHeight()).padding(0)
      .attributeModifier(new ReaderPressFeedback(Color.Transparent, host.sheetScheme()))
      .border({ width: { bottom: 1 }, color: host.lineColor(host.sheetScheme()) }).onClick(action)
      .accessibilityText(`${label}，${host.scene.reader().fit === fit ? '已选择' : '未选择'}`);
  }

@Builder
function MangaSettingsPanel(host: MangaReaderChrome, opening: number) {
    Column({ space: 12 }) {
      MangaSectionTitle(host, '阅读底色');
      Row({ space: 8 }) {
        MangaSheetChoice(host, 'sun', '暖纸', (): void => {
          host.setBackground('paper', opening);
        });
        MangaSheetChoice(host, 'moon', '深墨', (): void => {
          host.setBackground('ink', opening);
        });
      }.width('100%');
    }.width('100%');
    Column() {
      Row() {
        Text('亮度').fontSize(13).fontFamily(READER_FONT_NOTO_SANS_SC_UI_BOLD).fontWeight(700).lineHeight(21).fontColor(host.inkColor(host.sheetScheme())).layoutWeight(1);
        Text(host.state.automaticBrightness ? '跟随系统' : `${Math.round(host.state.brightnessPercent)}%`)
          .fontSize(11).fontFamily(READER_FONT_NOTO_SANS_SC_UI_REGULAR).fontWeight(400).fontColor(host.mutedColor(host.sheetScheme()));
        ReaderToggle({ value: host.state.automaticBrightness, checkedColor: host.greenColor(host.sheetScheme()),
          inputIdentity: `${host.panelCloseFocusId(opening)}:brightness-auto`, accessibilityLabel: '亮度跟随系统',
          actionEnabled: host.preferencePanelInputCurrent(opening, 'settings'),
          onToggle: (enabled: boolean): void => {
            if (host.preferencePanelInputCurrent(opening, 'settings') && enabled !== host.state.automaticBrightness) {
              host.setBrightness(host.state.brightnessPercent, enabled);
            }
          } });
      }.width('100%').margin({ bottom: 10 });
      Slider({ value: host.state.brightnessPercent, min: 1, max: 100, step: 1 })
        .attributeModifier(new ReaderPaperMaterial()).width('100%').height(44)
        .enabled(host.preferencePanelInputCurrent(opening, 'settings'))
        .selectedColor(host.greenColor(host.sheetScheme())).blockColor(host.greenColor(host.sheetScheme())).trackColor(host.lineColor(host.sheetScheme()))
        .onChange((value: number, mode: SliderChangeMode): void => host.changeBrightnessSlider(value, mode, opening))
        .accessibilityText('阅读亮度');
      Row() {
        Button({ type: ButtonType.Normal, stateEffect: false }) {
          Text('常驻页码').width('100%').textAlign(TextAlign.Start).fontSize(12)
            .fontFamily(READER_FONT_NOTO_SANS_SC_UI_REGULAR).fontWeight(400).lineHeight(18)
            .fontColor(host.inkColor(host.sheetScheme())).accessibilityLevel('no');
        }.layoutWeight(1).height('100%').padding(0)
          .attributeModifier(new ReaderPressFeedback(Color.Transparent, host.sheetScheme(), 0, 0,
            host.preferencePanelInputCurrent(opening, 'settings')))
          .onClick((): void => {
            if (host.preferencePanelInputCurrent(opening, 'settings')) host.setPageNumbers(!host.state.showPageNumbers);
          }).accessibilityText(`常驻页码，${host.state.showPageNumbers ? '已启用' : '已关闭'}`);
        ReaderToggle({ value: host.state.showPageNumbers, checkedColor: host.greenColor(host.sheetScheme()),
          inputIdentity: `${host.panelCloseFocusId(opening)}:page-numbers`, accessibilityLabel: '常驻页码',
          actionEnabled: host.preferencePanelInputCurrent(opening, 'settings'),
          onToggle: (enabled: boolean): void => {
            if (host.preferencePanelInputCurrent(opening, 'settings') && enabled !== host.state.showPageNumbers) {
              host.setPageNumbers(enabled);
            }
          } });
      }.width('100%').height(host.sheetActionHeight()).border({ width: { bottom: 1 }, color: host.lineColor(host.sheetScheme()) })
        .hitTestBehavior(host.widePanel() ? HitTestMode.Block : HitTestMode.Default);
    }.width('100%');
    Button({ type: ButtonType.Normal, stateEffect: false }) {
      Text('恢复默认').fontSize(12).fontFamily(READER_FONT_NOTO_SANS_SC_UI_REGULAR).fontWeight(400)
        .lineHeight(18).fontColor(host.accentColor(host.sheetScheme())).textAlign(TextAlign.Center).accessibilityLevel('no');
    }.width('100%').height(host.sheetActionHeight()).padding(0)
      .attributeModifier(new ReaderPressFeedback(Color.Transparent, host.sheetScheme(), 0, 0,
        host.preferencePanelInputCurrent(opening, 'settings')))
      .accessibilityText('恢复默认').onClick((): void => {
        if (!host.preferencePanelInputCurrent(opening, 'settings')) return;
        const motion = host.panelGeneration;
        void host.resetMangaPreferences().catch((error: Error): void => {
          if (motion === host.panelGeneration && host.preferencePanelInputCurrent(opening, 'settings')) host.scene.chapter.reportError(error.message);
        });
      });
  }

@Builder
function MangaMorePanel(host: MangaReaderChrome, opening: number) {
    ReaderActionMenuSurface({
      variant: host.scene.book.moreMenuVariant, actions: host.moreActions(),
      scheme: host.sheetScheme(),
      onAction: (id: string): void => host.performMoreAction(id, opening),
    });
  }

interface MangaChapterEndContentInput {
  readonly host: MangaReaderChrome;
}

@Builder
export function MangaChapterEndContent($$: MangaChapterEndContentInput) {
    Stack({ alignContent: Alignment.Bottom }) {
      Scroll() {
        Button({ type: ButtonType.Normal, stateEffect: false }) {
          Row({ space: 8 }) {
            Image($$.host.chromeScheme() === 'night' ? $r('app.media.reader_chevron_down_primary_theme_night') :
              $r('app.media.reader_chevron_down_primary')).rotate({ angle: $$.host.scene.navigation().adjacentChapter(1) === undefined ? 90 : 270 })
              .width(16).height(16).flexShrink(0).accessibilityLevel('no');
            Text($$.host.chapterEndActionLabel()).fontFamily(READER_FONT_NOTO_SANS_SC_UI_MEDIUM).fontSize(13).lineHeight(20).halfLeading(true).fontWeight(500).maxLines(3)
              .fontColor($$.host.greenColor()).textAlign(TextAlign.Center);
          }.width('100%').justifyContent(FlexAlign.Center).accessibilityLevel('no-hide-descendants');
        }.width('100%').constraintSize({ minHeight: 56 }).padding({ top: 8, bottom: 8, left: 16, right: 16 })
          .attributeModifier(new ReaderPressFeedback(readerAppColor('TOK_SURFACE_ELEVATED', $$.host.chromeScheme()),
            $$.host.chromeScheme(), 0, 0, $$.host.readerPanelForeground() && $$.host.scene.chapter.chapterEnd && $$.host.scene.window.panel.length === 0))
          .border({ width: { top: 1 }, color: readerAppColor('TOK_LINE', $$.host.chromeScheme()) })
          .accessibilityText($$.host.chapterEndActionLabel())
          .onClick((): void => {
            if (!$$.host.readerPanelForeground() || !$$.host.scene.chapter.chapterEnd || $$.host.scene.window.panel.length > 0) return;
            if ($$.host.scene.navigation().adjacentChapter(1) === undefined) $$.host.scene.navigation().resumeFromChapterEnd();
            else void $$.host.scene.navigation().selectAdjacentChapter(1);
          });
      }.width('100%').constraintSize({ maxHeight: Math.max(56, $$.host.scene.reader().viewportHeight - $$.host.scene.window.windowInteractiveInsets($$.host.scene.window.windowMetricsRevision).top) })
        .scrollBar(BarState.Off).edgeEffect(EdgeEffect.None);
    }.width('100%').height('100%').padding($$.host.scene.window.interactiveInsets($$.host.scene.window.windowMetricsRevision));
  }
