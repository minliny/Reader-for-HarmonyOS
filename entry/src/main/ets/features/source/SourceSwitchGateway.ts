import type { JsonObject, RequestOptions } from '@reader/core-harmony';
import { errorMessageOf } from '../../app/ErrorMessage';
import { ReaderRuntimeOwner } from '../../app/ReaderRuntimeOwner';
import type { ShelfBook } from '../../app/ReaderCoreGateway';

// Legado caps ChangeBookSourceDialog at nine workers. Keep one lane in reserve
// for the foreground reading session while avoiding one unbounded request per
// imported source.
const SOURCE_SWITCH_DISCOVERY_CONCURRENCY = 8;
const SOURCE_SWITCH_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Page-facing source-switch candidate. Discovery supplies the stable book
 * identity; the detail/TOC/content probe supplies the chapter and response
 * time fields persisted through Core `search-book.*` storage.
 */
export type SourceSwitchCandidate = {
  sourceId: string;
  sourceName?: string;
  sourceOrder?: number;
  bookUrl: string;
  bookName: string;
  author?: string;
  coverUrl?: string;
  latestChapterTitle?: string;
  currentChapterTitle?: string;
  currentChapterIndex?: number;
  chapterWordCount?: number;
  checkedAt?: number;
  latencyMs?: number;
  offline?: boolean;
  timeout?: boolean;
  isCurrent?: boolean;
};

export type SourceSwitchProbeQuery = {
  sourceId: string;
  bookId: string;
  bookName: string;
  author: string;
  currentChapterIndex: number;
  currentChapterTitle: string;
};

type SourceSwitchRegistryEntry = {
  sourceId: string;
  sourceName: string;
  sourceOrder: number;
};

type SourceSwitchCachedChapter = {
  title: string;
  index?: number;
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
  variables: JsonObject;
};

