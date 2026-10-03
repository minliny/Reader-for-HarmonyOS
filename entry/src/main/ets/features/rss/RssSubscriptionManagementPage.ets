import type { RssSubscriptionManagementItem } from './RssPresentationContract';
export type { RssSubscriptionManagementItem } from './RssPresentationContract';
import { ReaderButton } from '../common/ReaderButton';
import { ReaderRecoveryAction } from '../common/ReaderRecoveryAction';
import { TYPE_FORM_COMPACT_ACTION, TYPE_SOURCE_MANAGEMENT_META, TYPE_SOURCE_MANAGEMENT_TITLE } from '../common/ReaderTypography';
import { READER_FLOATING_TOP_BAR_HEIGHT, readerFloatingBarBottomInset } from '../common/ReaderFloatingBarMetrics';
import { readerAppColor } from '../common/ReaderThemeRegistry';
import { PageBackBar } from '../common/PageBackBar';
import { ReaderWindowCoordinator } from '../../app/ReaderWindowCoordinator';
import { ReaderToggle } from '../common/ReaderToggle';
import { registerReaderFonts } from '../common/ReaderFonts';
import { projectOperationFacts, type OperationFacts } from '../../app/ReaderOperationFacts';
import type { RssSubscription } from './RssGateway';
import type { RssManagementOperationProjection } from './RssOrchestrator';
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

/**
 * Figma-backed RSS subscription management child page.
 * Reference: Page/RSS/SubscriptionManagement Phone/Tablet (phase 11).
 *
 * The page owns only disclosure state. Every business action is emitted as an
 * intent with subscription identity; it never mutates subscription data.
 */
@Component
export struct RssSubscriptionManagementPage {
  @StorageLink('readerAppScheme') private appThemeScheme: string = 'day';

