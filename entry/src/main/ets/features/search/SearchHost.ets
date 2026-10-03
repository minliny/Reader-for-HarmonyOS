import { SearchViewState } from './SearchViewState';
import { SearchPublication } from './SearchPublication';
import { SearchOrchestrator } from './SearchOrchestrator';
import type { SearchSource } from './SearchGateway';
import type { SearchPresentation } from './SearchPage';
import type { ShelfBook } from '../../app/ReaderCoreGateway';

/**
 * Entry-owned Search surface.
 *
 * Index is a route and intent dispatcher. This host keeps the Search
 * publication, view state, orchestrator and their write-back contract
 * together, so a page mount cannot accidentally create a second gateway or
 * publish a result without advancing the UI revision.
 */
export class SearchHost {
  readonly viewState: SearchViewState = new SearchViewState();
  readonly publication: SearchPublication = new SearchPublication();
  private orchestrator: SearchOrchestrator | undefined = undefined;
  private revision: number = 0;

  constructor(
    private readonly onPublicationChanged: () => void,
    private readonly isSearchVisible: () => boolean,
  ) {}

  publicationRevision(): number { return this.revision; }

  /** Reset only navigation-owned draft state when a fresh Search route opens. */
  prepareEntry(): void {
    this.viewState.reset();
    this.viewState.requestInputFocus();
  }

  open(): void { this.getOrchestrator().open(); }
  close(): void { this.orchestrator?.close(); }
  visibilityChanged(): void { this.orchestrator?.visibilityChanged(); }
  search(keyword: string, scopeSourceIds?: string[]): void {
    this.viewState.reset(keyword);
    this.getOrchestrator().search(keyword, scopeSourceIds);
  }
  stop(): void { this.getOrchestrator().stop(); }
  retry(): void { this.getOrchestrator().retry(); }
  retryHistory(): void { this.getOrchestrator().retryHistory(); }
  clearHistory(): void { this.getOrchestrator().clearHistory(); }
  resume(): void { this.getOrchestrator().resume(); }
  refreshSources(): void { this.getOrchestrator().refreshSources(); }
  searchedSourceIds(): string[] { return this.orchestrator?.searchedSourceIds() ?? []; }

  presentation(): SearchPresentation { return this.publication.presentationAt(this.revision); }
  sources(): SearchSource[] { return this.publication.sourcesAt(this.revision); }

  updateShelf(books: ShelfBook[]): void {
    this.publication.updateShelf(books);
    this.advanceRevision();
  }

  private advanceRevision(): void {
    this.revision += 1;
    this.onPublicationChanged();
  }

  private getOrchestrator(): SearchOrchestrator {
    if (this.orchestrator === undefined) {
      this.orchestrator = new SearchOrchestrator(
        (presentation: SearchPresentation): void => {
          this.publication.publish(presentation);
          this.advanceRevision();
        },
        (sources: SearchSource[]): void => {
          this.publication.updateSources(sources);
        },
        this.isSearchVisible,
      );
    }
    return this.orchestrator;
  }
}
