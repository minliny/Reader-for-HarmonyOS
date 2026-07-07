// ReaderUiStore — AppStorage bridge over the reducer.
// Holds the canonical UiState; on dispatch, reduces and writes primitive fields to
// AppStorage so any component can subscribe via @StorageProp / @StorageLink.
import { ReaderUiState, UiEvent } from './ReaderUiState';
import { ReaderReducer } from './ReaderReducer';
import { DemoUiState } from '../fixtures/DemoUiState';
import { ReaderThemeState } from '../tokens/ReaderThemeState';

export class ReaderUiStore {
  private static readonly K_ROUTE = 'reader.routeId';
  private static readonly K_TAB = 'reader.tab';
  private static readonly K_OVERLAY = 'reader.overlay';
  private static readonly K_PAGE_STATE = 'reader.pageState';
  private static readonly K_READER_MODE = 'reader.readerMode';
  private static readonly K_ACTIVE_SESSION = 'reader.activeSession';
  private static readonly K_LOADING = 'reader.loading';
  private static readonly K_REDUCED_MOTION = 'reader.reducedMotion';
  private static readonly K_ERROR_CODE = 'reader.errorCode';
  private static readonly K_ERROR_MESSAGE = 'reader.errorMessage';
  private static readonly K_RETRYABLE = 'reader.retryable';
  private static readonly K_STACK_DEPTH = 'reader.stackDepth';
  private static readonly K_FIRST_OPEN = 'reader.firstOpenPlayed';
  private static readonly K_LAST_OP = 'reader.lastOp';

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
    AppStorage.setOrCreate<string>(ReaderUiStore.K_ACTIVE_SESSION, s.activeSession);
    AppStorage.setOrCreate<boolean>(ReaderUiStore.K_LOADING, s.loading);
    AppStorage.setOrCreate<boolean>(ReaderUiStore.K_REDUCED_MOTION, s.reducedMotion);
    AppStorage.setOrCreate<string>(ReaderUiStore.K_ERROR_CODE, s.error !== null ? s.error.code : '');
    AppStorage.setOrCreate<string>(ReaderUiStore.K_ERROR_MESSAGE, s.error !== null ? s.error.message : '');
    AppStorage.setOrCreate<boolean>(ReaderUiStore.K_RETRYABLE, s.error !== null ? s.error.retryable : false);
    AppStorage.setOrCreate<number>(ReaderUiStore.K_STACK_DEPTH, s.stack.length);
    AppStorage.setOrCreate<boolean>(ReaderUiStore.K_FIRST_OPEN, s.firstOpenPlayed);
  }
}
