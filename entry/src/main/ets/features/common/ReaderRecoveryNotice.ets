import type { MeasureOptions } from '@ohos.measure';
import { MESSAGE_ACTION, MESSAGE_META, MESSAGE_NOTICE_TITLE } from './ReaderMessageStyle';
import { readerAppColor } from './ReaderThemeRegistry';
import { ReaderRecoveryAction } from './ReaderRecoveryAction';
import type { ReaderRecoveryView } from '../../app/ReaderRecoveryProjection';

/** One original operation, with its own captured generation and actions. The
 * host places this compact surface above content, below the safe top inset. */
@Component
export struct ReaderRecoveryNotice {
  @StorageLink('readerAppScheme') private appThemeScheme: string = 'day';
  @Prop @Watch('remeasure') view: ReaderRecoveryView = { message: '', visible: false, canRetry: false, generation: 0 };
  @Prop @Watch('remeasure') tag: string = '待处理';
  @Prop @Watch('remeasure') actionLabel: string = '刷新列表';
  @Prop @Watch('remeasure') secondaryActionLabel: string = '';
  @Prop @Watch('remeasure') busy: boolean = false;
  @Prop @Watch('remeasure') secondaryBusy: boolean = false;
  @State private expanded: boolean = false;
  @State private clipped: boolean = false;
  @State private reservedSpace: string = '';
  @State private actionsWidth: number = 0;
  @State private actionsHeight: number = 28;
  @State private titleLineHeight: number = 22;
  private measuredWidth: number = 0;
  private measuredGeneration: number = -1;
  onReconcile: (generation: number) => void = (_generation: number): void => {};
  onSecondaryAction: (generation: number) => void = (_generation: number): void => {};

  build() {
    if (this.view.visible) {
      Stack({ alignContent: Alignment.BottomEnd }) {
        Column() {
          Text() {
            Span(` ${this.tag} `).fontSize(MESSAGE_META.fontSizeFp)
              .textBackgroundStyle({ color: readerAppColor('TOK_MESSAGE_TAG', this.appThemeScheme), radius: 4 });
            Span(`  ${this.view.message}`);
            // Native text layout carries a nonbreaking space group the width
            // of the actions. The action overlay ends at the trailing edge of
            // that final line, so short/long titles share the same flow.
            if (!this.clipped || this.expanded) {
              Span(this.reservedSpace);
            }
          }
          .width('100%').fontFamily(MESSAGE_NOTICE_TITLE.fontFamily)
          .fontWeight(MESSAGE_NOTICE_TITLE.fontWeight).fontSize(MESSAGE_NOTICE_TITLE.fontSizeFp)
          .lineHeight(MESSAGE_NOTICE_TITLE.lineHeightFp as number)
          .fontColor(readerAppColor('TOK_MESSAGE_NOTICE_INK', this.appThemeScheme))
          .wordBreak(WordBreak.BREAK_WORD).maxLines(this.expanded ? 10000 : 3)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
          .onAreaChange((_old: Area, area: Area): void => this.measureFlow(Number(area.width)));
          if (this.clipped && !this.expanded) { Blank().height(this.actionsHeight); }
          else { Blank().height(Math.max(0, this.actionsHeight - this.titleLineHeight)); }
        }.width('100%');
        Flex({ justifyContent: FlexAlign.End, wrap: FlexWrap.Wrap }) {
          if ((this.view.canRetry || this.busy) && this.actionLabel.length > 0) {
            ReaderRecoveryAction({ variant: 'notice', label: this.actionLabel, generation: this.view.generation,
              isBusy: this.busy, actionEnabled: !this.busy && !this.secondaryBusy,
              onReconcile: this.onReconcile });
          }
          if (this.secondaryActionLabel.length > 0) {
            ReaderRecoveryAction({ variant: 'notice', label: this.secondaryActionLabel, generation: this.view.generation,
              isBusy: this.secondaryBusy, actionEnabled: !this.busy && !this.secondaryBusy,
              onReconcile: this.onSecondaryAction });
          }
          if (this.clipped) {
            ReaderRecoveryAction({ variant: 'notice', label: this.expanded ? '收起' : '展开',
              onReconcile: (): void => { this.expanded = !this.expanded; } });
          }
        }.constraintSize({ maxWidth: '100%' }).width(this.actionsWidth > 0 ? this.actionsWidth : undefined)
          .onAreaChange((_old: Area, area: Area): void => {
            const height = Number(area.height);
            if (Number.isFinite(height) && height >= 0) this.actionsHeight = height;
          });
      }
      .width('100%').padding({ left: 12, right: 12, top: 10, bottom: 10 })
      .borderRadius(14).backgroundColor(readerAppColor('TOK_MESSAGE_NOTICE', this.appThemeScheme))
      .shadow({ radius: 16, offsetY: 4, color: '#18000000' })
      .hitTestBehavior(HitTestMode.Transparent);
    }
  }

  private remeasure(): void { this.measureFlow(this.measuredWidth); }

  private measureFlow(width: number): void {
    if (!Number.isFinite(width) || width <= 0) return;
    if (this.measuredGeneration !== this.view.generation) {
      this.measuredGeneration = this.view.generation;
      this.expanded = false;
    }
    this.measuredWidth = width;
    try {
      const context = this.getUIContext();
      const utils = context.getMeasureUtils();
      const labelWidth = (label: string): number => context.px2vp(utils.measureText({ textContent: label,
        fontSize: `${MESSAGE_ACTION.fontSizeFp}fp`, fontFamily: MESSAGE_ACTION.fontFamily,
        fontWeight: MESSAGE_ACTION.fontWeight })) + 12;
      let actions = (this.view.canRetry || this.busy) && this.actionLabel.length > 0 ? labelWidth(this.actionLabel) : 0;
      if (this.secondaryActionLabel.length > 0) actions += labelWidth(this.secondaryActionLabel);
      const space = context.px2vp(utils.measureText({ textContent: ' ', fontSize: '14fp',
        fontFamily: MESSAGE_NOTICE_TITLE.fontFamily, fontWeight: 400 }));
      const options: MeasureOptions = { textContent: ` ${this.tag}   ${this.view.message}`,
        fontFamily: MESSAGE_NOTICE_TITLE.fontFamily, fontSize: '14fp', fontWeight: 400,
        lineHeight: '22fp', constraintWidth: `${width}vp`, wordBreak: WordBreak.BREAK_WORD };
      // Include the action reservation when deciding whether three lines can
      // carry this item. Clipping must never remove that reserved final line.
      const reservation = actions > 0 && space > 0 ? ' '.repeat(Math.floor(Math.min(width, actions) / space)) : '';
      options.textContent += reservation;
      const full = Number(utils.measureTextSize(options).height);
      options.maxLines = 3;
      const folded = Number(utils.measureTextSize(options).height);
      this.clipped = full > folded + .5;
      if (this.clipped) actions += labelWidth('展开');
      this.actionsWidth = Math.min(width, actions);
      this.reservedSpace = actions > 0 && space > 0 ? ' '.repeat(Math.floor(this.actionsWidth / space)) : '';
      this.titleLineHeight = context.px2vp(Number(utils.measureTextSize({ textContent: '字', fontSize: '14fp',
        fontFamily: MESSAGE_NOTICE_TITLE.fontFamily, fontWeight: 400, lineHeight: '22fp' }).height));

    } catch (_) {
      // The full original message remains available if native measurement is
      // unavailable. Never hide an operation or guess its completion state.
      this.expanded = true;
      this.clipped = true;
      this.actionsWidth = width;
      this.reservedSpace = '\n\u00a0';
    }
  }
}
