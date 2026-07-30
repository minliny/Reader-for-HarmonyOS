// ReaderContinueRecovery.test — regression coverage for the real Core-backed
// direct continue-reading path. These are DTO/selection/reducer tests only;
// they intentionally do not pretend to replace a signed-device Core probe.
import { describe, it, expect } from '@ohos/hypium';
import type { JsonObject } from '../main/ets/bridge/core/sdk/reader_core';
import { ReaderEffects } from '../main/ets/ui/store/ReaderEffects';
import { ReaderReducer } from '../main/ets/ui/store/ReaderReducer';
import { ReaderUiStore } from '../main/ets/ui/store/ReaderUiStore';
import { DemoUiState } from '../main/ets/ui/fixtures/DemoUiState';
import {
  CANONICAL_RESOLVER_VERSION,
  ChapterTocEntry,
} from '../main/ets/ui/store/ReaderUiState';

function localSparseToc(): ChapterTocEntry[] {
  return [
    { index: 4, title: '第一章', chapterId: 'local-book#4' },
    { index: 9, title: '第二章', chapterId: 'local-book#9' },
  ];
}

function durableProgress(chapterIndex: number, chapterOffset: number, chapterProgress: number): JsonObject {
  return JSON.parse('{' +
    '"found":true,' +
    '"progress":{' +
    '"bookId":"local-book",' +
    '"sourceId":"local",' +
    `"chapterIndex":${chapterIndex},` +
    `"chapterOffset":${chapterOffset},` +
    `"chapterProgress":${chapterProgress},` +
    '"locationRevision":"durable-location-v1"' +
    '}' +
    '}') as JsonObject;
}

