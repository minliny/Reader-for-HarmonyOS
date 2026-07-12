// Typed Core-result projection for the future ReaderUIRuntime book.open Pilot.
//
// The shared runtime owns transaction order and selected chapter index. This
// file owns only mechanical Core DTO -> Harmony DomainState translation. Raw
// Legado variables stay as JsonObject references in a correlation-scoped
// context; they are never serialized into ad-hoc strings or copied into the UI
// runtime payload.
import type { JsonObject } from '../../bridge/core/sdk/reader_core';
import {
  BookDetail,
  ChapterTocEntry,
  CoreBookshelfBook,
  CoreReaderCanonicalLocation,
  CoreSourceEntry,
} from './ReaderUiState';

export type ReaderBookOpenSourceKind = 'remote' | 'local';

export interface ReaderBookOpenDetailContext {
  book: BookDetail;
  tocUrl: string;
  variables?: JsonObject;
}

export interface ReaderBookOpenTocEntryContext {
  index: number;
  title: string;
  chapterId: string;
  variables?: JsonObject;
}

export interface ReaderBookOpenTocContext {
  // One entry for every Core TOC row. Invalid rows remain addressable so the
  // Host cannot silently shift the runtime-selected chapter index.
  entries: ReaderBookOpenTocEntryContext[];
  // Renderer-safe rows omit entries that Core did not give a chapter URL.
  visibleEntries: ChapterTocEntry[];
  chapterCount: number;
}

export interface ReaderBookOpenSelectedChapterContext {
  index: number;
  title: string;
  chapterId: string;
  // Entry variables win; detail variables are retained as the typed fallback.
  variables?: JsonObject;
}

export interface ReaderBookOpenContentContext {
  chapter: ReaderBookOpenSelectedChapterContext;
  paragraphs: string[];
}

// Preserve the Core-owned reflow rule alongside the canonical identity. The
// Store projects the canonical location/revision; this correlation-scoped
// context retains the complete typed handoff for the next reader-layout step.
export interface ReaderBookOpenLocationReflowContext {
  strategy: 'offsetAnchor';
  primaryAnchor: 'chapterOffset';
  fallbackAnchor: 'chapterProgress';
  layoutIndependent: boolean;
}

export interface ReaderBookOpenLocationContext {
  canonicalLocation: CoreReaderCanonicalLocation;
  reflow: ReaderBookOpenLocationReflowContext;
}

/**
 * Correlation-scoped Host ledger shape. It is Core/Domain context, not another
 * UI reducer or a platform copy of the ReaderUIRuntime action table.
 */
export interface ReaderBookOpenDomainContext {
  correlationId: string;
  sourceKind: ReaderBookOpenSourceKind;
  sourceId: string;
  bookId: string;
  detail?: ReaderBookOpenDetailContext;
  toc?: ReaderBookOpenTocContext;
  selectedChapter?: ReaderBookOpenSelectedChapterContext;
  content?: ReaderBookOpenContentContext;
  location?: ReaderBookOpenLocationContext;
}

export class ReaderBookOpenDomainMapper {
  static mapRemoteDetail(data: JsonObject, requestedBookId: string,
    source: CoreSourceEntry): ReaderBookOpenDetailContext {
    const book = ReaderBookOpenDomainMapper.objectField(data, 'book') ?? {} as JsonObject;
    const detail: BookDetail = {
      bookId: ReaderBookOpenDomainMapper.stringField(book, 'bookId', requestedBookId),
      sourceId: source.sourceId,
      title: ReaderBookOpenDomainMapper.stringField(book, 'title', '未知书名'),
      author: ReaderBookOpenDomainMapper.stringField(book, 'author', '未知作者'),
      coverUrl: ReaderBookOpenDomainMapper.stringField(book, 'coverUrl'),
      summary: ReaderBookOpenDomainMapper.stringField(book, 'intro'),
      sourceName: source.name,
      sourceUrl: source.baseUrl,
      latestChapter: ReaderBookOpenDomainMapper.stringField(book, 'lastChapter'),
      chapterListUrl: ReaderBookOpenDomainMapper.stringField(data, 'tocUrl', requestedBookId),
    };
    return {
      book: detail,
      tocUrl: detail.chapterListUrl,
      variables: ReaderBookOpenDomainMapper.objectField(data, 'variables'),
    };
  }

