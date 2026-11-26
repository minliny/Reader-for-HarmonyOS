import type { RemoteReadingSession } from './RemoteReadingFlowGateway';
import type { ReadingChapterWindow, ReadingSessionChapter } from './ReadingChapterWindow';

export interface ReadingNeighbourPublication {
  matchesIdentity: (chapter: ReadingSessionChapter) => boolean;
  admitVersion: (chapterIndex: number, contentVersion: string) => void;
  retain: () => void;
  prepareAdjacent: (forward: boolean) => void;
}

export interface ReadingNeighbourRequest {
  key: string;
  isCurrent: () => boolean;
  load: (chapterIndex: number, isCurrent: () => boolean) => Promise<ReadingSessionChapter>;
  publication: ReadingNeighbourPublication;
}

export interface ReadingNearEndCatalogRequest {
  key: string;
  isCurrent: () => boolean;
  load: (isCurrent: () => boolean) => Promise<RemoteReadingSession>;
  reportFailure: (error: Error) => void;
}

function responseMatches(chapter: ReadingSessionChapter, index: number, publication: ReadingNeighbourPublication): boolean {
  return chapter.chapterIndex === index && publication.matchesIdentity(chapter);
}

/** Owns the transient work for the visible page's neighbouring chapter window.
 * The Host retains the visible page lease and every rendering/recovery effect.
 * The chapter window remains the single owner of retained bodies and limits. */
export class ReadingInteractiveChapterPreparation {
  private neighbourPreparationKey: string = '';
  private readonly pageTurnChapterLoads: Set<string> = new Set<string>();
  private remoteCatalogPreparation: Promise<void> | undefined = undefined;
  private remoteCatalogAttemptKey: string = '';
  private remoteCatalogAttemptAt: number = 0;

  prefetch(
    window: ReadingChapterWindow, chapter: ReadingSessionChapter, facing: boolean,
    request: ReadingNeighbourRequest, reviseFacingSpread: () => void,
  ): void {
    if (this.neighbourPreparationKey === request.key) return;
    this.neighbourPreparationKey = request.key;
    const isCurrent = (): boolean => this.neighbourPreparationKey === request.key && request.isCurrent();
    const run = async (): Promise<void> => {
      for (const delta of chapter.documentRange !== undefined ? [1] : [1, -1, 2, -2, 3, -3]) {
        // Yield between chapters while the visible page owns the lease.
        await new Promise<void>((resolve): void => { setTimeout(resolve, 0); });
        if (!isCurrent()) return;
        const index = window.adjacentChapterIndex(chapter.chapterIndex, delta);
        if (index === undefined || window.get(index) !== undefined) continue;
        try {
          const loaded = await request.load(index, isCurrent);
          if (!isCurrent()) return;
          if (!responseMatches(loaded, index, request.publication)) throw new Error('READING_NEIGHBOUR_IDENTITY_MISMATCH');
          const admitted = window.admitNeighbour(loaded);
          request.publication.retain();
          if (!admitted) continue;
          request.publication.admitVersion(loaded.chapterIndex, loaded.contentVersion);
          if (facing && (delta === 1 || delta === 2)) reviseFacingSpread();
          if (Math.abs(delta) === 1) request.publication.prepareAdjacent(delta > 0);
        } catch (_) {
          // Optional failure leaves the visible page and explicit retry path intact.
          if (!isCurrent()) return;
        }
      }
    };
    void run().finally((): void => {
      if (this.neighbourPreparationKey === request.key) this.neighbourPreparationKey = '';
    });
  }

  requestTurn(
    window: ReadingChapterWindow, chapterIndex: number, forward: boolean, request: ReadingNeighbourRequest,
    reportFailure: (isCurrent: () => boolean) => void,
  ): void {
    if (this.pageTurnChapterLoads.has(request.key)) return;
    this.pageTurnChapterLoads.add(request.key);
    const isCurrent = request.isCurrent;
    void request.load(chapterIndex, isCurrent).then((chapter: ReadingSessionChapter): void => {
      if (!isCurrent()) return;
      if (!responseMatches(chapter, chapterIndex, request.publication)) throw new Error('PAGE_TURN_NEIGHBOUR_IDENTITY_MISMATCH');
      if (!window.admitNeighbour(chapter)) return;
      request.publication.admitVersion(chapter.chapterIndex, chapter.contentVersion);
      request.publication.retain();
      request.publication.prepareAdjacent(forward);
    }).catch((_error: Error): void => {
      if (isCurrent()) reportFailure(isCurrent);
      // A later explicit request can retry. No failure recursively drains the queue.
    }).finally((): void => { this.pageTurnChapterLoads.delete(request.key); });
  }

  prepareNearEndCatalog(remainingReadableChapters: () => number | undefined,
    captureRequest: () => ReadingNearEndCatalogRequest): void {
    if (this.remoteCatalogPreparation !== undefined) return;
    const remaining = remainingReadableChapters();
    if (remaining === undefined || remaining > 3) return;
    const request = captureRequest();
    if (this.remoteCatalogAttemptKey === request.key && Date.now() - this.remoteCatalogAttemptAt < 30 * 1000) return;
    this.remoteCatalogAttemptKey = request.key;
    this.remoteCatalogAttemptAt = Date.now();
    const operation = request.load(request.isCurrent).then((): void => {}).catch((error: Error): void => {
      if (request.isCurrent()) request.reportFailure(error);
    }).finally((): void => {
      if (this.remoteCatalogPreparation === operation) this.remoteCatalogPreparation = undefined;
    });
    this.remoteCatalogPreparation = operation;
  }
}
