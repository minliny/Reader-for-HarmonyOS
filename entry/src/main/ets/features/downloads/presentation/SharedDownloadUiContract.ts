import type { SharedDownloadFilters } from './SharedDownloadProjection';
import type { SharedDownloadBookAction, SharedDownloadSnapshot } from '../application/SharedDownloadHost';
import type { SharedDownloadExpectedChapter } from '../application/SharedDownloadCoordinator';

export type SharedDownloadUiAction = SharedDownloadBookAction | 'cleanup' | 'configureStorage';

export interface SharedDownloadUiBookTarget {
  sourceId: string;
  bookId: string;
  chapterIndices?: number[];
  expectedChapters?: SharedDownloadExpectedChapter[];
}

/** Presentation intent. Queue, retention, files and shelf remain in their owners. */
export interface SharedDownloadUiIntent {
  action: SharedDownloadUiAction;
  scope: 'books' | 'chapters' | 'storage';
  books: SharedDownloadUiBookTarget[];
  // A storage selector sends only the changed field; the current policy supplies the other.
  cacheLimitMb?: number;
  cleanupAfterDays?: number;
}

export interface SharedDownloadViewState extends SharedDownloadFilters {
  listScroll?: number;
  chapterScroll?: number;
  detailKey?: string;
}

export type SharedDownloadOpeningIntent =
  { readonly kind: 'fresh' | 'readerRequest'; readonly detailKey: string } |
  { readonly kind: 'resume' };

export type SharedDownloadReadingControl = 'title' | 'action';

export interface SharedDownloadReadingFocus {
  readonly bookKey: string;
  readonly chapterKey: string;
  readonly chapterId: string;
  readonly control: SharedDownloadReadingControl;
}

export interface SharedDownloadReturnState {
  view: SharedDownloadViewState;
  readingFocus?: SharedDownloadReadingFocus;
  snapshot?: SharedDownloadSnapshot;
  membershipRevision: number;
  storageCleanupRevision: number;
}
