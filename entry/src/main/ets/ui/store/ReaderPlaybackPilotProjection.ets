import type { ReaderUIState } from 'reader_ui_runtime';
import { RouteId } from '../../contract/generated/RouteTable';
import {
  ActiveSession,
  CoreReaderCanonicalLocation,
  MainTab,
  Overlay,
  ReaderError,
  ReaderUiState,
  RouteEntry,
} from './ReaderUiState';
import { ReaderPlaybackQueueSnapshot } from './ReaderPlaybackDomainMapper';

/** Mechanical runtime/Core projection only; no action semantics live here. */
export class ReaderPlaybackPilotProjection {
  static applyRuntimeInPlace(state: ReaderUiState, runtime: ReaderUIState): void {
    const terminalNavigation = runtime.routeId !== 'immersive-reading' &&
      runtime.pageTransaction === undefined && runtime.ttsTransaction === undefined &&
      runtime.autoPageTransaction === undefined;
    if (terminalNavigation) {
      const stack: RouteEntry[] = [];
      for (let index = 0; index < runtime.routeStack.length; index += 1) {
        stack.push({ id: runtime.routeStack[index] as RouteId });
      }
      stack.push({ id: runtime.routeId as RouteId });
      state.stack = stack;
      state.routeId = runtime.routeId as RouteId;
      state.tab = runtime.tab as MainTab;
      state.overlay = (runtime.overlay ?? '') as Overlay;
    }
    state.readerPageIndex = runtime.readerPageIndex;
    state.activeSession = (runtime.activeSession ?? '') as ActiveSession;
    state.ttsSession.playback = runtime.activeSession === 'tts' ? 'playing' : 'idle';
    state.autoPageSession.playing = runtime.activeSession === 'auto-page';
    const auto = runtime.autoPageTransaction;
    if (auto !== undefined) {
      const intervalSeconds = Math.max(1, Math.round(auto.intervalMs / 1000));
      state.autoPageSession.intervalSeconds = intervalSeconds;
      state.autoPageSession.countdownSeconds = intervalSeconds;
    } else {
      state.autoPageSession.countdownSeconds = 0;
    }
    state.readerToggles.autoPage = state.autoPageSession.playing;
    if (runtime.error !== undefined && runtime.error.length > 0) {
      const error: ReaderError = {
        code: 'READER_PLAYBACK_PILOT_FAILED',
        message: runtime.error,
        retryable: true,
      };
      state.error = error;
      state.pageState = 'error';
    } else {
      state.error = null;
      state.pageState = 'default';
    }
  }

  static commitLocationInPlace(state: ReaderUiState,
    location: CoreReaderCanonicalLocation, pageIndex: number): void {
    state.canonicalReaderLocation = location;
    state.readerPageIndex = pageIndex;
  }

  static applyQueueInPlace(state: ReaderUiState, snapshot: ReaderPlaybackQueueSnapshot): void {
    state.ttsSession.currentSegment = snapshot.currentSliceIndex;
    state.ttsSession.totalSegments = snapshot.totalSlices;
    state.ttsSession.playback = snapshot.state === 'playing' ? 'playing' :
      (snapshot.state === 'paused' ? 'paused' : 'idle');
  }
}
