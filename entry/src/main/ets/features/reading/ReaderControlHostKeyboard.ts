export interface ReaderControlKeyboardInsets {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface ReaderControlKeyboardMetrics {
  ready: boolean;
  keyboardInsets: ReaderControlKeyboardInsets;
}

export interface ReaderControlKeyboardHost {
  hideTextInput: () => Promise<void>;
  onFailure: (error: Error) => void;
}

function visibleInset(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

/** Actual TYPE_KEYBOARD window geometry, never the presence of input focus. */
export function readerControlKeyboardVisible(metrics: ReaderControlKeyboardMetrics): boolean {
  const insets = metrics.keyboardInsets;
  return metrics.ready && (visibleInset(insets.left) || visibleInset(insets.top) ||
    visibleInset(insets.right) || visibleInset(insets.bottom));
}

/** No business/session mutation or retries; all platform failure modes are caught. */
export function hideReaderControlKeyboard(host: ReaderControlKeyboardHost): void {
  try {
    void host.hideTextInput().catch((error: Error): void => host.onFailure(error));
  } catch (error) {
    host.onFailure(error as Error);
  }
}

/** Consume only this Back. The next Back uses a fresh window snapshot. */
export function consumeReaderControlKeyboardBack(metrics: ReaderControlKeyboardMetrics,
  host: ReaderControlKeyboardHost): boolean {
  if (!readerControlKeyboardVisible(metrics)) return false;
  hideReaderControlKeyboard(host);
  return true;
}
