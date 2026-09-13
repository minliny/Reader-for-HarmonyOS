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
  TOK_CARD_BG_HI,
  TOK_CONTENT_MAX_W_TABLET,
  TOK_GREEN,
  TOK_INK,
  TOK_MUTED,
  TOK_PAPER,
  TOK_PRIMARY_BG,
  TOK_PRIMARY_DARK,
  TOK_PRIMARY_SOFT,
  TOK_ROW_DIVIDER,
  TOK_SCREEN_INSET,
  TOK_SPACE_CONTROL_INLINE,
  TOK_SPACE_LG,
  TOK_SPACE_SM,
  TOK_SPACE_XS,
} from '../common/ReaderTokens';


/**
 * True RSS child route: one subscription's Core-owned cached feed. It has a
 * back bar and no main-tab shell.
 */
@Component
export struct RssSourceFeedPage {
  @StorageLink('readerAppScheme') private appThemeScheme: string = 'day';

  @StorageLink('readerWindowMetricsRevision') private readerWindowMetricsRevision: number = 0;
  @Prop subscription: RssSubscription;
  @Prop items: RssItem[];
  @Prop isTablet: boolean;
  onBack: () => void = (): void => {};
  onSelectItem: (item: RssItem) => void = (_item: RssItem): void => {};
  onRefresh: () => void = (): void => {};
  onEditSource: () => void = (): void => {};
  onSourceOperations: () => void = (): void => {};
  @State private viewportWidth: number = 0;

  aboutToAppear(): void {
    registerReaderFonts(this.getUIContext().getFont());
  }

  build() {
    Column() {
      PageBackBar({
        title: '全部条目',
        onBack: (): void => this.onBack(),
      });

      Scroll() {
        Column({ space: TOK_SPACE_XS }) {
          this.sourceCard();
          this.sourceActions();
          this.entrySectionHeader();
          if (this.items.length > 0) {
            this.entryList();
          }
        }
        .width(this.contentFrame().width)
        .padding({ top: TOK_SPACE_XS, bottom: TOK_SPACE_LG });
      }
      .layoutWeight(1)
      .width('100%')
      .scrollBar(BarState.Off)
      .align(Alignment.Top)
      .padding({ left: this.contentFrame().left, right: this.contentFrame().right });
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
        Text(this.sourceSubtitle())
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

      Text('')
        .width(7)
        .height(7)
        .backgroundColor(this.subscription.enabled ? readerAppColor('app.action.fill', this.appThemeScheme) : readerAppColor('TOK_MUTED', this.appThemeScheme))
        .borderRadius(3.5)
        .margin({ left: TOK_SPACE_XS, right: 3 });
    }
    .width('100%')
    .height(64)
    .padding({ left: TOK_SPACE_CONTROL_INLINE, right: TOK_SPACE_CONTROL_INLINE })
    .alignItems(VerticalAlign.Center)
    .backgroundColor(readerAppColor('TOK_CARD_BG_HI', this.appThemeScheme))
    .border({ width: TOK_BORDER_W, color: readerAppColor('app.RssSourceFeedPage.CARD_BORDER', this.appThemeScheme) })
    .borderRadius(8);
  }

