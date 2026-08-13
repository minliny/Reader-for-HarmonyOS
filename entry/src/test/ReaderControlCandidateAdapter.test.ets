import { describe, it, expect } from '@ohos/hypium';
import {
  GENERATED_RUNTIME_ACTIONS,
  ReaderUIJSONPayload,
  ReaderUIRuntime,
  ReaderUIState,
  ReaderUITransition,
  RUNTIME_ACTION_SCHEMA_VERSION,
} from 'reader_ui_runtime';
import {
  ReaderControlCandidateResult,
  ReaderControlCandidateRuntimeDriver,
  ReaderControlCandidateRuntimeFactory,
} from '../main/ets/ui/store/ReaderControlCandidateAdapter';
import { ReaderUiStore } from '../main/ets/ui/store/ReaderUiStore';
import { ReaderUiState, UiEvent } from '../main/ets/ui/store/ReaderUiState';

type InjectedRuntimeMode = 'stale' | 'route-drift' | 'effect';

class InjectedRuntimeDriver extends ReaderControlCandidateRuntimeDriver {
  private readonly runtime: ReaderUIRuntime;
  private readonly mode: InjectedRuntimeMode;

  constructor(initialState: ReaderUIState, mode: InjectedRuntimeMode) {
    super();
    if (mode === 'stale') initialState.overlay = 'directory';
    this.runtime = new ReaderUIRuntime(initialState);
    this.mode = mode;
  }

  dispatch(event: string, payload: ReaderUIJSONPayload): ReaderUITransition {
    if (this.mode === 'stale') return this.runtime.dispatch(event, payload);
    let actual: ReaderUITransition;
    if (this.mode === 'route-drift') {
      const routePayload: ReaderUIJSONPayload = {};
      routePayload['routeId'] = 'book-detail';
      actual = this.runtime.dispatch('route.push', routePayload);
    } else {
      actual = this.runtime.dispatch('reader.tts.start', {}, 'candidate-effect');
    }
    // The injected driver preserves a real schema 3 runtime result while
    // attributing it to the requested candidate event, allowing the Host's
    // transition guard to prove route/effect fail-closure.
    return {
      event: event,
      previous: actual.previous,
      state: actual.state,
      effects: actual.effects,
      cancelledCorrelationIds: actual.cancelledCorrelationIds,
    };
  }
}

class InjectedRuntimeFactory extends ReaderControlCandidateRuntimeFactory {
  private readonly mode: InjectedRuntimeMode;

  constructor(mode: InjectedRuntimeMode) {
    super();
    this.mode = mode;
  }

  create(initialState: ReaderUIState): ReaderControlCandidateRuntimeDriver {
    return new InjectedRuntimeDriver(initialState, this.mode);
  }
}

function controlToggle(): UiEvent {
  const payload: ReaderUIJSONPayload = {};
  payload['overlay'] = 'reader-control';
  return { type: 'reader.control.toggle', readerUIJSONPayload: payload };
}

function moduleSwitch(module: string): UiEvent {
  const payload: ReaderUIJSONPayload = {};
  payload['module'] = module;
  return { type: 'reader.module.switch', readerUIJSONPayload: payload };
}

function enterImmersiveReader(): void {
  ReaderUiStore.dispatch({ type: 'route-push', id: 'immersive-reading' });
}

function consume(event: UiEvent): ReaderControlCandidateResult {
  return ReaderUiStore.dispatchLocalReaderControlCandidateForTest(event);
}

function routeStack(state: ReaderUiState): string {
  const routes: string[] = [];
  for (let index: number = 0; index < state.stack.length; index += 1) {
    routes.push(state.stack[index].id);
  }
  return routes.join('|');
}

