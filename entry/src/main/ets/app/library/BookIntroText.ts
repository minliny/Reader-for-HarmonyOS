// Display projection only. Keep the original synopsis and rule variables in
// Core so showing a search card cannot change a later detail/TOC request.
/** Core supplies plain display intro through its standard HTML parser. */
export function bookIntroText(raw: string | undefined): string {
  if (raw === undefined || raw.length === 0) return '';
  return raw
    .replace(/\r\n?/g, '\n')
    .replace(/[\t\f\v \u00A0\u2002\u2003\u2009]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