  static mapLocalDetail(book: CoreBookshelfBook): ReaderBookOpenDetailContext {
    const detail: BookDetail = {
      bookId: book.bookId,
      sourceId: 'local',
      title: book.title,
      author: book.author,
      coverUrl: book.coverUrl,
      summary: book.intro,
      sourceName: '本地导入',
      sourceUrl: '',
      latestChapter: book.lastChapter,
      chapterListUrl: book.bookId,
    };
    return { book: detail, tocUrl: book.bookId };
  }

  static mapToc(data: JsonObject): ReaderBookOpenTocContext {
    const rawValue = data['toc'] as Object;
    if (!Array.isArray(rawValue)) {
      return { entries: [], visibleEntries: [], chapterCount: 0 };
    }

    const rows = rawValue as Object[];
    const entries: ReaderBookOpenTocEntryContext[] = [];
    const visibleEntries: ChapterTocEntry[] = [];
    for (let position = 0; position < rows.length; position += 1) {
      const rowValue = rows[position];
      const row = rowValue !== null && typeof rowValue === 'object' && !Array.isArray(rowValue)
        ? rowValue as Object as JsonObject : {} as JsonObject;
      const index = ReaderBookOpenDomainMapper.numberField(row, 'index', position);
      const title = ReaderBookOpenDomainMapper.stringField(row, 'title', `第 ${position + 1} 章`);
      const chapterId = ReaderBookOpenDomainMapper.stringField(row, 'url');
      const entry: ReaderBookOpenTocEntryContext = {
        index: index,
        title: title,
        chapterId: chapterId,
        variables: ReaderBookOpenDomainMapper.objectField(row, 'variables'),
      };
      entries.push(entry);
      if (chapterId.length > 0) {
        visibleEntries.push({ index: index, title: title, chapterId: chapterId });
      }
    }
    return {
      entries: entries,
      visibleEntries: visibleEntries,
      chapterCount: entries.length,
    };
  }

  /** Select exactly the index chosen by ReaderUIRuntime; never clamp or skip. */
  static selectChapter(toc: ReaderBookOpenTocContext, selectedIndex: number,
    detailVariables?: JsonObject): ReaderBookOpenSelectedChapterContext {
    if (!Number.isInteger(selectedIndex) || selectedIndex < 0 || selectedIndex >= toc.entries.length) {
      throw new Error(`Core TOC does not contain runtime-selected chapter index ${selectedIndex}`);
    }
    const entry = toc.entries[selectedIndex];
    if (entry.chapterId.length === 0) {
      throw new Error(`Core TOC chapter index ${selectedIndex} has no chapter URL`);
    }
    return {
      index: entry.index,
      title: entry.title,
      chapterId: entry.chapterId,
      variables: entry.variables ?? detailVariables,
    };
  }

  static mapContent(data: JsonObject,
    chapter: ReaderBookOpenSelectedChapterContext): ReaderBookOpenContentContext {
    const contentValue = data['content'] as Object;
    const content = typeof contentValue === 'string' ? contentValue : '';
    const normalized = content
      .replace(/<br\s*\/?>\s*<br\s*\/?>/g, '\n')
      .replace(/<\/p>\s*<p[^>]*>/g, '\n')
      .replace(/<p[^>]*>/g, '')
      .replace(/<\/p>/g, '\n');
    const lines = normalized.split('\n');
    const paragraphs: string[] = [];
    for (let index = 0; index < lines.length; index += 1) {
      const text = lines[index]
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .trim();
      if (text.length > 0) paragraphs.push(text);
    }
    return { chapter: chapter, paragraphs: paragraphs };
  }

