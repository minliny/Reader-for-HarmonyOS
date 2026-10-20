import { ReaderTransientFeedback } from '../common/ReaderTransientFeedback';
import { ReaderLabeledIconAction } from '../common/ReaderLabeledIconAction';
import { ReaderButton } from '../common/ReaderButton';
import { readerRecoveryView, type ReaderRecoveryView } from '../../app/ReaderRecoveryProjection';
import { ReaderRecoveryAction } from '../common/ReaderRecoveryAction';
import { ReaderPageState } from '../common/ReaderPageState';
import { TYPE_APP_SECTION_LABEL, TYPE_APP_SEGMENT_LABEL, TYPE_APP_SMALL_LABEL, TYPE_DISCOVER_AUTHOR, TYPE_DISCOVER_CATEGORY, TYPE_DISCOVER_FILTER_LABEL, TYPE_DISCOVER_FILTER_VALUE, TYPE_DISCOVER_INTRO, TYPE_DISCOVER_RANK_TITLE, TYPE_DISCOVER_SOURCE_META, TYPE_DISCOVER_STATE_TITLE, TYPE_DISCOVER_STATUS } from '../common/ReaderTypography';
import { readerAppColor } from '../common/ReaderThemeRegistry';
// Discover main page — rebuilt 2026-08-06 against live Figma node 376:2
// (Reference/Discover/Phone · 390×844).
// Core owns source.explore data. Retained source/category/page identities
// remain coherent while a newer read fails; no book rows are fabricated.
// Icons: existing media only (no new SVG assets).

