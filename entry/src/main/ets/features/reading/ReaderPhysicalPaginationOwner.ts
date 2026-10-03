import { ReadingPaginationIndex, ReadingPaginationPrefix,
  type ReadingPaginationKey, type ReadingPaginationPrefixObservation } from './ReadingPaginationIndex.ts';

export interface ReaderPhysicalPageReceipt {
  readonly startScalar: number;
  readonly endScalar: number;
  paginationKey: ReadingPaginationKey | undefined;
  paginationObservation: ReadingPaginationPrefixObservation | undefined;
}

export interface ReaderPhysicalPageAdmission {
  readonly key: ReadingPaginationKey;
  readonly requestedAnchor: number;
  readonly chapterStartRequest: number | undefined;
  readonly draft: ReadingPaginationPrefix | undefined;
  readonly previousChapterMeasurement: boolean;
  readonly lastVisibleScalar: number;
  readonly contentScalarLength: number;
  readonly partialDocument: boolean;
}

export interface ReaderPhysicalPageAdmissionResult {
  readonly draft: ReadingPaginationPrefix | undefined;
  readonly completed: boolean;
}

/** Owns bounded physical-page packing state and admission of measured facts.
 * Uses the existing exact pagination index/prefix implementation. Never infers
 * boundaries from history, a partial document, or an unmeasured chapter head. */
export class ReaderPhysicalPaginationOwner<TFragment> {
  readonly index: ReadingPaginationIndex = new ReadingPaginationIndex();
  draft: ReadingPaginationPrefix | undefined = undefined;
  requestedAnchor: number = -1;
  fragments: TFragment[] = [];
  startScalar: number = -1;
  endScalar: number = -1;
  height: number = 0;

  canFit(height: number, paragraphSpace: number, capacity: number): boolean {
    return this.fragments.length === 0 || this.height + paragraphSpace + height <= capacity;
  }

  resetPage(): void {
    this.fragments = [];
    this.startScalar = -1;
    this.endScalar = -1;
    this.height = 0;
  }

  resetDraft(): void {
    this.draft = undefined;
    this.requestedAnchor = -1;
  }

  observe(page: ReaderPhysicalPageReceipt, input: ReaderPhysicalPageAdmission): ReaderPhysicalPageAdmissionResult {
    const key = input.key;
    if (input.chapterStartRequest === undefined || input.requestedAnchor < 0) {
      return { draft: undefined, completed: true };
    }
    const observation: ReadingPaginationPrefixObservation = {
      requestScalar: input.requestedAnchor, startScalar: page.startScalar, endScalarExclusive: page.endScalar,
    };
    let draft = input.draft;
    if (draft === undefined || !draft.matches(key) || !draft.admit(observation)) {
      if (input.previousChapterMeasurement && draft !== undefined && draft.matches(key))
        throw new Error('PAGINATION_PREVIOUS_PAGE_NOT_ADJACENT');
      draft = new ReadingPaginationPrefix(key, observation);
    }
    if (!this.sameKey(draft.key, key)) return { draft, completed: false };
    if (page.paginationObservation !== undefined) {
      const original = page.paginationObservation;
      if (page.paginationKey === undefined || !this.sameKey(page.paginationKey, key) ||
        original.requestScalar !== observation.requestScalar || original.startScalar !== observation.startScalar ||
        original.endScalarExclusive !== observation.endScalarExclusive)
        throw new Error('PAGINATION_PAGE_OBSERVATION_CHANGED');
    } else {
      page.paginationKey = draft.key;
      page.paginationObservation = observation;
    }
    if (page.endScalar <= input.lastVisibleScalar || input.partialDocument ||
      !draft.isCanonicalPrefixForChapterStart(input.chapterStartRequest)) return { draft, completed: false };
    this.index.recordChapter({ key, contentScalarLength: input.contentScalarLength,
      pageStartScalars: draft.pageStartScalars() });
    return { draft: undefined, completed: true };
  }

  sameKey(left: ReadingPaginationKey, right: ReadingPaginationKey): boolean {
    return left.sourceId === right.sourceId && left.bookId === right.bookId &&
      left.chapterIndex === right.chapterIndex && left.layoutSignature === right.layoutSignature &&
      left.contentVersion === right.contentVersion;
  }
}
