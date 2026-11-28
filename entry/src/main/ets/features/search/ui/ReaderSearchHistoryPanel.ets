import { readerPaperActionIcon } from '../../../ui/foundation/ReaderActionIconResources';
import type { UIContext } from '@ohos.arkui.UIContext';
import type { MeasureOptions } from '@ohos.measure';
import { ReaderButton } from '../../../ui/controls/ReaderButton';
import { READER_ACTION_MIN_TARGET, ReaderActionAccessibility, readerActionTouchRegion } from '../../../ui/controls/ReaderActionAccessibility';
import { ReaderPageState } from '../../../ui/feedback/ReaderPageState';
import { readerAppColor } from '../../../ui/foundation/ReaderThemeRegistry';
import { ReaderPressFeedback } from '../../../ui/foundation/ReaderPressFeedback';
import { TYPE_SEARCH_HISTORY_EMPTY, TYPE_SEARCH_HISTORY_HEADING } from '../../../ui/foundation/ReaderTypography';
import { readerPageAreaLength } from '../../../ui/layout/ReaderPageShell';
import type { SearchHistoryStatus } from '../presentation/SearchPresentation';
import { SearchHistoryGeometry, SearchHistoryPanelLayout, SearchHistoryRow, SearchHistoryChip } from './SearchHistoryGeometry';
import { resolveReaderButtonSpec } from '../../../ui/controls/ReaderControlSpecs';
import { TOK_BORDER_W } from '../../../ui/foundation/ReaderTokens';
import { ReaderWindowCoordinator } from '../../../app/ReaderWindowCoordinator';

/** Native widths for the same label and chrome used by ReaderButton. */
export class SearchHistoryMeasurements {
  private measuredRevision: number = -1;
  private measuredWidths: Map<string, number> = new Map<string, number>();

  measureControlWidth(context: UIContext, metricsRevision: number, keyword: string): number {
    if (this.measuredRevision !== metricsRevision) {
      this.measuredWidths.clear();
      this.measuredRevision = metricsRevision;
    }
    const previous = this.measuredWidths.get(keyword);
    if (previous !== undefined) return previous;
    const spec = resolveReaderButtonSpec('search-history-keyword');
    const text = spec.text;
    // Measure with the system-scaled fp recipe used by the visible label.
    const systemScale = ReaderWindowCoordinator.metrics().systemFontScale;
    const options: MeasureOptions = { textContent: keyword,
      fontSize: `${text.fontSizeFp}${Number.isFinite(systemScale) && systemScale > 0 && systemScale < 1 ? 'vp' : 'fp'}` };
    if (text.fontFamily !== undefined) options.fontFamily = text.fontFamily;
    if (text.fontWeight !== undefined) options.fontWeight = text.fontWeight;
    if (text.letterSpacingFp !== undefined) options.letterSpacing = `${text.letterSpacingFp}fp`;
    const measured = context.px2vp(context.getMeasureUtils().measureText(options));
    if (!Number.isFinite(measured) || measured < 0) return Number.NaN;
    const width = Math.max(spec.minWidth ?? 0,
      Math.ceil(measured) + spec.horizontalPadding * 2 + (spec.hasBorder ? TOK_BORDER_W * 2 : 0));
    if (this.measuredWidths.size >= 128) this.measuredWidths.clear();
    this.measuredWidths.set(keyword, width);
    return width;
  }
}

/** A bounded history panel with a scrollable body when expanded. */
@Component
export struct ReaderSearchHistoryPanel {
  @StorageProp('readerAppScheme') private appThemeScheme: string = 'day';
  @Prop history: string[] = [];
  @Prop status: SearchHistoryStatus | undefined = undefined;
  @Prop layout: SearchHistoryPanelLayout = new SearchHistoryPanelLayout(
    new SearchHistoryGeometry(0, 0, 1, false), [], false, false, 0, 0);
  @Prop observeActions: boolean = false;
  onClear: () => void = (): void => {};
  onRetry: () => void = (): void => {};
  onSelect: (keyword: string) => void = (_keyword: string): void => {};
  onToggle: () => void = (): void => {};
  onFeedbackHeight: (height: number, status: string) => void = (_height: number, _status: string): void => {};