export default function ReaderContinueRecoveryTests(): void {
  describe('Reader continue recovery', () => {
    it('resolvesSparseCoreChapterIdentityAndRestoresExactDurableAnchor', 0, () => {
      const persisted = ReaderEffects.parsePersistedReadingProgress(
        durableProgress(9, 384, 0.63), 'local-book', 'local',
      );
      expect(persisted !== null).assertTrue();
      if (persisted === null) return;

      const selected = ReaderEffects.localPersistedProgressTocEntry(localSparseToc(), persisted);
      // `9` is Core chapter identity, not local TOC position `1`.
      expect(selected.index).assertEqual(9);

      let state = ReaderReducer.reduce(DemoUiState.initial(), {
        type: 'route-push', id: 'immersive-reading',
      });
      state = ReaderReducer.reduce(state, {
        type: 'book-detail-success',
        book: {
          bookId: 'local-book',
          sourceId: 'local',
          title: '本地书',
          author: '作者',
          summary: '',
          sourceName: '本地导入',
          sourceUrl: '',
          latestChapter: '第二章',
          chapterListUrl: 'local-book',
        },
      });
      state = ReaderReducer.reduce(state, {
        type: 'chapter-success',
        chapterParagraphs: ['第二章正文'],
        chapterTitle: selected.title,
        bookId: 'local-book',
        sourceId: 'local',
        chapterIndex: selected.index,
      });
      state = ReaderReducer.reduce(state, {
        type: 'reader-location-resolved',
        canonicalReaderLocation: {
          bookId: 'local-book',
          chapterIndex: selected.index,
          chapterOffset: persisted.chapterOffset,
          chapterProgress: persisted.chapterProgress,
          locationRevision: persisted.locationRevision,
          resolverVersion: CANONICAL_RESOLVER_VERSION,
        },
      });
      expect(state.canonicalReaderLocation !== null).assertTrue();
      if (state.canonicalReaderLocation !== null) {
        expect(state.canonicalReaderLocation.chapterIndex).assertEqual(9);
        expect(state.canonicalReaderLocation.chapterOffset).assertEqual(384);
        expect(state.canonicalReaderLocation.chapterProgress).assertEqual(0.63);
        expect(state.canonicalReaderLocation.locationRevision).assertEqual('durable-location-v1');
      }
    });

    it('fallsBackToFirstReadableEntryForNoInvalidOrStaleProgress', 0, () => {
      const noProgress = ReaderEffects.parsePersistedReadingProgress(
        JSON.parse('{"found":false}') as JsonObject, 'local-book', 'local',
      );
      const invalidProgress = ReaderEffects.parsePersistedReadingProgress(
        durableProgress(9, -1, 0.63), 'local-book', 'local',
      );
      const staleProgress = ReaderEffects.parsePersistedReadingProgress(
        durableProgress(99, 384, 0.63), 'local-book', 'local',
      );
      expect(noProgress).assertEqual(null);
      expect(invalidProgress).assertEqual(null);
      expect(staleProgress !== null).assertTrue();
      expect(ReaderEffects.localPersistedProgressTocEntry(localSparseToc(), noProgress).index).assertEqual(4);
      expect(ReaderEffects.localPersistedProgressTocEntry(localSparseToc(), invalidProgress).index).assertEqual(4);
      if (staleProgress !== null) {
        expect(ReaderEffects.localPersistedProgressTocEntry(localSparseToc(), staleProgress).index).assertEqual(4);
      }

      const remoteToc = JSON.parse('{' +
        '"toc":[' +
        '{"index":4,"title":"不可读目录项"},' +
        '{"index":9,"title":"第一可读章","url":"/chapter/9"},' +
        '{"index":12,"title":"第二可读章","url":"/chapter/12"}' +
        ']}') as JsonObject;
      const rawToc = remoteToc['toc'] as Object[] as JsonObject[];
      expect(ReaderEffects.persistedProgressTocPosition(rawToc, noProgress)).assertEqual(1);
      if (staleProgress !== null) {
        expect(ReaderEffects.persistedProgressTocPosition(rawToc, staleProgress)).assertEqual(1);
      }

      const remoteProgress = ReaderEffects.parsePersistedReadingProgress(
        JSON.parse('{"found":true,"progress":{"bookId":"remote-book","sourceId":"remote-source",' +
          '"chapterIndex":12,"chapterOffset":512,"chapterProgress":0.41,' +
          '"locationRevision":"remote-location-v1"}}') as JsonObject,
        'remote-book', 'remote-source',
      );
      expect(remoteProgress !== null).assertTrue();
      if (remoteProgress !== null) {
        // The shared remote Detail/Continue path must also select the Core
        // identity rather than the raw array index and retain its anchor.
        expect(ReaderEffects.persistedProgressTocPosition(rawToc, remoteProgress)).assertEqual(2);
        expect(remoteProgress.chapterOffset).assertEqual(512);
        expect(remoteProgress.chapterProgress).assertEqual(0.41);
      }
    });

    it('sharedDirectContinueDispatchBypassesBookOpenPilot', 0, () => {
      ReaderUiStore.init();
      ReaderUiStore.setBookOpenPilotEnabledForTest(true);

      // Both ContinueReadingCard and the detail actions call this helper. It
      // enters immersive Reader immediately, then lets ReaderEffects read the
      // durable Core row instead of handing chapterIndex=0 to the Pilot.
      ReaderUiStore.dispatchContinueReading('local-book', 'local');

      const state = ReaderUiStore.snapshot();
      expect(state.routeId).assertEqual('immersive-reading');
      expect(state.loading).assertFalse();
      expect(ReaderUiStore.runtimeShadowSnapshot().runtimeState.bookOpenTransaction === undefined).assertTrue();
    });

    it('reportsTheZeroAnchorOfANewChapterBeforeContinueCanReadStaleCoreProgress', 0, () => {
      ReaderUiStore.init();
      ReaderUiStore.setBookOpenPilotEnabledForTest(false);
      ReaderUiStore.dispatch({ type: 'route-push', id: 'immersive-reading' });
      ReaderUiStore.dispatch({
        type: 'book-detail-success',
        book: {
          bookId: 'local-book',
          sourceId: 'local',
          title: '本地书',
          author: '作者',
          summary: '',
          sourceName: '本地导入',
          sourceUrl: '',
          latestChapter: '第二章',
          chapterListUrl: 'local-book',
        },
      });
      ReaderUiStore.dispatch({
        type: 'chapter-success',
        chapterParagraphs: ['第二章正文'],
        chapterTitle: '第二章',
        bookId: 'local-book',
        sourceId: 'local',
        chapterIndex: 9,
      });

      // `chapter-success` initializes a new chapter at 0/0. It is still a
      // real new Core location, so the surface must emit an anchor instead of
      // treating the matching numeric values as a duplicate.
      AppStorage.setOrCreate<string>('reader.lastOp', 'before-anchor');
      ReaderUiStore.reportReadingAnchor(
        { bookId: 'local-book', sourceId: 'local', chapterIndex: 9 }, 0, 0,
      );
      expect(AppStorage.get<string>('reader.lastOp')).assertEqual('reader-location-anchor');
    });
  });
}
