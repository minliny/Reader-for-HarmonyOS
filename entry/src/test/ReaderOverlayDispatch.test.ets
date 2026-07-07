// ReaderOverlayDispatch.test — route-driven reader overlay navigation.
// Reader overlays are routes now (Batch 1): route-push to open, route-pop to
// close, route-replace for state switches (night-mode). Locks the reducer
// stack semantics so a regression to the legacy reader.overlay field dispatch
// fails locally.
import { describe, it, expect } from '@ohos/hypium';
import { ReaderReducer } from '../main/ets/ui/store/ReaderReducer';
import { DemoUiState } from '../main/ets/ui/fixtures/DemoUiState';

export default function ReaderOverlayDispatchTests(): void {
  describe('ReaderOverlayDispatch', () => {
    it('pushToControlLayerSetsRouteId', 0, () => {
      const s = DemoUiState.initial();
      const after = ReaderReducer.push(s, 'control-layer-base-v2');
      expect(after.routeId).assertEqual('control-layer-base-v2');
      expect(after.stack.length).assertEqual(s.stack.length + 1);
      expect(after.stack[after.stack.length - 1].id).assertEqual('control-layer-base-v2');
    });

    it('pushToDirectoryOverlayStacksOnControlLayer', 0, () => {
      const s = ReaderReducer.push(DemoUiState.initial(), 'control-layer-base-v2');
      const after = ReaderReducer.push(s, 'reader-directory-overlay-v2');
      expect(after.routeId).assertEqual('reader-directory-overlay-v2');
      expect(after.stack.length).assertEqual(s.stack.length + 1);
    });

    it('popFromDirectoryReturnsToControlLayer', 0, () => {
      const ctrl = ReaderReducer.push(DemoUiState.initial(), 'control-layer-base-v2');
      const dir = ReaderReducer.push(ctrl, 'reader-directory-overlay-v2');
      const after = ReaderReducer.pop(dir);
      expect(after.routeId).assertEqual('control-layer-base-v2');
      expect(after.stack.length).assertEqual(ctrl.stack.length);
    });

    it('replaceDoesNotGrowStack', 0, () => {
      // night-state uses route-replace (state switch, no stack growth). Verify
      // the replace semantics with directory as a stand-in.
      const ctrl = ReaderReducer.push(DemoUiState.initial(), 'control-layer-base-v2');
      const after = ReaderReducer.replace(ctrl, 'reader-directory-overlay-v2');
      expect(after.routeId).assertEqual('reader-directory-overlay-v2');
      expect(after.stack.length).assertEqual(ctrl.stack.length);
    });

    it('routePushResetsOverlay', 0, () => {
      // route-driven overlays: a route change must clear reader.overlay so the
      // legacy transient-overlay field does not linger across overlay navigation.
      const s = DemoUiState.initial();
      const after = ReaderReducer.push(s, 'control-layer-base-v2');
      expect(after.overlay).assertEqual('');
    });
  });
}
