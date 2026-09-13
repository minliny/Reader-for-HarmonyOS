import { readerAppColor } from '../common/ReaderThemeRegistry';
import {
  type RssItem,
  type RssSubscription,
} from './RssGateway';
import { ReaderWindowCoordinator } from '../../app/ReaderWindowCoordinator';
import { PageBackBar } from '../common/PageBackBar';
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
  TOK_CONTENT_MAX_W_TABLET,
  TOK_GREEN,
  TOK_INK,
  TOK_MUTED,
  TOK_ON_PRIMARY,
  TOK_PAPER,
  TOK_PRIMARY_BG,
  TOK_PRIMARY_DARK,
  TOK_PRIMARY_SOFT,
  TOK_SCREEN_INSET,
  TOK_SPACE_CONTROL_INLINE,
  TOK_SPACE_LG,
  TOK_SPACE_SM,
  TOK_SPACE_XS,
} from '../common/ReaderTokens';


export type RssFavoritePresentation = 'loading' | 'favorited' | 'notFavorited' | 'unavailable';

/**
 * True RSS child route for one Core-owned item. `description` is rendered as
 * the feed-provided summary; it is never presented as a parsed full article.
 */
@Component
export struct RssEntryDetailPage {
  @StorageLink('readerAppScheme') private appThemeScheme: string = 'day';

  @StorageLink('readerWindowMetricsRevision') private readerWindowMetricsRevision: number = 0;
  @Prop subscription: RssSubscription;
  @Prop item: RssItem;
  @Prop isTablet: boolean;
  @Prop favoriteState: RssFavoritePresentation = 'loading';
  onBack: () => void = (): void => {};
  onViewSource: () => void = (): void => {};
  onFavoriteRequested: (favorite: boolean) => void = (_favorite: boolean): void => {};
  onSourceSettings: () => void = (): void => {};
  onOpenOriginal: () => void = (): void => {};
  @State private viewportWidth: number = 0;

  aboutToAppear(): void {
    registerReaderFonts(this.getUIContext().getFont());
  }

  build() {
    Column() {
      this.backBar();

      Scroll() {
        Column({ space: TOK_SPACE_SM }) {
          this.sourceCard();
          this.summaryCard();
          this.entryActions();
          if (this.summaryParagraphs().length > 0) {
            this.summaryBodyCard();
          }
          if (this.item.link !== undefined && this.item.link !== '') {
            this.originalLinkCard();
          }
        }
        .width(this.contentFrame().width)
        .padding({ top: TOK_SPACE_XS, bottom: TOK_SPACE_SM });
      }
      .layoutWeight(1)
      .width('100%')
      .scrollBar(BarState.Off)
      .align(Alignment.Top)
      .padding({ left: this.contentFrame().left, right: this.contentFrame().right });

      this.bottomActions();
    }
    .width('100%')
    .height('100%')
    .alignItems(HorizontalAlign.Center)
    .backgroundColor(readerAppColor('TOK_PAPER', this.appThemeScheme))
    .onAreaChange((_oldValue: Area, newValue: Area): void => {
      const width = this.numericAreaLength(newValue.width);
      if (width > 0 && Math.abs(width - this.viewportWidth) >= 0.01) {
        this.viewportWidth = width;
      }
    });
  }

