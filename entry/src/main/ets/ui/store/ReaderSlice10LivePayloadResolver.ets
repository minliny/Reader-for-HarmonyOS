// ReaderSlice10LivePayloadResolver — the only UI-side constructor for the
// four Slice 10 cache/undo events.
//
// Generated ViewState payloads are review fixtures, not runtime identity.
// Every effectful event below is rebuilt from the current ReaderUiState so a
// delayed tap cannot operate on a fixture book, a stale chapter, or a sample
// undo token.
import type { ReaderUIJSONPayload } from 'reader_ui_runtime';
import { ReaderUiState, UiEvent } from './ReaderUiState';

export type ReaderCachePrefetchRange = 'current' | 'next';

interface ReaderSlice10LiveBookKey {
  sourceId: string;
  bookId: string;
}

export class ReaderSlice10LivePayloadResolver {
  static cacheBookStatusEvent(state: ReaderUiState): UiEvent | null {
    if (state.coreSlice10Loading) return null;
    const payload = ReaderSlice10LivePayloadResolver.cacheBookStatusPayload(state);
    if (payload === null) return null;
    return { type: 'reader-bookCache-open', readerUIJSONPayload: payload };
  }

  static cacheBookPrefetchEvent(state: ReaderUiState,
    range: ReaderCachePrefetchRange = 'next'): UiEvent | null {
    if (state.coreSlice10Loading) return null;
    const payload = ReaderSlice10LivePayloadResolver.cacheBookPrefetchPayload(state, range);
    if (payload === null) return null;
    return { type: 'download-task-retry', readerUIJSONPayload: payload };
  }

  static cacheClearEvent(state: ReaderUiState, scope: string = 'book'): UiEvent | null {
    if (state.coreSlice10Loading) return null;
    const payload = ReaderSlice10LivePayloadResolver.cacheClearPayload(state, scope);
    if (payload === null) return null;
    return { type: 'settings-cache-clear', readerUIJSONPayload: payload };
  }

  static replaceUndoEvent(state: ReaderUiState): UiEvent | null {
    if (state.coreSlice10Loading) return null;
    const token = state.lastUndoToken;
    if (token === null || typeof token !== 'object' || Array.isArray(token) ||
      Object.keys(token).length === 0) return null;
    const payload: ReaderUIJSONPayload = {};
    payload['undoToken'] = token;
    return { type: 'reader-replace-undo', readerUIJSONPayload: payload };
  }

  static cacheBookStatusPayload(state: ReaderUiState): ReaderUIJSONPayload | null {
    const key = ReaderSlice10LivePayloadResolver.liveBookKey(state);
    if (key === null) return null;
    return ReaderSlice10LivePayloadResolver.bookPayload(key);
  }

  static cacheBookPrefetchPayload(state: ReaderUiState,
    range: ReaderCachePrefetchRange): ReaderUIJSONPayload | null {
    const key = ReaderSlice10LivePayloadResolver.liveBookKey(state);
    if (key === null) return null;
    const chapterIndex = ReaderSlice10LivePayloadResolver.liveChapterIndex(state, key);
    if (chapterIndex < 0 || state.chapterToc.length === 0 || chapterIndex >= state.chapterToc.length) {
      return null;
    }
    let startInclusive = chapterIndex;
    let endExclusive = chapterIndex + 1;
    if (range === 'next') {
      startInclusive = chapterIndex + 1;
      endExclusive = Math.min(state.chapterToc.length, startInclusive + 10);
      if (startInclusive >= endExclusive) return null;
    }
    const payload = ReaderSlice10LivePayloadResolver.bookPayload(key);
    payload['chapterRange'] = [startInclusive, endExclusive];
    return payload;
  }

  static cacheClearPayload(state: ReaderUiState, scope: string): ReaderUIJSONPayload | null {
    const payload: ReaderUIJSONPayload = {};
    if (scope === 'cache') {
      payload['scope'] = 'cache';
      return payload;
    }
    if (scope !== 'book') return null;
    const key = ReaderSlice10LivePayloadResolver.liveBookKey(state);
    if (key === null) return null;
    payload['scope'] = 'book';
    payload['sourceId'] = key.sourceId;
    payload['bookId'] = key.bookId;
    return payload;
  }

  private static liveBookKey(state: ReaderUiState): ReaderSlice10LiveBookKey | null {
    const book = state.currentBook;
    if (book === null || book.sourceId === undefined ||
      book.sourceId.trim().length === 0 || book.bookId.trim().length === 0) return null;
    const identity = state.activeReaderContentIdentity;
    if (identity !== null && (identity.sourceId !== book.sourceId || identity.bookId !== book.bookId)) {
      // A body switch is still in flight. Refuse to attach the old chapter
      // range to the newly visible book key.
      return null;
    }
    return { sourceId: book.sourceId, bookId: book.bookId };
  }

  private static liveChapterIndex(state: ReaderUiState, key: ReaderSlice10LiveBookKey): number {
    const identity = state.activeReaderContentIdentity;
    if (identity !== null && identity.sourceId === key.sourceId && identity.bookId === key.bookId &&
      Number.isSafeInteger(identity.chapterIndex) && identity.chapterIndex >= 0) {
      return identity.chapterIndex;
    }
    const location = state.canonicalReaderLocation;
    if (location !== null && location.bookId === key.bookId &&
      Number.isSafeInteger(location.chapterIndex) && location.chapterIndex >= 0) {
      return location.chapterIndex;
    }
    return -1;
  }

  private static bookPayload(key: ReaderSlice10LiveBookKey): ReaderUIJSONPayload {
    const payload: ReaderUIJSONPayload = {};
    payload['sourceId'] = key.sourceId;
    payload['bookId'] = key.bookId;
    return payload;
  }
}
