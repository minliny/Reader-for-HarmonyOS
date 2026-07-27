// DemoViewState — component-tree-per-route, cited 1:1 from view-state.fixtures.json
// (body components only; shells provide topbar (topArea) and nav (tabNav /
// readerModuleNav) via their own slots, per the 5-slot discipline).
// Main tab pages + book-detail are aligned to the contract ComponentType trees
// (ShelfChipGroup / BookCover / SubscriptionSummaryCard / etc.); the generic
// flow-page types (Loading / Empty / FormSection / Overlay / ...) cover the rest.
import { RouteId } from '../../contract/generated/RouteTable';

export class DemoViewState {
  static componentsFor(routeId: string): string[] {
    switch (routeId) {
      // ── Main tabs (contract view-state trees, body-only) ─────────────────
      case 'bookshelf':
      case 'bookshelf-cover-mode':
      case 'bookshelf-list-mode':
        return ['ShelfChipGroup', 'ContinueReadingCard', 'ShelfSectionHeader', 'BookGrid'];
      case 'bookshelf-empty':
        return ['Empty'];
      case 'discover':
      case 'discover-home':
        return ['SearchEntry', 'SourceTypeSegment', 'CurrentSourceCard',
          'SourceCategoryChips', 'DiscoveryContentCard', 'SourceStatusBar'];
      case 'rss':
        return ['SubscriptionSummaryCard', 'FeedStatusChips', 'FeedSourceChips', 'RssEntryItem'];
      case 'settings':
        // LocalOverviewCard + QuickEntryGrid (contract) + SettingsHomeSection keeps the nav rows.
        return ['LocalOverviewCard', 'QuickEntryGrid', 'SettingsHomeSection'];

      // ── Book detail (contract tree, body-only) ───────────────────────────
      case 'book-detail':
        return ['BookCover', 'BookTitleAuthor', 'SourceStatus', 'ReadButton',
          'DirectoryPreview', 'BookIntro', 'ConfigEntry'];

      // ── Reader surface (contract tree) ───────────────────────────────────
      case 'reader':
      case 'immersive-reading':
      case 'reader_content':
        return ['ReadingBackgroundLayer', 'ReadingTextFlow', 'ReadingInfoLayer', 'TapZones'];

      // ── Search flow (contract tree for book-search) ──────────────────────
      case 'book-search':
        return ['SearchInputBox', 'ScopeSelector', 'GroupSelector', 'SearchHistoryList'];
      case 'search-empty':
        return ['Empty'];

      // ── App shell / global states ────────────────────────────────────────
      case 'app-shell':
      case 'main-tabs':
      case 'global-loading':
        return ['Loading'];
      case 'global-empty':
        return ['Empty'];
      case 'global-error':
      case 'state-error':
        return ['Error'];
      case 'offline-state':
      case 'state-offline':
        return ['Offline'];

      // ── Secondary flow pages — body components cited 1:1 from view-state.fixtures.json ──
      case 'rss-original':
      case 'restore-running':
        return ['Loading'];
      case 'rss-detail':
      case 'restore-result':
        return ['Content', 'Button'];
      case 'search-home':
        return ['Input'];
      case 'search-results':
      case 'rss-all':
        return ['FilterBar', 'List'];
      case 'source-detail':
      case 'sync-backup':
        return ['FormSection', 'Button'];
      case 'webdav-config':
        return ['FormSection', 'Input', 'Button'];
      case 'sync-error':
        return ['Error', 'Overlay'];
      default:
        return ['Empty'];
    }
  }
}
