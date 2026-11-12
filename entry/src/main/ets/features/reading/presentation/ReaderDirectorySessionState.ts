import type { ReaderDirectoryViewportAnchor } from './ReaderDirectoryViewport';

/** One book-scoped UI session owns both folds and viewport; neither is progress. */
export interface ReaderDirectoryBookState {
  revision?: string;
  ids: Set<string>;
  anchor?: ReaderDirectoryViewportAnchor;
}
const books: Map<string, ReaderDirectoryBookState> = new Map<string, ReaderDirectoryBookState>();

export function readerDirectoryBookState(scope: string, create: boolean = false): ReaderDirectoryBookState | undefined {
  let state = books.get(scope);
  if (state === undefined && !create) return undefined;
  if (state === undefined) state = { ids: new Set<string>() };
  books.delete(scope);
  books.set(scope, state);
  if (books.size > 8) books.delete(books.keys().next().value as string);
  return state;
}
export function clearReaderDirectoryBookStates(): void { books.clear(); }
