// LocalBookFormatPolicy — one fail-closed format boundary shared by ArkUI and
// Host adapters for Reader UI Slice 9.
//
// The UI contract names five local formats. Only TXT and EPUB can currently
// enter Core's local_book.parse/import path. PDF, MOBI and UMD still require
// frozen format/locator protocols and dedicated renderers, so recognizing
// their suffix must never imply that they can be parsed as text.

export type ReaderLocalBookFormat = 'txt' | 'epub' | 'pdf' | 'mobi' | 'umd' | 'unsupported';
export type ReaderLocalBookAdmission = 'core-import' | 'protocol-required' | 'unsupported';

export interface ReaderLocalBookFormatDecision {
  format: ReaderLocalBookFormat;
  admission: ReaderLocalBookAdmission;
  mimeType?: string;
}

export class LocalBookFormatPolicy {
  static decide(fileName: string): ReaderLocalBookFormatDecision {
    const lower = LocalBookFormatPolicy.normalizedName(fileName);
    if (lower.endsWith('.txt')) {
      return { format: 'txt', admission: 'core-import', mimeType: 'text/plain' };
    }
    if (lower.endsWith('.epub') || lower.endsWith('.epub3')) {
      return { format: 'epub', admission: 'core-import', mimeType: 'application/epub+zip' };
    }
    if (lower.endsWith('.pdf')) {
      return { format: 'pdf', admission: 'protocol-required', mimeType: 'application/pdf' };
    }
    if (lower.endsWith('.mobi')) {
      return { format: 'mobi', admission: 'protocol-required', mimeType: 'application/x-mobipocket-ebook' };
    }
    if (lower.endsWith('.umd')) {
      return { format: 'umd', admission: 'protocol-required', mimeType: 'application/x-umd' };
    }
    return { format: 'unsupported', admission: 'unsupported' };
  }

  static supportedSuffixFilters(): string[] {
    return ['.txt', '.epub', '.epub3', '.pdf', '.mobi', '.umd'];
  }

  static suffixFilterForMime(mimeType: string): string | null {
    switch (mimeType.trim().toLowerCase()) {
      case 'text/plain': return '.txt';
      case 'application/pdf': return '.pdf';
      case 'application/epub+zip': return '.epub,.epub3';
      case 'application/x-mobipocket-ebook': return '.mobi';
      case 'application/x-umd': return '.umd';
      default: return null;
    }
  }

  static protocolRequiredMessage(format: ReaderLocalBookFormat): string {
    switch (format) {
      case 'pdf':
        return 'PDF 已识别，但 PDF 文档描述、页定位与专用渲染协议尚未冻结，不能回退为文本阅读。';
      case 'mobi':
        return 'MOBI 已识别，但 MOBI 解析描述与专用阅读协议尚未冻结，不能回退为文本阅读。';
      case 'umd':
        return 'UMD 已识别，但 UMD 解析描述与专用阅读协议尚未冻结，不能回退为文本阅读。';
      default:
        return '该格式尚无已冻结的 Core 导入与专用阅读协议。';
    }
  }

  private static normalizedName(fileName: string): string {
    const withoutQuery = fileName.split('?')[0].split('#')[0];
    try {
      return decodeURIComponent(withoutQuery).trim().toLowerCase();
    } catch (_error) {
      return withoutQuery.trim().toLowerCase();
    }
  }
}
