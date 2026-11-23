import type { ReaderDirectoryTargetProof } from '../application/ReaderDirectoryTargetProof';
import type { RemoteReadingPositionScope } from '../application/RemoteReadingPositionMigration';

/**
 * Host-originated bookmark jump (Full Directory bookmark row). The requestId
 * bumps on every click so re-selecting the same bookmark still re-syncs the
 * @Prop and re-fires the anchor seek.
 */
export class ReaderBookmarkAnchorRequest {
  requestId: number;
  chapterIndex: number;
  chapterOffset: number;

  positionScope?: RemoteReadingPositionScope;
  directoryTargetProof?: ReaderDirectoryTargetProof;

  constructor(requestId: number, chapterIndex: number, chapterOffset: number, positionScope?: RemoteReadingPositionScope, directoryTargetProof?: ReaderDirectoryTargetProof) {
    this.directoryTargetProof = directoryTargetProof;
    this.positionScope = positionScope;
    this.requestId = requestId;
    this.chapterIndex = chapterIndex;
    this.chapterOffset = chapterOffset;
  }
}