  @StorageLink('readerWindowMetricsRevision') private readerWindowMetricsRevision: number = 0;
  @Prop items: RssSubscriptionManagementItem[];
  @Prop isTablet: boolean;
  /** Optional route identity: expands the matching row without mutating it. */
  @Prop focusedSubscriptionId: string = '';
  @Prop operation: RssManagementOperationProjection | undefined = undefined;
  @Prop readFacts: OperationFacts<RssSubscription[]> = projectOperationFacts<RssSubscription[]>({ phase: 'idle' });
  onReconcile: (operation: RssManagementOperationProjection) => void =
    (_operation: RssManagementOperationProjection): void => {};
  onRetryRead: (facts: OperationFacts<RssSubscription[]>) => void =
    (_facts: OperationFacts<RssSubscription[]>): void => {};
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
    Stack({ alignContent: Alignment.TopStart }) {

      Scroll(this.pageScroller) {
        Column() {
          this.stats();
          this.operationFeedback();
          this.subscriptionList();
        }
        .width('100%')
        .constraintSize({ maxWidth: this.contentFrame().width })
        .padding({ top: READER_FLOATING_TOP_BAR_HEIGHT + TOK_SPACE_XS, bottom: this.bottomContentInset() })
        .alignItems(HorizontalAlign.Start);
      }
      .width('100%')
      .height('100%')
      .align(Alignment.Top)
      .padding({ left: this.contentFrame().left, right: this.contentFrame().right })
      .scrollBar(BarState.Off);
      this.backBar();
    }
    .width('100%')
    .height('100%')
    .backgroundColor(readerAppColor('TOK_PAPER', this.appThemeScheme));
  }


  private bottomContentInset(): number {
    if (this.readerWindowMetricsRevision < 0) return TOK_SPACE_LG;
    return readerFloatingBarBottomInset(ReaderWindowCoordinator.metrics(), TOK_SPACE_LG);
  }
  @Builder
  private backBar() {
    PageBackBar({
      title: '订阅源管理',
      onBack: (): void => this.onBack(),
    }) {
      Row({ space: 3 }) {
        Image((this.appThemeScheme === 'night' ? $r('app.media.rss_add_theme_night') : $r('app.media.rss_add')))
          .width(14)
          .height(14);
        Text('添加')
          .fontFamily(TYPE_FORM_COMPACT_ACTION.fontFamily)
          .fontWeight(TYPE_FORM_COMPACT_ACTION.fontWeight)
          .fontSize(TYPE_FORM_COMPACT_ACTION.fontSizeFp)
          .fontColor(readerAppColor('TOK_PRIMARY_TEXT', this.appThemeScheme))
          .maxLines(1);
      }
      .width(60)
      .height(32)
      .justifyContent(FlexAlign.Center)
      .alignItems(VerticalAlign.Center)
      .backgroundColor(readerAppColor('TOK_PRIMARY_SOFT', this.appThemeScheme))
      .borderRadius(999)
      .responseRegion({ x: 0, y: -6, width: '100%', height: 44 })
      .onClick((): void => this.onAdd());
    }
  }

  @Builder
  private operationFeedback() {
    if (this.feedbackMessage().length > 0) {
      Row({ space: TOK_SPACE_XS }) {
        Text(this.feedbackMessage())
          .layoutWeight(1)
          .fontFamily(TYPE_SOURCE_MANAGEMENT_META.fontFamily)
          .fontWeight(TYPE_SOURCE_MANAGEMENT_META.fontWeight)
          .fontSize(TYPE_SOURCE_MANAGEMENT_META.fontSizeFp)
          .lineHeight(TYPE_SOURCE_MANAGEMENT_META.lineHeightFp as number)
          .fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme));
        if (this.canRetryFeedback()) {
          ReaderRecoveryAction({
            variant: 'rssManagement',
            label: this.hasOperationFeedback() ? '刷新列表' : '重试',
            generation: this.hasOperationFeedback() && this.operation !== undefined ?
              this.operation.projection.facts.generation : this.readFacts.generation,
            onReconcile: (_generation: number): void => this.retryFeedback(),
          });
        }
      }
      .width('100%')
      .margin({ top: TOK_SPACE_XS });
    }
  }

  private hasOperationFeedback(): boolean {
    return this.operation !== undefined && this.operation.projection.receipt.fact !== 'confirmedCurrent';
  }

  private feedbackMessage(): string {
    if (this.hasOperationFeedback() && this.operation !== undefined) {
      const projection = this.operation.projection;
      return projection.receipt.message + (projection.refreshError === undefined ? '' : `：${projection.refreshError}`);
    }
    if (this.readFacts.fact === 'loading') return '正在加载订阅源…';
    if (this.readFacts.fact === 'refreshing') return '正在刷新订阅源…';
    if (this.readFacts.fact === 'failed') return `订阅源加载失败：${this.readFacts.message ?? ''}`;
    if (this.readFacts.fact === 'refreshFailed') return `刷新失败，保留上次读取结果：${this.readFacts.message ?? ''}`;
    return '';
  }

  private canRetryFeedback(): boolean {
    return this.hasOperationFeedback() && this.operation !== undefined ?
      this.operation.projection.facts.canRetry : this.readFacts.canRetry;
  }

  private retryFeedback(): void {
    if (this.hasOperationFeedback() && this.operation !== undefined) {
      if (this.operation.projection.facts.canRetry) this.onReconcile(this.operation);
    } else if (this.readFacts.canRetry) {
      this.onRetryRead(this.readFacts);
    }
  }

  @Builder
  private stats() {
    Column({ space: TOK_SPACE_XS }) {
      Text(`${this.items.length} 个订阅源 · ${this.enabledCount()} 个启用 · ${this.disabledCount()} 个停用`)
        .width('100%')
        .fontFamily(TYPE_SOURCE_MANAGEMENT_META.fontFamily)
        .fontWeight(TYPE_SOURCE_MANAGEMENT_META.fontWeight)
        .fontSize(TYPE_SOURCE_MANAGEMENT_META.fontSizeFp)
        .lineHeight(TYPE_SOURCE_MANAGEMENT_META.lineHeightFp as number)
        .fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme))
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
    ReaderButton({ scheme: this.appThemeScheme, specId: 'form-document-action', label, layout: 'equal', onAction: action });
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
    .backgroundColor(readerAppColor('TOK_CARD_BG_HI', this.appThemeScheme))
    .border({ width: TOK_BORDER_W, color: readerAppColor('TOK_ROW_DIVIDER', this.appThemeScheme) })
    .borderRadius(8)
    .clip(true);
  }

  @Builder
  private subscriptionItem(item: RssSubscriptionManagementItem, index: number) {
    Column() {
      Row() {
        Stack({ alignContent: Alignment.Center }) {
          Image((this.appThemeScheme === 'night' ? $r('app.media.rss_source_theme_night') : $r('app.media.rss_source')))
            .width(20)
            .height(20);
        }
        .width(32)
        .height(32)
        .margin({ left: TOK_SPACE_CONTROL_INLINE })
        .backgroundColor(readerAppColor('TOK_PRIMARY_BG', this.appThemeScheme))
        .borderRadius(16)
        .opacity(item.enabled ? 1 : 0.58);

        Column({ space: 3 }) {
          Text(item.title)
            .width('100%')
            .fontFamily(TYPE_SOURCE_MANAGEMENT_TITLE.fontFamily)
            .fontWeight(TYPE_SOURCE_MANAGEMENT_TITLE.fontWeight)
            .fontSize(TYPE_SOURCE_MANAGEMENT_TITLE.fontSizeFp)
            .lineHeight(TYPE_SOURCE_MANAGEMENT_TITLE.lineHeightFp as number)
            .fontColor(readerAppColor('TOK_INK', this.appThemeScheme))
            .maxLines(1)
            .textOverflow({ overflow: TextOverflow.Ellipsis });
          Text(item.meta)
            .width('100%')
            .fontFamily(TYPE_SOURCE_MANAGEMENT_META.fontFamily)
            .fontWeight(TYPE_SOURCE_MANAGEMENT_META.fontWeight)
            .fontSize(TYPE_SOURCE_MANAGEMENT_META.fontSizeFp)
            .lineHeight(TYPE_SOURCE_MANAGEMENT_META.lineHeightFp as number)
            .fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme))
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
          Image((this.appThemeScheme === 'night' ? $r('app.media.rss_filter_chevron_theme_night') : $r('app.media.rss_filter_chevron')))
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
      .border({ width: { top: index > 0 ? TOK_BORDER_W : 0 }, color: readerAppColor('TOK_ROW_DIVIDER', this.appThemeScheme) });

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
      this.actionTarget('查看文章', (this.appThemeScheme === 'night' ? $r('app.media.rss_manage_view_all_theme_night') : $r('app.media.rss_manage_view_all')), false, false,
        (): void => this.onViewArticles(subscriptionId));
      this.actionTarget('编辑来源', (this.appThemeScheme === 'night' ? $r('app.media.rss_manage_edit_theme_night') : $r('app.media.rss_manage_edit')), false, true,
        (): void => this.onEditSource(subscriptionId));
      this.actionTarget('立即刷新', (this.appThemeScheme === 'night' ? $r('app.media.rss_manage_refresh_theme_night') : $r('app.media.rss_manage_refresh')), false, true,
        (): void => this.onRefresh(subscriptionId));
      this.actionTarget('删除', $r('app.media.rss_manage_delete'), true, true,
        (): void => this.onDelete(subscriptionId));
    }
    .width('100%')
    .height(44)
    .alignItems(VerticalAlign.Center)
    .backgroundColor(readerAppColor('TOK_SURFACE_PANEL_SOFT', this.appThemeScheme))
    .border({ width: { top: TOK_BORDER_W }, color: readerAppColor('TOK_ROW_DIVIDER', this.appThemeScheme) });
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
        .fontFamily(TYPE_FORM_COMPACT_ACTION.fontFamily)
        .fontWeight(TYPE_FORM_COMPACT_ACTION.fontWeight)
        .fontSize(TYPE_FORM_COMPACT_ACTION.fontSizeFp)
        .fontColor(danger ? readerAppColor('TOK_DANGER', this.appThemeScheme) : readerAppColor('TOK_INK', this.appThemeScheme))
        .maxLines(1);
    }
    .layoutWeight(1)
    .height(44)
    .justifyContent(FlexAlign.Center)
    .alignItems(VerticalAlign.Center)
    .border({ width: { left: divider ? TOK_BORDER_W : 0 }, color: readerAppColor('TOK_ROW_DIVIDER', this.appThemeScheme) })
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
