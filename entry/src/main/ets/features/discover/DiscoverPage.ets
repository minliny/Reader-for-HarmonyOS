import { readerAppColor } from '../common/ReaderThemeRegistry';
// Discover main page — rebuilt 2026-08-06 against live Figma node 376:2
// (Reference/Discover/Phone · 390×844).
// Data honesty: source.explore results do not exist in the app yet, so the
// source card carries a neutral 书源 label and the result list renders an
// empty state. No book rows are fabricated.
// Icons: existing media only (no new SVG assets).

import { MainTabShell } from '../shell/MainTabShell';
import { ReaderWindowCoordinator } from '../../app/ReaderWindowCoordinator';
import { ReaderIconButton } from '../common/ReaderIconButton';
import { AppTopBar } from '../common/AppTopBar';
import { registerReaderFonts } from '../common/ReaderFonts';
import {
  SurfaceHorizontalFrame,
  SurfaceWidthSpec,
  resolveHorizontalFrame,
} from '../common/SurfaceHorizontalGeometry';
import {
  readerVisualSafeLeft,
  readerVisualSafeRight,
} from '../common/ReaderWindowMetrics';
import {
  TOK_BORDER_W,
  TOK_CARD_BG,
  TOK_CARD_BG_HI,
  TOK_CONTENT_RAIL_W_TABLET,
  TOK_GREEN,
  TOK_INK,
  TOK_LINE_STRONG,
  TOK_MUTED,
  TOK_ON_PRIMARY,
  TOK_SCREEN_INSET,
  TOK_SPACE_CONTROL_INLINE,
  TOK_SPACE_ROW_BLOCK,
  TOK_SPACE_SM,
  TOK_SPACE_XS,
} from '../common/ReaderTokens';
import {
  type DiscoverBook,
  type DiscoverKind,
} from './DiscoverGateway';
import {
  EMPTY_DISCOVER_PRESENTATION,
  type DiscoverPresentation,
} from './DiscoverOrchestrator';


@Component
export struct DiscoverPage {
  @StorageLink('readerAppScheme') private appThemeScheme: string = 'day';

  @StorageLink('readerWindowMetricsRevision') private readerWindowMetricsRevision: number = 0;
  @Prop presentation: DiscoverPresentation = EMPTY_DISCOVER_PRESENTATION;
  @Prop isTablet: boolean;
  onBack: () => void = (): void => {};
  onRssRequested: () => void = (): void => {};
  onSettingsRequested: () => void = (): void => {};
  onRefresh: () => void = (): void => {};
  onCycleSource: () => void = (): void => {};
  onSelectKind: (index: number) => void = (_index: number): void => {};
  onPreviousPage: () => void = (): void => {};
  onNextPage: () => void = (): void => {};

  aboutToAppear(): void {
    registerReaderFonts(this.getUIContext().getFont());
  }

  build() {
    MainTabShell({
      activeTab: 'discover',
      onMainTab: (key: string): void => this.onMainTab(key),
    }) {
      this.discoverTabContent();
    }
  }

  @Builder
  private discoverTabContent() {
    Column() {
      this.homeTopBar();
      this.discoverContent();
    }
    .width('100%')
    .height('100%');
  }

  @Builder
  private homeTopBar() {
    AppTopBar({ title: '发现' }) {
      ReaderIconButton({
        icon: (this.appThemeScheme === 'night' ? $r('app.media.discover_refresh_theme_night') : $r('app.media.discover_refresh')),
        boxSize: 44,
        iconSize: 24,
        radius: 22,
        onTap: (): void => this.onRefresh(),
      });
    }
  }

  @Builder
  private discoverContent() {
    Scroll() {
      Column({ space: 7 }) {
        this.currentSourceCard();
        this.categoryChips();
        this.filterRow();
        this.rankingHeader();
        this.resultList();
      }
      .width('100%')
      .constraintSize({ maxWidth: this.contentFrame().width })
      .padding({ top: TOK_SPACE_XS, bottom: TOK_SPACE_SM });
    }
    .layoutWeight(1)
    .width('100%')
    .align(Alignment.Top)
    .padding({ left: this.contentFrame().left, right: this.contentFrame().right })
    .scrollBar(BarState.Off);
  }

