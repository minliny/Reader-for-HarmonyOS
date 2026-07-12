import { describe, it, expect } from '@ohos/hypium';
import { GENERATED_RUNTIME_ACTIONS } from 'reader_ui_runtime';
import { ReaderUiStore } from '../main/ets/ui/store/ReaderUiStore';
import {
  READER_UI_SHADOW_COVERED_EVENTS,
  ReaderUIRuntimeShadowCoordinator,
  ReaderUIRuntimeShadowSnapshot,
} from '../main/ets/ui/store/ReaderUIRuntimeShadowCoordinator';

export default function ReaderUIRuntimeShadowTests(): void {
  describe('ReaderUIRuntime live shadow', () => {
    it('observes the directory pair continuously through the real Store path', 0, () => {
      ReaderUiStore.init();

      ReaderUiStore.dispatch({ type: 'reader-module-switch', module: 'directory' });
      const productionOpen = ReaderUiStore.snapshot();
      const shadowOpen: ReaderUIRuntimeShadowSnapshot = ReaderUiStore.runtimeShadowSnapshot();
      expect(productionOpen.routeId).assertEqual('reader-directory-overlay-v2');
      expect(productionOpen.overlay).assertEqual('');
      expect(shadowOpen.runtimeState.routeId).assertEqual('bookshelf');
      expect(shadowOpen.runtimeState.overlay).assertEqual('directory');
      expect(shadowOpen.metrics.covered).assertEqual(1);
      expect(shadowOpen.metrics.fallback).assertEqual(0);
      expect(shadowOpen.metrics.mismatch).assertEqual(0);
      expect(shadowOpen.metrics.resync).assertEqual(0);

      ReaderUiStore.dispatch({ type: 'route-pop' });
      const productionClosed = ReaderUiStore.snapshot();
      const shadowClosed: ReaderUIRuntimeShadowSnapshot = ReaderUiStore.runtimeShadowSnapshot();
      expect(productionClosed.routeId).assertEqual('bookshelf');
      expect(shadowClosed.runtimeState.overlay).assertEqual(undefined);
      expect(shadowClosed.metrics.covered).assertEqual(2);
      expect(shadowClosed.metrics.fallback).assertEqual(0);
      expect(shadowClosed.metrics.runtimeError).assertEqual(0);
      expect(shadowClosed.metrics.mismatch).assertEqual(0);
      expect(shadowClosed.metrics.resync).assertEqual(0);
      expect(shadowClosed.metrics.lastCanonicalEvent).assertEqual('reader.directory.close');
    });

    it('records runtime effects without executing or applying them', 0, () => {
      ReaderUiStore.init();
      ReaderUiStore.setPlaybackPilotPairsForTest(false, false, false);
      ReaderUiStore.dispatch({ type: 'route-push', id: 'immersive-reading' });
      ReaderUiStore.dispatch({ type: 'reader.tts.start' });

      const production = ReaderUiStore.snapshot();
      const shadow: ReaderUIRuntimeShadowSnapshot = ReaderUiStore.runtimeShadowSnapshot();
      expect(production.activeSession).assertEqual('');
      expect(shadow.runtimeState.activeSession === undefined).assertTrue();
      expect(shadow.lastEffectTypes.join(',')).assertEqual('tts.queue.plan');
      expect(shadow.metrics.observedEffects).assertEqual(1);
      expect(shadow.metrics.executedEffects).assertEqual(0);
      expect(shadow.metrics.mismatch).assertEqual(0);
    });

    it('counts fallback and resynchronizes without replacing production state', 0, () => {
      ReaderUiStore.init();
      ReaderUiStore.dispatch({ type: 'route-push', id: 'book-detail' });

      const production = ReaderUiStore.snapshot();
      const shadow: ReaderUIRuntimeShadowSnapshot = ReaderUiStore.runtimeShadowSnapshot();
      expect(production.routeId).assertEqual('book-detail');
      expect(shadow.runtimeState.routeId).assertEqual('book-detail');
      expect(shadow.metrics.covered).assertEqual(0);
      expect(shadow.metrics.fallback).assertEqual(1);
      expect(shadow.metrics.resync).assertEqual(1);
    });

    it('doesNotTreatUnmarkedCanonicalBookOpenAsAReaderEntry', 0, () => {
      ReaderUiStore.init();
      ReaderUiStore.dispatch({ type: 'book.open', bookId: '/book/101' });

      const production = ReaderUiStore.snapshot();
      const shadow: ReaderUIRuntimeShadowSnapshot = ReaderUiStore.runtimeShadowSnapshot();
      expect(production.routeId).assertEqual('bookshelf');
      expect(production.loading).assertFalse();
      expect(shadow.metrics.covered).assertEqual(0);
      expect(shadow.metrics.fallback).assertEqual(1);
      expect(shadow.metrics.runtimeError).assertEqual(0);
      expect(shadow.metrics.executedEffects).assertEqual(0);
      expect(shadow.runtimeState.bookOpenTransaction).assertEqual(undefined);
    });

    it('mapsOnlyExplicitReaderEntryAliasToCanonicalBookOpen', 0, () => {
      ReaderUiStore.init();
      ReaderUiStore.setBookOpenPilotEnabledForTest(false);
      ReaderUiStore.dispatch({
        type: 'bookshelf-book-open',
        bookId: '/book/101',
        sourceId: 'source-1',
        sourceKind: 'remote',
        chapterIndex: 0,
        readerEntry: true,
      });

      const production = ReaderUiStore.snapshot();
      const shadow: ReaderUIRuntimeShadowSnapshot = ReaderUiStore.runtimeShadowSnapshot();
      expect(production.routeId).assertEqual('immersive-reading');
      expect(production.loading).assertTrue();
      expect(shadow.runtimeState.routeId).assertEqual('immersive-reading');
      expect(shadow.runtimeState.loading).assertTrue();
      expect(shadow.metrics.lastCanonicalEvent).assertEqual('book.open');
      expect(shadow.metrics.runtimeError).assertEqual(0);
      expect(shadow.lastEffectTypes.join(',')).assertEqual('source.detail');
      expect(shadow.metrics.covered).assertEqual(1);
      expect(shadow.metrics.fallback).assertEqual(0);
      expect(shadow.metrics.mismatch).assertEqual(0);
    });

    it('keepsBookDetailReuseOfBookshelfAliasOnNativeFallback', 0, () => {
      ReaderUiStore.init();
      ReaderUiStore.dispatch({ type: 'route-push', id: 'book-detail' });
      ReaderUiStore.dispatch({
        // Even a stale marker must not turn a detail context into a shadow
        // reader transaction. The native legacy alias remains its own owner.
        type: 'bookshelf-book-open', bookId: '/book/101', sourceId: 'source-1',
        sourceKind: 'remote', readerEntry: true,
      });

      const production = ReaderUiStore.snapshot();
      const shadow: ReaderUIRuntimeShadowSnapshot = ReaderUiStore.runtimeShadowSnapshot();
      expect(production.routeId).assertEqual('immersive-reading');
      expect(shadow.runtimeState.routeId).assertEqual('immersive-reading');
      expect(shadow.runtimeState.bookOpenTransaction).assertEqual(undefined);
      expect(shadow.metrics.covered).assertEqual(0);
      expect(shadow.metrics.fallback).assertEqual(2);
      expect(shadow.lastEffectTypes.length).assertEqual(0);
    });

    it('rejectsSourceKindThatDoesNotMatchTheDirectReaderEntry', 0, () => {
      ReaderUiStore.init();
      ReaderUiStore.dispatch({
        type: 'bookshelf-book-open', bookId: 'local-1', sourceId: 'local',
        sourceKind: 'remote', readerEntry: true,
      });

      const shadow: ReaderUIRuntimeShadowSnapshot = ReaderUiStore.runtimeShadowSnapshot();
      expect(shadow.runtimeState.bookOpenTransaction).assertEqual(undefined);
      expect(shadow.metrics.covered).assertEqual(0);
      expect(shadow.metrics.fallback).assertEqual(1);
      expect(shadow.metrics.lastCanonicalEvent).assertEqual('');
    });

    it('uses the generated runtime table for every covered event', 0, () => {
      const covered = ReaderUIRuntimeShadowCoordinator.coveredEvents();
      expect(covered.length).assertEqual(READER_UI_SHADOW_COVERED_EVENTS.length);
      expect(covered.join(',')).assertEqual(READER_UI_SHADOW_COVERED_EVENTS.join(','));
      for (let index = 0; index < covered.length; index += 1) {
        expect(GENERATED_RUNTIME_ACTIONS[covered[index]] !== undefined).assertTrue();
      }
    });
  });
}
