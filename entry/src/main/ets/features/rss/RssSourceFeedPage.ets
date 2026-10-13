import { ReaderStandardPage } from '../common/ReaderStandardPage';
import { RssOriginalRecoverySurface } from './RssOriginalRecoverySurface';
import type { RssOriginalMutationIdentity, RssOriginalMutationProjection } from './RssMutationRecoveryContract';
import { ReaderLabeledIconAction } from '../common/ReaderLabeledIconAction';
import { ReaderRecoveryNotice } from '../common/ReaderRecoveryNotice';
import { readerRecoveryView } from '../../app/ReaderRecoveryProjection';
import { projectOperationFacts, type OperationFacts } from '../../app/ReaderOperationFacts';
import type { RssSourceSnapshot } from './RssOrchestrator';
import type { RssRouteOperationProjection } from './RssRouteOperationHost';
import { TYPE_APP_SMALL_ACTION, TYPE_RSS_ENTRY_DESCRIPTION, TYPE_RSS_ENTRY_TITLE, TYPE_RSS_LINK_ACTION, TYPE_RSS_META, TYPE_RSS_SECTION_HEADING, TYPE_RSS_SOURCE_TITLE } from '../common/ReaderTypography';
import { readerAppColor } from '../common/ReaderThemeRegistry';
import {
  type RssItem,
  type RssSubscription,
} from './RssGateway';
import { PageBackBar } from '../common/PageBackBar';
import { registerReaderFonts } from '../common/ReaderFonts';
import {
  TOK_BORDER_W,
  TOK_CARD_BG_HI,
  TOK_INK,
  TOK_MUTED,
  TOK_PRIMARY_BG,
  TOK_ROW_DIVIDER,
  TOK_SPACE_CONTROL_INLINE,
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

  @Prop subscription: RssSubscription;
  @Prop items: RssItem[];
  @Prop isTablet: boolean;
  @Prop operation: RssRouteOperationProjection<RssSourceSnapshot> | undefined = undefined;
  @Prop readFacts: OperationFacts<RssSourceSnapshot> = projectOperationFacts<RssSourceSnapshot>({ phase: 'idle' });
  @Prop presentationIdentity: string = '';
  @Prop original: RssOriginalMutationProjection | undefined = undefined;
  onReconcileOriginal: (expected: RssOriginalMutationIdentity) => void = (_expected: RssOriginalMutationIdentity): void => {};
  onContinueOriginal: (expected: RssOriginalMutationIdentity) => void = (_expected: RssOriginalMutationIdentity): void => {};
  onReconcile: (operation: RssRouteOperationProjection<RssSourceSnapshot>) => void = (_operation: RssRouteOperationProjection<RssSourceSnapshot>): void => {};
  onRetryRead: (facts: OperationFacts<RssSourceSnapshot>) => void = (_facts: OperationFacts<RssSourceSnapshot>): void => {};
  onBack: () => void = (): void => {};
  onSelectItem: (item: RssItem) => void = (_item: RssItem): void => {};
  onRefresh: () => void = (): void => {};
  onEditSource: () => void = (): void => {};
  onSourceOperations: () => void = (): void => {};

  aboutToAppear(): void {
    registerReaderFonts(this.getUIContext().getFont());
  }

  build() {
    ReaderStandardPage({
      variant: 'rssFeed',
      header: (): void => { this.pageHeader(); },
      content: (): void => { this.pageContent(); },
    });
  }

  @Builder
  private pageHeader() {
    PageBackBar({ title: '全部条目', onBack: (): void => this.onBack() });
  }

  @Builder
  private pageContent() {
    this.operationFeedback();
    this.sourceCard();
    this.sourceActions();
    this.entrySectionHeader();
    if (this.items.length > 0) {
      this.entryList();
    }
  }


  @Builder
  private operationFeedback() {
    RssOriginalRecoverySurface({ original: this.original, presentationIdentity: this.presentationIdentity, scope: 'feed',
      onReconcileOriginal: (expected: RssOriginalMutationIdentity): void => this.onReconcileOriginal(expected),
      onContinueOriginal: (expected: RssOriginalMutationIdentity): void => this.onContinueOriginal(expected) });
    if (this.original?.blocked !== true) {
    ReaderRecoveryNotice({ view: readerRecoveryView(this.operation?.projection, this.readFacts),
      actionLabel: '重新读取', onReconcile: (generation: number): void => this.retryFeedback(generation) });
    }
  }

  private retryFeedback(generation: number): void {
    const operation = this.operation;
    if (operation !== undefined && operation.projection.facts.generation === generation && operation.projection.facts.canRetry) {
      this.onReconcile(operation);
    } else if (this.readFacts.generation === generation && this.readFacts.canRetry) {
      this.onRetryRead(this.readFacts);
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
          .fontFamily(TYPE_RSS_SOURCE_TITLE.fontFamily)
          .fontWeight(TYPE_RSS_SOURCE_TITLE.fontWeight)
          .fontSize(TYPE_RSS_SOURCE_TITLE.fontSizeFp)
          .fontColor(readerAppColor('TOK_INK', this.appThemeScheme))
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis });
        Text(this.sourceSubtitle())
          .width('100%')
          .fontFamily(TYPE_RSS_META.fontFamily)
          .fontWeight(TYPE_RSS_META.fontWeight)
          .fontSize(TYPE_RSS_META.fontSizeFp)
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

  private canRefresh(): boolean {
    return (this.readFacts.fact === 'idle' || this.readFacts.fact === 'current' || this.readFacts.fact === 'empty') &&
      this.operation?.projection.receipt.confirmation !== 'unknown' && this.operation?.projection.receipt.readback !== 'reading' &&
      this.operation?.projection.receipt.fact !== 'confirmedRefreshFailed';
  }

  @Builder
  private sourceActions() {
    Row({ space: 2 }) {
      this.actionTarget('刷新', (this.appThemeScheme === 'night' ? $r('app.media.rss_refresh_theme_night') : $r('app.media.rss_refresh')), (): void => { if (this.canRefresh()) this.onRefresh(); });
      this.actionTarget('编辑源', (this.appThemeScheme === 'night' ? $r('app.media.rss_edit_theme_night') : $r('app.media.rss_edit')), (): void => this.onEditSource());
    }
    .width('100%')
    .height(44)
    .alignItems(VerticalAlign.Center);
  }

  @Builder
  private actionTarget(label: string, icon: Resource, action: () => void) {
    ReaderLabeledIconAction({ scheme: this.appThemeScheme, specId: 'rss-feed', label, icon, onAction: action });
  }

  @Builder
  private entrySectionHeader() {
    Row() {
      Text('全部条目')
        .layoutWeight(1)
        .fontFamily(TYPE_RSS_SECTION_HEADING.fontFamily)
        .fontWeight(TYPE_RSS_SECTION_HEADING.fontWeight)
        .fontSize(TYPE_RSS_SECTION_HEADING.fontSizeFp)
        .fontColor(readerAppColor('TOK_INK', this.appThemeScheme))
        .maxLines(1);
      ReaderLabeledIconAction({ scheme: this.appThemeScheme, specId: 'rss-source-operations', label: '源操作',
        icon: this.appThemeScheme === 'night' ? $r('app.media.rss_manage_theme_night') : $r('app.media.rss_manage'),
        onAction: (): void => this.onSourceOperations() });
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
          .fontFamily(TYPE_RSS_ENTRY_TITLE.fontFamily)
          .fontWeight(TYPE_RSS_ENTRY_TITLE.fontWeight)
          .fontSize(TYPE_RSS_ENTRY_TITLE.fontSizeFp)
          .lineHeight(TYPE_RSS_ENTRY_TITLE.lineHeightFp as number)
          .fontColor(readerAppColor('TOK_INK', this.appThemeScheme))
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis });
        Text(this.itemMeta(item))
          .width('100%')
          .fontFamily(TYPE_RSS_META.fontFamily)
          .fontWeight(TYPE_RSS_META.fontWeight)
          .fontSize(TYPE_RSS_META.fontSizeFp)
          .fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme))
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis });
        if (item.description !== undefined && item.description.trim().length > 0) {
          Text(item.description)
            .width('100%')
            .fontFamily(TYPE_RSS_ENTRY_DESCRIPTION.fontFamily)
            .fontWeight(TYPE_RSS_ENTRY_DESCRIPTION.fontWeight)
            .fontSize(TYPE_RSS_ENTRY_DESCRIPTION.fontSizeFp)
            .lineHeight(TYPE_RSS_ENTRY_DESCRIPTION.lineHeightFp as number)
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

}
