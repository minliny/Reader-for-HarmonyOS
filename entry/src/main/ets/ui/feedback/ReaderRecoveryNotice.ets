import { LengthMetrics } from '@kit.ArkUI';
import type { MeasureOptions } from '@ohos.measure';
import { MESSAGE_ACTION, MESSAGE_META, MESSAGE_NOTICE_TITLE } from '../foundation/ReaderMessageStyle';
import { readerAppColor } from '../foundation/ReaderThemeRegistry';
import { ReaderRecoveryAction } from './ReaderRecoveryAction';
import type { ReaderRecoveryView } from './ReaderRecoveryView';

/** One original operation, with its own captured generation and actions. The
 * host places this compact surface above content, below the safe top inset. */
@Component
export struct ReaderRecoveryNotice {
  @StorageLink('readerAppScheme') private appThemeScheme: string = 'day';
  @StorageLink('readerWindowMetricsRevision') @Watch('remeasure') private readerWindowMetricsRevision: number = 0;
  @Prop @Watch('remeasure') view: ReaderRecoveryView = { message: '', visible: false, canRetry: false, generation: 0 };
  @Prop @Watch('remeasure') tag: string = '待处理';
  @Prop @Watch('remeasure') actionLabel: string = '刷新列表';
  @Prop @Watch('remeasure') secondaryActionLabel: string = '';
  @Prop @Watch('remeasure') busy: boolean = false;
  @Prop @Watch('remeasure') secondaryBusy: boolean = false;
  @Prop actionEnabled: boolean = true;
  @Prop secondaryActionEnabled: boolean = true;
  /** Keeps the original disabled query slot while its owner reports a read. */
  @Prop @Watch('remeasure') retainPrimaryAction: boolean = false;
  /** Flow content leaves the negative default. Overlay callers supply their current host remainder. */
  @Prop maxHeightVp: number = -1;
  /** Current outer width from a known host. Negative leaves flow width to native layout. */
  @Prop @Watch('remeasure') layoutWidthVp: number = -1;
  /** The enclosing group owns its single painted surface. */
  @Prop grouped: boolean = false;
  @Prop follows: boolean = false;
  @State private separateActions: boolean = false;
  @State private expanded: boolean = false;
  @State private clipped: boolean = false;
  @State private reservedSpace: string = '';
  @State private actionsWidth: number = 0;
  @State private actionsHeight: number = 44;
  @State private titleLineHeight: number = 22;
  private measuredWidth: number = 0;
  private mounted: boolean = false;
  private appearanceEpoch: number = 0;
  private measuredGeneration: number = -1;
  onReconcile: (generation: number) => void = (_generation: number): void => {};
  onSecondaryAction: (generation: number) => void = (_generation: number): void => {};

  aboutToAppear(): void {
    this.mounted = true;
    this.appearanceEpoch += 1;
    if (this.layoutWidthVp > 24) this.measureFlow(this.layoutWidthVp - 24);
  }
  aboutToDisappear(): void { this.mounted = false; this.appearanceEpoch += 1; }

  build() {
    if (this.view.visible) {
      if (this.maxHeightVp >= 0) {
        ForEach([this.view.generation], (generation: number): void => {
        Scroll() { this.noticeBody(); }
          .width('100%').constraintSize({ maxHeight: this.maxHeightVp })
          .scrollBar(BarState.Auto).clip(true)
          // The bounded Scroll owns its gestures, including over disabled actions.
          // Carry its hit boundary through transparent page-overlay ancestors.
          .hitTestBehavior(HitTestMode.BLOCK_HIERARCHY);
        }, (generation: number): string => `recovery-scroll:${generation}`);
      } else { this.noticeBody(); }
    }
  }

