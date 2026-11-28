import { readerPaperActionIcon } from '../../../ui/foundation/ReaderActionIconResources';
import { ReaderButton } from '../../../ui/controls/ReaderButton';
import { READER_ACTION_MIN_TARGET, ReaderActionAccessibility, readerActionTouchRegion } from '../../../ui/controls/ReaderActionAccessibility';
import { ReaderPageState } from '../../../ui/feedback/ReaderPageState';
import { readerAppColor } from '../../../ui/foundation/ReaderThemeRegistry';
import { ReaderPressFeedback } from '../../../ui/foundation/ReaderPressFeedback';
import { ReaderDelayedRowPress } from '../../../ui/foundation/ReaderPressMotion';
import {
  TYPE_SEARCH_HISTORY_EMPTY,
  TYPE_SEARCH_HISTORY_HEADING,
  TYPE_SEARCH_HISTORY_KEYWORD,
} from '../../../ui/foundation/ReaderTypography';
import { readerPageAreaLength } from '../../../ui/layout/ReaderPageShell';
import type { SearchHistoryStatus } from '../presentation/SearchPresentation';
import { SearchHistoryGeometry, SearchHistoryPanelLayout } from './SearchHistoryGeometry';

/** A bounded non-scrolling history panel showing at most 6 complete rows. */
@Component
export struct ReaderSearchHistoryPanel {
  @StorageLink('readerAppScheme') private appThemeScheme: string = 'day';
  @State private pressedKey: string = '';
  private readonly delayedPress: ReaderDelayedRowPress = new ReaderDelayedRowPress((key: string): void => {
    this.pressedKey = key;
  });
  @Prop @Watch('cancelPress') history: string[] = [];
  @Prop status: SearchHistoryStatus | undefined = undefined;
  @Prop emptyHint: string = '';
  @Prop scrollable: boolean = false;
  @Prop extraBottomInset: number = 0;
  @Prop layout: SearchHistoryPanelLayout = new SearchHistoryPanelLayout(
    new SearchHistoryGeometry(0, 0, 1, false), [], 0);
  @Prop observeActions: boolean = false;
  onClear: () => void = (): void => {};
  onRetry: () => void = (): void => {};
  onSelect: (keyword: string) => void = (_keyword: string): void => {};
  onDelete: (keyword: string) => void = (_keyword: string): void => {};
  onFeedbackHeight: (height: number, status: string) => void = (_height: number, _status: string): void => {};

  aboutToDisappear(): void { this.cancelPress(); }

