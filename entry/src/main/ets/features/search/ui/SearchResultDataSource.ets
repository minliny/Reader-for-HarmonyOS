import { FrameCallback } from '@kit.ArkUI';
import { ReaderPostLayoutFrame } from '../../../ui/layout/ReaderPostLayoutFrame';
import { bookTitleAuthorKey } from '../../../app/library/BookAuthorMetadata';
import type { SearchBook } from '../application/SearchGateway';
import type { SearchEntrySourceReadObservation, SearchHistoryStatus } from '../presentation/SearchPresentation';
import { readerMediaIdentity } from '../../source/application/ReaderSourceCategory';

export type SearchVerificationProjection = 'empty' | 'results' | 'pending';

export interface SearchProjectionEvidence {
  queryRevision: number;
  publicationRevision: number;
  owner: number;
  page: number;
  state: SearchVerificationProjection;
  searchActive: boolean;
  viewportId: string;
}

export interface SearchFilterEvidence {
  owner: number;
  page: number;
  queryRevision: number;
  panelGeneration: number;
  workGeneration: number;
  viewportId: string;
  action: 'scope' | 'reset';
  scope: 'all' | 'local' | 'online';
  content: 'all' | 'novel' | 'comic';
  resultCount: number;
  visibleCount: number;
}

export interface SearchPageEvidence {
  queryRevision: number;
  owner: number;
  page: number;
  projection?: string;
  operation?: string;
  operationGeneration?: number;
  publicationRevision?: number;
  viewportId?: string;
  searchActive?: boolean;
  resultCount?: number;
  visibleCount?: number;
  incompleteCount?: number;
  failedCount?: number;
  skippedCount?: number;
  stopped?: boolean;
  localFailed?: boolean;
  sourceListFailed?: boolean;
  moreSources?: boolean;
  sourceRequiredReason?: string;
  entrySourceRead?: SearchEntrySourceReadObservation;
  historyCount?: number;
  historyStatus?: SearchHistoryStatus;
  length?: number;
  released?: boolean;
  action?: string;
  panel?: SearchPanelKind;
  anchorIndex?: number;
  anchorOffset?: number;
  anchorItemY?: number;
  anchorAtStart?: boolean;
  anchorMatchesRestore?: boolean;
}

export interface SearchResultSelection {
  queryRevision: number;
  book: SearchBook;
  variants: SearchBook[];
  coverUrl: string;
}

export type SearchPanelKind = 'filter' | 'task';

export interface SearchNativePanel {
  kind: SearchPanelKind;
  identity: string;
  chromeClaimed: boolean;
}

export interface SearchNoticeFacts {
  queryRevision: number;
  progressText: string;
  searching: boolean;
  operationGeneration: number | undefined;
  partial: boolean;
  partialText: string;
  failed: number;
  skipped: number;
  canRetry: boolean;
}

export class SearchLayoutFrame extends ReaderPostLayoutFrame {}

@Observed
export class SearchBookGroup {
  book: SearchBook;
  sourceCount: number;
  inBookshelf: boolean;
  sourceIds: string[];
  variants: SearchBook[];
  coverUrl: string;
  private readonly sourceIdSet: Set<string>;
  private readonly failedCoverUrls: Set<string> = new Set();

  constructor(book: SearchBook, sourceCount: number, inBookshelf: boolean) {
    this.book = book;
    this.sourceCount = sourceCount;
    this.inBookshelf = inBookshelf;
    this.sourceIds = [book.sourceId];
    this.variants = [book];
    this.coverUrl = book.coverUrl?.trim() ?? '';
    this.sourceIdSet = new Set<string>([book.sourceId]);
  }

  admit(book: SearchBook, inBookshelf: boolean): void {
    this.variants.push(book);
    if (!this.sourceIdSet.has(book.sourceId)) {
      this.sourceIdSet.add(book.sourceId);
      this.sourceIds.push(book.sourceId);
      this.sourceCount += 1;
    }
    this.inBookshelf = this.inBookshelf || inBookshelf;
    const url = book.coverUrl?.trim() ?? '';
    if (this.coverUrl.length === 0 && url.length > 0 && !this.failedCoverUrls.has(url)) this.coverUrl = url;
  }