export type SourceSwitchTargetToc = {
  sourceId: string;
  bookId: string;
  bookName: string;
  author: string;
  coverUrl?: string;
  latestChapterTitle?: string;
  tocUrl: string;
  variables: JsonObject;
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
   * Legado-compatible first paint: read durable SearchBook rows, hide disabled
   * sources, and treat the one-day cache window as empty after expiry. No
   * source HTTP is attempted from this path.
   */
  async loadCachedCandidates(
    query: SourceSwitchProbeQuery,
    isCurrent: (() => boolean) | undefined = undefined,
  ): Promise<SourceSwitchCandidate[]> {
    this.validateProbeQuery(query);
    const enabledSources = await this.loadEnabledSources(isCurrent);
    const result = await this.runtimeOwner.request(
      'search-book.list',
      {},
      this.requestOptions(isCurrent),
    );
    const rawBooks = result.data['books'];
    if (!Array.isArray(rawBooks)) {
      throw new Error('search-book.list returned invalid data');
    }
    const now = Date.now();
    const staleBookUrls: string[] = [];
    const candidates: SourceSwitchCandidate[] = [];
    for (const raw of rawBooks) {
      if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
        throw new Error('search-book.list returned a non-object row');
      }
      const book = raw as JsonObject;
      if (!this.matchesCachedBook(book, query)) {
        continue;
      }
      const bookUrl = this.requireString(book, 'bookUrl', 'search-book.list');
      const checkedAt = this.optionalNumber(book, 'time') ?? 0;
      if (checkedAt <= 0 || now - checkedAt >= SOURCE_SWITCH_CACHE_TTL_MS) {
        staleBookUrls.push(bookUrl);
        continue;
      }
      const sourceId = this.requireString(book, 'origin', 'search-book.list');
      const source = enabledSources.get(sourceId);
      if (source === undefined) {
        continue;
      }
      candidates.push(this.decodeCachedCandidate(book, query, checkedAt, source));
    }
    if (staleBookUrls.length > 0) {
      await Promise.all(staleBookUrls.map((bookUrl: string): Promise<unknown> =>
        this.runtimeOwner.request(
          'search-book.delete',
          { bookUrl },
          this.requestOptions(isCurrent),
        )));
    }
    return this.sortCandidates(candidates);
  }

  /**
   * Full refresh: remove this book's prior SearchBook projection, rediscover
   * every enabled source, probe the mapped chapter body, and upsert each
   * completed candidate. This is the operation bound to pull-to-refresh.
   */
  async refreshCandidates(
    query: SourceSwitchProbeQuery,
    isCurrent: (() => boolean) | undefined = undefined,
  ): Promise<SourceSwitchDiscoveryOutcome> {
    this.validateProbeQuery(query);
    await this.deleteCachedCandidates(query, isCurrent);
    const discovery = await this.discoverCandidates(
      query.sourceId,
      query.bookId,
      query.bookName,
      isCurrent,
    );
    if (discovery.kind === 'noSources') {
      return discovery;
    }
    const matching = discovery.candidates.filter((candidate: SourceSwitchCandidate): boolean =>
      this.matchesCandidateBook(candidate, query));
    const probed: SourceSwitchCandidate[] = [];
    for (let start = 0; start < matching.length; start += SOURCE_SWITCH_DISCOVERY_CONCURRENCY) {
      const end = Math.min(start + SOURCE_SWITCH_DISCOVERY_CONCURRENCY, matching.length);
      const pending: Promise<SourceSwitchCandidate | undefined>[] = [];
      for (let index = start; index < end; index += 1) {
        pending.push(this.probeAndPersistCandidate(matching[index], query, isCurrent));
      }
      const batch = await Promise.all(pending);
      for (const candidate of batch) {
        if (candidate !== undefined) {
          probed.push(candidate);
        }
      }
    }
    return probed.length === 0
      ? { kind: 'noSources' }
      : { kind: 'sources', candidates: this.sortCandidates(probed) };
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
    const sources: SourceSwitchRegistryEntry[] = [];
    for (let sourceOrder = 0; sourceOrder < rawSources.length; sourceOrder += 1) {
      const raw = rawSources[sourceOrder];
      if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
        continue;
      }
      const source = raw as JsonObject;
      if (source['enabled'] !== true) {
        continue;
      }
      const sourceId = this.optionalString(source, 'sourceId');
      if (sourceId !== undefined && sourceId.length > 0) {
        const sourceName = this.optionalString(source, 'name');
        sources.push({
          sourceId,
          sourceName: sourceName === undefined || sourceName.trim().length === 0 ? sourceId : sourceName,
          sourceOrder,
        });
      }
    }
    if (sources.length === 0) {
      return { kind: 'noSources' };
    }
    const candidates: SourceSwitchCandidate[] = [];
    for (let start = 0; start < sources.length; start += SOURCE_SWITCH_DISCOVERY_CONCURRENCY) {
      if (isCurrent !== undefined && !isCurrent()) {
        return { kind: 'noSources' };
      }
      const end = Math.min(start + SOURCE_SWITCH_DISCOVERY_CONCURRENCY, sources.length);
      const pending: Promise<SourceSwitchCandidate[]>[] = [];
      for (let index = start; index < end; index += 1) {
        pending.push(this.discoverFromSource(sourceId, bookId, keyword, sources[index], isCurrent));
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
    source: SourceSwitchRegistryEntry,
    isCurrent: (() => boolean) | undefined,
  ): Promise<SourceSwitchCandidate[]> {
    try {
      const candidateSourceId = source.sourceId;
      const result = await this.runtimeOwner.request(
        'change.bookSource',
        { sourceId, bookId, keyword, sourceIds: [candidateSourceId] },
        this.requestOptions(isCurrent),
      );
      return this.decodeDiscoveryCandidates(result.data, source);
    } catch (error) {
      if (isCurrent !== undefined && !isCurrent()) {
        throw error;
      }
      // A source-switch search is a batch. One dead, challenged, or malformed
      // source must not erase candidates from the remaining enabled sources.
      return [];
    }
  }

  private decodeDiscoveryCandidates(
    data: JsonObject,
    source: SourceSwitchRegistryEntry,
  ): SourceSwitchCandidate[] {
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
      const entry: SourceSwitchCandidate = {
        sourceId,
        sourceName: source.sourceName,
        sourceOrder: source.sourceOrder,
        bookUrl,
        bookName,
      };
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
    const bookName = this.requireString(detailBook, 'title', 'book.detail book');
    const author = this.optionalString(detailBook, 'author') ?? '';
    const coverUrl = this.optionalString(detailBook, 'coverUrl');
    const latestChapterTitle = this.optionalString(detailBook, 'lastChapter');
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
      const rawEntryVariables = entry['variables'];
      const entryVariables = rawEntryVariables === undefined || rawEntryVariables === null
        ? {}
        : this.requireStringMap(rawEntryVariables, 'variables', 'book.toc');
      entries.push({ index, title, url, variables: entryVariables });
    }
    const target: SourceSwitchTargetToc = {
      sourceId,
      bookId,
      bookName,
      author,
      tocUrl,
      variables,
      entries,
    };
    if (coverUrl !== undefined) {
      target.coverUrl = coverUrl;
    }
    if (latestChapterTitle !== undefined) {
      target.latestChapterTitle = latestChapterTitle;
    }
    return target;
  }

  private async probeAndPersistCandidate(
    candidate: SourceSwitchCandidate,
    query: SourceSwitchProbeQuery,
    isCurrent: (() => boolean) | undefined,
  ): Promise<SourceSwitchCandidate | undefined> {
    try {
      const toc = await this.fetchTargetToc(candidate.sourceId, candidate.bookUrl, isCurrent);
      if (toc.entries.length === 0) {
        return undefined;
      }
      const chapter = this.matchProbeChapter(toc.entries, query);
      const startedAt = Date.now();
      let wordCount = -1;
      let failureMessage: string | undefined = undefined;
      try {
        const content = await this.runtimeOwner.request(
          'chapter.content',
          {
            sourceId: candidate.sourceId,
            bookId: candidate.bookUrl,
            chapterTitle: chapter.title,
            chapterIndex: chapter.index,
            chapterUrl: chapter.url,
            variables: this.mergeVariables(toc.variables, chapter.variables),
          },
          this.requestOptions(isCurrent),
        );
        if (content.data['sourceId'] !== candidate.sourceId || content.data['bookId'] !== candidate.bookUrl ||
          typeof content.data['content'] !== 'string') {
          throw new Error('chapter.content returned invalid probe data');
        }
        wordCount = (content.data['content'] as string).length;
      } catch (error) {
        if (isCurrent !== undefined && !isCurrent()) {
          throw error;
        }
        failureMessage = errorMessageOf(error);
      }
      const latencyMs = Math.max(0, Date.now() - startedAt);
      const displayTitle = chapter.title.length > 20 ? `${chapter.title.substring(0, 20)}…` : chapter.title;
      const chapterWordCountText = failureMessage === undefined
        ? `[${chapter.index + 1}] ${displayTitle}\n字数：${wordCount}`
        : `[${chapter.index + 1}] ${displayTitle}\n获取字数失败：${failureMessage}`;
      const probed: SourceSwitchCandidate = {
        ...candidate,
        bookName: toc.bookName,
        author: toc.author,
        currentChapterTitle: chapter.title,
        currentChapterIndex: chapter.index,
        chapterWordCount: wordCount,
        latestChapterTitle: toc.latestChapterTitle ?? toc.entries[toc.entries.length - 1].title,
        latencyMs,
        checkedAt: Date.now(),
      };
      if (toc.coverUrl !== undefined) {
        probed.coverUrl = toc.coverUrl;
      }
      await this.persistCandidate(probed, toc.tocUrl, chapterWordCountText, isCurrent);
      return probed;
    } catch (error) {
      if (isCurrent !== undefined && !isCurrent()) {
        throw error;
      }
      // Legado's parallel refresh treats one broken detail/TOC chain as a
      // source-local failure and keeps the remaining candidates progressing.
      return undefined;
    }
  }

  private async persistCandidate(
    candidate: SourceSwitchCandidate,
    tocUrl: string,
    chapterWordCountText: string,
    isCurrent: (() => boolean) | undefined,
  ): Promise<void> {
    const params: JsonObject = {
      bookUrl: candidate.bookUrl,
      origin: candidate.sourceId,
      originName: candidate.sourceName ?? candidate.sourceId,
      type: 0,
      name: candidate.bookName,
      author: candidate.author ?? '',
      tocUrl,
      time: candidate.checkedAt ?? Date.now(),
      originOrder: candidate.sourceOrder ?? 0,
      chapterWordCountText,
      chapterWordCount: candidate.chapterWordCount ?? -1,
      respondTime: candidate.latencyMs ?? -1,
    };
    if (candidate.coverUrl !== undefined) {
      params['coverUrl'] = candidate.coverUrl;
    }
    if (candidate.latestChapterTitle !== undefined) {
      params['latestChapterTitle'] = candidate.latestChapterTitle;
    }
    await this.runtimeOwner.request(
      'search-book.put',
      params,
      this.requestOptions(isCurrent),
    );
  }

  private matchProbeChapter(
    entries: SourceSwitchTargetTocEntry[],
    query: SourceSwitchProbeQuery,
  ): SourceSwitchTargetTocEntry {
    for (const entry of entries) {
      if (entry.title === query.currentChapterTitle) {
        return entry;
      }
    }
    const normalizedTitle = this.normalizeChapterTitle(query.currentChapterTitle);
    for (const entry of entries) {
      if (this.normalizeChapterTitle(entry.title) === normalizedTitle) {
        return entry;
      }
    }
    for (const entry of entries) {
      if (entry.index === query.currentChapterIndex) {
        return entry;
      }
    }
    return entries[0];
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
      const message = errorMessageOf(error);
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

  private async loadEnabledSources(
    isCurrent: (() => boolean) | undefined,
  ): Promise<Map<string, SourceSwitchRegistryEntry>> {
    const result = await this.runtimeOwner.request(
      'source.list',
      { enabledOnly: true },
      this.requestOptions(isCurrent),
    );
    const rawSources = result.data['sources'];
    if (!Array.isArray(rawSources)) {
      throw new Error('source.list returned invalid data');
    }
    const sources = new Map<string, SourceSwitchRegistryEntry>();
    for (let sourceOrder = 0; sourceOrder < rawSources.length; sourceOrder += 1) {
      const raw = rawSources[sourceOrder];
      if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
        continue;
      }
      const source = raw as JsonObject;
      const sourceId = this.optionalString(source, 'sourceId');
      if (source['enabled'] === true && sourceId !== undefined && sourceId.trim().length > 0) {
        const sourceName = this.optionalString(source, 'name');
        sources.set(sourceId, {
          sourceId,
          sourceName: sourceName === undefined || sourceName.trim().length === 0 ? sourceId : sourceName,
          sourceOrder,
        });
      }
    }
    return sources;
  }

  private async deleteCachedCandidates(
    query: SourceSwitchProbeQuery,
    isCurrent: (() => boolean) | undefined,
  ): Promise<void> {
    const result = await this.runtimeOwner.request(
      'search-book.list',
      {},
      this.requestOptions(isCurrent),
    );
    const rawBooks = result.data['books'];
    if (!Array.isArray(rawBooks)) {
      throw new Error('search-book.list returned invalid data');
    }
    const bookUrls: string[] = [];
    for (const raw of rawBooks) {
      if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
        throw new Error('search-book.list returned a non-object row');
      }
      const book = raw as JsonObject;
      if (this.matchesCachedBook(book, query)) {
        bookUrls.push(this.requireString(book, 'bookUrl', 'search-book.list'));
      }
    }
    await Promise.all(bookUrls.map((bookUrl: string): Promise<unknown> =>
      this.runtimeOwner.request(
        'search-book.delete',
        { bookUrl },
        this.requestOptions(isCurrent),
      )));
  }

  private matchesCachedBook(book: JsonObject, query: SourceSwitchProbeQuery): boolean {
    const cachedName = this.optionalString(book, 'name');
    if (cachedName === undefined ||
      this.normalizeBookName(cachedName) !== this.normalizeBookName(query.bookName)) {
      return false;
    }
    return this.matchesAuthor(this.optionalString(book, 'author'), query.author);
  }

  private matchesCandidateBook(
    candidate: SourceSwitchCandidate,
    query: SourceSwitchProbeQuery,
  ): boolean {
    return this.normalizeBookName(candidate.bookName) === this.normalizeBookName(query.bookName) &&
      this.matchesAuthor(candidate.author, query.author);
  }

  private decodeCachedCandidate(
    book: JsonObject,
    query: SourceSwitchProbeQuery,
    checkedAt: number,
    source: SourceSwitchRegistryEntry,
  ): SourceSwitchCandidate {
    const sourceId = this.requireString(book, 'origin', 'search-book.list');
    const bookUrl = this.requireString(book, 'bookUrl', 'search-book.list');
    const bookName = this.requireString(book, 'name', 'search-book.list');
    const candidate: SourceSwitchCandidate = {
      sourceId,
      sourceName: source.sourceName,
      sourceOrder: source.sourceOrder,
      bookUrl,
      bookName,
      checkedAt,
      isCurrent: sourceSwitchCandidateKey(sourceId, bookUrl) ===
        sourceSwitchCandidateKey(query.sourceId, query.bookId),
    };
    const author = this.optionalString(book, 'author');
    const coverUrl = this.optionalString(book, 'coverUrl');
    const latestChapterTitle = this.optionalString(book, 'latestChapterTitle');
    const latencyMs = this.optionalNumber(book, 'respondTime');
    const chapterWordCount = this.optionalNumber(book, 'chapterWordCount');
    const cachedChapter = this.parseCachedChapter(this.optionalString(book, 'chapterWordCountText'));
    if (author !== undefined && author.length > 0) {
      candidate.author = author;
    }
    if (coverUrl !== undefined && coverUrl.length > 0) {
      candidate.coverUrl = coverUrl;
    }
    if (latestChapterTitle !== undefined && latestChapterTitle.length > 0) {
      candidate.latestChapterTitle = latestChapterTitle;
    }
    if (latencyMs !== undefined && latencyMs >= 0) {
      candidate.latencyMs = latencyMs;
    }
    if (chapterWordCount !== undefined && chapterWordCount >= 0) {
      candidate.chapterWordCount = chapterWordCount;
    }
    if (cachedChapter !== undefined) {
      candidate.currentChapterTitle = cachedChapter.title;
      if (cachedChapter.index !== undefined) {
        candidate.currentChapterIndex = cachedChapter.index;
      }
    }
    return candidate;
  }

  private parseCachedChapter(value: string | undefined): SourceSwitchCachedChapter | undefined {
    if (value === undefined || value.trim().length === 0) {
      return undefined;
    }
    const firstLine = value.split('\n')[0].trim();
    const match = /^\[(\d+)]\s*(.*)$/.exec(firstLine);
    if (match === null) {
      return { title: firstLine };
    }
    const oneBasedIndex = Number(match[1]);
    const title = match[2].trim();
    if (!Number.isInteger(oneBasedIndex) || oneBasedIndex <= 0 || title.length === 0) {
      return { title: firstLine };
    }
    return { title, index: oneBasedIndex - 1 };
  }

  private sortCandidates(candidates: SourceSwitchCandidate[]): SourceSwitchCandidate[] {
    return candidates.slice().sort((left: SourceSwitchCandidate, right: SourceSwitchCandidate): number => {
      const order = (left.sourceOrder ?? 0) - (right.sourceOrder ?? 0);
      if (order !== 0) {
        return order;
      }
      const leftKey = sourceSwitchCandidateKey(left.sourceId, left.bookUrl);
      const rightKey = sourceSwitchCandidateKey(right.sourceId, right.bookUrl);
      return leftKey < rightKey ? -1 : leftKey > rightKey ? 1 : 0;
    });
  }

  private normalizeBookName(value: string): string {
    return value.trim().replace(/\s+/g, ' ').toLocaleLowerCase();
  }

  private matchesAuthor(candidateAuthor: string | undefined, queryAuthor: string): boolean {
    const expected = this.normalizeAuthor(queryAuthor);
    if (expected.length === 0) {
      return true;
    }
    return candidateAuthor !== undefined && this.normalizeAuthor(candidateAuthor).includes(expected);
  }

  private normalizeAuthor(value: string): string {
    return value.trim().replace(/\s+/g, ' ').toLocaleLowerCase();
  }

  private normalizeChapterTitle(value: string): string {
    return value.trim().replace(/\s+/g, ' ').toLocaleLowerCase();
  }

  private mergeVariables(base: JsonObject, override: JsonObject): JsonObject {
    const merged: JsonObject = {};
    for (const key of Object.keys(base)) {
      merged[key] = base[key];
    }
    for (const key of Object.keys(override)) {
      merged[key] = override[key];
    }
    return merged;
  }

  private validateProbeQuery(query: SourceSwitchProbeQuery): void {
    this.assertNonBlankString(query.sourceId, 'sourceId');
    this.assertNonBlankString(query.bookId, 'bookId');
    this.assertNonBlankString(query.bookName, 'bookName');
    this.assertNonBlankString(query.currentChapterTitle, 'currentChapterTitle');
    if (!Number.isInteger(query.currentChapterIndex) || query.currentChapterIndex < 0) {
      throw new Error('currentChapterIndex must be a non-negative integer');
    }
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
