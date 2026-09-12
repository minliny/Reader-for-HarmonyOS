import { TOK_BORDER_W, TOK_LINE, TOK_READ_INK, TOK_READ_MUTED } from '../common/ReaderTokens';

/** Shared timer input surface; owners keep their existing range/commit rules.
 * TTS uses five visible rows, AutoPage three. No timer or animation is owned here.
 */
@Component
export struct ReaderControlTimerWheel {
  @Prop value: number = 0;
  @Prop minimum: number = 0;
  @Prop maximum: number = 59;
  @Prop wheelWidth: number = 76;
  @Prop rowHeight: number = 34;
  @Prop neighbours: number = 1;
  @Prop selectedSize: number = 17;
  @Prop neighbourSize: number = 11;
  @Prop unit: string = '秒';
  @Prop interactionEnabled: boolean = true;
  onStep: (delta: number) => void = (_delta: number): void => {};

  private offsets(): number[] { return this.neighbours === 2 ? [-2, -1, 0, 1, 2] : [-1, 0, 1]; }
  private valid(delta: number): boolean { return this.value + delta >= this.minimum && this.value + delta <= this.maximum; }
  private label(delta: number): string {
    if (!this.valid(delta)) return '';
    const value = Math.trunc(this.value + delta);
    return value < 10 ? `0${value}` : `${value}`;
  }
  private step(delta: number): void {
    if (this.interactionEnabled && delta !== 0 && this.valid(delta)) this.onStep(delta);
  }

  build() {
    Column({ space: 4 }) {
      Stack({ alignContent: Alignment.TopStart }) {
        ForEach(this.offsets(), (delta: number) => {
          Text(this.label(delta)).width(this.wheelWidth).height(this.rowHeight)
            .fontFamily('ReaderInter').fontWeight(delta === 0 ? 800 : 600)
            .fontSize(delta === 0 ? this.selectedSize : this.neighbourSize)
            .fontColor(delta === 0 ? TOK_READ_INK : TOK_READ_MUTED)
            .opacity(delta === 0 ? 1 : (Math.abs(delta) === 2 ? 0.2 : 0.56))
            .textAlign(TextAlign.Center)
            .position({ x: 0, y: (delta + this.neighbours) * this.rowHeight })
            .accessibilityText(this.valid(delta) ? `${this.unit}，${this.value + delta}` : '')
            .enabled(this.interactionEnabled && delta !== 0 && this.valid(delta))
            .onClick((): void => this.step(delta));
        }, (delta: number): string => `timer-wheel-${delta}`);
        Row().width(this.wheelWidth).height(this.rowHeight)
          .border({ width: { top: TOK_BORDER_W, bottom: TOK_BORDER_W }, color: TOK_LINE })
          .position({ x: 0, y: this.neighbours * this.rowHeight }).hitTestBehavior(HitTestMode.None);
      }.width(this.wheelWidth).height(this.rowHeight * (this.neighbours * 2 + 1)).clip(true);
      Text(this.unit).width(this.wheelWidth).height(8).fontFamily('ReaderInter')
        .fontWeight(FontWeight.Bold).fontSize(8).fontColor(TOK_READ_MUTED).textAlign(TextAlign.Center);
    }.width(this.wheelWidth).alignItems(HorizontalAlign.Center);
  }
}
