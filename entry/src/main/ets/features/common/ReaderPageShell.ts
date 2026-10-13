/** Ordinary app-page and fixed-header categories. Visual variants remain
 * explicit; this module only owns their shared layout/surface contract. */
export type ReaderPageShellKind = 'standard' | 'mainTab' | 'settings' | 'detail' | 'directory' | 'search' | 'selection';
export type ReaderHeaderKind = 'standard' | 'home' | 'floating' | 'mangaDirectory' | 'selection' | 'search' | 'rss' | 'directoryTools';
export type ReaderHeaderSurface = 'solid' | 'transparent';

/** Index already consumes the system/cutout safe area. Ordinary page content
 * therefore needs only its local fixed header/tools clearance. */
export function readerPageContentStartInset(headerHeight: number = 58, toolsHeight: number = 0, gap: number = 0): number {
  return Math.max(0, headerHeight) + Math.max(0, toolsHeight) + Math.max(0, gap);
}

/** Shared root frame contract. Existing page owners retain their theme
 * background; this modifier supplies the common clipping/layer boundary. */
export class ReaderPageFrameModifier implements AttributeModifier<CommonAttribute> {
  private readonly scheme: string;
  constructor(scheme: string) { this.scheme = scheme; }
  applyNormalAttribute(instance: CommonAttribute): void {
    instance.clip(true).zIndex(0);
  }
}

/** Shared fixed-header contract. PageBackBar/AppTopBar and approved private
 * Search/RSS/selection headers keep their own visual variants and controls;
 * this modifier supplies the common surface, clipping and stacking behavior. */
export class ReaderHeaderFrameModifier implements AttributeModifier<CommonAttribute> {
  private readonly kind: ReaderHeaderKind;
  private readonly surface: ReaderHeaderSurface;
  private readonly scheme: string;
  constructor(kind: ReaderHeaderKind, surface: ReaderHeaderSurface, scheme: string) {
    this.kind = kind; this.surface = surface; this.scheme = scheme;
  }
  applyNormalAttribute(instance: CommonAttribute): void {
    if (this.kind === 'floating' || this.kind === 'mangaDirectory') {
      instance.zIndex(10);
      return;
    }
    if (this.kind === 'directoryTools') {
      instance.clip(true).zIndex(1);
      return;
    }
    instance.clip(true).zIndex(10);
  }
}
