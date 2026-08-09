/**
 * Pure, feature-local index of measured physical reading pages.
 *
 * Reader Core remains the durable owner of the current Unicode-scalar anchor.
 * This index answers layout-dependent page-boundary questions only. In
 * particular, an in-session back stack is never used as pagination truth.
 */

/** Every layout fact that can change the physical page boundaries. */
export type ReadingPaginationLayoutFacts = {
  readonly deviceForm: 'phone' | 'tablet';
  readonly viewportWidth: number;
  readonly viewportHeight: number;
  readonly fontFamily: string;
  readonly fontWeight: string;
  readonly fontSize: number;
  readonly fontScale: number;
  readonly lineHeight: number;
  readonly topInset: number;
  readonly bottomInset: number;
  readonly leftInset: number;
  readonly rightInset: number;
  readonly titleLineHeight: number;
  readonly titleToBodySpacing: number;
  readonly paragraphSpacing: number;
  readonly paragraphIndent: number;
  readonly writingMode: string;
};

/**
 * Creates a deterministic, explicit signature for one ArkUI pagination layout.
 * Callers must not replace this with a viewport-only or device-only key.
 */
export function createReadingPaginationLayoutSignature(
  facts: ReadingPaginationLayoutFacts,
): string {
  requireNonBlank(facts.fontFamily, 'fontFamily');
  requireNonBlank(facts.fontWeight, 'fontWeight');
  requireNonBlank(facts.writingMode, 'writingMode');
  requirePositiveFinite(facts.viewportWidth, 'viewportWidth');
  requirePositiveFinite(facts.viewportHeight, 'viewportHeight');
  requirePositiveFinite(facts.fontSize, 'fontSize');
  requirePositiveFinite(facts.fontScale, 'fontScale');
  requirePositiveFinite(facts.lineHeight, 'lineHeight');
  requireNonNegativeFinite(facts.topInset, 'topInset');
  requireNonNegativeFinite(facts.bottomInset, 'bottomInset');
  requireNonNegativeFinite(facts.leftInset, 'leftInset');
  requireNonNegativeFinite(facts.rightInset, 'rightInset');
  requireNonNegativeFinite(facts.titleLineHeight, 'titleLineHeight');
  requireNonNegativeFinite(facts.titleToBodySpacing, 'titleToBodySpacing');
  requireNonNegativeFinite(facts.paragraphSpacing, 'paragraphSpacing');
  requireNonNegativeFinite(facts.paragraphIndent, 'paragraphIndent');
  return [
    'reader-layout-v1',
    `device=${facts.deviceForm}`,
    `viewport=${canonicalNumber(facts.viewportWidth)}x${canonicalNumber(facts.viewportHeight)}`,
    `font=${facts.fontFamily}`,
    `weight=${facts.fontWeight}`,
    `size=${canonicalNumber(facts.fontSize)}`,
    `scale=${canonicalNumber(facts.fontScale)}`,
    `line=${canonicalNumber(facts.lineHeight)}`,
    `insets=${canonicalNumber(facts.topInset)},${canonicalNumber(facts.rightInset)},` +
      `${canonicalNumber(facts.bottomInset)},${canonicalNumber(facts.leftInset)}`,
    `title=${canonicalNumber(facts.titleLineHeight)},${canonicalNumber(facts.titleToBodySpacing)}`,
    `paragraph=${canonicalNumber(facts.paragraphSpacing)},${canonicalNumber(facts.paragraphIndent)}`,
    `writing=${facts.writingMode}`,
  ].join('|');
}

/** Stable version derived from the actual materialized UTF-16 chapter body. */
export function deriveReadingContentVersion(content: string): string {
  if (typeof content !== 'string') {
    throw new Error('content must be a string');
  }
  let fnv = 0x811C9DC5;
  let mixed = 0x9E3779B9;
  for (let index = 0; index < content.length; index += 1) {
    const codeUnit = content.charCodeAt(index);
    fnv = Math.imul(fnv ^ codeUnit, 0x01000193) >>> 0;
    mixed = Math.imul(mixed ^ codeUnit, 0x5F356495) >>> 0;
    mixed = (mixed ^ (mixed >>> 13)) >>> 0;
  }
  return `reader-content-v1:utf16=${content.length}:fnv=${hex32(fnv)}:mix=${hex32(mixed)}`;
}

