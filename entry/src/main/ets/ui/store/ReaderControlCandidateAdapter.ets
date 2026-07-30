// Generated-runtime projection for Reader-UI schema 3 reader controls.
//
// ReaderUiStore may consume `reader.control.toggle` in production only after
// the exact reader-control overlay is implementation-ready. Module switching
// remains candidate-backport and uses this adapter only through the explicit
// test seam until each module family completes its own admission.
import {
  GENERATED_RUNTIME_ACTIONS,
  ReaderUIJSONPayload,
  ReaderUIRuntime,
  ReaderUIState,
  ReaderUITransition,
  RUNTIME_ACTION_SCHEMA_VERSION,
} from 'reader_ui_runtime';
import { ReaderReducer } from './ReaderReducer';
import { Overlay, ReaderUiState, UiEvent } from './ReaderUiState';

export type ReaderControlCandidateMotionKind = 'show' | 'hide' | 'switch' | 'no-op';
export type ReaderControlCandidateMotionId =
  | 'reader.control.show' | 'reader.control.hide' | 'reader.module.switch' | '';

export abstract class ReaderControlCandidateRuntimeDriver {
  abstract dispatch(event: string, payload: ReaderUIJSONPayload): ReaderUITransition;
}

export abstract class ReaderControlCandidateRuntimeFactory {
  abstract create(initialState: ReaderUIState): ReaderControlCandidateRuntimeDriver;
}

class GeneratedReaderControlCandidateDriver extends ReaderControlCandidateRuntimeDriver {
  private readonly runtime: ReaderUIRuntime;

  constructor(initialState: ReaderUIState) {
    super();
    this.runtime = new ReaderUIRuntime(initialState);
  }

  dispatch(event: string, payload: ReaderUIJSONPayload): ReaderUITransition {
    return this.runtime.dispatch(event, payload);
  }
}

class GeneratedReaderControlCandidateFactory extends ReaderControlCandidateRuntimeFactory {
  create(initialState: ReaderUIState): ReaderControlCandidateRuntimeDriver {
    return new GeneratedReaderControlCandidateDriver(initialState);
  }
}

export interface ReaderControlCandidateResult {
  handled: boolean;
  succeeded: boolean;
  changed: boolean;
  canonicalEvent: string;
  previousOverlay: string;
  semanticOverlay: string;
  readerRouteId: string;
  motionKind: ReaderControlCandidateMotionKind;
  motionId: ReaderControlCandidateMotionId;
  errorCode: string;
  state: ReaderUiState;
}

interface ReaderControlNativeProjection {
  valid: boolean;
  readerRouteId: string;
  readerRouteStack: string[];
  semanticOverlay: string;
  errorCode: string;
}

interface RuntimeErrorLike {
  code?: string;
}

const IMMERSIVE_READER_ROUTE: string = 'immersive-reading';
const GENERATED_FACTORY: ReaderControlCandidateRuntimeFactory = new GeneratedReaderControlCandidateFactory();

