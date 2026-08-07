import type { SourceSwitchCandidate } from '../source/SourceSwitchGateway';
import {
  SourceSwitchWindow,
  SourceSwitchPanelState,
  SourceSwitchDiscoveringState,
  SourceSwitchCandidatesState,
  SourceSwitchEmptyState,
  SourceSwitchDiscoveryErrorState,
  SourceSwitchSwitchingState,
  SourceSwitchSuccessState,
  SourceSwitchFailureState,
} from '../source/SourceSwitchWindow';

export {
  SourceSwitchPanelState,
  SourceSwitchDiscoveringState,
  SourceSwitchCandidatesState,
  SourceSwitchEmptyState,
  SourceSwitchDiscoveryErrorState,
  SourceSwitchSwitchingState,
  SourceSwitchSuccessState,
  SourceSwitchFailureState,
};

/**
 * Presentational overlay for the source-switch window. Thin shell over the
 * shared `SourceSwitchWindow` (features/source) — the window frame, 7-state
 * body, and candidate list were extracted to the shared component so the
 * reading and source features share one source of truth (H4, Batch 4).
 * State types are re-exported here so existing `import { SourceSwitchPanelState }
 * from '../reading/SourceSwitchPanel'` callers keep working.
 */
@Component
export struct SourceSwitchPanel {
  @Prop state: SourceSwitchPanelState;
  @Prop currentSourceId: string = '';
  @Prop isTablet: boolean = false;
  onClose: () => void = (): void => {};
  onRetry: () => void = (): void => {};
  onSelectCandidate: (candidate: SourceSwitchCandidate) => void =
    (_candidate: SourceSwitchCandidate): void => {};
  onRollback: () => void = (): void => {};

  build() {
    SourceSwitchWindow({
      state: this.state,
      currentSourceId: this.currentSourceId,
      isTablet: this.isTablet,
      onClose: this.onClose,
      onRetry: this.onRetry,
      onSelectCandidate: this.onSelectCandidate,
      onRollback: this.onRollback,
    });
  }
}