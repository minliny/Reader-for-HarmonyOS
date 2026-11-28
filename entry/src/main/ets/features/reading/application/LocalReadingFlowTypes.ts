import type { ReaderDirectoryTargetProof } from './ReaderDirectoryTargetProof.ts';
import type { RemoteReadingPositionScope } from './RemoteReadingPositionMigration';

/**
 * Page-facing, materialized local-book TOC entry. The Core-owned local URL
 * and rule variables are deliberately not exposed because selecting a local
 * chapter is solely by its stable zero-based index.
 */
export type LocalReadingTocEntry = {
  index: number;
  title: string;
  displayTitle?: string;
  isVip?: boolean;
  isPay?: boolean;
  contextTitle?: string;
  /** 1-based navigation depth when the local book has a structured TOC. */
  level?: number;
  downloadState: LocalReadingDownloadState;
  /** Remote volume headings retain their index but cannot navigate/download/bookmark. */
  navigable?: boolean;
  // `undefined` means the bookmark projection has not been admitted yet;
  // an empty array is the Core-confirmed "no bookmarks" result.
  bookmarks?: LocalReadingBookmark[];
};

export type LocalReadingDownloadState =
  'unknown' | 'missing' | 'queued' | 'paused' | 'inProgress' | 'cached' | 'completed' | 'failed' | 'cancelled';

export type LocalReadingBookmark = {
  positionScope?: RemoteReadingPositionScope;
  time: number;
  chapterIndex: number;
  chapterOffset: number;
  chapterTitle: string;
  content: string;
  /** Original text, separate from the user's note in content. */
  bookText?: string;
};

export type LocalReadingChapterStartBookmarkInput = {
  positionScope?: RemoteReadingPositionScope;
  bookName: string;
  bookAuthor: string;
  chapterIndex: number;
  chapterTitle: string;
};

export type LocalReadingPositionBookmarkInput = LocalReadingChapterStartBookmarkInput & {
  chapterOffset: number;
  bookText?: string;
};

export type LocalReadingToc = {
  bookId: string;
  revision?: string;
  entries: LocalReadingTocEntry[];
};

/**
 * The actual body returned from Core materialized chapter storage. A page can
 * lay this out, but it never receives the Core result envelope.
 */
export type LocalReadingChapter = {
  bodyVersion?: string;
  processingVersion?: string;
  bookId: string;
  chapterIndex: number;
  chapterTitle: string;
  content: string;
  blocks?: unknown[];
};

/**
 * One half-open Unicode-scalar interval in Core's exact processed chapter
 * output. These are content metrics, not ArkUI layout/page measurements.
 */
export type LocalReadingChapterContentMetric = {
  chapterIndex: number;
  scalarLength: number;
  cumulativeStart: number;
  cumulativeEnd: number;
};

/** Core-owned whole-book scalar index for a fully materialized local book. */
export type LocalReadingContentMetrics = {
  bookId: string;
  totalScalarLength: number;
  chapters: LocalReadingChapterContentMetric[];
};

/**
 * The Core-owned current reading position for one local book. `chapterOffset`
 * is deliberately preserved as the Core protocol name; the reading surface
 * supplies its Unicode-scalar measurement to this field rather than this
 * gateway inventing a second position model.
 */
export type LocalReadingProgress = {
  progressRevision?: string;
  bodyVersion?: string;
  processingVersion?: string;
  bookId: string;
  chapterIndex: number;
  chapterOffset: number;
  chapterProgress: number;
  updatedAt: number;
  locationRevision?: string;
};

export type LocalReadingProgressState =
  | { kind: 'missing'; progressRevision?: string }
  | { kind: 'restored'; progress: LocalReadingProgress;
      progressRevision?: string;
      /** In-process displayed intent only; locationRevision/updatedAt are not a durable receipt. */
      presentationPending?: boolean };

export type LocalReadingProgressUpdate = {
  deviceId?: string;
  directoryTargetProof?: ReaderDirectoryTargetProof;
  expectedProgressRevision?: string;
  expectedBodyVersion?: string;
  expectedProcessingVersion?: string;
  chapterIndex: number;
  chapterOffset: number;
  chapterProgress: number;
  locationRevision?: string;
};

/** Host-measured layout facts accepted by Core's canonical location resolver. */
export type LocalReadingLayout = {
  viewportWidth: number;
  viewportHeight: number;
  fontScale: number;
  lineHeight?: number;
  pageIndex?: number;
  pageCount?: number;
};

export type LocalReadingRetainedProgressReceipt = { progressRevision?: string; updatedAt: number; locationRevision?: string; };

/** One Unicode-scalar anchor emitted by the local pagination/measurement layer. */
export type LocalReadingAnchor = {
  deviceId?: string;
  /** Host-only admission: renewing a retained visit cannot move a newer receipt. */
  retainedProgressReceipt?: LocalReadingRetainedProgressReceipt;
  directoryTargetProof?: ReaderDirectoryTargetProof;
  bodyVersion?: string;
  processingVersion?: string;
  chapterIndex: number;
  chapterOffset: number;
  chapterProgress: number;
};

/** Core's layout-independent reading identity, exposed without a protocol envelope. */
export type LocalReadingResolvedLocation = {
  bookId: string;
  chapterIndex: number;
  chapterOffset: number;
  chapterProgress: number;
  locationRevision: string;
  resolverVersion: string;
  reflow: {
    strategy: 'offsetAnchor';
    primaryAnchor: 'chapterOffset';
    fallbackAnchor: 'chapterProgress';
    layoutIndependent: true;
  };
};

export type LocalReadingAtomicResolution = {
  chapterTitle?: string;
  anchor: LocalReadingAnchor;
  layout: LocalReadingLayout;
};

export const LOCAL_SOURCE_ID = 'local';
