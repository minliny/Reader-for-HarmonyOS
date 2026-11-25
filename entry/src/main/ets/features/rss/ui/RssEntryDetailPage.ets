import { ReaderStandardPage } from '../../../ui/layout/ReaderStandardPage';
import { common } from '@kit.AbilityKit';
import { url } from '@kit.ArkTS';
import { ReaderTransientFeedback } from '../../../ui/feedback/ReaderTransientFeedback';
import { readerPageAreaLength, readerStandardPageContentFrame } from '../../../ui/layout/ReaderPageShell';
import { ReaderRaisedShape, resolveReaderRaisedShape } from '../../../ui/layout/ReaderRaisedShape';
import { RssOriginalRecoverySurface } from './RssOriginalRecoverySurface';
import type { RssOriginalMutationIdentity, RssOriginalMutationProjection } from '../application/RssMutationRecoveryContract';
import type { RssFavoritePresentation, RssEntrySnapshot } from '../presentation/RssPresentationContract';
import { ReaderLabeledIconAction } from '../../../ui/controls/ReaderLabeledIconAction';
import { ReaderButton } from '../../../ui/controls/ReaderButton';
import { ReaderRecoveryNotice } from '../../../ui/feedback/ReaderRecoveryNotice';
import { ReaderPageState } from '../../../ui/feedback/ReaderPageState';
import type { ReaderRecoveryView } from '../../../ui/feedback/ReaderRecoveryView';
import { rssOriginalMatchesScope } from '../application/RssMutationRecoveryContract';
import { readerRecoveryView } from '../../../app/ReaderRecoveryProjection';
import { projectOperationFacts, type OperationFacts } from '../../../app/ReaderOperationFacts';
import type { RssRouteOperationProjection } from '../application/RssRouteOperationHost';
import { TYPE_APP_SMALL_ACTION, TYPE_RSS_ARTICLE_BODY, TYPE_RSS_ARTICLE_TITLE, TYPE_RSS_BOTTOM_ACTION, TYPE_RSS_LINK_ACTION, TYPE_RSS_META, TYPE_RSS_SOURCE_TITLE } from '../../../ui/foundation/ReaderTypography';
import { readerAppColor } from '../../../ui/foundation/ReaderThemeRegistry';
import {
  type RssFavorite,
  type RssItem,
  type RssSubscription,
} from '../application/RssGateway';
import { ReaderWindowCoordinator } from '../../../app/ReaderWindowCoordinator';
import { PageBackBar } from '../../../ui/chrome/PageBackBar';
import { registerReaderFonts } from '../../../ui/foundation/ReaderFonts';
import {
  SurfaceHorizontalFrame,
} from '../../../ui/layout/SurfaceHorizontalGeometry';
import {
  TOK_BORDER_W,
  TOK_SPACE_CONTROL_INLINE,
  TOK_SPACE_SM,
  TOK_SPACE_XS,
} from '../../../ui/foundation/ReaderTokens';

const RSS_DETAIL_ACTION_AREA_HEIGHT = 62;

/**
 * True RSS child route for one Core-owned item. `description` is rendered as
 * the feed-provided summary; it is never presented as a parsed full article.
 */
@Component
export struct RssEntryDetailPage {
  @StorageLink('readerAppScheme') private appThemeScheme: string = 'day';

