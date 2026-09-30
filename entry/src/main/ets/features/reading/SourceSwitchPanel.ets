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
 * Full-screen source picker. Thin shell over the
 * shared `SourceSwitchWindow` (features/source) — the safe frame, 7-state
 * body, and candidate list were extracted to the shared component so the
 * reading and source features share one source of truth (H4, Batch 4).
 * State types are re-exported here so existing `import { SourceSwitchPanelState }
 * from '../reading/SourceSwitchPanel'` callers keep working.
 */
@Component
export struct SourceSwitchPanel {
  @Prop state: SourceSwitchPanelState;
  @Prop currentSourceId: string = '';
  @Prop bookTitle: string = '';
  @Prop author: string = '';
  @Prop coverUrl: string = '';
  @Prop currentSourceName: string = '';
  @Prop currentChapterTitle: string = '';
  @Prop reduceMotion: boolean = false;
  @Prop consumeTopInset: boolean = true;
  onClose: () => void = (): void => {};
  onRetry: () => void = (): void => {};
  onRefresh: () => void = (): void => {};
  onStop: () => void = (): void => {};
  onSelectCandidate: (candidate: SourceSwitchCandidate) => void =
    (_candidate: SourceSwitchCandidate): void => {};
  onRollback: () => void = (): void => {};

  build() {
    SourceSwitchWindow({
      state: this.state,
      currentSourceId: this.currentSourceId,
      bookTitle: this.bookTitle,
      author: this.author,
      coverUrl: this.coverUrl,
      currentSourceName: this.currentSourceName,
      currentChapterTitle: this.currentChapterTitle,
      reduceMotion: this.reduceMotion,
      consumeTopInset: this.consumeTopInset,
      onClose: this.onClose,
      onRetry: this.onRetry,
      onRefresh: this.onRefresh,
      onStop: this.onStop,
      onSelectCandidate: this.onSelectCandidate,
      onRollback: this.onRollback,
    });
  }
}
