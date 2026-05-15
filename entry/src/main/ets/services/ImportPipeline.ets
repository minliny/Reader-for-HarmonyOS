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
      warnings.push({ code: 'ENCODING_FALLBACK', message: `Fell back from ${opts.encoding} to ${encoding}`,
        context: { detected: encoding, requested: opts.encoding! } });
    }

    // Parse content
    const policy = opts.splitPolicy ?? { pattern: SplitPattern.auto };
    let toc: LocalTOCItem[] = [];
    let content = '';
    let book: LocalBook | null = null;

    if (format === LocalBookFormat.txt || format === LocalBookFormat.html) {
      const result = this.txtParser.parse(data, encoding, policy);
      toc = result.toc;
      content = result.content;
      encoding = result.encoding;

      book = {
        id: '', title: filePath.split('/').pop()?.replace(/\.[^.]+$/, '') ?? 'Unknown',
        filePath, fileFormat: format, fileSize: result.byteCount,
        encoding: result.encoding, addedAt: Date.now(), unknownFields: {}
      };
    } else if (format === LocalBookFormat.epub && this.epubParser) {
      try {
        const epubResult = await this.epubParser.parse(data);
        book = EPUBMapping.toLocalBook(epubResult.metadata);
        book.filePath = filePath;
        book.addedAt = Date.now();
        toc = EPUBMapping.toTOCItems(epubResult.navPoints);
      } catch (_e) {
        return { book: this.emptyBook(filePath, format), toc: [], warnings:
          [{ code: 'EPUB_PARSE_FAILED', message: 'EPUB parsing not available (adapter scope)' }] };
      }
    } else {
      book = this.emptyBook(filePath, format);
      warnings.push({ code: 'FORMAT_NOT_SUPPORTED', message: `Format ${format} not supported` });
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
        warnings.push({ code: 'DUPLICATE', message: 'Book already exists in bookshelf' });
      }
    }

    return {
      book: book ?? this.emptyBook(filePath, format),
      toc,
      warnings
    };
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

  private detectEncoding(data: Uint8Array): string {
    if (data.byteLength >= 3 && data[0] === 0xEF && data[1] === 0xBB && data[2] === 0xBF) { return 'utf-8'; }
    if (data.byteLength >= 2 && data[0] === 0xFF && data[1] === 0xFE) { return 'utf-16le'; }
    return 'utf-8';
  }

  private emptyBook(filePath: string, format: LocalBookFormat): LocalBook {
    return { id: '', title: 'Unknown', filePath, fileFormat: format, addedAt: Date.now(), unknownFields: {} };
  }
}
