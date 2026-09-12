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
  const ranges: ReadingParagraphUtf16Range[] = [];
  let startUtf16 = 0;
  let cursor = 0;
  while (cursor < content.length) {
    const firstEnd = readingLogicalBreakEnd(content, cursor);
    if (firstEnd === cursor) {
      cursor += 1;
      continue;
    }
    const dividerStart = cursor;
    let dividerEnd = firstEnd;
    let breakCount = 1;
    if (mode === 'blankLineSeparated') {
      while (dividerEnd < content.length) {
        let next = dividerEnd;
        while (content.charAt(next) === ' ' || content.charAt(next) === '\t') next += 1;
        const nextEnd = readingLogicalBreakEnd(content, next);
        if (nextEnd === next) break;
        dividerEnd = nextEnd;
        breakCount += 1;
      }
    }
    if (mode === 'lineSeparated' || breakCount >= 2) {
      appendReadingParagraphUtf16Range(ranges, content, startUtf16, dividerStart);
      startUtf16 = dividerEnd;
    }
    cursor = dividerEnd;
  }
  appendReadingParagraphUtf16Range(ranges, content, startUtf16, content.length);
  return ranges;
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
