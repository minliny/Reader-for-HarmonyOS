import type { SearchPresentation } from './SearchPresentation';
import type { ShelfBook } from '../../app/ReaderCoreGateway';
import type { SearchSource } from './SearchGateway';

/** Navigation-owned immutable snapshots. Never pass the payload through @Prop:
 * ArkUI clones nested objects there, destroying delta identity on every tick.
 * The component observes only a numeric revision and reads this stable owner.
 */
export class SearchPublication {
  private presentation: SearchPresentation = { kind: 'initial', history: [] };
  private shelfBooks: ShelfBook[] = [];
  private sources: SearchSource[] = [];

  publish(presentation: SearchPresentation): void { this.presentation = presentation; }
  updateShelf(books: ShelfBook[]): void { this.shelfBooks = books; }
  updateSources(sources: SearchSource[]): void { this.sources = sources; }
  presentationAt(_revision: number): SearchPresentation { return this.presentation; }
  shelfAt(_revision: number): ShelfBook[] { return this.shelfBooks; }
  sourcesAt(_revision: number): SearchSource[] { return this.sources; }
}
