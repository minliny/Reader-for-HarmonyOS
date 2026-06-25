// ImportPipeline — complete local book import flow
import { TXTParser, TXTParseResult } from '../parser/TXTParser';
import { EPUBParserContract, EPUBMapping } from '../parser/EPUBParserContract';
import { BookshelfService } from './BookshelfService';
import { LocalBook, LocalBookFormat, LocalTOCItem, LocalBookImportResult, LocalBookImportWarning, ChapterSplitPolicy, SplitPattern } from '../models/LocalBook';
import { IBookshelfRepository } from '../repository/BookshelfRepository';

export interface ImportOptions {
  encoding?: string;
  splitPolicy?: ChapterSplitPolicy;
  metadataOverrides?: Record<string, string>;
}

export class ImportPipeline {
  private txtParser: TXTParser;
  private epubParser: EPUBParserContract | null;
  private bookshelf: BookshelfService;

  constructor(bookshelf: BookshelfService, epubParser?: EPUBParserContract) {
    this.txtParser = new TXTParser();
    this.epubParser = epubParser ?? null;
    this.bookshelf = bookshelf;
  }

  async importFile(filePath: string, format: LocalBookFormat, data: Uint8Array, options?: ImportOptions): Promise<LocalBookImportResult> {
    const warnings: LocalBookImportWarning[] = [];
    const opts = options ?? {};

    // Detect encoding if not provided
    let encoding = opts.encoding ?? this.detectEncoding(data);
    if (opts.encoding && encoding !== opts.encoding) {
      const ctx: Record<string, string> = {};
      ctx['detected'] = encoding;
      ctx['requested'] = opts.encoding!;
      const warning: LocalBookImportWarning = {
        code: 'ENCODING_FALLBACK',
        message: `Fell back from ${opts.encoding} to ${encoding}`,
        context: ctx
      };
      warnings.push(warning);
    }

    // Parse content
    const policy: ChapterSplitPolicy = opts.splitPolicy ?? { pattern: SplitPattern.auto };
    let toc: LocalTOCItem[] = [];
    let content = '';
    let book: LocalBook | null = null;

    if (format === LocalBookFormat.txt || format === LocalBookFormat.html) {
      const result = this.txtParser.parse(data, encoding, policy);
      toc = result.toc;
      content = result.content;
      encoding = result.encoding;

      const newBook: LocalBook = {
        id: '', title: filePath.split('/').pop()?.replace(/\.[^.]+$/, '') ?? 'Unknown',
        filePath, fileFormat: format, fileSize: result.byteCount,
        encoding: result.encoding, addedAt: Date.now(), unknownFields: {}
      };
      book = newBook;
    } else if (format === LocalBookFormat.epub && this.epubParser) {
      try {
        const epubResult = await this.epubParser.parse(data);
        book = EPUBMapping.toLocalBook(epubResult.metadata);
        book.filePath = filePath;
        book.addedAt = Date.now();
        toc = EPUBMapping.toTOCItems(epubResult.navPoints);
      } catch (_e) {
        const failWarning: LocalBookImportWarning = { code: 'EPUB_PARSE_FAILED', message: 'EPUB parsing not available (adapter scope)' };
        const failResult: LocalBookImportResult = {
          book: this.emptyBook(filePath, format),
          toc: [],
          warnings: [failWarning]
        };
        return failResult;
      }
    } else {
      book = this.emptyBook(filePath, format);
      const formatWarning: LocalBookImportWarning = { code: 'FORMAT_NOT_SUPPORTED', message: `Format ${format} not supported` };
      warnings.push(formatWarning);
    }

    // Apply metadata overrides
    if (book && opts.metadataOverrides) {
      if (opts.metadataOverrides['title']) { book.title = opts.metadataOverrides['title']; }
      if (opts.metadataOverrides['author']) { book.author = opts.metadataOverrides['author']; }
    }

    // Store
    if (book) {
      const added = this.bookshelf.addBook(book.title, book.filePath, book.fileFormat, book.author, book.fileSize, book.encoding);
      if (added) {
        book.id = added.id;
      } else {
        const dupWarning: LocalBookImportWarning = { code: 'DUPLICATE', message: 'Book already exists in bookshelf' };
        warnings.push(dupWarning);
      }
    }

    const importResult: LocalBookImportResult = {
      book: book ?? this.emptyBook(filePath, format),
      toc,
      warnings
    };
    return importResult;
  }

  // Duplicate detection
  isDuplicate(filePath: string, fileSize?: number): boolean {
    const all = this.bookshelf.listAll();
    for (let i = 0; i < all.length; i++) {
      const b = all[i];
      if (b.filePath === filePath) { return true; }
      if (fileSize !== undefined && b.fileSize === fileSize) { return true; }
    }
    return false;
  }

  /**
   * Import a file selected via the platform file picker. The display name is
   * used as the source path (raw URIs are not persisted); format is inferred
   * from the extension. Falls back to LocalBookFormat.unknown for unrecognized
   * extensions so the import path remains bounded.
   */
  async importPicked(displayName: string, data: Uint8Array, mimeType: string, options?: ImportOptions): Promise<LocalBookImportResult> {
    const format = this.inferFormat(displayName, mimeType);
    const sandboxPath = `sandbox://picked/${displayName}`;
    return this.importFile(sandboxPath, format, data, options);
  }

  private inferFormat(displayName: string, mimeType: string): LocalBookFormat {
    const ext = displayName.split('.').pop()?.toLowerCase();
    if (ext === 'txt') { return LocalBookFormat.txt; }
    if (ext === 'epub') { return LocalBookFormat.epub; }
    if (ext === 'cbz') { return LocalBookFormat.cbz; }
    if (ext === 'html' || ext === 'htm') { return LocalBookFormat.html; }
    if (ext === 'pdf') { return LocalBookFormat.pdf; }
    if (mimeType.indexOf('text/plain') === 0) { return LocalBookFormat.txt; }
    if (mimeType.indexOf('application/epub') === 0) { return LocalBookFormat.epub; }
    return LocalBookFormat.unknown;
  }

  private detectEncoding(data: Uint8Array): string {
    if (data.byteLength >= 3 && data[0] === 0xEF && data[1] === 0xBB && data[2] === 0xBF) { return 'utf-8'; }
    if (data.byteLength >= 2 && data[0] === 0xFF && data[1] === 0xFE) { return 'utf-16le'; }
    return 'utf-8';
  }

  private emptyBook(filePath: string, format: LocalBookFormat): LocalBook {
    return { id: '', title: 'Unknown', filePath, fileFormat: format, addedAt: Date.now(), unknownFields: {} };
  }
}
