import type { SearchEntrySourceReadObservation, SearchPresentation } from './SearchPresentation';
import type { ShelfBook } from '../../../app/ReaderCoreGateway';
import type { SearchSource } from '../application/SearchGateway';

/** Navigation-owned immutable snapshots. Never pass the payload through @Prop:
 * ArkUI clones nested objects there, destroying delta identity on every tick.
 * The component observes only a numeric revision and reads this stable owner.
 */
export class SearchPublication {
  private presentation: SearchPresentation = { kind: 'initial', history: [] };
  private shelfBooks: ShelfBook[] = [];
  private sources: SearchSource[] = [];
  private entrySourceRead: SearchEntrySourceReadObservation | undefined = undefined;

  publish(presentation: SearchPresentation): void { this.presentation = presentation; }
  updateShelf(books: ShelfBook[]): void { this.shelfBooks = books; }
  updateSources(sources: SearchSource[]): void { this.sources = sources; }
  updateEntrySourceRead(observation: SearchEntrySourceReadObservation | undefined): void {
    this.entrySourceRead = observation;
  }
  presentationAt(_revision: number): SearchPresentation { return this.presentation; }
  shelfAt(_revision: number): ShelfBook[] { return this.shelfBooks; }
  sourcesAt(_revision: number): SearchSource[] { return this.sources; }
  entrySourceReadAt(_revision: number): SearchEntrySourceReadObservation | undefined { return this.entrySourceRead; }
}
