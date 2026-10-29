import type { MeasureOptions } from '@ohos.measure';
import { ReaderButton } from '../common/ReaderButton';
import { ReaderPageState } from '../common/ReaderPageState';
import { readerAppColor } from '../common/ReaderThemeRegistry';
import { TYPE_SEARCH_HISTORY_HEADING } from '../common/ReaderTypography';
import { readerPageAreaLength } from '../common/ReaderPageShell';
import type { SearchHistoryStatus } from './SearchPresentation';
import { SearchHistoryGeometry, SearchHistoryRow, SearchHistoryChip, projectSearchHistoryRows } from './SearchHistoryGeometry';
import { resolveReaderButtonSpec } from '../common/ReaderControlSpecs';
import { TOK_BORDER_W } from '../common/ReaderTokens';
import { ReaderWindowCoordinator } from '../../app/ReaderWindowCoordinator';

/** A bounded, non-scrolling projection. Persistence remains with SearchHost. */
@Component
export struct ReaderSearchHistoryPanel {
  @StorageLink('readerAppScheme') private appThemeScheme: string = 'day';
  @StorageLink('readerWindowMetricsRevision') private metricsRevision: number = 0;
  private measuredRevision: number = -1;
  private measuredWidths: Map<string, number> = new Map<string, number>();
  @Prop history: string[] = [];
  @Prop status: SearchHistoryStatus | undefined = undefined;
  @Prop geometry: SearchHistoryGeometry = new SearchHistoryGeometry(0, 0, 1, false);
  onClear: () => void = (): void => {};
  onRetry: () => void = (): void => {};
  onSelect: (keyword: string) => void = (_keyword: string): void => {};
  onFeedbackHeight: (height: number, status: string) => void = (_height: number, _status: string): void => {};

