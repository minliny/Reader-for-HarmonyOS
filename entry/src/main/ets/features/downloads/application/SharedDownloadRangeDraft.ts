import type { SharedDownloadExpectedChapter } from './SharedDownloadCoordinator';
import type { DownloadBookView } from '../presentation/SharedDownloadProjection';

export interface SharedDownloadRangeDraft {
  readonly bookKey: string;
  readonly choice: string;
  readonly start: string;
  readonly end: string;
  readonly revision: number;
  readonly catalog?: SharedDownloadExpectedChapter[];
  readonly catalogChanged: boolean;
}

export function openSharedDownloadRangeDraft(): SharedDownloadRangeDraft {
  return { bookKey: '', choice: 'all', start: '', end: '', revision: 0, catalogChanged: false };
}

export function resetSharedDownloadRangeDraft(draft: SharedDownloadRangeDraft, bookKey: string,
  choice: string = draft.choice): SharedDownloadRangeDraft {
  return { bookKey, choice, start: '', end: '', revision: draft.revision + 1, catalogChanged: false };
}

export function chooseSharedDownloadRange(draft: SharedDownloadRangeDraft, choice: string): SharedDownloadRangeDraft {
  return choice === draft.choice ? draft : { ...draft, choice, revision: draft.revision + 1 };
}

function matchesCatalog(book: DownloadBookView, catalog: SharedDownloadExpectedChapter[]): boolean {
  let ordinal = 0;
  for (const chapter of book.chapters) {
    if (!chapter.navigable) continue;
    const expected = catalog[ordinal++];
    if (expected === undefined || chapter.index !== expected.chapterIndex || chapter.chapterId !== expected.chapterId) return false;
  }
  return ordinal === catalog.length;
}

/** A directory replacement can refresh an untouched draft. Once editing
 * starts, only an explicit reset can replace the directory the user saw. */
export function observeSharedDownloadRangeCatalog(draft: SharedDownloadRangeDraft,
  book: DownloadBookView | undefined): SharedDownloadRangeDraft {
  if (draft.catalogChanged || book?.projectionStatus !== 'ready' || (draft.catalog !== undefined && matchesCatalog(book, draft.catalog))) return draft;
  if (draft.start.length > 0 || draft.end.length > 0) return { ...draft, catalogChanged: true };
  if (draft.choice !== 'custom') return draft;
  const catalog = book.chapters.filter(chapter => chapter.navigable).map((chapter): SharedDownloadExpectedChapter =>
    ({ chapterIndex: chapter.index, chapterId: chapter.chapterId }));
  return { ...draft, catalog };
}

export function editSharedDownloadRangeBound(draft: SharedDownloadRangeDraft, revision: number,
  start: boolean, value: string): SharedDownloadRangeDraft {
  if (draft.choice !== 'custom' || revision !== draft.revision || draft.catalog === undefined || draft.catalogChanged ||
    (start ? draft.start : draft.end) === value) return draft;
  return start ? { ...draft, start: value } : { ...draft, end: value };
}

export function sharedDownloadCustomRangeProof(draft: SharedDownloadRangeDraft,
  book: DownloadBookView): SharedDownloadExpectedChapter[] | undefined {
  const catalog = draft.catalog;
  if (draft.choice !== 'custom' || book.key !== draft.bookKey || book.projectionStatus !== 'ready' ||
    catalog === undefined || draft.catalogChanged) return undefined;
  const start = Number(draft.start);
  const end = Number(draft.end);
  if (draft.start.length === 0 || draft.end.length === 0 || !Number.isInteger(start) || !Number.isInteger(end) ||
    start < 1 || end < start || end > catalog.length || !matchesCatalog(book, catalog)) return undefined;
  return catalog.slice(start - 1, end).map((chapter): SharedDownloadExpectedChapter =>
    ({ chapterIndex: chapter.chapterIndex, chapterId: chapter.chapterId }));
}
