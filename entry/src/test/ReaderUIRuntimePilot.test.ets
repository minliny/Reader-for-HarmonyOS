// ReaderUIRuntimePilot.test — shadow-contract pilot for the shared Reader-UI
// ArkTS runtime. These tests deliberately compare the shared state/effect
// transition with HarmonyOS' current native reducer wiring; the shared runtime
// is not yet used as the production store.
import { describe, it, expect } from '@ohos/hypium';
import {
  ReaderUIBookOpenLayout,
  ReaderUICanonicalLocation,
  ReaderUIJSONPayload,
  ReaderUILocationReflow,
  ReaderUIPlaybackTransition,
  ReaderUIRuntime,
  ReaderUIState,
  ReaderUITransition,
} from 'reader_ui_runtime';
import { DemoUiState } from '../main/ets/ui/fixtures/DemoUiState';
import { ReaderReducer } from '../main/ets/ui/store/ReaderReducer';

function effectTypes(transition: ReaderUITransition | ReaderUIPlaybackTransition): string[] {
  const types: string[] = [];
  for (let i = 0; i < transition.effects.length; i++) {
    types.push(transition.effects[i].type);
  }
  return types;
}

function activeReaderRuntime(): ReaderUIRuntime {
  const state: ReaderUIState = {
    routeId: 'immersive-reading',
    routeStack: ['bookshelf'],
    tab: 'bookshelf',
    loading: false,
    reducedMotion: false,
    readerPageIndex: 0,
  };
  return new ReaderUIRuntime(state);
}

