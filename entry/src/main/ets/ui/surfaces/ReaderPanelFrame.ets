import { readerSurfaceElevation } from './ReaderSurfaceSpecs';
import { DIRECTORY_CHROME_VISUAL, mangaDirectoryColor } from '../foundation/ReaderDirectoryChromeVisual';
import { readerAppColor } from '../foundation/ReaderThemeRegistry';
import { readerWindowMetrics } from '../foundation/ReaderWindowEnvironment';
import { TOK_BORDER_W, TOK_RADIUS_XL } from '../foundation/ReaderTokens';
import type { ReaderRaisedShape } from '../layout/ReaderRaisedShape';
import type { ReaderSurfaceMaterialDecision } from '../../app/HarmonyCapabilityPolicy';
import { readerImmersiveMaterial } from './ReaderSurfaceMaterial';

export type ReaderPanelFrameId = 'reader' | 'reader-menu' | 'reader-card' | 'reader-full-card' | 'reader-soft-control' | 'floating-action-dock' |
  'reader-island-card' | 'reader-island-emphasis' |
  'reader-quick-fill' | 'reader-full-fill' | 'manga-toolbar' | 'manga-dock' |
  'manga-directory-sheet' | 'manga-directory-rail' | 'manga-chapter-end';

/** Paint the host's frame in place. Measurement, positioning, input and animation
 * stay with the existing owner, so a morph keeps the same native actors. */
export class ReaderPanelFrame implements AttributeModifier<CommonAttribute> {
  private readonly id: ReaderPanelFrameId;
  private readonly scheme: string;
  private readonly side: boolean;
  private readonly raisedShape: ReaderRaisedShape | undefined;
  private readonly material: ReaderSurfaceMaterialDecision | undefined;
  constructor(id: ReaderPanelFrameId, scheme: string, side: boolean = false, raisedShape?: ReaderRaisedShape,
    material?: ReaderSurfaceMaterialDecision) {
    this.id = id;
    this.scheme = scheme;
    this.side = side;
    this.raisedShape = raisedShape;
    this.material = material;
  }

  applyNormalAttribute(instance: CommonAttribute): void {
    switch (this.id) {
      case 'floating-action-dock':
        this.applyMaterialPaint(instance, readerAppColor('app.surface.dock', this.scheme),
          { width: TOK_BORDER_W, color: readerAppColor('app.navigation.floatingBorder', this.scheme) },
          readerSurfaceElevation('raised', this.scheme));
        instance
          .borderRadius(this.raisedShape?.radius ?? TOK_RADIUS_XL).clip(false)
          .systemMaterial(readerImmersiveMaterial(this.material));
        return;
      case 'reader':
        this.applyMaterialPaint(instance, readerAppColor('TOK_READ_SURFACE', this.scheme),
          { width: TOK_BORDER_W, color: readerAppColor('TOK_LINE_STRONG', this.scheme) });
        instance.borderRadius(TOK_RADIUS_XL).systemMaterial(readerImmersiveMaterial(this.material));
        return;
      case 'reader-menu':
        instance.backgroundColor(readerAppColor('TOK_READ_SURFACE', this.scheme))
          .border({ width: TOK_BORDER_W, color: readerAppColor('TOK_LINE_STRONG', this.scheme) })
          .borderRadius(12);
        return;
      case 'reader-card':
      case 'reader-full-card':
        instance.backgroundColor(readerAppColor('TOK_SURFACE_PANEL', this.scheme))
          .border({ width: TOK_BORDER_W,
            color: readerAppColor(this.id === 'reader-card' ? 'TOK_LINE_STRONG' : 'TOK_LINE', this.scheme) })
          .borderRadius(this.id === 'reader-card' ? 8 : 12);
        return;
      case 'reader-island-card':
      case 'reader-island-emphasis':
        instance.backgroundColor(readerAppColor(this.id === 'reader-island-emphasis' ?
          'TOK_READ_CARD_EMPHASIS' : 'TOK_READ_ELEVATED', this.scheme))
          .border({ width: TOK_BORDER_W, color: readerAppColor(this.id === 'reader-island-emphasis' ?
            'TOK_PRIMARY_BORDER' : 'TOK_LINE', this.scheme) })
          .borderRadius(12);
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

  private applyMaterialPaint(instance: CommonAttribute, background: ResourceColor, border?: BorderOptions,
    shadow?: ShadowOptions): void {
    if (this.material?.native) {
      instance.backgroundEffect(undefined).backgroundColor(Color.Transparent)
        .border({ width: 0, color: Color.Transparent }).shadow(undefined);
    } else {
      instance.backgroundColor(background).border(border);
      if (shadow !== undefined) instance.shadow(shadow);
    }
  }

  private applyMangaFrame(instance: CommonAttribute): void {
    const surface = mangaDirectoryColor('surface', this.scheme);
    const line = mangaDirectoryColor('line', this.scheme);
    if (this.id === 'manga-directory-sheet') {
      const radius = this.side ? 0 : DIRECTORY_CHROME_VISUAL.quickSheetRadius;
      const shadow: ShadowOptions = this.side ? {
        radius: 32 * readerWindowMetrics().densityPixels, color: readerAppColor('app.shadow.sheet', this.scheme),
        offsetX: -14 * readerWindowMetrics().densityPixels, offsetY: 0,
      } : readerSurfaceElevation('sheet', this.scheme);
      this.applyMaterialPaint(instance, surface, this.side ? { width: { left: 1 }, color: line } : undefined, shadow);
      instance.borderRadius({ topLeft: radius, topRight: radius, bottomLeft: 0, bottomRight: 0 }).clip(true)
        .systemMaterial(readerImmersiveMaterial(this.material));
      return;
    }
    if (this.id === 'manga-dock') {
      this.applyMaterialPaint(instance, surface, { width: TOK_BORDER_W, color: line },
        readerSurfaceElevation('sheet', this.scheme));
      instance.borderRadius(24).clip(true).systemMaterial(readerImmersiveMaterial(this.material));
      return;
    }
    instance.backgroundColor(surface);
    if (this.id === 'manga-directory-rail') {
      instance.border({ width: { right: 1 }, color: line });
      return;
    }
    instance.border({ width: TOK_BORDER_W, color: line });
    if (this.id === 'manga-chapter-end') {
      instance.borderRadius(20).shadow(readerSurfaceElevation('popover', this.scheme));
    } else if (this.id === 'manga-toolbar') {
      instance.borderRadius(DIRECTORY_CHROME_VISUAL.headerRadius).clip(true)
        .shadow(readerSurfaceElevation('floating', this.scheme));
    }
  }
}
