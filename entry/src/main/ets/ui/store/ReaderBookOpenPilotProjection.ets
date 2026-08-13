// Narrow native projection for the opt-in Reader-UI book.open Pilot.
// Transaction semantics (route, stack, loading, error) come from the shared
// runtime. Core DTOs are projected separately through ReaderReducer events.
import type { ReaderUIState } from 'reader_ui_runtime';
import { RouteId } from '../../contract/generated/RouteTable';
import {
  MainTab,
  Overlay,
  PageState,
  ReaderError,
  ReaderUiState,
  RouteEntry,
} from './ReaderUiState';

export class ReaderBookOpenPilotProjection {
  static applyRuntimeInPlace(state: ReaderUiState, runtime: ReaderUIState): void {
    const stack: RouteEntry[] = [];
    for (let index = 0; index < runtime.routeStack.length; index += 1) {
      stack.push({ id: runtime.routeStack[index] as RouteId });
    }
    stack.push({ id: runtime.routeId as RouteId });
    state.stack = stack;
    state.routeId = runtime.routeId as RouteId;
    state.tab = runtime.tab as MainTab;
    state.overlay = (runtime.overlay ?? '') as Overlay;
    state.loading = runtime.loading;
    if (runtime.error !== undefined && runtime.error.length > 0) {
      const error: ReaderError = {
        code: 'BOOK_OPEN_PILOT_FAILED',
        message: runtime.error,
        retryable: true,
      };
      state.error = error;
      state.pageState = 'error';
      return;
    }
    state.error = null;
    state.pageState = (runtime.loading ? 'loading' : 'default') as PageState;
  }
}
