import type { ReaderRecoveryView } from '../../app/ReaderRecoveryProjection';
import { ReaderRecoveryNotice } from '../common/ReaderRecoveryNotice';
import { ReaderRecoveryAction } from '../common/ReaderRecoveryAction';
import { MainTabShell } from '../shell/MainTabShell';
import { ReaderFixedHeaderHost } from '../common/ReaderFixedHeaderHost';
import { AppTopBar } from '../common/AppTopBar';
import { ReaderIconButton } from '../common/ReaderIconButton';
import { registerReaderShelfFonts } from '../common/ReaderFonts';
import { ReaderWindowCoordinator } from '../../app/ReaderWindowCoordinator';
import { BookshelfMoreMenu } from './BookshelfMoreMenu';
import { readerInteractiveSafeLeft, readerInteractiveSafeRight } from '../common/ReaderWindowMetrics';
import { readerPageInitialHeaderHeight } from '../common/ReaderPageShell';

export const BOOKSHELF_WIDE_BREAKPOINT = 600;
let bookshelfTemporaryGeneration: number = 0;

// Index mounts this shell once for the bookshelf route. Core readiness only
// changes the content slot, preserving the title, navigation and menu anchor.
@Component
export struct BookshelfShell {
  @StorageLink('readerAppScheme') private appThemeScheme: string = 'day';
  @StorageLink('readerWindowMetricsRevision') private readerWindowMetricsRevision: number = 0;
  @Prop recovery: ReaderRecoveryView = { message: '', visible: false, canRetry: false, generation: 0 };
  @Prop readRecovery: ReaderRecoveryView | undefined = undefined;
  onRetryRead: (generation: number, navigation?: number) => void = (_generation: number): void => {};
  onReconcile: (generation: number, navigation?: number) => void = (_generation: number): void => {};
  @Prop canContinueRemoval: boolean = false;
  @Prop removalActionLabel: string = '继续原删除操作';
  onContinueRemoval: (generation: number, navigation: number) => void = (_generation: number, _navigation: number): void => {};
  @Prop @Watch('onNavigationGenerationChanged') navigationGeneration: number = 0;
  @Prop populated: boolean = false;
  @Prop reduceMotion: boolean = false;
  @Prop canCheckUpdates: boolean = false;
  @Prop updateRunning: boolean = false;
  @Prop backgroundUpdateRunning: boolean = false;
  @Prop updateProgressDone: number = 0;
  @Prop updateProgressTotal: number = 0;
  onSearchRequested: (generation?: number) => void = (_generation?: number): void => {};
  onImportRequested: () => void = (): void => {};
  onBatchManageRequested: () => void = (): void => {};
  onBookshelfSettingsRequested: () => void = (): void => {};
  onCheckUpdatesRequested: () => void = (): void => {};
  onMainTab: (key: string, presentedNavigation?: number) => void = (_key: string): void => {};
  @BuilderParam content: () => void;
  onHeaderHeightChange: (height: number) => void = (_height: number): void => {};
  @State private headerHeight: number = readerPageInitialHeaderHeight('bookshelf');
  @State private viewportWidth: number = 0;
  @State private moreMenuVisible: boolean = false;
  private moreSelectionId: string = '';
  private mounted: boolean = false;
  private temporaryBackIdentity: string = '';
  private temporaryBackGeneration: number = 0;
  onTemporaryBackBridge: (handler: (() => boolean) | undefined, identity: string, generation?: number) => void =
    (_handler: (() => boolean) | undefined, _identity: string, _generation?: number): void => {};
  @State private moreAnchorRight: number = 0;
  @State private moreAnchorBottom: number = 0;
  @State private overlayOriginX: number = 0;
  @State private overlayOriginY: number = 0;

  aboutToAppear(): void {
    this.mounted = true;
    registerReaderShelfFonts(this.getUIContext().getFont());
    this.registerTemporaryBackGeneration();
  }

  aboutToDisappear(): void {
    const identity = this.temporaryBackIdentity;
    const generation = this.temporaryBackGeneration;
    this.mounted = false;
    this.temporaryBackIdentity = '';
    this.dismissMoreMenu();
    this.onTemporaryBackBridge(undefined, identity, generation);
  }

