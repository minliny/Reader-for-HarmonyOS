// ViewStateRenderer — maps a DemoViewState component type string → @Component.
// The single place that knows how to render a view-state component type. Phase 2 will
// pass fixture props; Phase 1 demo components render self-contained fixture content.
import { DemoViewState } from '../fixtures/DemoViewState';
import { AppTopBar, BackTopBar, BottomNav, Loading, Empty, ErrorState, Offline } from './SharedComponents';
import { ShelfChipGroup, ContinueReadingCard, ShelfSectionHeader, BookCard, BookCover } from './BookshelfComponents';
import { BookTitleAuthor, DirectoryPreview, BookIntro, ReadButton, AddToShelfButton } from './BookDetailComponents';
import { ReadingBackgroundLayer, ReadingTextFlow, ReadingInfoLayer, TapZones } from './ReaderComponents';
import { SettingsSection, SettingsListItem } from './SettingsComponents';
import { SearchEntry, SourceTypeSegment, CurrentSourceCard, SourceCategoryChips, DiscoveryContentCard, SourceStatusBar } from './DiscoverComponents';
import { SubscriptionSummaryCard, FeedStatusChips, FeedSourceChips, RssEntryItem, UnreadIndicator } from './RssComponents';

@Component
export struct ViewStateRenderer {
  @StorageProp('reader.routeId') routeId: string = 'bookshelf';

  build() {
    Column() {
      ForEach(DemoViewState.componentsFor(this.routeId), (type: string, idx: number) => {
        this.renderComponent(type)
      }, (type: string, idx: number) => `${type}-${idx}`)
    }
    .width('100%')
    .height('100%')
  }

  @Builder renderComponent(type: string) {
    if (type === 'AppTopBar') {
      AppTopBar()
    } else if (type === 'BackTopBar') {
      BackTopBar()
    } else if (type === 'BottomNav') {
      BottomNav()
    } else if (type === 'Loading') {
      Loading()
    } else if (type === 'Empty') {
      Empty()
    } else if (type === 'ErrorState') {
      ErrorState()
    } else if (type === 'Offline') {
      Offline()
    } else if (type === 'ShelfChipGroup') {
      ShelfChipGroup()
    } else if (type === 'ContinueReadingCard') {
      ContinueReadingCard()
    } else if (type === 'ShelfSectionHeader') {
      ShelfSectionHeader()
    } else if (type === 'BookCard') {
      BookCard()
    } else if (type === 'BookCover') {
      BookCover()
    } else if (type === 'BookTitleAuthor') {
      BookTitleAuthor()
    } else if (type === 'DirectoryPreview') {
      DirectoryPreview()
    } else if (type === 'BookIntro') {
      BookIntro()
    } else if (type === 'ReadButton') {
      ReadButton()
    } else if (type === 'AddToShelfButton') {
      AddToShelfButton()
    } else if (type === 'ReadingBackgroundLayer') {
      ReadingBackgroundLayer()
    } else if (type === 'ReadingTextFlow') {
      ReadingTextFlow()
    } else if (type === 'ReadingInfoLayer') {
      ReadingInfoLayer()
    } else if (type === 'TapZones') {
      TapZones()
    } else if (type === 'SettingsSection') {
      SettingsSection()
    } else if (type === 'SettingsListItem') {
      SettingsListItem()
    } else if (type === 'SearchEntry') {
      SearchEntry()
    } else if (type === 'SourceTypeSegment') {
      SourceTypeSegment()
    } else if (type === 'CurrentSourceCard') {
      CurrentSourceCard()
    } else if (type === 'SourceCategoryChips') {
      SourceCategoryChips()
    } else if (type === 'DiscoveryContentCard') {
      DiscoveryContentCard()
    } else if (type === 'SourceStatusBar') {
      SourceStatusBar()
    } else if (type === 'SubscriptionSummaryCard') {
      SubscriptionSummaryCard()
    } else if (type === 'FeedStatusChips') {
      FeedStatusChips()
    } else if (type === 'FeedSourceChips') {
      FeedSourceChips()
    } else if (type === 'RssEntryItem') {
      RssEntryItem()
    } else if (type === 'UnreadIndicator') {
      UnreadIndicator()
    } else {
      Empty()
    }
  }
}
