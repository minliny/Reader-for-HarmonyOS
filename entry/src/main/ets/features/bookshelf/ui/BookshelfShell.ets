import { ReaderTransientFeedback, READER_FEEDBACK_BRIEF_MS } from '../../../ui/feedback/ReaderTransientFeedback';
import type { ReaderRecoveryView } from '../../../ui/feedback/ReaderRecoveryView';
import { ReaderRecoveryNotice } from '../../../ui/feedback/ReaderRecoveryNotice';
import { ReaderRecoveryAction } from '../../../ui/feedback/ReaderRecoveryAction';
import { MainTabShell } from '../../shell/MainTabShell';
import { registerReaderShelfFonts } from '../../../ui/foundation/ReaderFonts';
import { ReaderWindowChromeStyle, ReaderWindowCoordinator } from '../../../app/ReaderWindowCoordinator';
import { BookshelfMoreActionSheet } from './BookshelfMoreActionSheet';
import { readerAppColor } from '../../../ui/foundation/ReaderThemeRegistry';
import { readerScrimmedOpaqueColor } from '../../../ui/surfaces/ReaderScrimColor';
import { SheetSurfaceSpec, resolveSheetSpec } from '../../../ui/surfaces/ReaderSurfaceSpecs';
import { SurfaceWidthSpec, resolveHorizontalFrame } from '../../../ui/layout/SurfaceHorizontalGeometry';
import { readerVisualSafeLeft, readerVisualSafeRight } from '../../../ui/foundation/ReaderWindowMetrics';
import { bookshelfHeaderSpec } from '../../../ui/foundation/ReaderHeaderSpecs';
import { ReaderMeasurementStore } from '../../../ui/layout/ReaderMeasurements';

let bookshelfTemporaryGeneration: number = 0;

// Index mounts this shell once for the bookshelf route. Core readiness only
// changes the content slot, preserving the title, navigation and sheet owner.
@Component
export struct BookshelfShell {
  private readonly transientFeedback: ReaderTransientFeedback = new ReaderTransientFeedback();
  @StorageLink('readerAppScheme') private appThemeScheme: string = 'day';
  @StorageLink('readerWindowMetricsRevision') @Watch('onFooterLayoutChanged') private readerWindowMetricsRevision: number = 0;
  @StorageLink('readerMainViewportRevision') @Watch('onFooterLayoutChanged') private mainViewportRevision: number = 0;
  @Prop @Watch('onRecoveryChanged') recovery: ReaderRecoveryView = { message: '', visible: false, canRetry: false, generation: 0 };
  @Prop recoveryBusy: boolean = false;
  @Prop @Watch('onReadRecoveryChanged') readRecovery: ReaderRecoveryView | undefined = undefined;
  onNoticeHeightChange: (height: number, generation?: number) => void = (_height: number, _generation?: number): void => {};
  private noticeHeight: number = 0;
  onRetryRead: (generation: number, navigation?: number) => void = (_generation: number): void => {};
  onReconcile: (generation: number, navigation?: number) => void = (_generation: number): void => {};
  @Prop canContinueRemoval: boolean = false;
  @Prop removalActionLabel: string = '继续原删除操作';
  onContinueRemoval: (generation: number, navigation: number) => void = (_generation: number, _navigation: number): void => {};
  @Prop @Watch('onNavigationGenerationChanged') navigationGeneration: number = 0;
  @Prop populated: boolean = false;
  @Prop @Watch('onReadRecoveryChanged') feedbackEnabled: boolean = true;
  @Prop reduceMotion: boolean = false;
  @Prop canCheckUpdates: boolean = false;
  @Prop updateRunning: boolean = false;
  @Prop backgroundUpdateRunning: boolean = false;
  @Prop updateProgressDone: number = 0;
  @Prop updateProgressTotal: number = 0;
  onImportRequested: (generation?: number, focusTarget?: string) => void =
    (_generation?: number, _focusTarget?: string): void => {};
  onBatchManageRequested: (generation?: number) => void = (_generation?: number): void => {};
  onBookshelfSettingsRequested: (generation?: number) => void = (_generation?: number): void => {};
  onDownloadsRequested: (generation?: number) => void = (_generation?: number): void => {};
  onCheckUpdatesRequested: (generation?: number) => void = (_generation?: number): void => {};
  onMainTab: (key: string, presentedNavigation?: number) => void = (_key: string): void => {};
  onCurrentTabTap: (presentedNavigation?: number) => void = (_presentedNavigation?: number): void => {};
  @BuilderParam content: (measuredFooterHeight: number) => void;
  private readonly footerMeasurements: ReaderMeasurementStore = new ReaderMeasurementStore();
  @State private footerMeasurementKey: number = 0;
  @State private measuredFooterHeight: number = 0;
  /** Presented header bottom (top + measured height), owned by the route. */
  @Prop headerBottom: number = bookshelfHeaderSpec().frameHeight;
  @State private moreMenuVisible: boolean = false;
  private moreSelectionId: string = '';
  private moreSheetCurrentId: string = '';
  private moreSheetNavigation: number = 0;
  private moreImportSheetId: string = '';
  private moreSheetAppearedId: string = '';
  private moreSheetChromeId: string = '';
  private mounted: boolean = false;
  private temporaryBackIdentity: string = '';
  private temporaryBackGeneration: number = 0;
  onTemporaryBackBridge: (handler: (() => boolean) | undefined, identity: string, generation?: number) => void =
    (_handler: (() => boolean) | undefined, _identity: string, _generation?: number): void => {};
  // The shared search surface may render the More actor, while the sheet and
  // its presentation identity remain owned here. A retired handler is inert.
  onMoreBridge: (handler: (() => void) | undefined, identity: string, generation?: number) => void =
    (_handler: (() => void) | undefined, _identity: string, _generation?: number): void => {};

