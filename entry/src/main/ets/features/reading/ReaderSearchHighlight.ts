export type ReaderSearchSnippetParts = {
  readonly prefix: string;
  readonly match: string;
  readonly suffix: string;
};

/**
 * Converts Core Unicode-scalar search offsets to the UTF-16 slices used by
 * ArkUI. The visible snippet can be shorter than a stale result range, so the
 * conversion clamps at its real string end rather than fabricating content.
 */
export function splitReaderSearchSnippet(
  snippet: string,
  snippetStart: number,
  chapterOffset: number,
  matchLength: number,
): ReaderSearchSnippetParts {
  const localStart = Math.max(0, chapterOffset - snippetStart);
  const localEnd = Math.max(localStart, localStart + matchLength);
  const startUtf16 = utf16IndexForScalar(snippet, localStart);
  const endUtf16 = utf16IndexForScalar(snippet, localEnd);
  return {
    prefix: snippet.substring(0, startUtf16),
    match: snippet.substring(startUtf16, endUtf16),
    suffix: snippet.substring(endUtf16),
  };
}

function utf16IndexForScalar(value: string, requestedScalar: number): number {
  const target = Math.max(0, requestedScalar);
  let scalar = 0;
  let utf16 = 0;
  while (utf16 < value.length && scalar < target) {
    const first = value.charCodeAt(utf16);
    const isHighSurrogate = first >= 0xD800 && first <= 0xDBFF;
    const hasLowSurrogate = isHighSurrogate && utf16 + 1 < value.length &&
      value.charCodeAt(utf16 + 1) >= 0xDC00 && value.charCodeAt(utf16 + 1) <= 0xDFFF;
    utf16 += hasLowSurrogate ? 2 : 1;
    scalar += 1;
  }
  return utf16;
}