  resetCoverFailures(): void { this.failedCoverUrls.clear(); }

  refreshCover(): void {
    if (this.coverUrl.length > 0 && !this.failedCoverUrls.has(this.coverUrl) &&
      this.variants.some((book: SearchBook): boolean => book.coverUrl?.trim() === this.coverUrl)) return;
    const candidate = this.variants.find((book: SearchBook): boolean => {
      const url = book.coverUrl?.trim() ?? '';
      return url.length > 0 && !this.failedCoverUrls.has(url);
    });
    const next = candidate?.coverUrl?.trim() ?? '';
    if (this.coverUrl !== next) this.coverUrl = next;
  }

  rejectCover(url: string): void {
    if (url.length === 0 || this.coverUrl !== url) return;
    this.failedCoverUrls.add(url);
    this.refreshCover();
  }
}

export class SearchResultDataSource implements IDataSource {
  private items: SearchBookGroup[] = [];
  private keys: string[] = [];
  private listeners: DataChangeListener[] = [];
  private input: SearchBookGroup[] | undefined = undefined;
  private positions: Map<string, number> = new Map();

  totalCount(): number { return this.items.length; }
  getData(index: number): SearchBookGroup { return this.items[index]; }

  updateShelfMembership(key: string, inBookshelf: boolean): void {
    const index = this.positions.get(key);
    if (index !== undefined) this.items[index].inBookshelf = inBookshelf;
  }

  registerDataChangeListener(listener: DataChangeListener): void {
    if (this.listeners.indexOf(listener) < 0) this.listeners.push(listener);
  }

  unregisterDataChangeListener(listener: DataChangeListener): void {
    const index = this.listeners.indexOf(listener);
    if (index >= 0) this.listeners.splice(index, 1);
  }

  private key(group: SearchBookGroup): string {
    const book = group.book;
    if (book.sourceId === 'local') return `local:${book.bookId}`;
    if (book.groupKey !== undefined) return `online:${book.groupKey}`;
    const alias = bookTitleAuthorKey(book.title, book.author, book.authorIdentity, book.sourceRuleVersion);
    return `online:${readerMediaIdentity(book.category === 'comic', alias)}`;
  }

  private sameBook(left: SearchBook, right: SearchBook): boolean {
    return left === right || (left.sourceId === right.sourceId && left.bookId === right.bookId &&
      left.groupKey === right.groupKey && left.title === right.title && left.author === right.author &&
      (left.authorIdentity === right.authorIdentity || JSON.stringify(left.authorIdentity) === JSON.stringify(right.authorIdentity)) &&
      left.sourceName === right.sourceName && left.coverUrl === right.coverUrl && left.intro === right.intro &&
      left.kind === right.kind && left.latestChapterTitle === right.latestChapterTitle &&
      left.category === right.category && left.detailUrl === right.detailUrl &&
      left.searchRequestId === right.searchRequestId && left.sourceRuleVersion === right.sourceRuleVersion &&
      left.bookSourceUrl === right.bookSourceUrl &&
      (left.variables === right.variables || JSON.stringify(left.variables) === JSON.stringify(right.variables)) &&
      (left.acquisition === right.acquisition || JSON.stringify(left.acquisition) === JSON.stringify(right.acquisition)));
  }

  private update(retained: SearchBookGroup, next: SearchBookGroup): boolean {
    if (retained === next) return false;
    const newRequest = retained.book.searchRequestId !== next.book.searchRequestId;
    let changed = false;
    if (!this.sameBook(retained.book, next.book)) { retained.book = next.book; changed = true; }
    if (retained.sourceCount !== next.sourceCount) { retained.sourceCount = next.sourceCount; changed = true; }
    if (retained.inBookshelf !== next.inBookshelf) { retained.inBookshelf = next.inBookshelf; changed = true; }
    if (retained.sourceIds.length !== next.sourceIds.length ||
      retained.sourceIds.some((id: string, index: number): boolean => id !== next.sourceIds[index])) {
      retained.sourceIds = next.sourceIds; changed = true;
    }
    if (retained.variants.length !== next.variants.length ||
      retained.variants.some((book: SearchBook, index: number): boolean => !this.sameBook(book, next.variants[index]))) {
      retained.variants = next.variants; changed = true;
    }
    if (newRequest) retained.resetCoverFailures();
    retained.refreshCover();
    return changed;
  }

