import { APP_HEADER_BAR_HEIGHT } from './ReaderHeaderMetrics';
import { ReaderWindowMetricsSnapshot, readerVisualSafeLeft, readerVisualSafeRight } from './ReaderWindowMetrics';
import { SurfaceHorizontalFrame, SurfaceWidthSpec, resolveHorizontalFrame } from './SurfaceHorizontalGeometry';
import { readerFloatingBarBottomInset, readerFloatingTabContentInset } from './ReaderFloatingBarMetrics';
import { ReaderFooterFrameStyle, ReaderFrameStyle, ReaderHeaderFrameStyle } from './ReaderFrameStyle';

export type ReaderFooterSurface = 'solid' | 'transparent';
export type ReaderStandardPageVariant = 'management' | 'settings' | 'rssManagement' | 'rssEditor' | 'rssFeed' | 'rssDetail' | 'tools' | 'sync' | 'sourceManagement' | 'settingsHome' | 'settingsGeneral';

export class ReaderStandardPageSpec {
  space: number;
  maxWidth: number;
  minimumBottom: number;
  constructor(space: number, maxWidth: number, minimumBottom: number) {
    this.space = space; this.maxWidth = maxWidth; this.minimumBottom = minimumBottom;
  }
}

export function readerStandardPageSpec(variant: ReaderStandardPageVariant): ReaderStandardPageSpec {
  switch (variant) {
    case 'settings': return new ReaderStandardPageSpec(0, 720, 16);
    case 'rssManagement': return new ReaderStandardPageSpec(0, 720, 24);
    case 'rssFeed': return new ReaderStandardPageSpec(8, 720, 24);
    case 'rssDetail': return new ReaderStandardPageSpec(12, 720, 8);
    case 'sync': return new ReaderStandardPageSpec(16, 720, 18);
    case 'sourceManagement': return new ReaderStandardPageSpec(8, 720, 12);
    case 'settingsHome':
    case 'settingsGeneral': return new ReaderStandardPageSpec(12, 720, 12);
    case 'management':
    case 'tools':
    case 'rssEditor': return new ReaderStandardPageSpec(16, Number.MAX_SAFE_INTEGER, 16);
    default: throw new Error('Unknown Reader standard page variant');
  }
}

/** Local scroll-content clearance: Index already consumes system/cutout top. */
export function readerPageContentStartInset(headerHeight: number = APP_HEADER_BAR_HEIGHT, toolsHeight: number = 0, gap: number = 0): number {
  return Math.max(0, headerHeight) + Math.max(0, toolsHeight) + Math.max(0, gap);
}

/** Vertical gap between the measured standard-page header and its content. */
export const READER_STANDARD_PAGE_CONTENT_GAP = 8;

export function readerStandardPageContentStart(headerHeight: number): number {
  return readerPageContentStartInset(headerHeight, 0, READER_STANDARD_PAGE_CONTENT_GAP);
}

/** Scaffold receipts report the header's own measured height; headerTop stays
 * a caller-owned margin. Use this when clearing from the scaffold's top edge. */
export function readerPresentedHeaderBottom(headerTop: number, headerHeight: number): number {
  return Math.max(0, headerTop) + Math.max(0, headerHeight);
}

/** ArkUI Area reports numeric vp or a vp Length string. Keep the platform
 * conversion shared so a narrow measured host never falls back to window width. */
export function readerPageAreaLength(value: Length): number {
  return typeof value === 'number' ? value : typeof value === 'string' ? Number.parseFloat(value) : Number.NaN;
}

export function readerStandardPageContentFrame(variant: ReaderStandardPageVariant, metrics: ReaderWindowMetricsSnapshot, width: number): SurfaceHorizontalFrame {
  return resolveHorizontalFrame(width, readerVisualSafeLeft(metrics), readerVisualSafeRight(metrics),
    new SurfaceWidthSpec(readerStandardPageSpec(variant).maxWidth, 19, 19));
}

export function readerStandardPageFooterBottom(variant: ReaderStandardPageVariant, metrics: ReaderWindowMetricsSnapshot): number {
  return variant === 'rssDetail' ? Math.max(0, readerFloatingBarBottomInset(metrics, 8) - 8) : 0;
}

export function readerStandardPageContentEndInset(variant: ReaderStandardPageVariant, metrics: ReaderWindowMetricsSnapshot, footerHeight: number = 0): number {
  if (variant === 'settingsHome') return readerFloatingTabContentInset(metrics);
  if (variant === 'rssDetail') return Math.max(62, footerHeight) + readerStandardPageFooterBottom(variant, metrics);
  return readerFloatingBarBottomInset(metrics, readerStandardPageSpec(variant).minimumBottom);
}

export class ReaderPageFrameModifier implements AttributeModifier<CommonAttribute> {
  private readonly style: ReaderFrameStyle;
  constructor(style: ReaderFrameStyle) { this.style = style; }
  applyNormalAttribute(instance: CommonAttribute): void {
    instance.clip(this.style.clip).backgroundColor(this.style.backgroundColor).zIndex(0);
  }
}

/** The feature owns the resolved header surface; the frame only applies it. */
export class ReaderHeaderFrameModifier implements AttributeModifier<CommonAttribute> {
  private readonly style: ReaderHeaderFrameStyle;
  constructor(style: ReaderHeaderFrameStyle) { this.style = style; }
  applyNormalAttribute(instance: CommonAttribute): void {
    instance.clip(this.style.clip).backgroundColor(this.style.backgroundColor).zIndex(10);
  }
}

/** A fixed dock masks the complete footer lane, including horizontal gutters
 * and bottom safe area. Floating/flowing footers keep their bounded card paint. */
export class ReaderFooterFrameModifier implements AttributeModifier<CommonAttribute> {
  private readonly style: ReaderFooterFrameStyle;
  constructor(style: ReaderFooterFrameStyle) { this.style = style; }
  applyNormalAttribute(instance: CommonAttribute): void {
    instance.clip(this.style.clip).backgroundColor(this.style.backgroundColor).zIndex(0);
  }
}
