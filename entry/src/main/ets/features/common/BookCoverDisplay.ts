/** Native book-cover input only. This does not change source metadata or
 * parse source request formats; a missing/unsupported input stays absent. */
export function bookCoverDisplayUrl(value: string | undefined): string | undefined {
  const url = value?.trim();
  return url !== undefined && /^(https?:\/\/[^\s/]+(?:\/\S*)?|data:image\/(png|jpeg|bmp|webp);base64,\S+|file:\/\/\S+)$/.test(url) ? url : undefined;
}
