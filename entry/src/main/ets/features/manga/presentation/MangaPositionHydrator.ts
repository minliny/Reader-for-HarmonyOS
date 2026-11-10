import type { ReaderRuntimeOwner } from '../../../app/ReaderRuntimeOwner';
import type { ReaderRoute } from '../../../app/navigation/ReaderNavigation';
import { MangaBookPresentation } from './MangaBookPresentation';
import { MangaSessionGateway } from '../application/MangaSessionGateway';

export interface MangaPositionScene {
  owner?: ReaderRuntimeOwner;
  mounting: number;
  navigation: number;
  route: ReaderRoute;
  shelfGeneration: number;
  shelfBooks: MangaBookIdentity[];
  continueReading?: MangaPositionCandidate;
  detail?: MangaPositionCandidate;
  covered: boolean;
}

interface MangaPositionOpening {
  owner: ReaderRuntimeOwner;
  identity: string;
  current: () => boolean;
  project: () => void;
}

interface MangaBookIdentity {
  sourceId: string;
  bookId: string;
}

export interface MangaPositionCandidate extends MangaBookIdentity {
  contentKind?: string;
}

interface MangaPositionJob {
  book: MangaBookIdentity;
  opening: MangaPositionOpening;
  generation: number;
}

/** Bounded optional display readback. The existing manga gateway and
 * MangaBookPresentation remain the source of position and page facts. */
export class MangaPositionHydrator {
  private signature: string = '';
  private generation: number = 0;
  private workers: number = 0;
  private queue: MangaPositionJob[] = [];

  retire(): void {
    this.generation += 1;
    this.signature = '';
    this.queue = [];
  }

  hydrateVisible(books: MangaPositionCandidate[], read: () => MangaPositionScene, project: () => void): void {
    const scene = read(), owner = scene.owner;
    if (owner === undefined || scene.covered ||
      (scene.route !== 'bookshelf' && scene.route !== 'detail' && scene.route !== 'directory')) return;
    const detail = scene.detail;
    const retained = scene.shelfBooks.slice(0, 144);
    const continued = scene.continueReading;
    if (continued?.contentKind === 'manga') retained.push({ sourceId: continued.sourceId, bookId: continued.bookId });
    if (detail?.contentKind === 'manga') retained.push({ sourceId: detail.sourceId, bookId: detail.bookId });
    const current = (): boolean => {
      const latest = read();
      return latest.owner === owner && latest.mounting === scene.mounting && latest.navigation === scene.navigation &&
        latest.shelfGeneration === scene.shelfGeneration && latest.route === scene.route && !latest.covered &&
        (scene.route === 'bookshelf' || (latest.detail?.sourceId === detail?.sourceId && latest.detail?.bookId === detail?.bookId));
    };
    this.hydrate(books, retained, { owner, current, project,
      identity: JSON.stringify([scene.mounting, scene.navigation, scene.shelfGeneration, scene.route, detail?.sourceId, detail?.bookId]) });
  }

  private hydrate(books: MangaPositionCandidate[], retained: MangaBookIdentity[], opening: MangaPositionOpening): void {
    if (!opening.current()) return;
    const before = MangaBookPresentation.revision;
    MangaBookPresentation.useOwner(opening.owner);
    if (before !== MangaBookPresentation.revision) this.signature = '';
    MangaBookPresentation.retainIdentities(retained);
    if (before !== MangaBookPresentation.revision)
      AppStorage.setOrCreate('readerMangaPresentationRevision', MangaBookPresentation.revision);
    opening.project();
    const candidates = books.filter((book: MangaPositionCandidate): boolean => book.contentKind === 'manga').slice(0, 24)
      .map((book: MangaPositionCandidate): MangaBookIdentity => ({ sourceId: book.sourceId, bookId: book.bookId }));
    const signature = JSON.stringify([opening.identity, candidates.map((book: MangaBookIdentity): string[] => [book.sourceId, book.bookId])]);
    if (this.signature === signature) return;
    this.signature = signature;
    const generation = ++this.generation;
    this.queue = candidates.map((book: MangaBookIdentity): MangaPositionJob => ({ book, opening, generation }));
    this.pump();
  }

  private current(job: MangaPositionJob): boolean {
    return job.generation === this.generation && job.opening.current();
  }

  private pump(): void {
    while (this.workers < 2 && this.queue.length > 0) {
      const job = this.queue.shift();
      if (job === undefined || !this.current(job)) continue;
      this.workers += 1;
      void this.project(job).finally((): void => {
        this.workers -= 1;
        this.pump();
      });
    }
  }

  private async project(job: MangaPositionJob): Promise<void> {
    const current = (): boolean => this.current(job);
    const book = job.book;
    const gateway = new MangaSessionGateway(job.opening.owner);
    try {
      const entry = await gateway.entry(book.sourceId, book.bookId, undefined, current);
      if (!current()) return;
      const before = MangaBookPresentation.revision;
      if (!MangaBookPresentation.admitEntry(book.sourceId, book.bookId, entry)) {
        const progress = await gateway.progress(book.sourceId, book.bookId, current);
        if (!current()) return;
        MangaBookPresentation.admitProgress(book.sourceId, book.bookId, progress);
      }
      if (!current()) return;
      if (before !== MangaBookPresentation.revision)
        AppStorage.setOrCreate('readerMangaPresentationRevision', MangaBookPresentation.revision);
      job.opening.project();
    } catch (_) { /* Optional display projection keeps the last admitted value. */ }
  }
}
