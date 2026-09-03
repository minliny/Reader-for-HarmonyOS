import { PageBackBar } from '../common/PageBackBar';
import { ReaderWindowCoordinator } from '../../app/ReaderWindowCoordinator';
import { ReaderToggle } from '../common/ReaderToggle';
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
  TOK_DANGER,
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
  TOK_SPACE_XS,
  TOK_SURFACE_PANEL_SOFT,
} from '../common/ReaderTokens';

/** Presentation-only row data. Business truth remains owned by Core. */
export interface RssSubscriptionManagementItem {
  subscriptionId: string;
  title: string;
  meta: string;
  enabled: boolean;
}

/**
 * Figma-backed RSS subscription management child page.
 * Reference: Page/RSS/SubscriptionManagement Phone/Tablet (phase 11).
 *
 * The page owns only disclosure state. Every business action is emitted as an
 * intent with subscription identity; it never mutates subscription data.
 */
@Component
export struct RssSubscriptionManagementPage {
  @StorageLink('readerWindowMetricsRevision') private readerWindowMetricsRevision: number = 0;
  @Prop items: RssSubscriptionManagementItem[];
  @Prop isTablet: boolean;
  /** Optional route identity: expands the matching row without mutating it. */
  @Prop focusedSubscriptionId: string = '';
  onBack: () => void = (): void => {};
  onAdd: () => void = (): void => {};
  onImport: () => void = (): void => {};
  onExport: () => void = (): void => {};
  onToggle: (subscriptionId: string, enabled: boolean) => void =
    (_subscriptionId: string, _enabled: boolean): void => {};
  onViewArticles: (subscriptionId: string) => void = (_subscriptionId: string): void => {};
  onEditSource: (subscriptionId: string) => void = (_subscriptionId: string): void => {};
  onRefresh: (subscriptionId: string) => void = (_subscriptionId: string): void => {};
  onDelete: (subscriptionId: string) => void = (_subscriptionId: string): void => {};
  onDisclosureChanged: (subscriptionId: string, expanded: boolean) => void =
    (_subscriptionId: string, _expanded: boolean): void => {};
  @State private expandedSubscriptionId: string = '';
  private readonly pageScroller: Scroller = new Scroller();

  aboutToAppear(): void {
    registerReaderFonts(this.getUIContext().getFont());
    if (this.items.some((item: RssSubscriptionManagementItem): boolean =>
      item.subscriptionId === this.focusedSubscriptionId)) {
      this.expandedSubscriptionId = this.focusedSubscriptionId;
    }
  }

  build() {
    Column() {
      this.backBar();

      Scroll(this.pageScroller) {
        Column() {
          this.stats();
          this.subscriptionList();
        }
        .width('100%')
        .constraintSize({ maxWidth: this.contentFrame().width })
        .padding({ top: TOK_SPACE_XS, bottom: TOK_SPACE_LG })
        .alignItems(HorizontalAlign.Start);
      }
      .width('100%')
      .layoutWeight(1)
      .align(Alignment.Top)
      .padding({ left: this.contentFrame().left, right: this.contentFrame().right })
      .scrollBar(BarState.Off);
    }
    .width('100%')
    .height('100%')
    .alignItems(HorizontalAlign.Center)
    .backgroundColor(TOK_PAPER);
  }

  @Builder
  private backBar() {
    PageBackBar({
      title: '订阅源管理',
      onBack: (): void => this.onBack(),
    }) {
      Row({ space: 3 }) {
        Image($r('app.media.rss_add'))
          .width(14)
          .height(14);
        Text('添加')
          .fontFamily('ReaderNotoSansSC')
          .fontWeight(FontWeight.Bold)
          .fontSize(11)
          .fontColor(TOK_PRIMARY_DARK)
          .maxLines(1);
      }
      .width(60)
      .height(32)
      .justifyContent(FlexAlign.Center)
      .alignItems(VerticalAlign.Center)
      .backgroundColor(TOK_PRIMARY_SOFT)
      .borderRadius(999)
      .responseRegion({ x: 0, y: -6, width: '100%', height: 44 })
      .onClick((): void => this.onAdd());
    }
  }