import { MainTabShell } from '../shell/MainTabShell';
import { readerPageContentStartInset } from '../common/ReaderPageShell';
import { ReaderWindowCoordinator } from '../../app/ReaderWindowCoordinator';
import {
  readerFloatingTabContentInset,
} from '../common/ReaderFloatingBarMetrics';
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
  private readonly transientFeedback: ReaderTransientFeedback = new ReaderTransientFeedback();
  @StorageLink('readerAppScheme') private appThemeScheme: string = 'day';

  @StorageLink('readerWindowMetricsRevision') private readerWindowMetricsRevision: number = 0;
  @State private fixedHeaderHeight: number = readerPageContentStartInset();
  @Prop @Watch('onPresentationChanged') presentation: DiscoverPresentation = EMPTY_DISCOVER_PRESENTATION;
  @Prop isTablet: boolean;
  onBack: () => void = (): void => {};
  onRssRequested: () => void = (): void => {};
  onSettingsRequested: () => void = (): void => {};
  onRetryRead: (generation: number) => void = (_generation: number): void => {};
  onRefresh: () => void = (): void => {};
  onCycleSource: () => void = (): void => {};
  onSelectKind: (index: number) => void = (_index: number): void => {};
  onPreviousPage: () => void = (): void => {};
  onNextPage: () => void = (): void => {};
  private mounted: boolean = false;
  private lastReadFeedback: string = '';

  aboutToAppear(): void {
    this.mounted = true;
    this.lastReadFeedback = this.readFeedbackIdentity();
    registerReaderFonts(this.getUIContext().getFont());
  }

  aboutToDisappear(): void {
    this.transientFeedback.reset(); this.mounted = false; }

  private readFeedbackIdentity(): string {
    return `${this.presentation.operation?.generation ?? 0}:${this.presentation.operation?.fact ?? ''}:${this.presentation.loading ? 1 : 0}`;
  }

  private onPresentationChanged(): void {
    const identity = this.readFeedbackIdentity();
    if (!this.mounted || identity === this.lastReadFeedback) return;
    this.lastReadFeedback = identity;
    const operation = this.presentation.operation;
    if (this.presentation.loading || this.presentation.books.length === 0 ||
      (operation?.fact !== 'refreshFailed' && operation?.fact !== 'partial')) return;
    try { this.transientFeedback.show(() => this.getUIContext(), { message: this.recovery().message, duration: 2200 }, (): boolean => this.mounted); } catch (_) {}
  }

  build() {
    MainTabShell({
      activeTab: 'discover', headerKind: 'home',
      onMainTab: (key: string): void => this.onMainTab(key),
      header: (): void => { this.homeTopBar(); },
      content: (): void => { this.discoverContent(); },
      onHeaderHeightChange: (height: number): void => {
        if (Number.isFinite(height) && height > 0 && Math.abs(height - this.fixedHeaderHeight) > .1)
          this.fixedHeaderHeight = height;
      },
    });
  }

  @Builder
  private homeTopBar() {
    AppTopBar({ title: '发现' }) {
      ReaderIconButton({
        icon: (this.appThemeScheme === 'night' ? $r('app.media.discover_refresh_theme_night') : $r('app.media.discover_refresh')),
        specId: 'toolbar-standard',
        accessibilityLabel: '刷新',
        actionEnabled: !this.presentation.loading,
        onTap: (): void => this.onRefresh(),
      });
    }
  }

  @Builder
  private discoverContent() {
    Scroll() {
      Column({ space: 7 }) {
        this.operationFeedback();
        this.currentSourceCard();
        this.categoryChips();
        this.filterRow();
        this.rankingHeader();
        this.resultList();
      }
      .width('100%')
      .constraintSize({ maxWidth: this.contentFrame().width })
      .padding({ top: this.fixedHeaderHeight + TOK_SPACE_XS, bottom: this.bottomContentInset() });
    }
    .height('100%')
    .width('100%')
    .align(Alignment.Top)
    .padding({ left: this.contentFrame().left, right: this.contentFrame().right })
    .scrollBar(BarState.Off);
  }

  private recovery(): ReaderRecoveryView {
    const operation = this.presentation.operation;
    if (operation === undefined || (operation.fact !== 'failed' && operation.fact !== 'refreshFailed' &&
      operation.fact !== 'partial')) return { message: '', visible: false, canRetry: false, generation: 0 };
    return readerRecoveryView(undefined, operation);
  }

  @Builder
  private operationFeedback() {
    if (this.presentation.books.length > 0 && this.recovery().canRetry) {
      ReaderRecoveryAction({ label: '刷新内容', generation: this.recovery().generation,
        onReconcile: (generation: number): void => this.onRetryRead(generation) });
    }
  }

  private bottomContentInset(): number {
    if (this.readerWindowMetricsRevision < 0) return TOK_SPACE_SM;
    return readerFloatingTabContentInset(ReaderWindowCoordinator.metrics());
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
          .fontFamily(TYPE_APP_SECTION_LABEL.fontFamily)
          .fontWeight(TYPE_APP_SECTION_LABEL.fontWeight)
          .fontSize(TYPE_APP_SECTION_LABEL.fontSizeFp)
          .lineHeight(TYPE_APP_SECTION_LABEL.lineHeightFp as number)
          .fontColor(readerAppColor('TOK_INK', this.appThemeScheme))
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis });

        Text(this.presentation.sources.length > 0 ?
          `${this.presentation.activeSourceIndex + 1}/${this.presentation.sources.length} · 点击切换书源` :
          '没有已启用发现的书源')
          .width('100%')
          .fontFamily(TYPE_DISCOVER_SOURCE_META.fontFamily)
          .fontWeight(TYPE_DISCOVER_SOURCE_META.fontWeight)
          .fontSize(TYPE_DISCOVER_SOURCE_META.fontSizeFp)
          .lineHeight(TYPE_DISCOVER_SOURCE_META.lineHeightFp as number)
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
          ReaderButton({ scheme: this.appThemeScheme, specId: 'discover-category', label,
            primary: this.presentation.activeKindIndex === index, onAction: (): void => this.onSelectKind(index) });
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
          .fontFamily(TYPE_DISCOVER_FILTER_LABEL.fontFamily)
          .fontWeight(TYPE_DISCOVER_FILTER_LABEL.fontWeight)
          .fontSize(TYPE_DISCOVER_FILTER_LABEL.fontSizeFp)
          .lineHeight(TYPE_DISCOVER_FILTER_LABEL.lineHeightFp as number)
          .fontColor(readerAppColor('app.DiscoverPage.filterRow.fontColor.FF3F372F', this.appThemeScheme))
          .maxLines(1)
          .margin({ left: 3 });
        Text(this.currentFilterText())
          .layoutWeight(1)
          .fontFamily(TYPE_DISCOVER_FILTER_VALUE.fontFamily)
          .fontWeight(TYPE_DISCOVER_FILTER_VALUE.fontWeight)
          .fontSize(TYPE_DISCOVER_FILTER_VALUE.fontSizeFp)
          .lineHeight(TYPE_DISCOVER_FILTER_VALUE.lineHeightFp as number)
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

      ReaderLabeledIconAction({ scheme: this.appThemeScheme, specId: 'discover-apply', label: '应用',
        icon: $r('app.media.discover_apply'), onAction: (): void => this.onRefresh() });
    }
    .width('100%')
    .height(34)
    .alignItems(VerticalAlign.Center);
  }

  @Builder
  private rankingHeader() {
    Text('排行榜')
      .width('100%')
      .fontFamily(TYPE_DISCOVER_RANK_TITLE.fontFamily)
      .fontWeight(TYPE_DISCOVER_RANK_TITLE.fontWeight)
      .fontSize(TYPE_DISCOVER_RANK_TITLE.fontSizeFp)
      .lineHeight(TYPE_DISCOVER_RANK_TITLE.lineHeightFp as number)
      .fontColor(readerAppColor('TOK_INK', this.appThemeScheme))
      .maxLines(1)
      .padding({ left: 2, right: 2 });
  }

  @Builder
  private resultList() {
    Column({ space: 0 }) {
      if (this.presentation.books.length === 0) {
        ReaderPageState({ title: this.presentation.loading ? '正在读取发现内容' : this.recovery().canRetry ? '内容读取失败' : '暂无发现内容',
          message: this.presentation.loading ? '请稍候' : this.presentation.statusMessage,
          loading: this.presentation.loading, actionLabel: this.recovery().canRetry ? '重试' : '',
          onAction: (): void => this.onRetryRead(this.recovery().generation) });
      } else {
        ForEach(this.presentation.books, (book: DiscoverBook) => {
          this.resultRow(book);
        }, (book: DiscoverBook): string => JSON.stringify([book.sourceId, book.bookId]));
      }
      this.paginationRow();
    }
    .width('100%')
    .backgroundColor(this.presentation.books.length > 0 ? readerAppColor('TOK_CARD_BG', this.appThemeScheme) : Color.Transparent)
    .border({ width: this.presentation.books.length > 0 ? TOK_BORDER_W : 0, color: readerAppColor('TOK_LINE_STRONG', this.appThemeScheme) })
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
        .fontFamily(TYPE_APP_SEGMENT_LABEL.fontFamily)
        .fontWeight(TYPE_APP_SEGMENT_LABEL.fontWeight)
        .fontSize(TYPE_APP_SEGMENT_LABEL.fontSizeFp)
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
    ReaderButton({ scheme: this.appThemeScheme, specId: 'discover-page', label, primary: enabled,
      actionEnabled: enabled && !this.presentation.loading, isBusy: this.presentation.loading, onAction: action });
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
          .fontFamily(TYPE_DISCOVER_RANK_TITLE.fontFamily)
          .fontWeight(TYPE_DISCOVER_RANK_TITLE.fontWeight)
          .fontSize(TYPE_DISCOVER_RANK_TITLE.fontSizeFp)
          .lineHeight(TYPE_DISCOVER_RANK_TITLE.lineHeightFp as number)
          .fontColor(readerAppColor('TOK_INK', this.appThemeScheme))
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis });
        if (book.author !== '') {
          Text(book.author)
            .width('100%')
            .fontFamily(TYPE_DISCOVER_AUTHOR.fontFamily)
            .fontWeight(TYPE_DISCOVER_AUTHOR.fontWeight)
            .fontSize(TYPE_DISCOVER_AUTHOR.fontSizeFp)
            .lineHeight(TYPE_DISCOVER_AUTHOR.lineHeightFp as number)
            .fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme))
            .maxLines(1)
            .textOverflow({ overflow: TextOverflow.Ellipsis });
        }
        if (book.intro !== '') {
          Text(book.intro)
            .width('100%')
            .fontFamily(TYPE_DISCOVER_INTRO.fontFamily)
            .fontWeight(TYPE_DISCOVER_INTRO.fontWeight)
            .fontSize(TYPE_DISCOVER_INTRO.fontSizeFp)
            .lineHeight(TYPE_DISCOVER_INTRO.lineHeightFp as number)
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