/**
 * Identity of one chapter pagination manifest.
 *
 * `layoutSignature` must change whenever any pagination-affecting fact changes
 * (viewport, font, line height, spacing, margins, writing mode, and so on).
 * `contentVersion` must change whenever the materialized chapter text changes.
 */
export type ReadingPaginationKey = {
  readonly sourceId: string;
  readonly bookId: string;
  readonly chapterIndex: number;
  readonly layoutSignature: string;
  readonly contentVersion: string;
};

/** A complete measured manifest for one chapter under one exact key. */
export type ReadingPaginationChapter = {
  readonly key: ReadingPaginationKey;
  readonly contentScalarLength: number;
  readonly pageStartScalars: number[];
};

/** One physical page, expressed entirely in Core-compatible scalar offsets. */
export type ReadingIndexedPage = {
  readonly key: ReadingPaginationKey;
  readonly pageIndex: number;
  readonly startScalar: number;
  readonly endScalarExclusive: number;
};

/** One exact page observation in a continuous measurement run. */
export type ReadingPaginationPrefixObservation = {
  readonly requestScalar: number;
  readonly startScalar: number;
  readonly endScalarExclusive: number;
};

/**
 * Exact measured run of one chapter before its complete manifest exists.
 *
 * This is pagination truth, not navigation history: every new page must start
 * from the preceding real page's end request. A run may begin at a restored or
 * searched anchor so that pages measured after it have an exact predecessor;
 * only a run beginning at chapter head may later become a complete manifest.
 * Re-observing an already measured page is accepted only when all three scalar
 * boundaries are identical, so moving backward cannot erase or extend the
 * measured frontier.
 */
export class ReadingPaginationPrefix {
  readonly key: ReadingPaginationKey;
  private readonly observations: ReadingPaginationPrefixObservation[] = [];

  constructor(key: ReadingPaginationKey, first: ReadingPaginationPrefixObservation) {
    validateKey(key);
    validatePrefixObservation(first);
    this.key = copyKey(key);
    this.observations.push(copyPrefixObservation(first));
  }

  matches(key: ReadingPaginationKey): boolean {
    validateKey(key);
    return sameKey(this.key, key);
  }

  startsAtRequest(requestScalar: number): boolean {
    validateAnchor(requestScalar);
    return this.observations[0].requestScalar === requestScalar;
  }

  /**
   * Admits either one exact re-observation or the next continuous real page.
   * A jump, overlap, changed boundary, or unmeasured request is rejected.
   */
  admit(observation: ReadingPaginationPrefixObservation): boolean {
    validatePrefixObservation(observation);
    for (const known of this.observations) {
      if (known.requestScalar === observation.requestScalar) {
        return samePrefixObservation(known, observation);
      }
    }
    const last = this.observations[this.observations.length - 1];
    if (observation.requestScalar !== last.endScalarExclusive ||
      observation.startScalar < observation.requestScalar ||
      observation.startScalar <= last.startScalar ||
      observation.endScalarExclusive <= observation.requestScalar) {
      return false;
    }
    this.observations.push(copyPrefixObservation(observation));
    return true;
  }

  /** Exact request anchor that originally produced the page before `start`. */
  previousRequestForPageStart(startScalar: number): number | undefined {
    validateAnchor(startScalar);
    for (let index = 1; index < this.observations.length; index += 1) {
      if (this.observations[index].startScalar === startScalar) {
        return this.observations[index - 1].requestScalar;
      }
    }
    return undefined;
  }

  pageStartScalars(): number[] {
    return this.observations.map((observation: ReadingPaginationPrefixObservation): number =>
      observation.startScalar);
  }
}

/**
 * Result of asking for the physical page before an arbitrary persisted anchor.
 *
 * `manifestRequired` is fail-closed: the caller must measure that exact key
 * before retrying. Passing `null` as the previous chapter key means that the
 * current chapter is the first chapter in TOC order.
 */