  /**
   * `reader.location.resolve` closes book.open only when its Core result is a
   * complete, identity-matching canonical location. A syntactically successful
   * response for a different book/chapter must fail the correlation rather
   * than silently completing the visible reader with a foreign revision.
   */
  static mapLocation(data: JsonObject, expectedBookId: string,
    expectedChapterIndex: number): ReaderBookOpenLocationContext {
    if (data['resolved'] !== true) {
      throw new Error('reader.location.resolve requires resolved=true');
    }
    const canonical = ReaderBookOpenDomainMapper.objectField(data, 'canonicalLocation');
    if (canonical === undefined) {
      throw new Error('reader.location.resolve requires canonicalLocation');
    }
    const bookId = ReaderBookOpenDomainMapper.requiredString(canonical, 'bookId', 'canonicalLocation');
    const chapterIndex = ReaderBookOpenDomainMapper.requiredNonNegativeInteger(
      canonical, 'chapterIndex', 'canonicalLocation',
    );
    const chapterOffset = ReaderBookOpenDomainMapper.requiredNonNegativeInteger(
      canonical, 'chapterOffset', 'canonicalLocation',
    );
    const chapterProgress = ReaderBookOpenDomainMapper.requiredProgress(
      canonical, 'chapterProgress', 'canonicalLocation',
    );
    const locationRevision = ReaderBookOpenDomainMapper.requiredString(
      canonical, 'locationRevision', 'canonicalLocation',
    );
    const resolverVersion = ReaderBookOpenDomainMapper.requiredString(data, 'resolverVersion', 'result');
    if (bookId !== expectedBookId || chapterIndex !== expectedChapterIndex) {
      throw new Error(
        `reader.location.resolve identity mismatch expected ${expectedBookId}/${expectedChapterIndex}` +
        ` got ${bookId}/${chapterIndex}`,
      );
    }

    const reflow = ReaderBookOpenDomainMapper.objectField(data, 'reflow');
    if (reflow === undefined) throw new Error('reader.location.resolve requires reflow');
    const strategy = ReaderBookOpenDomainMapper.requiredString(reflow, 'strategy', 'reflow');
    const primaryAnchor = ReaderBookOpenDomainMapper.requiredString(reflow, 'primaryAnchor', 'reflow');
    const fallbackAnchor = ReaderBookOpenDomainMapper.requiredString(reflow, 'fallbackAnchor', 'reflow');
    const reflowBooleans = reflow as Object as Record<string, boolean>;
    const layoutIndependent: boolean = reflowBooleans['layoutIndependent'] === true;
    if (strategy !== 'offsetAnchor' || primaryAnchor !== 'chapterOffset' ||
      fallbackAnchor !== 'chapterProgress' || layoutIndependent !== true) {
      throw new Error('reader.location.resolve returned unsupported reflow contract');
    }

    return {
      canonicalLocation: {
        bookId: bookId,
        chapterIndex: chapterIndex,
        chapterOffset: chapterOffset,
        chapterProgress: chapterProgress,
        locationRevision: locationRevision,
        resolverVersion: resolverVersion,
      },
      reflow: {
        strategy: 'offsetAnchor',
        primaryAnchor: 'chapterOffset',
        fallbackAnchor: 'chapterProgress',
        layoutIndependent: true,
      },
    };
  }

  private static objectField(data: JsonObject, key: string): JsonObject | undefined {
    const value = data[key] as Object;
    if (value !== null && value !== undefined && typeof value === 'object' && !Array.isArray(value)) {
      return value as Object as JsonObject;
    }
    return undefined;
  }

  private static stringField(data: JsonObject, key: string, fallback: string = ''): string {
    const value = data[key] as Object;
    return typeof value === 'string' ? value : fallback;
  }

  private static numberField(data: JsonObject, key: string, fallback: number): number {
    const value = data[key] as Object;
    return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
  }

  private static requiredString(data: JsonObject, key: string, scope: string): string {
    const value = data[key] as Object;
    if (typeof value !== 'string' || value.length === 0) {
      throw new Error(`reader.location.resolve ${scope}.${key} must be non-empty string`);
    }
    return value;
  }

  private static requiredNonNegativeInteger(data: JsonObject, key: string, scope: string): number {
    const value = data[key] as Object;
    if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
      throw new Error(`reader.location.resolve ${scope}.${key} must be non-negative integer`);
    }
    return value;
  }

  private static requiredProgress(data: JsonObject, key: string, scope: string): number {
    const value = data[key] as Object;
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1) {
      throw new Error(`reader.location.resolve ${scope}.${key} must be in [0, 1]`);
    }
    return value;
  }
}
