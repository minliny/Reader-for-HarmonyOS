import type { ReaderRecoveryView } from '../../app/ReaderRecoveryProjection';
import { ReaderRecoveryNotice } from '../common/ReaderRecoveryNotice';
import { MainTabShell } from '../shell/MainTabShell';
import { AppTopBar } from '../common/AppTopBar';
import { ReaderIconButton } from '../common/ReaderIconButton';
import { registerReaderShelfFonts } from '../common/ReaderFonts';
import { ReaderWindowCoordinator } from '../../app/ReaderWindowCoordinator';
import { BookshelfMoreMenu } from './BookshelfMoreMenu';
import { READER_FLOATING_TOP_BAR_HEIGHT } from '../common/ReaderFloatingBarMetrics';

export const BOOKSHELF_WIDE_BREAKPOINT = 600;
let bookshelfTemporaryGeneration: number = 0;

// Index mounts this shell once for the bookshelf route. Core readiness only
// changes the content slot, preserving the title, navigation and menu anchor.
@Component
export struct BookshelfShell {
  @StorageLink('readerAppScheme') private appThemeScheme: string = 'day';
  @StorageLink('readerWindowMetricsRevision') private readerWindowMetricsRevision: number = 0;
  @Prop recovery: ReaderRecoveryView = { message: '', visible: false, canRetry: false, generation: 0 };
  onReconcile: (generation: number) => void = (_generation: number): void => {};
  @Prop @Watch('onNavigationGenerationChanged') navigationGeneration: number = 0;
  @Prop populated: boolean = false;
  @Prop reduceMotion: boolean = false;
  @Prop canCheckUpdates: boolean = false;
  @Prop updateRunning: boolean = false;
  @Prop backgroundUpdateRunning: boolean = false;
  @Prop updateProgressDone: number = 0;
  @Prop updateProgressTotal: number = 0;
  onSearchRequested: () => void = (): void => {};
  onImportRequested: () => void = (): void => {};
  onBatchManageRequested: () => void = (): void => {};
  onBookshelfSettingsRequested: () => void = (): void => {};
  onCheckUpdatesRequested: () => void = (): void => {};
  onMainTab: (key: string) => void = (_key: string): void => {};
  @BuilderParam content: () => void;
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
      activeTab: 'bookshelf',
      showBottomNav: this.showBottomNav(),
      onMainTab: (key: string): void => this.onMainTab(key),
    }) {
      this.shellContent();
    }
  }

  @Builder
  private shellContent() {
    Stack({ alignContent: Alignment.TopStart }) {
      Stack({ alignContent: Alignment.TopStart }) {
        if (this.recovery.visible) {
          Column() {
            ReaderRecoveryNotice({ view: this.recovery,
              onReconcile: (generation: number): void => this.onReconcile(generation) });
            Stack() { this.content(); }.width('100%').layoutWeight(1);
          }.width('100%').height('100%').padding({ top: READER_FLOATING_TOP_BAR_HEIGHT });
        } else {
          this.content();
        }
      }
      .width('100%')
      .height('100%');

      Row() {
        this.topBar();
      }
      .width('100%')
      .height(READER_FLOATING_TOP_BAR_HEIGHT)
      .hitTestBehavior(HitTestMode.Transparent);

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
    .width('100%')
    .height('100%')
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
  private topBar() {
    AppTopBar({ title: '书架' }) {
      Row({ space: 18 }) {
        ReaderIconButton({
          icon: (this.appThemeScheme === 'night' ? $r('app.media.bookshelf_search_theme_night') : $r('app.media.bookshelf_search')),
          boxSize: 44,
          iconSize: 24,
          radius: 22,
          onTap: (): void => this.onSearchRequested(),
        });

        // V1 ordinary callbacks are constructor inputs. Only this temporary
        // trigger gets a fresh identity; bookshelf content/scroll stay mounted.
        ForEach([this.navigationGeneration], (_generation: number) => {
          ReaderIconButton({
            icon: (this.appThemeScheme === 'night' ? $r('app.media.bookshelf_more_theme_night') : $r('app.media.bookshelf_more')),
            boxSize: 44,
            iconSize: 44,
            radius: 22,
            onTap: this.moreOpenAction(this.temporaryBackIdentity),
          })
            .accessibilityText('更多')
            .onAreaChange((_oldValue: Area, newValue: Area): void => {
              this.moreAnchorRight = Number(newValue.globalPosition.x) + Number(newValue.width);
              this.moreAnchorBottom = Number(newValue.globalPosition.y) + Number(newValue.height);
            });
        }, (generation: number): string => generation.toString());
      }
    }
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
