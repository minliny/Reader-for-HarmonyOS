import type { ReadingBookDetail } from '../presentation/ReadingBookDetail';

export interface ReaderShareText {
  kind: 'text' | 'link';
  text: string;
  title?: string;
  description?: string;
}

export interface ReaderShareFile {
  kind: 'file';
  path: string;
  hash: string;
  extension: string;
  title: string;
}

export interface ReaderShareImage {
  kind: 'image';
  path: string;
  title: string;
}

export interface ReaderQuoteCardCopy {
  path: string;
  release: () => Promise<void>;
}

export type ReaderShareRecord = ReaderShareText | ReaderShareFile | ReaderShareImage;
export type SystemShareResult = 'shown' | 'dismissed' | 'unavailable' | 'unsafe';
export type ReaderShareResult = SystemShareResult | 'copied' | 'fileCopied' | 'quoteCopied' | 'quoteFailed' |
  'copyFailed' | 'unsafeFile' | 'retired';
export type RetainedShareFile = (bookId: string, current: () => boolean) => Promise<string | undefined>;
export type ReaderQuoteCardAction = (text: string, anchor: string, current: () => boolean) => Promise<ReaderShareResult>;

export interface SystemSharePort {
  publicLink(value: string): string | undefined;
  show(record: ReaderShareRecord, current: () => boolean): Promise<SystemShareResult>;
}

export function readerOriginalBookExtension(book: ReadingBookDetail): string | undefined {
  const kind = book.kind?.trim().toLowerCase();
  switch (kind) {
    // Core production TXT imports store the historical local alias.
    case 'local': case 'txt': case 'text': return '.txt';
    case 'epub': return '.epub';
    case 'mobi': return '.mobi';
    case 'azw': return '.azw';
    case 'azw3': case 'kf8': return '.azw3';
    default: return undefined;
  }
}

export function readerCanShareOriginal(book: ReadingBookDetail): boolean {
  return book.sourceId === 'local' && /^local:[0-9a-f]{64}$/.test(book.bookId) && readerOriginalBookExtension(book) !== undefined;
}

export class ReaderShareActions {
  private readonly port: SystemSharePort;
  private readonly copy: (text: string) => void;

  constructor(port: SystemSharePort, copy: (text: string) => void) {
    this.port = port;
    this.copy = copy;
  }

  async shareSelection(text: string, current: () => boolean, copyRequested: boolean = false): Promise<ReaderShareResult> {
    return copyRequested ? this.copyText(text, current) : this.share({ kind: 'text', text }, text, current);
  }

  async shareQuoteCard(text: string, title: string, render: () => Promise<ReaderQuoteCardCopy | undefined>,
    current: () => boolean): Promise<ReaderShareResult> {
    if (!current()) return 'retired';
    let result: SystemShareResult = 'unavailable';
    let image: ReaderQuoteCardCopy | undefined;
    try {
      image = await render();
      if (!current()) return 'retired';
      if (image !== undefined) result = await this.port.show({ kind: 'image', path: image.path, title }, current);
    } catch (_) { /* Export and platform failures fall back to the original text. */ }
    finally {
      if (image !== undefined && result !== 'shown') {
        try { await image.release(); } catch (_) { /* Cache cleanup does not change the share result. */ }
      }
    }
    if (!current()) return 'retired';
    if (result === 'shown' || result === 'dismissed') return result;
    const copied = this.copyText(text, current);
    if (copied === 'copied') return 'quoteCopied';
    return copied === 'copyFailed' ? 'quoteFailed' : copied;
  }

  async shareBook(book: ReadingBookDetail, current: () => boolean): Promise<ReaderShareResult> {
    const link = this.link(book);
    const text = this.bookText(book, link);
    const record: ReaderShareText = link === undefined ? { kind: 'text', text, title: book.title } :
      { kind: 'link', text: link, title: book.title, description: book.author.trim() };
    return this.share(record, text, current);
  }

  copyBook(book: ReadingBookDetail, current: () => boolean): ReaderShareResult {
    return this.copyText(this.bookText(book, this.link(book)), current);
  }

  async shareFile(book: ReadingBookDetail, retained: RetainedShareFile, current: () => boolean): Promise<ReaderShareResult> {
    if (!current()) return 'retired';
    const extension = readerOriginalBookExtension(book);
    if (!readerCanShareOriginal(book) || extension === undefined) return 'unsafeFile';
    const copy = this.bookText(book);
    let path: string | undefined;
    try { path = await retained(book.bookId, current); }
    catch (_) { return this.copyText(copy, current, true); }
    if (!current()) return 'retired';
    if (path === undefined) return this.copyText(copy, current, true);
    const record: ReaderShareFile = { kind: 'file', path, hash: book.bookId.slice('local:'.length), extension, title: book.title };
    return this.share(record, copy, current);
  }

  private link(book: ReadingBookDetail): string | undefined {
    if (book.sourceId === 'local') return undefined;
    return this.port.publicLink(book.sourcePageUrl ?? book.bookId);
  }

  private bookText(book: ReadingBookDetail, link?: string): string {
    return [book.title.trim() || '未命名书籍', book.author.trim(), link ?? '']
      .filter((part: string): boolean => part.length > 0).join('\n');
  }

  private async share(record: ReaderShareRecord, fallback: string, current: () => boolean): Promise<ReaderShareResult> {
    if (!current()) return 'retired';
    let result: SystemShareResult;
    try { result = await this.port.show(record, current); }
    catch (_) { result = 'unavailable'; }
    if (!current()) return 'retired';
    if (result === 'unsafe') return 'unsafeFile';
    return result === 'unavailable' ? this.copyText(fallback, current, record.kind === 'file') : result;
  }

  private copyText(text: string, current: () => boolean, file: boolean = false): ReaderShareResult {
    if (!current()) return 'retired';
    try {
      this.copy(text);
      return file ? 'fileCopied' : 'copied';
    } catch (_) {
      return 'copyFailed';
    }
  }
}
