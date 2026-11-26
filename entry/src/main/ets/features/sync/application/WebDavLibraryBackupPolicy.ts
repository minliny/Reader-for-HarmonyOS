import type { LocalRecoveryArchiveProof } from '../../bookshelf/application/LocalRecoveryGateway';

export type WebDavReplacementAdmission =
  { state: 'admitted'; libraryId: string; createdAt: number } |
  { state: 'replacementUnverified' } |
  { state: 'replacementMissingOriginals' };

/** Compare authenticated archive facts after immutable-manifest admission. */
export function webDavReplacementAdmission(original: LocalRecoveryArchiveProof,
  replacement: LocalRecoveryArchiveProof): WebDavReplacementAdmission {
  const libraryId = original.libraryId;
  const createdAt = replacement.createdAt;
  if (libraryId === undefined || replacement.libraryId !== libraryId || original.createdAt === undefined ||
    createdAt === undefined || !(createdAt > original.createdAt)) {
    return { state: 'replacementUnverified' };
  }
  const included = new Set<string>(replacement.includedOriginals);
  if (!original.includedOriginals.every((digest: string): boolean => included.has(digest))) {
    return { state: 'replacementMissingOriginals' };
  }
  return { state: 'admitted', libraryId, createdAt };
}