  @Builder
  private backBar() {
    PageBackBar({
      title: 'RSS 阅读',
      onBack: (): void => this.onBack(),
    }) {
      Row({ space: 6 }) {
        Stack({ alignContent: Alignment.Center }) {
          Image(this.favoriteState === 'favorited' ?
            (this.appThemeScheme === 'night' ? $r('app.media.rss_bookmark_active_theme_night') : $r('app.media.rss_bookmark_active')) : (this.appThemeScheme === 'night' ? $r('app.media.rss_bookmark_theme_night') : $r('app.media.rss_bookmark')))
            .width(20)
            .height(20);
        }
        .width(32)
        .height(44)
        .borderRadius(16)
        .backgroundColor(this.favoriteState === 'favorited' ? readerAppColor('TOK_PRIMARY_SOFT', this.appThemeScheme) : readerAppColor('app.RssEntryDetailPage.backBar.backgroundColor.00000000', this.appThemeScheme))
        .opacity(this.favoriteState === 'loading' ? 0.45 : 1)
        .enabled(this.favoriteState === 'favorited' || this.favoriteState === 'notFavorited')
        .onClick((): void =>
          this.onFavoriteRequested(this.favoriteState !== 'favorited'));

        Stack({ alignContent: Alignment.Center }) {
          Image((this.appThemeScheme === 'night' ? $r('app.media.rss_external_theme_night') : $r('app.media.rss_external'))).width(20).height(20);
        }
        .width(32)
        .height(44)
        .opacity(this.hasOriginalLink() ? 1 : 0.38)
        .enabled(this.hasOriginalLink())
        .onClick((): void => this.onOpenOriginal());
      }
      .height(44)
      .alignItems(VerticalAlign.Center);
    }
  }

