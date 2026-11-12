import { SearchViewState } from '../presentation/SearchViewState';
import { SearchPublication } from '../presentation/SearchPublication';
import { SearchOrchestrator } from './SearchOrchestrator';
import type { SearchSource } from './SearchGateway';
import type { SearchPresentation } from '../presentation/SearchPresentation';
import type { ShelfBook } from '../../../app/ReaderCoreGateway';

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
  private shelfMembershipLoaded: boolean = false;
  private readonly onPublicationChanged: () => void;
  private readonly isSearchVisible: () => boolean;

  constructor(
    onPublicationChanged: () => void,
    isSearchVisible: () => boolean,
  ) {
    this.onPublicationChanged = onPublicationChanged;
    this.isSearchVisible = isSearchVisible;
  }

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
  refreshHistory(): void { this.getOrchestrator().refreshHistory(); }
  deleteHistory(keyword: string): Promise<void> { return this.getOrchestrator().deleteHistory(keyword); }
  resume(): void { this.getOrchestrator().resume(); }
  refreshSources(): void { this.getOrchestrator().refreshSources(); }
  searchedSourceIds(): string[] { return this.orchestrator?.searchedSourceIds() ?? []; }

  presentation(): SearchPresentation { return this.publication.presentationAt(this.revision); }
  sources(): SearchSource[] { return this.publication.sourcesAt(this.revision); }

  shelfMembership(): ShelfBook[] | undefined {
    return this.shelfMembershipLoaded ? this.publication.shelfAt(this.revision) : undefined;
  }

  updateShelf(books: ShelfBook[]): void {
    this.shelfMembershipLoaded = true;
    this.publication.updateShelf(books);
    this.advanceRevision();
  }

  clearShelfMembership(): void {
    if (!this.shelfMembershipLoaded) return;
    this.shelfMembershipLoaded = false;
    this.publication.updateShelf([]);
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
          // Publish source names for the library separately from result
          // filtering, which follows each admitted result's origin.
          this.advanceRevision();
        },
        this.isSearchVisible,
      );
    }
    return this.orchestrator;
  }
}
