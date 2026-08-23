import {
  cancelReaderPagePan,
  createReaderPageGestureState,
  finishReaderPagePan,
  readerPageTapIntent,
  startReaderPagePan,
  updateReaderPagePan,
  type ReaderPageGestureState,
  type ReaderPageGestureDecision,
  type ReaderPageTurnDirection,
  type ReaderPageTurnOutcome,
} from './ReaderPageGestureState';

const READER_PAGE_PAN_DISTANCE = 12;

/**
 * The single pointer owner above the reading page-turn stage.
 *
 * Pan MOVE only updates transient gesture state. A pagination request is
 * emitted once, on a valid end; the owner decides whether a measured neighbour
 * slides or the existing committed fallback runs without animation.
 */
@Component
export struct ReaderPageInteractionLayer {
  @Prop @Watch('onInteractionEnabledChanged') interactionEnabled: boolean = true;
  @Prop viewportWidth: number = 0;
  @Prop allowTextSelection: boolean = false;

  onTurn: (direction: ReaderPageTurnDirection) => ReaderPageTurnOutcome =
    (_direction: ReaderPageTurnDirection): ReaderPageTurnOutcome => ({ kind: 'busy' });
  onOpenControl: () => void = (): void => {};
  onManualInteraction: () => void = (): void => {};
  onGestureStateChange: (state: ReaderPageGestureState) => void =
    (_state: ReaderPageGestureState): void => {};
  onGestureDecision: (decision: ReaderPageGestureDecision) => void =
    (_decision: ReaderPageGestureDecision): void => {};

  private gestureState: ReaderPageGestureState = createReaderPageGestureState();

  build() {
    Row()
      .width('100%')
      .height('100%')
      .backgroundColor('#00000000')
      .hitTestBehavior(this.interactionEnabled ?
        (this.allowTextSelection ? HitTestMode.Transparent : HitTestMode.Block) : HitTestMode.None)
      .accessibilityText('阅读翻页区域')
      .accessibilityTextHint('左侧上一页，中间打开阅读控制，右侧下一页')
      .gesture(
        GestureGroup(
          GestureMode.Exclusive,
          PanGesture({
            fingers: 1,
            direction: PanDirection.Horizontal,
            distance: READER_PAGE_PAN_DISTANCE,
          })
            .onActionStart((event: GestureEvent): void =>
              this.startPan(event.offsetX, event.offsetY))
            .onActionUpdate((event: GestureEvent): void =>
              this.updatePan(event.offsetX, event.offsetY, event.velocityX))
            .onActionEnd((event: GestureEvent): void =>
              this.finishPan(event.offsetX, event.offsetY, event.velocityX))
            .onActionCancel((): void => this.cancelPan()),
          TapGesture({ fingers: 1, count: 1 })
            .onAction((event: GestureEvent): void => this.handleTap(event)),
        ),
      );
  }

  private startPan(offsetX: number, offsetY: number): void {
    if (!this.interactionEnabled) {
      this.cancelPan();
      return;
    }
    this.gestureState = startReaderPagePan(offsetX, this.viewportWidth, offsetY);
    this.onGestureStateChange(this.gestureState);
    this.onManualInteraction();
  }

  private updatePan(offsetX: number, offsetY: number, velocityX: number): void {
    if (!this.interactionEnabled) {
      this.cancelPan();
      return;
    }
    this.gestureState = updateReaderPagePan(this.gestureState, offsetX, offsetY, velocityX);
    this.onGestureStateChange(this.gestureState);
  }

  private finishPan(offsetX: number, offsetY: number, velocityX: number): void {
    if (!this.interactionEnabled) {
      this.cancelPan();
      return;
    }
    const decision = finishReaderPagePan(this.gestureState, offsetX, offsetY, velocityX);
    this.gestureState = decision.state;
    this.onGestureStateChange(this.gestureState);
    this.onGestureDecision(decision);
    if (decision.direction !== undefined) {
      this.onTurn(decision.direction);
    }
  }

  private cancelPan(): void {
    const cancelled = cancelReaderPagePan(this.gestureState);
    if (cancelled === this.gestureState) {
      return;
    }
    this.gestureState = cancelled;
    this.onGestureStateChange(this.gestureState);
  }

  private handleTap(event: GestureEvent): void {
    if (!this.interactionEnabled || event.fingerList.length === 0) {
      return;
    }
    const localX = event.fingerList[0].localX;
    const intent = readerPageTapIntent(localX, this.eventViewportWidth(event));
    if (intent === undefined) {
      return;
    }
    this.onManualInteraction();
    if (intent === 'control') {
      this.onOpenControl();
      return;
    }
    this.onTurn(intent);
  }

  private eventViewportWidth(event: GestureEvent): number {
    const targetWidth = event.target.area.width;
    if (typeof targetWidth === 'number') {
      return Number.isFinite(targetWidth) && targetWidth > 0 ? targetWidth : this.viewportWidth;
    }
    if (typeof targetWidth === 'string') {
      const parsed = Number.parseFloat(targetWidth);
      if (Number.isFinite(parsed) && parsed > 0) {
        return parsed;
      }
    }
    return this.viewportWidth;
  }

  private onInteractionEnabledChanged(): void {
    if (!this.interactionEnabled) {
      this.cancelPan();
    }
  }
}
