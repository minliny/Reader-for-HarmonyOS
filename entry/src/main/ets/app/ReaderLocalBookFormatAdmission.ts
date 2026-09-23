/**
 * Product admission is intentionally narrower than Core format recognition.
 * A format enters the picker only after its Host/UI lifecycle is admitted;
 * partial parsers and metadata-only boundaries remain explicit here instead
 * of becoming user-facing support claims.
 */
export type ReaderLocalBookFormatFamily =
  'TXT' |
  'EPUB' |
  'MOBI' |
  'AZW' |
  'UMD' |
  'PDF' |
  'HTML' |
  'ARCHIVE' |
  'WEBDAV';

export type ReaderLocalBookAdmissionState = 'l0' | 'deferred-partial' | 'not-admitted';

export interface ReaderLocalBookFormatAdmission {
  family: ReaderLocalBookFormatFamily;
  suffixes: string[];
  state: ReaderLocalBookAdmissionState;
}

export const READER_LOCAL_BOOK_FORMAT_ADMISSIONS: ReaderLocalBookFormatAdmission[] = [
  { family: 'TXT', suffixes: ['.txt'], state: 'l0' },
  { family: 'EPUB', suffixes: ['.epub'], state: 'l0' },
  // libmobi-backed Core parsing and the shared local resource Host are now
  // wired through the same staging/reading lifecycle as EPUB.
  { family: 'MOBI', suffixes: ['.mobi'], state: 'l0' },
  { family: 'AZW', suffixes: ['.azw', '.azw3', '.kf8'], state: 'l0' },
  { family: 'UMD', suffixes: ['.umd'], state: 'deferred-partial' },
  { family: 'PDF', suffixes: ['.pdf'], state: 'not-admitted' },
  { family: 'HTML', suffixes: ['.html', '.htm'], state: 'not-admitted' },
  { family: 'ARCHIVE', suffixes: ['.zip', '.tar', '.rar', '.7z'], state: 'not-admitted' },
  { family: 'WEBDAV', suffixes: [], state: 'not-admitted' },
];

export const READER_LOCAL_BOOK_PICKER_FILTER: string =
  'TXT、EPUB、MOBI、AZW3|.txt,.epub,.mobi,.azw,.azw3,.kf8';

export function isReaderLocalBookFileName(fileName: string): boolean {
  const lower = fileName.toLowerCase();
  return READER_LOCAL_BOOK_FORMAT_ADMISSIONS.some((entry: ReaderLocalBookFormatAdmission): boolean =>
    entry.state === 'l0' && entry.suffixes.some((suffix: string): boolean => lower.endsWith(suffix)));
}
