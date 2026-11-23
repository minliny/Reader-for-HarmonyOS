export type BookAuthorIdentityProof = {
  schemaVersion: number;
  sourceVersion: string;
  field: string;
  raw: string;
  label: string;
  rule: string;
};

/** Only Core's version-bound evidence may remove a source template decoration. */
export function readBookAuthorIdentity(value: unknown, raw: string, sourceVersion?: string): BookAuthorIdentityProof | undefined {
  if (value === null || typeof value !== 'object' || Array.isArray(value) || !sourceVersion) return undefined;
  const proof = value as BookAuthorIdentityProof;
  if (proof.schemaVersion !== 1 || proof.sourceVersion !== sourceVersion ||
    (proof.field !== 'search' && proof.field !== 'detail') || proof.rule !== 'author-nickname-at-v1' ||
    proof.raw !== raw || !raw.startsWith('@') || typeof proof.label !== 'string' ||
    proof.label !== raw.slice(1)) return undefined;
  return proof;
}

/** Reader's author-field labels, not a person-name parser or fuzzy matcher.
 * Keep stored metadata and rule context unchanged; use this derived label for
 * presentation and exact same-book comparison only. Core's SQLite alias index
 * follows the same fixture-backed policy.
 */
export function bookAuthorLabel(value: string, proof?: BookAuthorIdentityProof, sourceVersion?: string): string {
  const admitted = readBookAuthorIdentity(proof, value, sourceVersion);
  let label = (admitted?.label ?? value).trim().replace(/^作\s*者\s*[:：]\s*/, '');
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

export function bookAuthorIdentity(value: string, proof?: BookAuthorIdentityProof, sourceVersion?: string): string {
  return bookIdentityText(bookAuthorLabel(value, proof, sourceVersion));
}

export function bookTitleAuthorKey(title: string, author: string, proof?: BookAuthorIdentityProof, sourceVersion?: string): string {
  return `${bookIdentityText(title)}\u0000${bookAuthorIdentity(author, proof, sourceVersion)}`;
}