  @Builder
  private noticeBody() {
      Stack({ alignContent: Alignment.BottomEnd }) {
        Column() {
          Text() {
            Span(` ${this.tag} `).fontSize(MESSAGE_META.fontSizeFp)
              .textBackgroundStyle({ color: readerAppColor('TOK_MESSAGE_TAG', this.appThemeScheme), radius: 4 });
            Span(`  ${this.view.message}`);
            // Native text layout carries a nonbreaking space group the width
            // of the actions. The action overlay ends at the trailing edge of
            // that final line, so short/long titles share the same flow.
            if (!this.separateActions && (!this.clipped || this.expanded)) {
              Span(this.reservedSpace);
            }
          }
          .width('100%').fontFamily(MESSAGE_NOTICE_TITLE.fontFamily)
          .fontWeight(MESSAGE_NOTICE_TITLE.fontWeight).fontSize(MESSAGE_NOTICE_TITLE.fontSizeFp)
          .lineHeight(MESSAGE_NOTICE_TITLE.lineHeightFp as number)
          .fontColor(readerAppColor('TOK_MESSAGE_NOTICE_INK', this.appThemeScheme))
          .wordBreak(WordBreak.BREAK_WORD).maxLines(this.expanded ? 10000 : 3)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
          .onAreaChange(this.flowAreaHandler());
          if (this.hasNoticeActions()) {
            if (this.separateActions || (this.clipped && !this.expanded)) { Blank().height(this.actionsHeight + 8); }
            else { Blank().height(Math.max(0, this.actionsHeight - this.titleLineHeight)); }
          }
        }.width('100%').constraintSize({ minHeight: 36 }).justifyContent(FlexAlign.Center);
        Flex({ justifyContent: FlexAlign.End, wrap: FlexWrap.Wrap,
          space: { main: LengthMetrics.vp(18), cross: LengthMetrics.vp(6) } }) {
          if ((this.view.canRetry || this.busy || this.secondaryBusy || this.retainPrimaryAction) && this.actionLabel.length > 0) {
            ReaderRecoveryAction({ variant: 'notice', label: this.actionLabel, generation: this.view.generation,
              isBusy: this.busy, actionEnabled: this.actionEnabled && !this.busy && !this.secondaryBusy,
              onReconcile: this.onReconcile });
          }
          if (this.secondaryActionLabel.length > 0) {
            ReaderRecoveryAction({ variant: 'notice', label: this.secondaryActionLabel, generation: this.view.generation,
              isBusy: this.secondaryBusy, actionEnabled: this.secondaryActionEnabled && !this.busy && !this.secondaryBusy,
              onReconcile: this.onSecondaryAction });
          }
          if (this.clipped) {
            ReaderRecoveryAction({ variant: 'notice', label: this.expanded ? '收起' : '展开',
              generation: this.view.generation,
              onReconcile: (generation: number): void => {
                if (this.view.visible && this.clipped && generation === this.view.generation) this.expanded = !this.expanded;
              } });
          }
        }.constraintSize({ maxWidth: '100%' }).width(this.actionsWidth > 0 ? this.actionsWidth : undefined)
          .onAreaChange(this.actionsAreaHandler());
      }
      .width('100%')
      .margin({ top: this.grouped && this.follows ? 10 : 0 })
      .padding({ left: this.grouped ? 0 : 12, right: this.grouped ? 0 : 12,
        top: this.grouped ? (this.follows ? 10 : 0) : 10, bottom: this.grouped ? 0 : 10 })
      .border({ width: { top: this.grouped && this.follows ? 1 : 0 },
        color: readerAppColor('TOK_MESSAGE_NOTICE_DIVIDER', this.appThemeScheme), style: BorderStyle.Solid })
      .borderRadius(this.grouped ? 0 : 14)
      .backgroundColor(this.grouped ? Color.Transparent : readerAppColor('TOK_MESSAGE_NOTICE', this.appThemeScheme))
      .shadow({ radius: this.grouped ? 0 : 16, offsetY: this.grouped ? 0 : 4, color: '#18000000' })
      .hitTestBehavior(HitTestMode.Default);
  }

  private hasNoticeActions(): boolean {
    return ((this.view.canRetry || this.busy || this.secondaryBusy || this.retainPrimaryAction) && this.actionLabel.length > 0) ||
      this.secondaryActionLabel.length > 0 || this.clipped;
  }

  private measurementIdentity(): string {
    return JSON.stringify([this.appearanceEpoch, this.view.generation, this.view.message, this.view.visible, this.view.canRetry,
      this.tag, this.actionLabel, this.secondaryActionLabel, this.busy, this.secondaryBusy, this.retainPrimaryAction,
      this.maxHeightVp, this.layoutWidthVp, this.readerWindowMetricsRevision]);
  }