  aboutToAppear(): void {
    this.mounted = true;
    this.onFooterLayoutChanged();
    this.onReadRecoveryChanged();
    this.onRecoveryChanged();
    registerReaderShelfFonts(this.getUIContext().getFont());
    this.registerTemporaryBackGeneration();
  }

  aboutToDisappear(): void {
    this.transientFeedback.reset();
    const identity = this.temporaryBackIdentity;
    const generation = this.temporaryBackGeneration;
    this.releaseMoreSheetChrome(this.moreSheetCurrentId);
    this.mounted = false;
    this.footerMeasurementKey += 1;
    this.footerMeasurements.clear();
    this.measuredFooterHeight = 0;
    this.onNoticeHeightChange(0, this.navigationGeneration);
    this.temporaryBackIdentity = '';
    this.moreImportSheetId = '';
    this.dismissMoreMenu();
    this.onTemporaryBackBridge(undefined, identity, generation);
    this.onMoreBridge(undefined, identity, generation);
  }

  private onNavigationGenerationChanged(): void {
    if (!this.mounted) return;
    this.onFooterLayoutChanged();
    this.moreImportSheetId = '';
    this.dismissMoreMenu();
    this.registerTemporaryBackGeneration();
  }

  private onFooterLayoutChanged(): void {
    if (this.mounted) this.footerMeasurementKey += 1;
  }

  private recordFooterHeight(height: number, presentedKey: number): void {
    if (!this.mounted || presentedKey !== this.footerMeasurementKey) return;
    if (this.footerMeasurements.record('bookshelf:footer', height, presentedKey)) {
      this.measuredFooterHeight = this.footerMeasurements.read('bookshelf:footer');
    }
  }

  private registerTemporaryBackGeneration(): void {
    if (!this.mounted) return;
    const previousIdentity = this.temporaryBackIdentity;
    const previousGeneration = this.temporaryBackGeneration;
    const identity = `bookshelf-back:${++bookshelfTemporaryGeneration}`;
    const generation = this.navigationGeneration;
    this.temporaryBackIdentity = identity;
    this.temporaryBackGeneration = generation;
    if (previousIdentity.length > 0) {
      this.onTemporaryBackBridge(undefined, previousIdentity, previousGeneration);
      this.onMoreBridge(undefined, previousIdentity, previousGeneration);
    }
    this.onTemporaryBackBridge((): boolean => this.consumeTemporaryBack(identity), identity, generation);
    this.onMoreBridge(this.moreOpenAction(identity), identity, generation);
  }