  private onNavigationGenerationChanged(): void {
    if (!this.mounted) return;
    this.dismissMoreMenu();
    this.registerTemporaryBackGeneration();
  }

  private registerTemporaryBackGeneration(): void {
    if (!this.mounted) return;
    const previousIdentity = this.temporaryBackIdentity;
    const previousGeneration = this.temporaryBackGeneration;
    const identity = `bookshelf-back:${++bookshelfTemporaryGeneration}`;
    const generation = this.navigationGeneration;
    this.temporaryBackIdentity = identity;
    this.temporaryBackGeneration = generation;
    if (previousIdentity.length > 0) this.onTemporaryBackBridge(undefined, previousIdentity, previousGeneration);
    this.onTemporaryBackBridge((): boolean => this.consumeTemporaryBack(identity), identity, generation);
  }

  private consumeTemporaryBack(identity: string): boolean {
    if (!this.mounted || identity !== this.temporaryBackIdentity || !this.moreMenuVisible) return false;
    this.dismissMoreMenu();
    return true;
  }

  private dismissMoreMenu(): void {
    this.moreMenuVisible = false;
    this.moreSelectionId = '';
  }

  private moreOpenAction(identity: string): () => void {
    return (): void => {
      if (!this.mounted || identity !== this.temporaryBackIdentity || this.moreMenuVisible) return;
      this.moreSelectionId = `bookshelf-more:${++bookshelfTemporaryGeneration}`;
      this.moreMenuVisible = true;
    };
  }

  private moreIntentAction(identity: string, action: () => void): () => void {
    return (): void => {
      if (!this.mounted || !this.moreMenuVisible || identity.length === 0 || identity !== this.moreSelectionId) return;
      action();
    };
  }

  build() {
    MainTabShell({
      activeTab: 'bookshelf', headerKind: 'floating', navigationGeneration: this.navigationGeneration,
      showBottomNav: this.showBottomNav(), showTabletRail: !this.showBottomNav(), railVariant: 'bookshelf',
      headerTop: 8,
      headerInsetLeft: Math.max(16, readerInteractiveSafeLeft(ReaderWindowCoordinator.metrics())),
      headerInsetRight: Math.max(16, readerInteractiveSafeRight(ReaderWindowCoordinator.metrics())),
      onMainTab: (key: string, generation?: number): void => this.requestMainTab(key, generation ?? this.navigationGeneration),
      content: (): void => { this.content(); },
      header: (): void => { this.shellHeader(); },
      overlay: (): void => { this.shellOverlay(); },
      onHeaderHeightChange: (height: number): void => {
        const totalHeight = height;
        if (Number.isFinite(totalHeight) && totalHeight > 0) {
          if (Math.abs(totalHeight - this.headerHeight) > .1) this.headerHeight = totalHeight;
          this.onHeaderHeightChange(totalHeight);
        }
      },
    })
      .onAreaChange((_oldValue: Area, newValue: Area): void => {
        const width = this.numericAreaLength(newValue.width);
        if (width > 0 && Math.abs(width - this.viewportWidth) >= 0.01) {
          this.viewportWidth = width;
        }
        this.overlayOriginX = Number(newValue.globalPosition.x);
        this.overlayOriginY = Number(newValue.globalPosition.y);
      });
  }

  @Builder
  private shellHeader() {
    Column() {
      this.topBar();
      if (this.recovery.visible) {
        ReaderFixedHeaderHost({ kind: 'standard',
          content: (): void => { this.recoveryNoticeContent(this.recovery, false); } });
      } else if (this.readRecovery?.visible === true) {
        ReaderFixedHeaderHost({ kind: 'standard',
          content: (): void => { this.recoveryNoticeContent(this.readRecovery!, true); } });
      }
    }.width('100%');
  }

