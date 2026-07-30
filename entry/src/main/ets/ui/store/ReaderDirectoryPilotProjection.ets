// Narrow native projection for the Reader-UI directory Pilot cohort.
// Reader-UI keeps the canonical reading route stable and stores the selected
// module in UiState.overlay. The retired reader-directory-overlay-v2 route is
// deliberately absent from this projection.
import { ReaderUiState } from './ReaderUiState';

export const READER_DIRECTORY_OVERLAY: string = 'directory';

export class ReaderDirectoryPilotProjection {
  static applyInPlace(state: ReaderUiState, previousOverlay?: string, semanticOverlay?: string): boolean {
    if ((previousOverlay ?? '') === (semanticOverlay ?? '')) return false;
    if (semanticOverlay === 'directory') {
      return ReaderDirectoryPilotProjection.open(state);
    }
    if (previousOverlay === 'directory') {
      return ReaderDirectoryPilotProjection.close(state);
    }
    return false;
  }

  private static open(state: ReaderUiState): boolean {
    if (state.overlay === READER_DIRECTORY_OVERLAY) return false;
    state.overlay = 'directory';
    return true;
  }

  private static close(state: ReaderUiState): boolean {
    if (state.overlay !== READER_DIRECTORY_OVERLAY) return false;
    state.overlay = '';
    return true;
  }
}
