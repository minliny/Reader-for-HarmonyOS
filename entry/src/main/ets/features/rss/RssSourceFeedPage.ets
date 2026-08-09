import {
  type RssItem,
  type RssSubscription,
} from './RssGateway';
import { PageBackBar } from '../common/PageBackBar';
import { registerReaderFonts } from '../common/ReaderFonts';
import {
  TOK_BORDER_W,
  TOK_CARD_BG_HI,
  TOK_CONTENT_MAX_W_PHONE,
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

const RSS_CHILD_WIDE_BREAKPOINT = 600;
const CARD_BORDER = '#4DB4A697';
const ACTION_BG = '#D6EEE8DF';

/**
 * True RSS child route: one subscription's Core-owned cached feed. It has a
 * back bar and no main-tab shell.
 */
@Component
export struct RssSourceFeedPage {
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
        .width(this.contentWidth())
        .padding({ top: TOK_SPACE_XS, bottom: TOK_SPACE_LG });
      }
      .layoutWeight(1)
      .width('100%')
      .scrollBar(BarState.Off)
      .align(Alignment.Top);
    }
    .width('100%')
    .height('100%')
    .alignItems(HorizontalAlign.Center)
    .backgroundColor(TOK_PAPER)
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
        Image($r('app.media.rss_source')).width(20).height(20);
      }
      .width(32)
      .height(32)
      .backgroundColor(TOK_PRIMARY_BG)
      .borderRadius(16);

      Column({ space: 3 }) {
        Text(this.subscription.title)
          .width('100%')
          .fontFamily('ReaderInter')
          .fontWeight(FontWeight.Bold)
          .fontSize(13)
          .fontColor(TOK_INK)
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis });
        Text(this.sourceSubtitle())
          .width('100%')
          .fontFamily('ReaderInter')
          .fontWeight(FontWeight.Regular)
          .fontSize(10)
          .fontColor(TOK_MUTED)
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis });
      }
      .layoutWeight(1)
      .alignItems(HorizontalAlign.Start);

      Text('')
        .width(7)
        .height(7)
        .backgroundColor(this.subscription.enabled ? TOK_GREEN : TOK_MUTED)
        .borderRadius(3.5)
        .margin({ left: TOK_SPACE_XS, right: 3 });
    }
    .width('100%')
    .height(64)
    .padding({ left: TOK_SPACE_CONTROL_INLINE, right: TOK_SPACE_CONTROL_INLINE })
    .alignItems(VerticalAlign.Center)
    .backgroundColor(TOK_CARD_BG_HI)
    .border({ width: TOK_BORDER_W, color: CARD_BORDER })
    .borderRadius(8);
  }

  @Builder
  private sourceActions() {
    Row({ space: 2 }) {
      this.actionTarget('刷新', $r('app.media.rss_refresh'), (): void => this.onRefresh());
      this.actionTarget('编辑源', $r('app.media.rss_edit'), (): void => this.onEditSource());
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
          .fontColor('#3F372F')
          .maxLines(1);
      }
      .height(32)
      .padding({ left: 9, right: 9 })
      .alignItems(VerticalAlign.Center)
      .backgroundColor(ACTION_BG)
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
        .fontColor(TOK_INK)
        .maxLines(1);
      Row({ space: 5 }) {
        Image($r('app.media.rss_manage')).width(16).height(16);
        Text('源操作')
          .fontFamily('ReaderInter')
          .fontWeight(900)
          .fontSize(11)
          .fontColor(TOK_PRIMARY_DARK)
          .maxLines(1);
      }
      .height(30)
      .padding({ left: TOK_SPACE_XS, right: TOK_SPACE_XS })
      .alignItems(VerticalAlign.Center)
      .backgroundColor(TOK_PRIMARY_SOFT)
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
    Column() {
      ForEach(this.items, (item: RssItem, index: number) => {
        this.entryRow(item, index);
      }, (item: RssItem): string =>
        `rss-source-item-${item.subscriptionId.length}:${item.subscriptionId}-${item.guid.length}:${item.guid}`);
    }
    .width('100%')
    .backgroundColor(TOK_CARD_BG_HI)
    .border({ width: TOK_BORDER_W, color: CARD_BORDER })
    .borderRadius(8);
  }

  @Builder
  private entryRow(item: RssItem, index: number) {
    Row({ space: TOK_SPACE_XS }) {
      Text('')
        .width(7)
        .height(7)
        .backgroundColor(item.read ? '#A9A39A' : TOK_GREEN)
        .borderRadius(3.5)
        .margin({ top: 25 });

      Column({ space: 3 }) {
        Text(item.title)
          .width('100%')
          .fontFamily('ReaderInter')
          .fontWeight(FontWeight.Bold)
          .fontSize(13)
          .lineHeight(16.25)
          .fontColor(TOK_INK)
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis });
        Text(this.itemMeta(item))
          .width('100%')
          .fontFamily('ReaderInter')
          .fontWeight(FontWeight.Regular)
          .fontSize(10)
          .fontColor(TOK_MUTED)
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis });
        if (item.description !== undefined && item.description.trim().length > 0) {
          Text(item.description)
            .width('100%')
            .fontFamily('ReaderInter')
            .fontWeight(FontWeight.Regular)
            .fontSize(11)
            .lineHeight(15.95)
            .fontColor('#6F655D')
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
    .border({ width: { top: index > 0 ? TOK_BORDER_W : 0 }, color: TOK_ROW_DIVIDER })
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

  private contentWidth(): number {
    return this.isWideViewport() ? TOK_CONTENT_MAX_W_TABLET : TOK_CONTENT_MAX_W_PHONE;
  }

  private isWideViewport(): boolean {
    if (this.viewportWidth > 0) {
      return this.viewportWidth >= RSS_CHILD_WIDE_BREAKPOINT;
    }
    return this.isTablet;
  }

  private numericAreaLength(value: Length): number {
    return typeof value === 'number' && Number.isFinite(value) ? value : 0;
  }
}