export default function ReaderUIRuntimePilotTests(): void {
  describe('ReaderUIRuntimePilot', () => {
    it('consumesSerialBookOpenRuntimeApiWithoutExecutingEffects', 0, () => {
      const runtime = new ReaderUIRuntime();
      const payload: ReaderUIJSONPayload = {};
      payload['bookId'] = '/book/101';
      payload['sourceId'] = 'legado-yodu-src';
      payload['sourceKind'] = 'remote';
      payload['chapterIndex'] = 1;
      const transition = runtime.dispatch('book.open', payload, 'book-open-1');

      const nativeInitial = DemoUiState.initial();
      const nativeLoading = ReaderReducer.reduce(nativeInitial, {
        type: 'bookshelf-book-open',
        bookId: '/book/101',
        sourceId: 'legado-yodu-src',
        sourceKind: 'remote',
        readerEntry: true,
      });

      expect(transition.state.routeId).assertEqual(nativeLoading.routeId);
      expect(transition.state.loading).assertEqual(nativeLoading.loading);
      expect(transition.state.routeId).assertEqual('immersive-reading');
      expect(effectTypes(transition).join(',')).assertEqual('source.detail');
      expect(transition.effects[0].correlationId).assertEqual('book-open-1');

      const detail = runtime.acceptBookOpenJSONResult('source.detail', 'book-open-1', {});
      expect(detail.accepted).assertTrue();
      expect(detail.effects.length).assertEqual(1);
      expect(detail.effects[0].type).assertEqual('chapter.list');

      const toc = runtime.acceptBookOpenJSONResult(
        'chapter.list', 'book-open-1', { 'chapterCount': 3, 'selectedChapterIndex': 1 },
      );
      expect(toc.accepted).assertTrue();
      expect(toc.effects[0].type).assertEqual('content.load');
      expect(toc.effects[0].jsonPayload?.['chapterIndex']).assertEqual(1);

      const content = runtime.acceptBookOpenJSONResult('content.load', 'book-open-1', {});
      expect(content.accepted).assertTrue();
      expect(content.effects.length).assertEqual(0);
      const layout: ReaderUIBookOpenLayout = {
        chapterOffset: 0,
        chapterProgress: 0,
        viewportWidth: 390,
        viewportHeight: 844,
        fontScale: 1,
      };
      const located = runtime.provideBookOpenLayout('book-open-1', layout);
      expect(located.accepted).assertTrue();
      expect(located.effects[0].type).assertEqual('reader.location.resolve');
      const resolvePayload: ReaderUIJSONPayload = located.effects[0].jsonPayload as ReaderUIJSONPayload;
      expect(resolvePayload['bookId'] as string).assertEqual('/book/101');
      const canonicalLocation: ReaderUICanonicalLocation = {
        bookId: '/book/101',
        chapterIndex: 1,
        chapterOffset: 0,
        chapterProgress: 0,
        locationRevision: 'reader-location-v1:/book/101:1:0',
      };
      const reflow: ReaderUILocationReflow = {
        strategy: 'offsetAnchor',
        primaryAnchor: 'chapterOffset',
        fallbackAnchor: 'chapterProgress',
        layoutIndependent: true,
      };
      const complete = runtime.acceptBookOpenResult(
        'reader.location.resolve', 'book-open-1', undefined, undefined, canonicalLocation, reflow,
      );
      expect(complete.accepted).assertTrue();
      expect(complete.state.loading).assertFalse();
      const stale = runtime.acceptBookOpenResult(
        'reader.location.resolve', 'book-open-1', undefined, undefined, canonicalLocation, reflow,
      );
      expect(stale.accepted).assertFalse();
    });

    it('directoryOverlayIsNoLongerOwnedByNativeReducer', 0, () => {
      const runtime = new ReaderUIRuntime();
      const transition = runtime.dispatch('reader.directory.open');

      const nativeBase = DemoUiState.initial();
      const nativeOverlay = ReaderReducer.reduce(
        nativeBase, { type: 'set-overlay', overlay: 'directory' },
      );

      expect(transition.state.overlay).assertEqual('directory');
      expect(nativeOverlay.routeId).assertEqual(nativeBase.routeId);
      expect(nativeOverlay.stack.length).assertEqual(nativeBase.stack.length);
      expect(nativeOverlay.overlay).assertEqual('directory');
      expect(transition.effects.length).assertEqual(0);
    });

    it('ttsAndAutoPageSessionsMatchNativeMutualExclusion', 0, () => {
      const runtime = activeReaderRuntime();
      const ttsStart = runtime.dispatch('reader.tts.start', {}, 'tts-shadow');
      expect(ttsStart.state.activeSession === undefined).assertTrue();
      expect(effectTypes(ttsStart).join(',')).assertEqual('tts.queue.plan');
      expect(effectTypes(runtime.acceptTTSCoreResult('tts.queue.plan', 'tts-shadow')).join(','))
        .assertEqual('tts.queue.start');
      expect(effectTypes(runtime.acceptTTSCoreResult('tts.queue.start', 'tts-shadow')).join(','))
        .assertEqual('tts.system.start');
      const ttsPlaying = runtime.acceptTTSSystemStart('tts-shadow');
      expect(ttsPlaying.state.activeSession).assertEqual('tts');

      const nativeTts = ReaderReducer.reduce(DemoUiState.initial(), { type: 'tts-toggle' });
      expect(nativeTts.activeSession).assertEqual(ttsPlaying.state.activeSession);

      const autoPayload: Record<string, string> = {};
      autoPayload['intervalMs'] = '1000';
      const autoStart = runtime.dispatch('reader.autoPage.start', autoPayload, 'auto-shadow');
      const nativeAuto = ReaderReducer.reduce(nativeTts, { type: 'auto-page-toggle' });
      expect(autoStart.state.activeSession).assertEqual('auto-page');
      expect(nativeAuto.activeSession).assertEqual(autoStart.state.activeSession);

      const autoStop = runtime.dispatch('reader.autoPage.stop');
      const nativeStop = ReaderReducer.reduce(nativeAuto, { type: 'auto-page-toggle' });
      expect(autoStop.state.activeSession).assertEqual(undefined);
      expect(nativeStop.activeSession).assertEqual('');
    });
  });
}