export type ReadingPreviousPageLookup =
  | { readonly kind: 'page'; readonly page: ReadingIndexedPage }
  | { readonly kind: 'manifestRequired'; readonly key: ReadingPaginationKey }
  | { readonly kind: 'bookStart' };

class StoredReadingPaginationChapter {
  key: ReadingPaginationKey;
  contentScalarLength: number;
  pageStartScalars: number[];

  constructor(chapter: ReadingPaginationChapter) {
    this.key = copyKey(chapter.key);
    this.contentScalarLength = chapter.contentScalarLength;
    this.pageStartScalars = chapter.pageStartScalars.slice();
  }
}

export class ReadingPaginationIndex {
  private readonly chapters: StoredReadingPaginationChapter[] = [];

  /**
   * Records a complete set of physical page starts for one chapter.
   *
   * A new content version replaces the older version for the same chapter and
   * layout. Other layout signatures remain separately keyed and cannot be
   * mistaken for the active layout.
   */
  recordChapter(chapter: ReadingPaginationChapter): void {
    validateChapter(chapter);
    for (let index = this.chapters.length - 1; index >= 0; index -= 1) {
      if (sameChapterLayout(this.chapters[index].key, chapter.key)) {
        this.chapters.splice(index, 1);
      }
    }
    this.chapters.push(new StoredReadingPaginationChapter(chapter));
  }

  has(key: ReadingPaginationKey): boolean {
    validateKey(key);
    return this.findStored(key) !== undefined;
  }

  /**
   * Finds the physical page containing an arbitrary scalar anchor.
   *
   * Anchors before the first renderable scalar resolve to the first page;
   * stale anchors at or beyond chapter EOF resolve to the final page. Exact
   * page-start anchors belong to the page that starts there.
   */
  findContainingPage(key: ReadingPaginationKey, anchorScalar: number): ReadingIndexedPage | undefined {
    validateKey(key);
    validateAnchor(anchorScalar);
    const chapter = this.findStored(key);
    if (chapter === undefined) {
      return undefined;
    }
    return pageAt(chapter, containingPageIndex(chapter.pageStartScalars, anchorScalar));
  }

  findLastPage(key: ReadingPaginationKey): ReadingIndexedPage | undefined {
    validateKey(key);
    const chapter = this.findStored(key);
    if (chapter === undefined) {
      return undefined;
    }
    return pageAt(chapter, chapter.pageStartScalars.length - 1);
  }

  /**
   * Resolves the physical page before `anchorScalar` without session history.
   *
   * At the first page of a chapter, `previousChapterKey` is supplied from TOC
   * order. If its manifest is already indexed, the previous chapter's final
   * page is returned; otherwise the exact manifest that must be measured is
   * returned to the caller.
   */
  findPreviousPage(
    key: ReadingPaginationKey,
    anchorScalar: number,
    previousChapterKey: ReadingPaginationKey | null,
  ): ReadingPreviousPageLookup {
    validateKey(key);
    validateAnchor(anchorScalar);
    if (previousChapterKey !== null) {
      validatePreviousChapterKey(key, previousChapterKey);
    }

    const chapter = this.findStored(key);
    if (chapter === undefined) {
      return { kind: 'manifestRequired', key: copyKey(key) };
    }

    const currentPageIndex = containingPageIndex(chapter.pageStartScalars, anchorScalar);
    if (currentPageIndex > 0) {
      return { kind: 'page', page: pageAt(chapter, currentPageIndex - 1) };
    }

    if (previousChapterKey === null) {
      return { kind: 'bookStart' };
    }

    const previousChapter = this.findStored(previousChapterKey);
    if (previousChapter === undefined) {
      return { kind: 'manifestRequired', key: copyKey(previousChapterKey) };
    }
    return {
      kind: 'page',
      page: pageAt(previousChapter, previousChapter.pageStartScalars.length - 1),
    };
  }

  /** Invalidates one exact layout-and-content manifest. */
  invalidate(key: ReadingPaginationKey): boolean {
    validateKey(key);
    for (let index = this.chapters.length - 1; index >= 0; index -= 1) {
      if (sameKey(this.chapters[index].key, key)) {
        this.chapters.splice(index, 1);
        return true;
      }
    }
    return false;
  }

