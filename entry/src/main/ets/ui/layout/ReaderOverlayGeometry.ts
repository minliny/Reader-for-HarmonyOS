import { ReaderInsetsVp, ReaderRectVp, readerInteractiveSafeInsets, type ReaderWindowMetricsSnapshot }
  from '../foundation/ReaderWindowMetrics';
import { readerKeyboardViewport } from './ReaderKeyboardGeometry';
import { readerScaledBarHeight, readerScaledControlHeight } from '../foundation/ReaderSurfaceResolvers';

export type ReaderOverlayPlacement = 'center' | 'bottom' | 'anchor-start' | 'anchor-end' |
  'anchor-overlap-start' | 'anchor-overlap-end';

function finite(value: number): number { return Number.isFinite(value) ? value : 0; }
function size(value: number): number { return Math.max(0, finite(value)); }
function clamp(value: number, min: number, max: number): number { return Math.max(min, Math.min(max, finite(value))); }

/** Intersect the existing host with the window's interactive safe edges and keyboard lane in window-local vp. */
export function readerOverlayViewport(metrics: ReaderWindowMetricsSnapshot, host?: ReaderRectVp, margins?: ReaderInsetsVp,
  keyboardAnchor?: ReaderRectVp): ReaderRectVp {
  const windowWidth = size(metrics.windowRect.width);
  const windowHeight = size(metrics.windowRect.height);
  const safe = readerInteractiveSafeInsets(metrics);
  const left = clamp(Math.max(finite(host?.left ?? 0), safe.left), 0, windowWidth);
  const right = clamp(Math.min(host === undefined ? windowWidth : finite(host.left) + size(host.width),
    windowWidth - safe.right), left, windowWidth);
  const verticalHost = new ReaderRectVp(left, finite(host?.top ?? 0), right - left,
    host === undefined ? windowHeight : size(host.height));
  const lane = readerKeyboardViewport(metrics, verticalHost, keyboardAnchor).rect;
  const top = clamp(lane.top, 0, windowHeight);
  const bottom = clamp(lane.top + lane.height, top, windowHeight);
  const marginLeft = Math.min(right - left, size(margins?.left ?? 0));
  const marginTop = Math.min(bottom - top, size(margins?.top ?? 0));
  return new ReaderRectVp(left + marginLeft, top + marginTop,
    Math.max(0, right - left - marginLeft - size(margins?.right ?? 0)),
    Math.max(0, bottom - top - marginTop - size(margins?.bottom ?? 0)));
}

/** Keep an anchored surface next to its trigger, moving its row area into a scroll box if needed. */
export function readerOverlayPanel(viewport: ReaderRectVp, preferredWidth: number, preferredHeight: number,
  placement: ReaderOverlayPlacement, anchor?: ReaderRectVp, gap: number = 0): ReaderRectVp {
  const width = Math.min(size(preferredWidth), size(viewport.width));
  const height = Math.min(size(preferredHeight), size(viewport.height));
  const right = viewport.left + size(viewport.width);
  const bottom = viewport.top + size(viewport.height);
  if (placement === 'center' || placement === 'bottom' || anchor === undefined) {
    return new ReaderRectVp(viewport.left + (size(viewport.width) - width) / 2,
      placement === 'bottom' ? bottom - height : viewport.top + (size(viewport.height) - height) / 2, width, height);
  }
  const alignEnd = placement === 'anchor-end' || placement === 'anchor-overlap-end';
  const requestedLeft = alignEnd ? anchor.left + size(anchor.width) - width : anchor.left;
  const left = clamp(requestedLeft, viewport.left, right - width);
  if (placement === 'anchor-overlap-start' || placement === 'anchor-overlap-end') {
    return new ReaderRectVp(left, clamp(anchor.top, viewport.top, bottom - height), width, height);
  }
  const below = clamp(anchor.top + size(anchor.height) + finite(gap), viewport.top, bottom);
  const above = clamp(anchor.top - finite(gap), viewport.top, bottom);
  const belowHeight = bottom - below;
  const aboveHeight = above - viewport.top;
  if (height <= belowHeight || belowHeight >= aboveHeight) {
    return new ReaderRectVp(left, below, width, Math.min(height, belowHeight));
  }
  const abovePanelHeight = Math.min(height, aboveHeight);
  return new ReaderRectVp(left, above - abovePanelHeight, width, abovePanelHeight);
}

export function readerOverlayListHeight(headerHeight: number, rowHeight: number, rowCount: number, rowGap: number,
  paddingTop: number, paddingBottom: number, borderWidth: number, footerHeight: number): number {
  const count = Math.floor(size(rowCount));
  return size(headerHeight) + size(rowHeight) * count + size(rowGap) * Math.max(0, count - 1) +
    size(paddingTop) + size(paddingBottom) + 2 * size(borderWidth) + size(footerHeight);
}

export function readerOverlayChoiceRowHeight(baseHeight: number, lineHeight: number, fontScale: number,
  verticalPadding: number = 0): number {
  return Math.max(readerScaledControlHeight(baseHeight, lineHeight, fontScale),
    readerScaledBarHeight(baseHeight, lineHeight, fontScale, verticalPadding));
}
