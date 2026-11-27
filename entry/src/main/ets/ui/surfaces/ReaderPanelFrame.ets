import { readerSurfaceElevation } from './ReaderSurfaceSpecs';
import { DIRECTORY_CHROME_VISUAL, mangaDirectoryColor } from '../foundation/ReaderDirectoryChromeVisual';
import { readerAppColor } from '../foundation/ReaderThemeRegistry';
import { readerWindowMetrics } from '../foundation/ReaderWindowEnvironment';
import { TOK_BORDER_W, TOK_RADIUS_XL } from '../foundation/ReaderTokens';
import type { ReaderRaisedShape } from '../layout/ReaderRaisedShape';
import type { ReaderSurfaceMaterialDecision } from '../../app/HarmonyCapabilityPolicy';
import { applyReaderImmersiveMaterial, readerNativeSurfaceOutline } from './ReaderSurfaceMaterial';
import { readerIslandCardPaint, readerReadingPanelPaint } from './ReaderReadingPanelPaint';

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
      case 'floating-action-dock': {
        const borderColor = readerAppColor('app.navigation.floatingBorder', this.scheme);
        const radius = this.raisedShape?.radius ?? TOK_RADIUS_XL;
        this.applyMaterialPaint(instance, readerAppColor('app.surface.dock', this.scheme),
          { width: TOK_BORDER_W, color: borderColor }, readerSurfaceElevation('raised', this.scheme),
          readerNativeSurfaceOutline(this.scheme, radius));
        instance.borderRadius(radius).clip(false);
        return;
      }
      case 'reader': {
        const native = this.material?.native === true;
        const paint = readerReadingPanelPaint(this.scheme, native);
        if (!native) applyReaderImmersiveMaterial(instance, this.material, true, true);
        instance.backgroundEffect(undefined).backgroundColor(paint.surface ?? Color.Transparent)
          .borderRadius(TOK_RADIUS_XL);
        if (native) applyReaderImmersiveMaterial(instance, this.material, paint.nativeShadow, true);
        // Native material controls border and shadow on its node. The independent
        // outline keeps the shell edge across native/fallback policy switches.
        instance.outline({ width: paint.outlineWidth, color: paint.outline, radius: TOK_RADIUS_XL });
        return;
      }
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
      case 'reader-island-emphasis': {
        const paint = readerIslandCardPaint(this.scheme, this.id === 'reader-island-emphasis');
        instance.backgroundColor(paint.surface)
          .border({ width: TOK_BORDER_W, color: paint.border })
          .borderRadius(12);
        return;
      }
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

  private applyMaterialPaint(instance: CommonAttribute, background: ResourceColor, border: BorderOptions | undefined,
    shadow: ShadowOptions, outline: OutlineOptions): void {
    if (this.material?.native) {
      instance.backgroundEffect(undefined).backgroundColor(Color.Transparent);
      applyReaderImmersiveMaterial(instance, this.material, true, true);
      instance.outline(outline);
    } else {
      applyReaderImmersiveMaterial(instance, this.material, true, true);
      instance.backgroundColor(background).border(border).shadow(shadow).outline(undefined);
    }
  }

  private applyMangaFrame(instance: CommonAttribute): void {
    const surface = mangaDirectoryColor('surface', this.scheme);
    const line = mangaDirectoryColor('line', this.scheme);
    if (this.id === 'manga-directory-sheet') {
      const radius = this.side ? 0 : DIRECTORY_CHROME_VISUAL.quickSheetRadius;
      const corners: OutlineRadiuses = { topLeft: radius, topRight: radius, bottomLeft: 0, bottomRight: 0 };
      const shadow: ShadowOptions = this.side ? {
        radius: 32 * readerWindowMetrics().densityPixels, color: readerAppColor('app.shadow.sheet', this.scheme),
        offsetX: -14 * readerWindowMetrics().densityPixels, offsetY: 0,
      } : readerSurfaceElevation('sheet', this.scheme);
      this.applyMaterialPaint(instance, surface, this.side ? { width: { left: 1 }, color: line } : undefined, shadow,
        readerNativeSurfaceOutline(this.scheme, corners, this.side ? 'left' : 'top'));
      instance.borderRadius(corners).clip(true);
      return;
    }
    if (this.id === 'manga-dock') {
      this.applyMaterialPaint(instance, surface, { width: TOK_BORDER_W, color: line },
        readerSurfaceElevation('sheet', this.scheme), readerNativeSurfaceOutline(this.scheme, 24));
      instance.borderRadius(24).clip(true);
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
