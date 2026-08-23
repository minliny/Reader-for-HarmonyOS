/**
 * Window facts normalized to ArkUI logical pixels (vp).
 *
 * The platform owner publishes one immutable snapshot. Feature components may
 * derive layout from it, but must never query Window APIs or mix px with vp.
 */
export class ReaderRectVp {
  left: number;
  top: number;
  width: number;
  height: number;

  constructor(left: number = 0, top: number = 0, width: number = 0, height: number = 0) {
    this.left = left;
    this.top = top;
    this.width = width;
    this.height = height;
  }
}

export class ReaderInsetsVp {
  left: number;
  top: number;
  right: number;
  bottom: number;

  constructor(left: number = 0, top: number = 0, right: number = 0, bottom: number = 0) {
    this.left = left;
    this.top = top;
    this.right = right;
    this.bottom = bottom;
  }
}

export class ReaderWindowMetricsSnapshot {
  windowRect: ReaderRectVp;
  globalRect: ReaderRectVp;
  systemInsets: ReaderInsetsVp;
  cutoutInsets: ReaderInsetsVp;
  gestureInsets: ReaderInsetsVp;
  navigationInsets: ReaderInsetsVp;
  keyboardInsets: ReaderInsetsVp;
  densityPixels: number;
  systemFontScale: number;
  revision: number;
  ready: boolean;

  constructor(
    windowRect: ReaderRectVp = new ReaderRectVp(),
    globalRect: ReaderRectVp = new ReaderRectVp(),
    systemInsets: ReaderInsetsVp = new ReaderInsetsVp(),
    cutoutInsets: ReaderInsetsVp = new ReaderInsetsVp(),
    gestureInsets: ReaderInsetsVp = new ReaderInsetsVp(),
    navigationInsets: ReaderInsetsVp = new ReaderInsetsVp(),
    keyboardInsets: ReaderInsetsVp = new ReaderInsetsVp(),
    densityPixels: number = 1,
    systemFontScale: number = 1,
    revision: number = 0,
    ready: boolean = false,
  ) {
    this.windowRect = windowRect;
    this.globalRect = globalRect;
    this.systemInsets = systemInsets;
    this.cutoutInsets = cutoutInsets;
    this.gestureInsets = gestureInsets;
    this.navigationInsets = navigationInsets;
    this.keyboardInsets = keyboardInsets;
    this.densityPixels = densityPixels;
    this.systemFontScale = systemFontScale;
    this.revision = revision;
    this.ready = ready;
  }
}

export function createDefaultReaderWindowMetrics(): ReaderWindowMetricsSnapshot {
  return new ReaderWindowMetricsSnapshot();
}

function finiteInset(value: number): number {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

/** Visual-safe edges exclude only pixels that cannot safely display content. */
export function readerVisualSafeLeft(metrics: ReaderWindowMetricsSnapshot): number {
  return Math.max(
    finiteInset(metrics.systemInsets.left),
    finiteInset(metrics.cutoutInsets.left),
  );
}

export function readerVisualSafeTop(metrics: ReaderWindowMetricsSnapshot): number {
  return Math.max(
    finiteInset(metrics.systemInsets.top),
    finiteInset(metrics.cutoutInsets.top),
  );
}

export function readerVisualSafeRight(metrics: ReaderWindowMetricsSnapshot): number {
  return Math.max(
    finiteInset(metrics.systemInsets.right),
    finiteInset(metrics.cutoutInsets.right),
  );
}

export function readerVisualSafeBottom(metrics: ReaderWindowMetricsSnapshot): number {
  return Math.max(
    finiteInset(metrics.systemInsets.bottom),
    finiteInset(metrics.cutoutInsets.bottom),
  );
}

export function readerVisualSafeInsets(metrics: ReaderWindowMetricsSnapshot): ReaderInsetsVp {
  return new ReaderInsetsVp(
    readerVisualSafeLeft(metrics),
    readerVisualSafeTop(metrics),
    readerVisualSafeRight(metrics),
    readerVisualSafeBottom(metrics),
  );
}

/** Interactive-safe edges also avoid gesture/navigation ownership. */
export function readerInteractiveSafeLeft(
  metrics: ReaderWindowMetricsSnapshot,
  includeKeyboard: boolean = false,
): number {
  return Math.max(
    readerVisualSafeLeft(metrics),
    finiteInset(metrics.gestureInsets.left),
    finiteInset(metrics.navigationInsets.left),
    includeKeyboard ? finiteInset(metrics.keyboardInsets.left) : 0,
  );
}

export function readerInteractiveSafeTop(
  metrics: ReaderWindowMetricsSnapshot,
  includeKeyboard: boolean = false,
): number {
  return Math.max(
    readerVisualSafeTop(metrics),
    finiteInset(metrics.gestureInsets.top),
    finiteInset(metrics.navigationInsets.top),
    includeKeyboard ? finiteInset(metrics.keyboardInsets.top) : 0,
  );
}

export function readerInteractiveSafeRight(
  metrics: ReaderWindowMetricsSnapshot,
  includeKeyboard: boolean = false,
): number {
  return Math.max(
    readerVisualSafeRight(metrics),
    finiteInset(metrics.gestureInsets.right),
    finiteInset(metrics.navigationInsets.right),
    includeKeyboard ? finiteInset(metrics.keyboardInsets.right) : 0,
  );
}

export function readerContentSafeTop(metrics: ReaderWindowMetricsSnapshot): number {
  return readerVisualSafeTop(metrics);
}

export function readerContentSafeHorizontal(metrics: ReaderWindowMetricsSnapshot): number {
  return Math.max(
    readerVisualSafeLeft(metrics),
    readerVisualSafeRight(metrics),
  );
}

export function readerInteractiveSafeBottom(
  metrics: ReaderWindowMetricsSnapshot,
  includeKeyboard: boolean = false,
): number {
  return Math.max(
    readerVisualSafeBottom(metrics),
    finiteInset(metrics.gestureInsets.bottom),
    finiteInset(metrics.navigationInsets.bottom),
    includeKeyboard ? finiteInset(metrics.keyboardInsets.bottom) : 0,
  );
}

export function readerInteractiveSafeInsets(
  metrics: ReaderWindowMetricsSnapshot,
  includeKeyboard: boolean = false,
): ReaderInsetsVp {
  return new ReaderInsetsVp(
    readerInteractiveSafeLeft(metrics, includeKeyboard),
    readerInteractiveSafeTop(metrics, includeKeyboard),
    readerInteractiveSafeRight(metrics, includeKeyboard),
    readerInteractiveSafeBottom(metrics, includeKeyboard),
  );
}
