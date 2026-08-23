/**
 * Source-backed paragraph boundary semantics used before physical pagination.
 *
 * Core's local TXT parser preserves every source line with a single `\n`, so
 * each non-empty line is one natural paragraph. Structured extraction (EPUB
 * XHTML and remote HTML) reserves `\n\n` for a semantic paragraph while a
 * single `\n` may be an explicit `<br>` inside that paragraph.
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
  return sourceId === 'local' && normalizedKind === 'TXT' ?
    'lineSeparated' : 'blankLineSeparated';
}

export function collectReadingParagraphUtf16Ranges(
  content: string,
  mode: ReadingParagraphBoundaryMode,
): ReadingParagraphUtf16Range[] {
  const ranges: ReadingParagraphUtf16Range[] = [];
  const divider = mode === 'lineSeparated' ?
    /\r\n|\n|\r/g :
    /(?:\r\n|\n|\r)[\t ]*(?:\r\n|\n|\r)(?:[\t ]*(?:\r\n|\n|\r))*/g;
  let startUtf16 = 0;
  let match = divider.exec(content);
  while (match !== null) {
    appendReadingParagraphUtf16Range(ranges, content, startUtf16, match.index);
    startUtf16 = match.index + match[0].length;
    match = divider.exec(content);
  }
  appendReadingParagraphUtf16Range(ranges, content, startUtf16, content.length);
  return ranges;
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