  private flowAreaHandler(): (_old: Area, next: Area) => void {
    const identity = this.measurementIdentity();
    return (_old: Area, next: Area): void => {
      if (this.mounted && identity === this.measurementIdentity()) this.measureFlow(Number(next.width));
    };
  }

  private actionsAreaHandler(): (_old: Area, next: Area) => void {
    const identity = this.measurementIdentity();
    return (_old: Area, next: Area): void => {
      if (!this.mounted || identity !== this.measurementIdentity()) return;
      const height = Number(next.height);
      if (Number.isFinite(height) && height >= 0) this.actionsHeight = height;
    };
  }

  private remeasure(): void { if (this.mounted) this.measureFlow(this.measuredWidth); }

  private measureFlow(width: number): void {
    if (this.measuredGeneration !== this.view.generation) {
      this.measuredGeneration = this.view.generation;
      this.expanded = false;
    }
    if (!Number.isFinite(width) || width <= 0) return;
    this.measuredWidth = width;
    try {
      const context = this.getUIContext();
      const utils = context.getMeasureUtils();
      const labelWidth = (label: string): number => Math.max(44, context.px2vp(utils.measureText({ textContent: label,
        fontSize: `${MESSAGE_ACTION.fontSizeFp}fp`, fontFamily: MESSAGE_ACTION.fontFamily,
        fontWeight: MESSAGE_ACTION.fontWeight })) + 4);
      const widths: number[] = [];
      if ((this.view.canRetry || this.busy || this.secondaryBusy || this.retainPrimaryAction) && this.actionLabel.length > 0) widths.push(labelWidth(this.actionLabel));
      if (this.secondaryActionLabel.length > 0) widths.push(labelWidth(this.secondaryActionLabel));
      const space = context.px2vp(utils.measureText({ textContent: ' ', fontSize: '14fp',
        fontFamily: MESSAGE_NOTICE_TITLE.fontFamily, fontWeight: 400 }));
      const options: MeasureOptions = { textContent: ` ${this.tag}   ${this.view.message}`,
        fontFamily: MESSAGE_NOTICE_TITLE.fontFamily, fontSize: '14fp', fontWeight: 400,
        lineHeight: '22fp', constraintWidth: `${width}vp`, wordBreak: WordBreak.BREAK_WORD };
      // Folding belongs to the business title alone. Decorative action space
      // must never manufacture an expand action for an otherwise fitting title.
      const full = Number(utils.measureTextSize(options).height);
      options.maxLines = 3;
      const folded = Number(utils.measureTextSize(options).height);
      this.clipped = full > folded + .5;
      if (this.clipped) widths.push(Math.max(labelWidth('展开'), labelWidth('收起')));
      const actions = widths.reduce((total: number, item: number): number => total + item, 0) + Math.max(0, widths.length - 1) * 18;
      this.separateActions = actions + 8 > width;
      this.actionsWidth = Math.min(Math.max(0, width - (this.separateActions ? 8 : 0)), actions);
      // A multi-row action group gets its own natural block. Single-row groups
      // reserve their complete hit widths, coarse-pointer gaps and text gap.
      const reservationWidth = this.separateActions || actions === 0 ? 0 : Math.min(width, this.actionsWidth + 8);
      this.reservedSpace = reservationWidth > 0 && space > 0 ? ' ' + ' '.repeat(Math.ceil(reservationWidth / space)) : '';
      this.titleLineHeight = context.px2vp(Number(utils.measureTextSize({ textContent: '字', fontSize: '14fp',
        fontFamily: MESSAGE_NOTICE_TITLE.fontFamily, fontWeight: 400, lineHeight: '22fp' }).height));

    } catch (_) {
      // The full original message remains available if native measurement is
      // unavailable. Never hide an operation or guess its completion state.
      this.expanded = true;
      this.clipped = false;
      this.actionsWidth = Math.max(0, width - 8);
      this.separateActions = true;
      this.reservedSpace = '';
    }
  }
}