  replace(items: SearchBookGroup[], changedKeys?: Set<string>): boolean {
    if (this.input === items && changedKeys !== undefined) {
      for (const key of changedKeys) {
        const index = this.positions.get(key);
        if (index !== undefined) this.update(this.items[index], items[index]);
      }
      return false;
    }
    const oldItems = this.items;
    const oldKeys = this.keys;
    const previous = new Map<string, SearchBookGroup>();
    for (let index = 0; index < oldKeys.length; index++) previous.set(oldKeys[index], oldItems[index]);
    const nextKeys: string[] = [];
    const nextItems: SearchBookGroup[] = [];
    const additions: number[] = [];
    const nextSet = new Set<string>();
    for (let index = 0; index < items.length; index++) {
      const next = items[index]; const key = this.key(next);
      nextKeys.push(key); nextSet.add(key);
      const retained = previous.get(key);
      if (retained === undefined) { nextItems.push(next); additions.push(index); }
      else {
        this.update(retained, next);
        nextItems.push(retained);
      }
    }
    const retainedOld = oldKeys.filter((key: string): boolean => nextSet.has(key));
    const retainedNext = nextKeys.filter((key: string): boolean => previous.has(key));
    const reordered = retainedOld.some((key: string, index: number): boolean => key !== retainedNext[index]);
    const operations: DataOperation[] = [];
    if (reordered) {
      const nextPositions = new Map<string, number>();
      for (let index = 0; index < nextKeys.length; index++) nextPositions.set(nextKeys[index], index);
      const moved: string[] = [];
      for (const key of changedKeys ?? []) if (this.positions.has(key) &&
        nextPositions.has(key) && this.positions.get(key) !== nextPositions.get(key)) moved.push(key);
      const single = moved.length === 1 && oldKeys.length === nextKeys.length && additions.length === 0;
      const oldRest = single ? oldKeys.filter((key: string): boolean => key !== moved[0]) : [];
      const nextRest = single ? nextKeys.filter((key: string): boolean => key !== moved[0]) : [];
      if (single && oldRest.every((key: string, index: number): boolean => key === nextRest[index])) {
        operations.push({ type: DataOperationType.MOVE, index: {
          from: this.positions.get(moved[0]) as number, to: nextPositions.get(moved[0]) as number } });
      } else {
        operations.push({ type: DataOperationType.RELOAD });
      }
    } else {
      for (let index = oldKeys.length - 1; index >= 0;) {
        if (nextSet.has(oldKeys[index])) { index--; continue; }
        const end = index;
        while (index >= 0 && !nextSet.has(oldKeys[index])) index--;
        operations.push({ type: DataOperationType.DELETE, index: index + 1, count: end - index });
      }
      const additionAnchors: Map<number, number> = new Map();
      let nextOriginal = oldKeys.length;
      for (let index = nextKeys.length - 1; index >= 0; index--) {
        const original = this.positions.get(nextKeys[index]);
        if (original !== undefined) nextOriginal = original;
        else additionAnchors.set(index, nextOriginal);
      }
      for (let position = 0; position < additions.length;) {
        const start = additions[position]; let end = position + 1;
        while (end < additions.length && additions[end] === additions[end - 1] + 1) end++;
        const anchor = additionAnchors.get(start) as number;
        operations.push({ type: DataOperationType.ADD, index: anchor, count: end - position,
          key: nextKeys.slice(start, start + end - position) });
        position = end;
      }
    }
    this.items = nextItems; this.keys = nextKeys;
    this.input = items;
    this.positions = new Map();
    for (let index = 0; index < nextKeys.length; index++) this.positions.set(nextKeys[index], index);
    if (operations.length > 0) for (const listener of this.listeners) {
      listener.onDatasetChange(operations);
    }
    return reordered;
  }
}
