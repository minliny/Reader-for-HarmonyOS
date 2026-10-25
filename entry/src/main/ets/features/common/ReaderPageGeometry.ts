import { readerPresentedHeaderBottom } from './ReaderPageShell';
import type { ReaderFooterSurface } from './ReaderPageShell';
import { createDefaultReaderWindowMetrics, readerVisualSafeLeft, readerVisualSafeRight } from './ReaderWindowMetrics';
import type { ReaderWindowMetricsSnapshot } from './ReaderWindowMetrics';
import { SurfaceHorizontalFrame, SurfaceWidthSpec, resolveHorizontalFrame } from './SurfaceHorizontalGeometry';
import type { SurfaceHorizontalAlignment } from './SurfaceHorizontalGeometry';
import { readerWidthClass } from './ReaderWidthClass';
import type { ReaderWidthClass } from './ReaderWidthClass';

function finiteNonNegative(value: number): number {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

function readableViewport(value: number, fallback: number): number {
  const resolved = Number.isFinite(value) && value > 0 ? value : fallback;
  return Number.isFinite(resolved) && resolved > 0 ? resolved : 0;
}

export class ReaderPageHeaderGeometry {
  top: number = 0;
  height: number = 0;
  bottom: number = 0;
  insetLeft: number = 0;
  insetRight: number = 0;
  clearance: number = 0;
}

export class ReaderPageFooterGeometry {
  height: number = 0;
  bottom: number = 0;
  top: number = 0;
  insetLeft: number = 0;
  insetRight: number = 0;
  surface: ReaderFooterSurface = 'transparent';
}

export class ReaderPageContentGeometry {
  frame: SurfaceHorizontalFrame = new SurfaceHorizontalFrame(0, 0, 0);
  startInset: number = 0;
  /** Tail budget inside a Scroll/List body. */
  endInset: number = 0;
  /** Native viewport clearance for bodies that cannot scroll past a footer. */
  nativeEndInset: number = 0;
}

export class ReaderPageGeometry {
  revision: number = 0;
  widthClass: ReaderWidthClass = 'compact';
  frameInsetLeft: number = 0;
  frameInsetRight: number = 0;
  header: ReaderPageHeaderGeometry = new ReaderPageHeaderGeometry();
  footer: ReaderPageFooterGeometry = new ReaderPageFooterGeometry();
  content: ReaderPageContentGeometry = new ReaderPageContentGeometry();
  chromeMode: 'overlay' | 'inline' = 'overlay';
}

/**
 * Page-owned design intents plus measured facts. Arithmetic belongs to the
 * resolver, not to individual page builders.
 */
export class ReaderPageGeometryInput {
  metrics: ReaderWindowMetricsSnapshot;
  viewportWidth: number = 0;
  viewportHeight: number = 0;
  measurementRevision: number = 0;
  headerHeight: number = 0;
  headerTop: number = 0;
  headerInsetLeft: number = 0;
  headerInsetRight: number = 0;
  footerHeight: number = 0;
  footerBottom: number = 0;
  footerInsetLeft: number = 0;
  footerInsetRight: number = 0;
  footerSurface: ReaderFooterSurface = 'transparent';
  contentGap: number = 0;
  contentEndInset: number = 0;
  contentNativeEndInset: number = 0;
  contentMaxWidth: number = Number.MAX_SAFE_INTEGER;
  contentHorizontalPadding: number = 0;
  /** Negative means "not authored"; the symmetric padding still applies. */
  contentLeftGap: number = -1;
  contentRightGap: number = -1;
  contentAlignment: SurfaceHorizontalAlignment = 'center';
  /** Navigation rail drawn inside the page viewport, ahead of the content. */
  contentLeadingRail: number = 0;
  frameInsetLeft: number = 0;
  frameInsetRight: number = 0;
  chromeMode: 'overlay' | 'inline' = 'overlay';

  constructor(metrics: ReaderWindowMetricsSnapshot = createDefaultReaderWindowMetrics()) {
    this.metrics = metrics;
  }
}

/** Explicit inert geometry for hosts that own their entire frame (reader shell,
 * font-preparation placeholders) and only need scaffold chrome. Call sites must
 * name this exception; it is never a hidden default. */
export function readerEmptyPageGeometry(): ReaderPageGeometry {
  return new ReaderPageGeometry();
}

export function resolveReaderPageGeometry(input: ReaderPageGeometryInput): ReaderPageGeometry {
  const geometry = new ReaderPageGeometry();
  const metrics = input.metrics;
  const viewportWidth = readableViewport(input.viewportWidth, metrics.windowRect.width);
  const viewportHeight = readableViewport(input.viewportHeight, metrics.windowRect.height);

  geometry.revision = Math.max(0, metrics.revision) * 100003 + Math.max(0, input.measurementRevision);
  geometry.widthClass = readerWidthClass(viewportWidth);
  geometry.frameInsetLeft = finiteNonNegative(input.frameInsetLeft);
  geometry.frameInsetRight = finiteNonNegative(input.frameInsetRight);
  geometry.chromeMode = input.chromeMode;

  const headerTop = finiteNonNegative(input.headerTop);
  geometry.header.top = headerTop;
  geometry.header.height = finiteNonNegative(input.headerHeight);
  geometry.header.bottom = readerPresentedHeaderBottom(headerTop, geometry.header.height);
  geometry.header.insetLeft = finiteNonNegative(input.headerInsetLeft);
  geometry.header.insetRight = finiteNonNegative(input.headerInsetRight);
  geometry.header.clearance = geometry.header.bottom + finiteNonNegative(input.contentGap);

  geometry.footer.height = finiteNonNegative(input.footerHeight);
  geometry.footer.bottom = finiteNonNegative(input.footerBottom);
  geometry.footer.insetLeft = finiteNonNegative(input.footerInsetLeft);
  geometry.footer.insetRight = finiteNonNegative(input.footerInsetRight);
  geometry.footer.surface = input.footerSurface;
  geometry.footer.top = Math.max(0, viewportHeight - geometry.footer.height - geometry.footer.bottom);

  const symmetricGap = finiteNonNegative(input.contentHorizontalPadding);
  const leftGap = input.contentLeftGap >= 0 ? finiteNonNegative(input.contentLeftGap) : symmetricGap;
  const rightGap = input.contentRightGap >= 0 ? finiteNonNegative(input.contentRightGap) : symmetricGap;
  const rail = Math.min(finiteNonNegative(input.contentLeadingRail), viewportWidth);
  const contentViewportWidth = viewportWidth - rail;
  geometry.content.frame = resolveHorizontalFrame(
    contentViewportWidth,
    Math.max(0, readerVisualSafeLeft(metrics) - rail),
    readerVisualSafeRight(metrics),
    new SurfaceWidthSpec(finiteNonNegative(input.contentMaxWidth), leftGap, rightGap, input.contentAlignment),
  );

  if (input.chromeMode === 'inline') {
    geometry.content.startInset = 0;
    geometry.content.endInset = 0;
    geometry.content.nativeEndInset = 0;
  } else {
    geometry.content.startInset = geometry.header.clearance;
    geometry.content.endInset = finiteNonNegative(input.contentEndInset);
    geometry.content.nativeEndInset = finiteNonNegative(input.contentNativeEndInset);
    if (input.footerSurface === 'solid') {
      geometry.content.endInset = Math.max(geometry.content.endInset,
        geometry.footer.height + geometry.footer.bottom);
      geometry.content.nativeEndInset = Math.max(geometry.content.nativeEndInset,
        geometry.footer.height + geometry.footer.bottom);
    }
  }
  return geometry;
}
