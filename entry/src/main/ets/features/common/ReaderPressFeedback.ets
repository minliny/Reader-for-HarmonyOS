import { ColorMetrics } from '@kit.ArkUI';
import { readerAppColor } from './ReaderThemeRegistry';

/** Figma InteractionStateLayer: accent at 12%, above the current surface.
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
      const accent = ColorMetrics.resourceColor(readerAppColor('TOK_ACCENT', this.scheme));
      const overlay = ColorMetrics.rgba(accent.red, accent.green, accent.blue, 0.12);
      return ColorMetrics.resourceColor(this.surface).blendColor(overlay).color;
    } catch (_) { return this.surface; }
  }

  applyPressedAttribute(instance: CommonAttribute): void {
    instance.backgroundColor(this.pressedSurface()).borderRadius(this.enabled ? this.pressedRadius : this.radius);
  }

  applyDisabledAttribute(instance: CommonAttribute): void {
    this.applyNormalAttribute(instance);
  }
}
