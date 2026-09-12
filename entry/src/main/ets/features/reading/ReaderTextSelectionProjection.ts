/** Map an ArkUI UTF-16 selection back to the unmodified fragment text. */
export function readerSelectedOriginalText(
  text: string,
  syntheticPrefixLength: number,
  start: number | undefined,
  end: number | undefined,
): string | undefined {
  const displayLength = syntheticPrefixLength + text.length;
  const selectionStart = start ?? 0;
  const selectionEnd = end ?? displayLength;
  if (!Number.isInteger(syntheticPrefixLength) || syntheticPrefixLength < 0 ||
    !Number.isInteger(selectionStart) || !Number.isInteger(selectionEnd) ||
    selectionStart < 0 || selectionEnd < selectionStart || selectionEnd > displayLength) {
    return undefined;
  }
  const originalStart = Math.max(0, selectionStart - syntheticPrefixLength);
  const originalEnd = Math.max(0, selectionEnd - syntheticPrefixLength);
  return text.substring(originalStart, originalEnd);
}