export default function ReaderControlCandidateAdapterTests(): void {
  describe('ReaderControlCandidateAdapter local candidate', () => {
    it('requires the real generated schema3 action table', 0, () => {
      expect(RUNTIME_ACTION_SCHEMA_VERSION >= 3).assertTrue();
      expect(GENERATED_RUNTIME_ACTIONS['reader.control.toggle']?.action).assertEqual('toggleReaderControl');
      expect(GENERATED_RUNTIME_ACTIONS['reader.module.switch']?.action).assertEqual('switchReaderModule');
    });

    it('production schema2 dispatch does not consume schema3 typed candidates', 0, () => {
      ReaderUiStore.init();
      enterImmersiveReader();
      const beforeRoutes: string = routeStack(ReaderUiStore.snapshot());

      ReaderUiStore.dispatch(controlToggle());
      ReaderUiStore.dispatch(moduleSwitch('directory'));

      const after: ReaderUiState = ReaderUiStore.snapshot();
      expect(after.routeId).assertEqual('immersive-reading');
      expect(routeStack(after)).assertEqual(beforeRoutes);
      expect(after.overlay).assertEqual('');
      expect(ReaderUiStore.runtimeShadowSnapshot().metrics.lastCanonicalEvent).assertEqual('');
      expect(ReaderUiStore.runtimeShadowSnapshot().metrics.runtimeError).assertEqual(0);
    });

    it('dispatches real runtime actions and derives show switch no-op hide motion', 0, () => {
      ReaderUiStore.init();
      enterImmersiveReader();
      const immersiveStack: string = routeStack(ReaderUiStore.snapshot());

      const shown: ReaderControlCandidateResult = consume(controlToggle());
      expect(shown.succeeded).assertTrue();
      expect(shown.readerRouteId).assertEqual('immersive-reading');
      expect(shown.previousOverlay).assertEqual('');
      expect(shown.semanticOverlay).assertEqual('reader-control');
      expect(shown.motionKind).assertEqual('show');
      expect(shown.motionId).assertEqual('reader.control.show');
      expect(ReaderUiStore.snapshot().routeId).assertEqual('control-layer-base-v2');

      const directory: ReaderControlCandidateResult = consume(moduleSwitch('directory'));
      expect(directory.succeeded).assertTrue();
      expect(directory.readerRouteId).assertEqual('immersive-reading');
      expect(directory.previousOverlay).assertEqual('reader-control');
      expect(directory.semanticOverlay).assertEqual('directory');
      expect(directory.motionKind).assertEqual('switch');
      expect(directory.motionId).assertEqual('reader.module.switch');
      expect(ReaderUiStore.snapshot().routeId).assertEqual('reader-directory-overlay-v2');

      const routesBeforeRepeat: string = routeStack(ReaderUiStore.snapshot());
      const repeated: ReaderControlCandidateResult = consume(moduleSwitch('directory'));
      expect(repeated.succeeded).assertTrue();
      expect(repeated.changed).assertFalse();
      expect(repeated.motionKind).assertEqual('no-op');
      expect(repeated.motionId).assertEqual('');
      expect(routeStack(ReaderUiStore.snapshot())).assertEqual(routesBeforeRepeat);

      const appearance: ReaderControlCandidateResult = consume(moduleSwitch('appearance'));
      expect(appearance.succeeded).assertTrue();
      expect(appearance.previousOverlay).assertEqual('directory');
      expect(appearance.semanticOverlay).assertEqual('appearance');
      expect(appearance.motionKind).assertEqual('switch');
      expect(ReaderUiStore.snapshot().routeId).assertEqual('reader-appearance-overlay-v2');

      const hidden: ReaderControlCandidateResult = consume(controlToggle());
      expect(hidden.succeeded).assertTrue();
      expect(hidden.readerRouteId).assertEqual('immersive-reading');
      expect(hidden.previousOverlay).assertEqual('appearance');
      expect(hidden.semanticOverlay).assertEqual('');
      expect(hidden.motionKind).assertEqual('hide');
      expect(hidden.motionId).assertEqual('reader.control.hide');
      expect(ReaderUiStore.snapshot().routeId).assertEqual('immersive-reading');
      expect(routeStack(ReaderUiStore.snapshot())).assertEqual(immersiveStack);
    });

    it('accepts exactly four compatible module overlays and preserves reader identity', 0, () => {
      const modules: string[] = ['directory', 'tts', 'appearance', 'settings'];
      const routes: string[] = [
        'reader-directory-overlay-v2', 'reader-tts-overlay-v2',
        'reader-appearance-overlay-v2', 'reader-settings-overlay-v2',
      ];
      for (let index: number = 0; index < modules.length; index += 1) {
        ReaderUiStore.init();
        enterImmersiveReader();
        const immersiveStack: string = routeStack(ReaderUiStore.snapshot());
        expect(consume(controlToggle()).succeeded).assertTrue();
        const selected: ReaderControlCandidateResult = consume(moduleSwitch(modules[index]));
        expect(selected.succeeded).assertTrue();
        expect(selected.readerRouteId).assertEqual('immersive-reading');
        expect(selected.semanticOverlay).assertEqual(modules[index]);
        expect(ReaderUiStore.snapshot().routeId).assertEqual(routes[index]);

        const hidden: ReaderControlCandidateResult = consume(controlToggle());
        expect(hidden.succeeded).assertTrue();
        expect(hidden.motionKind).assertEqual('hide');
        expect(ReaderUiStore.snapshot().routeId).assertEqual('immersive-reading');
        expect(routeStack(ReaderUiStore.snapshot())).assertEqual(immersiveStack);
      }
    });

    it('fails closed on wrong route inactive family and non-reader overlays', 0, () => {
      ReaderUiStore.init();
      const wrongRoute: ReaderControlCandidateResult = consume(controlToggle());
      expect(wrongRoute.succeeded).assertFalse();
      expect(wrongRoute.errorCode).assertEqual('READER_ROUTE_GUARD');
      expect(ReaderUiStore.snapshot().routeId).assertEqual('bookshelf');

      enterImmersiveReader();
      const inactive: ReaderControlCandidateResult = consume(moduleSwitch('tts'));
      expect(inactive.succeeded).assertFalse();
      expect(inactive.errorCode).assertEqual('READER_CONTROL_OVERLAY_GUARD');
      expect(ReaderUiStore.snapshot().routeId).assertEqual('immersive-reading');

      ReaderUiStore.dispatch({ type: 'set-overlay', overlay: 'dialog' });
      const genericOverlay: ReaderControlCandidateResult = consume(controlToggle());
      expect(genericOverlay.succeeded).assertFalse();
      expect(genericOverlay.errorCode).assertEqual('READER_CONTROL_OVERLAY_GUARD');
      expect(ReaderUiStore.snapshot().overlay).assertEqual('dialog');

      ReaderUiStore.init();
      enterImmersiveReader();
      ReaderUiStore.dispatch({ type: 'route-push', id: 'reader-search-overlay-v2' });
      const incompatibleRoute: ReaderControlCandidateResult = consume(moduleSwitch('settings'));
      expect(incompatibleRoute.succeeded).assertFalse();
      expect(incompatibleRoute.errorCode).assertEqual('READER_CONTROL_OVERLAY_GUARD');
      expect(ReaderUiStore.snapshot().routeId).assertEqual('reader-search-overlay-v2');
    });

    it('uses real typed validation before touching native state', 0, () => {
      ReaderUiStore.init();
      enterImmersiveReader();
      const beforeRoutes: string = routeStack(ReaderUiStore.snapshot());

      const invalidModule: ReaderControlCandidateResult = consume(moduleSwitch('search'));
      expect(invalidModule.succeeded).assertFalse();
      expect(invalidModule.errorCode).assertEqual('INVALID_TYPED_PAYLOAD');

      const payload: ReaderUIJSONPayload = {};
      payload['overlay'] = 'reader-control';
      payload['extra'] = true;
      const extraField: ReaderControlCandidateResult = consume({
        type: 'reader.control.toggle', readerUIJSONPayload: payload,
      });
      expect(extraField.succeeded).assertFalse();
      expect(extraField.errorCode).assertEqual('INVALID_TYPED_PAYLOAD');
      expect(ReaderUiStore.snapshot().routeId).assertEqual('immersive-reading');
      expect(routeStack(ReaderUiStore.snapshot())).assertEqual(beforeRoutes);
    });

    it('rejects injected stale baseline route drift and effects before motion', 0, () => {
      ReaderUiStore.init();
      enterImmersiveReader();
      const beforeRoutes: string = routeStack(ReaderUiStore.snapshot());

      ReaderUiStore.setReaderControlCandidateRuntimeFactoryForTest(
        new InjectedRuntimeFactory('stale'),
      );
      const stale: ReaderControlCandidateResult = consume(moduleSwitch('appearance'));
      expect(stale.succeeded).assertFalse();
      expect(stale.errorCode).assertEqual('RUNTIME_NATIVE_BASELINE_MISMATCH');
      expect(stale.motionKind).assertEqual('no-op');

      ReaderUiStore.setReaderControlCandidateRuntimeFactoryForTest(
        new InjectedRuntimeFactory('route-drift'),
      );
      const routeDrift: ReaderControlCandidateResult = consume(controlToggle());
      expect(routeDrift.succeeded).assertFalse();
      expect(routeDrift.errorCode).assertEqual('READER_ROUTE_IDENTITY_CHANGED');
      expect(routeDrift.motionKind).assertEqual('no-op');

      ReaderUiStore.setReaderControlCandidateRuntimeFactoryForTest(
        new InjectedRuntimeFactory('effect'),
      );
      const effectful: ReaderControlCandidateResult = consume(controlToggle());
      expect(effectful.succeeded).assertFalse();
      expect(effectful.errorCode).assertEqual('UNEXPECTED_CANDIDATE_EFFECT');
      expect(ReaderUiStore.snapshot().routeId).assertEqual('immersive-reading');
      expect(routeStack(ReaderUiStore.snapshot())).assertEqual(beforeRoutes);
      ReaderUiStore.setReaderControlCandidateRuntimeFactoryForTest(undefined);
    });
  });
}
