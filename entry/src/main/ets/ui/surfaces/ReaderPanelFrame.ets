import { readerSurfaceElevation } from './ReaderSurfaceSpecs';
import { DIRECTORY_CHROME_VISUAL, mangaDirectoryColor } from '../foundation/ReaderDirectoryChromeVisual';
import { readerAppColor } from '../foundation/ReaderThemeRegistry';
import { TOK_BORDER_W, TOK_RADIUS_XL } from '../foundation/ReaderTokens';
import type { ReaderRaisedShape } from '../layout/ReaderRaisedShape';

export type ReaderPanelFrameId = 'reader' | 'reader-menu' | 'reader-card' | 'reader-full-card' | 'reader-soft-control' | 'floating-action-dock' |
  'reader-quick-fill' | 'reader-full-fill' | 'manga-toolbar' | 'manga-dock' |
  'manga-directory-sheet' | 'manga-directory-rail' | 'manga-chapter-end';

/** Paint the host's frame in place. Measurement, positioning, input and animation
 * stay with the existing owner, so a morph keeps the same native actors. */
export class ReaderPanelFrame implements AttributeModifier<CommonAttribute> {
  private readonly id: ReaderPanelFrameId;
  private readonly scheme: string;
  private readonly side: boolean;
  private readonly raisedShape: ReaderRaisedShape | undefined;
  constructor(id: ReaderPanelFrameId, scheme: string, side: boolean = false, raisedShape?: ReaderRaisedShape) {
    this.id = id;
    this.scheme = scheme;
    this.side = side;
    this.raisedShape = raisedShape;
  }

  applyNormalAttribute(instance: CommonAttribute): void {
    switch (this.id) {
      case 'floating-action-dock':
        instance.backgroundColor(readerAppColor('app.surface.dock', this.scheme))
          .border({ width: TOK_BORDER_W, color: readerAppColor('app.navigation.floatingBorder', this.scheme) })
          .borderRadius(this.raisedShape?.radius ?? TOK_RADIUS_XL).clip(true)
          .shadow(readerSurfaceElevation('raised', this.scheme));
        return;
      case 'reader':
      case 'reader-menu':
        instance.backgroundColor(readerAppColor('TOK_READ_SURFACE', this.scheme))
          .border({ width: TOK_BORDER_W, color: readerAppColor('TOK_LINE_STRONG', this.scheme) })
          .borderRadius(this.id === 'reader' ? TOK_RADIUS_XL : 12);
        return;
      case 'reader-card':
      case 'reader-full-card':
        instance.backgroundColor(readerAppColor('TOK_SURFACE_PANEL', this.scheme))
          .border({ width: TOK_BORDER_W,
            color: readerAppColor(this.id === 'reader-card' ? 'TOK_LINE_STRONG' : 'TOK_LINE', this.scheme) })
          .borderRadius(this.id === 'reader-card' ? 8 : 12);
        return;
      case 'reader-soft-control':
        instance.backgroundColor(readerAppColor('TOK_SURFACE_PANEL_SOFT', this.scheme))
          .border({ width: TOK_BORDER_W, color: readerAppColor('TOK_LINE', this.scheme) })
          .borderRadius(8);
        return;
      case 'reader-quick-fill':
      case 'reader-full-fill':
        // During morph the outline is a separate actor above scrolling content.
        instance.backgroundColor(readerAppColor('TOK_SURFACE_PANEL', this.scheme))
          .borderRadius(this.id === 'reader-quick-fill' ? 8 : 12);
        return;
      default:
        this.applyMangaFrame(instance);
    }
  }

  private applyMangaFrame(instance: CommonAttribute): void {
    const surface = mangaDirectoryColor('surface', this.scheme);
    const line = mangaDirectoryColor('line', this.scheme);
    const dark = this.scheme === 'night';
    instance.backgroundColor(surface);
    if (this.id === 'manga-directory-sheet') {
      const radius = this.side ? 0 : DIRECTORY_CHROME_VISUAL.quickSheetRadius;
      instance.border(this.side ? { width: { left: 1 }, color: line } : undefined)
        .borderRadius({ topLeft: radius, topRight: radius, bottomLeft: 0, bottomRight: 0 }).clip(true)
        .shadow({ radius: this.side ? 32 : 48, color: this.side ? '#11000000' : dark ? '#66000000' : '#33000000',
          offsetX: this.side ? -14 : 0, offsetY: this.side ? 0 : -16 });
      return;
    }
    if (this.id === 'manga-directory-rail') {
      instance.border({ width: { right: 1 }, color: line });
      return;
    }
    instance.border({ width: TOK_BORDER_W, color: line });
    if (this.id === 'manga-chapter-end') {
      instance.borderRadius(20).shadow({ radius: dark ? 0 : 16, color: dark ? '#44000000' : '#1A594632', offsetX: 0, offsetY: 4 });
    } else if (this.id === 'manga-toolbar') {
      instance.borderRadius(DIRECTORY_CHROME_VISUAL.headerRadius).clip(true)
        .shadow({ radius: dark ? 0 : 8, color: dark ? '#22000000' : '#1A594632', offsetX: 0, offsetY: 3 });
    } else {
      instance.borderRadius(24).clip(true)
        .shadow({ radius: 8, color: dark ? '#44000000' : '#1A594632', offsetX: 0, offsetY: -3 });
    }
  }
}