  @Builder
  private currentSourceCard() {
    Row({ space: TOK_SPACE_CONTROL_INLINE }) {
      Stack({ alignContent: Alignment.Center }) {
        Image((this.appThemeScheme === 'night' ? $r('app.media.discover_source_stack_theme_night') : $r('app.media.discover_source_stack'))).width(20).height(20);
      }
      .width(34)
      .height(34)
      .borderRadius(17)
      .backgroundColor(readerAppColor('app.DiscoverPage.ICON_BOX_BG', this.appThemeScheme));

      Column({ space: 3 }) {
        Text(this.currentSourceName())
          .width('100%')
          .fontFamily('ReaderInter')
          .fontWeight(FontWeight.Bold)
          .fontSize(15)
          .lineHeight(18)
          .fontColor(readerAppColor('TOK_INK', this.appThemeScheme))
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis });

        Text(this.presentation.sources.length > 0 ?
          `${this.presentation.activeSourceIndex + 1}/${this.presentation.sources.length} · 点击切换书源` :
          '没有已启用发现的书源')
          .width('100%')
          .fontFamily('ReaderInter')
          .fontWeight(600)
          .fontSize(11)
          .lineHeight(13.2)
          .fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme))
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis });
      }
      .layoutWeight(1)
      .alignItems(HorizontalAlign.Start);

      Image((this.appThemeScheme === 'night' ? $r('app.media.discover_source_chevron_theme_night') : $r('app.media.discover_source_chevron'))).width(20).height(20);
    }
    .width('100%')
    .height(58)
    .padding({ left: TOK_SPACE_SM, right: 13.1 })
    .alignItems(VerticalAlign.Center)
    .backgroundColor(readerAppColor('TOK_CARD_BG_HI', this.appThemeScheme))
    .border({ width: TOK_BORDER_W, color: readerAppColor('app.DiscoverPage.CURRENT_SOURCE_BORDER', this.appThemeScheme) })
    .borderRadius(8)
    .onClick((): void => this.onCycleSource());
  }

  @Builder
  private categoryChips() {
    Scroll() {
      Row({ space: 7 }) {
        ForEach(this.kindTitles(), (label: string, index: number) => {
          Stack({ alignContent: Alignment.Center }) {
            Text(label)
              .fontFamily('ReaderInter')
              .fontWeight(800)
              .fontSize(12)
              .lineHeight(15.6)
              .fontColor(this.presentation.activeKindIndex === index ? readerAppColor('TOK_ON_PRIMARY', this.appThemeScheme) : readerAppColor('app.DiscoverPage.categoryChips.fontColor.FF3F372F', this.appThemeScheme))
              .maxLines(1);
          }
          .height(32)
          .padding({ left: TOK_SPACE_SM, right: TOK_SPACE_SM })
          .backgroundColor(this.presentation.activeKindIndex === index ? readerAppColor('app.action.fill', this.appThemeScheme) : readerAppColor('app.DiscoverPage.CHIP_BG', this.appThemeScheme))
          .borderRadius(999)
          .onClick((): void => {
            this.onSelectKind(index);
          });
        }, (label: string): string => `discover-chip-${label}`);
      }
      .height(32)
      .padding({ right: TOK_SPACE_XS })
      .alignItems(VerticalAlign.Center);
    }
    .width('100%')
    .height(32)
    .scrollable(ScrollDirection.Horizontal)
    .scrollBar(BarState.Off);
  }

  @Builder
  private filterRow() {
    Row({ space: 7 }) {
      Row() {
        Image((this.appThemeScheme === 'night' ? $r('app.media.discover_filter_theme_night') : $r('app.media.discover_filter'))).width(20).height(20);
        Text('筛选')
          .fontFamily('ReaderInter')
          .fontWeight(900)
          .fontSize(12)
          .lineHeight(15.6)
          .fontColor(readerAppColor('app.DiscoverPage.filterRow.fontColor.FF3F372F', this.appThemeScheme))
          .maxLines(1)
          .margin({ left: 3 });
        Text(this.currentFilterText())
          .layoutWeight(1)
          .fontFamily('ReaderInter')
          .fontWeight(800)
          .fontSize(11)
          .lineHeight(15.56)
          .fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme))
          .textAlign(TextAlign.RIGHT)
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
          .padding({ left: 7 });
        Image((this.appThemeScheme === 'night' ? $r('app.media.discover_filter_chevron_theme_night') : $r('app.media.discover_filter_chevron'))).width(20).height(20);
      }
      .layoutWeight(1)
      .height(34)
      .padding({ left: TOK_SPACE_CONTROL_INLINE, right: 5 })
      .alignItems(VerticalAlign.Center)
      .backgroundColor(readerAppColor('TOK_CARD_BG', this.appThemeScheme))
      .border({ width: TOK_BORDER_W, color: readerAppColor('app.DiscoverPage.FILTER_BORDER', this.appThemeScheme) })
      .borderRadius(8);

      Row() {
        Image($r('app.media.discover_apply')).width(20).height(20);
        Text('应用')
          .fontFamily('ReaderInter')
          .fontWeight(900)
          .fontSize(12)
          .lineHeight(15.6)
          .fontColor(readerAppColor('TOK_ON_PRIMARY', this.appThemeScheme))
          .maxLines(1)
          .margin({ left: TOK_SPACE_ROW_BLOCK });
      }
      .width(69.097)
      .height(34)
      .padding({ left: TOK_SPACE_CONTROL_INLINE })
      .alignItems(VerticalAlign.Center)
      .linearGradient({
        angle: 270,
        colors: [[readerAppColor('app.DiscoverPage.filterRow.linearGradient.FF436F88', this.appThemeScheme), 0], [readerAppColor('app.DiscoverPage.filterRow.linearGradient.FF315F78', this.appThemeScheme), 1]],
      })
      .border({ width: TOK_BORDER_W, color: readerAppColor('app.DiscoverPage.APPLY_BORDER', this.appThemeScheme) })
      .borderRadius(8)
      .onClick((): void => this.onRefresh());
    }
    .width('100%')
    .height(34)
    .alignItems(VerticalAlign.Center);
  }

  @Builder
  private rankingHeader() {
    Text('排行榜')
      .width('100%')
      .fontFamily('ReaderInter')
      .fontWeight(FontWeight.Bold)
      .fontSize(15)
      .lineHeight(18.75)
      .fontColor(readerAppColor('TOK_INK', this.appThemeScheme))
      .maxLines(1)
      .padding({ left: 2, right: 2 });
  }

  @Builder
  private resultList() {
    Column({ space: 0 }) {
      if (this.presentation.books.length === 0) {
        Stack({ alignContent: Alignment.Center }) {
          Column({ space: TOK_SPACE_XS }) {
            Text('暂无发现内容')
              .fontFamily('ReaderInter')
              .fontWeight(800)
              .fontSize(14)
              .lineHeight(18)
              .fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme))
              .maxLines(1);
            Text(this.presentation.statusMessage)
              .fontFamily('ReaderInter')
              .fontWeight(FontWeight.Regular)
              .fontSize(12)
              .lineHeight(15)
              .fontColor(readerAppColor('app.DiscoverPage.resultList.fontColor.FFA19A91', this.appThemeScheme))
              .maxLines(1);
          }
          .alignItems(HorizontalAlign.Center);
        }
        .width('100%')
        .height(200);
      } else {
        ForEach(this.presentation.books, (book: DiscoverBook) => {
          this.resultRow(book);
        }, (book: DiscoverBook): string => `discover-book-${book.bookId}`);
      }
      this.paginationRow();
    }
    .width('100%')
    .backgroundColor(readerAppColor('TOK_CARD_BG', this.appThemeScheme))
    .border({ width: TOK_BORDER_W, color: readerAppColor('TOK_LINE_STRONG', this.appThemeScheme) })
    .borderRadius(8)
    .clip(true);
  }

  @Builder
  private paginationRow() {
    Row({ space: TOK_SPACE_SM }) {
      this.pageAction('上一页', this.presentation.hasPrevious, (): void => this.onPreviousPage());
      Text(`第 ${this.presentation.page} 页`)
        .layoutWeight(1)
        .textAlign(TextAlign.Center)
        .fontFamily('ReaderInter')
        .fontWeight(FontWeight.Bold)
        .fontSize(12)
        .fontColor(readerAppColor('TOK_INK', this.appThemeScheme));
      this.pageAction('下一页', this.presentation.hasNext, (): void => this.onNextPage());
    }
    .width('100%')
    .height(48)
    .padding({ left: TOK_SPACE_SM, right: TOK_SPACE_SM })
    .alignItems(VerticalAlign.Center)
    .border({ width: { top: TOK_BORDER_W }, color: readerAppColor('TOK_LINE_STRONG', this.appThemeScheme) });
  }

  @Builder
  private pageAction(label: string, enabled: boolean, action: () => void) {
    Text(label)
      .fontFamily('ReaderInter')
      .fontWeight(FontWeight.Bold)
      .fontSize(11)
      .fontColor(enabled ? readerAppColor('TOK_ON_PRIMARY', this.appThemeScheme) : readerAppColor('TOK_MUTED', this.appThemeScheme))
      .backgroundColor(enabled ? readerAppColor('app.action.fill', this.appThemeScheme) : readerAppColor('app.DiscoverPage.CHIP_BG', this.appThemeScheme))
      .padding({ left: TOK_SPACE_SM, right: TOK_SPACE_SM, top: 8, bottom: 8 })
      .borderRadius(999)
      .opacity(this.presentation.loading ? 0.6 : 1)
      .onClick((): void => {
        if (enabled && !this.presentation.loading) action();
      });
  }

  @Builder
  private resultRow(book: DiscoverBook) {
    Row({ space: TOK_SPACE_SM }) {
      Stack({ alignContent: Alignment.Center }) {
        if (book.coverUrl !== '') {
          Image(book.coverUrl)
            .width(52)
            .height(74)
            .objectFit(ImageFit.Cover)
            .borderRadius(4);
        } else {
          Row()
            .width(52)
            .height(74)
            .borderRadius(4)
            .backgroundColor(readerAppColor('app.DiscoverPage.resultRow.backgroundColor.FFE4E0D8', this.appThemeScheme));
        }
      }

      Column({ space: TOK_SPACE_ROW_BLOCK }) {
        Text(book.name)
          .width('100%')
          .fontFamily('ReaderInter')
          .fontWeight(FontWeight.Bold)
          .fontSize(15)
          .lineHeight(18.75)
          .fontColor(readerAppColor('TOK_INK', this.appThemeScheme))
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis });
        if (book.author !== '') {
          Text(book.author)
            .width('100%')
            .fontFamily('ReaderInter')
            .fontWeight(FontWeight.Bold)
            .fontSize(11)
            .lineHeight(15.56)
            .fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme))
            .maxLines(1)
            .textOverflow({ overflow: TextOverflow.Ellipsis });
        }
        if (book.intro !== '') {
          Text(book.intro)
            .width('100%')
            .fontFamily('ReaderInter')
            .fontWeight(FontWeight.Regular)
            .fontSize(12)
            .lineHeight(17.4)
            .fontColor(readerAppColor('app.DiscoverPage.resultRow.fontColor.FF5C554D', this.appThemeScheme))
            .maxLines(2)
            .textOverflow({ overflow: TextOverflow.Ellipsis });
        }
      }
      .layoutWeight(1)
      .alignItems(HorizontalAlign.Start);
    }
    .width('100%')
    .height(98)
    .padding({ left: TOK_SPACE_SM, right: TOK_SPACE_SM, top: TOK_SPACE_SM, bottom: TOK_SPACE_SM })
    .alignItems(VerticalAlign.Top)
    .border({ width: { top: TOK_BORDER_W }, color: readerAppColor('TOK_LINE_STRONG', this.appThemeScheme) });
  }

  private onMainTab(key: string): void {
    if (key === 'bookshelf') {
      this.onBack();
    } else if (key === 'rss') {
      this.onRssRequested();
    } else if (key === 'settings') {
      this.onSettingsRequested();
    }
    // 'discover' is this page; MainTabBar suppresses the current tab.
  }

  private contentFrame(): SurfaceHorizontalFrame {
    if (this.readerWindowMetricsRevision < 0) {
      return new SurfaceHorizontalFrame(0, 0, 0);
    }
    const metrics = ReaderWindowCoordinator.metrics();
    return resolveHorizontalFrame(
      metrics.windowRect.width,
      readerVisualSafeLeft(metrics),
      readerVisualSafeRight(metrics),
      new SurfaceWidthSpec(TOK_CONTENT_RAIL_W_TABLET, TOK_SCREEN_INSET, TOK_SCREEN_INSET),
    );
  }

  private kindTitles(): string[] {
    if (this.presentation.kinds.length > 0) {
      return this.presentation.kinds.map((k: DiscoverKind): string => k.title);
    }
    return ['排行榜', '书源', '分类', '完本', '最新', '书单'];
  }

  private currentSourceName(): string {
    return this.presentation.sources[this.presentation.activeSourceIndex]?.name ?? '书源';
  }

  private currentFilterText(): string {
    const kind = this.presentation.kinds[this.presentation.activeKindIndex]?.title ?? '未选择分类';
    return `${kind} · 第 ${this.presentation.page} 页`;
  }
}
