// Display projection only. Keep the original synopsis and rule variables in
// Core so showing a search card cannot change a later detail/TOC request.
const INTRO_ENTITIES: Map<string, string> = new Map<string, string>([
  ['amp', '&'], ['AMP', '&'], ['lt', '<'], ['LT', '<'], ['gt', '>'], ['GT', '>'],
  ['quot', '"'], ['QUOT', '"'], ['apos', "'"], ['nbsp', ' '], ['ensp', ' '], ['emsp', ' '], ['thinsp', ' '],
  ['hellip', '…'], ['middot', '·'], ['bull', '•'], ['ndash', '–'], ['mdash', '—'],
  ['lsquo', '‘'], ['rsquo', '’'], ['ldquo', '“'], ['rdquo', '”'],
  ['laquo', '«'], ['raquo', '»'], ['copy', '©'], ['reg', '®'], ['trade', '™'],
  ['times', '×'], ['divide', '÷'], ['shy', ''],
  // Directional formatting entities are presentation controls, not synopsis
  // content. Keep them out of the card/detail projection while preserving the
  // original Core value for later requests.
  ['lrm', ''], ['rlm', ''], ['lre', ''], ['rle', ''], ['lro', ''], ['rlo', ''], ['pdf', ''],
]);

function decodeIntroEntities(text: string): string {
  // A few sources serialize HTML entities with a full-width semicolon. Treat
  // it as the same delimiter for display sanitization, without broadening the
  // parser to arbitrary punctuation.
  return text.replace(/&(#(?:[xX][0-9a-fA-F]+|[0-9]+)|[a-zA-Z]+)[;；]/g,
    (entity: string, name: string): string => {
      if (name.charAt(0) !== '#') return INTRO_ENTITIES.get(name) ?? entity;
      const hexadecimal = name.charAt(1).toLowerCase() === 'x';
      const point = Number.parseInt(name.substring(hexadecimal ? 2 : 1), hexadecimal ? 16 : 10);
      if (!Number.isFinite(point) || point <= 0 || point > 0x10FFFF ||
        (point >= 0xD800 && point <= 0xDFFF)) return '\uFFFD';
      return String.fromCodePoint(point);
    });
}

/** Plain synopsis text shared by the search card and book detail. */
export function bookIntroText(raw: string | undefined): string {
  if (raw === undefined || raw.length === 0) return '';
  // Some sources escape an already escaped synopsis. Two passes handle that
  // common case without recursively expanding arbitrary input.
  return decodeIntroEntities(decodeIntroEntities(raw))
    .replace(/\r\n?/g, '\n')
    .replace(/<br\b[^<>]*>/gi, '\n')
    .replace(/<\/?(?:p|div|section|article|li|ul|ol|h[1-6])\b[^<>]*>/gi, '\n')
    .replace(/<\/?[a-zA-Z][^<>]*>/g, '')
    .replace(/[\t\f\v \u00A0\u2002\u2003\u2009]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[\u200E\u200F\u202A-\u202E\u2066-\u2069]/g, '')
    .trim();
}
