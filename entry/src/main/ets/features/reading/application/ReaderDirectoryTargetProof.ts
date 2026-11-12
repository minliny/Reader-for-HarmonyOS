import type { JsonObject } from '@reader/core-harmony';

/** Immutable authority issued by Core when a specific directory node is resolved. */
export interface ReaderDirectoryTargetProof {
  readonly sourceId: string;
  readonly bookId: string;
  readonly catalogRevision: string;
  readonly structureRevision: string;
  readonly nodeId: string;
  readonly chapterIndex: number;
  readonly url: string;
}

export function encodeReaderDirectoryTargetProof(proof: ReaderDirectoryTargetProof): JsonObject {
  return {
    sourceId: proof.sourceId,
    bookId: proof.bookId,
    catalogRevision: proof.catalogRevision,
    structureRevision: proof.structureRevision,
    nodeId: proof.nodeId,
    chapterIndex: proof.chapterIndex,
    url: proof.url,
  };
}