  private consumeTemporaryBack(identity: string): boolean {
    if (identity !== this.temporaryBackIdentity || !this.isCurrentMoreSheet(this.moreSheetCurrentId)) return false;
    // Native dismissal keeps this sheet in front until onDisappear.
    if (this.moreMenuVisible) this.dismissMoreMenu();
    return true;
  }

  private dismissMoreMenu(): void {
    this.releaseMoreSheetChrome(this.moreSheetCurrentId);
    this.moreMenuVisible = false;
    this.moreSelectionId = '';
  }

  private moreOpenAction(identity: string): () => void {
    return (): void => {
      if (!this.mounted || identity !== this.temporaryBackIdentity || this.moreMenuVisible || this.moreSheetCurrentId.length > 0) return;
      this.moreSelectionId = `bookshelf-more:${++bookshelfTemporaryGeneration}`;
      this.moreSheetCurrentId = this.moreSelectionId;
      this.moreSheetNavigation = this.navigationGeneration;
      this.moreSheetAppearedId = '';
      this.moreMenuVisible = true;
    };
  }

  private isCurrentMoreSheet(presentationId: string): boolean {
    return this.mounted && presentationId.length > 0 && presentationId === this.moreSheetCurrentId &&
      this.moreSheetNavigation === this.navigationGeneration;
  }

  private releaseMoreSheetChrome(presentationId: string): void {
    if (!this.mounted || presentationId.length === 0 || presentationId !== this.moreSheetChromeId) return;
    this.moreSheetChromeId = '';
    ReaderWindowCoordinator.requestAppChrome();
  }

  private claimMoreSheetChrome(presentationId: string): void {
    if (!this.isCurrentMoreSheet(presentationId)) return;
    const spec = this.moreSheetSpec();
    const mask = readerAppColor(spec.hostMaskRole, this.appThemeScheme);
    const paper = readerScrimmedOpaqueColor(readerAppColor('app.window.background', this.appThemeScheme), mask);
    const ink = readerScrimmedOpaqueColor(readerAppColor('app.window.foreground', this.appThemeScheme), mask);
    const style = new ReaderWindowChromeStyle(paper, this.appThemeScheme === 'night' ? 'light' : 'dark', ink);
    style.navigationUnderlayColor = readerAppColor(spec.hostBackgroundRole, this.appThemeScheme);
    style.navigationContentColor = readerAppColor('app.window.foreground', this.appThemeScheme);
    this.moreSheetChromeId = presentationId;
    ReaderWindowCoordinator.requestOverlayChrome(style);
  }

  private moreSheetSpec(): SheetSurfaceSpec { return resolveSheetSpec('bookshelf-book-action'); }

  private moreSheetWidth(): number {
    const metrics = ReaderWindowCoordinator.metrics();
    return resolveHorizontalFrame(metrics.windowRect.width, readerVisualSafeLeft(metrics), readerVisualSafeRight(metrics),
      new SurfaceWidthSpec(this.moreSheetSpec().maxWidth)).width;
  }

