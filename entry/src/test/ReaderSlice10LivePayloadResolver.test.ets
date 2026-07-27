import { describe, it, expect } from '@ohos/hypium';
import type { ReaderUIJSONPayload } from 'reader_ui_runtime';
import { DemoUiState } from '../main/ets/ui/fixtures/DemoUiState';
import { ReaderSlice10LivePayloadResolver } from '../main/ets/ui/store/ReaderSlice10LivePayloadResolver';
import { ReaderUiState, UiEvent } from '../main/ets/ui/store/ReaderUiState';
import { ReaderReducer } from '../main/ets/ui/store/ReaderReducer';

function liveReaderState(): ReaderUiState {
  const state = DemoUiState.initial();
  state.currentBook = {
    sourceId: 'source-live',
    bookId: 'book-live',
    title: 'Live',
    author: 'Reader',
    summary: '',
    sourceName: 'Live source',
    sourceUrl: 'https://source.test',
    latestChapter: '',
    chapterListUrl: 'https://source.test/toc',
  };
  state.activeReaderContentIdentity = {
    sourceId: 'source-live', bookId: 'book-live', chapterIndex: 2,
  };
  state.chapterToc = [
    { index: 0, title: '0', chapterId: 'c0' },
    { index: 1, title: '1', chapterId: 'c1' },
    { index: 2, title: '2', chapterId: 'c2' },
    { index: 3, title: '3', chapterId: 'c3' },
    { index: 4, title: '4', chapterId: 'c4' },
  ];
  return state;
}

export default function ReaderSlice10LivePayloadResolverTests(): void {
  describe('ReaderSlice10LivePayloadResolver', () => {
    it('buildsStatusPrefetchAndBookClearFromLiveReaderIdentity', 0, () => {
      const state = liveReaderState();
      const status = ReaderSlice10LivePayloadResolver.cacheBookStatusEvent(state)!;
      expect(status.readerUIJSONPayload!['sourceId'] as string).assertEqual('source-live');
      expect(status.readerUIJSONPayload!['bookId'] as string).assertEqual('book-live');

      const current = ReaderSlice10LivePayloadResolver.cacheBookPrefetchEvent(state, 'current')!;
      const currentRange = current.readerUIJSONPayload!['chapterRange'] as number[];
      expect(currentRange[0]).assertEqual(2);
      expect(currentRange[1]).assertEqual(3);

      const next = ReaderSlice10LivePayloadResolver.cacheBookPrefetchEvent(state, 'next')!;
      const nextRange = next.readerUIJSONPayload!['chapterRange'] as number[];
      expect(nextRange[0]).assertEqual(3);
      expect(nextRange[1]).assertEqual(5);

      const clear = ReaderSlice10LivePayloadResolver.cacheClearEvent(state, 'book')!;
      expect(clear.readerUIJSONPayload!['scope'] as string).assertEqual('book');
      expect(clear.readerUIJSONPayload!['sourceId'] as string).assertEqual('source-live');
      expect(clear.readerUIJSONPayload!['bookId'] as string).assertEqual('book-live');
    });

    it('rejectsMissingOrMismatchedLiveReaderContext', 0, () => {
      const missing = DemoUiState.initial();
      expect(ReaderSlice10LivePayloadResolver.cacheBookStatusEvent(missing) === null).assertTrue();

      const mismatched = liveReaderState();
      mismatched.activeReaderContentIdentity = {
        sourceId: 'source-old', bookId: 'book-old', chapterIndex: 2,
      };
      expect(ReaderSlice10LivePayloadResolver.cacheBookPrefetchEvent(mismatched, 'next') === null).assertTrue();
    });

    it('usesOnlyTheStoreIssuedUndoToken', 0, () => {
      const state = liveReaderState();
      expect(ReaderSlice10LivePayloadResolver.replaceUndoEvent(state) === null).assertTrue();
      const token = JSON.parse('{"schemaVersion":1,"transactionId":"live-token"}') as ReaderUIJSONPayload;
      state.lastUndoToken = token;
      const event: UiEvent = ReaderSlice10LivePayloadResolver.replaceUndoEvent(state)!;
      expect(event.readerUIJSONPayload!['undoToken'] === token).assertTrue();
    });

    it('reducesLoadingResultErrorAndConsumesTheUndoTokenOnSuccess', 0, () => {
      let state = DemoUiState.initial();
      state = ReaderReducer.reduce(state, {
        type: 'core-slice10-start', coreSlice10Method: 'cache.book.status',
      });
      expect(state.coreSlice10Loading).assertTrue();
      expect(state.coreSlice10Method).assertEqual('cache.book.status');

      const status = JSON.parse('{"sourceId":"source-live","cachedCount":2}') as ReaderUIJSONPayload;
      state = ReaderReducer.reduce(state, {
        type: 'core-slice10-succeeded', coreSlice10Method: 'cache.book.status',
        coreSlice10Result: status,
      });
      expect(state.coreSlice10Loading).assertFalse();
      expect(state.coreSlice10Result === status).assertTrue();

      state = ReaderReducer.reduce(state, {
        type: 'core-slice10-failed', coreSlice10Method: 'cache.clear',
        coreSlice10Error: 'clear failed',
        error: { code: 'CORE_SLICE10_COMMAND_FAILED', message: 'clear failed', retryable: true },
      });
      expect(state.coreSlice10Error).assertEqual('clear failed');
      expect(state.error!.code).assertEqual('CORE_SLICE10_COMMAND_FAILED');

      const token = JSON.parse('{"schemaVersion":1,"transactionId":"live-token"}') as ReaderUIJSONPayload;
      state = ReaderReducer.reduce(state, {
        type: 'core-slice10-undo-token-captured', lastUndoToken: token,
      });
      expect(state.lastUndoToken === token).assertTrue();
      state = ReaderReducer.reduce(state, {
        type: 'core-slice10-succeeded', coreSlice10Method: 'replace.undo',
        coreSlice10Result: JSON.parse('{"changed":true}') as ReaderUIJSONPayload,
      });
      expect(state.lastUndoToken === null).assertTrue();
    });
  });
}
