// DemoViewState — Phase 1 component-tree-per-route (from view-state.fixtures.json, P0 subset).
// Returns the BODY component types only — shells provide topbar (topArea) and nav (tabNav /
// readerModuleNav) via their own slots, per the 5-slot discipline.
import { RouteId } from '../../contract/generated/RouteTable';

export class DemoViewState {
  static componentsFor(routeId: string): string[] {
    switch (routeId) {
      case 'bookshelf':
        return ['ContinueReadingCard', 'BookshelfShelfSection'];
      case 'bookshelf-empty':
        return ['Empty'];
      case 'discover':
      case 'discover-home':
        return ['DiscoverSourceBar', 'DiscoverEntryRow', 'DiscoverFilterTrigger',
          'DiscoverListHead', 'DiscoverBookList'];
      case 'rss':
        return ['RssSearchEntry', 'RssModeRow', 'RssSourceOverview', 'RssArticleSection'];
      case 'settings':
        return ['SettingsHomeSection'];
      case 'book-detail':
        return ['BookHero', 'BookSummaryCard', 'BookChapterList'];
      case 'reader':
      case 'immersive-reading':
      case 'reader_content':
        return ['ReadingBackgroundLayer', 'ReadingTextFlow', 'ReadingInfoLayer', 'TapZones'];
      case 'app-shell':
      case 'main-tabs':
      case 'global-loading':
        return ['Loading'];
      case 'global-empty':
        return ['Empty'];
      case 'global-error':
      case 'state-error':
        return ['ErrorState'];
      case 'offline-state':
      case 'state-offline':
        return ['Offline'];
      default:
        return ['Empty'];
    }
  }
}