  @Builder
  private stats() {
    Column({ space: TOK_SPACE_XS }) {
      Text(`${this.items.length} 个订阅源 · ${this.enabledCount()} 个启用 · ${this.disabledCount()} 个停用`)
        .width('100%')
        .fontFamily('ReaderNotoSansSC')
        .fontWeight(FontWeight.Regular)
        .fontSize(10)
        .lineHeight(12.5)
        .fontColor(TOK_MUTED)
        .maxLines(1)
        .textOverflow({ overflow: TextOverflow.Ellipsis });
      Row({ space: TOK_SPACE_XS }) {
        this.sourceDocumentAction('导入 RSS 源', (): void => this.onImport());
        this.sourceDocumentAction('导出全部', (): void => this.onExport());
      }
      .width('100%');
    }
    .width('100%')
    .alignItems(HorizontalAlign.Start);
  }

  @Builder
  private sourceDocumentAction(label: string, action: () => void) {
    Text(label)
      .layoutWeight(1)
      .height(36)
      .textAlign(TextAlign.Center)
      .fontFamily('ReaderNotoSansSC')
      .fontWeight(FontWeight.Bold)
      .fontSize(11)
      .fontColor(TOK_PRIMARY_DARK)
      .backgroundColor(TOK_PRIMARY_SOFT)
      .borderRadius(8)
      .onClick((): void => action());
  }

  @Builder
  private subscriptionList() {
    List() {
      Repeat(this.items)
        .each((repeatItem: RepeatItem<RssSubscriptionManagementItem>) => {
        ListItem() {
          this.subscriptionItem(repeatItem.item, repeatItem.index);
        }
      })
      .key((item: RssSubscriptionManagementItem): string => `rss-management-${item.subscriptionId}`)
      .virtualScroll({ reusable: true });
    }
    .width('100%')
    .height(Math.min(520, Math.max(72, this.items.length * 92)))
    .scrollBar(BarState.Off)
    .margin({ top: TOK_SPACE_CONTROL_INLINE })
    .backgroundColor(TOK_CARD_BG_HI)
    .border({ width: TOK_BORDER_W, color: TOK_ROW_DIVIDER })
    .borderRadius(8)
    .clip(true);
  }

  @Builder
  private subscriptionItem(item: RssSubscriptionManagementItem, index: number) {
    Column() {
      Row() {
        Stack({ alignContent: Alignment.Center }) {
          Image($r('app.media.rss_source'))
            .width(20)
            .height(20);
        }
        .width(32)
        .height(32)
        .margin({ left: TOK_SPACE_CONTROL_INLINE })
        .backgroundColor(TOK_PRIMARY_BG)
        .borderRadius(16)
        .opacity(item.enabled ? 1 : 0.58);

        Column({ space: 3 }) {
          Text(item.title)
            .width('100%')
            .fontFamily('ReaderNotoSansSC')
            .fontWeight(FontWeight.Bold)
            .fontSize(13)
            .lineHeight(15.34)
            .fontColor(TOK_INK)
            .maxLines(1)
            .textOverflow({ overflow: TextOverflow.Ellipsis });
          Text(item.meta)
            .width('100%')
            .fontFamily('ReaderNotoSansSC')
            .fontWeight(FontWeight.Regular)
            .fontSize(10)
            .lineHeight(12.5)
            .fontColor(TOK_MUTED)
            .maxLines(1)
            .textOverflow({ overflow: TextOverflow.Ellipsis });
        }
        .layoutWeight(1)
        .margin({ left: TOK_SPACE_CONTROL_INLINE })
        .alignItems(HorizontalAlign.Start)
        .opacity(item.enabled ? 1 : 0.62);

        Stack({ alignContent: Alignment.Center }) {
          ReaderToggle({
            value: item.enabled,
            radius: 999,
            onToggle: (): void => this.onToggle(item.subscriptionId, !item.enabled),
          });
        }
        .width(44)
        .height(44);

        Stack({ alignContent: Alignment.Center }) {
          Image($r('app.media.rss_filter_chevron'))
            .width(20)
            .height(20)
            .rotate({ angle: this.isExpanded(item.subscriptionId) ? 180 : 0 });
        }
        .width(44)
        .height(44)
        .onClick((): void => this.toggleDisclosure(item.subscriptionId));
      }
      .width('100%')
      .height(56)
      .alignItems(VerticalAlign.Center)
      .border({ width: { top: index > 0 ? TOK_BORDER_W : 0 }, color: TOK_ROW_DIVIDER });

      if (this.isExpanded(item.subscriptionId)) {
        this.actionBar(item.subscriptionId);
      }
    }
    .width('100%')
    .onAppear((): void => this.focusSubscriptionIfNeeded(item, index));
  }

