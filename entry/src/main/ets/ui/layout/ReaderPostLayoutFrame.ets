import { FrameCallback } from '@kit.ArkUI';
import type { UIContext } from '@ohos.arkui.UIContext';

class ReaderPostLayoutFallbackFrame extends FrameCallback {
  private readonly action: () => void;

  constructor(action: () => void) {
    super();
    this.action = action;
  }

  onFrame(_time: number): void { this.action(); }
  onIdle(_remaining: number): void {}
}

/** Runs once after the first frame's layout, even when its idle phase is deferred. */
export class ReaderPostLayoutFrame extends FrameCallback {
  private readonly context: UIContext;
  private readonly action: () => void;
  private readonly started: (() => void) | undefined;
  private pending: boolean = true;
  private fallbackScheduled: boolean = false;

  constructor(context: UIContext, action: () => void, started?: () => void) {
    super();
    this.context = context;
    this.action = action;
    this.started = started;
  }

  onFrame(_time: number): void {
    if (!this.pending || this.fallbackScheduled) return;
    this.fallbackScheduled = true;
    try { this.started?.(); }
    catch (_diagnostic) {
      // Optional tracing cannot suppress the original layout continuation.
    }
    try {
      this.context.postFrameCallback(new ReaderPostLayoutFallbackFrame((): void => this.deliver()));
    } catch (_detached) {
      // A still-delivered idle phase can finish the original request.
    }
  }

  onIdle(_remaining: number): void { this.deliver(); }

  private deliver(): void {
    if (!this.pending) return;
    this.pending = false;
    this.action();
  }
}
