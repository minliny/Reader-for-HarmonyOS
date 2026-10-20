import type { UIContext } from '@ohos.arkui.UIContext';

export interface ReaderTransientFeedbackOptions {
  message: string;
  duration?: 2000 | 2200;
  key?: string;
  dedupeMs?: number;
}

/** One mounted host's short feedback. Domain owners retain completion, retry
 * and navigation authority. This adapter neither queues nor persists work. */
export class ReaderTransientFeedback {
  private lastKey: string = '';
  private lastShownAt: number = -1;

  show(context: () => UIContext, options: ReaderTransientFeedbackOptions, isCurrent: () => boolean): boolean {
    try {
      if (AppStorage.get<boolean>('readerAppForeground') === false ||
        !isCurrent() || options.message.trim().length === 0) return false;
      const now = Date.now();
      const key = options.key ?? options.message;
      const dedupeMs = options.dedupeMs ?? 2000;
      if (this.lastKey === key && now >= this.lastShownAt && now - this.lastShownAt < dedupeMs) return false;
      // Resolve UIContext inside this boundary: an unavailable surface must
      // never turn a successful domain operation into a reported failure.
      const ui = context();
      if (AppStorage.get<boolean>('readerAppForeground') === false || !isCurrent()) return false;
      ui.getPromptAction().showToast({ message: options.message, duration: options.duration ?? 2000 });
      this.lastKey = key;
      this.lastShownAt = now;
      return true;
    } catch (_) {
      return false;
    }
  }

  reset(): void {
    this.lastKey = '';
    this.lastShownAt = -1;
  }
}
