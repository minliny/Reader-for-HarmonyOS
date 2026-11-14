import { FrameCallback } from '@kit.ArkUI';
import type { UIContext } from '@ohos.arkui.UIContext';
import { readerMeasureSurfaceRect } from './ReaderSurfaceRectMeasurement';
import type { ReaderSurfaceRectIdentity } from './ReaderSurfaceRect';

let nextSlotId: number = 0;

class ReaderSlotMeasurementFrame extends FrameCallback {
  private readonly action: () => void;
  constructor(action: () => void) { super(); this.action = action; }
  onFrame(_time: number): void {}
  onIdle(_remaining: number): void { this.action(); }
}

/** One post-layout read per request. Area remains the producer for later changes. */
export class ReaderNativeSlotMeasurement {
  readonly id: string = `reader-native-slot:${++nextSlotId}`;
  private revision: number = 0;
  private context: UIContext | undefined = undefined;
  private receive: (height: number, key: number) => void = (_height: number, _key: number): void => {};

  mount(context: UIContext, key: number, receive: (height: number, key: number) => void): void {
    this.context = context;
    this.receive = receive;
    this.request(key);
  }

  unmount(): void {
    this.revision += 1;
    this.context = undefined;
  }

  private identity(): ReaderSurfaceRectIdentity {
    return { route: 'page-slot', owner: this.id, generation: this.revision };
  }

  request(key: number): void {
    const revision = ++this.revision;
    const context = this.context;
    if (context === undefined) return;
    const presented = this.identity();
    try {
      context.postFrameCallback(new ReaderSlotMeasurementFrame((): void => {
        if (context !== this.context || revision !== this.revision) return;
        const rect = readerMeasureSurfaceRect(context, this.id, this.id, presented, (): ReaderSurfaceRectIdentity => this.identity());
        if (rect !== undefined && context === this.context && revision === this.revision) this.receive(rect.height, key);
      }));
    } catch (_detached) {
      // A later Area event can still provide the current native fact.
    }
  }
}