  private moreSheetOptions(presentationId: string = this.moreSheetCurrentId): SheetOptions {
    const spec = this.moreSheetSpec();
    return {
      height: SheetSize.FIT_CONTENT,
      width: this.moreSheetWidth(),
      preferType: SheetType.BOTTOM,
      dragBar: false,
      showClose: false,
      backgroundColor: readerAppColor(spec.hostBackgroundRole, this.appThemeScheme),
      radius: { topLeft: spec.borderRadius, topRight: spec.borderRadius, bottomLeft: 0, bottomRight: 0 },
      maskColor: readerAppColor(spec.hostMaskRole, this.appThemeScheme),
      shadow: { radius: 0, color: Color.Transparent, offsetX: 0, offsetY: 0 },
      enableOutsideInteractive: false,
      onWillAppear: (): void => this.claimMoreSheetChrome(presentationId),
      onAppear: (): void => { if (this.isCurrentMoreSheet(presentationId)) this.moreSheetAppearedId = presentationId; },
      onWillDismiss: (dismissal: DismissSheetAction): void => {
        if (!this.isCurrentMoreSheet(presentationId)) return;
        if (dismissal.reason !== DismissReason.PRESS_BACK && this.moreSheetAppearedId !== presentationId) return;
        this.releaseMoreSheetChrome(presentationId);
        this.dismissMoreMenu();
        dismissal.dismiss();
      },
      onDisappear: (): void => this.finishMoreSheet(presentationId),
    };
  }

  private finishMoreSheet(presentationId: string): void {
    if (presentationId.length === 0 || presentationId !== this.moreSheetCurrentId) return;
    const openImport = this.moreImportSheetId === presentationId && this.isCurrentMoreSheet(presentationId);
    const navigation = this.moreSheetNavigation;
    const focusTarget = this.temporaryBackIdentity;
    this.moreImportSheetId = '';
    this.releaseMoreSheetChrome(presentationId);
    this.moreSheetCurrentId = '';
    this.moreSheetNavigation = 0;
    this.moreSheetAppearedId = '';
    if (openImport) this.onImportRequested(navigation, focusTarget);
  }

  private moreIntentAction(identity: string, action: (generation: number) => void): () => void {
    const generation = this.navigationGeneration;
    return (): void => {
      if (!this.mounted || generation !== this.navigationGeneration || !this.moreMenuVisible ||
        identity.length === 0 || identity !== this.moreSelectionId) return;
      action(generation);
    };
  }

  build() {
    Stack({ alignContent: Alignment.TopStart }) {
      MainTabShell({
        activeTab: 'bookshelf', headerKind: 'floating', headerVisible: false,
        navigationGeneration: this.navigationGeneration,
        footerMeasurementKey: this.footerMeasurementKey,
        onFooterHeightChange: (height: number, presentedKey: number): void => this.recordFooterHeight(height, presentedKey),
        onMainTab: (key: string, generation?: number): void => this.requestMainTab(key, generation ?? this.navigationGeneration),
        onCurrentTabTap: (_key: string, generation?: number): void => {
          if (!this.mounted || (generation ?? this.navigationGeneration) !== this.navigationGeneration) return;
          this.onCurrentTabTap(generation);
        },
        content: (): void => { this.content(this.measuredFooterHeight); },
        overlayContent: (): void => { this.shellOverlay(); },
      });
    }
    .width('100%').height('100%')
    .bindSheet(this.moreMenuVisible, this.moreSheetContent, this.moreSheetOptions());
  }

  @Builder
  private shellOverlay() {
    if (this.recovery.visible) {
      Column() {
        Column() { this.recoveryNoticeContent(this.recovery, false); }.width('100%')
          .onAreaChange(this.noticeHeightHandler());
      }.width('100%')
        .padding({ left: 17, right: 17, top: this.headerBottom + bookshelfHeaderSpec().contentGap })
        .hitTestBehavior(HitTestMode.Transparent);
    }
  }

