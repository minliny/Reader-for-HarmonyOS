import {
  cancelReaderPagePan,
  createReaderPageGestureState,
  finishReaderPagePan,
  readerPageTapIntent,
  startReaderPagePan,
  updateReaderPagePan,
  type ReaderPageGestureState,
  type ReaderPageTurnDirection,
  type ReaderPageTurnOutcome,
} from './ReaderPageGestureState';

const READER_PAGE_PAN_DISTANCE = 12;

/**
 * The single pointer owner above the no-animation reading surface.
 *
 * Pan MOVE only updates local transient state. A pagination request is emitted
 * once, on a valid end, so neither a cancelled gesture nor an in-flight busy
 * result can be replayed later.
 */
@Component
export struct ReaderPageInteractionLayer {
  @Prop @Watch('onInteractionEnabledChanged') interactionEnabled: boolean = true;
  @Prop viewportWidth: number = 0;

  onTurn: (direction: ReaderPageTurnDirection) => ReaderPageTurnOutcome =
    (_direction: ReaderPageTurnDirection): ReaderPageTurnOutcome => ({ kind: 'busy' });
  onOpenControl: () => void = (): void => {};
  onManualInteraction: () => void = (): void => {};

  private gestureState: ReaderPageGestureState = createReaderPageGestureState();

  build() {
    Row()
      .width('100%')
      .height('100%')
      .backgroundColor('#00000000')
      .hitTestBehavior(this.interactionEnabled ? HitTestMode.Block : HitTestMode.None)
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
            .onActionStart((event: GestureEvent): void => this.startPan(event.offsetX))
            .onActionUpdate((event: GestureEvent): void => this.updatePan(event.offsetX))
            .onActionEnd((event: GestureEvent): void => this.finishPan(event.offsetX))
            .onActionCancel((): void => this.cancelPan()),
          TapGesture({ fingers: 1, count: 1 })
            .onAction((event: GestureEvent): void => this.handleTap(event)),
        ),
      );
  }

  private startPan(offsetX: number): void {
    if (!this.interactionEnabled) {
      this.cancelPan();
      return;
    }
    this.gestureState = startReaderPagePan(offsetX);
    this.onManualInteraction();
  }

  private updatePan(offsetX: number): void {
    if (!this.interactionEnabled) {
      this.cancelPan();
      return;
    }
    this.gestureState = updateReaderPagePan(this.gestureState, offsetX);
  }

  private finishPan(offsetX: number): void {
    if (!this.interactionEnabled) {
      this.cancelPan();
      return;
    }
    const decision = finishReaderPagePan(this.gestureState, offsetX);
    this.gestureState = decision.state;
    if (decision.direction !== undefined) {
      this.onTurn(decision.direction);
    }
  }

  private cancelPan(): void {
    this.gestureState = cancelReaderPagePan(this.gestureState);
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
