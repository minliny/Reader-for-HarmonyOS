import { ReaderStandardPage } from '../../../ui/layout/ReaderStandardPage';
import { ReaderPageState } from '../../../ui/feedback/ReaderPageState';
import { RssOriginalRecoverySurface } from './RssOriginalRecoverySurface';
import type { RssOriginalMutationIdentity } from '../application/RssMutationRecoveryContract';
import { ReaderLabeledIconAction } from '../../../ui/controls/ReaderLabeledIconAction';
import type { RssSubscriptionManagementItem } from '../presentation/RssPresentationContract';
import { ReaderButton } from '../../../ui/controls/ReaderButton';
import { ReaderRecoveryAction } from '../../../ui/feedback/ReaderRecoveryAction';
import { ReaderTransientFeedback } from '../../../ui/feedback/ReaderTransientFeedback';
import { rssOriginalMatchesScope } from '../application/RssMutationRecoveryContract';
import { TYPE_FORM_COMPACT_ACTION, TYPE_SOURCE_MANAGEMENT_META, TYPE_SOURCE_MANAGEMENT_TITLE } from '../../../ui/foundation/ReaderTypography';
import { readerAppColor } from '../../../ui/foundation/ReaderThemeRegistry';
import { PageBackBar } from '../../../ui/chrome/PageBackBar';
import { ReaderToggle } from '../../../ui/controls/ReaderToggle';
import { registerReaderFonts } from '../../../ui/foundation/ReaderFonts';
import { projectOperationFacts, type OperationFacts } from '../../../app/ReaderOperationFacts';
import type { RssSubscription } from '../application/RssGateway';
import type { RssManagementOperationProjection } from '../application/RssOrchestrator';
import {
  TOK_BORDER_W,
  TOK_CARD_BG_HI,
  TOK_INK,
  TOK_MUTED,
  TOK_PRIMARY_BG,
  TOK_PRIMARY_SOFT,
  TOK_ROW_DIVIDER,
  TOK_SPACE_CONTROL_INLINE,
  TOK_SPACE_XS,
  TOK_SURFACE_PANEL_SOFT,
} from '../../../ui/foundation/ReaderTokens';

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

  @Prop items: RssSubscriptionManagementItem[];
  @Prop expandedLayout: boolean;
  /** Optional route identity: expands the matching row without mutating it. */
  @Prop focusedSubscriptionId: string = '';
  @Prop @Watch('notifyResult') resultMessage: string = '';
  @Prop operation: RssManagementOperationProjection | undefined = undefined;
  @Prop readFacts: OperationFacts<RssSubscription[]> = projectOperationFacts<RssSubscription[]>({ phase: 'idle' });
  @Prop presentationIdentity: string = '';
  onReconcileOriginal: (expected: RssOriginalMutationIdentity) => void = (_expected: RssOriginalMutationIdentity): void => {};
  onContinueOriginal: (expected: RssOriginalMutationIdentity) => void = (_expected: RssOriginalMutationIdentity): void => {};
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
  private readonly resultFeedback: ReaderTransientFeedback = new ReaderTransientFeedback();
  private mounted: boolean = false;

  aboutToAppear(): void {
    this.mounted = true;
    registerReaderFonts(this.getUIContext().getFont());
    if (this.items.some((item: RssSubscriptionManagementItem): boolean =>
      item.subscriptionId === this.focusedSubscriptionId)) {
      this.expandedSubscriptionId = this.focusedSubscriptionId;
    }
    this.notifyResult();
  }
  aboutToDisappear(): void { this.mounted = false; this.resultFeedback.reset(); }

  private notifyResult(): void {
    if (!this.mounted || this.resultMessage.length === 0) return;
    const message = this.resultMessage, presentation = this.presentationIdentity;
    this.resultFeedback.show(() => this.getUIContext(), { message, key: `${presentation}:${message}` },
      (): boolean => this.mounted && presentation === this.presentationIdentity && message === this.resultMessage);
  }

  build() {
    ReaderStandardPage({
      variant: 'rssManagement',
      scrollOwner: 'native-list',
      header: (): void => { this.backBar(); },
      nativeListItems: (): void => { this.subscriptionList(); },
      scroller: this.pageScroller,
    });
  }

  @Builder
  private pageContent() {
    this.stats();
    this.operationFeedback();
  }


  @Builder
  private backBar() {
    PageBackBar({
      title: '订阅源管理', trailingWidthVp: this.addActionWidth(),
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
      .width(this.addActionWidth())
      .constraintSize({ minHeight: 44 })
      .padding({ top: 8, bottom: 8 })
      .justifyContent(FlexAlign.Center)
      .alignItems(VerticalAlign.Center)
      .backgroundColor(readerAppColor('TOK_PRIMARY_SOFT', this.appThemeScheme))
      .borderRadius(999)
      .onClick((): void => this.onAdd());
    }
  }

  private addActionWidth(): number {
    const context = this.getUIContext();
    return Math.max(60, Math.ceil(context.px2vp(context.getMeasureUtils().measureText({
      textContent: '添加', fontFamily: TYPE_FORM_COMPACT_ACTION.fontFamily,
      fontSize: `${TYPE_FORM_COMPACT_ACTION.fontSizeFp}fp`, fontWeight: TYPE_FORM_COMPACT_ACTION.fontWeight }))) + 14 + 3 + 16);
  }

  @Builder
  private operationFeedback() {
    RssOriginalRecoverySurface({ original: this.operation?.original, presentationIdentity: this.presentationIdentity, scope: 'management',
      onReconcileOriginal: (expected: RssOriginalMutationIdentity): void => this.onReconcileOriginal(expected),
      onContinueOriginal: (expected: RssOriginalMutationIdentity): void => this.onContinueOriginal(expected) });
    if (!rssOriginalMatchesScope(this.operation?.original, 'management') && this.feedbackMessage().length > 0) {
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
            onReconcile: (generation: number): void => this.retryFeedback(generation),
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

  private retryFeedback(generation: number): void {
    if (this.hasOperationFeedback() && this.operation !== undefined) {
      if (generation === this.operation.projection.facts.generation && this.operation.projection.facts.canRetry) this.onReconcile(this.operation);
    } else if (generation === this.readFacts.generation && this.readFacts.canRetry) {
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
    ReaderButton({ scheme: this.appThemeScheme, specId: 'form-document-action', label, layout: 'full', onAction: action }).layoutWeight(1);
  }

  @Builder
  private subscriptionList() {
    ListItem() { Column() { this.pageContent(); }.width('100%'); }
    if (this.items.length === 0 && (this.readFacts.fact === 'current' || this.readFacts.fact === 'empty')) {
      ListItem() { ReaderPageState({ title: '暂无订阅源', message: '添加订阅源后可在这里管理。' }); }
    }
    Repeat(this.items)
      .each((repeatItem: RepeatItem<RssSubscriptionManagementItem>) => {
      ListItem() {
        this.subscriptionItem(repeatItem.item, repeatItem.index);
      }.backgroundColor(readerAppColor('TOK_CARD_BG_HI', this.appThemeScheme))
        .border({ width: { left: TOK_BORDER_W, right: TOK_BORDER_W, top: repeatItem.index === 0 ? TOK_BORDER_W : 0,
          bottom: repeatItem.index === this.items.length - 1 ? TOK_BORDER_W : 0 }, color: readerAppColor('TOK_ROW_DIVIDER', this.appThemeScheme) })
        .borderRadius({ topLeft: repeatItem.index === 0 ? 8 : 0, topRight: repeatItem.index === 0 ? 8 : 0,
          bottomLeft: repeatItem.index === this.items.length - 1 ? 8 : 0, bottomRight: repeatItem.index === this.items.length - 1 ? 8 : 0 });
    })
    .key((item: RssSubscriptionManagementItem): string => `rss-management-${item.subscriptionId}`)
    .virtualScroll({ reusable: true });
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
        .constraintSize({ minHeight: 32 })
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
          ForEach([`${this.presentationIdentity}:${item.subscriptionId}`], (identity: string): void => {
          ReaderToggle({
            value: item.enabled, specId: 'standard-toggle', accessibilityLabel: '启用订阅',
            inputIdentity: identity,
            actionEnabled: this.operation?.original?.blocked !== true && this.operation?.projection.receipt.confirmation !== 'unknown',
            isBusy: this.operation?.original?.busy === true || this.operation?.projection.facts.fact === 'refreshing',
            onToggle: (next: boolean): void => {
              if (identity === `${this.presentationIdentity}:${item.subscriptionId}` && this.operation?.original?.blocked !== true &&
                this.operation?.projection.receipt.confirmation !== 'unknown' && this.operation?.original?.busy !== true &&
                this.operation?.projection.facts.fact !== 'refreshing') this.onToggle(item.subscriptionId, next);
            },
          });
          }, (identity: string): string => identity);
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
        .constraintSize({ minHeight: 44 })
        .onClick((): void => this.toggleDisclosure(item.subscriptionId));
      }
      .width('100%')
      .constraintSize({ minHeight: 56 })
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
    Column() {
      this.actionTarget('查看文章', (this.appThemeScheme === 'night' ? $r('app.media.rss_manage_view_all_theme_night') : $r('app.media.rss_manage_view_all')), false, false,
        (): void => this.onViewArticles(subscriptionId));
      this.actionTarget('编辑来源', (this.appThemeScheme === 'night' ? $r('app.media.rss_manage_edit_theme_night') : $r('app.media.rss_manage_edit')), false, true,
        (): void => this.onEditSource(subscriptionId));
      this.actionTarget('立即刷新', (this.appThemeScheme === 'night' ? $r('app.media.discover_refresh_theme_night') : $r('app.media.discover_refresh')), false, true,
        (): void => this.onRefresh(subscriptionId));
      this.actionTarget('删除', $r('app.media.rss_manage_delete'), true, true,
        (): void => this.onDelete(subscriptionId));
    }
    .width('100%')
    .constraintSize({ minHeight: 44 })
    .alignItems(HorizontalAlign.Center)
    .backgroundColor(readerAppColor('TOK_SURFACE_PANEL_SOFT', this.appThemeScheme))
    .border({ width: { top: TOK_BORDER_W }, color: readerAppColor('TOK_ROW_DIVIDER', this.appThemeScheme) });
  }

  @Builder
  private actionTarget(label: string, icon: Resource, danger: boolean, divider: boolean, action: () => void) {
    ReaderLabeledIconAction({ scheme: this.appThemeScheme, specId: 'rss-management', fillWidth: true, label, icon, isDanger: danger, showDivider: divider, onAction: action }).width('100%');
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


}
