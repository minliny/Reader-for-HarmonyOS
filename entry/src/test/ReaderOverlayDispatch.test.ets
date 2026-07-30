// ReaderOverlayDispatch.test — semantic Reader overlay regression guard.
// Reader control modules must preserve the canonical reading route and stack.
import { describe, it, expect } from '@ohos/hypium';
import { ReaderReducer } from '../main/ets/ui/store/ReaderReducer';
import { DemoUiState } from '../main/ets/ui/fixtures/DemoUiState';

export default function ReaderOverlayDispatchTests(): void {
  describe('ReaderOverlayDispatch', () => {
    it('readerControlOverlayPreservesCanonicalRouteIdentity', 0, () => {
      const reader = ReaderReducer.push(DemoUiState.initial(), 'immersive-reading');
      const control = ReaderReducer.reduce(
        reader, { type: 'set-overlay', overlay: 'reader-control' },
      );
      expect(control.routeId).assertEqual('immersive-reading');
      expect(control.stack.length).assertEqual(reader.stack.length);
      expect(control.overlay).assertEqual('reader-control');
    });

    it('readerModuleSwitchChangesOnlySemanticOverlay', 0, () => {
      const reader = ReaderReducer.push(DemoUiState.initial(), 'immersive-reading');
      const control = ReaderReducer.reduce(
        reader, { type: 'set-overlay', overlay: 'reader-control' },
      );
      const tts = ReaderReducer.reduce(
        control, { type: 'reader-module-switch', module: 'tts' },
      );
      expect(tts.routeId).assertEqual('immersive-reading');
      expect(tts.stack.length).assertEqual(control.stack.length);
      expect(tts.overlay).assertEqual('tts');
    });

    it('readerModuleSwitchFailsClosedOutsideActiveControlFamily', 0, () => {
      const reader = ReaderReducer.push(DemoUiState.initial(), 'immersive-reading');
      const unchanged = ReaderReducer.reduce(
        reader, { type: 'reader-module-switch', module: 'appearance' },
      );
      expect(unchanged.routeId).assertEqual('immersive-reading');
      expect(unchanged.overlay).assertEqual('');
      expect(unchanged.stack.length).assertEqual(reader.stack.length);
    });

    it('clearingSemanticOverlayReturnsToReadingSurfaceWithoutPop', 0, () => {
      const reader = ReaderReducer.push(DemoUiState.initial(), 'immersive-reading');
      const settings = ReaderReducer.reduce(
        ReaderReducer.reduce(reader, { type: 'set-overlay', overlay: 'reader-control' }),
        { type: 'reader-module-switch', module: 'settings' },
      );
      const cleared = ReaderReducer.reduce(
        settings, { type: 'set-overlay', overlay: '' },
      );
      expect(cleared.routeId).assertEqual('immersive-reading');
      expect(cleared.stack.length).assertEqual(reader.stack.length);
      expect(cleared.overlay).assertEqual('');
    });

    it('autoPageAndReplacementRemainExplicitCanonicalRoutes', 0, () => {
      const reader = ReaderReducer.push(DemoUiState.initial(), 'immersive-reading');
      const autoPage = ReaderReducer.push(reader, 'auto-page');
      expect(autoPage.routeId).assertEqual('auto-page');
      const replacement = ReaderReducer.replace(autoPage, 'content-replacement');
      expect(replacement.routeId).assertEqual('content-replacement');
      expect(replacement.stack.length).assertEqual(autoPage.stack.length);
    });

    it('switchTabClearsSemanticOverlayAndReaderStack', 0, () => {
      const reader = ReaderReducer.push(DemoUiState.initial(), 'immersive-reading');
      const control = ReaderReducer.reduce(
        reader, { type: 'set-overlay', overlay: 'reader-control' },
      );
      const afterTab = ReaderReducer.reduce(
        control, { type: 'switch-tab', tab: 'bookshelf' },
      );
      expect(afterTab.routeId).assertEqual('bookshelf');
      expect(afterTab.stack.length).assertEqual(1);
      expect(afterTab.overlay).assertEqual('');
    });
  });
}