  @StorageLink('readerWindowMetricsRevision') private readerWindowMetricsRevision: number = 0;
  @StorageLink('readerUiConfigurationRevision') private uiConfigurationRevision: number = 0;
  @Prop subscription: RssSubscription | undefined = undefined;
  @Prop item: RssItem | undefined = undefined;
  @Prop archivedFavorite: RssFavorite | undefined = undefined;
  @Prop expandedLayout: boolean;
  @Prop operation: RssRouteOperationProjection<RssEntrySnapshot> | undefined = undefined;
  @Prop readFacts: OperationFacts<RssEntrySnapshot> = projectOperationFacts<RssEntrySnapshot>({ phase: 'idle' });
  @Prop presentationIdentity: string = '';
  @Prop original: RssOriginalMutationProjection | undefined = undefined;
  onReconcileOriginal: (expected: RssOriginalMutationIdentity) => void = (_expected: RssOriginalMutationIdentity): void => {};
  onContinueOriginal: (expected: RssOriginalMutationIdentity) => void = (_expected: RssOriginalMutationIdentity): void => {};
  onReconcile: (operation: RssRouteOperationProjection<RssEntrySnapshot>) => void = (_operation: RssRouteOperationProjection<RssEntrySnapshot>): void => {};
  onRetryRead: (facts: OperationFacts<RssEntrySnapshot>) => void = (_facts: OperationFacts<RssEntrySnapshot>): void => {};
  @Prop favoriteState: RssFavoritePresentation = 'loading';
  onBack: () => void = (): void => {};
  onViewSource: () => void = (): void => {};
  onFavoriteRequested: (favorite: boolean) => void = (_favorite: boolean): void => {};
  onSourceSettings: () => void = (): void => {};
  originalInputCurrent: () => boolean = (): boolean => false;
  @State private originalOpening: boolean = false;
  private readonly originalFeedback: ReaderTransientFeedback = new ReaderTransientFeedback();
  @State private viewportWidth: number = 0;
  @State private originalLinkPillShape: ReaderRaisedShape | undefined = undefined;
  @State private pillAppearanceRevision: number = 0;
  private pillMounted: boolean = false;

  aboutToAppear(): void {
    this.pillMounted = true;
    this.pillAppearanceRevision += 1;
    this.originalLinkPillShape = undefined;
    registerReaderFonts(this.getUIContext().getFont());
  }

  aboutToDisappear(): void {
    this.pillMounted = false;
    this.originalOpening = false;
    this.originalFeedback.reset();
  }

  build() {
    ReaderStandardPage({
      floatingHeader: true,
      variant: 'rssDetail',
      header: (): void => { this.backBar(); },
      content: (): void => { this.pageContent(); },
      footer: (): void => { this.bottomActions(); },
      boundedOverlayVisible: this.hasPendingRecovery(),
      boundedOverlayContent: (): void => { this.pendingRecovery(); },
    })
      .onAreaChange((_oldValue: Area, newValue: Area): void => {
        const width = this.numericAreaLength(newValue.width);
        if (width > 0 && Math.abs(width - this.viewportWidth) >= 0.01) {
          this.viewportWidth = width;
        }
      });
  }

  @Builder
  private pageContent() {
    if (this.archivedFavorite === undefined) { this.operationFeedback(); }
    this.sourceCard();
    this.summaryCard();
    if (this.archivedFavorite === undefined) { this.entryActions(); }
    if (this.summaryParagraphs().length > 0) {
      this.summaryBodyCard();
    }
    if (this.originalUrl().length > 0) {
      this.originalLinkCard();
    }
  }

  @Builder
  private operationFeedback() {
    if (!rssOriginalMatchesScope(this.original, 'entry', this.item?.subscriptionId ?? '', this.item?.guid ?? '') && this.feedbackView().visible &&
      this.operation?.projection.receipt.confirmation !== 'unknown') {
      ForEach([this.feedbackView().generation], (generation: number): void => {
        ReaderPageState({ message: this.feedbackView().message, padded: false,
          loading: this.readFacts.fact === 'loading' || this.readFacts.fact === 'refreshing',
          actionLabel: this.feedbackView().canRetry ? '重新读取' : '', onAction: (): void => this.retryFeedback(generation) });
      }, (generation: number): string => `rss-entry-read:${generation}`);
    }
  }

  @Builder
  private pendingRecovery() {
    RssOriginalRecoverySurface({ original: this.original, presentationIdentity: this.presentationIdentity, scope: 'entry',
      subscriptionId: this.item?.subscriptionId ?? '', guid: this.item?.guid ?? '',
      onReconcileOriginal: (expected: RssOriginalMutationIdentity): void => this.onReconcileOriginal(expected),
      onContinueOriginal: (expected: RssOriginalMutationIdentity): void => this.onContinueOriginal(expected) });
    if (!rssOriginalMatchesScope(this.original, 'entry', this.item?.subscriptionId ?? '', this.item?.guid ?? '') && this.feedbackView().visible) {
      if (this.operation?.projection.receipt.confirmation === 'unknown') {
        ReaderRecoveryNotice({ view: this.feedbackView(), actionLabel: '重新读取',
          onReconcile: (generation: number): void => this.retryFeedback(generation) });
      }
    }
  }