  /** Invalidates all versions and layouts of one chapter. */
  invalidateChapter(sourceId: string, bookId: string, chapterIndex: number): number {
    validateIdentity(sourceId, bookId);
    validateChapterIndex(chapterIndex);
    return this.removeMatching((key: ReadingPaginationKey): boolean =>
      key.sourceId === sourceId && key.bookId === bookId && key.chapterIndex === chapterIndex);
  }

  /**
   * Retains only the bounded native reading-session chapter window.
   *
   * This is intentionally not an LRU. The caller supplies the exact
   * previous/current/next TOC identities owned by the active session.
   */
  retainChapterWindow(sourceId: string, bookId: string, chapterIndexes: number[]): number {
    validateIdentity(sourceId, bookId);
    for (const chapterIndex of chapterIndexes) {
      validateChapterIndex(chapterIndex);
    }
    return this.removeMatching((key: ReadingPaginationKey): boolean =>
      key.sourceId === sourceId && key.bookId === bookId && chapterIndexes.indexOf(key.chapterIndex) < 0);
  }

  /** Invalidates one layout across all indexed chapters of a book. */
  invalidateLayout(sourceId: string, bookId: string, layoutSignature: string): number {
    validateIdentity(sourceId, bookId);
    requireNonBlank(layoutSignature, 'layoutSignature');
    return this.removeMatching((key: ReadingPaginationKey): boolean =>
      key.sourceId === sourceId && key.bookId === bookId && key.layoutSignature === layoutSignature);
  }

  /** Invalidates every indexed layout and chapter for one book. */
  invalidateBook(sourceId: string, bookId: string): number {
    validateIdentity(sourceId, bookId);
    return this.removeMatching((key: ReadingPaginationKey): boolean =>
      key.sourceId === sourceId && key.bookId === bookId);
  }

  clear(): void {
    this.chapters.length = 0;
  }

  private findStored(key: ReadingPaginationKey): StoredReadingPaginationChapter | undefined {
    for (const chapter of this.chapters) {
      if (sameKey(chapter.key, key)) {
        return chapter;
      }
    }
    return undefined;
  }

  private removeMatching(predicate: (key: ReadingPaginationKey) => boolean): number {
    let removed = 0;
    for (let index = this.chapters.length - 1; index >= 0; index -= 1) {
      if (predicate(this.chapters[index].key)) {
        this.chapters.splice(index, 1);
        removed += 1;
      }
    }
    return removed;
  }
}

function pageAt(chapter: StoredReadingPaginationChapter, pageIndex: number): ReadingIndexedPage {
  const nextPageIndex = pageIndex + 1;
  return {
    key: copyKey(chapter.key),
    pageIndex,
    startScalar: chapter.pageStartScalars[pageIndex],
    endScalarExclusive: nextPageIndex < chapter.pageStartScalars.length ?
      chapter.pageStartScalars[nextPageIndex] : chapter.contentScalarLength,
  };
}

function containingPageIndex(pageStarts: number[], anchorScalar: number): number {
  let low = 0;
  let high = pageStarts.length - 1;
  let containing = 0;
  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    if (pageStarts[middle] <= anchorScalar) {
      containing = middle;
      low = middle + 1;
    } else {
      high = middle - 1;
    }
  }
  return containing;
}

function validateChapter(chapter: ReadingPaginationChapter): void {
  validateKey(chapter.key);
  if (!Number.isSafeInteger(chapter.contentScalarLength) || chapter.contentScalarLength < 0) {
    throw new RangeError('contentScalarLength must be a non-negative safe integer');
  }
  if (chapter.pageStartScalars.length === 0) {
    throw new Error('pageStartScalars must contain at least one physical page');
  }

  let previous = -1;
  for (const start of chapter.pageStartScalars) {
    if (!Number.isSafeInteger(start) || start < 0) {
      throw new RangeError('pageStartScalars must contain non-negative safe integers');
    }
    if (start <= previous) {
      throw new Error('pageStartScalars must be strictly increasing');
    }
    if (chapter.contentScalarLength === 0 ? start !== 0 : start >= chapter.contentScalarLength) {
      throw new RangeError('pageStartScalars contains a start outside chapter content');
    }
    previous = start;
  }
}