  @Builder
  private sourceActions() {
    Row({ space: 2 }) {
      this.actionTarget('刷新', (this.appThemeScheme === 'night' ? $r('app.media.rss_refresh_theme_night') : $r('app.media.rss_refresh')), (): void => this.onRefresh());
      this.actionTarget('编辑源', (this.appThemeScheme === 'night' ? $r('app.media.rss_edit_theme_night') : $r('app.media.rss_edit')), (): void => this.onEditSource());
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
          .fontColor(readerAppColor('app.RssSourceFeedPage.actionTarget.fontColor.FF3F372F', this.appThemeScheme))
          .maxLines(1);
      }
      .height(32)
      .padding({ left: 9, right: 9 })
      .alignItems(VerticalAlign.Center)
      .backgroundColor(readerAppColor('app.RssSourceFeedPage.ACTION_BG', this.appThemeScheme))
      .borderRadius(999);
    }
    .height(44)
    .onClick((): void => action());
  }

  @Builder
  private entrySectionHeader() {
    Row() {
      Text('全部条目')
        .layoutWeight(1)
        .fontFamily('ReaderInter')
        .fontWeight(FontWeight.Bold)
        .fontSize(15)
        .fontColor(readerAppColor('TOK_INK', this.appThemeScheme))
        .maxLines(1);
      Row({ space: 5 }) {
        Image((this.appThemeScheme === 'night' ? $r('app.media.rss_manage_theme_night') : $r('app.media.rss_manage'))).width(16).height(16);
        Text('源操作')
          .fontFamily('ReaderInter')
          .fontWeight(900)
          .fontSize(11)
          .fontColor(readerAppColor('TOK_PRIMARY_TEXT', this.appThemeScheme))
          .maxLines(1);
      }
      .height(30)
      .padding({ left: TOK_SPACE_XS, right: TOK_SPACE_XS })
      .alignItems(VerticalAlign.Center)
      .backgroundColor(readerAppColor('TOK_PRIMARY_SOFT', this.appThemeScheme))
      .borderRadius(999)
      .responseRegion({ x: 0, y: -7, width: '100%', height: 44 })
      .onClick((): void => this.onSourceOperations());
    }
    .width('100%')
    .height(34)
    .padding({ left: 2, right: 2 })
    .alignItems(VerticalAlign.Center);
  }

  @Builder
  private entryList() {
    List() {
      Repeat(this.items)
        .each((repeatItem: RepeatItem<RssItem>) => {
        ListItem() {
          this.entryRow(repeatItem.item, repeatItem.index);
        }
      })
      .key((item: RssItem): string =>
        `rss-source-item-${item.subscriptionId.length}:${item.subscriptionId}-${item.guid.length}:${item.guid}`)
      .virtualScroll({ reusable: true });
    }
    .width('100%')
    .height(Math.min(480, this.items.length * 72))
    .scrollBar(BarState.Off)
    .backgroundColor(readerAppColor('TOK_CARD_BG_HI', this.appThemeScheme))
    .border({ width: TOK_BORDER_W, color: readerAppColor('app.RssSourceFeedPage.CARD_BORDER', this.appThemeScheme) })
    .borderRadius(8);
  }

  @Builder
  private entryRow(item: RssItem, index: number) {
    Row({ space: TOK_SPACE_XS }) {
      Text('')
        .width(7)
        .height(7)
        .backgroundColor(item.read ? readerAppColor('app.RssSourceFeedPage.entryRow.backgroundColor.FFA9A39A', this.appThemeScheme) : readerAppColor('app.action.fill', this.appThemeScheme))
        .borderRadius(3.5)
        .margin({ top: 25 });

      Column({ space: 3 }) {
        Text(item.title)
          .width('100%')
          .fontFamily('ReaderInter')
          .fontWeight(FontWeight.Bold)
          .fontSize(13)
          .lineHeight(16.25)
          .fontColor(readerAppColor('TOK_INK', this.appThemeScheme))
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis });
        Text(this.itemMeta(item))
          .width('100%')
          .fontFamily('ReaderInter')
          .fontWeight(FontWeight.Regular)
          .fontSize(10)
          .fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme))
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis });
        if (item.description !== undefined && item.description.trim().length > 0) {
          Text(item.description)
            .width('100%')
            .fontFamily('ReaderInter')
            .fontWeight(FontWeight.Regular)
            .fontSize(11)
            .lineHeight(15.95)
            .fontColor(readerAppColor('app.RssSourceFeedPage.entryRow.fontColor.FF6F655D', this.appThemeScheme))
            .maxLines(2)
            .textOverflow({ overflow: TextOverflow.Ellipsis });
        }
      }
      .layoutWeight(1)
      .alignItems(HorizontalAlign.Start);
    }
    .width('100%')
    .padding({ left: TOK_SPACE_SM, right: TOK_SPACE_SM, top: TOK_SPACE_CONTROL_INLINE, bottom: TOK_SPACE_CONTROL_INLINE })
    .alignItems(VerticalAlign.Top)
    .border({ width: { top: index > 0 ? TOK_BORDER_W : 0 }, color: readerAppColor('TOK_ROW_DIVIDER', this.appThemeScheme) })
    .onClick((): void => this.onSelectItem(item));
  }

  private sourceSubtitle(): string {
    const parts: string[] = [];
    parts.push(`${this.items.length} 条`);
    const updated = this.updatedTime();
    if (updated !== '') {
      parts.push(updated);
    }
    if (parts.length > 0) {
      return parts.join(' · ');
    }
    return this.subscription.siteUrl !== undefined ? this.subscription.siteUrl : this.subscription.feedUrl;
  }

  private updatedTime(): string {
    if (this.subscription.lastFetchAt === undefined || this.subscription.lastFetchAt <= 0) {
      return '';
    }
    const date = new Date(this.subscription.lastFetchAt);
    const hours = date.getHours() < 10 ? `0${date.getHours()}` : `${date.getHours()}`;
    const minutes = date.getMinutes() < 10 ? `0${date.getMinutes()}` : `${date.getMinutes()}`;
    return `${hours}:${minutes}`;
  }

  private itemMeta(item: RssItem): string {
    const parts: string[] = [this.subscription.title];
    if (item.pubDate !== undefined && item.pubDate !== '') {
      parts.push(item.pubDate);
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
