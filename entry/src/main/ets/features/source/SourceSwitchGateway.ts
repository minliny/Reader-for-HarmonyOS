import type { JsonObject, RequestOptions } from '@reader/core-harmony';
import { ReaderRuntimeOwner } from '../../app/ReaderRuntimeOwner';
import type { ShelfBook } from '../../app/ReaderCoreGateway';

// Legado caps ChangeBookSourceDialog at nine workers. Keep one lane in reserve
// for the foreground reading session while avoiding one unbounded request per
// imported source.
const SOURCE_SWITCH_DISCOVERY_CONCURRENCY = 8;

/**
 * Page-facing source-switch candidate. `sourceName` comes from the existing
 * source registry while the book identity comes from `change.bookSource`;
 * `latencyMs`/`offline`/`timeout` are future-data hooks the panel renders as
 * "—"/normal when absent.
 */
export type SourceSwitchCandidate = {
  sourceId: string;
  sourceName: string;
  bookUrl: string;
  bookName: string;
  author?: string;
  coverUrl?: string;
  latencyMs?: number;
  offline?: boolean;
  timeout?: boolean;
  isCurrent?: boolean;
};

/** Stable identity shared by discovery, rendering, and click admission. */
export function sourceSwitchCandidateKey(sourceId: string, bookUrl: string): string {
  return `${sourceId.length}:${sourceId}:${bookUrl.length}:${bookUrl}`;
}

function deduplicateSourceSwitchCandidates(
  candidates: SourceSwitchCandidate[],
): SourceSwitchCandidate[] {
  const result: SourceSwitchCandidate[] = [];
  const seen = new Set<string>();
  for (const candidate of candidates) {
    const key = sourceSwitchCandidateKey(candidate.sourceId, candidate.bookUrl);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(candidate);
  }
  return result;
}

export type SourceSwitchDiscoveryOutcome =
  | { kind: 'sources'; candidates: SourceSwitchCandidate[] }
  | { kind: 'noSources' };

export type SourceSwitchTargetTocEntry = {
  index: number;
  title: string;
  url: string;
};

export type SourceSwitchTargetToc = {
  sourceId: string;
  bookId: string;
  entries: SourceSwitchTargetTocEntry[];
};

export type SourceSwitchNewTocEntry = {
  chapterId: string;
  chapterTitle: string;
  chapterUrl: string;
  order: number;
};

export type SourceSwitchTarget = {
  sourceId: string;
  bookId: string;
  title: string;
  author?: string;
  coverUrl?: string;
};

export type SourceSwitchCommitParams = {
  from: { sourceId: string; bookId: string };
  target: SourceSwitchTarget;
  newToc: SourceSwitchNewTocEntry[];
  currentChapterTitle: string;
  currentChapterIndex: number;
  updatedAt: number;
};

/** Core-owned durable transaction identity. Harmony never receives the journal. */
export type SourceSwitchTransactionId = string;

export type SourceSwitchCommitOutcome =
  | {
    status: 'success';
    book: ShelfBook;
    matchedChapter: SourceSwitchNewTocEntry;
    transactionId: SourceSwitchTransactionId;
  }
  | { status: 'failed'; error: string; transactionId?: SourceSwitchTransactionId };

export type SourceSwitchRollbackResult = {
  transactionId: SourceSwitchTransactionId;
  changed: boolean;
  restoredBook: ShelfBook;
};

export type PendingSourceSwitch = {
  transactionId: SourceSwitchTransactionId;
  fromSourceId: string;
  fromBookId: string;
  targetSourceId: string;
  targetBookId: string;
};

/**
 * Feature-local gateway for the source-switch flow. Owns the
 * `change.bookSource` / `book.detail` / `book.toc` / `source.switch.commit` /
 * `source.switch.rollback` boundary and validates every JSON envelope before
 * the panel sees it.
 *
 * `change.bookSource`, `book.detail`, and `book.toc` are remote commands that
 * delegate the HTTP round-trip to the Host via `http.execute`. Host transport
 * limits surface as a plain Error, which Index presents through the admitted
 * discovery/failure state. The wire contract is authoritative regardless.
 */
export class SourceSwitchGateway {
  private readonly runtimeOwner: ReaderRuntimeOwner;

  constructor(runtimeOwner: ReaderRuntimeOwner = ReaderRuntimeOwner.current()) {
    this.runtimeOwner = runtimeOwner;
  }