function validateKey(key: ReadingPaginationKey): void {
  validateIdentity(key.sourceId, key.bookId);
  validateChapterIndex(key.chapterIndex);
  requireNonBlank(key.layoutSignature, 'layoutSignature');
  requireNonBlank(key.contentVersion, 'contentVersion');
}

function validateIdentity(sourceId: string, bookId: string): void {
  requireNonBlank(sourceId, 'sourceId');
  requireNonBlank(bookId, 'bookId');
}

function validateChapterIndex(chapterIndex: number): void {
  if (!Number.isSafeInteger(chapterIndex) || chapterIndex < 0) {
    throw new RangeError('chapterIndex must be a non-negative safe integer');
  }
}

function validateAnchor(anchorScalar: number): void {
  if (!Number.isSafeInteger(anchorScalar) || anchorScalar < 0) {
    throw new RangeError('anchorScalar must be a non-negative safe integer');
  }
}

function validatePrefixObservation(observation: ReadingPaginationPrefixObservation): void {
  validateAnchor(observation.requestScalar);
  validateAnchor(observation.startScalar);
  validateAnchor(observation.endScalarExclusive);
  if (observation.startScalar < observation.requestScalar) {
    throw new RangeError('prefix startScalar must not precede requestScalar');
  }
  if (observation.endScalarExclusive <= observation.startScalar) {
    throw new RangeError('prefix endScalarExclusive must follow startScalar');
  }
}

function validatePreviousChapterKey(
  current: ReadingPaginationKey,
  previous: ReadingPaginationKey,
): void {
  validateKey(previous);
  if (current.sourceId !== previous.sourceId || current.bookId !== previous.bookId) {
    throw new Error('previousChapterKey must identify the same book');
  }
  if (current.layoutSignature !== previous.layoutSignature) {
    throw new Error('previousChapterKey must use the same layoutSignature');
  }
  if (current.chapterIndex === previous.chapterIndex) {
    throw new Error('previousChapterKey must identify a different chapter');
  }
}

function requireNonBlank(value: string, field: string): void {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${field} must be a non-blank string`);
  }
}

function requirePositiveFinite(value: number, field: string): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${field} must be a positive finite number`);
  }
}

function requireNonNegativeFinite(value: number, field: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${field} must be a non-negative finite number`);
  }
}

function canonicalNumber(value: number): string {
  return Object.is(value, -0) ? '0' : value.toString();
}

function hex32(value: number): string {
  return value.toString(16).padStart(8, '0');
}

function sameKey(left: ReadingPaginationKey, right: ReadingPaginationKey): boolean {
  return sameChapterLayout(left, right) && left.contentVersion === right.contentVersion;
}

function sameChapterLayout(left: ReadingPaginationKey, right: ReadingPaginationKey): boolean {
  return left.sourceId === right.sourceId && left.bookId === right.bookId &&
    left.chapterIndex === right.chapterIndex && left.layoutSignature === right.layoutSignature;
}

function copyKey(key: ReadingPaginationKey): ReadingPaginationKey {
  return {
    sourceId: key.sourceId,
    bookId: key.bookId,
    chapterIndex: key.chapterIndex,
    layoutSignature: key.layoutSignature,
    contentVersion: key.contentVersion,
  };
}

function copyPrefixObservation(
  observation: ReadingPaginationPrefixObservation,
): ReadingPaginationPrefixObservation {
  return {
    requestScalar: observation.requestScalar,
    startScalar: observation.startScalar,
    endScalarExclusive: observation.endScalarExclusive,
  };
}

function samePrefixObservation(
  left: ReadingPaginationPrefixObservation,
  right: ReadingPaginationPrefixObservation,
): boolean {
  return left.requestScalar === right.requestScalar && left.startScalar === right.startScalar &&
    left.endScalarExclusive === right.endScalarExclusive;
}
