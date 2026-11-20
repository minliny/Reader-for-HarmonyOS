import type { SearchPresentation } from './SearchPresentation';
import type { ShelfBook } from '../../app/ReaderCoreGateway';
import type { SearchSource } from './SearchGateway';
import { EMPTY_SOURCE_GROUP_CATALOG, type SourceGroupCatalog } from '../source/SourceGroupTypes';
import type { SearchSourceGroupLoadState } from './SearchSourceGroups';

/** Navigation-owned immutable snapshots. Never pass the payload through @Prop:
 * ArkUI clones nested objects there, destroying delta identity on every tick.
 * The component observes only a numeric revision and reads this stable owner.
 */
export class SearchPublication {
  private presentation: SearchPresentation = { kind: 'initial', history: [] };
  private shelfBooks: ShelfBook[] = [];
  private sources: SearchSource[] = [];
  private sourceGroups: SourceGroupCatalog = EMPTY_SOURCE_GROUP_CATALOG;
  private sourceGroupLoadState: SearchSourceGroupLoadState = 'loading';
  private sourceGroupCatalogLoaded: boolean = false;

  publish(presentation: SearchPresentation): void { this.presentation = presentation; }
  updateShelf(books: ShelfBook[]): void { this.shelfBooks = books; }
  updateSources(sources: SearchSource[]): void { this.sources = sources; }
  updateSourceGroups(catalog: SourceGroupCatalog): void {
    this.sourceGroups = catalog; this.sourceGroupLoadState = 'ready'; this.sourceGroupCatalogLoaded = true;
  }
  updateSourceGroupLoadState(state: SearchSourceGroupLoadState): void { this.sourceGroupLoadState = state; }
  sourceGroupLoadStateAt(_revision: number): SearchSourceGroupLoadState { return this.sourceGroupLoadState; }
  hasSourceGroupCatalog(): boolean { return this.sourceGroupCatalogLoaded; }
  sourceGroupsAt(_revision: number): SourceGroupCatalog { return this.sourceGroups; }
  presentationAt(_revision: number): SearchPresentation { return this.presentation; }
  shelfAt(_revision: number): ShelfBook[] { return this.shelfBooks; }
  sourcesAt(_revision: number): SearchSource[] { return this.sources; }
}
