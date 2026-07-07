// DemoUiState — Phase 1 demo initial state (from ui-state.fixtures.json).
// Opens directly to the bookshelf (cover-mode). firstOpen ceremony is Phase 2 polish.
import { ReaderUiState } from '../store/ReaderUiState';

export class DemoUiState {
  static initial(): ReaderUiState {
    return {
      routeId: 'bookshelf',
      tab: 'bookshelf',
      readerMode: 'default',
      overlay: '',
      activeSession: '',
      focusTarget: '',
      loading: false,
      error: null,
      reducedMotion: false,
      pageState: 'cover-mode',
      firstOpenPlayed: true,
      stack: [{ id: 'bookshelf' }],
    };
  }
}
