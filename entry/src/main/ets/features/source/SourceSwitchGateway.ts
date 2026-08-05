import type { JsonObject, RequestOptions } from '@reader/core-harmony';
import { ReaderRuntimeOwner } from '../../app/ReaderRuntimeOwner';
import type { ShelfBook } from '../../app/ReaderCoreGateway';

/**
 * Page-facing source-switch candidate. Only the first three fields are real
 * Core `change.bookSource` data today; `latencyMs`/`offline`/`timeout` are
 * future-data hooks the panel renders as "—"/normal when absent.
 */
export type SourceSwitchCandidate = {
  sourceId: string;
  bookUrl: string;
  bookName: string;
  author?: string;
  coverUrl?: string;
  latencyMs?: number;
  offline?: boolean;
  timeout?: boolean;
};

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

export type SourceSwitchCommitOutcome =
  | { status: 'success'; book: ShelfBook; rollbackToken: string }
  | { status: 'failed'; error: string; rollbackToken?: string };

export type SourceSwitchRollbackResult = {
  restoredBook: ShelfBook;
};

/**
 * Feature-local gateway for the source-switch flow. Owns the
 * `change.bookSource` / `book.toc` / `source.switch.commit` /
 * `source.switch.rollback` boundary and validates every JSON envelope before
 * the panel sees it.
 *
 * `change.bookSource` and `book.toc` are remote commands that delegate the
 * HTTP round-trip to the Host via `http.execute`. Host transport limits surface
 * as a plain Error, which Index presents through the admitted discovery/failure
 * state. The wire contract is authoritative regardless.
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
    bookId: string,
    keyword: string,
    isCurrent: (() => boolean) | undefined = undefined,
  ): Promise<SourceSwitchDiscoveryOutcome> {
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
      }
    }
    if (sourceIds.length === 0) {
      return { kind: 'noSources' };
    }
    const result = await this.runtimeOwner.request(
      'change.bookSource',
      { bookId, keyword, sourceIds },
      this.requestOptions(isCurrent),
    );
    const rawCandidates = result.data['candidates'];
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
      const entry: SourceSwitchCandidate = { sourceId, bookUrl, bookName };
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
    return { kind: 'sources', candidates };
  }

  /**
   * Fetches the target source's chapter table to build the commit `newToc`.
   * Remote command; needs the `http.execute` host.
   */
  async fetchTargetToc(
    sourceId: string,
    bookId: string,
    isCurrent: (() => boolean) | undefined = undefined,
  ): Promise<SourceSwitchTargetToc> {
    this.assertNonBlankString(sourceId, 'sourceId');
    this.assertNonBlankString(bookId, 'bookId');
    const result = await this.runtimeOwner.request(
      'book.toc',
      { sourceId, bookId },
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
   * Atomically re-points the shelf book to the target source. Storage-only
   * command (no `http.execute`), but today fails with INVALID_PARAMS because
   * the `from` remote shelf entry does not exist yet — surfaced as
   * `{ok:false}` without a rollback token.
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
    try {
      const result = await this.runtimeOwner.request(
        'source.switch.commit',
        params as unknown as JsonObject,
        this.requestOptions(isCurrent),
      );
      const rawBook = result.data['book'];
      const rawToken = result.data['rollbackToken'];
      if (typeof rawBook !== 'object' || rawBook === null || Array.isArray(rawBook)) {
        throw new Error('source.switch.commit returned an invalid book');
      }
      if (typeof rawToken !== 'string' || rawToken.length === 0) {
        throw new Error('source.switch.commit returned an invalid rollback token');
      }
      return { status: 'success', book: this.decodeShelfBook(rawBook), rollbackToken: rawToken };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { status: 'failed', error: message };
    }
  }

  /**
   * Compensates a previous commit via its verbatim rollback token. Stale
   * tokens are rejected by Core (the current reader state was overwritten).
   */
  async rollbackSwitch(
    rollbackToken: string,
    isCurrent: (() => boolean) | undefined = undefined,
  ): Promise<SourceSwitchRollbackResult> {
    this.assertNonBlankString(rollbackToken, 'rollbackToken');
    const result = await this.runtimeOwner.request(
      'source.switch.rollback',
      { rollbackToken },
      this.requestOptions(isCurrent),
    );
    const rawBook = result.data['restoredBook'];
    if (typeof rawBook !== 'object' || rawBook === null || Array.isArray(rawBook)) {
      throw new Error('source.switch.rollback returned an invalid restored book');
    }
    return { restoredBook: this.decodeShelfBook(rawBook) };
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
    if (typeof candidate !== 'string' || candidate.length === 0) {
      throw new Error(`${command} returned an invalid ${key}`);
    }
    return candidate;
  }

  private assertNonBlankString(value: string, field: string): void {
    if (typeof value !== 'string' || value.length === 0) {
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
