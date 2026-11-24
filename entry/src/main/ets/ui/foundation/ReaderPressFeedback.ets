import { ColorMetrics } from '@kit.ArkUI';
import { readerAppColor } from './ReaderThemeRegistry';

/** The theme's neutral ink overlay is composited above the current surface.
 * ArkUI owns press/release/cancel state; ColorMetrics owns alpha composition.
 * Keep selected/disabled business state in the consuming component. */
export class ReaderPressFeedback implements AttributeModifier<CommonAttribute> {
  private readonly surface: ResourceColor;
  private readonly scheme: string;
  private readonly radius: number;
  private readonly pressedRadius: number;
  private readonly enabled: boolean;

  constructor(surface: ResourceColor = Color.Transparent, scheme: string = 'day',
    radius: number = 0, pressedRadius: number = radius, enabled: boolean = true) {
    this.surface = surface;
    this.scheme = scheme;
    this.radius = radius;
    this.pressedRadius = pressedRadius;
    this.enabled = enabled;
  }

  applyNormalAttribute(instance: CommonAttribute): void {
    instance.backgroundColor(this.surface).borderRadius(this.radius);
  }

  // Reuse official alpha composition for finite gradient stops as well as
  // flat surfaces. Failure retains the exact original surface.
  pressedSurface(): ResourceColor {
    if (!this.enabled) return this.surface;
    try {
      return this.composePressedSurface();
    } catch (_) { return this.surface; }
  }

  private composePressedSurface(): ResourceColor {
    const overlay = ColorMetrics.resourceColor(readerAppColor('app.interaction.press', this.scheme));
    return ColorMetrics.resourceColor(this.surface).blendColor(overlay).color;
  }

  applyPressedAttribute(instance: CommonAttribute): void {
    if (!this.enabled) {
      this.applyNormalAttribute(instance);
      return;
    }
    try {
      instance.backgroundColor(this.composePressedSurface()).borderRadius(this.pressedRadius);
    } catch (_) {
      // Keep the original complete fallback, including geometry, when the
      // platform cannot produce the pressed surface.
      this.applyNormalAttribute(instance);
    }
  }

  applyDisabledAttribute(instance: CommonAttribute): void {
    this.applyNormalAttribute(instance);
  }
}
