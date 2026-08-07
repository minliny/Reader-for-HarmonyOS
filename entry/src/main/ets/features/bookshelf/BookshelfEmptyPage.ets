/**
 * Empty shelf, rebuilt 2026-08-06 against live Figma node `State/BookshelfEmpty`
 * (`286:31`, icon `Icon/Bookshelf` `271:96`). The 352×350 card replaces the old
 * `574:198` reference geometry (which had swapped action roles, blue icon frame,
 * pills, and wrong card size). Page chrome (top bar, section header, bottom
 * navigation) is unchanged. Empty-state text uses ReaderNotoSansSC per Figma.
 */
import { MainTabBar } from '../shell/MainTabBar';
import {
  TOK_INK,
  TOK_PAPER,
  TOK_SCREEN_INSET,
  TOK_SPACE_XS,
} from '../common/ReaderTokens';

import { registerReaderFonts } from '../common/ReaderFonts';
import { BookshelfEmptyCard } from './BookshelfEmptyCard';

const PHONE_CONTENT_WIDTH = 352;

@Component
export struct BookshelfEmptyPage {
  @Prop isTablet: boolean;
  onImportRequested: () => void = (): void => {};
  onSearchRequested: () => void = (): void => {};
  onRssRequested: () => void = (): void => {};
  onSettingsRequested: () => void = (): void => {};
  onDiscoverRequested: () => void = (): void => {};

  aboutToAppear(): void {
    registerReaderFonts(this.getUIContext().getFont());
  }

  build() {
    Column() {
      this.topBar();
      Scroll() {
        Column({ space: 9 }) {
          this.sectionHeader();
          BookshelfEmptyCard({
            onImportRequested: (): void => this.onImportRequested(),
            onSearchRequested: (): void => this.onSearchRequested(),
          })
        }
        .width(this.contentWidth())
        .padding({ top: TOK_SPACE_XS, bottom: 116 });
      }
      .layoutWeight(1)
      .width('100%')
      .padding({ left: TOK_SCREEN_INSET, right: TOK_SCREEN_INSET })
      .scrollBar(BarState.Off);

      MainTabBar({ current: 'bookshelf', onSelect: (key: string): void => this.onMainTab(key) });
    }
    .width('100%')
    .height('100%')
    .backgroundColor(TOK_PAPER);
  }

  @Builder
  private topBar() {
    Row({ space: 18 }) {
      Image($r('app.media.bookshelf_title'))
        .width(56)
        .height(28)
        .objectFit(ImageFit.Contain)
        .layoutWeight(1);

      Stack({ alignContent: Alignment.Center }) {
        Image($r('app.media.bookshelf_search')).width(24).height(24);
      }
      .width(44)
      .height(44)
      .borderRadius(22);

      Stack({ alignContent: Alignment.Center }) {
        Image($r('app.media.bookshelf_more')).width(24).height(24);
      }
      .width(44)
      .height(44)
      .borderRadius(22)
      .onClick((): void => this.onImportRequested());
    }
    .width('100%')
    .height(58)
    .padding({ left: 20, right: 20, top: 6 })
    .alignItems(VerticalAlign.Center);
  }

  @Builder
  private sectionHeader() {
    Row() {
      Text('我的书架')
        .fontFamily('ReaderInter')
        .fontWeight(700)
        .fontSize(15)
        .lineHeight(18)
        .fontColor(TOK_INK)
        .layoutWeight(1);

      Row({ space: TOK_SPACE_XS }) {
        this.headerAction('bookshelf_grid');
        this.headerAction('bookshelf_list');
        this.headerAction('bookshelf_filter');
        this.headerAction('bookshelf_search');
        this.headerAction('bookshelf_settings');
      }
      .height(34);
    }
    .width(this.contentWidth())
    .height(38)
    .alignItems(VerticalAlign.Center);
  }

  @Builder
  private headerAction(asset: string) {
    Stack({ alignContent: Alignment.Center }) {
      if (asset === 'bookshelf_grid') {
        Image($r('app.media.bookshelf_grid')).width(20).height(20);
      } else if (asset === 'bookshelf_list') {
        Image($r('app.media.bookshelf_list')).width(20).height(20);
      } else if (asset === 'bookshelf_filter') {
        Image($r('app.media.bookshelf_filter')).width(20).height(20);
      } else if (asset === 'bookshelf_search') {
        Image($r('app.media.bookshelf_section_search')).width(20).height(20);
      } else {
        Image($r('app.media.bookshelf_settings')).width(20).height(20);
      }
    }
    .width(34)
    .height(34)
    .opacity(0.42)
    .borderRadius(17);
  }

  private onMainTab(key: string): void {
    if (key === 'discover') {
      this.onDiscoverRequested();
    } else if (key === 'rss') {
      this.onRssRequested();
    } else if (key === 'settings') {
      this.onSettingsRequested();
    }
    // 'bookshelf' is this page; MainTabBar suppresses the current tab.
  }

  private contentWidth(): number {
    // Figma supplies only the Phone `State/BookshelfEmpty` card; no Tablet
    // empty assembly, so Tablet reuses the Phone-width layout. Card is 352
    // wide (matches Settings page 390 - 2*19), replacing the old 350.9 value.
    return PHONE_CONTENT_WIDTH;
  }
}
