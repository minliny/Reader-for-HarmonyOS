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

  onBackPress(): boolean {
    if (this.uiState.overlayState.isOpen && this.uiState.overlayState.kind === 'reader-more') {
      this.closeReaderMore();
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
          onStopSession: () => this.stopReaderSession(),
          onOpenPresentation: (route: string) => this.openReaderPresentation(route),
          onToggleMore: () => this.toggleReaderMore(),
          onCloseMore: () => this.closeReaderMore()
        })
      } else {
        MainTabShell({
          uiState: this.uiState,
          currentTab: this.currentTab,
          onSelectTab: (tab: string) => this.selectMainTab(tab),
          onReaderEntry: (target: ReaderEntryTarget) => this.enterReader(target),
          onToggleReducedMotion: (enabled: boolean) => this.setReducedMotion(enabled)
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