  private projectedRows(): SearchHistoryRow[] {
    return projectSearchHistoryRows(this.history, this.geometry,
      (keyword: string): number => this.measuredControlWidth(keyword));
  }
  private measuredControlWidth(keyword: string): number {
    if (this.measuredRevision !== this.metricsRevision) {
      this.measuredWidths.clear();
      this.measuredRevision = this.metricsRevision;
    }
    const previous = this.measuredWidths.get(keyword);
    if (previous !== undefined) return previous;
    const spec = resolveReaderButtonSpec('search-history-keyword');
    const text = spec.text;
    // Explicit fp has the same system scaling as ReaderButton's label. Native
    // measurement already resolves it; multiplying fontScale here doubles it.
    const systemScale = ReaderWindowCoordinator.metrics().systemFontScale;
    const options: MeasureOptions = { textContent: keyword,
      fontSize: `${text.fontSizeFp}${Number.isFinite(systemScale) && systemScale > 0 && systemScale < 1 ? 'vp' : 'fp'}` };
    if (text.fontFamily !== undefined) options.fontFamily = text.fontFamily;
    if (text.fontWeight !== undefined) options.fontWeight = text.fontWeight;
    if (text.letterSpacingFp !== undefined) options.letterSpacing = `${text.letterSpacingFp}fp`;
    const context = this.getUIContext();
    const measured = context.px2vp(context.getMeasureUtils().measureText(options));
    if (!Number.isFinite(measured) || measured < 0) return Number.NaN;
    const width = Math.ceil(measured) + spec.horizontalPadding * 2 + (spec.hasBorder ? TOK_BORDER_W * 2 : 0);
    if (this.measuredWidths.size >= 128) this.measuredWidths.clear();
    this.measuredWidths.set(keyword, width);
    return width;
  }
  private actionsEnabled(): boolean { return this.status !== 'loading'; }
  @Builder
  private retryHistoryAction() {
    ReaderButton({ scheme: this.appThemeScheme, specId: 'search-secondary',
      label: this.status === 'clearFailed' ? '重试清空' : '重试读取', onAction: (): void => this.onRetry() });
  }
  build() {
    Column({ space: 0 }) {
      if (this.geometry.headingVisible) {
      Row() {
        Text('最近搜索').fontFamily(TYPE_SEARCH_HISTORY_HEADING.fontFamily)
          .fontWeight(TYPE_SEARCH_HISTORY_HEADING.fontWeight)
          .fontSize(TYPE_SEARCH_HISTORY_HEADING.fontSizeFp)
          .lineHeight(TYPE_SEARCH_HISTORY_HEADING.lineHeightFp as number)
          .fontColor(readerAppColor('TOK_INK', this.appThemeScheme)).layoutWeight(1);
        if (this.history.length > 0) {
          Row({ space: 4 }) {
            Image(this.appThemeScheme === 'night' ? $r('app.media.reader_action_trash_theme_night') : $r('app.media.reader_action_trash'))
              .width(12).height(12).objectFit(ImageFit.Contain);
            Text('清空').fontFamily(TYPE_SEARCH_HISTORY_HEADING.fontFamily).fontSize(11).lineHeight(16)
              .fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme));
          }.height(this.geometry.headingHeight).padding({ left: 4, right: 4 })
            .enabled(this.actionsEnabled()).focusable(this.actionsEnabled())
            .hitTestBehavior(this.actionsEnabled() ? HitTestMode.Default : HitTestMode.None)
            .opacity(this.actionsEnabled() ? 1 : .38)
            .accessibilityRole(AccessibilityRoleType.BUTTON).accessibilityText('清空搜索历史')
            .onClick((): void => { if (this.actionsEnabled()) this.onClear(); });
        }
      }.width('100%').height(this.geometry.headingHeight).alignItems(VerticalAlign.Center)
        .margin({ bottom: this.geometry.headingGap });
      }
      if (this.geometry.feedbackVisible && this.status === 'loading') {
        ReaderPageState({ message: '正在读取搜索历史', loading: true, padded: false })
          .onAreaChange(this.feedbackMeasurement(this.status));
      } else if (this.geometry.feedbackVisible && (this.status === 'loadFailed' || this.status === 'clearFailed')) {
        ReaderPageState({ message: this.status === 'clearFailed' ? '搜索历史清空失败' : '搜索历史读取失败',
          padded: false, customActions: true, actionContent: (): void => { this.retryHistoryAction(); } })
          .onAreaChange(this.feedbackMeasurement(this.status));
      }
      Column({ space: this.geometry.gap }) {
        // A changed width/membership retires captured row/chip objects.
        ForEach(this.projectedRows(), (row: SearchHistoryRow) => {
          Row({ space: this.geometry.gap }) {
            ForEach(row.chips, (chip: SearchHistoryChip) => {
              ReaderButton({ scheme: this.appThemeScheme, specId: 'search-history-keyword', label: chip.keyword,
                layout: 'intrinsic', actionEnabled: this.actionsEnabled(),
                actionAccessibilityLabel: `搜索${chip.keyword}`, onAction: (): void => this.onSelect(chip.keyword) })
                .width(chip.width).height(this.geometry.buttonHeight);
            }, (chip: SearchHistoryChip): string => `history:${chip.keyword}`);
          }.width('100%').height(this.geometry.buttonHeight);
        }, (row: SearchHistoryRow): string => `history-row:${this.geometry.buttonHeight}:${JSON.stringify(row.chips)}`);
        if (this.history.length === 0 && this.geometry.emptyVisible) {
          Text('暂无搜索历史').fontSize(12).lineHeight(18)
            .fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme));
        }
      }.width('100%').height(this.geometry.bodyHeight).alignItems(HorizontalAlign.Start);
    }.width('100%').padding({ left: this.geometry.innerInset, right: this.geometry.innerInset,
      top: this.geometry.topInset, bottom: this.geometry.bottomInset });
  }
  private feedbackMeasurement(status: string): (_old: Area, next: Area) => void {
    return (_old: Area, next: Area): void => {
      const height = readerPageAreaLength(next.height);
      if (status === this.status && Number.isFinite(height) && height > 0) this.onFeedbackHeight(height, status);
    };
  }
}
