export const ROW_PRESS_DELAY_MS: number = 90;
export const ROW_PRESS_RELEASE_MS: number = 110;
export const ROW_PRESS_SLOP_VP: number = 8;

export type ReaderRowPressTouchKind = 'down' | 'move' | 'up' | 'cancel';

/** Pure scroll-safe row press state machine shared by ArkUI rows and host tests.
 * Native click and the surrounding scroll owner keep their original input roles. */
export class ReaderRowPressMachine {
  private pointer: number = -1;
  private candidateKey: string = '';
  private pressedKey: string = '';
  private originX: number = 0;
  private originY: number = 0;
  private timer: number = -1;
  private readonly publish: (key: string) => void;

  constructor(publish: (key: string) => void) {
    this.publish = publish;
  }

  activePointer(): number {
    return this.pointer;
  }

  cancel(): void {
    if (this.timer >= 0) clearTimeout(this.timer);
    this.timer = -1;
    this.pointer = -1;
    this.candidateKey = '';
    this.show('');
  }

  /** True only on an admitted down. A moving list can observe it while
   * suppressing paint, for example to keep the row order stable under touch. */
  observe(
    kind: ReaderRowPressTouchKind,
    pointerId: number,
    windowX: number,
    windowY: number,
    touchCount: number,
    key: string,
    enabled: boolean,
    paint: boolean = true,
  ): boolean {
    if (!enabled || kind === 'cancel') {
      this.cancel();
      return false;
    }
    if (kind === 'down') {
      const primary = this.pointer < 0 && touchCount <= 1;
      this.cancel();
      if (!primary || pointerId < 0) return false;
      if (!paint) return true;
      this.candidateKey = key;
      this.pointer = pointerId;
      this.originX = windowX;
      this.originY = windowY;
      this.schedule((): void => this.show(key), ROW_PRESS_DELAY_MS);
      return true;
    }
    if (this.pointer < 0 || this.candidateKey !== key) return false;
    const moved = pointerId === this.pointer &&
      Math.hypot(windowX - this.originX, windowY - this.originY) > ROW_PRESS_SLOP_VP;
    if (touchCount > 1 || moved) {
      this.cancel();
    } else if (kind === 'up' && pointerId === this.pointer) {
      const quickTap = this.pressedKey.length === 0;
      this.cancel();
      if (quickTap) {
        this.show(key);
        this.schedule((): void => this.cancel(), ROW_PRESS_RELEASE_MS);
      }
    }
    return false;
  }

  private show(key: string): void {
    if (key === this.pressedKey) return;
    this.pressedKey = key;
    this.publish(key);
  }

  private schedule(action: () => void, delayMs: number): void {
    const timer = setTimeout((): void => {
      if (this.timer !== timer) return;
      this.timer = -1;
      action();
    }, delayMs);
    this.timer = timer;
  }
}
