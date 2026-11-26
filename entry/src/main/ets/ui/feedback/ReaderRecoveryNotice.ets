import { LengthMetrics } from '@kit.ArkUI';
import type { MeasureOptions } from '@ohos.measure';
import { MESSAGE_ACTION, MESSAGE_META, MESSAGE_NOTICE_TITLE } from '../foundation/ReaderMessageStyle';
import { readerAppColor } from '../foundation/ReaderThemeRegistry';
import { readerSurfaceElevation } from '../surfaces/ReaderSurfaceSpecs';
import { ReaderRecoveryAction } from './ReaderRecoveryAction';
import type { ReaderRecoveryView } from './ReaderRecoveryView';

export type ReaderRecoveryTextAction = 'reconcile' | 'continue' | 'expand';
export type ReaderRecoveryBodyPresentation = 'fits' | 'collapsed' | 'expanded';

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
  @Prop focusIdPrefix: string = '';
  @Prop titleId: string = '';
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
  textLayoutOptions: ((action: ReaderRecoveryTextAction, label: string) => TextOptions | undefined) | undefined = undefined;
  bodyTextLayoutOptions: ((generation: number, presentation: ReaderRecoveryBodyPresentation, prefix: string) =>
    TextOptions | undefined) | undefined = undefined;
  onReconcile: (generation: number) => void = (_generation: number): void => {};
  onSecondaryAction: (generation: number) => void = (_generation: number): void => {};
  onTitleMeasured: (generation: number, clipped: boolean | undefined) => void =
    (_generation: number, _clipped: boolean | undefined): void => {};
  onBodyExpansion: ((generation: number, expanded: boolean) => void) | undefined = undefined;

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
          Text(undefined, this.noticeBodyTextOptions()) {
            Span(` ${this.tag} `).fontSize(MESSAGE_META.fontSizeFp)
              .textBackgroundStyle({ color: readerAppColor('TOK_PRIMARY_SOFT', this.appThemeScheme), radius: 4 });
            Span(`  ${this.view.message}`);
            // Native text layout carries a nonbreaking space group the width
            // of the actions. The action overlay ends at the trailing edge of
            // that final line, so short/long titles share the same flow.
            if (!this.separateActions && (!this.clipped || this.expanded)) {
              Span(this.reservedSpace);
            }
          }
          .id(this.titleId).width('100%').fontFamily(MESSAGE_NOTICE_TITLE.fontFamily)
          .fontWeight(MESSAGE_NOTICE_TITLE.fontWeight).fontSize(MESSAGE_NOTICE_TITLE.fontSizeFp)
          .lineHeight(MESSAGE_NOTICE_TITLE.lineHeightFp as number)
          .fontColor(readerAppColor('TOK_INK', this.appThemeScheme))
          // A fitting business title may need one more native line for its
          // decorative action reservation. Folding still uses the title alone.
          .wordBreak(WordBreak.BREAK_WORD)
          .maxLines(this.expanded || (!this.clipped && this.reservedSpace.length > 0) ? 10000 : 3)
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
              focusId: this.focusId('reconcile'),
              textLayoutOptions: this.textLayoutOptions?.('reconcile', this.actionLabel),
              onReconcile: this.onReconcile });
          }
          if (this.secondaryActionLabel.length > 0) {
            ReaderRecoveryAction({ variant: 'notice', label: this.secondaryActionLabel, generation: this.view.generation,
              isBusy: this.secondaryBusy, actionEnabled: this.secondaryActionEnabled && !this.busy && !this.secondaryBusy,
              focusId: this.focusId('continue'),
              textLayoutOptions: this.textLayoutOptions?.('continue', this.secondaryActionLabel),
              onReconcile: this.onSecondaryAction });
          }
          if (this.clipped) {
            ReaderRecoveryAction({ variant: 'notice', label: this.expanded ? '收起' : '展开',
              generation: this.view.generation, focusId: this.focusId('expand'),
              textLayoutOptions: this.textLayoutOptions?.('expand', this.expanded ? '收起' : '展开'),
              onReconcile: (generation: number): void => {
                if (this.view.visible && this.clipped && generation === this.view.generation) {
                  this.expanded = !this.expanded;
                  this.onBodyExpansion?.(generation, this.expanded);
                }
              } });
          }
        }.constraintSize({ maxWidth: '100%' }).width(this.actionsWidth > 0 ? this.actionsWidth : undefined)
          .onAreaChange(this.actionsAreaHandler());
      }
      .id(this.focusId('recovery'))
      .width('100%')
      .margin({ top: this.grouped && this.follows ? 10 : 0 })
      .padding({ left: this.grouped ? 0 : 12, right: this.grouped ? 0 : 12,
        top: this.grouped ? (this.follows ? 10 : 0) : 10, bottom: this.grouped ? 0 : 10 })
      .border({ width: this.grouped ? { top: this.follows ? 1 : 0 } : 1,
        color: readerAppColor(this.grouped ? 'TOK_LINE' : 'TOK_PRIMARY_BORDER', this.appThemeScheme), style: BorderStyle.Solid })
      .borderRadius(this.grouped ? 0 : 14)
      .backgroundColor(this.grouped ? Color.Transparent : readerAppColor('TOK_SURFACE_ELEVATED', this.appThemeScheme))
      .shadow(readerSurfaceElevation(this.grouped ? 'embedded' : 'popover', this.appThemeScheme))
      .hitTestBehavior(HitTestMode.Default);
  }

  private focusId(part: string): string {
    return this.focusIdPrefix.length > 0 ? `${this.focusIdPrefix}-${part}` : '';
  }

  private noticeBodyTextOptions(): TextOptions | undefined {
    if (this.bodyTextLayoutOptions === undefined || this.view.message.length === 0) return undefined;
    const presentation: ReaderRecoveryBodyPresentation = this.clipped ? (this.expanded ? 'expanded' : 'collapsed') : 'fits';
    return this.bodyTextLayoutOptions(this.view.generation, presentation, ` ${this.tag}   ${this.view.message}`);
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
    let measuredClipping: boolean | undefined;
    try {
      const context = this.getUIContext();
      const utils = context.getMeasureUtils();
      const labelWidth = (label: string): number => Math.max(44, context.px2vp(utils.measureText({ textContent: label,
        fontSize: `${MESSAGE_ACTION.fontSizeFp}fp`, fontFamily: MESSAGE_ACTION.fontFamily,
        fontWeight: MESSAGE_ACTION.fontWeight })) + 4);
      const widths: number[] = [];
      if ((this.view.canRetry || this.busy || this.secondaryBusy || this.retainPrimaryAction) && this.actionLabel.length > 0) widths.push(labelWidth(this.actionLabel));
      if (this.secondaryActionLabel.length > 0) widths.push(labelWidth(this.secondaryActionLabel));
      const titleSize = `${MESSAGE_NOTICE_TITLE.fontSizeFp}fp`;
      const titleHeight = `${MESSAGE_NOTICE_TITLE.lineHeightFp}fp`;
      const space = context.px2vp(utils.measureText({ textContent: ' ', fontSize: titleSize,
        fontFamily: MESSAGE_NOTICE_TITLE.fontFamily, fontWeight: MESSAGE_NOTICE_TITLE.fontWeight }));
      const options: MeasureOptions = { textContent: ` ${this.tag}   ${this.view.message}`,
        fontFamily: MESSAGE_NOTICE_TITLE.fontFamily, fontSize: titleSize, fontWeight: MESSAGE_NOTICE_TITLE.fontWeight,
        lineHeight: titleHeight, constraintWidth: `${width}vp`, wordBreak: WordBreak.BREAK_WORD };
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
      this.titleLineHeight = context.px2vp(Number(utils.measureTextSize({ textContent: '字', fontSize: titleSize,
        fontFamily: MESSAGE_NOTICE_TITLE.fontFamily, fontWeight: MESSAGE_NOTICE_TITLE.fontWeight,
        lineHeight: titleHeight }).height));
      if (Number.isFinite(full) && Number.isFinite(folded) && full > 0 && folded > 0) measuredClipping = this.clipped;
    } catch (_) {
      // The full original message remains available if native measurement is
      // unavailable. Never hide an operation or guess its completion state.
      this.expanded = true;
      this.clipped = false;
      this.actionsWidth = Math.max(0, width - 8);
      this.separateActions = true;
      this.reservedSpace = '';
    }
    if (this.view.visible) this.onTitleMeasured(this.view.generation, measuredClipping);
  }
}
