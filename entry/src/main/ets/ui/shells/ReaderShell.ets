import { ImmersiveReaderSurface } from '../components/ReaderSurface';
import { ReaderUiState } from '../ReaderUiState';

@Component
export struct ReaderShell {
  @Prop uiState: ReaderUiState;
  onBack: () => void = () => {};
  onToggleControls: () => void = () => {};
  onDismissControls: () => void = () => {};
  onToggleReducedMotion: (enabled: boolean) => void = (_enabled: boolean) => {};
  onStartSession: (kind: string) => void = (_kind: string) => {};
  onToggleSession: () => void = () => {};
  onStopSession: () => void = () => {};
  onOpenPresentation: (route: string) => void = (_route: string) => {};
  onToggleMore: () => void = () => {};
  onCloseMore: () => void = () => {};

  build() {
    ImmersiveReaderSurface({
      uiState: this.uiState,
      onBack: this.onBack,
      onToggleControls: this.onToggleControls,
      onDismissControls: this.onDismissControls,
      onToggleReducedMotion: this.onToggleReducedMotion,
      onStartSession: this.onStartSession,
      onToggleSession: this.onToggleSession,
      onStopSession: this.onStopSession,
      onOpenPresentation: this.onOpenPresentation,
      onToggleMore: this.onToggleMore,
      onCloseMore: this.onCloseMore
    })
  }
}
