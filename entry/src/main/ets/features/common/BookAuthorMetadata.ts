/** Reader's author-field labels, not a person-name parser or fuzzy matcher.
 * Keep stored metadata and rule context unchanged; use this derived label for
 * presentation and exact same-book comparison only. Core's SQLite alias index
 * follows the same fixture-backed policy.
 */
export function bookAuthorLabel(value: string): string {
  let label = value.trim().replace(/^作\s*者\s*[:：]\s*/, '');
  const lastLine = Math.max(label.lastIndexOf('\r'), label.lastIndexOf('\n'),
    label.lastIndexOf('\u2028'), label.lastIndexOf('\u2029'));
  if (lastLine >= 0 && label.slice(lastLine + 1).trim() === '进入作者主页 →' &&
    label.slice(0, lastLine).trim().length > 0) {
    label = label.slice(0, lastLine).trim();
  }
  return label;
}

export function bookIdentityText(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLowerCase();
}

export function bookAuthorIdentity(value: string): string {
  return bookIdentityText(bookAuthorLabel(value));
}

export function bookTitleAuthorKey(title: string, author: string): string {
  return `${bookIdentityText(title)}\u0000${bookAuthorIdentity(author)}`;
}