  @Builder
  private moreSheetContent() {
    ForEach([this.moreSheetCurrentId], (presentationId: string): void => {
      BookshelfMoreActionSheet({
        presentationId,
        canCheckUpdates: this.canCheckUpdates,
        updateRunning: this.updateRunning,
        backgroundUpdateRunning: this.backgroundUpdateRunning,
        isCurrent: (candidate: string): boolean => this.isCurrentMoreSheet(candidate),
        onCheckUpdates: this.moreIntentAction(presentationId, (generation: number): void => {
          this.requestCheckUpdates(generation);
          this.dismissMoreMenu();
        }),
        onBatchManage: this.moreIntentAction(presentationId, (generation: number): void => {
          this.dismissMoreMenu();
          this.onBatchManageRequested(generation);
        }),
        onLocalImport: this.moreIntentAction(presentationId, (): void => {
          this.moreImportSheetId = presentationId;
          this.dismissMoreMenu();
        }),
        onBookshelfSettings: this.moreIntentAction(presentationId, (generation: number): void => {
          this.dismissMoreMenu();
          this.onBookshelfSettingsRequested(generation);
        }),
        onDownloadsRequested: this.moreIntentAction(presentationId, (generation: number): void => {
          this.dismissMoreMenu();
          this.onDownloadsRequested(generation);
        }),
      });
    }, (presentationId: string): string => `bookshelf-more-sheet:${presentationId}`);
  }

  private noticeHeightHandler(): (_old: Area, area: Area) => void {
    const navigation = this.navigationGeneration;
    const recoveryGeneration = this.recovery.generation;
    return (_old: Area, area: Area): void => {
      if (!this.mounted || navigation !== this.navigationGeneration || !this.recovery.visible ||
        recoveryGeneration !== this.recovery.generation) return;
      const height = this.numericAreaLength(area.height);
      if (Math.abs(height - this.noticeHeight) > .1) {
        this.noticeHeight = height; this.onNoticeHeightChange(height, navigation);
      }
    };
  }

  @Builder
  private recoveryNoticeContent(view: ReaderRecoveryView, read: boolean) {
    // Only the compact feedback actor changes identity; content stays mounted.
    ForEach([JSON.stringify([this.navigationGeneration, view.generation])], (identity: string): void => {
      ReaderRecoveryNotice({ view, tag: '书架待处理', actionLabel: '核对操作结果', busy: !read && this.recoveryBusy,
        secondaryActionLabel: !read && this.canContinueRemoval ? this.removalActionLabel : '',
        onSecondaryAction: (generation: number): void => {
          const tokens = JSON.parse(identity) as number[];
          if (!this.mounted || generation !== tokens[1] || this.navigationGeneration !== tokens[0]) return;
          this.onContinueRemoval(tokens[1], tokens[0]);
        },
        onReconcile: (generation: number): void => {
          const tokens = JSON.parse(identity) as number[];
          if (generation !== tokens[1] || this.navigationGeneration !== tokens[0]) return;
          if (read) this.onRetryRead(tokens[1], tokens[0]); else this.onReconcile(tokens[1], tokens[0]);
        } });
    }, (identity: string): string => identity);
  }

  private onRecoveryChanged(): void {
    if (!this.recovery.visible) { this.noticeHeight = 0; this.onNoticeHeightChange(0, this.navigationGeneration); }
  }
  private lastReadFeedback: string = '';
  private onReadRecoveryChanged(): void {
    const view = this.readRecovery;
    if (view?.visible !== true) { this.lastReadFeedback = ''; return; }
    if (!this.mounted || !this.feedbackEnabled || !this.populated || view.message === this.lastReadFeedback) return;
    this.lastReadFeedback = view.message;
    try { this.transientFeedback.show(() => this.getUIContext(), { message: view.message, duration: READER_FEEDBACK_BRIEF_MS }, (): boolean => this.mounted && this.feedbackEnabled && this.populated); } catch (_) {}
  }

  private requestMainTab(key: string, generation: number): void {
    if (!this.mounted || generation !== this.navigationGeneration) return;
    this.onMainTab(key, generation);
  }

  private requestCheckUpdates(generation: number = this.navigationGeneration): void {
    if (!this.mounted || generation !== this.navigationGeneration || !this.canCheckUpdates ||
      this.updateRunning || this.backgroundUpdateRunning) return;
    this.onCheckUpdatesRequested(generation);
  }

  private numericAreaLength(value: Length): number {
    if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
    if (typeof value === 'string') {
      const parsed = Number.parseFloat(value);
      return Number.isFinite(parsed) ? parsed : 0;
    }
    return 0;
  }
}
