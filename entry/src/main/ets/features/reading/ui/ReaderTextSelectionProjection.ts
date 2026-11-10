/** Map an ArkUI UTF-16 selection back to the unmodified fragment text. */
export function readerSelectedOriginalText(
  text: string,
  syntheticPrefixLength: number,
  start: number | undefined,
  end: number | undefined,
  windowStart: number = 0,
  windowEnd: number = text.length,
): string | undefined {
  const displayLength = syntheticPrefixLength + text.length;
  const selectionStart = start ?? 0;
  const selectionEnd = end ?? displayLength;
  if (!Number.isInteger(syntheticPrefixLength) || syntheticPrefixLength < 0 ||
    !Number.isInteger(selectionStart) || !Number.isInteger(selectionEnd) ||
    selectionStart < 0 || selectionEnd < selectionStart || selectionEnd > displayLength ||
    !Number.isInteger(windowStart) || !Number.isInteger(windowEnd) ||
    windowStart < 0 || windowEnd < windowStart || windowEnd > text.length) {
    return undefined;
  }
  // A native paragraph may extend before/after the visible page. A native
  // select-all action must not copy invisible pages or synthetic indentation.
  const originalStart = Math.max(windowStart, selectionStart - syntheticPrefixLength);
  const originalEnd = Math.min(windowEnd, Math.max(0, selectionEnd - syntheticPrefixLength));
  if (originalEnd <= originalStart) return '';
  return text.substring(originalStart, originalEnd);
}
