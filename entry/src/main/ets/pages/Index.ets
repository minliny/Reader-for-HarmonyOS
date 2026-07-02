import { ReaderAdaptive } from '../ui/ReaderAdaptive';
import { ReaderMainTab, ReaderRoute } from '../ui/ReaderRouteMapping';
import { MainTabShell } from '../ui/shells/MainTabShell';
import { ReaderShell } from '../ui/shells/ReaderShell';
import { ReaderEntryTarget, ReaderUiReducer, ReaderUiState } from '../ui/ReaderUiState';

@Entry
@Component
struct Index {
  @State currentTab: number = 0;
  @State uiState: ReaderUiState = ReaderUiReducer.initialState();

  private applyUiState(next: ReaderUiState): void {
    this.uiState = next;
    this.currentTab = ReaderMainTab.indexOf(next.activeTab);
  }

  private selectMainTab(tab: string): void {
    this.applyUiState(ReaderUiReducer.selectTab(this.uiState, tab));
  }

  private enterReader(target: ReaderEntryTarget): void {
    this.applyUiState(ReaderUiReducer.pushReaderEntry(this.uiState, target));
  }

  private popRoute(): void {
    this.applyUiState(ReaderUiReducer.popRoute(this.uiState));
  }

  private setReducedMotion(enabled: boolean): void {
    this.applyUiState(ReaderUiReducer.setReducedMotion(this.uiState, enabled));
  }

  private setAdaptive(area: Area): void {
    this.applyUiState(ReaderUiReducer.setAdaptive(
      this.uiState,
      ReaderAdaptive.fromArea(area, this.uiState.adaptive)
    ));
  }

  private toggleReaderControls(): void {
    this.applyUiState(ReaderUiReducer.toggleReaderControls(this.uiState));
  }

  private hideReaderControls(): void {
    this.applyUiState(ReaderUiReducer.hideReaderControls(this.uiState));
  }

  private startReaderSession(kind: string): void {
    this.applyUiState(ReaderUiReducer.startReaderSession(this.uiState, kind));
  }

  private toggleReaderSession(): void {
    this.applyUiState(ReaderUiReducer.toggleReaderSessionPlaying(this.uiState));
  }

  private stopReaderSession(): void {
    this.applyUiState(ReaderUiReducer.stopReaderSession(this.uiState));
  }

  private openReaderPresentation(route: string): void {
    this.applyUiState(ReaderUiReducer.replaceReaderPresentation(this.uiState, route));
  }

  private toggleReaderMore(): void {
    this.applyUiState(ReaderUiReducer.toggleReaderMore(this.uiState));
  }

  private closeReaderMore(): void {
    this.applyUiState(ReaderUiReducer.closeReaderMore(this.uiState));
  }

  private toggleBookshelfMore(): void {
    this.applyUiState(ReaderUiReducer.toggleBookshelfMore(this.uiState));
  }

  private closeBookshelfMore(): void {
    this.applyUiState(ReaderUiReducer.closeBookshelfMore(this.uiState));
  }

  private setBookshelfView(view: string): void {
    this.applyUiState(ReaderUiReducer.setBookshelfView(this.uiState, view));
  }

  private toggleBookshelfFilter(): void {
    this.applyUiState(ReaderUiReducer.toggleBookshelfFilter(this.uiState));
  }

  private closeBookshelfFilter(): void {
    this.applyUiState(ReaderUiReducer.closeBookshelfFilter(this.uiState));
  }

  private setBookshelfFilterOption(kind: string, value: string): void {
    this.applyUiState(ReaderUiReducer.setBookshelfFilterOption(this.uiState, kind, value));
  }

  private toggleReaderBrightnessAuto(): void {
    this.applyUiState(ReaderUiReducer.toggleReaderBrightnessAuto(this.uiState));
  }

  private adjustReaderBrightness(delta: number): void {
    this.applyUiState(ReaderUiReducer.adjustReaderBrightness(this.uiState, delta));
  }

  onBackPress(): boolean {
    if (this.uiState.overlayState.isOpen && this.uiState.overlayState.kind === 'reader-more') {
      this.closeReaderMore();
      return true;
    }
    if (this.uiState.overlayState.isOpen && this.uiState.overlayState.kind === 'bookshelf-more') {
      this.closeBookshelfMore();
      return true;
    }
    if (this.uiState.overlayState.isOpen && this.uiState.overlayState.kind === 'bookshelf-filter') {
      this.closeBookshelfFilter();
      return true;
    }
    if (this.uiState.readerPresentationRoute !== ReaderRoute.immersiveReading) {
      this.hideReaderControls();
      return true;
    }
    if (this.uiState.overlayState.isOpen) {
      this.hideReaderControls();
      return true;
    }
    if (this.uiState.routeStack.length > 1) {
      this.popRoute();
      return true;
    }
    return false;
  }

  build() {
    Column() {
      if (this.uiState.route === ReaderRoute.immersiveReading) {
        ReaderShell({
          uiState: this.uiState,
          onBack: () => this.popRoute(),
          onToggleControls: () => this.toggleReaderControls(),
          onDismissControls: () => this.hideReaderControls(),
          onToggleReducedMotion: (enabled: boolean) => this.setReducedMotion(enabled),
          onStartSession: (kind: string) => this.startReaderSession(kind),
          onToggleSession: () => this.toggleReaderSession(),
          onStopSession: () => this.stopReaderSession(),
          onOpenPresentation: (route: string) => this.openReaderPresentation(route),
          onToggleMore: () => this.toggleReaderMore(),
          onCloseMore: () => this.closeReaderMore(),
          onToggleBrightnessAuto: () => this.toggleReaderBrightnessAuto(),
          onAdjustBrightness: (delta: number) => this.adjustReaderBrightness(delta)
        })
      } else {
        MainTabShell({
          uiState: this.uiState,
          currentTab: this.currentTab,
          onSelectTab: (tab: string) => this.selectMainTab(tab),
          onReaderEntry: (target: ReaderEntryTarget) => this.enterReader(target),
          onToggleReducedMotion: (enabled: boolean) => this.setReducedMotion(enabled),
          onToggleBookshelfMore: () => this.toggleBookshelfMore(),
          onCloseBookshelfMore: () => this.closeBookshelfMore(),
          onSetBookshelfView: (view: string) => this.setBookshelfView(view),
          onToggleBookshelfFilter: () => this.toggleBookshelfFilter(),
          onSelectBookshelfFilterOption: (kind: string, value: string) => this.setBookshelfFilterOption(kind, value)
        })
      }
    }
    .width('100%')
    .height('100%')
    .onAreaChange((_oldValue: Area, newValue: Area) => {
      this.setAdaptive(newValue);
    })
  }
}
