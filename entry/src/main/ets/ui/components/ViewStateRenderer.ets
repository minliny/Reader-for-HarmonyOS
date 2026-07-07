// ViewStateRenderer — maps a DemoViewState component type string → @Component.
// The single place that knows how to render a view-state component type. Phase 2 will
// pass fixture props; Phase 1 demo components render self-contained fixture content.
import { DemoViewState } from '../fixtures/DemoViewState';
import { AppTopBar, BackTopBar, BottomNav, Loading, Empty, ErrorState, Offline } from './SharedComponents';
import { ContinueReadingCard, BookshelfShelfSection, ShelfChipGroup, ShelfSectionHeader, BookCard, BookCover, BookGrid } from './BookshelfComponents';
import { BookHero, BookSummaryCard, BookChapterList } from './BookDetailComponents';
import { ReadingBackgroundLayer, ReadingTextFlow, ReadingInfoLayer, TapZones } from './ReaderComponents';
import { SettingsHomeSection, SettingsSection, SettingsListItem } from './SettingsComponents';
import { DiscoverSourceBar, DiscoverEntryRow, DiscoverFilterTrigger, DiscoverListHead, DiscoverBookList } from './DiscoverComponents';
import { RssSearchEntry, RssModeRow, RssSourceOverview, RssArticleSection } from './RssComponents';

@Component
export struct ViewStateRenderer {
  @StorageProp('reader.routeId') routeId: string = 'bookshelf';

  build() {
    Column() {
      ForEach(DemoViewState.componentsFor(this.routeId), (type: string, idx: number) => {
        Column() {
          this.renderComponent(type)
        }
        .margin({ bottom: 8 })
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
    } else if (type === 'ContinueReadingCard') {
      ContinueReadingCard()
    } else if (type === 'BookshelfShelfSection') {
      BookshelfShelfSection()
    } else if (type === 'BookHero') {
      BookHero()
    } else if (type === 'BookSummaryCard') {
      BookSummaryCard()
    } else if (type === 'BookChapterList') {
      BookChapterList()
    } else if (type === 'ReadingBackgroundLayer') {
      ReadingBackgroundLayer()
    } else if (type === 'ReadingTextFlow') {
      ReadingTextFlow()
    } else if (type === 'ReadingInfoLayer') {
      ReadingInfoLayer()
    } else if (type === 'TapZones') {
      TapZones()
    } else if (type === 'SettingsHomeSection') {
      SettingsHomeSection()
    } else if (type === 'SettingsSection') {
      SettingsSection()
    } else if (type === 'SettingsListItem') {
      SettingsListItem()
    } else if (type === 'DiscoverSourceBar') {
      DiscoverSourceBar()
    } else if (type === 'DiscoverEntryRow') {
      DiscoverEntryRow()
    } else if (type === 'DiscoverFilterTrigger') {
      DiscoverFilterTrigger()
    } else if (type === 'DiscoverListHead') {
      DiscoverListHead()
    } else if (type === 'DiscoverBookList') {
      DiscoverBookList()
    } else if (type === 'RssSearchEntry') {
      RssSearchEntry()
    } else if (type === 'RssModeRow') {
      RssModeRow()
    } else if (type === 'RssSourceOverview') {
      RssSourceOverview()
    } else if (type === 'RssArticleSection') {
      RssArticleSection()
    } else {
      Empty()
    }
  }
}
