import { describe, it, expect } from '@ohos/hypium';
import {
  initialReaderUIState,
  ReaderUIState,
  ReaderUITransition,
} from 'reader_ui_runtime';
import { ReaderUiStore } from '../main/ets/ui/store/ReaderUiStore';
import { ReaderUIRuntimeDriver } from '../main/ets/ui/store/ReaderUIRuntimeShadowCoordinator';

class FailingDirectoryRuntime extends ReaderUIRuntimeDriver {
  readonly state: ReaderUIState = initialReaderUIState();

  constructor() {
    super();
  }

  dispatch(_event: string, _payload?: Record<string, string>, _correlationId?: string): ReaderUITransition {
    throw new Error('forced directory runtime failure');
  }
}

export default function ReaderUIDirectoryPilotTests(): void {
  describe('ReaderUIRuntime directory Pilot', () => {
    it('real Store entry and back use one continuous runtime projection', 0, () => {
      ReaderUiStore.init();
      ReaderUiStore.dispatch({ type: 'route-push', id: 'immersive-reading' });
      const baseDepth = ReaderUiStore.snapshot().stack.length;

      // Real pre-R8 UI alias is normalized before native reduction.
      ReaderUiStore.dispatch({ type: 'reader-module-switch', module: 'directory' });
      expect(ReaderUiStore.snapshot().routeId).assertEqual('immersive-reading');
      expect(ReaderUiStore.snapshot().stack.length).assertEqual(baseDepth);
      expect(ReaderUiStore.snapshot().overlay).assertEqual('directory');
      expect(ReaderUiStore.runtimeShadowSnapshot().runtimeState.overlay).assertEqual('directory');

      // Repeated open is runtime-idempotent and cannot grow the native stack.
      ReaderUiStore.dispatch({ type: 'reader.directory.open' });
      expect(ReaderUiStore.snapshot().stack.length).assertEqual(baseDepth);

      // The real back alias is normalized to reader.directory.close.
      ReaderUiStore.dispatch({ type: 'route-pop' });
      const snapshot = ReaderUiStore.runtimeShadowSnapshot();
      expect(ReaderUiStore.snapshot().routeId).assertEqual('immersive-reading');
      expect(ReaderUiStore.snapshot().stack.length).assertEqual(baseDepth);
      expect(ReaderUiStore.snapshot().overlay).assertEqual('');
      expect(snapshot.runtimeState.overlay).assertEqual(undefined);
      expect(snapshot.metrics.pilot).assertEqual(3);
      expect(snapshot.metrics.pilotStateChanges).assertEqual(2);
      expect(snapshot.metrics.pilotFailure).assertEqual(0);
      expect(snapshot.metrics.observedEffects).assertEqual(0);
      expect(snapshot.metrics.executedEffects).assertEqual(0);
      expect(snapshot.metrics.mismatch).assertEqual(0);
    });

    it('native overlay replacement wins and stale directory close is a no-op', 0, () => {
      ReaderUiStore.init();
      ReaderUiStore.dispatch({ type: 'route-push', id: 'immersive-reading' });
      ReaderUiStore.dispatch({ type: 'reader.directory.open' });
      ReaderUiStore.dispatch({ type: 'reader-module-switch', module: 'appearance' });
      const depth = ReaderUiStore.snapshot().stack.length;
      expect(ReaderUiStore.snapshot().routeId).assertEqual('immersive-reading');
      expect(ReaderUiStore.snapshot().overlay).assertEqual('appearance');

      ReaderUiStore.dispatch({ type: 'reader.directory.close' });
      const snapshot = ReaderUiStore.runtimeShadowSnapshot();
      expect(ReaderUiStore.snapshot().routeId).assertEqual('immersive-reading');
      expect(ReaderUiStore.snapshot().overlay).assertEqual('appearance');
      expect(ReaderUiStore.snapshot().stack.length).assertEqual(depth);
      expect(snapshot.metrics.lastCanonicalEvent).assertEqual('reader.directory.close');
      expect(snapshot.metrics.pilotFailure).assertEqual(0);
      expect(snapshot.metrics.executedEffects).assertEqual(0);

      // Opening the Pilot from another native module replaces only the
      // semantic overlay.
      ReaderUiStore.dispatch({ type: 'reader.directory.open' });
      const reopened = ReaderUiStore.runtimeShadowSnapshot();
      expect(ReaderUiStore.snapshot().routeId).assertEqual('immersive-reading');
      expect(ReaderUiStore.snapshot().overlay).assertEqual('directory');
      expect(ReaderUiStore.snapshot().stack.length).assertEqual(depth);
      expect(reopened.runtimeState.overlay).assertEqual('directory');
      expect(reopened.metrics.mismatch).assertEqual(0);
    });

    it('runtime failure is fail-closed without native reducer or effect fallback', 0, () => {
      ReaderUiStore.init(new FailingDirectoryRuntime());
      const routeBefore = ReaderUiStore.snapshot().routeId;
      const depthBefore = ReaderUiStore.snapshot().stack.length;

      ReaderUiStore.dispatch({ type: 'reader-module-switch', module: 'directory' });
      const snapshot = ReaderUiStore.runtimeShadowSnapshot();
      expect(ReaderUiStore.snapshot().routeId).assertEqual(routeBefore);
      expect(ReaderUiStore.snapshot().stack.length).assertEqual(depthBefore);
      expect(snapshot.metrics.pilot).assertEqual(1);
      expect(snapshot.metrics.pilotFailure).assertEqual(1);
      expect(snapshot.metrics.runtimeError).assertEqual(1);
      expect(snapshot.metrics.fallback).assertEqual(0);
      expect(snapshot.metrics.executedEffects).assertEqual(0);
      expect(snapshot.metrics.lastRuntimeError.includes('forced directory')).assertTrue();
    });
  });
}