  private hasPendingRecovery(): boolean {
    if (this.archivedFavorite !== undefined) return false;
    return rssOriginalMatchesScope(this.original, 'entry', this.item?.subscriptionId ?? '', this.item?.guid ?? '') ||
      this.operation?.projection.receipt.confirmation === 'unknown' && this.feedbackView().visible;
  }

  private feedbackView(): ReaderRecoveryView { return readerRecoveryView(this.operation?.projection, this.readFacts); }

  private retryFeedback(generation: number): void {
    const operation = this.operation;
    if (operation !== undefined && operation.projection.facts.generation === generation && operation.projection.facts.canRetry) {
      this.onReconcile(operation);
    } else if (this.readFacts.generation === generation && this.readFacts.canRetry) {
      this.onRetryRead(this.readFacts);
    }
  }

  @Builder
  private backBar() {
    PageBackBar({
      floating: true, elevation: 'floating',
      title: 'RSS 阅读', trailingWidthVp: 94,
      onBack: (): void => this.onBack(),
    }) {
      Row({ space: 6 }) {
        if (this.archivedFavorite === undefined) { this.favoriteAction(); }
        if (this.archivedFavorite === undefined || this.originalUrl().length > 0) {
          Stack({ alignContent: Alignment.Center }) {
            Image((this.appThemeScheme === 'night' ? $r('app.media.rss_external_theme_night') : $r('app.media.rss_external'))).width(20).height(20);
          }
          .width(44)
          .constraintSize({ minHeight: 44 })
          .opacity(this.hasOriginalLink() ? 1 : 0.38)
          .enabled(this.hasOriginalLink())
          .onClick((): void => { void this.openOriginal(); });
        }
      }
      .width(94)
      .constraintSize({ minHeight: 44 })
      .alignItems(VerticalAlign.Center);
    }
  }