  private actionsEnabled(): boolean { return this.status !== 'loading'; }
  @Builder
  private retryHistoryAction() {
    ReaderButton({ scheme: this.appThemeScheme, specId: 'search-secondary',
      label: this.status === 'clearFailed' ? '重试清空' : '重试读取', onAction: (): void => this.onRetry() });
  }
  @Builder
  private clearHistoryIcon() {
    Image(readerPaperActionIcon('trash', this.appThemeScheme)).width(14).height(14).objectFit(ImageFit.Contain)
      .accessibilityLevel('no');
  }
  @Builder
  private historyAction(clear: boolean) {
    Button({ type: ButtonType.Normal, stateEffect: false }) {
      Row({ space: 5 }) {
        if (clear) this.clearHistoryIcon();
        Text(clear ? '清空' : this.layout.expanded ? '收起' : '展开')
          .fontFamily(TYPE_SEARCH_HISTORY_EMPTY.fontFamily).fontWeight(TYPE_SEARCH_HISTORY_EMPTY.fontWeight)
          .fontSize(TYPE_SEARCH_HISTORY_EMPTY.fontSizeFp).lineHeight(TYPE_SEARCH_HISTORY_EMPTY.lineHeightFp as number)
          .minFontScale(1).maxFontScale(this.layout.geometry.fontScale)
          .halfLeading(true).maxLines(1)
          .fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme));
      }.height(this.layout.geometry.headingHeight)
        .alignItems(VerticalAlign.Center).justifyContent(FlexAlign.End)
        .accessibilityLevel('no-hide-descendants').hitTestBehavior(HitTestMode.None);
    }.height(this.layout.geometry.headingHeight).padding(0).align(Alignment.End)
      .constraintSize({ minWidth: READER_ACTION_MIN_TARGET })
      .responseRegion(readerActionTouchRegion('100%', this.layout.geometry.headingHeight))
      .id(clear ? '' : 'reader-search-history-toggle')
      .attributeModifier(new ReaderActionAccessibility(
        clear ? '清空搜索历史' : this.layout.expanded ? '收起搜索历史' : '展开搜索历史',
        this.actionsEnabled(), false, true,
        new ReaderPressFeedback(Color.Transparent, this.appThemeScheme, 8, 8, this.actionsEnabled()), 'nativeButton'))
      .opacity(this.actionsEnabled() ? 1 : .45)
      .onClick((): void => {
        if (!this.actionsEnabled()) return;
        if (clear) this.onClear();
        else this.onToggle();
      });
  }
  @Builder
  private historyRows() {
    Column({ space: this.layout.geometry.gap }) {
      // A changed width or membership retires captured row and chip objects.
      ForEach(this.layout.rows, (row: SearchHistoryRow) => {
        Row({ space: this.layout.geometry.gap }) {
          ForEach(row.chips, (chip: SearchHistoryChip) => {
            ReaderButton({ scheme: this.appThemeScheme, specId: 'search-history-keyword', label: chip.keyword,
              layout: 'full', actionEnabled: this.actionsEnabled(),
              focusId: this.observeActions ? `reader-search-history-item-${this.history.indexOf(chip.keyword)}` : '',
              actionAccessibilityLabel: `搜索${chip.keyword}`, onAction: (): void => this.onSelect(chip.keyword) })
              .width(chip.width).height(this.layout.geometry.buttonHeight);
          }, (chip: SearchHistoryChip): string => `history:${chip.keyword}`);
        }.width('100%').height(this.layout.geometry.buttonHeight);
      }, (row: SearchHistoryRow): string => `history-row:${this.layout.geometry.buttonHeight}:${JSON.stringify(row.chips)}`);
      if (this.history.length === 0 && this.layout.geometry.emptyVisible) {
        Text('暂无搜索历史').fontFamily(TYPE_SEARCH_HISTORY_EMPTY.fontFamily)
          .fontWeight(TYPE_SEARCH_HISTORY_EMPTY.fontWeight)
          .fontSize(TYPE_SEARCH_HISTORY_EMPTY.fontSizeFp)
          .lineHeight(TYPE_SEARCH_HISTORY_EMPTY.lineHeightFp as number).halfLeading(true)
          .minFontScale(1).maxFontScale(this.layout.geometry.fontScale)
          .height(this.layout.geometry.emptyHeight)
          .fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme));
      }
    }.width('100%').alignItems(HorizontalAlign.Start);
  }
  build() {
    Column({ space: 0 }) {
      if (this.layout.geometry.headingVisible) {
        Row({ space: this.layout.geometry.gap }) {
          Text('最近搜索').fontFamily(TYPE_SEARCH_HISTORY_HEADING.fontFamily)
            .fontWeight(TYPE_SEARCH_HISTORY_HEADING.fontWeight)
            .fontSize(TYPE_SEARCH_HISTORY_HEADING.fontSizeFp)
            .lineHeight(TYPE_SEARCH_HISTORY_HEADING.lineHeightFp as number)
            .minFontScale(1).maxFontScale(this.layout.geometry.fontScale)
            .halfLeading(true).maxLines(1)
            .fontColor(readerAppColor('TOK_INK', this.appThemeScheme)).layoutWeight(1);
          if (this.layout.canToggle && this.layout.toggleInHeading) {
            this.historyAction(false);
          }
          if (this.history.length > 0) {
            this.historyAction(true);
          }
        }.width('100%').height(this.layout.geometry.headingHeight).alignItems(VerticalAlign.Center)
          .margin({ bottom: this.layout.geometry.headingGap });
      }
      if (this.layout.geometry.feedbackVisible && this.status === 'loading') {
        ReaderPageState({ message: '正在读取搜索历史', loading: true, padded: false })
          .id('reader-search-history-loading')
          .onAreaChange(this.feedbackMeasurement(this.status));
      } else if (this.layout.geometry.feedbackVisible && (this.status === 'loadFailed' || this.status === 'clearFailed')) {
        ReaderPageState({ message: this.status === 'clearFailed' ? '搜索历史清空失败' : '搜索历史读取失败',
          padded: false, customActions: true, actionContent: (): void => { this.retryHistoryAction(); } })
          .onAreaChange(this.feedbackMeasurement(this.status));
      }
      if (this.layout.expanded) {
        Scroll() { this.historyRows(); }
          .id('reader-search-history-scroll').width('100%').height(this.layout.bodyViewport)
          .align(Alignment.TopStart).scrollBar(BarState.Auto);
      } else {
        this.historyRows();
      }
      if (this.layout.canToggle && !this.layout.toggleInHeading) {
        Row() {
          this.historyAction(false);
        }.width('100%').height(this.layout.geometry.headingHeight).justifyContent(FlexAlign.End)
          .margin({ top: this.layout.geometry.headingGap });
      }
    }.width('100%').padding({ left: this.layout.geometry.innerInset, right: this.layout.geometry.innerInset,
      top: this.layout.geometry.topInset, bottom: this.layout.geometry.bottomInset });
  }
  private feedbackMeasurement(status: string): (_old: Area, next: Area) => void {
    return (_old: Area, next: Area): void => {
      const height = readerPageAreaLength(next.height);
      if (status === this.status && Number.isFinite(height) && height > 0) this.onFeedbackHeight(height, status);
    };
  }
}