  /**
   * Discovery: enabled source registry → `change.bookSource` candidates for
   * the given book. Never invokes `change.bookSource` with an empty
   * `sourceIds` (Core rejects it); that resolves to `{kind:'noSources'}`.
   */
  async discoverCandidates(
    sourceId: string,
    bookId: string,
    keyword: string,
    isCurrent: (() => boolean) | undefined = undefined,
  ): Promise<SourceSwitchDiscoveryOutcome> {
    this.assertNonBlankString(sourceId, 'sourceId');
    this.assertNonBlankString(bookId, 'bookId');
    this.assertNonBlankString(keyword, 'keyword');
    const list = await this.runtimeOwner.request(
      'source.list',
      { enabledOnly: true },
      this.requestOptions(isCurrent),
    );
    const rawSources = list.data['sources'];
    if (!Array.isArray(rawSources)) {
      throw new Error('source.list returned invalid data');
    }
    const sourceIds: string[] = [];
    const sourceNames: Map<string, string> = new Map<string, string>();
    for (const raw of rawSources) {
      if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
        continue;
      }
      const source = raw as JsonObject;
      if (source['enabled'] !== true) {
        continue;
      }
      const sourceId = this.optionalString(source, 'sourceId');
      if (sourceId !== undefined && sourceId.length > 0) {
        sourceIds.push(sourceId);
        sourceNames.set(sourceId, this.optionalString(source, 'name') ?? sourceId);
      }
    }
    if (sourceIds.length === 0) {
      return { kind: 'noSources' };
    }
    const candidates: SourceSwitchCandidate[] = [];
    for (let start = 0; start < sourceIds.length; start += SOURCE_SWITCH_DISCOVERY_CONCURRENCY) {
      if (isCurrent !== undefined && !isCurrent()) {
        return { kind: 'noSources' };
      }
      const end = Math.min(start + SOURCE_SWITCH_DISCOVERY_CONCURRENCY, sourceIds.length);
      const pending: Promise<SourceSwitchCandidate[]>[] = [];
      for (let index = start; index < end; index += 1) {
        const candidateSourceId = sourceIds[index];
        pending.push(this.discoverFromSource(
          sourceId,
          bookId,
          keyword,
          candidateSourceId,
          sourceNames.get(candidateSourceId) ?? candidateSourceId,
          isCurrent,
        ));
      }
      const groups = await Promise.all(pending);
      for (const group of groups) {
        candidates.push(...group);
      }
    }
    const uniqueCandidates = deduplicateSourceSwitchCandidates(candidates);
    const currentCandidateKey = sourceSwitchCandidateKey(sourceId, bookId);
    for (const candidate of uniqueCandidates) {
      candidate.isCurrent = sourceSwitchCandidateKey(candidate.sourceId, candidate.bookUrl) === currentCandidateKey;
    }
    return { kind: 'sources', candidates: uniqueCandidates };
  }

  private async discoverFromSource(
    sourceId: string,
    bookId: string,
    keyword: string,
    candidateSourceId: string,
    candidateSourceName: string,
    isCurrent: (() => boolean) | undefined,
  ): Promise<SourceSwitchCandidate[]> {
    try {
      const result = await this.runtimeOwner.request(
        'change.bookSource',
        { sourceId, bookId, keyword, sourceIds: [candidateSourceId] },
        this.requestOptions(isCurrent),
      );
      return this.decodeDiscoveryCandidates(result.data, candidateSourceName);
    } catch (error) {
      if (isCurrent !== undefined && !isCurrent()) {
        throw error;
      }
      // A source-switch search is a batch. One dead, challenged, or malformed
      // source must not erase candidates from the remaining enabled sources.
      return [];
    }
  }

  private decodeDiscoveryCandidates(data: JsonObject, sourceName: string): SourceSwitchCandidate[] {
    const rawCandidates = data['candidates'];
    if (!Array.isArray(rawCandidates)) {
      throw new Error('change.bookSource returned invalid data');
    }
    const candidates: SourceSwitchCandidate[] = [];
    for (const raw of rawCandidates) {
      if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
        continue;
      }
      const candidate = raw as JsonObject;
      const sourceId = this.optionalString(candidate, 'sourceId');
      const bookUrl = this.optionalString(candidate, 'bookUrl');
      const bookName = this.optionalString(candidate, 'bookName');
      if (sourceId === undefined || bookUrl === undefined || bookName === undefined) {
        continue;
      }
      const entry: SourceSwitchCandidate = { sourceId, sourceName, bookUrl, bookName };
      const author = this.optionalString(candidate, 'author');
      const coverUrl = this.optionalString(candidate, 'coverUrl');
      if (author !== undefined) {
        entry.author = author;
      }
      if (coverUrl !== undefined) {
        entry.coverUrl = coverUrl;
      }
      const latencyMs = this.optionalNumber(candidate, 'latencyMs');
      if (latencyMs !== undefined) {
        entry.latencyMs = latencyMs;
      }
      if (candidate['offline'] === true) {
        entry.offline = true;
      }
      if (candidate['timeout'] === true) {
        entry.timeout = true;
      }
      candidates.push(entry);
    }
    return candidates;
  }

  /**
   * Resolves the target detail before fetching its chapter table. `book.toc`
   * cannot infer a TOC request from `{sourceId, bookId}` alone: the Core wire
   * contract requires the `tocUrl` and rule variables produced by
   * `book.detail`. Both remote commands need the `http.execute` host.
   */
  async fetchTargetToc(
    sourceId: string,
    bookId: string,
    isCurrent: (() => boolean) | undefined = undefined,
  ): Promise<SourceSwitchTargetToc> {
    this.assertNonBlankString(sourceId, 'sourceId');
    this.assertNonBlankString(bookId, 'bookId');

    const detail = await this.runtimeOwner.request(
      'book.detail',
      {
        sourceId,
        book: { bookId },
        bookUrl: bookId,
      },
      this.requestOptions(isCurrent),
    );
    const detailBook = this.requireObject(detail.data['book'], 'book.detail book');
    const detailSourceId = this.requireString(detail.data, 'sourceId', 'book.detail');
    const detailBookId = this.requireString(detailBook, 'bookId', 'book.detail book');
    if (detailSourceId !== sourceId || detailBookId !== bookId) {
      throw new Error('book.detail returned a mismatched composite key');
    }
    // An absent/blank TOC URL is not recoverable by `book.toc`; fail before a
    // knowingly invalid Core request instead of silently substituting bookId.
    const tocUrl = this.requireString(detail.data, 'tocUrl', 'book.detail');
    // `book.toc` variables are optional in the Core contract (serde default
    // empty map); `book.detail` only emits them when the source's rules produce
    // any. Requiring an object here would fail-closed against real sources
    // whose detail rules carry no variables.
    const rawVariables = detail.data['variables'];
    const variables: JsonObject =
      rawVariables === undefined || rawVariables === null
        ? {}
        : this.requireStringMap(rawVariables, 'variables', 'book.detail');

    const result = await this.runtimeOwner.request(
      'book.toc',
      { sourceId, bookId, tocUrl, variables },
      this.requestOptions(isCurrent),
    );
    const rawSourceId = result.data['sourceId'];
    const rawBookId = result.data['bookId'];
    if (rawSourceId !== sourceId || rawBookId !== bookId) {
      throw new Error('book.toc returned a mismatched composite key');
    }
    const rawToc = result.data['toc'];
    if (!Array.isArray(rawToc)) {
      throw new Error('book.toc returned invalid data');
    }
    const entries: SourceSwitchTargetTocEntry[] = [];
    for (const raw of rawToc) {
      if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
        throw new Error('book.toc returned a non-object entry');
      }
      const entry = raw as JsonObject;
      const index = this.requireNonNegativeInteger(entry, 'index', 'book.toc');
      const title = this.requireString(entry, 'title', 'book.toc');
      const url = this.requireString(entry, 'url', 'book.toc');
      entries.push({ index, title, url });
    }
    return { sourceId, bookId, entries };
  }

  /**
   * Atomically re-points an existing shelf book to the target source. This is
   * a storage-only command; its structured rollback journal remains inside
   * Core and Harmony receives only an opaque transaction id.
   */
  async commitSwitch(
    params: SourceSwitchCommitParams,
    isCurrent: (() => boolean) | undefined = undefined,
  ): Promise<SourceSwitchCommitOutcome> {
    this.assertNonBlankString(params.from.sourceId, 'from.sourceId');
    this.assertNonBlankString(params.from.bookId, 'from.bookId');
    this.assertNonBlankString(params.target.sourceId, 'target.sourceId');
    this.assertNonBlankString(params.target.bookId, 'target.bookId');
    this.assertNonBlankString(params.target.title, 'target.title');
    this.assertNonBlankString(params.currentChapterTitle, 'currentChapterTitle');
    if (params.newToc.length === 0) {
      throw new Error('source.switch.commit requires a non-empty newToc');
    }
    if (!Number.isInteger(params.currentChapterIndex) || params.currentChapterIndex < 0) {
      throw new Error('source.switch.commit requires a non-negative currentChapterIndex');
    }
    let transactionId: string | undefined = undefined;
    try {
      const result = await this.runtimeOwner.request(
        'source.switch.commit',
        params as unknown as JsonObject,
        this.requestOptions(isCurrent),
      );
      const rawBook = result.data['book'];
      transactionId = this.requireString(result.data, 'transactionId', 'source.switch.commit');
      if (result.data['phase'] !== 'pending') {
        throw new Error('source.switch.commit returned an invalid phase');
      }
      if (typeof rawBook !== 'object' || rawBook === null || Array.isArray(rawBook)) {
        throw new Error('source.switch.commit returned an invalid book');
      }
      const matchedChapter = this.decodeMatchedChapter(result.data['matchedChapter']);
      return {
        status: 'success',
        book: this.decodeShelfBook(rawBook),
        matchedChapter,
        transactionId,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return transactionId === undefined
        ? { status: 'failed', error: message }
        : { status: 'failed', error: message, transactionId };
    }
  }

  /**
   * Compensates a previous commit via its opaque durable transaction id.
   * Finalized or stale transactions are rejected without overwriting progress.
   */
  async rollbackSwitch(
    transactionId: SourceSwitchTransactionId,
    isCurrent: (() => boolean) | undefined = undefined,
  ): Promise<SourceSwitchRollbackResult> {
    this.assertNonBlankString(transactionId, 'transactionId');
    const result = await this.runtimeOwner.request(
      'source.switch.rollback',
      { transactionId },
      this.requestOptions(isCurrent),
    );
    if (result.data['transactionId'] !== transactionId || result.data['phase'] !== 'rolledBack' ||
      typeof result.data['changed'] !== 'boolean') {
      throw new Error('source.switch.rollback returned an invalid transaction result');
    }
    const rawBook = result.data['restoredBook'];
    if (typeof rawBook !== 'object' || rawBook === null || Array.isArray(rawBook)) {
      throw new Error('source.switch.rollback returned an invalid restored book');
    }
    return {
      transactionId,
      changed: result.data['changed'] as boolean,
      restoredBook: this.decodeShelfBook(rawBook),
    };
  }

  /**
   * Reads Core's opaque pending-transaction projection for lifecycle
   * reconciliation. Harmony receives only the exact from/target identities
   * and transaction id; the durable journal remains owned by Core.
   */
  async listPendingSwitches(
    isCurrent: (() => boolean) | undefined = undefined,
  ): Promise<PendingSourceSwitch[]> {
    const result = await this.runtimeOwner.request(
      'source.switch.pending.list',
      {},
      this.requestOptions(isCurrent),
    );
    const rawPending = result.data['pending'];
    if (!Array.isArray(rawPending)) {
      throw new Error('source.switch.pending.list returned invalid pending');
    }
    const pending: PendingSourceSwitch[] = [];
    const transactionIds = new Set<string>();
    for (const value of rawPending) {
      const row = this.requireObject(value, 'source.switch.pending.list row');
      const transactionId = this.requireString(row, 'transactionId', 'source.switch.pending.list');
      if (row['phase'] !== 'pending' || transactionIds.has(transactionId)) {
        throw new Error('source.switch.pending.list returned an invalid transaction row');
      }
      const from = this.requireObject(row['from'], 'source.switch.pending.list from');
      const target = this.requireObject(row['target'], 'source.switch.pending.list target');
      transactionIds.add(transactionId);
      pending.push({
        transactionId,
        fromSourceId: this.requireString(from, 'sourceId', 'source.switch.pending.list from'),
        fromBookId: this.requireString(from, 'bookId', 'source.switch.pending.list from'),
        targetSourceId: this.requireString(target, 'sourceId', 'source.switch.pending.list target'),
        targetBookId: this.requireString(target, 'bookId', 'source.switch.pending.list target'),
      });
    }
    return pending;
  }

  private decodeMatchedChapter(value: unknown): SourceSwitchNewTocEntry {
    const chapter = this.requireObject(value, 'source.switch matchedChapter');
    return {
      chapterId: this.requireString(chapter, 'chapterId', 'source.switch matchedChapter'),
      chapterTitle: this.requireString(chapter, 'chapterTitle', 'source.switch matchedChapter'),
      chapterUrl: this.requireString(chapter, 'chapterUrl', 'source.switch matchedChapter'),
      order: this.requireNonNegativeInteger(chapter, 'order', 'source.switch matchedChapter'),
    };
  }

  private requestOptions(isCurrent: (() => boolean) | undefined): RequestOptions {
    if (isCurrent === undefined) {
      return {};
    }
    return {
      shouldCancel: (): boolean => !isCurrent(),
    };
  }

  private decodeShelfBook(value: unknown): ShelfBook {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      throw new Error('source.switch returned a non-object book');
    }
    const book = value as JsonObject;
    const decoded: ShelfBook = {
      sourceId: this.requiredString(book, 'sourceId'),
      bookId: this.requiredString(book, 'bookId'),
      title: this.requiredString(book, 'title'),
      author: this.requiredString(book, 'author'),
      addedAt: this.requiredNumber(book, 'addedAt'),
    };
    const coverUrl = this.optionalString(book, 'coverUrl');
    const intro = this.optionalString(book, 'intro');
    const lastChapter = this.optionalString(book, 'lastChapter');
    const lastReadAt = this.optionalNumber(book, 'lastReadAt');
    if (coverUrl !== undefined) {
      decoded.coverUrl = coverUrl;
    }
    if (intro !== undefined) {
      decoded.intro = intro;
    }
    if (lastChapter !== undefined) {
      decoded.lastChapter = lastChapter;
    }
    if (lastReadAt !== undefined) {
      decoded.lastReadAt = lastReadAt;
    }
    return decoded;
  }

  private requiredString(value: JsonObject, key: string): string {
    const candidate = value[key];
    if (typeof candidate !== 'string' || candidate.length === 0) {
      throw new Error(`source.switch protocol returned invalid ${key}`);
    }
    return candidate;
  }

  private optionalString(value: JsonObject, key: string): string | undefined {
    const candidate = value[key];
    if (candidate === undefined || candidate === null) {
      return undefined;
    }
    if (typeof candidate !== 'string') {
      throw new Error(`source.switch protocol returned invalid ${key}`);
    }
    return candidate;
  }

  private requiredNumber(value: JsonObject, key: string): number {
    const candidate = value[key];
    if (typeof candidate !== 'number' || !Number.isInteger(candidate)) {
      throw new Error(`source.switch protocol returned invalid ${key}`);
    }
    return candidate;
  }

  private optionalNumber(value: JsonObject, key: string): number | undefined {
    const candidate = value[key];
    if (candidate === undefined || candidate === null) {
      return undefined;
    }
    if (typeof candidate !== 'number') {
      throw new Error(`source.switch protocol returned invalid ${key}`);
    }
    return candidate;
  }

  private requireNonNegativeInteger(value: JsonObject, key: string, command: string): number {
    const candidate = value[key];
    if (typeof candidate !== 'number' || !Number.isInteger(candidate) || candidate < 0) {
      throw new Error(`${command} returned an invalid ${key}`);
    }
    return candidate;
  }

  private requireString(value: JsonObject, key: string, command: string): string {
    const candidate = value[key];
    if (typeof candidate !== 'string' || candidate.trim().length === 0) {
      throw new Error(`${command} returned an invalid ${key}`);
    }
    return candidate;
  }

  private requireObject(value: unknown, context: string): JsonObject {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      throw new Error(`${context} returned a non-object value`);
    }
    return value as JsonObject;
  }

  private requireStringMap(value: unknown, key: string, command: string): JsonObject {
    const raw = this.requireObject(value, `${command} ${key}`);
    const decoded: JsonObject = {};
    for (const variableName of Object.keys(raw)) {
      const variableValue = raw[variableName];
      if (typeof variableValue !== 'string') {
        throw new Error(`${command} returned invalid ${key}`);
      }
      decoded[variableName] = variableValue;
    }
    return decoded;
  }

  private assertNonBlankString(value: string, field: string): void {
    if (typeof value !== 'string' || value.trim().length === 0) {
      throw new Error(`${field} must be a non-blank string`);
    }
  }
}

/**
 * Pure mapping from a discovered candidate + its fetched TOC into the
 * `source.switch.commit` params. Keeps Index thin and the mapping testable.
 */
export function buildSourceSwitchCommitParams(
  from: { sourceId: string; bookId: string },
  candidate: SourceSwitchCandidate,
  toc: SourceSwitchTargetToc,
  currentChapterTitle: string,
  currentChapterIndex: number,
  updatedAt: number,
): SourceSwitchCommitParams {
  const target: SourceSwitchTarget = {
    sourceId: candidate.sourceId,
    bookId: candidate.bookUrl,
    title: candidate.bookName,
  };
  if (candidate.author !== undefined) {
    target.author = candidate.author;
  }
  if (candidate.coverUrl !== undefined) {
    target.coverUrl = candidate.coverUrl;
  }
  const newToc: SourceSwitchNewTocEntry[] = [];
  for (const entry of toc.entries) {
    newToc.push({
      chapterId: entry.url,
      chapterTitle: entry.title,
      chapterUrl: entry.url,
      order: entry.index,
    });
  }
  return {
    from,
    target,
    newToc,
    currentChapterTitle,
    currentChapterIndex,
    updatedAt,
  };
}
