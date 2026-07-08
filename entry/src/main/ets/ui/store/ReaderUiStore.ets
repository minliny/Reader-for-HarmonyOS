// ReaderUiStore — AppStorage bridge over the reducer.
// Holds the canonical UiState; on dispatch, reduces and writes primitive fields to
// AppStorage so any component can subscribe via @StorageProp / @StorageLink.
import { ReaderUiState, UiEvent, SearchResultEntry, BookDetail } from './ReaderUiState';
import { ReaderReducer } from './ReaderReducer';
import { DemoUiState } from '../fixtures/DemoUiState';
import { ReaderThemeState } from '../tokens/ReaderThemeState';
import { ReaderEffects } from './ReaderEffects';

export class ReaderUiStore {
  private static readonly K_ROUTE = 'reader.routeId';
  private static readonly K_TAB = 'reader.tab';
  private static readonly K_OVERLAY = 'reader.overlay';
  private static readonly K_PAGE_STATE = 'reader.pageState';
  private static readonly K_READER_MODE = 'reader.readerMode';
  static readonly K_PAGINATION_MODE: string = 'reader.paginationMode';
  static readonly K_FONT_SIZE: string = 'reader.typography.fontSize';
  static readonly K_LINE_HEIGHT: string = 'reader.typography.lineHeight';
  static readonly K_PARAGRAPH_GAP: string = 'reader.typography.paragraphGap';
  static readonly K_LETTER_SPACING: string = 'reader.typography.letterSpacing';
  static readonly K_FONT_FAMILY: string = 'reader.typography.fontFamily';
  static readonly K_TOP_MARGIN: string = 'reader.pageSpace.topMargin';
  static readonly K_SIDE_MARGIN: string = 'reader.pageSpace.sideMargin';
  static readonly K_BOTTOM_MARGIN: string = 'reader.pageSpace.bottomMargin';
  static readonly K_PARAGRAPH_INDENT: string = 'reader.pageSpace.paragraphIndent';
  private static readonly K_ACTIVE_SESSION = 'reader.activeSession';
  private static readonly K_LOADING = 'reader.loading';
  private static readonly K_REDUCED_MOTION = 'reader.reducedMotion';
  private static readonly K_ERROR_CODE = 'reader.errorCode';
  private static readonly K_ERROR_MESSAGE = 'reader.errorMessage';
  private static readonly K_RETRYABLE = 'reader.retryable';
  private static readonly K_STACK_DEPTH = 'reader.stackDepth';
  private static readonly K_FIRST_OPEN = 'reader.firstOpenPlayed';
  private static readonly K_LAST_OP = 'reader.lastOp';
  static readonly K_SEARCH_QUERY: string = 'reader.searchQuery';
  static readonly K_SEARCH_RESULTS: string = 'reader.searchResults';
  static readonly K_CURRENT_BOOK: string = 'reader.currentBook';
  static readonly K_CHAPTER_CONTENT: string = 'reader.chapterContent';

  private static state: ReaderUiState;

  static init(): void {
    ReaderUiStore.state = DemoUiState.initial();
    ReaderThemeState.init();
    ReaderUiStore.writeAll();
    AppStorage.setOrCreate<string>(ReaderUiStore.K_LAST_OP, '');
  }

  static dispatch(event: UiEvent): void {
    ReaderUiStore.state = ReaderReducer.reduce(ReaderUiStore.state, event);
    ReaderUiStore.writeAll();
    // Async effect intercept: search-submit / book-detail-load / chapter-load
    // fire Host HTTP. The synchronous reducer pass already applied loading=true;
    // the effect dispatches success/failure back into the reducer when done.
    ReaderEffects.maybeRun(event);
    AppStorage.setOrCreate<string>(ReaderUiStore.K_LAST_OP, event.type);
    ReaderThemeState.setReducedMotion(ReaderUiStore.state.reducedMotion);
  }

  static snapshot(): ReaderUiState {
    return ReaderUiStore.state;
  }

  private static writeAll(): void {
    const s = ReaderUiStore.state;
    AppStorage.setOrCreate<string>(ReaderUiStore.K_ROUTE, s.routeId);
    AppStorage.setOrCreate<string>(ReaderUiStore.K_TAB, s.tab);
    AppStorage.setOrCreate<string>(ReaderUiStore.K_OVERLAY, s.overlay);
    AppStorage.setOrCreate<string>(ReaderUiStore.K_PAGE_STATE, s.pageState);
    AppStorage.setOrCreate<string>(ReaderUiStore.K_READER_MODE, s.readerMode);
    AppStorage.setOrCreate<string>(ReaderUiStore.K_PAGINATION_MODE, s.paginationMode);
    AppStorage.setOrCreate<number>(ReaderUiStore.K_FONT_SIZE, s.fontSize);
    AppStorage.setOrCreate<number>(ReaderUiStore.K_LINE_HEIGHT, s.lineHeight);
    AppStorage.setOrCreate<number>(ReaderUiStore.K_PARAGRAPH_GAP, s.paragraphGap);
    AppStorage.setOrCreate<number>(ReaderUiStore.K_LETTER_SPACING, s.letterSpacing);
    AppStorage.setOrCreate<string>(ReaderUiStore.K_FONT_FAMILY, s.fontFamily);
    AppStorage.setOrCreate<number>(ReaderUiStore.K_TOP_MARGIN, s.topMargin);
    AppStorage.setOrCreate<number>(ReaderUiStore.K_SIDE_MARGIN, s.sideMargin);
    AppStorage.setOrCreate<number>(ReaderUiStore.K_BOTTOM_MARGIN, s.bottomMargin);
    AppStorage.setOrCreate<number>(ReaderUiStore.K_PARAGRAPH_INDENT, s.paragraphIndent);
    AppStorage.setOrCreate<string>(ReaderUiStore.K_ACTIVE_SESSION, s.activeSession);
    AppStorage.setOrCreate<boolean>(ReaderUiStore.K_LOADING, s.loading);
    AppStorage.setOrCreate<boolean>(ReaderUiStore.K_REDUCED_MOTION, s.reducedMotion);
    AppStorage.setOrCreate<string>(ReaderUiStore.K_ERROR_CODE, s.error !== null ? s.error.code : '');
    AppStorage.setOrCreate<string>(ReaderUiStore.K_ERROR_MESSAGE, s.error !== null ? s.error.message : '');
    AppStorage.setOrCreate<boolean>(ReaderUiStore.K_RETRYABLE, s.error !== null ? s.error.retryable : false);
    AppStorage.setOrCreate<number>(ReaderUiStore.K_STACK_DEPTH, s.stack.length);
    AppStorage.setOrCreate<boolean>(ReaderUiStore.K_FIRST_OPEN, s.firstOpenPlayed);
    AppStorage.setOrCreate<string>(ReaderUiStore.K_SEARCH_QUERY, s.searchQuery);
    AppStorage.setOrCreate<SearchResultEntry[]>(ReaderUiStore.K_SEARCH_RESULTS, s.searchResults);
    AppStorage.setOrCreate<BookDetail | null>(ReaderUiStore.K_CURRENT_BOOK, s.currentBook);
    AppStorage.setOrCreate<string[]>(ReaderUiStore.K_CHAPTER_CONTENT, s.chapterContent);
  }
}
