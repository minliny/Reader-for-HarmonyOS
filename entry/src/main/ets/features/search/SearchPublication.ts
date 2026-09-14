import type { SearchPresentation } from './SearchPresentation';
import type { ShelfBook } from '../../app/ReaderCoreGateway';

/** Navigation-owned immutable snapshots. Never pass the payload through @Prop:
 * ArkUI clones nested objects there, destroying delta identity on every tick.
 * The component observes only a numeric revision and reads this stable owner.
 */
export class SearchPublication {
  private presentation: SearchPresentation = { kind: 'initial', history: [] };
  private shelfBooks: ShelfBook[] = [];

  publish(presentation: SearchPresentation): void { this.presentation = presentation; }
  updateShelf(books: ShelfBook[]): void { this.shelfBooks = books; }
  presentationAt(_revision: number): SearchPresentation { return this.presentation; }
  shelfAt(_revision: number): ShelfBook[] { return this.shelfBooks; }
}
