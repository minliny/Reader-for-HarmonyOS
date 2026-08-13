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

  describe('Slice 3 overlay mutual exclusion + transition-guard', () => {
    it('openingSecondOverlayReplacesFirstViaRouteStack', 0, () => {
      // Overlay mutual exclusion: route stack ensures only one overlay at a time.
      // Pushing a second module overlay replaces the first (via reader-module-switch
      // replace semantics), not stacks on top.
      const ctrl = ReaderReducer.push(DemoUiState.initial(), 'control-layer-base-v2');
      const dir = ReaderReducer.push(ctrl, 'reader-directory-overlay-v2');
      expect(dir.routeId).assertEqual('reader-directory-overlay-v2');
      // Dispatch the real contract event. The reducer must replace the current
      // module route instead of merely proving the lower-level helper works.
      const tts = ReaderReducer.reduce(dir, { type: 'reader-module-switch', module: 'tts' });
      expect(tts.routeId).assertEqual('reader-tts-overlay-v2');
      expect(tts.stack.length).assertEqual(dir.stack.length);
    });

    it('closingOverlayReturnsToControlLayer', 0, () => {
      // Transition-guard: closing an overlay pops back to control layer, not to reader.
      const ctrl = ReaderReducer.push(DemoUiState.initial(), 'control-layer-base-v2');
      const dir = ReaderReducer.push(ctrl, 'reader-directory-overlay-v2');
      const back = ReaderReducer.reduce(dir, { type: 'route-pop' });
      expect(back.routeId).assertEqual('control-layer-base-v2');
    });

    it('closingControlLayerReturnsToReader', 0, () => {
      // Full exit: reader → control layer → overlay → pop overlay → pop control → reader
      const reader = ReaderReducer.push(DemoUiState.initial(), 'immersive-reading');
      const ctrl = ReaderReducer.push(reader, 'control-layer-base-v2');
      const dir = ReaderReducer.push(ctrl, 'reader-appearance-overlay-v2');
      const backToCtrl = ReaderReducer.reduce(dir, { type: 'route-pop' });
      expect(backToCtrl.routeId).assertEqual('control-layer-base-v2');
      const backToReader = ReaderReducer.reduce(backToCtrl, { type: 'route-pop' });
      expect(backToReader.routeId).assertEqual('immersive-reading');
    });

    it('setOverlayEmptyClearsTransientOverlay', 0, () => {
      // Focus recovery: clearing overlay field restores base state.
      const s = ReaderReducer.reduce(DemoUiState.initial(), { type: 'set-overlay', overlay: 'sheet' });
      expect(s.overlay).assertEqual('sheet');
      const cleared = ReaderReducer.reduce(s, { type: 'set-overlay', overlay: '' });
      expect(cleared.overlay).assertEqual('');
    });

    it('switchTabClearsOverlayStack', 0, () => {
      // Tab switch interrupts overlay: switching tab resets stack to root.
      const ctrl = ReaderReducer.push(DemoUiState.initial(), 'control-layer-base-v2');
      const dir = ReaderReducer.push(ctrl, 'reader-directory-overlay-v2');
      expect(dir.stack.length).assertEqual(3);
      const afterTab = ReaderReducer.reduce(dir, { type: 'switch-tab', tab: 'bookshelf' });
      expect(afterTab.routeId).assertEqual('bookshelf');
      expect(afterTab.stack.length).assertEqual(1);
      expect(afterTab.overlay).assertEqual('');
    });
  });
}
