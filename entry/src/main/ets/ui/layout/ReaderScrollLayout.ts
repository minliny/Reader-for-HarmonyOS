import type { ReaderPageGeometry } from './ReaderPageGeometry';

/** How a native scrollable consumes the resolved content insets. */
export type ReaderScrollInsetMode = 'padding' | 'contentOffset';

export class ReaderScrollLayout {
  readonly startInset: number;
  readonly endInset: number;
  readonly mode: ReaderScrollInsetMode;

  constructor(startInset: number, endInset: number, mode: ReaderScrollInsetMode) {
    this.startInset = Math.max(0, Number.isFinite(startInset) ? startInset : 0);
    this.endInset = Math.max(0, Number.isFinite(endInset) ? endInset : 0);
    this.mode = mode;
  }
}

export interface ReaderScrollLayoutOptions {
  mode?: ReaderScrollInsetMode;
  /** Additional scroll tail after the resolved geometry end inset. */
  extraEndInset?: number;
}

/** One scroll layout from page geometry. The native component still owns its
 * scrolling, anchors and item lifecycle; only the inset source is shared. */
export function readerScrollLayout(geometry: ReaderPageGeometry,
  options: ReaderScrollLayoutOptions = {}): ReaderScrollLayout {
  const endInset = geometry.content.endInset + Math.max(0, options.extraEndInset ?? 0);
  return new ReaderScrollLayout(geometry.content.startInset, endInset, options.mode ?? 'padding');
}

export function readerScrollTopPadding(layout: ReaderScrollLayout): number {
  return layout.mode === 'padding' ? layout.startInset : 0;
}

export function readerScrollBottomPadding(layout: ReaderScrollLayout): number {
  return layout.mode === 'padding' ? layout.endInset : 0;
}

export function readerScrollStartOffset(layout: ReaderScrollLayout): number {
  return layout.mode === 'contentOffset' ? layout.startInset : 0;
}

export function readerScrollEndOffset(layout: ReaderScrollLayout): number {
  return layout.mode === 'contentOffset' ? layout.endInset : 0;
}