export class ReaderControlCandidateAdapter {
  static consume(event: UiEvent, nativeBefore: ReaderUiState,
    factory?: ReaderControlCandidateRuntimeFactory): ReaderControlCandidateResult {
    if (event.type !== 'reader.control.toggle' && event.type !== 'reader.module.switch') {
      return ReaderControlCandidateAdapter.result(
        false, false, false, '', '', '', '', 'no-op', '', '', nativeBefore,
      );
    }
    if (!ReaderControlCandidateAdapter.schema3ActionsAvailable()) {
      return ReaderControlCandidateAdapter.result(
        true, false, false, event.type, '', '', '', 'no-op', '',
        'READER_UI_SCHEMA3_CANDIDATE_UNAVAILABLE', nativeBefore,
      );
    }

    const nativeProjection: ReaderControlNativeProjection = ReaderControlCandidateAdapter.project(nativeBefore);
    if (!nativeProjection.valid) {
      return ReaderControlCandidateAdapter.result(
        true, false, false, event.type, nativeProjection.semanticOverlay,
        nativeProjection.semanticOverlay, nativeProjection.readerRouteId,
        'no-op', '', nativeProjection.errorCode, nativeBefore,
      );
    }

    const payload: ReaderUIJSONPayload = event.readerUIJSONPayload ?? {};
    let transition: ReaderUITransition;
    try {
      const initialState: ReaderUIState = ReaderControlCandidateAdapter.runtimeState(nativeBefore, nativeProjection);
      const driver: ReaderControlCandidateRuntimeDriver = (factory ?? GENERATED_FACTORY).create(initialState);
      transition = driver.dispatch(event.type, payload);
    } catch (error) {
      return ReaderControlCandidateAdapter.result(
        true, false, false, event.type, nativeProjection.semanticOverlay,
        nativeProjection.semanticOverlay, nativeProjection.readerRouteId,
        'no-op', '', ReaderControlCandidateAdapter.errorCode(error), nativeBefore,
      );
    }

    if (transition.event !== event.type) {
      return ReaderControlCandidateAdapter.failure(
        event.type, nativeBefore, nativeProjection, 'CANDIDATE_EVENT_MISMATCH',
      );
    }
    if (transition.effects.length !== 0) {
      return ReaderControlCandidateAdapter.failure(
        event.type, nativeBefore, nativeProjection, 'UNEXPECTED_CANDIDATE_EFFECT',
      );
    }
    if (!ReaderControlCandidateAdapter.matchesNativeBaseline(
      transition.previous, nativeBefore, nativeProjection,
    )) {
      return ReaderControlCandidateAdapter.failure(
        event.type, nativeBefore, nativeProjection, 'RUNTIME_NATIVE_BASELINE_MISMATCH',
      );
    }
    if (!ReaderControlCandidateAdapter.stableFieldsMatch(transition.previous, transition.state)) {
      return ReaderControlCandidateAdapter.failure(
        event.type, nativeBefore, nativeProjection, 'READER_ROUTE_IDENTITY_CHANGED',
      );
    }

    const previousOverlay: string = ReaderControlCandidateAdapter.optionalOverlay(transition.previous);
    const semanticOverlay: string = ReaderControlCandidateAdapter.optionalOverlay(transition.state);
    if (!ReaderControlCandidateAdapter.isSemanticOverlay(previousOverlay) ||
      !ReaderControlCandidateAdapter.isSemanticOverlay(semanticOverlay)) {
      return ReaderControlCandidateAdapter.failure(
        event.type, nativeBefore, nativeProjection, 'READER_CONTROL_OVERLAY_GUARD',
      );
    }

    const nativeAfter: ReaderUiState = ReaderControlCandidateAdapter.applyOverlay(
      nativeBefore, previousOverlay, semanticOverlay,
    );
    const afterProjection: ReaderControlNativeProjection = ReaderControlCandidateAdapter.project(nativeAfter);
    if (!afterProjection.valid || afterProjection.readerRouteId !== nativeProjection.readerRouteId ||
      afterProjection.readerRouteStack.join('|') !== nativeProjection.readerRouteStack.join('|') ||
      afterProjection.semanticOverlay !== semanticOverlay ||
      !ReaderControlCandidateAdapter.matchesNativeBaseline(
        transition.state, nativeAfter, afterProjection,
      )) {
      return ReaderControlCandidateAdapter.failure(
        event.type, nativeBefore, nativeProjection, 'CANDIDATE_PROJECTION_MISMATCH',
      );
    }

    const motionKind: ReaderControlCandidateMotionKind =
      ReaderControlCandidateAdapter.motionKind(previousOverlay, semanticOverlay);
    return ReaderControlCandidateAdapter.result(
      true, true, previousOverlay !== semanticOverlay, event.type,
      previousOverlay, semanticOverlay, afterProjection.readerRouteId,
      motionKind, ReaderControlCandidateAdapter.motionId(motionKind), '', nativeAfter,
    );
  }

  static schema3ActionsAvailable(): boolean {
    return RUNTIME_ACTION_SCHEMA_VERSION >= 3 &&
      GENERATED_RUNTIME_ACTIONS['reader.control.toggle']?.action === 'toggleReaderControl' &&
      GENERATED_RUNTIME_ACTIONS['reader.module.switch']?.action === 'switchReaderModule';
  }

