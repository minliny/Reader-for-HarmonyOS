// Index — the single @Entry page. Hosts RouteRenderer, which dispatches RouteId → Shell.
// Owns system back-press: the app uses a custom reducer-based route stack (not ArkUI
// Router/Navigation), so without this handler the system back gesture/key would exit the
// app instead of popping the route. Priority: dismiss overlay → pop route → system exit.
import { RouteRenderer } from '../ui/router/RouteRenderer';
import { ReaderUiStore } from '../ui/store/ReaderUiStore';

@Entry
@Component
struct Index {
  onBackPress(): boolean {
    const s = ReaderUiStore.snapshot();
    if (s.overlay !== '') {
      ReaderUiStore.dispatch({ type: 'set-overlay', overlay: '' });
      return true;
    }
    if (s.stack.length > 1) {
      ReaderUiStore.dispatch({ type: 'route-pop' });
      return true;
    }
    return false;
  }

  build() {
    Column() {
      RouteRenderer()
    }
    .width('100%')
    .height('100%')
  }
}