  @Builder
  private shellOverlay() {
    if (this.moreMenuVisible) {
      BookshelfMoreMenu({
        anchorRight: this.moreAnchorRight - this.overlayOriginX,
        anchorBottom: this.moreAnchorBottom - this.overlayOriginY,
        reduceMotion: this.reduceMotion,
        canCheckUpdates: this.canCheckUpdates,
        updateRunning: this.updateRunning,
        backgroundUpdateRunning: this.backgroundUpdateRunning,
        updateProgressDone: this.updateProgressDone,
        updateProgressTotal: this.updateProgressTotal,
        onCheckUpdates: this.moreIntentAction(this.moreSelectionId, (): void => this.requestCheckUpdates()),
        onBatchManage: this.moreIntentAction(this.moreSelectionId, (): void => {
          this.dismissMoreMenu();
          this.onBatchManageRequested();
        }),
        onLocalImport: this.moreIntentAction(this.moreSelectionId, (): void => {
          this.dismissMoreMenu();
          this.onImportRequested();
        }),
        onBookshelfSettings: this.moreIntentAction(this.moreSelectionId, (): void => {
          this.dismissMoreMenu();
          this.onBookshelfSettingsRequested();
        }),
        onDismiss: this.moreIntentAction(this.moreSelectionId, (): void => this.dismissMoreMenu()),
      });
    }
  }

  @Builder
  private recoveryNoticeContent(view: ReaderRecoveryView, read: boolean) {
    // Only the compact feedback actor changes identity; content stays mounted.
    ForEach([JSON.stringify([this.navigationGeneration, view.generation])], (identity: string): void => {
      ReaderRecoveryNotice({ view, actionLabel: '刷新列表',
        onReconcile: (generation: number): void => {
          const tokens = JSON.parse(identity) as number[];
          if (generation !== tokens[1] || this.navigationGeneration !== tokens[0]) return;
          if (read) this.onRetryRead(tokens[1], tokens[0]);
          else this.onReconcile(tokens[1], tokens[0]);
        } });
      if (!read && this.canContinueRemoval) {
        ReaderRecoveryAction({ label: this.removalActionLabel, generation: (JSON.parse(identity) as number[])[1],
          onReconcile: (generation: number): void => {
            const tokens = JSON.parse(identity) as number[];
            if (!this.mounted || generation !== tokens[1] || this.navigationGeneration !== tokens[0]) return;
            this.onContinueRemoval(tokens[1], tokens[0]);
          } });
      }
    }, (identity: string): string => identity);
  }

  @Builder
  private topBar() {
    ForEach([this.navigationGeneration], (presentedGeneration: number) => {
      AppTopBar({ title: '书架', floating: true, centered: true, showLeadingSearch: true,
        onLeadingTap: (): void => {
          if (this.mounted && this.navigationGeneration === presentedGeneration) this.onSearchRequested(presentedGeneration);
        } }) {
        ReaderIconButton({
          icon: this.appThemeScheme === 'night' ? $r('app.media.rc_dots_theme_night') : $r('app.media.rc_dots'),
          specId: 'floating-more',
          accessibilityLabel: '更多',
          onTap: this.moreOpenAction(this.temporaryBackIdentity),
        })
          .onAreaChange((_oldValue: Area, newValue: Area): void => {
            this.moreAnchorRight = Number(newValue.globalPosition.x) + Number(newValue.width);
            this.moreAnchorBottom = Number(newValue.globalPosition.y) + Number(newValue.height);
          });
      }
    }, (generation: number): string => generation.toString());
  }

  private requestMainTab(key: string, generation: number): void {
    if (!this.mounted || generation !== this.navigationGeneration) return;
    this.onMainTab(key, generation);
  }

  private requestCheckUpdates(): void {
    if (!this.canCheckUpdates || this.updateRunning || this.backgroundUpdateRunning) return;
    this.dismissMoreMenu();
    this.onCheckUpdatesRequested();
  }

  private numericAreaLength(value: Length): number {
    if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
    if (typeof value === 'string') {
      const parsed = Number.parseFloat(value);
      return Number.isFinite(parsed) ? parsed : 0;
    }
    return 0;
  }

  private showBottomNav(): boolean {
    if (!this.populated) return true;
    if (this.readerWindowMetricsRevision < 0) return true;
    const width = this.viewportWidth > 0 ? this.viewportWidth : ReaderWindowCoordinator.metrics().windowRect.width;
    // Only the populated shelf has an approved tablet rail. Other states
    // retain the existing phone navigation assembly at larger widths.
    return width < BOOKSHELF_WIDE_BREAKPOINT;
  }
}
