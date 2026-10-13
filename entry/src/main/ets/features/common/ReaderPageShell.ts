import { readerAppColor } from './ReaderThemeRegistry';
import { mangaDirectoryColor } from '../manga/MangaDirectoryVisual';
import { ReaderWindowMetricsSnapshot, readerVisualSafeLeft, readerVisualSafeRight } from './ReaderWindowMetrics';
import { SurfaceHorizontalFrame, SurfaceWidthSpec, resolveHorizontalFrame } from './SurfaceHorizontalGeometry';
import { readerFloatingBarBottomInset, readerFloatingTabContentInset } from './ReaderFloatingBarMetrics';

/** Finite production categories; state and native scroll owners stay with pages. */
export type ReaderPageShellKind = 'standard' | 'mainTab' | 'settings' | 'detail' | 'mangaDetail' | 'directory' | 'readerDirectory' | 'mangaDirectory' | 'search' | 'selection' | 'download' | 'reader';
export type ReaderHeaderKind = 'standard' | 'home' | 'floating' | 'mangaDirectory' | 'selection' | 'search' | 'rss' | 'directoryTools' | 'download' | 'reader';
export type ReaderHeaderSurface = 'solid' | 'transparent';
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
export function readerPageContentStartInset(headerHeight: number = 58, toolsHeight: number = 0, gap: number = 0): number {
  return Math.max(0, headerHeight) + Math.max(0, toolsHeight) + Math.max(0, gap);
}

/** ArkUI Area reports numeric vp or a vp Length string. Keep the platform
 * conversion shared so a narrow measured host never falls back to window width. */
export function readerPageAreaLength(value: Length): number {
  return typeof value === 'number' ? value : typeof value === 'string' ? Number.parseFloat(value) : Number.NaN;
}

/** First-layout fallback only; subsequent clearance uses native measurement. */
export function readerPageInitialHeaderHeight(kind: 'standard' | 'home' | 'bookshelf'): number {
  switch (kind) {
    case 'bookshelf': return 60;
    case 'standard':
    case 'home': return 58;
    default: throw new Error('Unknown Reader initial header kind');
  }
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
  private readonly scheme: string;
  private readonly kind: ReaderPageShellKind;
  private readonly readingUnderlayColor: string;
  constructor(scheme: string, kind: ReaderPageShellKind = 'standard', readingUnderlayColor: string = '') {
    this.scheme = scheme; this.kind = kind; this.readingUnderlayColor = readingUnderlayColor;
  }
  applyNormalAttribute(instance: CommonAttribute): void {
    if (this.kind === 'reader' || this.kind === 'readerDirectory') {
      instance.clip(this.kind === 'readerDirectory').backgroundColor(this.readingUnderlayColor.length > 0 ? this.readingUnderlayColor : Color.Transparent).zIndex(0); return;
    }
    instance.clip(true).zIndex(0);
    if (this.kind === 'mangaDirectory' || this.kind === 'mangaDetail') {
      instance.backgroundColor(mangaDirectoryColor('paper', this.scheme));
    } else {
      instance.backgroundColor(readerAppColor(this.kind === 'download' ? 'TOK_DOWNLOAD_PAPER' : this.kind === 'directory' ? 'app.window.background' : 'TOK_PAPER', this.scheme));
    }
  }
}

/** Floating cards retain their bounded surface/shadow; ordinary fixed headers
 * receive the opaque surface here, including compound search/RSS/selection. */
export class ReaderHeaderFrameModifier implements AttributeModifier<CommonAttribute> {
  private readonly kind: ReaderHeaderKind;
  private readonly surface: ReaderHeaderSurface;
  private readonly scheme: string;
  constructor(kind: ReaderHeaderKind, surface: ReaderHeaderSurface, scheme: string) {
    this.kind = kind; this.surface = surface; this.scheme = scheme;
  }
  applyNormalAttribute(instance: CommonAttribute): void {
    if (this.kind === 'floating' || this.kind === 'mangaDirectory' || this.kind === 'reader') {
      instance.clip(false).backgroundColor(Color.Transparent).zIndex(10); return;
    }
    instance.clip(true).zIndex(10);
    if (this.surface === 'solid') instance.backgroundColor(readerAppColor(
      this.kind === 'standard' || this.kind === 'directoryTools' ? 'TOK_SURFACE_SOLID' : this.kind === 'download' ? 'TOK_DOWNLOAD_PAPER' : 'TOK_PAPER', this.scheme));
    else instance.backgroundColor(Color.Transparent);
  }
}
