// Narrow native projection for the Reader-UI directory Pilot cohort.
// It maps only runtime semantic overlay=directory to the existing HarmonyOS
// reader-directory-overlay-v2 route. It is not a general navigation reducer.
import { ReaderUiState, RouteEntry } from './ReaderUiState';

export const READER_DIRECTORY_OVERLAY_ROUTE: string = 'reader-directory-overlay-v2';

export function isReaderModuleOverlayRoute(routeId: string): boolean {
  return routeId === 'reader-directory-overlay-v2' ||
    routeId === 'reader-tts-overlay-v2' ||
    routeId === 'reader-appearance-overlay-v2' ||
    routeId === 'reader-settings-overlay-v2' ||
    routeId === 'reader-search-overlay-v2' ||
    routeId === 'reader-auto-scroll-overlay-v2' ||
    routeId === 'reader-replace-overlay-v2';
}

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
    if (state.routeId === READER_DIRECTORY_OVERLAY_ROUTE) return false;
    const stack: RouteEntry[] = state.stack.slice();
    if (stack.length > 0 && isReaderModuleOverlayRoute(state.routeId)) {
      stack[stack.length - 1] = { id: 'reader-directory-overlay-v2' };
    } else {
      stack.push({ id: 'reader-directory-overlay-v2' });
    }
    state.routeId = 'reader-directory-overlay-v2';
    state.stack = stack;
    state.overlay = '';
    return true;
  }

  private static close(state: ReaderUiState): boolean {
    if (state.routeId !== READER_DIRECTORY_OVERLAY_ROUTE || state.stack.length <= 1) return false;
    const stack: RouteEntry[] = state.stack.slice(0, -1);
    state.stack = stack;
    state.routeId = stack[stack.length - 1].id;
    state.overlay = '';
    return true;
  }
}
