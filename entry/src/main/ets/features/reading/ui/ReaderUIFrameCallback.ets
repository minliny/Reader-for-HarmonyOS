import { FrameCallback } from '@kit.ArkUI';

export class ReaderUIFrameCallback extends FrameCallback {
  private readonly callback: (frameTimeNs: number) => void;

  constructor(callback: (frameTimeNs: number) => void) {
    super();
    this.callback = callback;
  }

  onFrame(frameTimeNs: number): void {
    this.callback(frameTimeNs);
  }

  onIdle(_timeLeftInNano: number): void {}
}