  private static runtimeState(native: ReaderUiState,
    projection: ReaderControlNativeProjection): ReaderUIState {
    const state: ReaderUIState = {
      routeId: projection.readerRouteId,
      routeStack: projection.readerRouteStack.slice(),
      tab: native.tab,
      loading: native.loading,
      reducedMotion: native.reducedMotion,
      readerPageIndex: native.readerPageIndex,
    };
    if (projection.semanticOverlay.length > 0) state.overlay = projection.semanticOverlay;
    if (native.activeSession.length > 0) state.activeSession = native.activeSession;
    if (native.focusTarget.length > 0) state.focusTarget = native.focusTarget;
    if (native.error !== null) state.error = native.error.code;
    return state;
  }

  private static project(state: ReaderUiState): ReaderControlNativeProjection {
    if (!ReaderControlCandidateAdapter.isSemanticOverlay(state.overlay)) {
      return {
        valid: false, readerRouteId: state.routeId, readerRouteStack: [],
        semanticOverlay: state.overlay,
        errorCode: 'READER_CONTROL_OVERLAY_GUARD',
      };
    }
    if (state.stack.length === 0 || state.stack[state.stack.length - 1].id !== state.routeId) {
      return {
        valid: false, readerRouteId: state.routeId, readerRouteStack: [], semanticOverlay: '',
        errorCode: 'READER_ROUTE_GUARD',
      };
    }

    const readerIndex: number = state.stack.length - 1;
    if (state.routeId !== IMMERSIVE_READER_ROUTE ||
      state.stack[readerIndex].id !== IMMERSIVE_READER_ROUTE) {
      return {
        valid: false, readerRouteId: state.routeId, readerRouteStack: [],
        semanticOverlay: state.overlay, errorCode: 'READER_ROUTE_GUARD',
      };
    }

    const readerRouteStack: string[] = [];
    for (let index: number = 0; index < readerIndex; index += 1) {
      readerRouteStack.push(state.stack[index].id);
    }
    return {
      valid: true, readerRouteId: IMMERSIVE_READER_ROUTE,
      readerRouteStack: readerRouteStack, semanticOverlay: state.overlay, errorCode: '',
    };
  }

  private static matchesNativeBaseline(runtime: ReaderUIState, native: ReaderUiState,
    projection: ReaderControlNativeProjection): boolean {
    return runtime.routeId === projection.readerRouteId &&
      runtime.routeStack.join('|') === projection.readerRouteStack.join('|') &&
      ReaderControlCandidateAdapter.optionalOverlay(runtime) === projection.semanticOverlay &&
      runtime.tab === native.tab &&
      ReaderControlCandidateAdapter.optional(runtime.activeSession) === native.activeSession &&
      runtime.loading === native.loading && runtime.reducedMotion === native.reducedMotion &&
      runtime.readerPageIndex === native.readerPageIndex &&
      ReaderControlCandidateAdapter.optional(runtime.focusTarget) === native.focusTarget &&
      ReaderControlCandidateAdapter.optional(runtime.error) === (native.error?.code ?? '');
  }

  // These actions may change overlay only. Comparing every other runtime field
  // makes stale transaction/appearance state fail closed before motion derivation.
  private static stableFieldsMatch(previous: ReaderUIState, state: ReaderUIState): boolean {
    return previous.routeId === state.routeId && previous.routeStack.join('|') === state.routeStack.join('|') &&
      previous.tab === state.tab &&
      ReaderControlCandidateAdapter.optional(previous.activeSession) ===
        ReaderControlCandidateAdapter.optional(state.activeSession) &&
      previous.loading === state.loading && previous.reducedMotion === state.reducedMotion &&
      previous.readerPageIndex === state.readerPageIndex &&
      ReaderControlCandidateAdapter.json(previous.readerCanonicalLocation) ===
        ReaderControlCandidateAdapter.json(state.readerCanonicalLocation) &&
      ReaderControlCandidateAdapter.optional(previous.focusTarget) ===
        ReaderControlCandidateAdapter.optional(state.focusTarget) &&
      ReaderControlCandidateAdapter.optional(previous.error) === ReaderControlCandidateAdapter.optional(state.error) &&
      ReaderControlCandidateAdapter.json(previous.bookOpenTransaction) ===
        ReaderControlCandidateAdapter.json(state.bookOpenTransaction) &&
      ReaderControlCandidateAdapter.json(previous.pageTransaction) ===
        ReaderControlCandidateAdapter.json(state.pageTransaction) &&
      ReaderControlCandidateAdapter.json(previous.ttsTransaction) ===
        ReaderControlCandidateAdapter.json(state.ttsTransaction) &&
      ReaderControlCandidateAdapter.json(previous.autoPageTransaction) ===
        ReaderControlCandidateAdapter.json(state.autoPageTransaction) &&
      (previous.playbackGeneration ?? 0) === (state.playbackGeneration ?? 0) &&
      ReaderControlCandidateAdapter.json(previous.appearancePreference) ===
        ReaderControlCandidateAdapter.json(state.appearancePreference) &&
      ReaderControlCandidateAdapter.json(previous.appearanceTransaction) ===
        ReaderControlCandidateAdapter.json(state.appearanceTransaction) &&
      (previous.fontUnregisterRestartRequired ?? false) ===
        (state.fontUnregisterRestartRequired ?? false) &&
      (previous.appearanceReconcileRequired ?? false) ===
        (state.appearanceReconcileRequired ?? false);
  }