  @Builder
  private favoriteAction() {
    Stack({ alignContent: Alignment.Center }) {
      Image(this.favoriteState === 'favorited' ?
        (this.appThemeScheme === 'night' ? $r('app.media.rss_bookmark_active_theme_night') : $r('app.media.rss_bookmark_active')) : (this.appThemeScheme === 'night' ? $r('app.media.rss_bookmark_theme_night') : $r('app.media.rss_bookmark')))
        .width(20)
        .height(20);
    }
    .width(44)
    .constraintSize({ minHeight: 44 })
    .borderRadius(16)
    .backgroundColor(this.favoriteState === 'favorited' ? readerAppColor('TOK_PRIMARY_SOFT', this.appThemeScheme) : readerAppColor('app.surface.transparent', this.appThemeScheme))
    .opacity(this.favoriteState === 'loading' ? 0.45 : 1)
    .enabled(this.canRequestFavorite())
    .onClick((): void =>
      { if (this.canRequestFavorite()) this.onFavoriteRequested(this.favoriteState !== 'favorited'); });
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
        Text(this.sourceTitle())
          .width('100%')
          .fontFamily(TYPE_RSS_SOURCE_TITLE.fontFamily)
          .fontWeight(TYPE_RSS_SOURCE_TITLE.fontWeight)
          .fontSize(TYPE_RSS_SOURCE_TITLE.fontSizeFp)
          .fontColor(readerAppColor('TOK_INK', this.appThemeScheme))
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis });
        Text(this.itemMeta())
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

      if (this.archivedFavorite === undefined && this.subscription !== undefined) {
        ReaderButton({ scheme: this.appThemeScheme, specId: 'rss-source-link', label: '查看源', onAction: (): void => this.onViewSource() });
      }
    }
    .width('100%')
    .constraintSize({ minHeight: 58 })
    .padding({ left: TOK_SPACE_CONTROL_INLINE, right: TOK_SPACE_CONTROL_INLINE })
    .alignItems(VerticalAlign.Center)
    .backgroundColor(readerAppColor('TOK_CARD_BG_HI', this.appThemeScheme))
    .border({ width: TOK_BORDER_W, color: readerAppColor('app.border.contentCard', this.appThemeScheme) })
    .borderRadius(8);
  }

  @Builder
  private summaryCard() {
    Column({ space: TOK_SPACE_XS }) {
      Text(this.archivedFavorite?.title ?? this.item?.title ?? '')
        .width('100%')
        .fontFamily(TYPE_RSS_ARTICLE_TITLE.fontFamily)
        .fontWeight(TYPE_RSS_ARTICLE_TITLE.fontWeight)
        .fontSize(TYPE_RSS_ARTICLE_TITLE.fontSizeFp)
        .lineHeight(TYPE_RSS_ARTICLE_TITLE.lineHeightFp as number)
        .fontColor(readerAppColor('TOK_INK', this.appThemeScheme))
        .maxLines(2)
        .textOverflow({ overflow: TextOverflow.Ellipsis });
    }
    .width('100%')
    .padding({ left: 14, right: 14, top: 16, bottom: 16 })
    .alignItems(HorizontalAlign.Start)
    .backgroundColor(readerAppColor('TOK_CARD_BG_HI', this.appThemeScheme))
    .border({ width: TOK_BORDER_W, color: readerAppColor('app.border.contentCard', this.appThemeScheme) })
    .borderRadius(8);
  }

  @Builder
  private entryActions() {
    Row({ space: 7 }) {
      this.actionTarget('源设置', (): Resource => (this.appThemeScheme === 'night' ? $r('app.media.rss_manage_theme_night') : $r('app.media.rss_manage')), (): void => this.onSourceSettings());
    }
    .width('100%')
    .constraintSize({ minHeight: 44 })
    .alignItems(VerticalAlign.Center);
  }

  @Builder
  private actionTarget(label: string, icon: () => Resource, action: () => void) {
    ReaderLabeledIconAction({ scheme: this.appThemeScheme, specId: 'rss-entry', fillWidth: true, label, icon: icon(), onAction: action }).layoutWeight(1);
  }

  @Builder
  private summaryBodyCard() {
    Column({ space: TOK_SPACE_SM }) {
      Text('摘要')
        .width('100%')
        .fontFamily(TYPE_RSS_SOURCE_TITLE.fontFamily)
        .fontWeight(TYPE_RSS_SOURCE_TITLE.fontWeight)
        .fontSize(TYPE_RSS_SOURCE_TITLE.fontSizeFp)
        .fontColor(readerAppColor('TOK_INK', this.appThemeScheme));
      ForEach(this.summaryParagraphs(), (paragraph: string, index: number) => {
        Text(this.summaryParagraphs()[index] ?? '')
          .width('100%')
          .fontFamily(TYPE_RSS_ARTICLE_BODY.fontFamily)
          .fontWeight(TYPE_RSS_ARTICLE_BODY.fontWeight)
          .fontSize(TYPE_RSS_ARTICLE_BODY.fontSizeFp)
          .lineHeight(TYPE_RSS_ARTICLE_BODY.lineHeightFp as number)
          .fontColor(readerAppColor('app.text.filter', this.appThemeScheme));
      }, (_paragraph: string, index: number): string =>
        this.summaryParagraphKey(index));
    }
    .width('100%')
    .padding({ left: 16, right: 16, top: 16, bottom: 16 })
    .alignItems(HorizontalAlign.Start)
    .backgroundColor(readerAppColor('TOK_CARD_BG_HI', this.appThemeScheme))
    .border({ width: TOK_BORDER_W, color: readerAppColor('app.border.contentCard', this.appThemeScheme) })
    .borderRadius(8);
  }

  @Builder
  private originalLinkCard() {
    Row({ space: TOK_SPACE_XS }) {
      Stack({ alignContent: Alignment.Center }) {
        Image((this.appThemeScheme === 'night' ? $r('app.media.rss_link_theme_night') : $r('app.media.rss_link'))).width(20).height(20);
      }
      .width(28)
      .constraintSize({ minHeight: 28 })
      .backgroundColor(readerAppColor('app.feed.actionSoft', this.appThemeScheme))
      .borderRadius(14);

      Column({ space: 3 }) {
        Text('原文链接')
          .width('100%')
          .fontFamily(TYPE_RSS_SOURCE_TITLE.fontFamily)
          .fontWeight(TYPE_RSS_SOURCE_TITLE.fontWeight)
          .fontSize(TYPE_RSS_SOURCE_TITLE.fontSizeFp)
          .fontColor(readerAppColor('TOK_INK', this.appThemeScheme))
          .maxLines(1);
        Text(`${this.sourceTitle()} · 原始条目链接`)
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

      Text('打开')
        .constraintSize({ minHeight: 28 })
        .padding({ left: 9, right: 9 })
        .fontFamily(TYPE_RSS_LINK_ACTION.fontFamily)
        .fontWeight(TYPE_RSS_LINK_ACTION.fontWeight)
        .fontSize(TYPE_RSS_LINK_ACTION.fontSizeFp).lineHeight(17).halfLeading(true)
        .fontColor(readerAppColor('TOK_PRIMARY_TEXT', this.appThemeScheme))
        .textAlign(TextAlign.Center)
        .backgroundColor(readerAppColor('TOK_PRIMARY_SOFT', this.appThemeScheme))
        .borderRadius(this.currentOriginalLinkPillRadius())
        .onAreaChange(this.originalLinkPillAreaHandler());
    }
    .width('100%')
    .constraintSize({ minHeight: 58 })
    .padding({ left: TOK_SPACE_CONTROL_INLINE, right: TOK_SPACE_CONTROL_INLINE })
    .alignItems(VerticalAlign.Center)
    .backgroundColor(readerAppColor('TOK_CARD_BG_HI', this.appThemeScheme))
    .border({ width: TOK_BORDER_W, color: readerAppColor('app.border.contentCard', this.appThemeScheme) })
    .borderRadius(8)
    .enabled(this.hasOriginalLink())
    .onClick((): void => { void this.openOriginal(); });
  }

  private originalLinkPillMeasurementKey(): string {
    return `${this.pillAppearanceRevision}:${this.readerWindowMetricsRevision}:${this.uiConfigurationRevision}:` +
      `${this.viewportWidth}:${this.presentationIdentity}`;
  }

  private originalLinkPillAreaHandler(): (oldValue: Area, next: Area) => void {
    const identity = this.originalLinkPillMeasurementKey();
    return (_old: Area, next: Area): void => {
      if (!this.pillMounted || identity !== this.originalLinkPillMeasurementKey()) return;
      const shape = resolveReaderRaisedShape(identity, readerPageAreaLength(next.width),
        readerPageAreaLength(next.height), 999);
      if (shape === undefined) return;
      if (shape.identity !== this.originalLinkPillShape?.identity || shape.radius !== this.originalLinkPillShape?.radius) {
        this.originalLinkPillShape = shape;
      }
    };
  }

  private currentOriginalLinkPillRadius(): number {
    return this.pillMounted && this.originalLinkPillShape !== undefined ? this.originalLinkPillShape.radius : 14;
  }

  @Builder
  private bottomActions() {
    Row({ space: TOK_SPACE_XS }) {
      ReaderButton({ scheme: this.appThemeScheme, specId: 'rss-detail-bottom', label: '返回列表', primary: true, layout: 'full', onAction: (): void => this.onBack() }).layoutWeight(1);

      if (this.archivedFavorite === undefined || this.originalUrl().length > 0) {
        ReaderButton({ scheme: this.appThemeScheme, specId: 'rss-detail-bottom', label: '打开原文', layout: 'full', actionEnabled: this.hasOriginalLink(), onAction: (): void => { void this.openOriginal(); } }).layoutWeight(1);
      }
    }
    .width(this.contentFrame().width)
    .margin({ left: this.contentFrame().left, right: this.contentFrame().right })
    .constraintSize({ minHeight: RSS_DETAIL_ACTION_AREA_HEIGHT })
    .padding({ top: TOK_SPACE_XS, bottom: TOK_SPACE_XS })
    .alignItems(VerticalAlign.Center)
    .hitTestBehavior(HitTestMode.Default)
    .onTouch((): void => {});
  }

  private summaryParagraphs(): string[] {
    const value = this.archivedFavorite?.summary ?? this.item?.description ?? '';
    return value
      .split(/\n+/)
      .map((paragraph: string): string => paragraph.trim())
      .filter((paragraph: string): boolean => paragraph.length > 0);
  }

  private summaryParagraphKey(index: number): string {
    return JSON.stringify([this.archivedFavorite?.subscriptionId ?? this.item?.subscriptionId,
      this.archivedFavorite?.guid ?? this.item?.guid, index]);
  }

  private sourceTitle(): string { return this.archivedFavorite?.subscriptionTitle ?? this.subscription?.title ?? ''; }

  private canRequestFavorite(): boolean {
    return (this.favoriteState === 'favorited' || this.favoriteState === 'notFavorited') &&
      (this.readFacts.fact === 'idle' || this.readFacts.fact === 'current' || this.readFacts.fact === 'empty') &&
      this.operation?.projection.receipt.confirmation !== 'unknown' && this.operation?.projection.receipt.readback !== 'reading' &&
      this.operation?.projection.receipt.fact !== 'confirmedRefreshFailed';
  }

  private hasOriginalLink(): boolean {
    return !this.originalOpening && this.originalUrl().length > 0;
  }

  private originalUrl(): string {
    const value = (this.archivedFavorite?.link ?? this.item?.link ?? '').trim();
    if (!/^https?:\/\/[^/\s]/i.test(value) || /[\u0000-\u0020\u007f\\]/.test(value)) return '';
    try {
      const parsed = url.URL.parseURL(value);
      return parsed.hostname.length > 0 && parsed.username.length === 0 && parsed.password.length === 0 ? parsed.href : '';
    } catch (_error) { return ''; }
  }

  private async openOriginal(): Promise<void> {
    const identity = this.presentationIdentity;
    const appearance = this.pillAppearanceRevision;
    const link = this.originalUrl();
    const current = (): boolean => this.pillMounted && this.pillAppearanceRevision === appearance &&
      this.presentationIdentity === identity && this.originalInputCurrent();
    if (!current() || this.originalOpening || link.length === 0 ||
      AppStorage.get<boolean>('readerAppForeground') === false) return;
    this.originalOpening = true;
    try {
      const context = this.getUIContext().getHostContext() as common.UIAbilityContext | undefined;
      if (context === undefined || typeof context.openLink !== 'function') throw new Error('RSS_BROWSER_UNAVAILABLE');
      await context.openLink(link, { appLinkingOnly: false, hideFailureTipDialog: true });
    } catch (_error) {
      this.originalFeedback.show(() => this.getUIContext(), { message: '无法打开原文链接' }, current);
    } finally {
      if (this.pillAppearanceRevision === appearance) this.originalOpening = false;
    }
  }

  private itemMeta(): string {
    const parts: string[] = [];
    const date = this.archivedFavorite?.publishedAt ?? this.item?.pubDate;
    const author = this.item?.author;
    if (date !== undefined && date !== '') parts.push(date);
    if (author !== undefined && author !== '') parts.push(author);
    return parts.join(' · ');
  }

  private contentFrame(): SurfaceHorizontalFrame {
    if (this.readerWindowMetricsRevision < 0) {
      return new SurfaceHorizontalFrame(0, 0, 0);
    }
    const metrics = ReaderWindowCoordinator.metrics();
    const containerWidth = this.viewportWidth > 0 ? this.viewportWidth : metrics.windowRect.width;
    return readerStandardPageContentFrame('rssDetail', metrics, containerWidth);
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
