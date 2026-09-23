/**
 * Source-backed paragraph boundary semantics used before physical pagination.
 *
 * Core's local TXT parser and remote HTML normalizer both project natural
 * paragraphs as non-empty lines separated by a single `\n`. Local structured
 * extraction (currently EPUB XHTML) keeps blank lines between semantic
 * paragraphs, while a single `\n` may be an explicit `<br>` inside one block.
 */
export type ReadingParagraphBoundaryMode = 'lineSeparated' | 'blankLineSeparated';

/** One half-open UTF-16 range in the unmodified Core chapter content. */
export type ReadingParagraphUtf16Range = {
  startUtf16: number;
  endUtf16: number;
};

export function readingParagraphBoundaryMode(
  sourceId: string,
  bookKind: string | undefined,
): ReadingParagraphBoundaryMode {
  const normalizedKind = bookKind?.trim().toUpperCase();
  // The production TXT import paths (parse_txt_book_with_policy and
  // parse_txt_book_with_txt_toc_rules) persist Book.kind = "local". The
  // standalone txt::ParsedTxt parser uses "TXT". Both carry line-separated
  // paragraphs; treating the production tag as structured content merges
  // adjacent paragraphs and removes their first-line indent and spacing.
  if (sourceId !== 'local' || normalizedKind === 'TXT' || normalizedKind === 'LOCAL') {
    return 'lineSeparated';
  }
  return 'blankLineSeparated';
}

export function collectReadingParagraphUtf16Ranges(
  content: string,
  mode: ReadingParagraphBoundaryMode,
): ReadingParagraphUtf16Range[] {
  const scanner = new ReadingParagraphScanner(content, mode);
  while (!scanner.step(8192)) {}
  return scanner.ranges;
}

/** Prepare privately and yield so expansion cannot monopolize the UI thread. */
export async function prepareReadingParagraphUtf16Ranges(content: string,
  mode: ReadingParagraphBoundaryMode, isCurrent: () => boolean): Promise<ReadingParagraphUtf16Range[] | undefined> {
  const scanner = new ReadingParagraphScanner(content, mode);
  while (isCurrent()) {
    if (scanner.step(8192)) return isCurrent() ? scanner.ranges : undefined;
    await new Promise<void>((resolve): void => { setTimeout(resolve, 0); });
  }
  return undefined;
}

class ReadingParagraphScanner {
  readonly ranges: ReadingParagraphUtf16Range[] = [];
  private start = 0;
  private cursor = 0;
  private dividerStart = -1;
  private dividerEnd = 0;
  private breaks = 0;
  private next = 0;
  private finished = false;

  private readonly content: string;
  private readonly mode: ReadingParagraphBoundaryMode;

  constructor(content: string, mode: ReadingParagraphBoundaryMode) {
    this.content = content; this.mode = mode;
  }

  step(budget: number): boolean {
    if (this.finished) return true;
    for (let work = 0; work < budget; work += 1) {
      if (this.dividerStart >= 0) {
        const character = this.content.charAt(this.next);
        if (character === ' ' || character === '\t') { this.next += 1; continue; }
        const end = readingLogicalBreakEnd(this.content, this.next);
        if (end !== this.next) {
          this.dividerEnd = end; this.next = end; this.breaks += 1; continue;
        }
        if (this.breaks >= 2) {
          appendReadingParagraphUtf16Range(this.ranges, this.content, this.start, this.dividerStart);
          this.start = this.dividerEnd;
        }
        this.cursor = this.dividerEnd;
        this.dividerStart = -1;
      }
      if (this.cursor >= this.content.length) {
        appendReadingParagraphUtf16Range(this.ranges, this.content, this.start, this.content.length);
        this.finished = true;
        return true;
      }
      const end = readingLogicalBreakEnd(this.content, this.cursor);
      if (end === this.cursor) { this.cursor += 1; continue; }
      if (this.mode === 'lineSeparated') {
        appendReadingParagraphUtf16Range(this.ranges, this.content, this.start, this.cursor);
        this.start = end; this.cursor = end;
      } else {
        this.dividerStart = this.cursor; this.dividerEnd = end;
        this.breaks = 1; this.next = end;
      }
    }
    return false;
  }
}

/** Consume CRLF atomically, retaining offsets in the unmodified Core string. */
function readingLogicalBreakEnd(content: string, index: number): number {
  const character = content.charAt(index);
  if (character === '\r') return index + (content.charAt(index + 1) === '\n' ? 2 : 1);
  return character === '\n' ? index + 1 : index;
}

function appendReadingParagraphUtf16Range(
  ranges: ReadingParagraphUtf16Range[],
  content: string,
  startUtf16: number,
  endUtf16: number,
): void {
  if (endUtf16 <= startUtf16 || content.substring(startUtf16, endUtf16).trim().length === 0) {
    return;
  }
  ranges.push({ startUtf16, endUtf16 });
}

/** A bounded block read may start/end inside a semantic paragraph. Only
 * complete original paragraphs can be shaped: bidi, combining characters and
 * indentation must retain their original context. Missing context is an
 * explicit miss; callers can expand or use the complete chapter path. */
export function completeReadingParagraphWindow(content: string, mode: ReadingParagraphBoundaryMode,
  beginsChapter: boolean, endsChapter: boolean, requestedUtf16: number): ReadingParagraphUtf16Range | undefined {
  if (!Number.isSafeInteger(requestedUtf16) || requestedUtf16 < 0 || requestedUtf16 > content.length)
    throw new Error('paragraph window anchor is out of range');
  const ranges = collectReadingParagraphUtf16Ranges(content, mode);
  // Discard edge paragraphs unless the chapter boundary proves them complete.
  // Even a leading break could be half of CRLF or a blank-line separator.
  const complete = ranges.filter((range: ReadingParagraphUtf16Range, index: number): boolean =>
    (beginsChapter || index > 0) && (endsChapter || index < ranges.length - 1));
  if (complete.length === 0) return undefined;
  const first = complete[0], last = complete[complete.length - 1];
  if (requestedUtf16 < first.startUtf16 && (!beginsChapter || content.substring(requestedUtf16, first.startUtf16).trim().length > 0))
    return undefined;
  if (requestedUtf16 >= last.endUtf16 && (!endsChapter || content.substring(last.endUtf16, requestedUtf16).trim().length > 0))
    return undefined;
  return { startUtf16: first.startUtf16, endUtf16: last.endUtf16 };
}