  @Builder
  private actionBar(subscriptionId: string) {
    Row() {
      this.actionTarget('查看文章', $r('app.media.rss_manage_view_all'), false, false,
        (): void => this.onViewArticles(subscriptionId));
      this.actionTarget('编辑来源', $r('app.media.rss_manage_edit'), false, true,
        (): void => this.onEditSource(subscriptionId));
      this.actionTarget('立即刷新', $r('app.media.rss_manage_refresh'), false, true,
        (): void => this.onRefresh(subscriptionId));
      this.actionTarget('删除', $r('app.media.rss_manage_delete'), true, true,
        (): void => this.onDelete(subscriptionId));
    }
    .width('100%')
    .height(44)
    .alignItems(VerticalAlign.Center)
    .backgroundColor(TOK_SURFACE_PANEL_SOFT)
    .border({ width: { top: TOK_BORDER_W }, color: TOK_ROW_DIVIDER });
  }

  @Builder
  private actionTarget(
    label: string,
    icon: Resource,
    danger: boolean,
    divider: boolean,
    action: () => void,
  ) {
    Row({ space: 5 }) {
      Image(icon)
        .width(16)
        .height(16);
      Text(label)
        .fontFamily('ReaderNotoSansSC')
        .fontWeight(FontWeight.Bold)
        .fontSize(11)
        .fontColor(danger ? TOK_DANGER : TOK_INK)
        .maxLines(1);
    }
    .layoutWeight(1)
    .height(44)
    .justifyContent(FlexAlign.Center)
    .alignItems(VerticalAlign.Center)
    .border({ width: { left: divider ? TOK_BORDER_W : 0 }, color: TOK_ROW_DIVIDER })
    .onClick((): void => action());
  }

  private toggleDisclosure(subscriptionId: string): void {
    const expanded = this.expandedSubscriptionId !== subscriptionId;
    this.expandedSubscriptionId = expanded ? subscriptionId : '';
    this.onDisclosureChanged(subscriptionId, expanded);
  }

  private isExpanded(subscriptionId: string): boolean {
    return this.expandedSubscriptionId === subscriptionId;
  }

  private focusSubscriptionIfNeeded(
    item: RssSubscriptionManagementItem,
    index: number,
  ): void {
    if (item.subscriptionId !== this.focusedSubscriptionId) {
      return;
    }
    if (this.expandedSubscriptionId !== item.subscriptionId) {
      this.expandedSubscriptionId = item.subscriptionId;
    }
    setTimeout((): void => {
      this.pageScroller.scrollTo({
        xOffset: 0,
        yOffset: index * 56,
        animation: false,
      });
    }, 0);
  }

  private enabledCount(): number {
    return this.items.filter((item: RssSubscriptionManagementItem): boolean => item.enabled).length;
  }

  private disabledCount(): number {
    return this.items.length - this.enabledCount();
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
      new SurfaceWidthSpec(TOK_CONTENT_MAX_W_TABLET, TOK_SCREEN_INSET, TOK_SCREEN_INSET),
    );
  }
}
