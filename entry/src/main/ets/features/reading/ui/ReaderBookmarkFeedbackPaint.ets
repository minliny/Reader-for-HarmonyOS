import { MESSAGE_META } from '../../../ui/foundation/ReaderMessageStyle';
import { READER_BOOKMARK_TRIGGER_VP } from '../presentation/ReaderPageBookmarkModel';

export interface ReaderBookmarkPaperWellInput {
  paperTop: number;
  offset: number;
  paperColor: string;
  day: boolean;
}

@Builder
export function ReaderBookmarkPaperWell($$: ReaderBookmarkPaperWellInput) {
  Stack()
    .width('100%').height($$.paperTop + $$.offset + 18)
    .position({ x: 0, y: 0 })
    .backgroundColor($$.paperColor)
    .id('reader-bookmark-paper-base').hitTestBehavior(HitTestMode.None).accessibilityLevel('no');
  Stack()
    .width('100%').height($$.offset + 18)
    .position({ x: 0, y: $$.paperTop })
    .backgroundColor($$.day ?
      '#172B241D' : '#57000000')
    .opacity(Math.min(1, $$.offset / 10))
    .id('reader-bookmark-paper-well').hitTestBehavior(HitTestMode.None).accessibilityLevel('no');
  Stack()
    .width('100%').height(Math.min(12, $$.offset))
    .position({ x: 0, y: $$.paperTop + Math.max(0, $$.offset - 12) })
    .linearGradient({ direction: GradientDirection.Bottom, colors:
      $$.day ?
        [['#002B241D', 0], ['#1F2B241D', 1]] : [['#00000000', 0], ['#6B000000', 1]] })
    .opacity(Math.min(1, $$.offset / 18))
    .id('reader-bookmark-paper-shadow').hitTestBehavior(HitTestMode.None).accessibilityLevel('no');
}

export interface ReaderBookmarkPullFeedbackInput {
  alpha: number;
  text: string;
  ink: string;
  offset: number;
  paperTop: number;
  day: boolean;
}

@Builder
export function ReaderBookmarkPullFeedback($$: ReaderBookmarkPullFeedbackInput) {
  Column({ space: 4 }) {
    if ($$.alpha > 0) {
      Text($$.text)
        .fontFamily(MESSAGE_META.fontFamily).fontWeight(MESSAGE_META.fontWeight)
        .fontSize(MESSAGE_META.fontSizeFp).lineHeight(MESSAGE_META.lineHeightFp as number)
        .fontColor($$.ink)
        .textAlign(TextAlign.Center).maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis })
        .constraintSize({ maxWidth: '100%', maxHeight: Math.max(0, $$.offset - 6.5) })
        .opacity($$.alpha);
    }
    Stack({ alignContent: Alignment.Start }) {
      Stack()
        .width(48 * Math.min(1, $$.offset / READER_BOOKMARK_TRIGGER_VP)).height('100%')
        .borderRadius(1.25).backgroundColor($$.ink)
        .id('reader-bookmark-pull-fill');
    }
    .width(48).height(2.5).borderRadius(1.25).clip(true)
    .backgroundColor($$.day ?
      '#242B241D' : '#29ECE8E0')
    .id('reader-bookmark-pull-track').accessibilityLevel('no');
  }
  .width('100%').height($$.offset).justifyContent(FlexAlign.Center).clip(true)
  .position({ x: 0, y: $$.paperTop })
  .id('reader-bookmark-pull-feedback').hitTestBehavior(HitTestMode.None);
}

export interface ReaderBookmarkQuietFeedbackInput {
  text: string;
  ink: string;
  width: number;
  height: number;
  x: number;
  y: number;
  alpha: number;
}

@Builder
export function ReaderBookmarkQuietFeedback($$: ReaderBookmarkQuietFeedbackInput) {
  Row() {
    Text($$.text)
      .fontFamily(MESSAGE_META.fontFamily).fontWeight(MESSAGE_META.fontWeight)
      .fontSize(MESSAGE_META.fontSizeFp).lineHeight(MESSAGE_META.lineHeightFp as number)
      .fontColor($$.ink)
      .textAlign(TextAlign.Center).maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis });
  }
    .width($$.width).height($$.height).justifyContent(FlexAlign.Center)
    .position({ x: $$.x, y: $$.y })
    .opacity($$.alpha)
    .accessibilityLevel($$.alpha > 0 ? 'auto' : 'no-hide-descendants')
    .clip(true).zIndex(9).hitTestBehavior(HitTestMode.None);
}
