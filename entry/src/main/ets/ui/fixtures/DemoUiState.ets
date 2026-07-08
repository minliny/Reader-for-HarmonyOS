// DemoUiState — Phase 1 demo initial state (from ui-state.fixtures.json).
// Opens directly to the bookshelf (cover-mode). firstOpen ceremony is Phase 2 polish.
import { ReaderUiState } from '../store/ReaderUiState';

export class DemoUiState {
  static initial(): ReaderUiState {
    return {
      routeId: 'bookshelf',
      tab: 'bookshelf',
      readerMode: 'default',
      paginationMode: 'horizontal',
      fontSize: 18,
      lineHeight: 1.96,
      paragraphGap: 16,
      letterSpacing: 0,
      fontFamily: 'serif',
      topMargin: 72,
      sideMargin: 32,
      bottomMargin: 48,
      paragraphIndent: 2,
      overlay: '',
      activeSession: '',
      focusTarget: '',
      loading: false,
      error: null,
      reducedMotion: false,
      pageState: 'cover-mode',
      firstOpenPlayed: true,
      stack: [{ id: 'bookshelf' }],
      searchQuery: '',
      searchResults: [],
      currentBook: null,
      chapterContent: [],
    };
  }
}