  @Builder
  private sourceCard() {
    Row({ space: TOK_SPACE_XS }) {
      Stack({ alignContent: Alignment.Center }) {
        Image((this.appThemeScheme === 'night' ? $r('app.media.rss_source_theme_night') : $r('app.media.rss_source'))).width(20).height(20);
      }
      .width(32)
      .height(32)
      .backgroundColor(readerAppColor('TOK_PRIMARY_BG', this.appThemeScheme))
      .borderRadius(16);

      Column({ space: 3 }) {
        Text(this.subscription.title)
          .width('100%')
          .fontFamily('ReaderInter')
          .fontWeight(FontWeight.Bold)
          .fontSize(13)
          .fontColor(readerAppColor('TOK_INK', this.appThemeScheme))
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis });
        Text(this.itemMeta())
          .width('100%')
          .fontFamily('ReaderInter')
          .fontWeight(FontWeight.Regular)
          .fontSize(10)
          .fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme))
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis });
      }
      .layoutWeight(1)
      .alignItems(HorizontalAlign.Start);

      Text('查看源')
        .height(28)
        .padding({ left: 9, right: 9 })
        .fontFamily('ReaderInter')
        .fontWeight(900)
        .fontSize(11)
        .fontColor(readerAppColor('TOK_PRIMARY_DARK', this.appThemeScheme))
        .textAlign(TextAlign.Center)
        .backgroundColor(readerAppColor('TOK_PRIMARY_SOFT', this.appThemeScheme))
        .borderRadius(999)
        .responseRegion({ x: 0, y: -8, width: '100%', height: 44 })
        .onClick((): void => this.onViewSource());
    }
    .width('100%')
    .height(58)
    .padding({ left: TOK_SPACE_CONTROL_INLINE, right: TOK_SPACE_CONTROL_INLINE })
    .alignItems(VerticalAlign.Center)
    .backgroundColor(readerAppColor('TOK_CARD_BG_HI', this.appThemeScheme))
    .border({ width: TOK_BORDER_W, color: readerAppColor('app.RssEntryDetailPage.CARD_BORDER', this.appThemeScheme) })
    .borderRadius(8);
  }

  @Builder
  private summaryCard() {
    Column({ space: TOK_SPACE_XS }) {
      Text(this.item.title)
        .width('100%')
        .fontFamily('ReaderInter')
        .fontWeight(FontWeight.Bold)
        .fontSize(20)
        .lineHeight(26)
        .fontColor(readerAppColor('TOK_INK', this.appThemeScheme))
        .maxLines(2)
        .textOverflow({ overflow: TextOverflow.Ellipsis });
    }
    .width('100%')
    .padding({ left: 14, right: 14, top: 16, bottom: 16 })
    .alignItems(HorizontalAlign.Start)
    .backgroundColor(readerAppColor('TOK_CARD_BG_HI', this.appThemeScheme))
    .border({ width: TOK_BORDER_W, color: readerAppColor('app.RssEntryDetailPage.CARD_BORDER', this.appThemeScheme) })
    .borderRadius(8);
  }

  @Builder
  private entryActions() {
    Row({ space: 7 }) {
      this.actionTarget('源设置', (this.appThemeScheme === 'night' ? $r('app.media.rss_manage_theme_night') : $r('app.media.rss_manage')), (): void => this.onSourceSettings());
    }
    .width('100%')
    .height(44)
    .alignItems(VerticalAlign.Center);
  }

  @Builder
  private actionTarget(label: string, icon: Resource, action: () => void) {
    Stack({ alignContent: Alignment.Center }) {
      Row({ space: 5 }) {
        Image(icon).width(18).height(18);
        Text(label)
          .fontFamily('ReaderInter')
          .fontWeight(800)
          .fontSize(11)
          .fontColor(readerAppColor('app.RssEntryDetailPage.actionTarget.fontColor.FF3F372F', this.appThemeScheme))
          .maxLines(1);
      }
      .width('100%')
      .height(34)
      .justifyContent(FlexAlign.Center)
      .alignItems(VerticalAlign.Center)
      .backgroundColor(readerAppColor('app.RssEntryDetailPage.ACTION_BG', this.appThemeScheme))
      .borderRadius(999);
    }
    .layoutWeight(1)
    .height(44)
    .onClick((): void => action());
  }

  @Builder
  private summaryBodyCard() {
    Column({ space: TOK_SPACE_SM }) {
      Text('摘要')
        .width('100%')
        .fontFamily('ReaderInter')
        .fontWeight(FontWeight.Bold)
        .fontSize(13)
        .fontColor(readerAppColor('TOK_INK', this.appThemeScheme));
      ForEach(this.summaryParagraphs(), (paragraph: string, index: number) => {
        Text(paragraph)
          .width('100%')
          .fontFamily('ReaderInter')
          .fontWeight(FontWeight.Regular)
          .fontSize(15)
          .lineHeight(26)
          .fontColor(readerAppColor('app.RssEntryDetailPage.summaryBodyCard.fontColor.FF3F372F', this.appThemeScheme));
      }, (_paragraph: string, index: number): string =>
        `rss-summary-${this.item.subscriptionId.length}:${this.item.subscriptionId}-${this.item.guid.length}:${this.item.guid}-${index}`);
    }
    .width('100%')
    .padding({ left: 16, right: 16, top: 16, bottom: 16 })
    .alignItems(HorizontalAlign.Start)
    .backgroundColor(readerAppColor('TOK_CARD_BG_HI', this.appThemeScheme))
    .border({ width: TOK_BORDER_W, color: readerAppColor('app.RssEntryDetailPage.CARD_BORDER', this.appThemeScheme) })
    .borderRadius(8);
  }

  @Builder
  private originalLinkCard() {
    Row({ space: TOK_SPACE_XS }) {
      Stack({ alignContent: Alignment.Center }) {
        Image((this.appThemeScheme === 'night' ? $r('app.media.rss_link_theme_night') : $r('app.media.rss_link'))).width(20).height(20);
      }
      .width(28)
      .height(28)
      .backgroundColor(readerAppColor('app.RssEntryDetailPage.ACTION_BG', this.appThemeScheme))
      .borderRadius(14);

      Column({ space: 3 }) {
        Text('原文链接')
          .width('100%')
          .fontFamily('ReaderInter')
          .fontWeight(FontWeight.Bold)
          .fontSize(13)
          .fontColor(readerAppColor('TOK_INK', this.appThemeScheme))
          .maxLines(1);
        Text(`${this.subscription.title} · 原始条目链接`)
          .width('100%')
          .fontFamily('ReaderInter')
          .fontWeight(FontWeight.Regular)
          .fontSize(10)
          .fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme))
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis });
      }
      .layoutWeight(1)
      .alignItems(HorizontalAlign.Start);

      Text('打开')
        .height(28)
        .padding({ left: 9, right: 9 })
        .fontFamily('ReaderInter')
        .fontWeight(900)
        .fontSize(11)
        .fontColor(readerAppColor('TOK_PRIMARY_DARK', this.appThemeScheme))
        .textAlign(TextAlign.Center)
        .backgroundColor(readerAppColor('TOK_PRIMARY_SOFT', this.appThemeScheme))
        .borderRadius(999);
    }
    .width('100%')
    .height(58)
    .padding({ left: TOK_SPACE_CONTROL_INLINE, right: TOK_SPACE_CONTROL_INLINE })
    .alignItems(VerticalAlign.Center)
    .backgroundColor(readerAppColor('TOK_CARD_BG_HI', this.appThemeScheme))
    .border({ width: TOK_BORDER_W, color: readerAppColor('app.RssEntryDetailPage.CARD_BORDER', this.appThemeScheme) })
    .borderRadius(8)
    .onClick((): void => this.onOpenOriginal());
  }

  @Builder
  private bottomActions() {
    Row({ space: TOK_SPACE_XS }) {
      Text('返回列表')
        .layoutWeight(1)
        .height(46)
        .fontFamily('ReaderInter')
        .fontWeight(900)
        .fontSize(13)
        .fontColor(readerAppColor('TOK_ON_PRIMARY', this.appThemeScheme))
        .textAlign(TextAlign.Center)
        .backgroundColor(readerAppColor('TOK_PRIMARY_DARK', this.appThemeScheme))
        .borderRadius(999)
        .onClick((): void => this.onBack());

      Text('打开原文')
        .layoutWeight(1)
        .height(46)
        .fontFamily('ReaderInter')
        .fontWeight(900)
        .fontSize(13)
        .fontColor(readerAppColor('TOK_PRIMARY_DARK', this.appThemeScheme))
        .textAlign(TextAlign.Center)
        .backgroundColor(readerAppColor('TOK_CARD_BG_HI', this.appThemeScheme))
        .border({ width: TOK_BORDER_W, color: readerAppColor('app.RssEntryDetailPage.CARD_BORDER', this.appThemeScheme) })
        .borderRadius(999)
        .opacity(this.hasOriginalLink() ? 1 : 0.38)
        .enabled(this.hasOriginalLink())
        .onClick((): void => this.onOpenOriginal());
    }
    .width(this.contentFrame().width)
    .margin({ left: this.contentFrame().left, right: this.contentFrame().right })
    .height(62)
    .padding({ top: TOK_SPACE_XS, bottom: TOK_SPACE_XS })
    .alignItems(VerticalAlign.Center);
  }

  private summaryParagraphs(): string[] {
    if (this.item.description === undefined || this.item.description.trim().length === 0) {
      return [];
    }
    return this.item.description
      .split(/\n+/)
      .map((paragraph: string): string => paragraph.trim())
      .filter((paragraph: string): boolean => paragraph.length > 0);
  }

  private hasOriginalLink(): boolean {
    return this.item.link !== undefined && this.item.link.trim().length > 0;
  }

  private itemMeta(): string {
    const parts: string[] = [];
    if (this.item.pubDate !== undefined && this.item.pubDate !== '') {
      parts.push(this.item.pubDate);
    }
    if (this.item.author !== undefined && this.item.author !== '') {
      parts.push(this.item.author);
    }
    return parts.join(' · ');
  }

  private contentFrame(): SurfaceHorizontalFrame {
    if (this.readerWindowMetricsRevision < 0) {
      return new SurfaceHorizontalFrame(0, 0, 0);
    }
    const metrics = ReaderWindowCoordinator.metrics();
    const containerWidth = this.viewportWidth > 0 ? this.viewportWidth : metrics.windowRect.width;
    return resolveHorizontalFrame(
      containerWidth,
      readerVisualSafeLeft(metrics),
      readerVisualSafeRight(metrics),
      new SurfaceWidthSpec(TOK_CONTENT_MAX_W_TABLET, TOK_SCREEN_INSET, TOK_SCREEN_INSET),
    );
  }

  private numericAreaLength(value: Length): number {
    if (typeof value === 'number') {
      return Number.isFinite(value) ? value : 0;
    }
    if (typeof value === 'string') {
      const parsed = Number.parseFloat(value);
      return Number.isFinite(parsed) ? parsed : 0;
    }
    return 0;
  }
}