  private cancelPress(): void { this.delayedPress.cancel(); }

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
  private clearHistoryButton() {
    Button({ type: ButtonType.Normal, stateEffect: false }) {
      Row({ space: 5 }) {
        this.clearHistoryIcon();
        Text('清空')
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
      .attributeModifier(new ReaderActionAccessibility(
        '清空搜索历史', this.actionsEnabled(), false, true,
        new ReaderPressFeedback(Color.Transparent, this.appThemeScheme, 8, 8, this.actionsEnabled()), 'nativeButton'))
      .opacity(this.actionsEnabled() ? 1 : .45)
      .onClick((): void => {
        if (this.actionsEnabled()) this.onClear();
      });
  }

  @Builder
  private historyRows() {
    Column({ space: 0 }) {
      ForEach(this.layout.items, (keyword: string, index: number) => {
        Stack({ alignContent: Alignment.BottomStart }) {
          Row({ space: 4 }) {
            Button({ type: ButtonType.Normal, stateEffect: false }) {
              Row({ space: 8 }) {
                Image(this.appThemeScheme === 'night' ?
                  $r('app.media.reader_auto_full_clock_theme_night') : $r('app.media.reader_auto_full_clock'))
                  .width(14).height(14).opacity(0.55).objectFit(ImageFit.Contain)
                  .accessibilityLevel('no');
                Text(keyword)
                  .fontFamily(TYPE_SEARCH_HISTORY_KEYWORD.fontFamily)
                  .fontWeight(TYPE_SEARCH_HISTORY_KEYWORD.fontWeight)
                  .fontSize(TYPE_SEARCH_HISTORY_KEYWORD.fontSizeFp)
                  .lineHeight(TYPE_SEARCH_HISTORY_KEYWORD.lineHeightFp as number)
                  .minFontScale(1).maxFontScale(this.layout.geometry.fontScale)
                  .halfLeading(true).maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis })
                  .fontColor(readerAppColor('TOK_INK', this.appThemeScheme))
                  .layoutWeight(1);
              }.width('100%').height(this.layout.geometry.rowHeight)
                .alignItems(VerticalAlign.Center)
                .accessibilityLevel('no-hide-descendants').hitTestBehavior(HitTestMode.None);
            }.layoutWeight(1).height(this.layout.geometry.rowHeight).padding(0)
              .responseRegion(readerActionTouchRegion('100%', this.layout.geometry.rowHeight))
              .id(this.observeActions ? `reader-search-history-item-${index}` : '')
              .attributeModifier(new ReaderActionAccessibility(
                `搜索${keyword}`, this.actionsEnabled(), false, true,
                new ReaderPressFeedback(Color.Transparent, this.appThemeScheme, 8, 8, this.actionsEnabled(),
                  this.pressedKey === `item:${index}:${keyword}`, false), 'nativeButton'))
              .opacity(this.actionsEnabled() ? 1 : .45)
              .onTouch((event: TouchEvent): void => {
                this.delayedPress.observe(event, `item:${index}:${keyword}`, this.actionsEnabled());
              })
              .onClick((): void => {
                if (this.actionsEnabled()) this.onSelect(keyword);
              });

            Button({ type: ButtonType.Normal, stateEffect: false }) {
              Image(readerPaperActionIcon('close', this.appThemeScheme))
                .width(13).height(13).opacity(0.6).objectFit(ImageFit.Contain)
                .accessibilityLevel('no');
            }.width(32).height(this.layout.geometry.rowHeight).padding(0)
              .responseRegion({
                x: -6,
                y: (this.layout.geometry.rowHeight - READER_ACTION_MIN_TARGET) / 2,
                width: READER_ACTION_MIN_TARGET,
                height: READER_ACTION_MIN_TARGET,
              })
              .id(this.observeActions ? `reader-search-history-delete-${index}` : '')
              .attributeModifier(new ReaderActionAccessibility(
                `删除搜索历史${keyword}`, this.actionsEnabled(), false, true,
                new ReaderPressFeedback(Color.Transparent, this.appThemeScheme, 14, 14, this.actionsEnabled(),
                  this.pressedKey === `delete:${index}:${keyword}`, false), 'nativeButton'))
              .opacity(this.actionsEnabled() ? 1 : .45)
              .onTouch((event: TouchEvent): void => {
                this.delayedPress.observe(event, `delete:${index}:${keyword}`, this.actionsEnabled());
              })
              .onClick((): void => {
                if (this.actionsEnabled()) this.onDelete(keyword);
              });
          }.width('100%').height(this.layout.geometry.rowHeight).alignItems(VerticalAlign.Center);

          if (index < this.layout.items.length - 1) {
            Column().width('100%').height(0.5)
              .backgroundColor(readerAppColor('TOK_LINE', this.appThemeScheme))
              .hitTestBehavior(HitTestMode.None).accessibilityLevel('no');
          }
        }.width('100%').height(this.layout.geometry.rowHeight);
      }, (keyword: string, index: number): string => `history:${index}:${keyword}`);

      if (this.history.length === 0 && this.layout.geometry.emptyVisible) {
        Text(this.emptyHint.length > 0 ? this.emptyHint : '暂无搜索历史').fontFamily(TYPE_SEARCH_HISTORY_EMPTY.fontFamily)
          .fontWeight(TYPE_SEARCH_HISTORY_EMPTY.fontWeight)
          .fontSize(TYPE_SEARCH_HISTORY_EMPTY.fontSizeFp)
          .lineHeight(TYPE_SEARCH_HISTORY_EMPTY.lineHeightFp as number).halfLeading(true)
          .minFontScale(1).maxFontScale(this.layout.geometry.fontScale)
          .height(this.layout.geometry.emptyHeight)
          .maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis })
          .fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme));
      }
    }.width('100%').alignItems(HorizontalAlign.Start)
      .padding({ bottom: this.scrollable ? this.extraBottomInset : 0 });
  }

  build() {
    Column({ space: 0 }) {
      if (this.layout.geometry.headingVisible) {
        Row({ space: 8 }) {
          Text('最近搜索').fontFamily(TYPE_SEARCH_HISTORY_HEADING.fontFamily)
            .fontWeight(TYPE_SEARCH_HISTORY_HEADING.fontWeight)
            .fontSize(TYPE_SEARCH_HISTORY_HEADING.fontSizeFp)
            .lineHeight(TYPE_SEARCH_HISTORY_HEADING.lineHeightFp as number)
            .minFontScale(1).maxFontScale(this.layout.geometry.fontScale)
            .halfLeading(true).maxLines(1)
            .fontColor(readerAppColor('TOK_INK', this.appThemeScheme)).layoutWeight(1);
          if (this.history.length > 0) {
            this.clearHistoryButton();
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
      if (this.scrollable) {
        Scroll() {
          this.historyRows();
        }.width('100%').layoutWeight(1).align(Alignment.TopStart).scrollBar(BarState.Off)
          .onScrollStart((): void => this.cancelPress());
      } else {
        this.historyRows();
      }
    }.width('100%').height(this.scrollable ? '100%' : undefined).padding({
      left: this.layout.geometry.innerInset,
      right: this.layout.geometry.innerInset,
      top: this.layout.geometry.topInset,
      bottom: this.layout.geometry.bottomInset,
    });
  }

  private feedbackMeasurement(status: string): (_old: Area, next: Area) => void {
    return (_old: Area, next: Area): void => {
      const height = readerPageAreaLength(next.height);
      if (status === this.status && Number.isFinite(height) && height > 0) this.onFeedbackHeight(height, status);
    };
  }
}
