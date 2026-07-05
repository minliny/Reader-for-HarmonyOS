import { ReaderEntryTarget, ReaderMainTab, ReaderReducer, ReaderReducerEvent, ReaderUiState } from './ReaderReducer';

export class ReaderUiStore {
  private state: ReaderUiState = ReaderReducer.initialState();

  snapshot(): ReaderUiState {
    return this.state;
  }

  dispatch(event: ReaderReducerEvent): ReaderUiState {
    this.state = ReaderReducer.reduce(this.state, event);
    return this.state;
  }

  selectTab(tab: string): ReaderUiState {
    return this.dispatch({ type: 'tab.select', tab });
  }

  enterReader(target: ReaderEntryTarget): ReaderUiState {
    return this.dispatch({ type: 'reader.entry', target });
  }

  setReducedMotion(enabled: boolean): ReaderUiState {
    return this.dispatch({ type: 'reducedMotion.set', reducedMotion: enabled });
  }

  markFirstOpenPlayed(): ReaderUiState {
    return this.dispatch({ type: 'app.firstOpen.enter' });
  }

  openOverlay(kind: string, triggerId: string): ReaderUiState {
    return this.dispatch({ type: 'overlay.open', overlayKind: kind, triggerId });
  }

  closeOverlay(): ReaderUiState {
    return this.dispatch({ type: 'overlay.close' });
  }

  startSession(kind: string): ReaderUiState {
    return this.dispatch({ type: 'session.start', sessionKind: kind });
  }

  stopSession(): ReaderUiState {
    return this.dispatch({ type: 'session.stop' });
  }

  beginAsyncIntent(requestId: number, targetRoute: string): ReaderUiState {
    return this.dispatch({ type: 'async.begin', requestId, targetRoute });
  }

  completeAsyncIntent(requestId: number, targetRoute: string): ReaderUiState {
    return this.dispatch({ type: 'async.complete', requestId, targetRoute });
  }

  tabOrder(): string[] {
    return ReaderMainTab.all.slice();
  }
}