  private static applyOverlay(state: ReaderUiState, previousOverlay: string,
    semanticOverlay: string): ReaderUiState {
    if (previousOverlay === semanticOverlay) return state;
    const overlay: Overlay = ReaderControlCandidateAdapter.nativeOverlay(semanticOverlay);
    return ReaderReducer.setOverlay(state, overlay);
  }

  private static nativeOverlay(overlay: string): Overlay {
    if (overlay === 'reader-control') return 'reader-control';
    if (overlay === 'directory') return 'directory';
    if (overlay === 'tts') return 'tts';
    if (overlay === 'appearance') return 'appearance';
    if (overlay === 'settings') return 'settings';
    return '';
  }

  private static isSemanticOverlay(overlay: string): boolean {
    return overlay.length === 0 || overlay === 'reader-control' || overlay === 'directory' ||
      overlay === 'tts' || overlay === 'appearance' || overlay === 'settings';
  }

  private static optionalOverlay(state: ReaderUIState): string { return state.overlay ?? ''; }
  private static optional(value?: string): string { return value ?? ''; }
  private static json(value?: Object): string { return value === undefined ? '' : JSON.stringify(value); }

  private static errorCode(error: Object): string {
    const runtimeError: RuntimeErrorLike = error as RuntimeErrorLike;
    return runtimeError.code ?? 'READER_CONTROL_CANDIDATE_DISPATCH_FAILED';
  }

  private static motionKind(previousOverlay: string,
    semanticOverlay: string): ReaderControlCandidateMotionKind {
    if (previousOverlay === semanticOverlay) return 'no-op';
    if (previousOverlay.length === 0) return 'show';
    if (semanticOverlay.length === 0) return 'hide';
    return 'switch';
  }

  private static motionId(kind: ReaderControlCandidateMotionKind): ReaderControlCandidateMotionId {
    if (kind === 'show') return 'reader.control.show';
    if (kind === 'hide') return 'reader.control.hide';
    if (kind === 'switch') return 'reader.module.switch';
    return '';
  }

  private static failure(event: string, state: ReaderUiState,
    projection: ReaderControlNativeProjection, errorCode: string): ReaderControlCandidateResult {
    return ReaderControlCandidateAdapter.result(
      true, false, false, event, projection.semanticOverlay, projection.semanticOverlay,
      projection.readerRouteId, 'no-op', '', errorCode, state,
    );
  }

  private static result(handled: boolean, succeeded: boolean, changed: boolean,
    canonicalEvent: string, previousOverlay: string, semanticOverlay: string,
    readerRouteId: string, motionKind: ReaderControlCandidateMotionKind,
    motionId: ReaderControlCandidateMotionId, errorCode: string,
    state: ReaderUiState): ReaderControlCandidateResult {
    return {
      handled: handled, succeeded: succeeded, changed: changed,
      canonicalEvent: canonicalEvent, previousOverlay: previousOverlay,
      semanticOverlay: semanticOverlay, readerRouteId: readerRouteId,
      motionKind: motionKind, motionId: motionId, errorCode: errorCode, state: state,
    };
  }
}
