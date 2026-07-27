// RouteDispatch.test — asserts P0 routes resolve to the correct shell + reducer stack logic.
import { describe, it, expect } from '@ohos/hypium';
import { RouteTable } from '../main/ets/contract/generated/RouteTable';
import { ReaderReducer } from '../main/ets/ui/store/ReaderReducer';
import { DemoUiState } from '../main/ets/ui/fixtures/DemoUiState';

export default function RouteDispatchTests(): void {
  describe('RouteDispatch', () => {
    it('p0RoutesResolveToCorrectShell', 0, () => {
      expect(RouteTable.shellOf('app-shell')).assertEqual('MainTabShell');
      expect(RouteTable.shellOf('main-tabs')).assertEqual('MainTabShell');
      expect(RouteTable.shellOf('bookshelf')).assertEqual('MainTabShell');
      expect(RouteTable.shellOf('discover')).assertEqual('MainTabShell');
      expect(RouteTable.shellOf('rss')).assertEqual('MainTabShell');
      expect(RouteTable.shellOf('settings')).assertEqual('MainTabShell');
      expect(RouteTable.shellOf('book-detail')).assertEqual('LibraryShell');
      expect(RouteTable.shellOf('reader')).assertEqual('ReaderShell');
    });
    it('mainTabOfForTabRoots', 0, () => {
      expect(RouteTable.mainTabOf('bookshelf')).assertEqual('bookshelf');
      expect(RouteTable.mainTabOf('discover')).assertEqual('discover');
      expect(RouteTable.mainTabOf('rss')).assertEqual('rss');
      expect(RouteTable.mainTabOf('settings')).assertEqual('settings');
    });
    it('reducerPushAddsToStack', 0, () => {
      const s = DemoUiState.initial();
      const pushed = ReaderReducer.push(s, 'book-detail');
      expect(pushed.routeId).assertEqual('book-detail');
      expect(pushed.stack.length).assertEqual(s.stack.length + 1);
      expect(pushed.stack[pushed.stack.length - 1].id).assertEqual('book-detail');
    });
    it('reducerPopRemovesTop', 0, () => {
      const s = DemoUiState.initial();
      const pushed = ReaderReducer.push(s, 'book-detail');
      const popped = ReaderReducer.pop(pushed);
      expect(popped.routeId).assertEqual(s.routeId);
      expect(popped.stack.length).assertEqual(s.stack.length);
    });
    it('reducerSwitchTabResetsStack', 0, () => {
      const s = DemoUiState.initial();
      const after = ReaderReducer.switchTab(s, 'discover');
      expect(after.tab).assertEqual('discover');
      expect(after.routeId).assertEqual('discover');
      expect(after.stack.length).assertEqual(1);
    });
    it('reducerReplaceSwapsTop', 0, () => {
      const s = DemoUiState.initial();
      const pushed = ReaderReducer.push(s, 'book-detail');
      const replaced = ReaderReducer.replace(pushed, 'reader');
      expect(replaced.routeId).assertEqual('reader');
      expect(replaced.stack.length).assertEqual(pushed.stack.length);
    });
    it('reducerPushResetsPageStateToDefault', 0, () => {
      const s = DemoUiState.initial();
      const loading = ReaderReducer.setPageState(s, 'loading');
      const pushed = ReaderReducer.push(loading, 'book-detail');
      expect(pushed.pageState).assertEqual('default');
    });
    it('reducerPopResetsPageStateToDefault', 0, () => {
      const s = DemoUiState.initial();
      const loading = ReaderReducer.setPageState(s, 'loading');
      const pushed = ReaderReducer.push(loading, 'book-detail');
      const setError = ReaderReducer.setPageState(pushed, 'error');
      const popped = ReaderReducer.pop(setError);
      expect(popped.pageState).assertEqual('default');
    });
    it('reducerReplaceResetsPageStateToDefault', 0, () => {
      const s = DemoUiState.initial();
      const loading = ReaderReducer.setPageState(s, 'loading');
      const pushed = ReaderReducer.push(loading, 'book-detail');
      const replaced = ReaderReducer.replace(pushed, 'reader');
      expect(replaced.pageState).assertEqual('default');
    });
    it('reducerSwitchTabResetsPageStateToDefault', 0, () => {
      const s = DemoUiState.initial();
      const loading = ReaderReducer.setPageState(s, 'loading');
      const after = ReaderReducer.switchTab(loading, 'discover');
      expect(after.pageState).assertEqual('default');
    });
    it('reducerSetOverlayPreservesPageState', 0, () => {
      const s = DemoUiState.initial();
      const loading = ReaderReducer.setPageState(s, 'loading');
      const withOverlay = ReaderReducer.setOverlay(loading, 'source-switch');
      expect(withOverlay.pageState).assertEqual('loading');
    });
  });
}
